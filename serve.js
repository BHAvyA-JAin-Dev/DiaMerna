const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');

const PORT = 5500;
const ROOT = path.join(__dirname, 'dev');
const JWT_SECRET = 'diamerna_jwt_secret_change_in_prod_' + uuid();

/* ===== OAuth Credentials (set via environment variables) =====
   Currently only Dropbox is configured. To add more providers,
   extend the OAUTH object and update the endpoints below.
   ============================================================== */
const OAUTH = {
  dropbox: {
    client_id:     process.env.DROPBOX_CLIENT_ID     || '',
    client_secret: process.env.DROPBOX_CLIENT_SECRET || ''
  }
};

/* ===== Rate Limiter (per-email + per-IP) ===== */
const rateLimitMap = new Map();
function rateLimit(ip, email) {
  const key = ip + '|' + (email || 'unknown');
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) { entry = { count: 0, resetAt: now + 900000 } }
  entry.count++;
  rateLimitMap.set(key, entry);
  if (rateLimitMap.size > 2000) {
    for (const [k, v] of rateLimitMap) if (v.resetAt < now) rateLimitMap.delete(k);
  }
  return entry;
}

/* ===== Database ===== */
const db = new Database(path.join(__dirname, 'diamerna.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    pin TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS cloud_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    folder_id TEXT,
    connected_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    provider TEXT,
    cloud_file_id TEXT,
    public_url TEXT,
    type TEXT DEFAULT 'report',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

`);

const MIME = {
  '.html':'text/html','.css':'text/css','.js':'application/javascript',
  '.json':'application/json','.png':'image/png','.jpg':'image/jpeg',
  '.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'
};

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function getBody(req) {
  return new Promise(resolve => {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => resolve(b));
  });
}

function auth(req) {
  const h = req.headers['authorization'] || '';
  const t = h.replace('Bearer ', '');
  try { return jwt.verify(t, JWT_SECRET) } catch { return null }
}

/* ===== OAuth helper: exchange code for tokens ===== */
function oauthExchange(provider, code, clientId, clientSecret, redirectUri) {
  return new Promise((resolve, reject) => {
    if (provider !== 'dropbox') return reject(new Error('Unknown provider'));
    const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString();
    const opts = { hostname: 'api.dropboxapi.com', path: '/oauth2/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
    const r = https.request(opts, r2 => { let d = ''; r2.on('data', c => d += c); r2.on('end', () => { try { resolve(JSON.parse(d)) } catch { reject(new Error(d)) } }) });
    r.on('error', reject); r.write(body); r.end();
  });
}

const OAUTH_REDIRECT_URI = 'http://localhost:5500/api/oauth/callback';

/* ===== Auth & Cloud API Routes ===== */
const routes = {

  /* --- Register (with PIN) --- */
  async 'POST /api/register'(req, res) {
    const { email, password, name, pin } = JSON.parse(await getBody(req));
    if (!email || !password || !name || !pin) return json(res, 400, { error: 'email, password, name, and pin required' });
    if (!/^\d{4,6}$/.test(pin)) return json(res, 400, { error: 'PIN must be 4-6 digits' });
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return json(res, 409, { error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const pinHash = await bcrypt.hash(pin, 10);
    const id = uuid();
    db.prepare('INSERT INTO users (id, email, name, password, pin) VALUES (?, ?, ?, ?, ?)').run(id, email, name, hash, pinHash);
    const token = jwt.sign({ id, email, name }, JWT_SECRET, { expiresIn: '30d' });
    json(res, 201, { token, user: { id, email, name } });
  },

  /* --- Login (rate limited per-email+IP) --- */
  async 'POST /api/login'(req, res) {
    const { email, password } = JSON.parse(await getBody(req));
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const rl = rateLimit(ip, email);
    if (rl.count > 10) return json(res, 429, { error: 'Too many attempts for this account. Try again in 15 minutes.' });
    if (!email || !password) return json(res, 400, { error: 'email and password required' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return json(res, 401, { error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return json(res, 401, { error: 'Invalid credentials' });
    /* Reset rate limit on success */
    rateLimitMap.delete(ip + '|' + email);
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
    json(res, 200, { token, user: { id: user.id, email: user.email, name: user.name } });
  },

  /* --- Forgot password (verify PIN, reset password) --- */
  async 'POST /api/forgot-password'(req, res) {
    const { email, pin, newPassword } = JSON.parse(await getBody(req));
    if (!email || !pin || !newPassword) return json(res, 400, { error: 'email, pin, and newPassword required' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return json(res, 404, { error: 'Email not found' });
    const match = await bcrypt.compare(pin, user.pin);
    if (!match) return json(res, 401, { error: 'Invalid PIN' });
    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);
    json(res, 200, { success: true, message: 'Password reset successfully. You can now login with your new password.' });
  },

  /* --- Get profile --- */
  'GET /api/me'(req, res) {
    const u = auth(req);
    if (!u) return json(res, 401, { error: 'Unauthorized' });
    const user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(u.id);
    const clouds = db.prepare('SELECT provider, connected_at, folder_id FROM cloud_tokens WHERE user_id = ?').all(u.id);
    const envProviders = Object.keys(OAUTH).filter(p => OAUTH[p].client_id);
    json(res, 200, { user, clouds, envProviders });
  },

  /* --- Save cloud tokens (manual) --- */
  async 'POST /api/cloud/connect'(req, res) {
    const u = auth(req);
    if (!u) return json(res, 401, { error: 'Unauthorized' });
    const { provider, access_token, refresh_token } = JSON.parse(await getBody(req));
    if (!provider || !access_token) return json(res, 400, { error: 'provider and access_token required' });
    const existing = db.prepare('SELECT id FROM cloud_tokens WHERE user_id = ? AND provider = ?').get(u.id, provider);
    if (existing) {
      db.prepare('UPDATE cloud_tokens SET access_token = ?, refresh_token = ?, connected_at = datetime("now") WHERE id = ?').run(access_token, refresh_token || '', existing.id);
    } else {
      db.prepare('INSERT INTO cloud_tokens (id, user_id, provider, access_token, refresh_token) VALUES (?, ?, ?, ?, ?)').run(uuid(), u.id, provider, access_token, refresh_token || '');
    }
    let folderId = '';
    if (provider === 'google_drive' && access_token) {
      try {
        const fd = await new Promise((resolve, reject) => {
          const b = JSON.stringify({ name: 'DiaMerna', mimeType: 'application/vnd.google-apps.folder' });
          const opts = {
            hostname: 'www.googleapis.com', path: '/drive/v3/files', method: 'POST',
            headers: { 'Authorization': 'Bearer ' + access_token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) }
          };
          const r = https.request(opts, r2 => { let d = ''; r2.on('data', c => d += c); r2.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve({}) } }) });
          r.on('error', reject); r.write(b); r.end();
        });
        folderId = fd.id || '';
      } catch {}
    }
    if (folderId) db.prepare('UPDATE cloud_tokens SET folder_id = ? WHERE user_id = ? AND provider = ?').run(folderId, u.id, provider);
    json(res, 200, { connected: true, folderId, provider });
  },

  /* --- One-tap OAuth: generate Dropbox auth URL (uses env vars) --- */
  async 'POST /api/oauth/start'(req, res) {
    const u = auth(req);
    if (!u) return json(res, 401, { error: 'Unauthorized' });
    const { provider } = JSON.parse(await getBody(req));
    if (!provider) return json(res, 400, { error: 'provider required' });
    if (provider !== 'dropbox') return json(res, 400, { error: 'Only Dropbox is supported' });
    const creds = OAUTH.dropbox;
    if (!creds || !creds.client_id) return json(res, 400, { error: 'Dropbox OAuth not configured. The app owner must set DROPBOX_CLIENT_ID and DROPBOX_CLIENT_SECRET env vars.' });
    const state = JSON.stringify({ userId: u.id, provider });
    const authUrl = 'https://www.dropbox.com/oauth2/authorize?' + new URLSearchParams({
      client_id: creds.client_id, redirect_uri: OAUTH_REDIRECT_URI,
      response_type: 'code', token_access_type: 'offline', state
    }).toString();
    json(res, 200, { authUrl, provider });
  },

  /* --- OAuth callback (exchange Dropbox code for tokens) --- */
  async 'GET /api/oauth/callback'(req, res) {
    const q = url.parse(req.url, true).query;
    const { code, state, error: oauthError } = q;
    if (oauthError) {
      res.writeHead(302, { Location: '/?oauth_error=' + oauthError }); res.end(); return;
    }
    if (!code || !state) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h2>Missing code or state</h2><a href="/">Go back</a>'); return;
    }
    let stateData;
    try { stateData = JSON.parse(state) } catch {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h2>Invalid state</h2><a href="/">Go back</a>'); return;
    }
    const { userId, provider } = stateData;
    if (provider !== 'dropbox') {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h2>Only Dropbox is supported</h2><a href="/">Go back</a>'); return;
    }
    const creds = OAUTH.dropbox;
    if (!creds || !creds.client_id) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h2>Dropbox OAuth not configured on server.</h2><a href="/">Go back</a>'); return;
    }
    try {
      const tokenData = await oauthExchange('dropbox', code, creds.client_id, creds.client_secret, OAUTH_REDIRECT_URI);
      if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token || '';
      const existing = db.prepare('SELECT id FROM cloud_tokens WHERE user_id = ? AND provider = ?').get(userId, 'dropbox');
      if (existing) {
        db.prepare('UPDATE cloud_tokens SET access_token = ?, refresh_token = ?, connected_at = datetime("now") WHERE id = ?').run(accessToken, refreshToken, existing.id);
      } else {
        db.prepare('INSERT INTO cloud_tokens (id, user_id, provider, access_token, refresh_token) VALUES (?, ?, ?, ?, ?)').run(uuid(), userId, 'dropbox', accessToken, refreshToken);
      }
      res.writeHead(302, { Location: '/?oauth_success=dropbox' }); res.end();
    } catch (e) {
      res.writeHead(302, { Location: '/?oauth_error=' + encodeURIComponent(e.message) }); res.end();
    }
  },

  /* --- Check which providers have env-configured OAuth --- */
  'GET /api/oauth/env-status'(req, res) {
    const status = {};
    for (const p of Object.keys(OAUTH)) {
      status[p] = !!(OAUTH[p] && OAUTH[p].client_id);
    }
    json(res, 200, status);
  },

  /* --- Upload file to cloud --- */
  async 'POST /api/cloud/upload'(req, res) {
    const u = auth(req);
    if (!u) return json(res, 401, { error: 'Unauthorized' });
    const { provider, fileName, content } = JSON.parse(await getBody(req));
    if (!provider || !fileName || !content) return json(res, 400, { error: 'provider, fileName, content required' });
    const tok = db.prepare('SELECT * FROM cloud_tokens WHERE user_id = ? AND provider = ?').get(u.id, provider);
    if (!tok) return json(res, 400, { error: 'Provider not connected' });
    if (provider !== 'dropbox') return json(res, 400, { error: 'Only Dropbox is supported' });
    let publicUrl = '';
    try {
      const fId = uuid();
      const dropboxPath = '/' + fileName;
      const body = JSON.stringify({ path: dropboxPath, mode: 'add', autorename: true, mute: false }).slice(0, -1) + ',"content":"' + content.replace(/"/g, '\\"') + '"}';
      const fd = await new Promise((resolve, reject) => {
        const opts = {
          hostname: 'content.dropboxapi.com', path: '/2/files/upload', method: 'POST',
          headers: { 'Authorization': 'Bearer ' + tok.access_token, 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath, mode: 'add', autorename: true }), 'Content-Length': Buffer.byteLength(content) }
        };
        const r = https.request(opts, r2 => { let d = ''; r2.on('data', c => d += c); r2.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve({}) } }) });
        r.on('error', reject); r.write(content); r.end();
      });
      publicUrl = 'https://www.dropbox.com/home/' + (fd.path_display || fileName);
      db.prepare('INSERT INTO files (id, user_id, name, provider, cloud_file_id, public_url) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), u.id, fileName, provider, fd.id || fId, publicUrl);
    } catch (e) { return json(res, 500, { error: 'Upload failed', detail: e.message }) }
    json(res, 200, { uploaded: true, fileName, publicUrl, provider });
  },

  /* --- List user's cloud files --- */
  'GET /api/files'(req, res) {
    const u = auth(req);
    if (!u) return json(res, 401, { error: 'Unauthorized' });
    const files = db.prepare('SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(u.id);
    json(res, 200, { files });
  }
};

/* ===== Admin Routes ===== */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

routes['POST /api/admin/login'] = async function (req, res) {
  const { email, password } = JSON.parse(await getBody(req));
  if (!email || !password) return json(res, 400, { error: 'Email and password required' });
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return json(res, 401, { error: 'Invalid admin credentials' });
  const token = jwt.sign({ role: 'admin', email }, JWT_SECRET, { expiresIn: '24h' });
  json(res, 200, { token });
};

routes['GET /api/admin/stats'] = function (req, res) {
  const h = req.headers['authorization'] || '';
  const t = h.replace('Bearer ', '');
  try {
    const payload = jwt.verify(t, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('Not admin');
  } catch { return json(res, 401, { error: 'Unauthorized' }); }
  const totalUsers = (db.prepare('SELECT COUNT(*) AS c FROM users').get() || {}).c || 0;
  const dropboxConnections = (db.prepare('SELECT COUNT(DISTINCT user_id) AS c FROM cloud_tokens WHERE provider = ?').get('dropbox') || {}).c || 0;
  json(res, 200, { totalUsers, dropboxConnections });
};

/* ===== HTTP Server ===== */
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const routeKey = req.method + ' ' + req.url.split('?')[0];
  if (routes[routeKey]) return routes[routeKey](req, res);

  const __chatKeys = (process.env.OPENROUTER_API_KEY || '').split(',').map(s => s.trim()).filter(Boolean);
  let __chatIdx = 0;
  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const key = __chatKeys.length > 1 ? __chatKeys[(__chatIdx++) % __chatKeys.length] : (__chatKeys[0] || '');
      const opts = {
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key,
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const proxy = https.request(opts, proxyRes => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        proxyRes.pipe(res);
      });
      proxy.on('error', () => { res.writeHead(502); res.end('{"error":"proxy failed"}') });
      proxy.write(body);
      proxy.end();
    });
    return;
  }

  let file = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const fp = path.join(ROOT, file);
  const ext = path.extname(file).toLowerCase();
  const ct = MIME[ext] || 'application/octet-stream';

  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
      res.end('<h1>404</h1>');
    } else {
      res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
      res.end(data);
    }
  });
}).listen(PORT, () => {
  console.log(`DiaMerna running → http://localhost:${PORT}`);
});

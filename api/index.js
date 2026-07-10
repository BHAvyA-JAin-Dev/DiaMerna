/* DiaMerna — Vercel Serverless API
   ⚡ In proxy mode (PERSISTENT_SERVER_URL set), all API calls go to the persistent server.
   ⚡ In standalone mode, runs as before (ephemeral SQLite in /tmp).

   Set PERSISTENT_SERVER_URL env var on Vercel to point to your persistent backend.
   This makes the web, desktop, and mobile all share the same database. */

const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const uuid = () => crypto.randomUUID();
const createDB = require('../db');

const app = express();
const ROOT = path.join(__dirname, '..', 'dev');
const JWT_SECRET = process.env.JWT_SECRET || 'diamerna_jwt_secret_' + uuid();
var OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || '';

const OAUTH = {};
if (process.env.DROPBOX_CLIENT_ID) {
  OAUTH.dropbox = { client_id: process.env.DROPBOX_CLIENT_ID, client_secret: process.env.DROPBOX_CLIENT_SECRET || '' };
}

/* === PROXY MODE: forward to persistent server === */
const PERSISTENT_SERVER_URL = process.env.PERSISTENT_SERVER_URL || '';

if (PERSISTENT_SERVER_URL) {
  console.log('🔄 Proxy mode →', PERSISTENT_SERVER_URL);
  /* In proxy mode, forward all /api/* to the persistent server */
  app.all('/api/*', (req, res) => {
    const targetUrl = PERSISTENT_SERVER_URL.replace(/\/+$/, '') + req.url;
    const parsed = new URL(targetUrl);
    const mod = parsed.protocol === 'https:' ? https : http;

    let body = null;
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      body = [];
      req.on('data', c => body.push(c));
      req.on('end', () => {
        body = Buffer.concat(body);
        doProxy();
      });
    } else {
      doProxy();
    }

    function doProxy() {
      const opts = {
        hostname: parsed.hostname,
        port: parsed.port || (mod === https ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: req.method,
        headers: { ...req.headers, host: parsed.hostname },
        timeout: 30000
      };
      if (body && body.length > 0) opts.headers['Content-Length'] = Buffer.byteLength(body);
      const r = mod.request(opts, r2 => {
        res.writeHead(r2.statusCode, r2.headers);
        r2.pipe(res);
      });
      r.on('error', () => {
        res.status(502).json({ error: 'Persistent server unreachable. Set PERSISTENT_SERVER_URL correctly.' });
      });
      if (body && body.length > 0) r.write(body);
      r.end();
    }
  });

  /* Static files still served from Vercel */
  app.use(express.static(ROOT, { maxAge: 0, etag: false }));
  app.get('*', (req, res) => {
    const fp = path.join(ROOT, req.path === '/' ? 'index.html' : req.path);
    if (fs.existsSync(fp)) {
      const ext = path.extname(fp).toLowerCase();
      const mime = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2' };
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
      res.sendFile(fp);
    } else {
      res.sendFile(path.join(ROOT, 'index.html'));
    }
  });
} else {
  /* ===== STANDALONE MODE (original, ephemeral SQLite) ===== */
  console.log('⚡ Standalone mode (ephemeral DB)');

  const rateLimitMap = new Map();
  function rateLimit(ip, email) {
    const key = ip + '|' + (email || 'unknown');
    const now = Date.now();
    let entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) entry = { count: 0, resetAt: now + 900000 };
    entry.count++;
    rateLimitMap.set(key, entry);
    if (rateLimitMap.size > 2000) {
      for (const [k, v] of rateLimitMap) if (v.resetAt < now) rateLimitMap.delete(k);
    }
    return entry;
  }

  let _dbPromise = null;
  let _db = null;
  async function getDB() {
    if (_db) return _db;
    if (!_dbPromise) {
      _dbPromise = createDB().then(db => {
        db.exec(`CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
          password TEXT NOT NULL, pin TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );`);
        db.exec(`CREATE TABLE IF NOT EXISTS cloud_tokens (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT NOT NULL,
          access_token TEXT, refresh_token TEXT, folder_id TEXT,
          connected_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY(user_id) REFERENCES users(id)
        );`);
        db.exec(`CREATE TABLE IF NOT EXISTS files (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
          provider TEXT, cloud_file_id TEXT, public_url TEXT,
          type TEXT DEFAULT 'report', created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY(user_id) REFERENCES users(id)
        );`);
        db.exec(`CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now'))
        );`);
        _db = db;
        return db;
      });
    }
    return _dbPromise;
  }

  function auth(req) {
    const h = req.headers['authorization'] || '';
    const t = h.replace('Bearer ', '');
    try { return jwt.verify(t, JWT_SECRET) } catch { return null }
  }

  function signToken(user, additionalClouds) {
    const payload = { id: user.id, email: user.email, name: user.name };
    if (additionalClouds && additionalClouds.length) {
      payload.clouds = additionalClouds.map(c => ({
        provider: c.provider, folder_id: c.folder_id || '',
        access_token: c.access_token || '', refresh_token: c.refresh_token || ''
      }));
    }
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
  }

  function oauthExchange(code, clientId, clientSecret) {
    return new Promise((resolve, reject) => {
      const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: OAUTH_REDIRECT_URI, grant_type: 'authorization_code' }).toString();
      const opts = { hostname: 'api.dropboxapi.com', path: '/oauth2/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, timeout: 15000 };
      const r = https.request(opts, r2 => {
        let d = ''; r2.on('data', c => d += c);
        r2.on('end', () => {
          try { const o = JSON.parse(d); if (r2.statusCode >= 400) reject(new Error(o.error_description || o.error || JSON.stringify(o))); else resolve(o); }
          catch { reject(new Error('Dropbox OAuth returned: ' + d.slice(0, 200))) }
        });
      });
      r.on('error', reject);
      r.on('timeout', () => { r.destroy(); reject(new Error('Dropbox OAuth timed out')) });
      r.write(body); r.end();
    });
  }

  async function dropboxRefreshToken(refreshToken) {
    const creds = OAUTH.dropbox;
    if (!creds || !creds.client_id || !creds.client_secret || !refreshToken) return null;
    return new Promise((resolve, reject) => {
      const body = new URLSearchParams({ refresh_token: refreshToken, client_id: creds.client_id, client_secret: creds.client_secret, grant_type: 'refresh_token' }).toString();
      const opts = { hostname: 'api.dropboxapi.com', path: '/oauth2/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, timeout: 10000 };
      const r = https.request(opts, r2 => {
        let d = ''; r2.on('data', c => d += c);
        r2.on('end', () => {
          try { const o = JSON.parse(d); if (r2.statusCode >= 400) reject(new Error(o.error_description || o.error || JSON.stringify(o))); else resolve(o); }
          catch { reject(new Error('Dropbox refresh returned non-JSON: ' + d.slice(0, 200))) }
        });
      });
      r.on('error', reject);
      r.on('timeout', () => { r.destroy(); reject(new Error('Dropbox token refresh timed out')) });
      r.write(body); r.end();
    });
  }

  function dropboxApi(hostname, pathname, method, headers, body) {
    return new Promise((resolve, reject) => {
      const opts = { hostname, path: pathname, method, headers: headers || {}, timeout: 15000 };
      const r = https.request(opts, r2 => {
        let d = ''; r2.on('data', c => d += c);
        r2.on('end', () => {
          try { const o = JSON.parse(d); if (r2.statusCode >= 400) reject(new Error(o.error_summary || o.error_description || JSON.stringify(o))); else resolve(o); }
          catch { reject(new Error('Dropbox returned non-JSON: ' + (r2.statusCode || '?') + ' ' + d.slice(0, 200))) }
        });
      });
      r.on('error', reject);
      r.on('timeout', () => { r.destroy(); reject(new Error('Dropbox request timed out')) });
      if (body) r.write(body);
      r.end();
    });
  }

  async function dropboxValidToken(db, userId, provider) {
    let tok = db.prepare('SELECT * FROM cloud_tokens WHERE user_id = ? AND provider = ?').get(userId, provider);
    if (!tok) return null;
    if (tok.refresh_token) {
      const refreshed = await dropboxRefreshToken(tok.refresh_token);
      if (refreshed && refreshed.access_token) {
        tok.access_token = refreshed.access_token;
        db.prepare('UPDATE cloud_tokens SET access_token = ?, connected_at = datetime("now") WHERE id = ?').run(refreshed.access_token, tok.id);
      }
    }
    return tok;
  }

  async function dropboxTokenFromJWT(u, provider) {
    if (!u.clouds) return null;
    const c = u.clouds.find(x => x.provider === provider);
    if (!c || !c.access_token) return null;
    if (c.refresh_token) {
      try {
        const refreshed = await dropboxRefreshToken(c.refresh_token);
        if (refreshed && refreshed.access_token) {
          c.access_token = refreshed.access_token;
          return { access_token: refreshed.access_token, folder_id: c.folder_id, refresh_token: c.refresh_token, _refreshed: true };
        }
      } catch {}
    }
    return { access_token: c.access_token, folder_id: c.folder_id, refresh_token: c.refresh_token || '' };
  }

  async function dropboxEnsureFolder(accessToken, folderPath) {
    const body = JSON.stringify({ path: folderPath });
    const headers = { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' };
    try { return await dropboxApi('api.dropboxapi.com', '/2/files/create_folder_v2', 'POST', headers, body); }
    catch (e) { if (e.message && e.message.includes('path/conflict/folder')) return { success: true }; throw e; }
  }

  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(204).end(); return }
    next();
  });

  /* === API Routes (standalone) === */
  app.post('/api/register', async (req, res) => {
    const db = await getDB();
    const { email, password, name, pin } = req.body;
    if (!email || !password || !name || !pin) return res.status(400).json({ error: 'email, password, name, and pin required' });
    if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const pinHash = await bcrypt.hash(pin, 10);
    const id = uuid();
    db.prepare('INSERT INTO users (id, email, name, password, pin) VALUES (?, ?, ?, ?, ?)').run(id, email, name, hash, pinHash);
    const token = jwt.sign({ id, email, name }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: { id, email, name } });
  });

  app.post('/api/login', async (req, res) => {
    const db = await getDB();
    const { email, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    const rl = rateLimit(ip, email);
    if (rl.count > 10) return res.status(429).json({ error: 'Too many attempts for this account. Try again in 15 minutes.' });
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    rateLimitMap.delete(ip + '|' + email);
    const dbClouds = db.prepare('SELECT provider, folder_id, access_token, refresh_token FROM cloud_tokens WHERE user_id = ?').all(user.id);
    const token = signToken(user, dbClouds.length ? dbClouds : null);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  app.post('/api/forgot-password', async (req, res) => {
    const db = await getDB();
    const { email, pin, newPassword } = req.body;
    if (!email || !pin || !newPassword) return res.status(400).json({ error: 'email, pin, and newPassword required' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'Email not found' });
    const match = await bcrypt.compare(pin, user.pin);
    if (!match) return res.status(401).json({ error: 'Invalid PIN' });
    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);
    res.json({ success: true, message: 'Password reset successfully.' });
  });

  app.get('/api/me', async (req, res) => {
    const db = await getDB();
    const u = auth(req);
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    let user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(u.id);
    if (!user) user = { id: u.id, email: u.email, name: u.name };
    const dbClouds = db.prepare('SELECT provider, connected_at, folder_id FROM cloud_tokens WHERE user_id = ?').all(u.id);
    const clouds = dbClouds.length ? dbClouds : (u.clouds || []);
    const envProviders = Object.keys(OAUTH).filter(p => OAUTH[p] && OAUTH[p].client_id);
    res.json({ user, clouds, envProviders });
  });

  app.post('/api/cloud/connect', async (req, res) => {
    const db = await getDB();
    const u = auth(req);
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    const { provider, access_token, refresh_token } = req.body;
    if (!provider || !access_token) return res.status(400).json({ error: 'provider and access_token required' });
    const userName = u.name || u.email || 'user';
    const folderId = '/DiaMerna/' + userName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const existing = db.prepare('SELECT id FROM cloud_tokens WHERE user_id = ? AND provider = ?').get(u.id, provider);
    if (existing) {
      db.prepare('UPDATE cloud_tokens SET access_token = ?, refresh_token = ?, folder_id = ?, connected_at = datetime("now") WHERE id = ?').run(access_token, refresh_token || '', folderId, existing.id);
    } else {
      db.prepare('INSERT INTO cloud_tokens (id, user_id, provider, access_token, refresh_token, folder_id) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), u.id, provider, access_token, refresh_token || '', folderId);
    }
    db.prepare('UPDATE users SET name = ? WHERE id = ? AND (name IS NULL OR name = ?)').run(u.name, u.id, '');
    const uClouds = (u.clouds || []).filter(c => c.provider !== provider);
    uClouds.push({ provider, access_token, refresh_token: refresh_token || '', folder_id: folderId });
    const newToken = signToken(u, uClouds);
    res.json({ connected: true, provider, folderId, token: newToken });
  });

  app.post('/api/oauth/start', (req, res) => {
    const u = auth(req);
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    const { provider } = req.body;
    if (!provider) return res.status(400).json({ error: 'provider required' });
    if (provider !== 'dropbox') return res.status(400).json({ error: 'Only Dropbox is supported' });
    const creds = OAUTH.dropbox;
    if (!creds || !creds.client_id) return res.status(400).json({ error: 'Dropbox OAuth not configured. Set DROPBOX_CLIENT_ID env var.' });
    const state = JSON.stringify({ userId: u.id, provider });
    const redirectUri = OAUTH_REDIRECT_URI || req.protocol + '://' + req.get('host') + '/api/oauth/callback';
    const authUrl = 'https://www.dropbox.com/oauth2/authorize?' + new URLSearchParams({
      client_id: creds.client_id, redirect_uri: redirectUri,
      response_type: 'code', token_access_type: 'offline', state
    }).toString();
    res.json({ authUrl, provider, redirectUri });
  });

  app.get('/api/oauth/callback', async (req, res) => {
    const db = await getDB();
    const { code, state, error: oauthError } = req.query;
    if (oauthError) { res.redirect('/?oauth_error=' + oauthError); return }
    if (!code || !state) { res.status(400).send('<h2>Missing code or state</h2><a href="/">Go back</a>'); return }
    let stateData;
    try { stateData = JSON.parse(state) } catch { res.status(400).send('<h2>Invalid state</h2><a href="/">Go back</a>'); return }
    const { userId, provider } = stateData;
    if (provider !== 'dropbox') { res.status(400).send('<h2>Only Dropbox is supported</h2><a href="/">Go back</a>'); return }
    const creds = OAUTH.dropbox;
    if (!creds || !creds.client_id) { res.status(400).send('<h2>Dropbox OAuth not configured on server.</h2><a href="/">Go back</a>'); return }
    try {
      const tokenData = await oauthExchange(code, creds.client_id, creds.client_secret);
      if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);
      const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
      const userName = (user && user.name) || 'user';
      const folderId = '/DiaMerna/' + userName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const existing = db.prepare('SELECT id FROM cloud_tokens WHERE user_id = ? AND provider = ?').get(userId, 'dropbox');
      if (existing) {
        db.prepare('UPDATE cloud_tokens SET access_token = ?, refresh_token = ?, folder_id = ?, connected_at = datetime("now") WHERE id = ?').run(tokenData.access_token, tokenData.refresh_token || '', folderId, existing.id);
      } else {
        db.prepare('INSERT INTO cloud_tokens (id, user_id, provider, access_token, refresh_token, folder_id) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), userId, 'dropbox', tokenData.access_token, tokenData.refresh_token || '', folderId);
      }
      try { await dropboxEnsureFolder(tokenData.access_token, folderId); } catch {}
      const uInfo = user || { id: userId, name: userName, email: '' };
      const newToken = signToken(uInfo, [{ provider: 'dropbox', access_token: tokenData.access_token, refresh_token: tokenData.refresh_token || '', folder_id: folderId }]);
      res.redirect('/more.html?oauth_success=dropbox&token=' + encodeURIComponent(newToken));
    } catch (e) { res.redirect('/?oauth_error=' + encodeURIComponent(e.message)) }
  });

  app.get('/api/oauth/env-status', (req, res) => {
    const status = {};
    for (const p of Object.keys(OAUTH)) status[p] = !!(OAUTH[p] && OAUTH[p].client_id);
    res.json(status);
  });

  app.post('/api/cloud/upload', async (req, res) => {
    const db = await getDB();
    const u = auth(req);
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    const { provider, fileName, content } = req.body;
    if (!provider || !fileName || !content) return res.status(400).json({ error: 'provider, fileName, content required' });
    if (provider !== 'dropbox') return res.status(400).json({ error: 'Only Dropbox is supported' });
    let tok = await dropboxValidToken(db, u.id, provider);
    if (!tok) tok = await dropboxTokenFromJWT(u, provider);
    if (!tok) return res.status(400).json({ error: 'Provider not connected. Reconnect via OAuth.' });
    const folderPath = tok.folder_id || '/DiaMerna/' + (u.name || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
      await dropboxEnsureFolder(tok.access_token, folderPath);
      const dropboxPath = folderPath + '/' + fileName;
      const uploadHeaders = {
        'Authorization': 'Bearer ' + tok.access_token,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath, mode: 'add', autorename: true }),
        'Content-Length': Buffer.byteLength(content)
      };
      const fd = await dropboxApi('content.dropboxapi.com', '/2/files/upload', 'POST', uploadHeaders, content);
      if (fd.error) throw new Error(fd.error_summary || JSON.stringify(fd.error));
      const publicUrl = 'https://www.dropbox.com/home' + (fd.path_display || dropboxPath);
      db.prepare('INSERT INTO files (id, user_id, name, provider, cloud_file_id, public_url) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), u.id, fileName, provider, fd.id || uuid(), publicUrl);
      const newToken = (tok._refreshed) ? signToken(u, u.clouds) : null;
      res.json({ uploaded: true, fileName, publicUrl, provider, path: dropboxPath, token: newToken });
    } catch (e) { res.status(500).json({ error: 'Upload failed', detail: e.message }) }
  });

  app.get('/api/cloud/list', async (req, res) => {
    const db = await getDB();
    const u = auth(req);
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    const { provider } = req.query;
    if (!provider) return res.status(400).json({ error: 'provider required' });
    let tok = await dropboxValidToken(db, u.id, provider);
    if (!tok) tok = await dropboxTokenFromJWT(u, provider);
    if (!tok) return res.status(400).json({ error: 'Provider not connected. Reconnect via OAuth.' });
    const folderPath = tok.folder_id || '/DiaMerna/' + (u.name || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
      const body = JSON.stringify({ path: folderPath, limit: 50 });
      const headers = { 'Authorization': 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };
      const result = await dropboxApi('api.dropboxapi.com', '/2/files/list_folder', 'POST', headers, body);
      if (result.error) return res.json({ files: [], error: result.error_summary });
      const entries = (result.entries || []).map(e => ({
        name: e.name, path_display: e.path_display, id: e.id,
        size: e.size, modified: e.server_modified, type: e['.tag']
      }));
      res.json({ files: entries, path: folderPath });
    } catch (e) { res.status(500).json({ error: 'List failed', detail: e.message }) }
  });

  app.get('/api/files', async (req, res) => {
    const db = await getDB();
    const u = auth(req);
    if (!u) return res.status(401).json({ error: 'Unauthorized' });
    const files = db.prepare('SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(u.id);
    res.json({ files });
  });

  const CHAT_KEY_INDEX = { n: 0 };
  app.post('/api/chat', (req, res) => {
    const body = JSON.stringify(req.body);
    const keys = (process.env.OPENROUTER_API_KEY || '').split(',').map(s => s.trim()).filter(Boolean);
    const key = keys.length > 1 ? keys[(CHAT_KEY_INDEX.n++) % keys.length] : (keys[0] || '');
    const opts = {
      hostname: 'openrouter.ai', path: '/api/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key, 'Content-Length': Buffer.byteLength(body) }
    };
    const proxy = https.request(opts, proxyRes => {
      res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
      proxyRes.pipe(res);
    });
    proxy.on('error', () => { res.status(502).json({ error: 'proxy failed' }) });
    proxy.write(body);
    proxy.end();
  });

  /* Admin */
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

  app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid admin credentials' });
    const token = jwt.sign({ role: 'admin', email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  });

  app.get('/api/admin/stats', async (req, res) => {
    const h = req.headers['authorization'] || '';
    const t = h.replace('Bearer ', '');
    try {
      const payload = jwt.verify(t, JWT_SECRET);
      if (payload.role !== 'admin') throw new Error('Not admin');
    } catch { return res.status(401).json({ error: 'Unauthorized' }); }
    const db = await getDB();
    const totalUsers = (db.prepare('SELECT COUNT(*) AS c FROM users').get() || {}).c || 0;
    const dropboxConnections = (db.prepare('SELECT COUNT(DISTINCT user_id) AS c FROM cloud_tokens WHERE provider = ?').get('dropbox') || {}).c || 0;
    res.json({ totalUsers, dropboxConnections });
  });

  function adminAuth(req) {
    const h = req.headers['authorization'] || '';
    const t = h.replace('Bearer ', '');
    try { const p = jwt.verify(t, JWT_SECRET); return p.role === 'admin' ? p : null } catch { return null }
  }

  app.get('/api/admin/users', async (req, res) => {
    if (!adminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    const db = await getDB();
    const users = db.prepare('SELECT id, email, name, created_at FROM users ORDER BY created_at DESC').all();
    res.json({ users });
  });

  app.post('/api/admin/query', async (req, res) => {
    if (!adminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { sql, params } = req.body;
    if (!sql) return res.status(400).json({ error: 'sql required' });
    const lower = sql.trim().toLowerCase();
    if (lower.startsWith('drop') || lower.startsWith('delete') || lower.startsWith('update')) {
      return res.status(403).json({ error: 'Destructive queries not allowed via this endpoint' });
    }
    try {
      const db = await getDB();
      const stmt = db.prepare(sql);
      let result;
      if (lower.startsWith('select')) { result = stmt.all.apply(stmt, params || []); }
      else { result = stmt.run.apply(stmt, params || []); }
      res.json({ success: true, result });
    } catch (e) { res.status(400).json({ error: e.message }) }
  });

  app.get('/api/admin/settings', async (req, res) => {
    if (!adminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    const db = await getDB();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json({ settings });
  });

  app.post('/api/admin/settings', async (req, res) => {
    if (!adminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings object required' });
    const db = await getDB();
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))');
    const tx = db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) upsert.run(key, String(value));
    });
    tx();
    res.json({ success: true, applied: Object.keys(settings) });
  });

  /* Static files */
  app.use(express.static(ROOT, { maxAge: 0, etag: false }));
  app.get('*', (req, res) => {
    const fp = path.join(ROOT, req.path === '/' ? 'index.html' : req.path);
    if (fs.existsSync(fp)) {
      const ext = path.extname(fp).toLowerCase();
      const mime = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2' };
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
      res.sendFile(fp);
    } else {
      res.sendFile(path.join(ROOT, 'index.html'));
    }
  });
}

if (!process.env.VERCEL) {
  getDB().then(db => {
    const port = process.env.PORT || 5500;
    app.listen(port, () => console.log('DiaMerna local → http://localhost:' + port + ' | Server: ' + (PERSISTENT_SERVER_URL || 'standalone')));
  }).catch(e => { console.error('DB init failed', e); process.exit(1) });
}

module.exports = app;

/* DiaMerna — Express API for Vercel */
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const uuid = () => crypto.randomUUID();
const createDB = require('../db');

const app = express();
const ROOT = path.join(__dirname, '..', 'dev');
const JWT_SECRET = process.env.JWT_SECRET || 'diamerna_jwt_secret_' + uuid();
const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:5500/api/oauth/callback';

const OAUTH = {};
if (process.env.DROPBOX_CLIENT_ID) {
  OAUTH.dropbox = { client_id: process.env.DROPBOX_CLIENT_ID, client_secret: process.env.DROPBOX_CLIENT_SECRET || '' };
}

/* Rate limiter */
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

/* Lazy DB init — shared singleton */
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
      _db = db;
      return db;
    });
  }
  return _dbPromise;
}

/* Auth helper */
function auth(req) {
  const h = req.headers['authorization'] || '';
  const t = h.replace('Bearer ', '');
  try { return jwt.verify(t, JWT_SECRET) } catch { return null }
}

/* OAuth token exchange */
function oauthExchange(code, clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: OAUTH_REDIRECT_URI, grant_type: 'authorization_code' }).toString();
    const opts = { hostname: 'api.dropboxapi.com', path: '/oauth2/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
    const r = https.request(opts, r2 => { let d = ''; r2.on('data', c => d += c); r2.on('end', () => { try { resolve(JSON.parse(d)) } catch { reject(new Error(d)) } }) });
    r.on('error', reject); r.write(body); r.end();
  });
}

/* Middleware */
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  next();
});

/* ===== API Routes ===== */

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
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
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
  /* Fallback to JWT data if DB was wiped on cold start */
  if (!user) user = { id: u.id, email: u.email, name: u.name };
  const clouds = db.prepare('SELECT provider, connected_at, folder_id FROM cloud_tokens WHERE user_id = ?').all(u.id);
  const envProviders = Object.keys(OAUTH).filter(p => OAUTH[p] && OAUTH[p].client_id);
  res.json({ user, clouds, envProviders });
});

app.post('/api/cloud/connect', async (req, res) => {
  const db = await getDB();
  const u = auth(req);
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  const { provider, access_token, refresh_token } = req.body;
  if (!provider || !access_token) return res.status(400).json({ error: 'provider and access_token required' });
  const existing = db.prepare('SELECT id FROM cloud_tokens WHERE user_id = ? AND provider = ?').get(u.id, provider);
  if (existing) {
    db.prepare('UPDATE cloud_tokens SET access_token = ?, refresh_token = ?, connected_at = datetime("now") WHERE id = ?').run(access_token, refresh_token || '', existing.id);
  } else {
    db.prepare('INSERT INTO cloud_tokens (id, user_id, provider, access_token, refresh_token) VALUES (?, ?, ?, ?, ?)').run(uuid(), u.id, provider, access_token, refresh_token || '');
  }
  res.json({ connected: true, provider });
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
  const authUrl = 'https://www.dropbox.com/oauth2/authorize?' + new URLSearchParams({
    client_id: creds.client_id, redirect_uri: OAUTH_REDIRECT_URI,
    response_type: 'code', token_access_type: 'offline', state
  }).toString();
  res.json({ authUrl, provider });
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
    const existing = db.prepare('SELECT id FROM cloud_tokens WHERE user_id = ? AND provider = ?').get(userId, 'dropbox');
    if (existing) {
      db.prepare('UPDATE cloud_tokens SET access_token = ?, refresh_token = ?, connected_at = datetime("now") WHERE id = ?').run(tokenData.access_token, tokenData.refresh_token || '', existing.id);
    } else {
      db.prepare('INSERT INTO cloud_tokens (id, user_id, provider, access_token, refresh_token) VALUES (?, ?, ?, ?, ?)').run(uuid(), userId, 'dropbox', tokenData.access_token, tokenData.refresh_token || '');
    }
    res.redirect('/?oauth_success=dropbox');
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
  const tok = db.prepare('SELECT * FROM cloud_tokens WHERE user_id = ? AND provider = ?').get(u.id, provider);
  if (!tok) return res.status(400).json({ error: 'Provider not connected' });
  try {
    const fd = await new Promise((resolve, reject) => {
      const opts = {
        hostname: 'content.dropboxapi.com', path: '/2/files/upload', method: 'POST',
        headers: { 'Authorization': 'Bearer ' + tok.access_token, 'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({ path: '/' + fileName, mode: 'add', autorename: true }), 'Content-Length': Buffer.byteLength(content) }
      };
      const r = https.request(opts, r2 => { let d = ''; r2.on('data', c => d += c); r2.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve({}) } }) });
      r.on('error', reject); r.write(content); r.end();
    });
    const publicUrl = 'https://www.dropbox.com/home/' + (fd.path_display || fileName);
    db.prepare('INSERT INTO files (id, user_id, name, provider, cloud_file_id, public_url) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), u.id, fileName, provider, fd.id || uuid(), publicUrl);
    res.json({ uploaded: true, fileName, publicUrl, provider });
  } catch (e) { res.status(500).json({ error: 'Upload failed', detail: e.message }) }
});

app.get('/api/files', async (req, res) => {
  const db = await getDB();
  const u = auth(req);
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  const files = db.prepare('SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(u.id);
  res.json({ files });
});

/* AI Chat proxy */
app.post('/api/chat', (req, res) => {
  const body = JSON.stringify(req.body);
  const opts = {
    hostname: 'openrouter.ai', path: '/api/v1/chat/completions', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': req.headers['authorization'] || 'Bearer ', 'Content-Length': Buffer.byteLength(body) }
  };
  const proxy = https.request(opts, proxyRes => {
    res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
    proxyRes.pipe(res);
  });
  proxy.on('error', () => { res.status(502).json({ error: 'proxy failed' }) });
  proxy.write(body);
  proxy.end();
});

/* ===== Admin Routes ===== */
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

/* Start server for local dev; Vercel uses module.exports */
if (!process.env.VERCEL) {
  getDB().then(db => {
    const port = process.env.PORT || 5500;
    app.listen(port, () => console.log(`DiaMerna running → http://localhost:${port}`));
  }).catch(e => { console.error('DB init failed', e); process.exit(1) });
}

module.exports = app;

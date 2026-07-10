const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const http = require('http')
const https = require('https')
const { URL } = require('url')

/* --- Decrypt bundled secrets --- */
let SECRETS = {}
try {
  const bundle = JSON.parse(fs.readFileSync(path.join(__dirname, 'encrypted-keys.json'), 'utf8'))
  const key = Buffer.from(bundle._key, 'hex')
  for (const [name, data] of Object.entries(bundle.secrets)) {
    if (!data) continue
    const parts = data.split(':')
    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    SECRETS[name] = decrypted
  }
} catch (e) { console.warn('⚠️ No encrypted keys found:', e.message) }

/* --- Configuration --- */
/* The shared backend server URL — all API calls go here.
   Set SERVER_URL env var at build time or default to the public server.
   Web / Desktop / Mobile all connect to this same server. */
const SERVER_URL = process.env.SERVER_URL || SECRETS.SERVER_URL || 'http://127.0.0.1:3030'
const WEBAPP_PATH = process.env.NODE_ENV === 'development'
  ? path.join(__dirname, '..', 'dev')
  : path.join(process.resourcesPath, 'webapp')
const ICON_PATH = path.join(__dirname, 'icon.png')
const LOCAL_PORT = 5199

const MIME = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'application/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.json': 'application/json;charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.txt': 'text/plain;charset=utf-8'
}

let mainWindow, tray, server

/* --- Inject SERVER_URL into config.js so all API calls go to the shared server --- */
function injectServerUrl(content) {
  return content.replace(/Cfg\.URL\s*=\s*'.*?'/, "Cfg.URL = '" + SERVER_URL.replace(/\/+$/, '') + "'")
    .replace(/var API_URL\s*=.*/, "var API_URL = Cfg.URL;")
}

/* --- Static file server (local, for fast UI) --- */
function serveFile(req, res) {
  let urlPath = new URL(req.url, 'http://localhost').pathname
  if (urlPath === '/') urlPath = '/index.html'
  const filePath = path.join(WEBAPP_PATH, urlPath)
  const ext = path.extname(filePath).toLowerCase()

  /* Inject server URL into config.js at runtime */
  if (urlPath === '/js/config.js') {
    const cfgPath = path.join(WEBAPP_PATH, 'js', 'config.js')
    if (fs.existsSync(cfgPath)) {
      res.writeHead(200, { 'Content-Type': 'application/javascript' })
      return res.end(injectServerUrl(fs.readFileSync(cfgPath, 'utf8')))
    }
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not Found') }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
    res.end(data)
  })
}

/* --- Proxy API requests to the shared backend server --- */
function proxyToServer(req, res) {
  const targetUrl = SERVER_URL.replace(/\/+$/, '') + req.url
  const parsed = new URL(targetUrl)
  const isHttps = parsed.protocol === 'https:'
  const mod = isHttps ? https : http

  let body = null
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    body = []
    req.on('data', c => body.push(c))
    req.on('end', () => {
      body = Buffer.concat(body)
      doProxy()
    })
  } else {
    doProxy()
  }

  function doProxy() {
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: req.method,
      headers: { ...req.headers, host: parsed.hostname },
      timeout: 30000
    }
    if (body && body.length > 0) opts.headers['Content-Length'] = Buffer.byteLength(body)
    else if (opts.headers['content-length']) delete opts.headers['content-length']

    const r = mod.request(opts, r2 => {
      res.writeHead(r2.statusCode, r2.headers)
      r2.pipe(res)
    })
    r.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Server unreachable. Is the backend running at ' + SERVER_URL + '?' }))
    })
    if (body && body.length > 0) r.write(body)
    r.end()
  }
}

function startServer() {
  return new Promise(resolve => {
    server = http.createServer((req, res) => {
      /* API requests go to the shared backend server */
      if (req.url.startsWith('/api/')) return proxyToServer(req, res)
      serveFile(req, res)
    })
    server.listen(LOCAL_PORT, '127.0.0.1', () => {
      console.log('🌐 Local UI: http://127.0.0.1:' + LOCAL_PORT)
      console.log('🔗 Backend: ' + SERVER_URL)
      resolve()
    })
  })
}

/* --- Reminders --- */
const reminders = [
  { time: '09:00', text: '🌅 Morning glucose check — log your fasting sugar' },
  { time: '10:00', text: '💊 Take your prenatal vitamins' },
  { time: '12:00', text: '🥗 Lunch time — log your meal & glucose' },
  { time: '14:00', text: '🚶‍♀️ Time for a short walk — 20 minutes' },
  { time: '18:00', text: '💧 Hydration check — have a glass of water' },
  { time: '20:00', text: '🌙 Evening glucose check — log before bed' }
]

function checkReminders() {
  const now = new Date()
  const hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
  for (const r of reminders) {
    if (hm === r.time && Notification.isSupported()) {
      new Notification({ title: '⏰ DiaMerna Reminder', body: r.text, icon: ICON_PATH }).show()
    }
  }
}

/* --- Notifications from renderer --- */
ipcMain.on('notify', (e, { title, body }) => {
  if (Notification.isSupported()) {
    const n = new Notification({ title: title || 'DiaMerna', body: body || '', icon: ICON_PATH })
    n.show()
    n.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
  }
})

/* --- Window --- */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 400, minHeight: 600,
    icon: ICON_PATH,
    title: 'DiaMerna — Maternal Wellness',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true },
    show: false,
    backgroundColor: '#0a0a1a'
  })
  mainWindow.loadURL('http://127.0.0.1:' + LOCAL_PORT)
  mainWindow.once('ready-to-show', () => { mainWindow.show() })
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); mainWindow.hide() }
  })
}

/* --- Tray --- */
function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('DiaMerna — Maternal Wellness')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '🪟 Show App', click: () => { mainWindow.show(); mainWindow.focus() } },
    { type: 'separator' },
    { label: '❌ Quit', click: () => { app.isQuitting = true; app.quit() } }
  ]))
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus() })
}

/* --- App Lifecycle --- */
app.whenReady().then(async () => {
  await startServer()
  createWindow()
  createTray()
  setInterval(checkReminders, 30000)
})

app.on('window-all-closed', () => {})
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

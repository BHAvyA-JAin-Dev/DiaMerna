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

/* --- Paths --- */
const WEBAPP_PATH = process.env.NODE_ENV === 'development'
  ? path.join(__dirname, '..', 'dev')
  : path.join(process.resourcesPath, 'webapp')
const ICON_PATH = path.join(__dirname, 'icon.png')
const PORT = 5199
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

/* --- Static file server with injected config --- */
function serveFile(req, res) {
  let urlPath = new URL(req.url, 'http://localhost').pathname
  if (urlPath === '/') urlPath = '/index.html'
  const filePath = path.join(WEBAPP_PATH, urlPath)
  const ext = path.extname(filePath).toLowerCase()

  /* Inject API key into config.js at runtime */
  if (urlPath === '/js/config.js' && SECRETS.OPENROUTER_API_KEY) {
    const cfgPath = path.join(WEBAPP_PATH, 'js', 'config.js')
    if (fs.existsSync(cfgPath)) {
      let content = fs.readFileSync(cfgPath, 'utf8')
      content = content.replace(/API_KEY\s*=\s*'.*?'/, `API_KEY = '${SECRETS.OPENROUTER_API_KEY}'`)
      res.writeHead(200, { 'Content-Type': 'application/javascript' })
      return res.end(content)
    }
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      return res.end('Not Found')
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
    res.end(data)
  })
}

/* --- API proxy for chat --- */
function proxyChat(req, res) {
  const apiKey = SECRETS.OPENROUTER_API_KEY
  if (!apiKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'API key not configured in this build' }))
  }
  let body = ''
  req.on('data', c => body += c)
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body)
      const postData = JSON.stringify({
        model: parsed.model || 'nvidia/nemotron-3-super-120b-a12b:free',
        messages: parsed.messages || [],
        max_tokens: parsed.max_tokens || 512
      })
      const opts = {
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 30000
      }
      const r = https.request(opts, r2 => {
        let d = ''
        r2.on('data', c => d += c)
        r2.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(d)
        })
      })
      r.on('error', () => {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Upstream error' }))
      })
      r.write(postData)
      r.end()
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Bad request' }))
    }
  })
}

function startServer() {
  return new Promise(resolve => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/api/chat') return proxyChat(req, res)
      /* Health check for reminders */
      if (req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }))
      }
      serveFile(req, res)
    })
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`🌐 Server at http://127.0.0.1:${PORT}`)
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
  mainWindow.loadURL('http://127.0.0.1:' + PORT)
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

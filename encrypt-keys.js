/* DiaMerna API Key Encryption Tool
   Run: node encrypt-keys.js
   This encrypts API keys for the desktop/mobile builds.
   The encrypted keys are bundled into the EXE/APK and decrypted at runtime.
   The source code repo will NOT contain real keys. */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

/* === CONFIGURATION ===
   Set your real API keys here BEFORE building the desktop/mobile apps.
   These will be encrypted — the source code on GitHub never contains raw keys. */
const SECRETS = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || 'YOUR_OPENROUTER_API_KEY_HERE',
  DROPBOX_CLIENT_ID: process.env.DROPBOX_CLIENT_ID || '',
  DROPBOX_CLIENT_SECRET: process.env.DROPBOX_CLIENT_SECRET || '',
  JWT_SECRET: process.env.JWT_SECRET || 'auto-generated-at-runtime',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || '',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || ''
}

/* Generate a random encryption key (256-bit) */
const ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
const IV_LENGTH = 16

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return iv.toString('hex') + ':' + authTag + ':' + encrypted
}

/* Encrypt all secrets */
const encrypted = {}
for (const [key, value] of Object.entries(SECRETS)) {
  encrypted[key] = value && value.length > 0 && !value.startsWith('YOUR_') ? encrypt(value) : ''
}

const output = {
  _key: ENCRYPTION_KEY,
  _note: 'Decrypt at runtime using crypto.createDecipheriv(\'aes-256-gcm\', Buffer.from(_key, \'hex\'), iv)',
  secrets: encrypted
}

const outPath = path.join(__dirname, 'desktop', 'encrypted-keys.json')
fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
console.log('✅ Encrypted keys written to', outPath)
console.log('ℹ️  Keep ENCRYPTION_KEY secure — it\'s needed at runtime.')
console.log('ℹ️  The encrypted-keys.json is .gitignore\'d — never commit raw keys.')

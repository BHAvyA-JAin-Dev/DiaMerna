/* DiaMerna — GitHub Release Creator
   Usage: GITHUB_TOKEN=ghp_xxx node create-release.js [--draft]

   Requirements:
   - git tag v1.0.0 must exist
   - Assets must be built first (run node build-all.js --desktop --mobile)
   - GITHUB_TOKEN env var with repo scope */

const https = require('https')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const VER = '1.0.0'
const REPO = 'threegamerboiz/diamerna'
const TOKEN = process.env.GITHUB_TOKEN
const DRAFT = process.argv.includes('--draft')
const RELEASE_DIR = path.join(__dirname, '..', 'dist-release')

if (!TOKEN) { console.error('❌ GITHUB_TOKEN env var required'); process.exit(1) }

async function gh(method, url, body, binaryFile) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com', path: '/repos/' + REPO + url,
      method, headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'User-Agent': 'diamerna-release-script',
        'Accept': 'application/vnd.github.v3+json'
      }
    }
    if (body && !binaryFile) opts.headers['Content-Type'] = 'application/json'
    const r = https.request(opts, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }) }
        catch { resolve({ status: res.statusCode, data: d }) }
      })
    })
    r.on('error', reject)
    if (binaryFile) {
      const stream = fs.createReadStream(binaryFile)
      stream.pipe(r)
      stream.on('close', () => r.end())
    } else if (body) {
      r.write(typeof body === 'string' ? body : JSON.stringify(body))
      r.end()
    } else { r.end() }
  })
}

async function main() {
  /* Check tag exists */
  try { execSync('git tag -l v' + VER + ' | findstr /C:"v' + VER + '"', { shell: true, stdio: 'pipe' }) }
  catch { console.error('❌ Tag v' + VER + ' not found. Create it first: git tag v' + VER + ' && git push origin v' + VER); process.exit(1) }

  const releaseNotes = `# DiaMerna v${VER} — Maternal Wellness App

## What's New
- Multi‑page split (dashboard, glucose, baby, health, chat, more, admin)
- AI chat powered by OpenRouter (free models)
- Glucose tracking with trend charts
- Baby growth tracking with percentiles
- Weight tracker, blood pressure monitor
- Contraction timer, hospital bag checklist
- Cloud file browser (Dropbox)
- Dropbox OAuth with full redirect flow
- Confirm password on registration
- Secret admin panel (tap logo 7×)
- Responsive design (mobile → 4K, persistent sidebar)
- Desktop app (Electron EXE) with:
  · System tray with reminders
  · Desktop notifications
  · Encrypted API keys (AES‑256‑GCM)
  · Offline support
- Mobile APK (Android) with:
  · Push and local notifications
  · Encrypted runtime config
- PWA with service worker (offline + notifications)

## Downloads
| Platform | File | Description |
|---|---|---|
| Windows | DiaMerna-Setup-${VER}.exe | Desktop installer (64‑bit) |
| Android | DiaMerna-${VER}.apk | Mobile app |
| Source | diamerna-source-v${VER}.zip | Full source (no API keys) |

## 🔐 Security
API keys are **never** in the source code. The desktop and mobile builds use AES‑256‑GCM encryption bundled at build time. Keys are decrypted in‑memory at runtime.

## Development
Set \`OPENROUTER_API_KEY\`, \`DROPBOX_CLIENT_ID\`, \`DROPBOX_CLIENT_SECRET\`, \`ADMIN_EMAIL\`, \`ADMIN_PASSWORD\` environment variables, then run:
\`\`\`
node encrypt-keys.js   # encrypts keys into desktop/encrypted-keys.json
cd desktop && npm run build:win   # builds EXE
\`\`\`
For mobile: install Android SDK, then \`cd mobile && npm run build:apk\`
`

  /* Create release */
  console.log('📦 Creating GitHub release v' + VER)
  const release = await gh('POST', '/releases', {
    tag_name: 'v' + VER,
    target_commitish: 'main',
    name: 'DiaMerna v' + VER,
    body: releaseNotes,
    draft: DRAFT,
    prerelease: false,
    generate_release_notes: false
  })
  if (release.status !== 201) { console.error('❌ Release create failed:', JSON.stringify(release.data)); process.exit(1) }
  console.log('✅ Release created: ' + release.data.html_url)

  /* Upload assets */
  const uploadUrl = 'https://uploads.github.com/repos/' + REPO + '/releases/' + release.data.id + '/assets'
  const assets = fs.readdirSync(RELEASE_DIR).filter(f => !fs.statSync(path.join(RELEASE_DIR, f)).isDirectory())
  for (const file of assets) {
    const filePath = path.join(RELEASE_DIR, file)
    console.log('  Uploading ' + file + '...')
    const result = await gh('POST', '/releases/' + release.data.id + '/assets?name=' + encodeURIComponent(file), null, filePath)
    if (result.status === 201) console.log('    ✅ ' + file)
    else {
      // Try alternative upload endpoint
      const result2 = await gh('POST', 'https://uploads.github.com/repos/' + REPO + '/releases/' + release.data.id + '/assets?name=' + encodeURIComponent(file), null, filePath)
      if (result2.status === 201) console.log('    ✅ ' + file)
      else console.error('    ❌ ' + file + ' failed: ' + (result2.data?.message || result2.status))
    }
  }

  console.log('\n🎉 Release complete!')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })

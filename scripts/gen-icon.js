/* Generate icon.png for Electron from the logo.jpeg
   Usage: node gen-icon.js
   Requires: sharp npm package */
const sharp = require('sharp')
const path = require('path')

const src = path.join(__dirname, '..', 'dev', 'logo.jpeg')
const dst = path.join(__dirname, '..', 'desktop', 'icon.png')

async function main() {
  await sharp(src).resize(512, 512).png().toFile(dst)
  console.log('✅ Icon generated at', dst)
}
main().catch(e => { console.error('Icon generation failed:', e.message) })

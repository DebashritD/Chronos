// Renders the PNG app icons in public/ from icons/icon.svg. Run: node scripts/render-icons.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const svg = readFileSync(new URL('../icons/icon.svg', import.meta.url))
const src = `data:image/svg+xml;base64,${svg.toString('base64')}`
// [file, size, share of the canvas the artwork fills]; maskable keeps it inside the 80% safe zone.
const jobs = [['apple-touch-icon.png', 180, 1], ['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['icon-maskable-512.png', 512, 0.8]]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size, share] of jobs) {
  const inner = Math.round(size * share)
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:#f7f3ea">
    <img src="${src}" width="${inner}" height="${inner}"></body>`)
  await page.locator('img').evaluate((img) => img.decode())
  await page.screenshot({ path: fileURLToPath(new URL(`../public/${file}`, import.meta.url)) })
}
await browser.close()

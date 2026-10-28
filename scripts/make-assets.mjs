// Generates derived assets: resized headshots, apple-touch-icon, and the 1200x630 Open Graph image.
// Run with: npm run assets
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

const pub = path.resolve('public');
const headshot = path.join(pub, 'images', 'darryn-cooke-neon-headshot.jpg');

for (const w of [600, 900]) {
  await sharp(headshot)
    .resize(w, w)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(pub, 'images', `darryn-cooke-neon-headshot-${w}.jpg`));
}

await sharp(path.join(pub, 'favicon.svg'), { density: 600 })
  .resize(180, 180)
  .flatten({ background: '#0a0618' })
  .png()
  .toFile(path.join(pub, 'apple-touch-icon.png'));

// OG image: render an HTML scene in headless Chrome.
const b64 = fs.readFileSync(path.join(pub, 'images', 'darryn-cooke-neon-headshot-900.jpg')).toString('base64');
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const stars = Array.from({ length: 70 }, () => {
  const r = rand() > 0.8 ? 1 : 0.6;
  return `<circle cx="${(rand() * 1200).toFixed(0)}" cy="${(rand() * 400).toFixed(0)}" r="${r}" fill="#fff" opacity="${(0.3 + rand() * 0.7).toFixed(2)}"/>`;
}).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Audiowide&family=Orbitron:wght@700&display=swap');
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;position:relative;background:linear-gradient(180deg,#0a0618 0%,#2a0b4a 60%,#78146e 100%)}
svg.stars{position:absolute;inset:0}
.floor{position:absolute;left:0;right:0;bottom:0;height:200px;background:#0c041e;border-top:3px solid #00e5ff;box-shadow:0 -2px 16px #00e5ff;overflow:hidden;perspective:300px;perspective-origin:50% 0}
.plane{position:absolute;left:-150%;width:400%;top:calc(140px - 700px);height:980px;transform-origin:50% 700px;transform:rotateX(65deg);
background-image:repeating-linear-gradient(90deg,rgba(255,46,136,.9) 0 2px,transparent 2px 90px)}
.plane i{position:absolute;inset:-100px 0 0 0;background-image:repeating-linear-gradient(180deg,rgba(0,229,255,.85) 0 2px,transparent 2px 70px)}
.floor::after{content:'';position:absolute;inset:0 0 auto 0;height:40%;background:linear-gradient(#0c041e,rgba(12,4,30,0))}
.txt{position:absolute;left:64px;top:120px;width:620px}
h1{white-space:nowrap;font:400 78px/1 Audiowide;color:#fff;text-shadow:-4px 0 #ff2e88,4px 0 #00e5ff,0 0 30px rgba(255,46,136,.35)}
p{margin-top:28px;font:700 31px/1.35 Orbitron;color:#fff}
.ring{position:absolute;right:80px;top:90px;width:420px;height:420px;padding:8px;border-radius:50%;background:linear-gradient(90deg,#ff2e88 10%,#00e5ff 90%);box-shadow:-16px 0 56px -6px rgba(255,46,136,.8),16px 0 56px -6px rgba(0,229,255,.8)}
.ring img{width:100%;height:100%;border-radius:50%;object-fit:cover}
</style></head><body>
<svg class="stars" width="1200" height="630">${stars}</svg>
<div class="floor"><div class="plane"><i></i></div></div>
<div class="txt"><h1>Darryn Cooke</h1><p>Technical Program Manager who builds AI people can trust.</p></div>
<div class="ring"><img src="data:image/jpeg;base64,${b64}"></div>
</body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(pub, 'og.png') });
await browser.close();
console.log('assets done');

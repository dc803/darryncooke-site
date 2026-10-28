import { chromium } from 'playwright-core';
const out = process.argv[2];
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const count = (p) => p.locator('.bl-count').innerText();
const n = async (p) => parseInt((await count(p)).match(/(\d+)\//)[1]);

async function run(name, ctxOpts, touch) {
  const ctx = await b.newContext(ctxOpts);
  const p = await ctx.newPage();
  const reqs = [];
  p.on('request', (r) => reqs.push(r.url()));
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:4321/');
  await p.waitForTimeout(1500);
  console.log(name, 'game chunk loaded on page load:', reqs.some((u) => u.includes('skill-blaster')));
  await p.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });

  await p.locator('#play-blaster').scrollIntoViewIfNeeded();
  await p.locator('#play-blaster').click();
  await p.waitForSelector('.bl-start.on');
  console.log(name, 'game chunk loaded after click:', reqs.some((u) => u.includes('skill-blaster')));
  await p.screenshot({ path: `${out}/${name}-modal-start.png` });
  await p.locator('[data-a=start]').click();

  const hold = async (k, v) => {
    if (!touch) return v ? p.keyboard.down(k) : p.keyboard.up(k);
    const map = { ' ': 'fire', d: 'right', ArrowUp: 'thrust' };
    return p.locator(`[data-k=${map[k]}]`).dispatchEvent(v ? 'pointerdown' : 'pointerup', { pointerId: 1 });
  };
  await hold(' ', true);
  await hold('d', true);
  let shot = false;
  const t0 = Date.now();
  let i = 0;
  while ((await n(p)) < 12 && Date.now() - t0 < 240000) {
    if (i++ % 6 === 0) { await hold('ArrowUp', true); await p.waitForTimeout(350); await hold('ArrowUp', false); }
    await p.waitForTimeout(500);
    if (!shot && (await n(p)) >= 3) {
      await p.screenshot({ path: `${out}/${name}-modal-play.png` });
      shot = true;
    }
  }
  await hold(' ', false); await hold('d', false);
  console.log(name, 'unlocked', await count(p), 'in', Math.round((Date.now() - t0) / 1000), 's');
  await p.waitForSelector('.bl-end.on', { timeout: 10000 });
  await p.screenshot({ path: `${out}/${name}-modal-end.png` });
  await p.locator('[data-a=close]').click();
  console.log(name, 'dialog open after close:', await p.evaluate(() => document.getElementById('blaster').open),
    'focus on play btn:', await p.evaluate(() => document.activeElement.id));
  console.log(name, 'errors:', errs);
  await ctx.close();
}

await run('desktop', { viewport: { width: 1440, height: 900 } }, false);
await run('phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, true);
await b.close();

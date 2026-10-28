import { chromium } from 'playwright-core';
const [base, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const [name, opts] of [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }],
]) {
  const p = await (await b.newContext(opts)).newPage();
  await p.goto(base);
  await p.waitForLoadState('networkidle');
  console.log(name, 'figures:', await p.locator('.gallery figure').count(), 'captions:', await p.locator('.gallery figcaption').count());
  const broken = await p.evaluate(() => [...document.querySelectorAll('.gallery img')].filter((i) => !i.complete || !i.naturalWidth).length);
  // Lazy images: scroll through so they load before checking.
  for (const id of ['rf', 'je']) {
    await p.locator(`#${id}`).scrollIntoViewIfNeeded();
    const card = p.locator(`article:has(#${id})`);
    await card.scrollIntoViewIfNeeded();
    await p.waitForTimeout(800);
    await p.evaluate(async () => { for (const i of document.querySelectorAll('.gallery img')) { i.loading = 'eager'; await i.decode().catch(() => {}); } });
    await card.screenshot({ path: `${out}/${name}-case-${id === 'rf' ? 'reportforge' : 'job-evaluator'}.png` });
  }
  console.log(name, 'broken images:', await p.evaluate(() => [...document.querySelectorAll('.gallery img')].filter((i) => !i.naturalWidth).length), '(pre-scroll', broken + ')');
  // Lightbox: open, Esc closes; open, click closes.
  const shot = p.locator('.shot').first();
  await shot.scrollIntoViewIfNeeded();
  await shot.click();
  await p.waitForTimeout(400);
  console.log(name, 'lightbox open:', await p.evaluate(() => document.getElementById('lightbox').open));
  await p.screenshot({ path: `${out}/${name}-lightbox.png` });
  await p.keyboard.press('Escape');
  console.log(name, 'closed by Esc:', await p.evaluate(() => !document.getElementById('lightbox').open));
  await shot.click();
  await p.mouse.click(20, 20);
  console.log(name, 'closed by click:', await p.evaluate(() => !document.getElementById('lightbox').open));
  await p.close();
}
await b.close();

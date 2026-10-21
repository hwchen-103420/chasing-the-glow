// Browser smoke test: serves the site, stubs network, checks the main interactions.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const PORT = 8765;
const ROOT = new URL('../../', import.meta.url).pathname;
const API = 'https://gas.test/exec';
const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

const api = JSON.parse(readFileSync(`${ROOT}test/fixtures/api-2026-10-20.json`));
api.date = today;
for (const r of Object.values(api.regions)) r.date = today;

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));

const exe = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

async function openPage(apiHandler, viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/unpkg.com/leaflet@1.9.4/dist/**', route => {
    const file = route.request().url().split('/dist/')[1];
    route.fulfill({ path: `${ROOT}node_modules/leaflet/dist/${file}` });
  });
  await page.route('**/basemaps.cartocdn.com/**', route => route.fulfill({ status: 204 }));
  await page.route('**/youtube.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '' }));
  await page.route(`${API}**`, apiHandler);
  await page.goto(`http://localhost:${PORT}/?api=${encodeURIComponent(API)}`);
  await page.waitForSelector('body[data-ready="true"]', { timeout: 10000 });
  return { page, errors };
}

try {
  const { page, errors } = await openPage(route => route.fulfill({ json: api }));
  assert.equal(await page.locator('.pin').count(), 9);
  assert.equal(await page.locator('#regions > .region-card').count(), 3);
  assert.equal(await page.locator('#regions .quality').nth(1).innerText(), '36');
  assert.equal(await page.locator('h1.logo img').getAttribute('alt'), '觀夕平台');
  assert.ok(await page.locator('h1.logo img').evaluate(i => i.complete && i.naturalWidth > 0));
  assert.ok(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "GuanXi Round"', '觀夕'); }));
  assert.equal(await page.locator('#today .today-sunset b').innerText(), '17:23');
  assert.match(await page.locator('#today .today-time').innerText(), /^\d{2}:\d{2}$/);
  assert.match(await page.locator('#today .today-date').innerText(), /^\d{1,2}月\d{1,2}日（[日一二三四五六]）$/);
  const region = await page.locator('#regions > .region-card').nth(1).innerText();
  assert.ok(region.includes('降雨 0%') && !region.includes('降雨 降雨'), region);
  assert.ok(region.includes('17:11–17:52') && !region.includes('最佳時段 最佳時段'), region);
  assert.ok((await page.locator('#updated .updated-time').innerText()).startsWith('分數更新於'));
  assert.equal(await page.locator('#updated .updated-src').count(), 1);
  assert.equal(await page.locator('path.sun-ray').count(), 9);
  assert.equal(await page.locator('path.sun-fan').count(), 9);
  assert.ok((await page.locator('path.land').count()) >= 4);
  assert.ok((await page.locator('path.river-line').count()) >= 4);
  assert.equal(await page.locator('.leaflet-tile').count(), 0);
  assert.ok(!(await page.locator('#map').evaluate(e => e.classList.contains('leaflet-grab'))));
  assert.equal(await page.locator('.leaflet-control-zoom').count(), 0);
  assert.deepEqual(await page.locator('#favorites > [data-id]').evaluateAll(els => els.map(e => e.dataset.id)),
    ['dadaocheng-wharf', 'tamsui-golden-waterfront', 'datunshan-lookout']);

  await page.hover('.pin[data-id="fishermans-wharf"]');
  const tip = await page.locator('.leaflet-tooltip .tip').innerText();
  assert.ok(tip.includes('Fair') && tip.includes('看得到落日到海平面'), tip);

  await page.click('#favorites > [data-id="dadaocheng-wharf"]');
  assert.equal(await page.locator('#detail iframe').count(), 1);
  assert.ok((await page.locator('#detail iframe').getAttribute('src')).includes('Ndo_8RuefH4'));
  await page.click('#favorites > [data-id="datunshan-lookout"]');
  assert.equal(await page.locator('#detail iframe').count(), 1);
  assert.ok((await page.locator('#detail iframe').getAttribute('src')).includes('d9KuXrPCWYU'));
  assert.ok(await page.locator('.pin[data-id="datunshan-lookout"]').evaluate(e => e.classList.contains('is-selected')));

  // Rating: pick 7, 'cam', add a note, submit; the POST body carries the snapshot.
  let posted = null;
  await page.route(`${API}**`, route => {
    if (route.request().method() === 'POST') { posted = JSON.parse(route.request().postData()); return route.fulfill({ json: { ok: true } }); }
    return route.fulfill({ json: api });
  });
  assert.equal(await page.locator('#detail .rating-scale button').count(), 10);
  assert.ok(await page.locator('#detail .rating-submit').isDisabled());
  await page.click('#detail .rating-scale button[data-value="7"]');
  await page.check('#detail input[name="rating-mode"][value="cam"]');
  await page.fill('#detail .rating-note', '雲縫透光');
  await page.click('#detail .rating-submit');
  await page.waitForFunction(() => document.querySelector('#detail .rating-status')?.textContent.includes('已記錄'));
  assert.equal(posted.spot_id, 'datunshan-lookout');
  assert.equal(posted.rating, 7);
  assert.equal(posted.mode, 'cam');
  assert.equal(posted.note, '雲縫透光');
  assert.equal(posted.shown.tier, 'fair');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${ROOT}.superpowers/sdd/smoke.png` });

  assert.equal(await page.locator('.brand .tagline img').getAttribute('alt'), 'CHASING THE GLOW');
  assert.ok(await page.locator('.brand .tagline img').evaluate(i => i.complete && i.naturalWidth > 0));

  // Narrow window: long favourite names wrap; cards must still fit inside their own box.
  const narrow = await openPage(route => route.fulfill({ json: api }), { width: 1200, height: 760 });
  const overflow = await narrow.page.locator('#favorites > .fav-card').evaluateAll(cards => cards.map(c => {
    const inner = c.querySelector('.fav-inner').getBoundingClientRect();
    return Math.round(inner.bottom - c.getBoundingClientRect().bottom);
  }));
  assert.ok(overflow.every(d => d <= 1), `fav-inner overflows its card by ${overflow}px`);

  const failed = await openPage(route => route.fulfill({ status: 500, body: 'error' }));
  assert.ok((await failed.page.locator('#banner .banner-text').innerText()).includes('無法取得資料'));
  assert.ok(await failed.page.locator('#banner').evaluate(e => e.classList.contains('banner--error') && !e.hidden));
  assert.equal(await failed.page.locator('#banner svg').count(), 1);
  assert.equal(await failed.page.locator('path.sun-fan.is-muted').count(), 9);
  assert.equal(await failed.page.locator('.pin').count(), 9);

  console.log('smoke OK');
} finally {
  await browser.close();
  server.kill();
}

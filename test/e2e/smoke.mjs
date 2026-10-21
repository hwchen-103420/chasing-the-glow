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

async function openPage(apiHandler) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
  assert.equal(await page.locator('#regions .card').count(), 3);
  assert.deepEqual(await page.locator('#favorites .card').evaluateAll(els => els.map(e => e.dataset.id)),
    ['dadaocheng-wharf', 'tamsui-golden-waterfront', 'datunshan-lookout']);

  await page.hover('.pin[data-id="fishermans-wharf"]');
  const tip = await page.locator('#tooltip').innerText();
  assert.ok(tip.includes('Fair') && tip.includes('看得到落日到海平面'), tip);

  await page.click('#favorites .card[data-id="dadaocheng-wharf"]');
  assert.equal(await page.locator('#detail iframe').count(), 1);
  assert.ok((await page.locator('#detail iframe').getAttribute('src')).includes('Ndo_8RuefH4'));
  await page.click('#favorites .card[data-id="datunshan-lookout"]');
  assert.equal(await page.locator('#detail iframe').count(), 1);
  assert.ok((await page.locator('#detail iframe').getAttribute('src')).includes('d9KuXrPCWYU'));
  assert.ok(await page.locator('.pin[data-id="datunshan-lookout"]').evaluate(e => e.classList.contains('is-selected')));
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${ROOT}.superpowers/smoke.png` });

  const failed = await openPage(route => route.fulfill({ status: 500, body: 'error' }));
  assert.ok((await failed.page.locator('#banner').innerText()).includes('無法取得資料'));
  assert.equal(await failed.page.locator('.pin').count(), 9);

  console.log('smoke OK');
} finally {
  await browser.close();
  server.kill();
}

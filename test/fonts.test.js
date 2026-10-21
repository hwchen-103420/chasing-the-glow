import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const covered = () => new Set(readFileSync(new URL('assets/fonts/guanxi-round.chars.txt', root), 'utf8'));

test('site font subset exists with its OFL licence', () => {
  assert.ok(existsSync(new URL('assets/fonts/guanxi-round.woff2', root)));
  assert.match(readFileSync(new URL('assets/fonts/OFL.txt', root), 'utf8'), /SIL OPEN FONT LICENSE/);
});

test('font subset covers every spot, cam and region name', () => {
  const data = JSON.parse(readFileSync(new URL('data/spots.json', root)));
  const text = [...data.spots.map(s => s.name), ...data.cams.map(c => c.name), ...data.regions.map(r => r.name)].join('');
  const set = covered();
  const missing = [...new Set(text)].filter(ch => ch.trim() && !set.has(ch));
  assert.deepEqual(missing, [], 'run: npm run fonts');
});

test('font subset covers common CWA weather wording', () => {
  const set = covered();
  const missing = [...new Set('晴多雲陰時短暫陣雨雷午後有霧局部大豪')].filter(ch => !set.has(ch));
  assert.deepEqual(missing, []);
});

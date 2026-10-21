import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildViewModel } from '../src/logic/model.js';

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const spots = () => read('../data/spots.json');
const api = () => read('./fixtures/api-2026-10-20.json');
const now = new Date('2026-10-20T07:00:00Z');
const byId = (vm, id) => vm.spots.find(s => s.id === id);

test('builds spot view models from the fixture', () => {
  const vm = buildViewModel(spots(), api(), now);
  assert.equal(vm.spots.length, 9);
  assert.equal(byId(vm, 'fishermans-wharf').tier, 'fair');
  assert.equal(byId(vm, 'fishermans-wharf').status, 'sea');
  assert.equal(byId(vm, 'dadaocheng-wharf').status, 'blocked');
  assert.deepEqual(byId(vm, 'dadaocheng-wharf').window, { start: '17:11', end: '17:52' });
  assert.equal(byId(vm, 'dadaocheng-wharf').sunAz, 259.3);
  assert.equal(byId(vm, 'dadaocheng-wharf').cams[0].id, 'cam-dadaocheng');
  assert.equal(vm.updatedAt, '15:00');
  assert.deepEqual(vm.banners, []);
  assert.equal(vm.regions.length, 3);
  assert.equal(vm.regions[1].name, '台北盆地');
  assert.equal(vm.regions[1].tier, 'fair');
});

test('favorites follow the configured order', () => {
  const vm = buildViewModel(spots(), api(), now);
  assert.deepEqual(vm.favorites.map(s => s.id), ['dadaocheng-wharf', 'tamsui-golden-waterfront', 'datunshan-lookout']);
  assert.equal(byId(vm, 'datunshan-lookout').favorite, true);
  assert.equal(byId(vm, 'xiangshan').favorite, false);
});

test('unknown favorite ids are skipped with a warning', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const d = spots();
  d.favorites.push('nope');
  const vm = buildViewModel(d, api(), now);
  assert.equal(vm.favorites.length, 3);
  assert.equal(warn.mock.callCount(), 1);
});

test('rain probability of 50 vetoes only spots in that town', () => {
  const a = api();
  a.towns['臺北市/大同區'].pop = 50;
  const vm = buildViewModel(spots(), a, now);
  assert.equal(byId(vm, 'dadaocheng-wharf').vetoed, true);
  assert.equal(byId(vm, 'datunshan-lookout').vetoed, false);
});

test('missing API shows a banner and no data', () => {
  const vm = buildViewModel(spots(), null, now);
  assert.ok(vm.banners.includes('無法取得資料'));
  assert.ok(vm.spots.every(s => s.tier === 'nodata' && s.vetoed === false));
  assert.ok(vm.regions.every(r => r.tier === 'nodata'));
});

test('data from another day shows a banner and is not trusted', () => {
  const a = api();
  a.date = '2026-10-19';
  for (const r of Object.values(a.regions)) r.date = '2026-10-19';
  a.towns['臺北市/大同區'].pop = 90;
  const vm = buildViewModel(spots(), a, now);
  assert.ok(vm.banners.includes('資料不是今天的'));
  assert.ok(vm.spots.every(s => s.tier === 'nodata' && s.vetoed === false));
});

test('a missing grid only affects its own spots', () => {
  const a = api();
  delete a.regions['25,121'];
  const vm = buildViewModel(spots(), a, now);
  assert.equal(byId(vm, 'xucuogang-lookout').tier, 'nodata');
  assert.equal(byId(vm, 'xucuogang-lookout').status, null);
  assert.equal(byId(vm, 'fishermans-wharf').tier, 'fair');
});

test('a grid with yesterday\'s data counts as missing', () => {
  const a = api();
  a.regions['25,121'].date = '2026-10-19';
  const vm = buildViewModel(spots(), a, now);
  assert.equal(byId(vm, 'xucuogang-lookout').tier, 'nodata');
  assert.equal(byId(vm, 'fishermans-wharf').tier, 'fair');
});

test('missing town weather is flagged and does not veto', () => {
  const a = api();
  delete a.towns['桃園市/大園區'];
  const vm = buildViewModel(spots(), a, now);
  const s = byId(vm, 'xucuogang-lookout');
  assert.equal(s.weather, null);
  assert.equal(s.vetoed, false);
  assert.ok(s.flags.includes('降雨資料暫缺'));
});

test('clear sky and summit flags reach the right spots', () => {
  const vm = buildViewModel(spots(), api(), now);
  assert.ok(byId(vm, 'fishermans-wharf').flags.includes('晴空無雲，天空顏色會比較單調'));
  assert.ok(byId(vm, 'datunshan-lookout').flags.includes('山頂視野可能受雲層干擾'));   // RCSS TAF FEW015
  assert.ok(!byId(vm, 'xiangshan').flags.includes('山頂視野可能受雲層干擾'));
});

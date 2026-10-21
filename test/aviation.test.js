import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeMetar, isMetarFresh, parseTaf, groupsOverlapping } from '../src/logic/aviation.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/metar-2026-10-20T0300Z.json', import.meta.url)));
const [rcss, rctp] = fixture;
const now = new Date('2026-10-20T03:10:00Z');
const iso = d => d.toISOString();

test('normalizeMetar converts the aviationweather JSON', () => {
  const m = normalizeMetar(rcss);
  assert.equal(m.station, 'RCSS');
  assert.equal(m.visibKm, 10);
  assert.deepEqual(m.clouds, [{ cover: 'FEW', baseFt: 2000 }, { cover: 'SCT', baseFt: 3500 }]);
  assert.equal(iso(m.obsTime), '2026-10-20T03:00:00.000Z');
  assert.equal(m.rawTaf, rcss.rawTaf);
});

test('normalizeMetar converts statute miles and tolerates missing clouds', () => {
  const m = normalizeMetar({ ...rcss, visib: 3, clouds: undefined });
  assert.equal(m.visibKm, 4.8);
  assert.deepEqual(m.clouds, []);
});

test('isMetarFresh respects the max age', () => {
  const m = normalizeMetar(rcss);
  assert.equal(isMetarFresh(m, now, 90), true);
  assert.equal(isMetarFresh(m, new Date(now.getTime() + 2 * 3600e3), 90), false);
  assert.equal(isMetarFresh(null, now, 90), false);
});

test('parseTaf reads base period and hour 24 as next day', () => {
  const g = parseTaf(rcss.rawTaf, now);
  assert.equal(g[0].type, 'BASE');
  assert.equal(iso(g[0].from), '2026-10-20T00:00:00.000Z');
  assert.equal(iso(g[0].to), '2026-10-21T00:00:00.000Z');
  assert.equal(g[0].clouds[0].baseFt, 1500);
  const last = g[g.length - 1];
  assert.equal(last.type, 'TEMPO');
  assert.equal(iso(last.from), '2026-10-20T18:00:00.000Z');
  assert.equal(iso(last.to), '2026-10-21T00:00:00.000Z');
});

test('parseTaf reads BECMG periods and validity into the next day', () => {
  const g = parseTaf(rctp.rawTaf, now);
  assert.equal(iso(g[0].to), '2026-10-21T06:00:00.000Z');
  const becmg = g.find(x => x.type === 'BECMG');
  assert.equal(iso(becmg.from), '2026-10-20T10:00:00.000Z');
  assert.equal(iso(becmg.to), '2026-10-20T12:00:00.000Z');
});

test('parseTaf wraps validity into the next month', () => {
  const g = parseTaf('TAF RCTP 302300Z 3100/0106 01005KT 9999 FEW015', new Date('2026-10-30T23:10:00Z'));
  assert.equal(iso(g[0].from), '2026-10-31T00:00:00.000Z');
  assert.equal(iso(g[0].to), '2026-11-01T06:00:00.000Z');
});

test('parseTaf collects weather and cloud bases in change groups', () => {
  const g = parseTaf('TAF RCSS 200500Z 2006/2106 25008KT 9999 BKN025 TEMPO 2009/2012 -SHRA BKN012', now);
  const tempo = g.find(x => x.type === 'TEMPO');
  assert.deepEqual(tempo.wx, ['-SHRA']);
  assert.equal(tempo.clouds[0].baseFt, 1200);
});

test('parseTaf handles FM, PROB and CAVOK', () => {
  const g = parseTaf('TAF RCSS 200500Z 2006/2106 25008KT CAVOK FM201200 09010KT 9999 SCT020 PROB30 TEMPO 2015/2018 TSRA', now);
  assert.deepEqual(g[0].clouds, []);
  const fm = g.find(x => x.type === 'FM');
  assert.equal(iso(fm.from), '2026-10-20T12:00:00.000Z');
  assert.equal(iso(fm.to), '2026-10-21T06:00:00.000Z');
  assert.equal(iso(g[0].to), '2026-10-20T12:00:00.000Z');
  const prob = g.find(x => x.type === 'PROB');
  assert.equal(iso(prob.from), '2026-10-20T15:00:00.000Z');
  assert.deepEqual(prob.wx, ['TSRA']);
});

test('groupsOverlapping keeps only groups touching the window', () => {
  const g = parseTaf(rctp.rawTaf, now);
  const hit = groupsOverlapping(g, new Date('2026-10-20T09:11:00Z'), new Date('2026-10-20T09:52:00Z'));
  assert.deepEqual(hit.map(x => x.type), ['BASE']);
});

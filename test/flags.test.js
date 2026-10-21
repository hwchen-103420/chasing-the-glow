import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLAG, westFlags, overheadFlags, clearSkyFlags, summitFlags } from '../src/logic/flags.js';
import { parseTaf } from '../src/logic/aviation.js';

const date = '2026-10-20';
const now = new Date('2026-10-20T07:00:00Z');            // 15:00 Taipei
const metar = (clouds, extra = {}) => ({
  obsTime: new Date(now.getTime() - 10 * 60e3), visibKm: 10, temp: 29, dewp: 24,
  clouds: clouds.map(([cover, baseFt]) => ({ cover, baseFt })), ...extra,
});
const taf = tail => parseTaf(`TAF RCTP 200500Z 2006/2112 25008KT 9999 FEW020 ${tail}`, now);
const summitTaf = tail => parseTaf(`TAF RCSS 200500Z 2006/2112 25008KT 9999 FEW050 ${tail}`, now);
const window = { from: new Date('2026-10-20T09:11:00Z'), to: new Date('2026-10-20T09:52:00Z') };
const datun = { summit_cloud_ft: 4000 };

test('WEST_LOW for BKN/OVC below 3000 ft at RCTP only', () => {
  const run = (m) => westFlags({ rctp: m, rctpTaf: taf(''), date, now });
  assert.deepEqual(run(metar([['BKN', 2500]])), [FLAG.WEST_LOW]);
  assert.deepEqual(run(metar([['BKN', 3000]])), []);
  assert.deepEqual(run(metar([['SCT', 2000]])), []);
  const stale = metar([['BKN', 2500]], { obsTime: new Date(now.getTime() - 120 * 60e3) });
  assert.deepEqual(run(stale), []);
});

test('TAF_WORSE only for groups overlapping 17–18 Taipei', () => {
  const run = (tail) => westFlags({ rctp: metar([]), rctpTaf: taf(tail), date, now });
  assert.deepEqual(run('TEMPO 2009/2012 -SHRA'), [FLAG.TAF_WORSE]);
  assert.deepEqual(run('TEMPO 2009/2012 BKN015'), [FLAG.TAF_WORSE]);
  assert.deepEqual(run('TEMPO 2012/2015 BKN010'), []);
  assert.deepEqual(run('BECMG 2006/2008 BKN015'), [FLAG.TAF_WORSE]);
});

test('HAZE from visibility or small temperature–dewpoint spread', () => {
  const run = (m) => overheadFlags({ metar: m, westLow: false, now });
  assert.deepEqual(run(metar([], { visibKm: 4.8 })), [FLAG.HAZE]);
  assert.deepEqual(run(metar([], { temp: 29, dewp: 27 })), [FLAG.HAZE]);
  assert.deepEqual(run(metar([], { temp: 29, dewp: 26 })), []);
});

test('HIGH_CLOUD needs SCT/BKN at or above 8000 ft and no west low cloud', () => {
  assert.deepEqual(overheadFlags({ metar: metar([['SCT', 8000]]), westLow: false, now }), [FLAG.HIGH_CLOUD]);
  assert.deepEqual(overheadFlags({ metar: metar([['SCT', 8000]]), westLow: true, now }), []);
  assert.deepEqual(overheadFlags({ metar: metar([['SCT', 7000]]), westLow: false, now }), []);
  assert.deepEqual(overheadFlags({ metar: null, westLow: false, now }), []);
});

test('CLEAR below 10 percent cloud cover', () => {
  assert.deepEqual(clearSkyFlags({ cloud_cover: 0 }), [FLAG.CLEAR]);
  assert.deepEqual(clearSkyFlags({ cloud_cover: 0.10 }), []);
  assert.deepEqual(clearSkyFlags(null), []);
});

test('SUMMIT from TAF inside the best window', () => {
  const run = (tail) => summitFlags({
    spot: datun, rcssTaf: summitTaf(tail), rcss: metar([]), window, now: new Date('2026-10-20T05:00:00Z'),
  });
  assert.deepEqual(run('TEMPO 2009/2012 FEW039'), [FLAG.SUMMIT]);
  assert.deepEqual(run('TEMPO 2009/2012 FEW040'), []);
  assert.deepEqual(run('TEMPO 2012/2015 FEW010'), []);
});

test('SUMMIT from METAR only from 15:00 Taipei and while fresh', () => {
  const run = (at, m) => summitFlags({ spot: datun, rcssTaf: summitTaf(''), rcss: m, window, now: at });
  const at1459 = new Date('2026-10-20T06:59:00Z');
  const at1500 = new Date('2026-10-20T07:00:00Z');
  assert.deepEqual(run(at1459, metar([['FEW', 3000]], { obsTime: at1459 })), []);
  assert.deepEqual(run(at1500, metar([['FEW', 3000]], { obsTime: at1500 })), [FLAG.SUMMIT]);
  assert.deepEqual(run(at1500, metar([['FEW', 3000]], { obsTime: new Date('2026-10-20T05:00:00Z') })), []);
});

test('SUMMIT never applies without summit_cloud_ft', () => {
  assert.deepEqual(summitFlags({
    spot: { summit_cloud_ft: null }, rcssTaf: taf('TEMPO 2009/2012 FEW010'), rcss: metar([['FEW', 500]]), window, now,
  }), []);
});

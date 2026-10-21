const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../fixtures/sunsethue-weifeng-2026-10-20.json');
const { sunsethueUrl, parseSunsethue } = require('../../gas/sunsethue.js');
const { toTaipeiHHMM, taipeiDateStr } = require('../../gas/time.js');

test('time helpers convert to Taipei', () => {
  assert.equal(toTaipeiHHMM('2026-10-20T09:23:00.000Z'), '17:23');
  assert.equal(taipeiDateStr(new Date('2026-10-20T16:30:00Z')), '2026-10-21');
});

test('parseSunsethue converts times to Taipei HH:MM', () => {
  const r = parseSunsethue(fixture, '2026-10-20');
  assert.equal(r.date, '2026-10-20');
  assert.equal(r.sunset, '17:23');
  assert.equal(r.direction, 259.3);
  assert.deepEqual(r.golden_hour, ['17:11', '17:37']);
  assert.deepEqual(r.blue_hour, ['17:42', '17:52']);
  assert.equal(r.quality, 0.36);
  assert.equal(r.quality_text, 'Fair');
  assert.equal(r.cloud_cover, 0);
});

test('parseSunsethue rejects a response without data', () => {
  assert.throws(() => parseSunsethue({ error: 'unauthorized' }, '2026-10-20'));
});

test('sunsethueUrl builds the event query', () => {
  assert.ok(sunsethueUrl(25.0841, 121.5285, '2026-10-20')
    .includes('latitude=25.0841&longitude=121.5285&date=2026-10-20&type=sunset'));
});

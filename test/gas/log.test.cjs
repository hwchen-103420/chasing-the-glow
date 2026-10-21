const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FORECAST_HEADER, RATING_HEADER, forecastRows, parseRating } = require('../../gas/log.js');

const daily = {
  date: '2026-10-21', updated_at: '2026-10-21T16:30:04+08:00',
  regions: {
    '25,121.5': { date: '2026-10-21', quality: 0.01, quality_text: 'Poor', cloud_cover: 1, sunset: '17:22', direction: 258.9, golden_hour: ['17:10', '17:36'], blue_hour: ['17:41', '17:51'] },
    '25,121': { date: '2026-10-20', quality: 0.3 },
  },
};

test('forecastRows has one row per region updated today, matching the header', () => {
  const rows = forecastRows(daily);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].length, FORECAST_HEADER.length);
  assert.deepEqual(rows[0].slice(0, 6), ['2026-10-21', '2026-10-21T16:30:04+08:00', '25,121.5', 0.01, 'Poor', 1]);
});

const spotIds = ['dadaocheng-wharf', 'fishermans-wharf'];
const ok = {
  date: '2026-10-21', spot_id: 'dadaocheng-wharf', spot_name: '大稻埕碼頭', rating: 7, mode: 'cam',
  note: '雲縫透光', shown: { quality: 0.01, tier: 'poor', status: 'blocked', flags: ['西方低雲多，落日可能被擋'], pop: 20, wx: '多雲', updated_at: '16:30' },
};

test('parseRating accepts a valid rating and flattens it to the header order', () => {
  const row = parseRating(JSON.stringify(ok), spotIds, new Date('2026-10-21T09:45:00Z'));
  assert.equal(row.length, RATING_HEADER.length);
  assert.equal(row[1], '2026-10-21');
  assert.equal(row[2], 'dadaocheng-wharf');
  assert.equal(row[4], 7);
  assert.equal(row[5], 'cam');
  assert.equal(row[10], '西方低雲多，落日可能被擋');
});

test('parseRating rejects out-of-range, unknown spot, bad mode and long notes', () => {
  const bad = (patch) => () => parseRating(JSON.stringify({ ...ok, ...patch }), spotIds, new Date());
  assert.throws(bad({ rating: 0 }));
  assert.throws(bad({ rating: 11 }));
  assert.throws(bad({ rating: 6.5 }));
  assert.throws(bad({ spot_id: 'nope' }));
  assert.throws(bad({ mode: 'drone' }));
  assert.throws(bad({ note: 'x'.repeat(201) }));
  assert.throws(() => parseRating('not json', spotIds, new Date()));
});

test('parseRating neutralises spreadsheet formulas in free text', () => {
  const row = parseRating(JSON.stringify({ ...ok, note: '=HYPERLINK("x")' }), spotIds, new Date());
  assert.equal(row[6], "'=HYPERLINK(\"x\")");
});

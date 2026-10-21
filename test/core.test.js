import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  qualityTier, isVetoed, inAzRange, spotStatus, bestWindow,
  taipeiDate, taipeiHour, hhmmToDate,
} from '../src/logic/core.js';

test('qualityTier follows Sunsethue boundaries', () => {
  const cases = [[0.19, 'poor'], [0.20, 'fair'], [0.39, 'fair'], [0.40, 'good'],
    [0.59, 'good'], [0.60, 'great'], [null, 'nodata'], [undefined, 'nodata']];
  for (const [q, t] of cases) assert.equal(qualityTier(q), t, `q=${q}`);
});

test('isVetoed at 50 percent, not with missing pop', () => {
  assert.equal(isVetoed(49), false);
  assert.equal(isVetoed(50), true);
  assert.equal(isVetoed(null), false);
});

test('inAzRange includes both ends', () => {
  assert.equal(inAzRange(240, [240, 300]), true);
  assert.equal(inAzRange(300, [240, 300]), true);
  assert.equal(inAzRange(239.9, [240, 300]), false);
});

test('spotStatus distinguishes sea, blocked and afterglow', () => {
  assert.equal(spotStatus(259.3, { view_az_range: [230, 310], horizon_block: 'sea' }), 'sea');
  assert.equal(spotStatus(259.3, { view_az_range: [230, 310], horizon_block: 'ridge' }), 'blocked');
  assert.equal(spotStatus(290, { view_az_range: [200, 280], horizon_block: 'ridge' }), 'afterglow');
});

test('bestWindow runs from golden hour start to blue hour end', () => {
  assert.deepEqual(
    bestWindow({ golden_hour: ['17:11', '17:37'], blue_hour: ['17:42', '17:52'] }),
    { start: '17:11', end: '17:52' });
  assert.equal(bestWindow({ golden_hour: ['17:11', '17:37'] }), null);
});

test('Taipei date and hour roll over at 16:00Z', () => {
  const d = new Date('2026-10-20T16:30:00Z');
  assert.equal(taipeiDate(d), '2026-10-21');
  assert.equal(taipeiHour(d), 0);
});

test('hhmmToDate converts Taipei wall time to UTC', () => {
  assert.equal(hhmmToDate('2026-10-20', '17:11').toISOString(), '2026-10-20T09:11:00.000Z');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRatingPayload } from '../src/logic/rating.js';

const spot = {
  id: 'dadaocheng-wharf', name: '大稻埕碼頭', quality: 0.01, tier: 'poor', status: 'blocked',
  flags: ['西方低雲多，落日可能被擋'], weather: { wx: '多雲', temp: 28, pop: 20 },
};

test('buildRatingPayload snapshots what the site showed', () => {
  const p = buildRatingPayload(spot, { rating: 7, mode: 'cam', note: ' 雲縫透光 ' },
    { now: new Date('2026-10-21T09:45:00Z'), updatedAt: '16:30' });
  assert.deepEqual(p, {
    date: '2026-10-21', spot_id: 'dadaocheng-wharf', spot_name: '大稻埕碼頭', rating: 7, mode: 'cam',
    note: '雲縫透光',
    shown: { quality: 0.01, tier: 'poor', status: 'blocked', flags: ['西方低雲多，落日可能被擋'],
      pop: 20, wx: '多雲', updated_at: '16:30' },
  });
});

test('buildRatingPayload uses the Taipei date and tolerates missing weather', () => {
  const p = buildRatingPayload({ ...spot, weather: null }, { rating: 10, mode: 'onsite', note: '' },
    { now: new Date('2026-10-21T16:30:00Z'), updatedAt: null });
  assert.equal(p.date, '2026-10-22');
  assert.equal(p.shown.pop, null);
  assert.equal(p.shown.wx, null);
});

test('buildRatingPayload rejects ratings outside 1–10', () => {
  assert.throws(() => buildRatingPayload(spot, { rating: 0, mode: 'cam', note: '' }, { now: new Date() }));
  assert.throws(() => buildRatingPayload(spot, { rating: 11, mode: 'cam', note: '' }, { now: new Date() }));
});

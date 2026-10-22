import test from 'node:test';
import assert from 'node:assert/strict';
import { LOADER, loaderState, frameAt, lightsAt, mixHex, randomTotalMs, movingFraction, randomPauses } from '../src/loader/logic.js';

test('fixed 5 s timeline: anim → hold → fade → done', () => {
  assert.equal(loaderState(0).phase, 'anim');
  assert.equal(loaderState(0).pct, 0);
  assert.equal(loaderState(4000).phase, 'anim');
  assert.ok(loaderState(4000).pct <= 99);
  assert.deepEqual([loaderState(4200).phase, loaderState(4200).pct], ['hold', 100]);
  const f = loaderState(4700);
  assert.equal(f.phase, 'fade');
  assert.ok(f.opacity > 0 && f.opacity < 1);
  assert.equal(loaderState(LOADER.totalMs).phase, 'done');
});

test('reduced motion skips the animation', () => {
  assert.equal(loaderState(0, { reduced: true }).phase, 'hold');
  assert.equal(loaderState(1000, { reduced: true }).phase, 'done');
});

test('keyframes hit exact colours and the 80% line stays a dark silhouette', () => {
  assert.equal(frameAt(0).skyTop, '#8db8df');
  assert.equal(frameAt(0.8).line, '#1c1830');
  assert.equal(frameAt(1).skyTop, '#141b38');
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
});

test('lights: off before 80%, full at 88%, beacon blinks', () => {
  assert.equal(lightsAt(0.7, 0).bridge, 0);
  assert.equal(lightsAt(0.89, 0).bridge, 1);
  assert.equal(lightsAt(1, 100).beacon, 1);
  assert.equal(lightsAt(1, 1000).beacon, 0);
  assert.equal(lightsAt(1, 1000, { reduced: true }).beacon, 1);
});

test('random length stays within 4–7 s and drives the timeline', () => {
  assert.equal(randomTotalMs(0), 4000);
  assert.equal(randomTotalMs(0.999999), 7000);
  const cfg = { ...LOADER, totalMs: randomTotalMs(1) };
  assert.equal(loaderState(6000, { cfg }).phase, 'anim');
  assert.equal(loaderState(7000, { cfg }).phase, 'done');
});

test('pauses freeze progress without changing total length', () => {
  const pauses = [{ at: 0.4, ms: 500 }];
  // animMs 4100 → moving 3600; pause starts at 0.4*3600 = 1440 ms
  assert.equal(movingFraction(1440, 4100, pauses), 0.4);
  assert.equal(movingFraction(1800, 4100, pauses), 0.4);
  assert.ok(movingFraction(2000, 4100, pauses) > 0.4);
  assert.equal(movingFraction(4100, 4100, pauses), 1);
  assert.equal(loaderState(1800, { pauses }).pct, loaderState(1500, { pauses }).pct);
  assert.equal(loaderState(LOADER.totalMs, { pauses }).phase, 'done');
});

test('randomPauses: 1–2 pauses, in range, spaced, capped at 35%', () => {
  for (let i = 0; i < 500; i++) {
    const animMs = 3100 + Math.random() * 3000;
    const ps = randomPauses(animMs);
    assert.ok(ps.length >= 1 && ps.length <= 2);
    for (const p of ps) assert.ok(p.at >= 0.15 && p.at <= 0.75 && p.ms > 0 && p.ms <= 900);
    if (ps.length === 2) assert.ok(ps[1].at - ps[0].at >= 0.15);
    assert.ok(ps.reduce((a, p) => a + p.ms, 0) <= animMs * 0.35 + 1);
  }
});

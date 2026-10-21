import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSpots, gridOf } from '../scripts/validate-spots.mjs';

const load = () => JSON.parse(readFileSync(new URL('../data/spots.json', import.meta.url)));

test('gridOf floors coordinates to 0.25 degrees', () => {
  assert.equal(gridOf(25.1689, 121.4415), '25,121.25');
  assert.equal(gridOf(25.0565, 121.5075), '25,121.5');
  assert.equal(gridOf(25.0881, 121.1757), '25,121');
});

test('current spots.json is valid', () => {
  assert.deepEqual(validateSpots(load()), []);
});

test('missing view_az_range is reported with the spot id', () => {
  const d = load();
  delete d.spots[0].view_az_range;
  assert.ok(validateSpots(d).some(e => e.includes(d.spots[0].id)));
});

test('unknown ref_cams id is reported', () => {
  const d = load();
  d.spots[0].ref_cams.push('cam-missing');
  assert.ok(validateSpots(d).some(e => e.includes('cam-missing')));
});

test('unknown favorites id is reported', () => {
  const d = load();
  d.favorites.push('nope-spot');
  assert.ok(validateSpots(d).some(e => e.includes('nope-spot')));
});

test('sunsethue_grid that does not match coordinates is reported', () => {
  const d = load();
  d.spots[0].sunsethue_grid = '25,121.75';
  assert.ok(validateSpots(d).some(e => e.includes(d.spots[0].id)));
});

test('grid without a region is reported', () => {
  const d = load();
  d.regions = d.regions.filter(r => r.grid !== '25,121');
  assert.ok(validateSpots(d).some(e => e.includes('25,121')));
});

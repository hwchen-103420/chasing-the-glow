import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const url = new URL('../data/basemap.json', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));

test('basemap has land, coast and county-border layers', () => {
  const b = read('../data/basemap.json');
  assert.equal(b.land.type, 'FeatureCollection');
  const names = b.land.features.map(f => f.properties.name);
  for (const n of ['臺北市', '新北市', '桃園市', '基隆市']) assert.ok(names.includes(n), n);
  assert.equal(b.coast.type, 'MultiLineString');
  assert.equal(b.borders.type, 'MultiLineString');
  assert.ok(b.attribution.includes('內政部'));
  assert.ok(b.attribution.includes('OpenStreetMap'));
});

test('basemap rivers cover the Tamsui river system only', () => {
  const b = read('../data/basemap.json');
  assert.equal(b.rivers.type, 'FeatureCollection');
  const lines = b.rivers.features.filter(f => f.properties.kind === 'line').map(f => f.properties.name);
  for (const n of ['淡水河', '基隆河', '新店溪', '大漢溪']) assert.ok(lines.includes(n), n);
  const names = new Set(b.rivers.features.map(f => f.properties.name).filter(Boolean));
  for (const n of ['磺溪', '外雙溪', '瑪鋉溪', '圓山河']) assert.ok(!names.has(n), n);
  assert.ok(b.rivers.features.some(f => f.properties.kind === 'area'));
});

test('basemap land extent covers every spot', () => {
  const b = read('../data/basemap.json');
  const coords = b.land.features.flatMap(f => f.geometry.coordinates.flat(f.geometry.type === 'MultiPolygon' ? 2 : 1));
  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  for (const s of read('../data/spots.json').spots) {
    assert.ok(s.lng > Math.min(...lngs) && s.lng < Math.max(...lngs), s.id);
    assert.ok(s.lat > Math.min(...lats) && s.lat < Math.max(...lats), s.id);
  }
});

test('basemap stays small enough to load fast', () => {
  assert.ok(statSync(url).size < 400_000, `${statSync(url).size} bytes`);
});

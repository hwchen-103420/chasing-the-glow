// Builds data/basemap.json (land, coastline, county borders) for northern Taiwan
// from the Ministry of the Interior county boundaries packaged in taiwan-atlas.
// Run: node scripts/build-basemap.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { feature, mesh } from 'topojson-client';
import * as turf from '@turf/turf';

const COUNTIES = ['臺北市', '新北市', '基隆市', '桃園市', '新竹縣', '新竹市', '宜蘭縣'];
const topo = JSON.parse(readFileSync(new URL('../node_modules/taiwan-atlas/counties-10t.json', import.meta.url)));
const obj = topo.objects.counties;
const norm = name => name.replace(/^台/, '臺');                // dataset spells 台北市; spots.json uses 臺北市
const keep = g => COUNTIES.includes(norm(g.properties.COUNTYNAME));

const round = c => (typeof c[0] === 'number' ? [+c[0].toFixed(4), +c[1].toFixed(4)] : c.map(round));

const land = {
  type: 'FeatureCollection',
  features: feature(topo, { ...obj, geometries: obj.geometries.filter(keep) }).features.map(f => ({
    type: 'Feature',
    properties: { name: norm(f.properties.COUNTYNAME) },
    geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
  })),
};
const coast = mesh(topo, obj, (a, b) => a === b && keep(a));
const borders = mesh(topo, obj, (a, b) => a !== b && (keep(a) || keep(b)));

// Rivers: OpenStreetMap export in data-src/rivers-osm.geojson (Overpass query in docs/deploy.md).
// Keep the four named centrelines and the water areas they run through; drop other streams.
const RIVERS = ['淡水河', '基隆河', '新店溪', '大漢溪'];
const BBOX = [121.05, 24.9, 121.8, 25.35];
const osm = JSON.parse(readFileSync(new URL('../data-src/rivers-osm.geojson', import.meta.url)));
const riverLines = osm.features.filter(f => f.properties.waterway === 'river' && RIVERS.includes(f.properties.name));
const isArea = f => /Polygon$/.test(f.geometry.type) && f.properties.water === 'river';
const tidy = f => {
  const clipped = turf.bboxClip(f, BBOX);
  const simple = turf.simplify(clipped, { tolerance: 0.0001, highQuality: false });
  return simple.geometry.coordinates.length ? simple.geometry : null;
};
const riverFeatures = [
  ...osm.features
    .filter(f => isArea(f) && (!f.properties.name || RIVERS.includes(f.properties.name)))
    .filter(f => riverLines.some(l => turf.booleanIntersects(f, l)))
    .map(f => ({ kind: 'area', name: f.properties.name ?? null, geometry: tidy(f) })),
  ...riverLines.map(f => ({ kind: 'line', name: f.properties.name, geometry: tidy(f) })),
].filter(r => r.geometry);
const rivers = {
  type: 'FeatureCollection',
  features: riverFeatures.map(r => ({
    type: 'Feature',
    properties: { kind: r.kind, name: r.name },
    geometry: { type: r.geometry.type, coordinates: round(r.geometry.coordinates) },
  })),
};

const out = {
  attribution: '縣市界：內政部國土測繪中心（taiwan-atlas）・河川：© OpenStreetMap contributors',
  rivers,
  land,
  coast: { type: coast.type, coordinates: round(coast.coordinates) },
  borders: { type: borders.type, coordinates: round(borders.coordinates) },
};
writeFileSync(new URL('../data/basemap.json', import.meta.url), JSON.stringify(out));
console.log(`basemap.json: ${land.features.length} counties, ${rivers.features.length} river features, ${JSON.stringify(out).length} bytes`);

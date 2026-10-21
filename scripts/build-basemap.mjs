// Builds data/basemap.json (land, coastline, county borders) for northern Taiwan
// from the Ministry of the Interior county boundaries packaged in taiwan-atlas.
// Run: node scripts/build-basemap.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { feature, mesh } from 'topojson-client';

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

const out = {
  attribution: '縣市界：內政部國土測繪中心（taiwan-atlas）',
  land,
  coast: { type: coast.type, coordinates: round(coast.coordinates) },
  borders: { type: borders.type, coordinates: round(borders.coordinates) },
};
writeFileSync(new URL('../data/basemap.json', import.meta.url), JSON.stringify(out));
console.log(`basemap.json: ${land.features.length} counties, ${JSON.stringify(out).length} bytes`);

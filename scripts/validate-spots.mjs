import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function gridOf(lat, lng) {
  const f = v => Math.floor(v * 4) / 4;
  return `${f(lat)},${f(lng)}`;
}

const HORIZONS = ['sea', 'ridge', 'buildings'];
const STATIONS = ['RCSS', 'RCTP'];

export function validateSpots(data) {
  const errors = [];
  const regions = data.regions ?? [];
  const cams = new Set((data.cams ?? []).map(c => c.id));
  const spotIds = new Set();
  const regionGrids = new Set();

  for (const r of regions) {
    for (const k of ['grid', 'name', 'cwa_town']) if (!r[k]) errors.push(`region ${r.grid ?? '?'}: missing ${k}`);
    if (!STATIONS.includes(r.metar_overhead)) errors.push(`region ${r.grid}: metar_overhead must be RCSS or RCTP`);
    regionGrids.add(r.grid);
  }

  for (const s of data.spots ?? []) {
    const id = s.id ?? '(no id)';
    spotIds.add(s.id);
    for (const k of ['id', 'name', 'nav_url']) if (!s[k]) errors.push(`spot ${id}: missing ${k}`);
    if (typeof s.lat !== 'number' || typeof s.lng !== 'number') errors.push(`spot ${id}: lat/lng must be numbers`);
    const r = s.view_az_range;
    if (!Array.isArray(r) || r.length !== 2 || !(r[0] >= 0 && r[0] < r[1] && r[1] <= 360)) {
      errors.push(`spot ${id}: view_az_range must be [min,max] with 0<=min<max<=360`);
    }
    if (!HORIZONS.includes(s.horizon_block)) errors.push(`spot ${id}: horizon_block must be ${HORIZONS.join('|')}`);
    if (!/^[^/]+\/[^/]+$/.test(s.cwa_town ?? '')) errors.push(`spot ${id}: cwa_town must be "縣市/鄉鎮"`);
    if (!STATIONS.includes(s.metar_overhead)) errors.push(`spot ${id}: metar_overhead must be RCSS or RCTP`);
    if (!(s.summit_cloud_ft === null || s.summit_cloud_ft === undefined || s.summit_cloud_ft > 0)) {
      errors.push(`spot ${id}: summit_cloud_ft must be null or positive`);
    }
    if (!Array.isArray(s.ref_cams)) errors.push(`spot ${id}: ref_cams must be an array`);
    else for (const c of s.ref_cams) if (!cams.has(c)) errors.push(`spot ${id}: unknown cam ${c}`);
    if (typeof s.lat === 'number' && typeof s.lng === 'number') {
      const g = gridOf(s.lat, s.lng);
      if (s.sunsethue_grid !== g) errors.push(`spot ${id}: sunsethue_grid ${s.sunsethue_grid} should be ${g}`);
      if (!regionGrids.has(s.sunsethue_grid)) errors.push(`spot ${id}: no region for grid ${s.sunsethue_grid}`);
    }
  }

  for (const f of data.favorites ?? []) if (!spotIds.has(f)) errors.push(`favorites: unknown spot ${f}`);
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = JSON.parse(readFileSync(new URL('../data/spots.json', import.meta.url)));
  const errors = validateSpots(data);
  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.log(`spots.json OK (${data.spots.length} spots, ${data.cams.length} cams)`);
}

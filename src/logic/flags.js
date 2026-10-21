import { CONFIG } from '../config.js';
import { groupsOverlapping, isMetarFresh } from './aviation.js';
import { taipeiHour } from './core.js';

export const FLAG = {
  WEST_LOW: '西方低雲多，落日可能被擋',
  TAF_WORSE: '傍晚預報轉差',
  HAZE: '水氣重或有霾，顏色可能混濁',
  HIGH_CLOUD: '有中高雲，有機會火燒雲',
  CLEAR: '晴空無雲，天空顏色會比較單調',
  SUMMIT: '山頂視野可能受雲層干擾',
};

const isLowCeiling = c => (c.cover === 'BKN' || c.cover === 'OVC') && c.baseFt < CONFIG.lowCloudFt;
const fresh = (m, now) => isMetarFresh(m, now, CONFIG.metarMaxAgeMin);

export function westLowHit(rctp, now) {
  return fresh(rctp, now) && rctp.clouds.some(isLowCeiling);
}

export function westFlags({ rctp, rctpTaf, date, now }) {
  const flags = [];
  if (westLowHit(rctp, now)) flags.push(FLAG.WEST_LOW);
  const [h1, h2] = CONFIG.tafEveningUtcHours;
  const from = new Date(`${date}T${String(h1).padStart(2, '0')}:00:00Z`);
  const to = new Date(`${date}T${String(h2).padStart(2, '0')}:00:00Z`);
  const evening = groupsOverlapping(rctpTaf ?? [], from, to);
  if (evening.some(g => g.wx.length > 0 || g.clouds.some(isLowCeiling))) flags.push(FLAG.TAF_WORSE);
  return flags;
}

export function overheadFlags({ metar, westLow, now }) {
  if (!fresh(metar, now)) return [];
  const flags = [];
  const spread = (metar.temp ?? NaN) - (metar.dewp ?? NaN);
  if ((metar.visibKm !== null && metar.visibKm < CONFIG.hazeVisKm) || spread <= CONFIG.hazeSpreadC) {
    flags.push(FLAG.HAZE);
  }
  if (!westLow && metar.clouds.some(c => (c.cover === 'SCT' || c.cover === 'BKN') && c.baseFt >= CONFIG.highCloudFt)) {
    flags.push(FLAG.HIGH_CLOUD);
  }
  return flags;
}

export function clearSkyFlags(region) {
  return typeof region?.cloud_cover === 'number' && region.cloud_cover < CONFIG.clearSkyCloudCover ? [FLAG.CLEAR] : [];
}

export function summitFlags({ spot, rcssTaf, rcss, window, now }) {
  const limit = spot?.summit_cloud_ft;
  if (limit === null || limit === undefined) return [];
  const low = c => c.baseFt < limit;
  const tafHit = window
    ? groupsOverlapping(rcssTaf ?? [], window.from, window.to).some(g => g.clouds.some(low))
    : false;
  const metarHit = taipeiHour(now) >= CONFIG.summitMetarFromHour && fresh(rcss, now) && rcss.clouds.some(low);
  return tafHit || metarHit ? [FLAG.SUMMIT] : [];
}

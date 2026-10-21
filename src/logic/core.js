import { CONFIG } from '../config.js';

const TPE_OFFSET_MS = 8 * 3600 * 1000;

export function qualityTier(q) {
  if (q === null || q === undefined || Number.isNaN(q)) return 'nodata';
  const [fair, good, great] = CONFIG.tierBounds;
  if (q < fair) return 'poor';
  if (q < good) return 'fair';
  if (q < great) return 'good';
  return 'great';
}

export function isVetoed(pop) {
  return typeof pop === 'number' && pop >= CONFIG.vetoPop;
}

export function inAzRange(az, [min, max]) {
  return az >= min && az <= max;
}

export function spotStatus(sunAz, spot) {
  if (!inAzRange(sunAz, spot.view_az_range)) return 'afterglow';
  return spot.horizon_block === 'sea' ? 'sea' : 'blocked';
}

export function bestWindow(region) {
  const g = region?.golden_hour;
  const b = region?.blue_hour;
  if (!g?.[0] || !b?.[1]) return null;
  return { start: g[0], end: b[1] };
}

export function taipeiDate(d) {
  return new Date(d.getTime() + TPE_OFFSET_MS).toISOString().slice(0, 10);
}

export function taipeiHour(d) {
  return new Date(d.getTime() + TPE_OFFSET_MS).getUTCHours();
}

export function hhmmToDate(dateStr, hhmm) {
  return new Date(Date.parse(`${dateStr}T${hhmm}:00Z`) - TPE_OFFSET_MS);
}

import { qualityTier, isVetoed, spotStatus, bestWindow, taipeiDate, hhmmToDate } from './core.js';
import { normalizeMetar, parseTaf } from './aviation.js';
import { westFlags, westLowHit, overheadFlags, clearSkyFlags, summitFlags } from './flags.js';

export const BANNER = { NO_API: '無法取得資料', STALE: '資料不是今天的' };
export const NO_RAIN_DATA = '降雨資料暫缺';

function toHHMM(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 8 * 3600e3).toISOString().slice(11, 16);
}

export function buildViewModel(spotsData, api, now) {
  const today = taipeiDate(now);
  const banners = [];
  if (!api) banners.push(BANNER.NO_API);
  else if (api.date !== today) banners.push(BANNER.STALE);

  const regionData = grid => {
    const r = api?.regions?.[grid];
    return r && r.date === today ? r : null;
  };
  const townData = town => (api ? api.towns?.[town] ?? null : null);
  const trusted = Boolean(api) && api.date === today;

  const metars = {};
  const tafs = {};
  for (const st of ['RCSS', 'RCTP']) {
    metars[st] = normalizeMetar(api?.metar?.[st]);
    tafs[st] = metars[st] ? parseTaf(metars[st].rawTaf, now) : [];
  }
  const westLow = westLowHit(metars.RCTP, now);
  const west = api ? westFlags({ rctp: metars.RCTP, rctpTaf: tafs.RCTP, date: today, now }) : [];
  const overhead = st => (api ? overheadFlags({ metar: metars[st], westLow, now }) : []);

  const regions = (spotsData.regions ?? []).map(reg => {
    const r = regionData(reg.grid);
    const weather = townData(reg.cwa_town);
    return {
      grid: reg.grid,
      name: reg.name,
      tier: qualityTier(r?.quality),
      quality: r?.quality ?? null,
      qualityText: r?.quality_text ?? null,
      direction: r?.direction ?? null,
      sunset: r?.sunset ?? null,
      window: bestWindow(r),
      weather,
      vetoed: trusted && isVetoed(weather?.pop ?? null),
      flags: api ? [...west, ...overhead(reg.metar_overhead), ...clearSkyFlags(r)] : [],
    };
  });

  const cams = new Map((spotsData.cams ?? []).map(c => [c.id, c]));
  const favoriteIds = spotsData.favorites ?? [];

  const spots = (spotsData.spots ?? []).map(spot => {
    const r = regionData(spot.sunsethue_grid);
    const weather = townData(spot.cwa_town);
    const window = bestWindow(r);
    const sunAz = r?.direction ?? null;
    let flags = [];
    if (api) {
      const summitWindow = window
        ? { from: hhmmToDate(today, window.start), to: hhmmToDate(today, window.end) }
        : null;
      flags = [
        ...west,
        ...overhead(spot.metar_overhead),
        ...clearSkyFlags(r),
        ...summitFlags({ spot, rcssTaf: tafs.RCSS, rcss: metars.RCSS, window: summitWindow, now }),
      ];
      if (!weather) flags.push(NO_RAIN_DATA);
    }
    return {
      ...spot,
      tier: qualityTier(r?.quality),
      quality: r?.quality ?? null,
      qualityText: r?.quality_text ?? null,
      sunAz,
      status: sunAz === null ? null : spotStatus(sunAz, spot),
      window,
      weather,
      vetoed: trusted && isVetoed(weather?.pop ?? null),
      flags,
      cams: (spot.ref_cams ?? []).map(id => cams.get(id)).filter(Boolean),
      favorite: favoriteIds.includes(spot.id),
    };
  });

  const byId = new Map(spots.map(s => [s.id, s]));
  const favorites = [];
  for (const id of favoriteIds) {
    if (byId.has(id)) favorites.push(byId.get(id));
    else console.warn(`favorites: unknown spot id "${id}"`);
  }

  return { banners, updatedAt: api?.updated_at ? toHHMM(api.updated_at) : null, regions, spots, favorites };
}

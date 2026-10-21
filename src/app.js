import { CONFIG } from './config.js';
import { buildViewModel, BANNER } from './logic/model.js';
import { createMap, renderPins } from './ui/map.js';
import { renderRegions, renderFavorites, openDetail, closeDetail } from './ui/panel.js';
import { TEXT } from './ui/labels.js';
import { formatClock, taipeiDate } from './logic/core.js';
import { buildRatingPayload } from './logic/rating.js';

async function loadJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function showBanner(messages) {
  const banner = document.querySelector('#banner');
  banner.querySelector('.banner-text').textContent = messages.join('；');
  banner.classList.toggle('banner--error', messages.includes(BANNER.NO_API));
  banner.classList.toggle('banner--stale', !messages.includes(BANNER.NO_API));
  banner.hidden = messages.length === 0;
}

async function main() {
  const [spotsData, basemap] = await Promise.all([
    loadJson('data/spots.json'),
    loadJson('data/basemap.json').catch(e => { console.error(e); return null; }),
  ]);
  // ?api=<url> overrides the configured endpoint (used by tests and for local fixtures).
  const apiUrl = new URLSearchParams(location.search).get('api') || CONFIG.gasUrl;
  let api = null;
  if (apiUrl) {
    try { api = await loadJson(apiUrl); } catch (e) { console.error(e); }
  }
  const vm = buildViewModel(spotsData, api, new Date());

  showBanner(vm.banners);
  const tick = () => {
    const { date, time } = formatClock(new Date());
    document.querySelector('#today .today-date').textContent = date;
    document.querySelector('#today .today-time').textContent = time;
  };
  tick();
  setInterval(tick, 15_000);
  document.querySelector('#today .today-sunset b').textContent = vm.referenceSunset ?? '—';
  document.querySelector('#updated .updated-time').textContent = vm.updatedAt ? TEXT.updated(vm.updatedAt) : '';

  const map = createMap(document.querySelector('#map'), basemap);
  let pins;
  // Ratings go to the same GAS web app via POST (text/plain avoids a CORS preflight).
  const onRate = apiUrl ? async (spot, input) => {
    const payload = buildRatingPayload(spot, input, { now: new Date(), updatedAt: vm.updatedAt });
    const res = await fetch(apiUrl, {
      method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    });
    return res.json();
  } : null;
  const select = spot => {
    pins.select(spot.id);
    openDetail(spot, { onClose: () => pins.select(null), onRate, today: taipeiDate(new Date()) });
  };
  pins = renderPins(map, vm.spots, { onClick: select });
  window.addEventListener('load', pins.fit);
  renderRegions(document.querySelector('#regions'), vm.regions);
  renderFavorites(document.querySelector('#favorites'), vm.favorites, { onClick: select });
  closeDetail();
  document.body.dataset.ready = 'true';
}

main().catch(e => {
  console.error(e);
  showBanner([BANNER.NO_API]);
});

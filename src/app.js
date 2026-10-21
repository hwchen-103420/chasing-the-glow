import { CONFIG } from './config.js';
import { buildViewModel, BANNER } from './logic/model.js';
import { createMap, renderPins } from './ui/map.js';
import { renderRegions, renderFavorites, openDetail, closeDetail } from './ui/panel.js';
import { TEXT } from './ui/labels.js';

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
  const spotsData = await loadJson('data/spots.json');
  // ?api=<url> overrides the configured endpoint (used by tests and for local fixtures).
  const apiUrl = new URLSearchParams(location.search).get('api') || CONFIG.gasUrl;
  let api = null;
  if (apiUrl) {
    try { api = await loadJson(apiUrl); } catch (e) { console.error(e); }
  }
  const vm = buildViewModel(spotsData, api, new Date());

  showBanner(vm.banners);
  document.querySelector('#updated .updated-time').textContent = vm.updatedAt ? TEXT.updated(vm.updatedAt) : '';

  const map = createMap(document.querySelector('#map'));
  let pins;
  const select = spot => {
    pins.select(spot.id);
    openDetail(spot, { onClose: () => pins.select(null) });
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

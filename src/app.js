import { CONFIG } from './config.js';
import { buildViewModel } from './logic/model.js';
import { createMap, renderPins } from './ui/map.js';
import {
  renderRegions, renderFavorites, showTooltip, hideTooltip, openDetail, closeDetail,
} from './ui/panel.js';
import { TEXT } from './ui/labels.js';

async function loadJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
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

  const banner = document.querySelector('#banner');
  banner.textContent = vm.banners.join('；');
  banner.hidden = vm.banners.length === 0;
  document.querySelector('#updated').textContent = vm.updatedAt ? TEXT.updated(vm.updatedAt) : '';

  const map = createMap(document.querySelector('#map'));
  let pins;
  const select = spot => {
    hideTooltip();
    pins.select(spot.id);
    openDetail(spot, { onClose: () => pins.select(null) });
  };
  const hover = { onHover: showTooltip, onLeave: hideTooltip, onClick: select };
  pins = renderPins(map, vm.spots, hover);
  renderRegions(document.querySelector('#regions'), vm.regions);
  renderFavorites(document.querySelector('#favorites'), vm.favorites, hover);
  closeDetail();
  document.body.dataset.ready = 'true';
}

main().catch(e => {
  console.error(e);
  const banner = document.querySelector('#banner');
  banner.textContent = '無法取得資料';
  banner.hidden = false;
});

import { TEXT, STATUS_TEXT, tierText, stateClasses } from './labels.js';
import { youtubeEmbedUrl } from './geo.js';

const $ = sel => document.querySelector(sel);

function setField(root, name, value) {
  for (const el of root.querySelectorAll(`[data-field="${name}"]`)) el.textContent = value ?? '';
}

function fill(tplId, item) {
  const root = $(`#${tplId}`).content.firstElementChild.cloneNode(true);
  root.classList.add(...stateClasses(item));
  setField(root, 'name', item.name);
  setField(root, 'tier-text', tierText(item));
  setField(root, 'quality', typeof item.quality === 'number' ? `${Math.round(item.quality * 100)}%` : '—');
  setField(root, 'status-text', item.status ? STATUS_TEXT[item.status] : '');
  setField(root, 'wx', item.weather?.wx ?? '—');
  setField(root, 'temp', typeof item.weather?.temp === 'number' ? `${item.weather.temp}°C` : '—');
  setField(root, 'pop', typeof item.weather?.pop === 'number' ? `降雨 ${item.weather.pop}%` : '降雨 —');
  setField(root, 'window', item.window ? `最佳時段 ${item.window.start}–${item.window.end}` : '');
  for (const ul of root.querySelectorAll('[data-field="flags"]')) {
    ul.replaceChildren(...item.flags.map(f => Object.assign(document.createElement('li'), { textContent: f })));
  }
  return root;
}

export function renderRegions(el, regions) {
  el.replaceChildren(...regions.map(r => fill('tpl-region-card', r)));
}

export function renderFavorites(el, favorites, { onHover, onLeave, onClick }) {
  el.replaceChildren(...favorites.map(s => {
    const card = fill('tpl-favorite-card', s);
    card.dataset.id = s.id;
    card.addEventListener('mouseenter', () => onHover(s, card));
    card.addEventListener('mouseleave', () => onLeave());
    card.addEventListener('click', () => onClick(s));
    return card;
  }));
}

let tooltipEl = null;

export function showTooltip(spot, anchorEl) {
  hideTooltip();
  if (!anchorEl) return;
  tooltipEl = fill('tpl-tooltip', spot);
  tooltipEl.id = 'tooltip';
  document.body.append(tooltipEl);
  const a = anchorEl.getBoundingClientRect();
  const t = tooltipEl.getBoundingClientRect();
  const left = Math.min(a.right + 8, window.innerWidth - t.width - 8);
  const top = Math.max(8, Math.min(a.top, window.innerHeight - t.height - 8));
  Object.assign(tooltipEl.style, { position: 'fixed', left: `${left}px`, top: `${top}px` });
}

export function hideTooltip() {
  tooltipEl?.remove();
  tooltipEl = null;
}

function showCam(card, spot, index) {
  const cam = spot.cams[index];
  const slot = card.querySelector('[data-field="cam"]');
  const label = card.querySelector('[data-field="cam-label"]');
  const open = card.querySelector('[data-field="cam-open"]');
  const embed = cam ? youtubeEmbedUrl(cam.url) : null;
  if (!embed) {
    slot.replaceChildren(document.createTextNode(TEXT.noCam));
    if (label) label.textContent = '';
    if (open) open.hidden = true;
    return;
  }
  const iframe = Object.assign(document.createElement('iframe'), {
    src: embed, title: cam.name, allow: 'autoplay; encrypted-media; picture-in-picture', allowFullscreen: true,
  });
  slot.replaceChildren(iframe);
  if (label) label.textContent = cam.sees_west_sky === true ? cam.name : `${cam.name}・${TEXT.weatherRef}`;
  if (open) Object.assign(open, { href: cam.url, target: '_blank', rel: 'noopener', textContent: TEXT.openYoutube, hidden: false });
}

export function openDetail(spot, { onClose } = {}) {
  const host = $('#detail');
  host.replaceChildren();                        // drop any previous iframe first: one stream at a time
  const card = fill('tpl-detail', spot);
  let index = 0;
  showCam(card, spot, index);
  const sw = card.querySelector('[data-field="cam-switch"]');
  if (sw) {
    sw.hidden = spot.cams.length < 2;
    sw.textContent = TEXT.switchCam;
    sw.addEventListener('click', () => { index = (index + 1) % spot.cams.length; showCam(card, spot, index); });
  }
  const nav = card.querySelector('[data-field="nav"]');
  if (nav) Object.assign(nav, { href: spot.nav_url, target: '_blank', rel: 'noopener', textContent: TEXT.nav });
  card.querySelector('[data-field="close"]')?.addEventListener('click', () => { closeDetail(); onClose?.(); });
  host.append(card);
  host.hidden = false;
}

export function closeDetail() {
  const host = $('#detail');
  host.replaceChildren();
  host.hidden = true;
}

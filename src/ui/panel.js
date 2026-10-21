import { TEXT, STATUS_TEXT, tierText, stateClasses } from './labels.js';
import { youtubeEmbedUrl } from './geo.js';

const $ = sel => document.querySelector(sel);

function setField(root, name, value) {
  for (const el of root.querySelectorAll(`[data-field="${name}"]`)) el.textContent = value ?? '';
}

// Templates carry their own labels ("降雨", "最佳時段"); fields receive values only.
export function fillTemplate(tplId, item) {
  const root = $(`#${tplId}`).content.firstElementChild.cloneNode(true);
  root.classList.add(...stateClasses(item));
  setField(root, 'name', item.name);
  setField(root, 'tier-text', tierText(item));
  setField(root, 'quality', typeof item.quality === 'number' ? String(Math.round(item.quality * 100)) : '—');
  setField(root, 'status-text', item.status ? STATUS_TEXT[item.status] : '');
  setField(root, 'wx', item.weather?.wx ?? '—');
  setField(root, 'temp', typeof item.weather?.temp === 'number' ? `${item.weather.temp}°C` : '—');
  setField(root, 'pop', typeof item.weather?.pop === 'number' ? `${item.weather.pop}%` : '—');
  setField(root, 'window', item.window ? `${item.window.start}–${item.window.end}` : '—');
  for (const ul of root.querySelectorAll('[data-field="flags"]')) {
    ul.replaceChildren(...item.flags.map(f => Object.assign(document.createElement('li'), { textContent: f })));
  }
  return root;
}

export function renderRegions(el, regions) {
  el.replaceChildren(...regions.map(r => fillTemplate('tpl-region-card', r)));
}

// Hover enlargement is pure CSS (.fav-card:hover); only clicks and Enter/Space need wiring.
export function renderFavorites(el, favorites, { onClick }) {
  el.replaceChildren(...favorites.map(s => {
    const card = fillTemplate('tpl-favorite-card', s);
    card.dataset.id = s.id;
    card.addEventListener('click', () => onClick(s));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(s); }
    });
    return card;
  }));
}

function showCam(card, spot, index) {
  const cam = spot.cams[index];
  const slot = card.querySelector('[data-field="cam"]');
  const label = card.querySelector('[data-field="cam-label"]');
  const open = card.querySelector('[data-field="cam-open"]');
  const embed = cam ? youtubeEmbedUrl(cam.url) : null;
  if (!embed) {
    slot.replaceChildren(Object.assign(document.createElement('p'), { className: 'cam-empty', textContent: TEXT.noCam }));
    if (label) label.hidden = true;
    if (open) open.hidden = true;
    return;
  }
  const iframe = Object.assign(document.createElement('iframe'), {
    src: embed, title: cam.name, allow: 'autoplay; encrypted-media; picture-in-picture', allowFullscreen: true,
  });
  slot.replaceChildren(iframe);
  if (label) {
    label.hidden = false;
    label.textContent = cam.sees_west_sky === true ? cam.name : `${cam.name}・${TEXT.weatherRef}`;
  }
  if (open) Object.assign(open, { href: cam.url, hidden: false });
}

export function openDetail(spot, { onClose } = {}) {
  const host = $('#detail');
  host.replaceChildren();                        // drop any previous iframe first: one stream at a time
  const card = fillTemplate('tpl-detail', spot);
  let index = 0;
  showCam(card, spot, index);
  const sw = card.querySelector('[data-field="cam-switch"]');
  if (sw) {
    sw.hidden = spot.cams.length < 2;
    sw.addEventListener('click', () => { index = (index + 1) % spot.cams.length; showCam(card, spot, index); });
  }
  const nav = card.querySelector('[data-field="nav"]');
  if (nav) nav.href = spot.nav_url;
  card.querySelector('[data-field="close"]')?.addEventListener('click', () => { closeDetail(); onClose?.(); });
  host.append(card);
  host.hidden = false;
}

export function closeDetail() {
  const host = $('#detail');
  host.replaceChildren();
  host.hidden = true;
}

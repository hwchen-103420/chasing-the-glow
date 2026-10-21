/* global L */
import { destinationPoint, sectorPolygon } from './geo.js';
import { stateClasses, glyphSrc } from './labels.js';
import { fillTemplate } from './panel.js';

export function createMap(el) {
  const map = L.map(el, { zoomControl: false });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);
  return map;
}

export function renderPins(map, spots, { onClick }) {
  const items = new Map();
  for (const s of spots) {
    const muted = s.vetoed || s.tier === 'nodata' ? ' is-muted' : '';
    const fan = L.polygon(sectorPolygon(s.lat, s.lng, s.view_az_range, 2.4), {
      className: `sun-fan${muted}`, stroke: false, interactive: false,
    }).addTo(map);
    if (s.sunAz !== null) {
      L.polyline([[s.lat, s.lng], destinationPoint(s.lat, s.lng, s.sunAz, 3)], {
        className: `sun-ray${muted}`, interactive: false,
      }).addTo(map);
    }
    const html = `<div class="pin ${stateClasses(s).join(' ')}" data-id="${s.id}">`
      + `<img class="pin-glyph" src="${glyphSrc(s)}" alt=""></div>`;
    const marker = L.marker([s.lat, s.lng], {
      icon: L.divIcon({ className: 'pin-icon', html, iconSize: [44, 44], iconAnchor: [22, 22] }),
      title: s.name,
      riseOnHover: true,
    }).addTo(map);
    marker.bindTooltip(() => fillTemplate('tpl-tooltip', s), {
      direction: 'top', offset: [0, -20], className: 'tip-wrap', opacity: 1,
    });
    marker.on('click', () => { marker.closeTooltip(); onClick(s); });
    items.set(s.id, { pin: () => marker.getElement()?.querySelector('.pin'), fan });
  }
  const fit = () => {
    map.invalidateSize();
    map.fitBounds(spots.map(s => [s.lat, s.lng]), { paddingTopLeft: [90, 70], paddingBottomRight: [70, 150] });
  };
  fit();
  return {
    select(id) {
      for (const [sid, it] of items) {
        it.pin()?.classList.toggle('is-selected', sid === id);
        const path = it.fan.getElement();
        if (path) path.classList.toggle('is-selected', sid === id);
      }
    },
    fit,
  };
}

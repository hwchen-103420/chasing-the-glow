/* global L */
import { destinationPoint, sectorPolygon } from './geo.js';
import { stateClasses, glyphSrc } from './labels.js';

export function createMap(el) {
  const map = L.map(el, { zoomControl: true });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);
  return map;
}

export function renderPins(map, spots, { onHover, onLeave, onClick }) {
  const markers = new Map();
  for (const s of spots) {
    L.polygon(sectorPolygon(s.lat, s.lng, s.view_az_range, 2), {
      className: 'view-sector', stroke: false, fillOpacity: 0.12, interactive: false,
    }).addTo(map);
    if (s.sunAz !== null) {
      L.polyline([[s.lat, s.lng], destinationPoint(s.lat, s.lng, s.sunAz, 3)], {
        className: 'sun-line', weight: 2, interactive: false,
      }).addTo(map);
    }
    const html = `<div class="pin ${stateClasses(s).join(' ')}" data-id="${s.id}">`
      + `<img class="pin-glyph" src="${glyphSrc(s)}" alt="" onerror="this.style.visibility='hidden'"></div>`;
    const marker = L.marker([s.lat, s.lng], {
      icon: L.divIcon({ className: 'pin-host', html, iconSize: [32, 32], iconAnchor: [16, 16] }),
      title: s.name,
    }).addTo(map);
    const pinEl = () => marker.getElement()?.querySelector('.pin');
    marker.on('mouseover', () => onHover(s, pinEl()));
    marker.on('mouseout', () => onLeave());
    marker.on('click', () => onClick(s));
    markers.set(s.id, pinEl);
  }
  map.fitBounds(spots.map(s => [s.lat, s.lng]), { padding: [40, 40] });
  return {
    select(id) {
      for (const [sid, el] of markers) el()?.classList.toggle('is-selected', sid === id);
    },
    pinElement(id) {
      return markers.get(id)?.() ?? null;
    },
  };
}

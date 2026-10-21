/* global L */
import { destinationPoint, sectorPolygon } from './geo.js';
import { stateClasses, glyphSrc } from './labels.js';
import { fillTemplate } from './panel.js';

// Fixed outline map: land, coastline and county borders only; no tiles, no pan or zoom.
export function createMap(el, basemap) {
  const map = L.map(el, {
    zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
    boxZoom: false, keyboard: false, touchZoom: false, zoomSnap: 0, attributionControl: true,
  });
  map.attributionControl.setPrefix(false);
  map.fitBounds([[24.95, 121.1], [25.3, 121.65]]);      // initial view; renderPins refits to the spots
  if (basemap) {
    L.geoJSON(basemap.land, { className: 'land', interactive: false, style: { stroke: false } }).addTo(map);
    L.geoJSON(basemap.borders, { className: 'county-border', interactive: false }).addTo(map);
    L.geoJSON(basemap.coast, { className: 'coast', interactive: false }).addTo(map);
    map.attributionControl.addAttribution(basemap.attribution);
  }
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
      direction: 'auto', offset: [18, 0], className: 'tip-wrap', opacity: 1,   // auto = left/right of the pin, so right-edge pins are not clipped
    });
    marker.on('click', () => { marker.closeTooltip(); onClick(s); });
    items.set(s.id, { pin: () => marker.getElement()?.querySelector('.pin'), fan });
  }
  const fit = () => {
    map.invalidateSize();
    map.fitBounds(spots.map(s => [s.lat, s.lng]), { paddingTopLeft: [90, 70], paddingBottomRight: [70, 150] });
  };
  fit();
  window.addEventListener('resize', fit);
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

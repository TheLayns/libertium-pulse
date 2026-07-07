// =====================================================================
// Carte du réseau.
//  - Leaflet en instance PERSISTANTE (créée une fois, mise à jour ensuite)
//  - au chargement : cadrée sur la France entière (fitBounds des points)
//    et bornée (maxBounds) — fini la vue « toute l'Europe »
//  - paires quasi-superposées (Nantes/Nantes Nord…) : écartement
//    déterministe à l'affichage, les coordonnées réelles ne changent pas
//  - repli : carte de France SVG auto-contenue (hors ligne / pas de Leaflet)
// =====================================================================
import { esc, cap, shortName } from './util.js';
import { SVG_CITIES } from './config.js';
import { FR_OUTLINE } from './fr-outline.js';

let _map = null, _markers = null, _mapEl = null, _tileErr = false;

// Écartement des points trop proches (< ~900 m) — calculé une fois
const _displaced = new Map();
export function displayCoords(concessions){
  if (_displaced.size) return _displaced;
  const done = new Set();
  const TH = 0.012; // ~1 km en latitude
  concessions.forEach((a, i) => {
    if (typeof a.lat !== 'number') return;
    const group = [a];
    concessions.forEach((b, j) => {
      if (j <= i || done.has(b.id) || typeof b.lat !== 'number') return;
      if (Math.abs(a.lat - b.lat) < TH && Math.abs(a.lng - b.lng) < TH) group.push(b);
    });
    if (group.length > 1) {
      group.forEach((c, gi) => {
        const ang = 2 * Math.PI * gi / group.length;
        _displaced.set(c.id, { lat: c.lat + Math.sin(ang) * 0.014, lng: c.lng + Math.cos(ang) * 0.02 });
        done.add(c.id);
      });
    } else if (!done.has(a.id)) {
      _displaced.set(a.id, { lat: a.lat, lng: a.lng });
      done.add(a.id);
    }
  });
  return _displaced;
}

export const leafletAvailable = () => typeof L !== 'undefined';

export function destroyMap(){
  if (_map) { _map.remove(); _map = null; _markers = null; _mapEl = null; }
}

// ctx : {concessions, colorOf(c), tooltipOf(c), onClick(c), focusId, dimOf(c)}
export function mountMap(slot, ctx){
  if (!slot || !leafletAvailable()) return false;
  const coords = displayCoords(ctx.allConcessions || ctx.concessions);

  if (!_mapEl || !document.body.contains(_mapEl)) {
    if (_map) { _map.remove(); _map = null; }
    _mapEl = document.createElement('div');
    _mapEl.style.height = '100%';
  }
  slot.appendChild(_mapEl);

  const pts = ctx.concessions.map(c => coords.get(c.id)).filter(Boolean).map(p => [p.lat, p.lng]);
  const bounds = pts.length ? L.latLngBounds(pts) : L.latLngBounds([[41.2, -5.2], [51.2, 9.7]]);

  let firstMount = false;
  if (!_map) {
    firstMount = true;
    _map = L.map(_mapEl, { zoomControl: true, attributionControl: false, scrollWheelZoom: false, center: [46.6, 2.3], zoom: 6, zoomSnap: 0.25 });
    const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 13 });
    tiles.on('tileerror', () => {
      if (!_tileErr) { _tileErr = true; document.getElementById('tile-error')?.classList.add('show'); }
    });
    tiles.addTo(_map);
    _markers = L.layerGroup().addTo(_map);
  }

  _markers.clearLayers();
  ctx.concessions.forEach(c => {
    const p = coords.get(c.id);
    if (!p) return;
    const dim = ctx.dimOf ? ctx.dimOf(c) : false;
    const mk = L.circleMarker([p.lat, p.lng], {
      radius: ctx.focusId === c.id ? 10 : 7,
      color: '#fff', weight: 2,
      fillColor: ctx.colorOf(c), fillOpacity: dim ? 0.15 : 0.95, opacity: dim ? 0.2 : 1
    });
    mk.bindTooltip(ctx.tooltipOf(c), { direction: 'top', offset: [0, -6] });
    mk.on('click', () => ctx.onClick(c));
    mk.addTo(_markers);
  });

  requestAnimationFrame(() => {
    if (!_map) return;
    _map.invalidateSize();
    if (firstMount) {
      // Cadrage : la France entière (le conteneur a maintenant sa vraie taille),
      // et on ne peut pas s'en éloigner.
      const franceBounds = L.latLngBounds((ctx.allConcessions || ctx.concessions).map(c => coords.get(c.id)).filter(Boolean).map(p => [p.lat, p.lng]));
      _map.fitBounds(franceBounds.pad(0.08));
      _map.setMaxBounds(franceBounds.pad(0.45));
      _map.setMinZoom(_map.getBoundsZoom(franceBounds.pad(0.45)));
      // Directeur de BU : cadrer d'emblée sur ses concessions
      if (ctx.concessions.length < (ctx.allConcessions || ctx.concessions).length) _map.fitBounds(bounds.pad(0.2));
    }
    if (ctx.focusId) {
      const p = coords.get(ctx.focusId);
      if (p) _map.setView([p.lat, p.lng], Math.max(_map.getZoom(), 10));
    }
  });
  return true;
}

// ----- Carte SVG de secours (auto-contenue) -----
export function renderSvgMap(ctx){
  if (!FR_OUTLINE.length) return '<div class="map-offline"><span class="big">🗺️</span><b>Carte indisponible</b></div>';
  const coords = displayCoords(ctx.allConcessions || ctx.concessions);
  const all = FR_OUTLINE.flat();
  let minLng = 99, maxLng = -99, minLat = 99, maxLat = -99;
  all.forEach(([x, y]) => { if (x < minLng) minLng = x; if (x > maxLng) maxLng = x; if (y < minLat) minLat = y; if (y > maxLat) maxLat = y; });
  const pad = 0.35; minLng -= pad; maxLng += pad; minLat -= pad; maxLat += pad;
  const cosF = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  const W = 860, k = W / ((maxLng - minLng) * cosF), H = Math.round((maxLat - minLat) * k);
  const px = lng => (lng - minLng) * cosF * k, py = lat => (maxLat - lat) * k;
  let s = '<div class="svgmap-wrap"><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Carte de France des concessions">';
  s += FR_OUTLINE.map(ring => '<path d="M' + ring.map(([x, y]) => px(x).toFixed(1) + ' ' + py(y).toFixed(1)).join('L') + 'Z" fill="#f8f9fa" stroke="#d0d6db" stroke-width="1.2"/>').join('');
  SVG_CITIES.forEach(([name, lat, lng]) => {
    s += '<circle cx="' + px(lng).toFixed(1) + '" cy="' + py(lat).toFixed(1) + '" r="1.8" fill="#9ca3af"/>'
      + '<text x="' + (px(lng) + 5).toFixed(1) + '" y="' + (py(lat) + 3.5).toFixed(1) + '" font-size="11" fill="#9ca3af">' + name + '</text>';
  });
  ctx.concessions.forEach(c => {
    const p = coords.get(c.id);
    if (!p) return;
    const dim = ctx.dimOf ? ctx.dimOf(c) : false;
    const focus = ctx.focusId === c.id;
    const x = px(p.lng).toFixed(1), y = py(p.lat).toFixed(1);
    s += '<circle cx="' + x + '" cy="' + y + '" r="' + (focus ? 10 : 6.5) + '" fill="' + ctx.colorOf(c) + '" stroke="' + (focus ? '#253746' : '#fff') + '" stroke-width="2" opacity="' + (dim ? 0.18 : 0.95) + '"/>'
      + '<circle cx="' + x + '" cy="' + y + '" r="13" fill="transparent" style="cursor:pointer" tabindex="0" data-action="open-conc" data-id="' + esc(c.id) + '" data-tt="' + esc(cap(c.city)) + '" data-tt-name="' + esc(shortName(c.name)) + '" data-tt-val="' + esc(ctx.valueOf(c)) + '" data-tt-col="' + ctx.colorOf(c) + '"/>';
  });
  return s + '</svg></div>';
}

// =====================================================================
// Graphiques SVG maison (repris de la v1) : sparklines, barres
// horizontales, lignes multi-séries + crosshair/tooltip.
// =====================================================================
import { esc, fmtK } from './util.js';

const chartReg = new Map();
let chartSeq = 0;
export function resetCharts(){ chartReg.clear(); }
export function niceMax(v){ if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10; return nf * p; }

export function svgSpark(values, { w = 150, h = 42, color = '#2E6FB0', min = null, max = null } = {}){
  values = values.filter(v => v != null);
  if (!values.length) return '';
  if (values.length === 1) values = [values[0], values[0]];
  const lo = min != null ? min : Math.min(...values), hi0 = max != null ? max : Math.max(...values);
  const hi = hi0 === lo ? lo + 1 : hi0;
  const px = i => 3 + i * (w - 10) / (values.length - 1);
  const py = v => h - 5 - (v - lo) / (hi - lo) * (h - 12);
  const pts = values.map((v, i) => px(i).toFixed(1) + ',' + py(v).toFixed(1)).join(' ');
  const lastX = px(values.length - 1).toFixed(1), lastY = py(values[values.length - 1]).toFixed(1);
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none" aria-hidden="true">'
    + '<polygon points="' + px(0).toFixed(1) + ',' + (h - 3) + ' ' + pts + ' ' + lastX + ',' + (h - 3) + '" fill="' + color + '" fill-opacity="0.1"/>'
    + '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>'
    + '<circle cx="' + lastX + '" cy="' + lastY + '" r="4" fill="' + color + '" stroke="#fff" stroke-width="2"/>'
    + '</svg>';
}

export function svgHBars(items, { fmt = fmtK, max = null, domainMin = 0, ttTitle = '' } = {}){
  const rowH = 26, barH = 17, labelW = 128, valW = 64, W = 560;
  const H = items.length * rowH + 6;
  const hi = max != null ? max : niceMax(Math.max(...items.map(i => i.value)));
  const plotW = W - labelW - valW - 14;
  const id = 'ch' + (++chartSeq);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" data-chart="' + id + '" role="img">';
  items.forEach((it, i) => {
    const y = 3 + i * rowH, bw = Math.max(2, (it.value - domainMin) / (hi - domainMin) * plotW);
    const r = Math.min(4, bw);
    s += '<text x="' + (labelW - 8) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" font-size="11.5" fill="#6b7280" font-weight="600">' + esc(it.label) + '</text>';
    s += '<path d="M' + labelW + ' ' + y + ' h' + (bw - r) + ' q' + r + ' 0 ' + r + ' ' + r + ' v' + (barH - 2 * r) + ' q0 ' + r + ' -' + r + ' ' + r + ' h-' + (bw - r) + ' z" fill="' + it.color + '"/>';
    s += '<text x="' + (labelW + bw + 7) + '" y="' + (y + barH / 2 + 4) + '" font-size="11.5" fill="#253746" font-weight="700" style="font-variant-numeric:tabular-nums">' + esc(fmt(it.value)) + '</text>';
    s += '<rect x="0" y="' + (y - 2) + '" width="' + W + '" height="' + rowH + '" fill="transparent" data-tt="' + esc(ttTitle || '') + '" data-tt-name="' + esc(it.label) + '" data-tt-val="' + esc(fmt(it.value)) + '" data-tt-col="' + it.color + '" tabindex="0"/>';
  });
  return s + '</svg>';
}

export function svgMultiLine(series, labels, { fmt = fmtK, h = 250, area = false } = {}){
  const W = 720, H = h, ml = 52, mr = 14, mt = 12, mb = 26;
  const pw = W - ml - mr, ph = H - mt - mb;
  const all = series.flatMap(s => s.values.filter(v => v != null));
  if (!all.length) return '<div class="card-sub">Aucune donnée sur la période.</div>';
  const hi = niceMax(Math.max(...all)), lo = 0;
  const px = i => ml + i * pw / Math.max(1, labels.length - 1);
  const py = v => mt + ph - (v - lo) / (hi - lo) * ph;
  const id = 'ch' + (++chartSeq);
  chartReg.set(id, { type: 'line', series, labels, fmt, px: [...labels.keys()].map(px), ml, mr, mt, ph, W, H });
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" data-chart="' + id + '" role="img">';
  for (let t = 0; t <= 4; t++) {
    const v = lo + (hi - lo) * t / 4, y = py(v);
    s += '<line x1="' + ml + '" y1="' + y + '" x2="' + (W - mr) + '" y2="' + y + '" stroke="#eceef1" stroke-width="1"/>';
    s += '<text x="' + (ml - 8) + '" y="' + (y + 3.5) + '" text-anchor="end" font-size="10.5" fill="#9ca3af" style="font-variant-numeric:tabular-nums">' + fmt(v) + '</text>';
  }
  labels.forEach((lb, i) => {
    if (labels.length <= 12 || i % 2 === 0)
      s += '<text x="' + px(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="#9ca3af">' + esc(lb) + '</text>';
  });
  series.forEach(se => {
    const pts = se.values.map((v, i) => v == null ? null : px(i).toFixed(1) + ',' + py(v).toFixed(1)).filter(Boolean).join(' ');
    if (!pts) return;
    if (area) s += '<polygon points="' + px(0).toFixed(1) + ',' + (mt + ph) + ' ' + pts + ' ' + px(se.values.length - 1).toFixed(1) + ',' + (mt + ph) + '" fill="' + se.color + '" fill-opacity="0.1"/>';
    s += '<polyline points="' + pts + '" fill="none" stroke="' + se.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    for (let li = se.values.length - 1; li >= 0; li--) if (se.values[li] != null) {
      s += '<circle cx="' + px(li).toFixed(1) + '" cy="' + py(se.values[li]).toFixed(1) + '" r="3.5" fill="' + se.color + '" stroke="#fff" stroke-width="2"/>';
      break;
    }
  });
  s += '<line class="xhair" x1="0" y1="' + mt + '" x2="0" y2="' + (mt + ph) + '" stroke="#c0c5cc" stroke-width="1" visibility="hidden"/>';
  s += '<rect class="hitzone" x="' + ml + '" y="' + mt + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>';
  return s + '</svg>';
}

export function legendHtml(series){
  return '<div class="legend">' + series.map(s => '<span class="li"><span class="key" style="background:' + s.color + '"></span>' + esc(s.name) + '</span>').join('') + '</div>';
}
export function dataTableHtml(series, labels, fmt){
  let t = '<details class="data-table"><summary>Voir les données</summary><div class="dt-wrap"><table class="dt"><thead><tr><th>Période</th>';
  series.forEach(s => { t += '<th>' + esc(s.name) + '</th>'; });
  t += '</tr></thead><tbody>';
  labels.forEach((lb, i) => {
    t += '<tr><td>' + esc(lb) + '</td>';
    series.forEach(s => { t += '<td>' + (s.values[i] == null ? '—' : esc(fmt(s.values[i]))) + '</td>'; });
    t += '</tr>';
  });
  return t + '</tbody></table></div></details>';
}

// ----- Tooltip global (une seule installation) -----
let installed = false;
export function installTooltip(){
  if (installed) return;
  installed = true;
  const ttEl = document.getElementById('tooltip');
  const show = (x, y) => { ttEl.style.display = 'block'; const r = ttEl.getBoundingClientRect();
    ttEl.style.left = Math.min(x + 14, innerWidth - r.width - 10) + 'px';
    ttEl.style.top = Math.min(y + 14, innerHeight - r.height - 10) + 'px'; };
  const hide = () => { ttEl.style.display = 'none'; };
  const row = (name, val, col) => {
    const r = document.createElement('div'); r.className = 'tt-row';
    const k = document.createElement('span'); k.className = 'tt-key'; k.style.background = col;
    const n = document.createElement('span'); n.className = 'tt-name'; n.textContent = name;
    const v = document.createElement('span'); v.className = 'tt-val'; v.textContent = val;
    r.append(k, n, v); return r;
  };
  document.addEventListener('pointermove', e => {
    const bar = e.target.closest?.('[data-tt-name]');
    if (bar) {
      ttEl.replaceChildren();
      if (bar.dataset.tt) { const d = document.createElement('div'); d.className = 'tt-title'; d.textContent = bar.dataset.tt; ttEl.appendChild(d); }
      ttEl.appendChild(row(bar.dataset.ttName, bar.dataset.ttVal, bar.dataset.ttCol));
      show(e.clientX, e.clientY); return;
    }
    const svg = e.target.closest?.('svg[data-chart]');
    const cfg = svg && chartReg.get(svg.dataset.chart);
    if (cfg && cfg.type === 'line') {
      const rect = svg.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * cfg.W / rect.width;
      const xh = svg.querySelector('.xhair');
      if (sx < cfg.ml - 6 || sx > cfg.W - cfg.mr + 6) { hide(); xh.setAttribute('visibility', 'hidden'); return; }
      let bi = 0, bd = 1e9; cfg.px.forEach((x, i) => { const d = Math.abs(x - sx); if (d < bd) { bd = d; bi = i; } });
      xh.setAttribute('x1', cfg.px[bi]); xh.setAttribute('x2', cfg.px[bi]); xh.setAttribute('visibility', 'visible');
      ttEl.replaceChildren();
      const ti = document.createElement('div'); ti.className = 'tt-title'; ti.textContent = cfg.labels[bi]; ttEl.appendChild(ti);
      [...cfg.series].filter(s => s.values[bi] != null).sort((a, b) => b.values[bi] - a.values[bi])
        .forEach(s => ttEl.appendChild(row(s.name, cfg.fmt(s.values[bi]), s.color)));
      show(e.clientX, e.clientY); return;
    }
    hide();
    document.querySelectorAll('svg[data-chart] .xhair').forEach(x => x.setAttribute('visibility', 'hidden'));
  });
  document.addEventListener('focusin', e => {
    const bar = e.target.closest?.('[data-tt-name]');
    if (bar) { const r = bar.getBoundingClientRect();
      ttEl.replaceChildren();
      ttEl.appendChild(row(bar.dataset.ttName, bar.dataset.ttVal, bar.dataset.ttCol));
      show(r.left + r.width / 2, r.top); }
  });
  document.addEventListener('focusout', hide);
}

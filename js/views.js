// =====================================================================
// Vues principales : login, topbar/subbar, dashboard, détail BU, drawer,
// popovers, toast. HTML en chaînes + délégation d'événements (app.js).
// =====================================================================
import { state } from './state.js';
import { IS_DEMO, BU_ORDER, BU_COLORS, CHANNELS, PILLAR_LABEL, PILLAR_LABEL_LC, monthShort, monthShortYear, monthLabel, seasonLabel } from './config.js';
import { esc, fmtInt, fmtK, fmt1, fmt2, fmtPct, cap, shortName } from './util.js';
import * as MET from './metrics.js';
import { currentMonths, previousMonths, periodTitle, prevShortLabel, sparkMonths, seasonsAvailable } from './period.js';
import { svgSpark, svgHBars, svgMultiLine, legendHtml, dataTableHtml } from './charts.js';
import { renderSvgMap, leafletAvailable } from './map.js';

// ----- petits composants -----
export const statusChip = st => '<span class="status-chip st-' + st.key + '"><span class="ic">' + st.ic + '</span>' + st.label + '</span>';
export const buChip = (bu, extra) => '<span class="bu-chip' + (extra || '') + '"><span class="dot" style="background:' + BU_COLORS[bu].brand + '"></span>' + esc(bu) + '</span>';
export const scorePill = score => { const st = MET.statusOf(score); return '<span class="score-pill" style="background:' + st.bg + ';color:' + st.text + '">' + score + '</span>'; };
export const covBadge = c => !c || c.have >= c.of ? '' :
  '<span class="cov-badge warn" title="Concessions avec données / concessions équipées">' + c.have + '/' + c.of + ' concessions</span>';

function deltaHtml(cur, prev, mode){
  if (cur == null || prev == null) return '<span class="t-delta delta-flat">—</span>';
  let d, txt;
  if (mode === 'pct') { d = prev === 0 ? 0 : (cur - prev) / prev * 100; txt = (d > 0 ? '+' : '') + d.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %'; }
  else if (mode === 'pts1') { d = cur - prev; txt = (d > 0 ? '+' : '') + d.toLocaleString('fr-FR', { maximumFractionDigits: 1 }); }
  else { d = cur - prev; txt = (d > 0 ? '+' : '') + Math.round(d) + ' pt' + (Math.abs(Math.round(d)) > 1 ? 's' : ''); }
  const flat = Math.abs(d) < 0.05;
  const cls = flat ? 'delta-flat' : (d > 0 ? 'delta-up' : 'delta-down');
  const arr = flat ? '→' : (d > 0 ? '▲' : '▼');
  if (flat) txt = 'stable';
  return '<span class="t-delta ' + cls + '">' + arr + ' ' + txt + ' <span class="vs">vs ' + esc(prevShortLabel()) + '</span></span>';
}

const visibleBus = () => state.profile.role === 'directeur_bu' ? [state.profile.bu] : BU_ORDER.filter(b => MET.BUS.some(x => x.bu === b));
const visibleConcs = () => state.profile.role === 'directeur_bu' ? MET.CONCESSIONS.filter(c => c.bu === state.profile.bu) : MET.CONCESSIONS;
export { visibleBus, visibleConcs };

// ----- Login -----
export function renderLogin(){
  const l = state.login;
  let inner = '';
  if (IS_DEMO) {
    inner = '<div class="login-card">'
      + '<h3>Mode démo</h3>'
      + '<p>Aucun backend configuré : les données sont fictives et les profils simulés. En production, l’accès est déterminé automatiquement par votre adresse e-mail — sans choix de profil.</p>'
      + '<div class="demo-roles">'
      + '<button class="demo-role" data-action="demo-login" data-role="admin"><span class="dot" style="background:var(--rouge)"></span>Admin (gère les accès et les imports)</button>'
      + '<button class="demo-role" data-action="demo-login" data-role="direction"><span class="dot" style="background:#1F3A8A"></span>Direction — vision globale</button>'
      + BU_ORDER.map(bu => '<button class="demo-role" data-action="demo-login" data-role="directeur_bu" data-bu="' + esc(bu) + '"><span class="dot" style="background:' + BU_COLORS[bu].brand + '"></span>Directeur ' + esc(bu) + '</button>').join('')
      + '</div></div>';
  } else if (l.sent) {
    inner = '<div class="login-card">'
      + '<h3>Vérifiez votre boîte mail</h3>'
      + '<div class="login-ok">Un lien de connexion a été envoyé à <b>' + esc(l.email) + '</b>.</div>'
      + '<p>Cliquez sur le lien dans l’e-mail, ou saisissez le code à 6 chiffres qu’il contient :</p>'
      + '<div class="field"><label>Code à 6 chiffres</label><input id="otp-input" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code"></div>'
      + (l.error ? '<div class="login-err">' + esc(l.error) + '</div>' : '')
      + '<button class="btn-red full" data-action="verify-otp"' + (l.busy ? ' disabled' : '') + '>Valider le code</button>'
      + '<button class="btn-ghost" data-action="login-restart">Utiliser une autre adresse</button>'
      + '</div>';
  } else {
    inner = '<div class="login-card">'
      + '<h3>Connexion</h3>'
      + '<p>Saisissez votre adresse e-mail professionnelle. Votre accès (Direction ou votre business unit) est déterminé automatiquement.</p>'
      + '<div class="field"><label>Adresse e-mail</label><input id="email-input" type="email" placeholder="prenom.nom@libertium.fr" value="' + esc(l.email) + '"></div>'
      + (l.error ? '<div class="login-err">' + esc(l.error) + '</div>' : '')
      + '<button class="btn-red full" data-action="send-link"' + (l.busy ? ' disabled' : '') + '>' + (l.busy ? 'Envoi…' : 'Recevoir le lien de connexion') + '</button>'
      + '</div>';
  }
  return '<div class="login">'
    + '<div style="text-align:center"><div class="p-logo">LIBERTIUM <span>pulse</span></div>'
    + '<p class="p-sub" style="margin-top:8px">Santé digitale du réseau · 67 concessions · 7 business units</p></div>'
    + inner
    + '<p style="font-size:11.5px;color:var(--muted2)">Meta · Google Analytics 4 · Google Business Profile · Leboncoin</p>'
    + '</div>';
}

// ----- Topbar / Subbar -----
export function renderTopbar(){
  const p = state.profile;
  const badge = p.role === 'directeur_bu'
    ? '<span class="role-badge"><span class="dot" style="background:' + BU_COLORS[p.bu].brand + '"></span>Directeur ' + esc(p.bu) + '</span>'
    : '<span class="role-badge"><span class="dot"></span>' + (p.role === 'admin' ? 'Admin · vision globale' : 'Direction · vision globale') + '</span>';
  return (IS_DEMO ? '<div class="demo-banner"><b>MODE DÉMO</b> — données fictives, profils simulés (en production : accès automatique par e-mail)</div>' : '')
    + '<header class="topbar"><div class="topbar-inner">'
    + '<div class="logo">LIBERTIUM <span>pulse</span></div>' + badge
    + '<span class="spacer"></span>'
    + (p.role === 'admin' ? '<button class="tb-btn primary" data-action="open-admin">⚙ Administration</button>' : '')
    + (state.view !== 'dashboard' ? '<button class="tb-btn" data-action="back-dashboard">Tableau de bord</button>' : '')
    + '<button class="tb-btn" data-action="logout">' + (IS_DEMO ? 'Changer de profil (démo)' : 'Déconnexion') + '</button>'
    + '</div></header>';
}

export function renderSubbar(){
  const mode = state.timeMode;
  let pills = '';
  if (mode === 'month') {
    const ms = MET.MONTHS;
    const i = ms.indexOf(state.monthIso);
    pills = '<span style="display:inline-flex;gap:4px">'
      + '<button class="month-nav" data-action="time-prev" title="Mois précédent"' + (i <= 0 ? ' disabled' : '') + '>‹</button>'
      + '<button class="month-nav" data-action="time-next" title="Mois suivant"' + (i >= ms.length - 1 ? ' disabled' : '') + '>›</button></span>'
      + '<div class="month-pills">' + ms.map((m, j) =>
        '<button class="mpill' + (m === state.monthIso ? ' active' : '') + (j < ms.length - 13 ? ' faint' : '') + '" data-action="month-set" data-m="' + m + '">' + monthShortYear(m) + '</button>').join('') + '</div>';
  } else {
    pills = '<div class="month-pills">' + seasonsAvailable().map(s =>
      '<button class="mpill' + (s === state.seasonYear ? ' active' : '') + '" data-action="season-set" data-s="' + s + '">' + seasonLabel(s) + '</button>').join('') + '</div>';
  }
  return '<div class="subbar"><div class="subbar-inner">'
    + '<span class="lbl">Période</span>'
    + '<div class="seg"><button class="' + (mode === 'month' ? 'on' : '') + '" data-action="time-mode" data-mode="month">Mois</button>'
    + '<button class="' + (mode === 'season' ? 'on' : '') + '" data-action="time-mode" data-mode="season">Saison</button></div>'
    + pills
    + '<span class="cur-month">' + esc(periodTitle()) + '</span>'
    + '</div></div>';
}

// ----- KPI -----
function kpiRow(agg, prev, sparkVals, scopeName){
  const st = MET.statusOf(agg.score);
  let h = '<div class="grid-kpi">';
  h += '<div class="tile hero-tile" style="border-top:3px solid ' + st.solid + '">'
    + '<div class="t-label">Score de santé — ' + esc(scopeName) + (agg.partial ? ' <span class="cov-badge warn">données partielles</span>' : '') + '</div>'
    + '<div><span class="hero-score" style="color:' + st.solid + '">' + agg.score + '</span><span class="hero-den"> /100</span></div>'
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' + statusChip(st)
    + deltaHtml(agg.score, prev?.score, 'pts0') + '</div>'
    + '<div class="spark">' + svgSpark(sparkVals, { color: st.solid, min: 0, max: 100, h: 40 }) + '</div>'
    + '</div>';

  const p = agg.pillars, pp = prev?.pillars;
  const tile = (label, infoCh, value, sub, delta, spark) =>
    '<div class="tile"><div class="t-label">' + label + ' <button class="info-btn" data-action="src-pop" data-ch="' + infoCh + '">i</button></div>'
    + '<div class="t-value">' + value + '</div>'
    + (sub ? '<div class="t-sub">' + sub + '</div>' : '')
    + delta + '<div class="spark">' + spark + '</div></div>';

  const sm = sparkMonths();
  const sSeries = pk => sm.map(m => agg._monthly?.get(m)?.[pk] ?? null);

  h += tile('Réseaux sociaux', 'fb',
    p.rs.hasData ? Math.round(p.rs.score) + '<span style="font-size:15px;color:var(--muted2)">/100</span>' : '—',
    [p.rs.engFb != null ? 'FB ' + fmtPct(p.rs.engFb) : null, p.rs.engIg != null ? 'IG ' + fmtPct(p.rs.engIg) : null].filter(Boolean).join(' · ') || 'aucun compte équipé',
    deltaHtml(p.rs.score, pp?.rs.score, 'pts0'),
    svgSpark(sSeries('rs'), { color: '#8893a4', h: 34 }));
  h += tile('Sessions site', 'ga4',
    p.ga4.hasData ? fmtK(p.ga4.sessions) : '—',
    p.ga4.sessionsAvg != null ? 'moyenne ' + fmtInt(p.ga4.sessionsAvg) + ' / concession' : '',
    deltaHtml(p.ga4.sessions, pp?.ga4.sessions, 'pct'),
    svgSpark(sSeries('ga4v'), { color: '#8893a4', h: 34 }));
  h += tile('Note Google', 'gmb',
    p.gmb.hasData ? fmt1(p.gmb.rating) + ' ★' : '—',
    p.gmb.revNew != null ? '+' + fmtInt(p.gmb.revNew) + ' avis sur la période' : '',
    deltaHtml(p.gmb.rating, pp?.gmb.rating, 'pts1'),
    svgSpark(sSeries('gmbv'), { color: '#8893a4', h: 34 }));
  h += tile('Leboncoin', 'lbc',
    p.lbc.hasData ? fmtK(p.lbc.views) + '<span style="font-size:13px;color:var(--muted2)"> vues</span>' : '—',
    p.lbc.leads != null ? fmtInt(p.lbc.leads) + ' contacts' : '',
    deltaHtml(p.lbc.views, pp?.lbc.views, 'pct'),
    svgSpark(sSeries('lbcv'), { color: '#8893a4', h: 34 }));
  return h + '</div>';
}

// Pré-calcule les mini-séries mensuelles pour les sparklines des tuiles
function withMonthly(aggFn, agg){
  const map = new Map();
  sparkMonths().forEach(m => {
    const a = aggFn([m]);
    map.set(m, {
      score: a.score,
      rs: a.pillars.rs.score, ga4: a.pillars.ga4.score, gmb: a.pillars.gmb.score, lbc: a.pillars.lbc.score,
      ga4v: a.pillars.ga4.sessions ?? null, gmbv: a.pillars.gmb.rating ?? null, lbcv: a.pillars.lbc.views ?? null
    });
  });
  agg._monthly = map;
  return agg;
}

// ----- Bloc compte national (Direction / Admin uniquement) -----
function nationalBlock(){
  const nat = MET.periodNational(currentMonths());
  if (!nat) return '';
  const prevM = previousMonths();
  const prev = prevM ? MET.periodNational(prevM) : null;
  const tile = (pf, d, pd) => {
    if (!d) return '';
    return '<div class="nat-tile"><span class="pf">' + pf + '</span>'
      + '<span class="v">' + fmtK(d.followers) + ' <span style="font-size:12px;color:var(--muted2);font-weight:600">abonnés</span></span>'
      + '<span class="d">' + deltaHtml(d.followers, pd?.followers, 'pct') + '</span>'
      + '<span style="font-size:11.5px;color:var(--muted)">Portée ' + fmtK(d.reach) + ' · engagement ' + (d.eng != null ? fmtPct(d.eng) : '—') + '</span>'
      + '</div>';
  };
  return '<section class="card national-card"><div class="card-title">Comptes nationaux — Libertium France</div>'
    + '<div class="card-sub">Facebook & Instagram nationaux · visibles uniquement en vision globale · hors score des BU</div>'
    + '<div class="nat-grid">' + tile('Facebook national', nat.fb, prev?.fb) + tile('Instagram national', nat.ig, prev?.ig) + '</div>'
    + '</section>';
}

// ----- Alertes -----
function alertsSection(alerts){
  let h = '<section class="card"><div class="card-title">Alertes automatiques</div>'
    + '<div class="card-sub">' + (alerts.length ? alerts.length + (alerts.length > 1 ? ' signaux détectés' : ' signal détecté') + ' pour ' + esc(periodTitle()) : 'Analyse de ' + esc(periodTitle())) + '</div>';
  if (!alerts.length) {
    h += '<div class="alert-ok">✓ Aucune alerte — toutes les business units visibles sont au-dessus du seuil de vigilance.</div>';
  } else {
    h += '<div class="alerts-wrap">' + alerts.map(a =>
      '<div class="alert ' + a.level + '">'
      + '<span class="a-ic">' + (a.level === 'red' ? '⛔' : '⚠️') + '</span>'
      + '<div style="flex:1"><div class="a-title">' + esc(a.title) + '</div>'
      + '<div class="a-detail">' + esc(a.detail) + '</div>'
      + '<div class="a-metric">Métrique : ' + esc(a.metric) + '</div></div>'
      + '<button class="bu-chip click" data-action="open-bu" data-bu="' + esc(a.bu) + '"><span class="dot" style="background:' + BU_COLORS[a.bu].brand + '"></span>' + esc(a.bu) + '</button>'
      + '</div>').join('') + '</div>';
  }
  return h + '</section>';
}

// ----- Carte -----
function mapSection(){
  const concs = visibleConcs();
  const isGlobal = state.profile.role !== 'directeur_bu';
  let h = '<section class="card map-card"><div class="map-head">'
    + '<div><div class="card-title">Carte du réseau</div>'
    + '<div class="card-sub" style="margin:0">' + concs.length + ' concession' + (concs.length > 1 ? 's' : '') + ' · cliquez sur un point pour ouvrir le détail</div></div>'
    + '<div class="grow"></div>'
    + '<div class="seg"><button class="' + (state.mapMode === 'bu' ? 'on' : '') + '" data-action="map-mode" data-mode="bu">Couleur : BU</button>'
    + '<button class="' + (state.mapMode === 'sante' ? 'on' : '') + '" data-action="map-mode" data-mode="sante">Couleur : santé</button></div>'
    + '</div>';
  const months = currentMonths();
  // Colonne latérale : légende BU cliquable avec score, ou légende santé
  let side = '';
  if (state.mapMode === 'bu') {
    side = '<div class="side-t">Business units</div>' + visibleBus().map(bu => {
      const dim = state.mapFilterBu && state.mapFilterBu !== bu;
      const b = MET.BUS.find(x => x.bu === bu);
      const sc = MET.periodBu(bu, months).score;
      const st = sc != null ? MET.statusOf(sc) : null;
      return '<button class="bu-line' + (dim ? ' dim' : '') + '" data-action="legend-bu" data-bu="' + esc(bu) + '">'
        + '<span class="dot" style="background:' + BU_COLORS[bu].marker + '"></span>' + esc(bu)
        + '<span class="n">' + (b?.concs.length || 0) + ' conc.</span>'
        + (st ? '<span class="sc" style="color:' + st.solid + '">' + sc + '</span>' : '') + '</button>';
    }).join('')
    + (state.mapFilterBu ? '<button class="bu-chip click" data-action="legend-bu" data-bu="">✕ Tout afficher</button>' : '');
  } else {
    const counts = { green: 0, orange: 0, red: 0 };
    visibleConcs().forEach(c => { const s = MET.periodConc(c.id, months).score; if (s != null) counts[MET.statusOf(s).key]++; });
    side = '<div class="side-t">Santé des concessions</div>'
      + '<span class="bu-chip"><span class="dot" style="background:#1aa053"></span>Bonne santé (≥ 70) · ' + counts.green + '</span>'
      + '<span class="bu-chip"><span class="dot" style="background:#e8870f"></span>À surveiller (50–69) · ' + counts.orange + '</span>'
      + '<span class="bu-chip"><span class="dot" style="background:#e0413a"></span>Alerte (&lt; 50) · ' + counts.red + '</span>';
  }
  if (leafletAvailable()) {
    h += '<div class="map-flex"><div id="map-slot"></div><div class="map-side">' + side + '</div></div>'
      + '<div class="tile-error-note" id="tile-error">Fonds de carte inaccessibles (connexion limitée) — les points restent affichés.</div>';
  } else {
    h += '<div class="map-flex"><div style="flex:1 1 440px;max-width:600px">' + renderSvgMap(svgMapCtx()) + '</div><div class="map-side">' + side + '</div></div>'
      + '<div class="tile-error-note show">Fond de carte simplifié (bibliothèque cartographique indisponible).</div>';
  }
  return h + '</section>';
}

export function mapCtx(){
  const months = currentMonths();
  return {
    allConcessions: MET.CONCESSIONS,
    concessions: visibleConcs(),
    colorOf: c => state.mapMode === 'sante'
      ? MET.statusOf(MET.periodConc(c.id, months).score ?? 0).solid
      : BU_COLORS[c.bu].marker,
    dimOf: c => state.mapFilterBu && c.bu !== state.mapFilterBu,
    tooltipOf: c => {
      const s = MET.periodConc(c.id, months).score;
      return '<b>' + esc(shortName(c.name)) + '</b><br>' + esc(cap(c.city)) + (s != null ? ' · score ' + s + '/100' : '');
    },
    valueOf: c => { const s = MET.periodConc(c.id, months).score; return s != null ? s + '/100' : '—'; },
    focusId: state.focusConc,
    fit: false
  };
}
const svgMapCtx = mapCtx;

// ----- Grille BU (vision globale) -----
function buGrid(){
  const months = currentMonths(), prevM = previousMonths();
  const sm = sparkMonths();
  return '<section><div class="grid-bu">' + visibleBus().map(bu => {
    const agg = MET.periodBu(bu, months);
    const prev = prevM ? MET.periodBu(bu, prevM) : null;
    if (agg.score == null) return '';
    const st = MET.statusOf(agg.score);
    const sparkVals = sm.map(m => MET.periodBu(bu, [m]).score);
    const d = prev && prev.score != null ? agg.score - prev.score : null;
    const dCls = d == null || d === 0 ? 'delta-flat' : (d > 0 ? 'delta-up' : 'delta-down');
    return '<button class="bu-card" data-action="open-bu" data-bu="' + esc(bu) + '">'
      + '<div class="h"><span class="dot" style="background:' + BU_COLORS[bu].brand + '"></span><span class="name">' + esc(bu) + '</span><span class="n">' + agg.n + ' conc.' + (agg.partial ? ' ·⚠' : '') + '</span></div>'
      + '<div class="score-row"><span class="sc" style="color:' + st.solid + '">' + agg.score + '</span><span class="sc-den">/100</span>'
      + '<span class="dl ' + dCls + '">' + (d == null ? '—' : (d > 0 ? '▲ +' : d < 0 ? '▼ ' : '→ ') + d) + '</span></div>'
      + statusChip(st)
      + svgSpark(sparkVals, { color: st.solid, min: 0, max: 100, h: 36 })
      + '<div class="foot"><span class="see">Voir le détail →</span></div>'
      + '</button>';
  }).join('') + '</div></section>';
}

// ----- Graphiques -----
function chartsSection(){
  const months = currentMonths();
  const sm = sparkMonths();
  const labels = sm.map(monthShortYear);
  const isGlobal = state.profile.role !== 'directeur_bu';
  let h = '<div class="grid-charts">';

  if (isGlobal) {
    const series = visibleBus().map(bu => ({
      name: bu, color: BU_COLORS[bu].chart,
      values: sm.map(m => { const r = MET.periodBu(bu, [m]).pillars.rs.reach; return r || null; })
    })).filter(s => s.values.some(v => v != null));
    h += '<section class="card chart-card"><div class="card-title">Portée organique RS — évolution mensuelle</div>'
      + '<div class="card-sub">Facebook + Instagram · portée cumulée des comptes de chaque BU</div>'
      + '<div class="chart-svg-wrap">' + svgMultiLine(series, labels, { fmt: fmtK }) + '</div>'
      + legendHtml(series) + dataTableHtml(series, sm.map(monthLabel), fmtK)
      + '</section>';
  } else {
    const bu = state.profile.bu;
    const series = [{ name: bu, color: BU_COLORS[bu].chart, values: sm.map(m => MET.periodBu(bu, [m]).pillars.rs.reach || null) }];
    h += '<section class="card chart-card"><div class="card-title">Portée organique RS — évolution mensuelle</div>'
      + '<div class="card-sub">Facebook + Instagram · comptes des concessions de ' + esc(bu) + '</div>'
      + '<div class="chart-svg-wrap">' + svgMultiLine(series, labels, { fmt: fmtK, area: true }) + '</div>'
      + dataTableHtml(series, sm.map(monthLabel), fmtK)
      + '</section>';
  }

  const mkBars = (title, sub, getVal, fmt, opt = {}) => {
    let items;
    if (isGlobal) {
      items = visibleBus().map(bu => { const a = MET.periodBu(bu, months); const v = getVal(a); return v == null ? null : { label: bu, value: v, color: BU_COLORS[bu].chart, tip: periodTitle() }; }).filter(Boolean);
    } else {
      items = visibleConcs().map(c => { const a = MET.periodConc(c.id, months); const v = getVal(a); return v == null ? null : { label: shortName(c.name), value: v, color: BU_COLORS[state.profile.bu].chart, tip: periodTitle() }; }).filter(Boolean);
    }
    items.sort((a, b) => b.value - a.value);
    if (!items.length) return '';
    return '<section class="card chart-card"><div class="card-title">' + title + '</div>'
      + '<div class="card-sub">' + sub + '</div>'
      + '<div class="chart-svg-wrap">' + svgHBars(items, { fmt, ...opt }) + '</div>'
      + '</section>';
  };

  h += mkBars('Réseaux sociaux — score du pilier', 'FB + IG · engagement normalisé /100 — ' + esc(periodTitle()), a => a.pillars.rs.hasData ? Math.round(a.pillars.rs.score) : null, v => v + '/100', { max: 100 });
  h += mkBars('Trafic site web', 'GA4 · sessions moyennes par concession et par mois — ' + esc(periodTitle()), a => a.pillars.ga4.sessionsAvg ?? (a.pillars.ga4.hasData ? a.pillars.ga4.sessions : null), fmtK);
  h += mkBars('Note Google (GBP)', 'Note moyenne des fiches — ' + esc(periodTitle()) + ' · échelle 3 → 5', a => a.pillars.gmb.rating, fmt1, { max: 5, domainMin: 3 });
  return h + '</div>';
}

// ----- Diagnostic + tableau concessions -----
function diagSection(bu){
  const months = currentMonths(), prevM = previousMonths();
  const agg = MET.periodBu(bu, months);
  const prev = prevM ? MET.periodBu(bu, prevM) : null;
  if (agg.score == null) return '';
  const st = MET.statusOf(agg.score);
  const entries = Object.entries(agg.pillars).filter(([, p]) => p.exists && p.hasData).sort((a, b) => b[1].score - a[1].score);
  const forts = entries.filter(([, v]) => v.score >= 65), faibles = entries.filter(([, v]) => v.score < 50);
  const worst = entries[entries.length - 1];
  let summary = 'Le score de <b>' + esc(bu) + '</b> est de <b>' + agg.score + '/100</b> (' + st.label.toLowerCase() + ')';
  if (prev && prev.score != null) {
    const d = agg.score - prev.score;
    summary += d === 0 ? ', stable vs ' + esc(prevShortLabel()) : ', ' + (d > 0 ? 'en progression de ' + d : 'en recul de ' + Math.abs(d)) + ' point' + (Math.abs(d) > 1 ? 's' : '') + ' vs ' + esc(prevShortLabel());
  }
  summary += '. ';
  if (worst) summary += (st.key !== 'green' ? 'Le levier prioritaire est <b>' : 'Le point de vigilance relatif reste <b>') + PILLAR_LABEL_LC[worst[0]] + '</b> (' + Math.round(worst[1].score) + '/100).';
  const li = ([pk, p]) => {
    const d = prev && prev.pillars[pk]?.score != null ? Math.round(p.score - prev.pillars[pk].score) : null;
    return '<li><b>' + esc(PILLAR_LABEL[pk]) + '</b>' + (p.coverage && p.coverage.have < p.coverage.of ? ' ' + covBadge(p.coverage) : '')
      + (d != null && d !== 0 ? ' <span class="' + (d > 0 ? 'delta-up' : 'delta-down') + '" style="font-weight:700">' + (d > 0 ? '+' : '') + d + '</span>' : '')
      + '<span class="norm" style="color:' + (p.score >= 70 ? 'var(--green-text)' : p.score >= 50 ? 'var(--orange-text)' : 'var(--red-text)') + '">' + Math.round(p.score) + '/100</span></li>';
  };
  return '<section class="card"><div class="card-title">Diagnostic</div><div class="card-sub">Lecture automatique des 4 piliers — ' + esc(periodTitle()) + '</div>'
    + '<div class="diag"><div class="diag-summary">' + summary + '</div>'
    + '<div><h4>✅ Points forts</h4><ul>' + (forts.length ? forts.map(li).join('') : '<li style="color:var(--muted2)">Aucun pilier au-dessus de 65/100 sur la période.</li>') + '</ul></div>'
    + '<div><h4>🔻 Points faibles</h4><ul>' + (faibles.length ? faibles.map(li).join('') : '<li style="color:var(--muted2)">Aucun pilier sous 50/100 — rien de critique.</li>') + '</ul></div>'
    + '</div></section>';
}

function concTable(concs, title, sub){
  const months = currentMonths();
  const sm = sparkMonths();
  let h = '<section class="card"><div class="card-title">' + esc(title) + '</div><div class="card-sub">' + esc(sub) + '</div>'
    + '<div style="overflow-x:auto"><table class="conc-table"><thead><tr>'
    + '<th>Concession</th><th>Ville</th><th>RS</th><th>Score</th><th>Statut</th><th>Pilier le plus faible</th><th>Tendance</th></tr></thead><tbody>';
  concs.map(c => ({ c, a: MET.periodConc(c.id, months) }))
    .filter(x => x.a.score != null)
    .sort((x, y) => x.a.score - y.a.score)
    .forEach(({ c, a }) => {
      const st = MET.statusOf(a.score);
      const avail = Object.entries(a.pillars).filter(([, p]) => p.exists && p.hasData);
      const worst = avail.reduce((x, y) => (x[1].score <= y[1].score ? x : y));
      const spark = sm.map(m => MET.periodConc(c.id, [m]).score);
      const rsIcons = (a.pillars.rs.exists ? (MET.hasAccount('concession', c.id, 'fb') ? 'FB' : '') + (MET.hasAccount('concession', c.id, 'ig') ? ' IG' : '') : '—');
      h += '<tr class="row" data-action="open-conc" data-id="' + esc(c.id) + '">'
        + '<td style="font-weight:700">' + esc(shortName(c.name)) + '</td>'
        + '<td style="color:var(--muted)">' + esc(cap(c.city)) + '</td>'
        + '<td style="color:var(--muted2);font-size:10.5px;font-weight:700">' + rsIcons + '</td>'
        + '<td class="num">' + scorePill(a.score) + '</td>'
        + '<td>' + statusChip(st) + '</td>'
        + '<td style="color:var(--muted)">' + esc(PILLAR_LABEL[worst[0]]) + ' <span class="num" style="color:' + (worst[1].score < 50 ? 'var(--red-text)' : 'var(--muted2)') + '">' + Math.round(worst[1].score) + '/100</span></td>'
        + '<td style="width:110px">' + svgSpark(spark, { color: st.solid, min: 0, max: 100, h: 26, w: 100 }) + '</td>'
        + '</tr>';
    });
  return h + '</tbody></table></div></section>';
}

// ----- Dashboard -----
export function renderDashboard(){
  const months = currentMonths(), prevM = previousMonths();
  const isGlobal = state.profile.role !== 'directeur_bu';
  let agg, prev, scopeName;
  if (isGlobal) {
    agg = withMonthly(m => MET.periodNetwork(m), MET.periodNetwork(months));
    prev = prevM ? MET.periodNetwork(prevM) : null;
    scopeName = 'Réseau (' + agg.n + ' concessions)';
  } else {
    const bu = state.profile.bu;
    agg = withMonthly(m => MET.periodBu(bu, m), MET.periodBu(bu, months));
    prev = prevM ? MET.periodBu(bu, prevM) : null;
    scopeName = bu;
  }
  const sparkVals = sparkMonths().map(m => agg._monthly.get(m)?.score ?? null);
  const alerts = MET.computeAlerts(visibleBus(), months, prevM);

  let h = '<div class="main">';
  h += kpiRow(agg, prev, sparkVals, scopeName);
  if (isGlobal) h += nationalBlock();
  h += alertsSection(alerts);
  h += mapSection();
  if (isGlobal) h += buGrid();
  else {
    h += diagSection(state.profile.bu);
    h += concTable(visibleConcs(), 'Mes concessions — ' + state.profile.bu, 'Classées de la plus fragile à la plus solide · cliquez pour le détail');
  }
  h += chartsSection();
  h += '</div>';
  h += '<footer><span>Libertium Pulse v2' + (IS_DEMO ? ' · mode démo (données fictives)' : '') + '</span><span>Sources : Meta (FB + IG séparés) · GA4 · Google Business Profile · Leboncoin</span></footer>';
  return h;
}

// ----- Détail BU -----
export function renderBuDetail(){
  const bu = state.detailBu;
  const months = currentMonths(), prevM = previousMonths();
  const agg = MET.periodBu(bu, months);
  const prev = prevM ? MET.periodBu(bu, prevM) : null;
  const st = MET.statusOf(agg.score ?? 0);
  const sm = sparkMonths();
  let h = '<div class="main">';
  h += '<div><button class="crumb" data-action="back-dashboard">← Retour au tableau de bord</button></div>';
  h += '<section class="card"><div class="bu-head">'
    + '<span class="dot-lg" style="background:' + BU_COLORS[bu].brand + '"></span>'
    + '<div><h2>' + esc(bu) + '</h2><div class="meta">' + agg.n + ' concession' + (agg.n > 1 ? 's' : '') + ' · ' + esc(periodTitle()) + '</div></div>'
    + '<div class="right">' + statusChip(st)
    + deltaHtml(agg.score, prev?.score, 'pts0')
    + '<div class="hero-mini" style="color:' + st.solid + '">' + (agg.score ?? '—') + '<span class="den">/100</span></div></div>'
    + '</div>'
    + '<div style="margin-top:14px">' + svgSpark(sm.map(m => MET.periodBu(bu, [m]).score), { color: st.solid, min: 0, max: 100, h: 52, w: 600 }) + '</div>'
    + '<div class="card-sub" style="margin:6px 0 0">Tendance du score sur la fenêtre affichée</div>'
    + '</section>';

  // Cartes par pilier avec sparkline
  const p = agg.pillars, pp = prev?.pillars;
  const chCard = (label, ch, val, sub, dHtml, series, cov) => {
    return '<div class="tile"><div class="t-label">' + label + ' <button class="info-btn" data-action="src-pop" data-ch="' + ch + '">i</button>' + (cov ? ' ' + covBadge(cov) : '') + '</div>'
      + '<div class="t-value">' + val + '</div>' + (sub ? '<div class="t-sub">' + sub + '</div>' : '') + dHtml
      + '<div class="spark">' + svgSpark(series, { color: '#8893a4', h: 36 }) + '</div></div>';
  };
  const bm = pk => sm.map(m => { const a = MET.periodBu(bu, [m]); return pk(a); });
  h += '<div class="grid-ch">'
    + chCard('Réseaux sociaux', 'fb', p.rs.hasData ? Math.round(p.rs.score) + '/100' : '—',
        [p.rs.engFb != null ? 'FB ' + fmtPct(p.rs.engFb) : null, p.rs.engIg != null ? 'IG ' + fmtPct(p.rs.engIg) : null].filter(Boolean).join(' · '),
        deltaHtml(p.rs.score, pp?.rs.score, 'pts0'), bm(a => a.pillars.rs.score), p.rs.coverage)
    + chCard('Sessions site', 'ga4', p.ga4.hasData ? fmtK(p.ga4.sessions) : '—',
        p.ga4.sessionsAvg != null ? 'moyenne ' + fmtInt(p.ga4.sessionsAvg) + ' / concession' : '',
        deltaHtml(p.ga4.sessions, pp?.ga4.sessions, 'pct'), bm(a => a.pillars.ga4.sessions), p.ga4.coverage)
    + chCard('Note Google', 'gmb', p.gmb.hasData ? fmt1(p.gmb.rating) + ' ★' : '—',
        p.gmb.revNew != null ? '+' + fmtInt(p.gmb.revNew) + ' avis' : '',
        deltaHtml(p.gmb.rating, pp?.gmb.rating, 'pts1'), bm(a => a.pillars.gmb.rating), p.gmb.coverage)
    + chCard('Leboncoin', 'lbc', p.lbc.hasData ? fmtK(p.lbc.views) + ' vues' : '—',
        p.lbc.leads != null ? fmtInt(p.lbc.leads) + ' contacts' : '',
        deltaHtml(p.lbc.views, pp?.lbc.views, 'pct'), bm(a => a.pillars.lbc.views), p.lbc.coverage)
    + '</div>';

  h += diagSection(bu);
  h += concTable(MET.BUS.find(b => b.bu === bu)?.concs || [], 'Concessions de ' + bu, 'Classées de la plus fragile à la plus solide · cliquez pour le détail');
  return h + '</div>';
}

// ----- Drawer concession -----
export function renderDrawer(){
  const c = MET.CONCESSIONS.find(x => x.id === state.drawer);
  if (!c) return '';
  const months = currentMonths(), prevM = previousMonths();
  const a = MET.periodConc(c.id, months);
  const prev = prevM ? MET.periodConc(c.id, prevM) : null;
  const st = MET.statusOf(a.score ?? 0);
  const sm = sparkMonths();
  const avail = Object.entries(a.pillars).filter(([, p]) => p.exists && p.hasData);
  const worst = avail.length ? avail.reduce((x, y) => (x[1].score <= y[1].score ? x : y)) : null;
  const best = avail.length ? avail.reduce((x, y) => (x[1].score >= y[1].score ? x : y)) : null;
  let diag = a.score != null ? 'Score de <b>' + a.score + '/100</b> (' + st.label.toLowerCase() + '). ' : 'Aucune donnée sur la période. ';
  if (best) diag += 'Point fort : <b>' + PILLAR_LABEL_LC[best[0]] + '</b> (' + Math.round(best[1].score) + '/100). ';
  if (worst) diag += (worst[1].score < 50 ? 'À redresser : <b>' : 'Pilier le plus fragile : <b>') + PILLAR_LABEL_LC[worst[0]] + '</b> (' + Math.round(worst[1].score) + '/100).';
  if (!a.pillars.rs.exists) diag += ' Cette concession n’a pas de compte RS propre — score calculé sur 3 piliers.';

  const row = (label, val, dHtml, series, color) =>
    '<div class="ch-row"><span class="cn">' + label + '</span>'
    + '<span class="cv">' + val + '</span>'
    + '<span class="cd">' + dHtml.replace(/<span class="vs">.*?<\/span>/, '') + '</span>'
    + '<span class="csp">' + svgSpark(series, { color, h: 26, w: 110 }) + '</span></div>';
  const cm = fn => sm.map(m => fn(MET.concMonth(c.id, m)));
  const colOf = p => !p || p.score == null ? '#8893a4' : (p.score >= 70 ? '#1aa053' : p.score >= 50 ? '#e8870f' : '#e0413a');

  let rows = '';
  if (a.pillars.rs.fbEx !== false && MET.hasAccount('concession', c.id, 'fb'))
    rows += row('Facebook', a.pillars.rs.engFb != null ? fmtPct(a.pillars.rs.engFb) : '—', deltaHtml(a.pillars.rs.engFb, prev?.pillars.rs.engFb, 'pts1'), cm(m => m.pillars.rs.fb?.eng ?? null), colOf(a.pillars.rs));
  if (MET.hasAccount('concession', c.id, 'ig'))
    rows += row('Instagram', a.pillars.rs.engIg != null ? fmtPct(a.pillars.rs.engIg) : '—', deltaHtml(a.pillars.rs.engIg, prev?.pillars.rs.engIg, 'pts1'), cm(m => m.pillars.rs.ig?.eng ?? null), colOf(a.pillars.rs));
  rows += row('Sessions site', a.pillars.ga4.hasData ? fmtK(a.pillars.ga4.sessions) : '—', deltaHtml(a.pillars.ga4.sessions, prev?.pillars.ga4.sessions, 'pct'), cm(m => m.pillars.ga4.sessions), colOf(a.pillars.ga4));
  rows += row('Note Google', a.pillars.gmb.rating != null ? fmt1(a.pillars.gmb.rating) + ' ★' : '—', deltaHtml(a.pillars.gmb.rating, prev?.pillars.gmb.rating, 'pts1'), cm(m => m.pillars.gmb.rating), colOf(a.pillars.gmb));
  rows += row('Leboncoin', a.pillars.lbc.hasData ? fmtK(a.pillars.lbc.views) : '—', deltaHtml(a.pillars.lbc.views, prev?.pillars.lbc.views, 'pct'), cm(m => m.pillars.lbc.views), colOf(a.pillars.lbc));

  return '<div class="overlay" data-action="close-drawer"></div>'
    + '<aside class="drawer" role="dialog" aria-label="Détail concession">'
    + '<div class="d-head"><div class="t"><h3>' + esc(c.name) + '</h3>'
    + '<div class="sub">' + esc(cap(c.city)) + (c.cp ? ' · ' + esc(c.cp) : '') + (c.dept ? ' · ' + esc(c.dept) : '') + '</div>'
    + '<div style="margin-top:7px">' + buChip(c.bu) + '</div></div>'
    + '<button class="d-close" data-action="close-drawer">✕</button></div>'
    + '<div class="d-body">'
    + '<div class="d-score"><span class="n" style="color:' + st.solid + '">' + (a.score ?? '—') + '<span class="den">/100</span></span>'
    + '<div>' + statusChip(st) + '<div style="margin-top:5px">' + deltaHtml(a.score, prev?.score, 'pts0') + '</div></div></div>'
    + '<div><div class="d-sec-t">Canaux — ' + esc(periodTitle()) + '</div>' + rows + '</div>'
    + '<div class="d-diag">' + diag + '</div>'
    + ((c.resp || c.phone || c.email) ?
      '<div class="contact"><div class="d-sec-t">Concession</div>'
      + (c.resp ? '<p>Responsable : <b>' + esc(cap(c.resp)) + '</b></p>' : '')
      + (c.phone ? '<p>Téléphone : <b>' + esc(c.phone) + '</b></p>' : '')
      + (c.email ? '<p>E-mail : <b>' + esc(c.email) + '</b></p>' : '')
      + (c.region ? '<p>Région : <b>' + esc(c.region) + '</b></p>' : '') + '</div>'
      : '<div class="contact"><div class="d-sec-t">Concession</div><p style="color:var(--muted2)">Coordonnées disponibles après connexion au backend.</p></div>')
    + (c.brands?.length ? '<div><div class="d-sec-t">Marques distribuées</div><div class="chips">' + c.brands.map(b => '<span class="chip">' + esc(b) + '</span>').join('') + '</div></div>' : '')
    + '</div>'
    + '<div class="d-actions"><button class="btn-red full" data-action="fly-conc" data-id="' + esc(c.id) + '">Voir sur la carte</button></div>'
    + '</aside>';
}

// ----- Popover source + toast -----
export function renderSrcPop(){
  const ch = CHANNELS[state.srcPop];
  if (!ch) return '';
  return '<div class="modal"><div class="overlay" data-action="close-pop" style="z-index:605"></div><div class="m-box popover-box">'
    + '<h3>' + esc(ch.fullName) + '</h3>'
    + '<span class="pop-tag">' + esc(ch.tag) + '</span>'
    + '<p>' + esc(ch.desc) + '</p>'
    + '<div class="sync">' + (IS_DEMO ? 'Mode démo — données fictives générées.' : 'Données importées via l’écran Administration (journal des imports).') + '</div>'
    + '<div style="text-align:right;margin-top:14px"><button class="btn-ghost" data-action="close-pop">Fermer</button></div>'
    + '</div></div>';
}
export function renderToast(){
  if (!state.toast) return '';
  return '<div class="toast"><div class="tt">✓ ' + esc(state.toast.title) + '</div><div class="tb">' + esc(state.toast.body) + '</div></div>';
}

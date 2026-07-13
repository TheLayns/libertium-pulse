// =====================================================================
// Écran Administration (rôle admin uniquement) :
//   1. Accès      — liste e-mail -> rôle (c'est ELLE qui décide qui voit quoi)
//   2. Imports    — wizard d'import Excel/CSV réel + journal
//   3. Comptes    — alias d'export -> concession / NATIONAL
// =====================================================================
import { state, setState, rerender } from './state.js';
import { IS_DEMO, BU_ORDER, CHANNELS } from './config.js';
import { esc, fmtInt, cap, shortName, norm, similarity } from './util.js';
import * as MET from './metrics.js';
import * as api from './api.js';

export async function ensureAdminData(force){
  if (state.adminData && !force) return;
  const [accessList, imports] = await Promise.all([api.fetchAccessList(), api.fetchImports()]);
  setState({ adminData: { accessList, imports } });
}

const ROLE_LABEL = { admin: 'Admin', direction: 'Direction', directeur_bu: 'Directeur BU' };

export function renderAdmin(){
  const d = state.adminData;
  let body = '';
  if (!d) body = '<section class="card"><div class="card-sub">Chargement…</div></section>';
  else if (state.adminTab === 'access') body = tabAccess(d);
  else if (state.adminTab === 'imports') body = tabImports(d);
  else body = tabAliases();

  return '<div class="main">'
    + '<div><button class="crumb" data-action="back-dashboard">← Retour au tableau de bord</button></div>'
    + '<section class="card"><div class="card-title" style="font-size:17px">Administration</div>'
    + '<div class="card-sub">' + (IS_DEMO ? 'Mode démo : les modifications sont locales et perdues au rechargement.' : 'Gestion des accès, des imports de données et des comptes.') + '</div>'
    + '<div class="tabs">'
    + '<button class="tab' + (state.adminTab === 'access' ? ' on' : '') + '" data-action="admin-tab" data-tab="access">Accès</button>'
    + '<button class="tab' + (state.adminTab === 'imports' ? ' on' : '') + '" data-action="admin-tab" data-tab="imports">Imports de données</button>'
    + '<button class="tab' + (state.adminTab === 'aliases' ? ' on' : '') + '" data-action="admin-tab" data-tab="aliases">Comptes & alias</button>'
    + '</div>' + body + '</section></div>';
}

function tabAccess(d){
  let h = '<div class="adm-form">'
    + '<div class="field"><label>Adresse e-mail</label><input id="acc-email" type="email" placeholder="prenom.nom@libertium.fr"></div>'
    + '<div class="field"><label>Nom affiché</label><input id="acc-name" placeholder="Prénom Nom"></div>'
    + '<div class="field"><label>Rôle</label><select id="acc-role"><option value="direction">Direction (tout voir)</option><option value="directeur_bu">Directeur de BU</option><option value="admin">Admin</option></select></div>'
    + '<div class="field"><label>BU (si directeur)</label><select id="acc-bu"><option value="">—</option>' + BU_ORDER.map(b => '<option>' + b + '</option>').join('') + '</select></div>'
    + '<button class="btn-red" data-action="access-add">Ajouter / mettre à jour</button>'
    + '</div>';
  h += '<div style="overflow-x:auto"><table class="adm"><thead><tr><th>E-mail</th><th>Nom</th><th>Rôle</th><th>BU</th><th>Actif</th><th></th></tr></thead><tbody>';
  d.accessList.forEach(a => {
    h += '<tr><td style="font-weight:700">' + esc(a.email) + '</td>'
      + '<td>' + esc(a.display_name || '') + '</td>'
      + '<td><span class="role-tag ' + a.role + '">' + ROLE_LABEL[a.role] + '</span></td>'
      + '<td>' + esc(a.bu || '—') + '</td>'
      + '<td>' + (a.active !== false ? '✓' : '<span style="color:var(--red-text)">désactivé</span>') + '</td>'
      + '<td style="text-align:right;white-space:nowrap">'
      + '<button class="mini-btn" data-action="access-toggle" data-email="' + esc(a.email) + '">' + (a.active !== false ? 'Désactiver' : 'Réactiver') + '</button> '
      + '<button class="mini-btn danger" data-action="access-del" data-email="' + esc(a.email) + '">Supprimer</button>'
      + '</td></tr>';
  });
  h += '</tbody></table></div>';
  h += '<p class="card-sub" style="margin-top:12px">Règle : l’e-mail détermine l’accès automatiquement à la connexion — un e-mail absent de cette liste ne voit rien.</p>';
  return h;
}

function tabImports(d){
  let h = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">'
    + '<div class="card-sub" style="margin:0">Exports acceptés : Meta Facebook · Meta Instagram · GA4 · Google Business Profile · Leboncoin (modèle CSV fourni)</div>'
    + '<div style="display:flex;gap:8px"><button class="btn-ghost" data-action="lbc-template">⬇ Modèle CSV Leboncoin</button>'
    + '<button class="btn-red" data-action="wizard-open">⇪ Nouvel import</button></div></div>';
  h += '<div style="overflow-x:auto"><table class="adm"><thead><tr><th>Date</th><th>Par</th><th>Source</th><th>Fichier</th><th>Période</th><th>Lignes</th><th>Statut</th></tr></thead><tbody>';
  if (!d.imports.length) h += '<tr><td colspan="7" style="color:var(--muted2)">Aucun import pour le moment.</td></tr>';
  d.imports.forEach(im => {
    h += '<tr><td>' + new Date(im.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) + '</td>'
      + '<td>' + esc(im.imported_by) + '</td>'
      + '<td><span class="chip">' + esc(im.source) + '</span></td>'
      + '<td style="color:var(--muted)">' + esc(im.file_name || '—') + '</td>'
      + '<td>' + esc((im.month_min || '').slice(0, 7)) + (im.month_max && im.month_max !== im.month_min ? ' → ' + esc(im.month_max.slice(0, 7)) : '') + '</td>'
      + '<td class="num">' + fmtInt(im.row_count) + '</td>'
      + '<td>' + (im.status === 'ok' ? '<span style="color:var(--green-text);font-weight:700">✓ ok</span>' : '<span style="color:var(--orange-text);font-weight:700">' + esc(im.status) + '</span>') + '</td></tr>';
  });
  return h + '</tbody></table></div>';
}

function tabAliases(){
  const list = window.__DB__?.aliases || [];
  let h = '<div class="adm-form">'
    + '<div class="field"><label>Canal</label><select id="al-ch">' + Object.keys(CHANNELS).map(c => '<option value="' + c + '">' + CHANNELS[c].name + '</option>').join('') + '</select></div>'
    + '<div class="field" style="min-width:240px"><label>Alias (nom dans l’export)</label><input id="al-alias" placeholder="ex. Libertium Nantes Nord"></div>'
    + '<div class="field" style="min-width:240px"><label>Cible</label><select id="al-target">'
    + '<option value="national|NATIONAL">🌐 Compte national</option>'
    + MET.CONCESSIONS.map(c => '<option value="concession|' + esc(c.id) + '">' + esc(shortName(c.name)) + ' (' + esc(c.bu) + ')</option>').join('')
    + '</select></div>'
    + '<button class="btn-red" data-action="alias-add">Ajouter</button>'
    + '</div>';
  h += '<div style="overflow-x:auto"><table class="adm"><thead><tr><th>Canal</th><th>Alias</th><th>Cible</th><th></th></tr></thead><tbody>';
  const label = a => a.scope === 'national' ? '🌐 National' : (MET.CONCESSIONS.find(c => c.id === a.target_id)?.name ? shortName(MET.CONCESSIONS.find(c => c.id === a.target_id).name) : a.target_id);
  [...list].sort((a, b) => a.channel.localeCompare(b.channel) || a.alias.localeCompare(b.alias)).forEach(a => {
    h += '<tr><td><span class="chip">' + esc(a.channel) + '</span></td><td style="font-weight:600">' + esc(a.alias) + '</td>'
      + '<td>' + esc(label(a)) + '</td>'
      + '<td style="text-align:right"><button class="mini-btn danger" data-action="alias-del" data-ch="' + esc(a.channel) + '" data-alias="' + esc(a.alias) + '">Supprimer</button></td></tr>';
  });
  h += '</tbody></table></div>';
  h += '<p class="card-sub" style="margin-top:12px">Les alias servent au rapprochement automatique lors des imports, et déclarent l’existence des comptes FB/IG (une concession sans alias « Instagram » = pas de compte IG, son score se calcule sans ce pilier).</p>';
  return h;
}

// =====================================================================
// WIZARD D'IMPORT — 5 étapes
// =====================================================================
const SOURCES = {
  meta_fb: { label: 'Meta — Facebook', channel: 'fb',
    fields: { account: ['nom de la page', 'titre de la page', 'page name', 'page'], followers: ['abonnes', 'followers', 'fans'], reach: ['couverture', 'portee', 'reach'], interactions: ['interactions', 'engagement'], posts: ['publications', 'posts'] } },
  meta_ig: { label: 'Meta — Instagram', channel: 'ig',
    fields: { account: ['nom d utilisateur', 'username', 'compte', 'profil'], followers: ['abonnes', 'followers'], reach: ['couverture', 'portee', 'reach', 'impressions'], interactions: ['interactions', 'engagement'], posts: ['publications', 'posts'] } },
  ga4: { label: 'Google Analytics 4', channel: 'ga4',
    fields: { account: ['concession', 'propriete', 'flux', 'dimension', 'page'], sessions: ['sessions'], users: ['utilisateurs actifs', 'utilisateurs', 'users'] } },
  gbp: { label: 'Google Business Profile', channel: 'gmb',
    fields: { account: ['etablissement', 'fiche', 'location', 'nom'], rating: ['note moyenne', 'note', 'rating'], reviews_total: ['total avis', 'avis cumules', 'total reviews'], reviews_new: ['nouveaux avis', 'avis', 'reviews'], views: ['vues', 'impressions', 'affichages'] } },
  lbc: { label: 'Leboncoin (modèle CSV)', channel: 'lbc',
    fields: { account: ['concession'], ads_count: ['annonces'], views: ['vues'], leads: ['contacts'] } }
};
const NUM_FIELDS = ['followers', 'reach', 'interactions', 'posts', 'sessions', 'users', 'rating', 'reviews_total', 'reviews_new', 'ads_count', 'views', 'leads'];

export const LBC_TEMPLATE = 'concession;mois;annonces;vues;contacts\nLIBERTIUM DAX;2026-06;24;2870;16\n';

function parseNum(v){
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[\s  ]/g, '').replace('%', '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
function parseMonth(v){
  if (v == null) return null;
  if (v instanceof Date) return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-01';
  const s = norm(String(v));
  let m = s.match(/(20\d\d)[-/ .](\d{1,2})/);           // 2026-06
  if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-01';
  m = s.match(/(\d{1,2})[-/ .](20\d\d)/);               // 06/2026
  if (m) return m[2] + '-' + m[1].padStart(2, '0') + '-01';
  const MO = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
  m = s.match(/([a-z]+)\s*(20\d\d)/);
  if (m) { const i = MO.findIndex(x => x.startsWith(m[1].slice(0, 4))); if (i >= 0) return m[2] + '-' + String(i + 1).padStart(2, '0') + '-01'; }
  return null;
}

async function parseFile(file){
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const first = lines[0] || '';
    const delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
    const split = l => {
      const out = []; let cur = '', q = false;
      for (const ch of l) {
        if (ch === '"') q = !q;
        else if (ch === delim && !q) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur); return out.map(s => s.trim());
    };
    return lines.map(split);
  }
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
}

function detectSource(headers){
  const hs = headers.map(norm);
  const has = kw => hs.some(h => h.includes(kw));
  const scores = {
    lbc: (hs.includes('concession') && hs.includes('annonces') && hs.includes('vues')) ? 10 : 0,
    meta_fb: (has('page') ? 4 : 0) + (has('couverture') || has('reach') || has('portee') ? 3 : 0) + (has('interactions') ? 2 : 0),
    meta_ig: (has('utilisateur') || has('username') || has('instagram') ? 5 : 0) + (has('abonnes') || has('followers') ? 3 : 0),
    ga4: (has('sessions') ? 6 : 0) + (has('utilisateurs') ? 2 : 0),
    gbp: (has('note') || has('rating') ? 4 : 0) + (has('avis') || has('review') ? 4 : 0) + (has('etablissement') || has('fiche') ? 2 : 0)
  };
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] >= 5 ? best[0] : null;
}

export function autoMapColumns(headers, sourceKey){
  const src = SOURCES[sourceKey];
  const hs = headers.map(norm);
  const map = {};
  Object.entries(src.fields).forEach(([field, kws]) => {
    let idx = -1;
    for (const kw of kws) { idx = hs.findIndex(h => h.includes(kw)); if (idx >= 0) break; }
    if (idx >= 0) map[field] = idx;
  });
  const mi = hs.findIndex(h => h === 'mois' || h.includes('month') || h === 'periode' || h === 'date');
  if (mi >= 0) map._month = mi;
  return map;
}

function resolveAccounts(aliasValues, channel){
  const aliases = window.__DB__?.aliases || [];
  return aliasValues.map(v => {
    const exact = aliases.find(a => a.channel === channel && norm(a.alias) === norm(v));
    if (exact) return { alias: v, scope: exact.scope, target: exact.target_id, auto: true, remember: false };
    let best = null, bs = 0;
    MET.CONCESSIONS.forEach(c => {
      const s = Math.max(similarity(v, c.name), similarity(v, 'libertium ' + c.city), similarity(v, c.city));
      if (s > bs) { bs = s; best = c; }
    });
    if (norm(v).includes('france') || norm(v).includes('national') || norm(v).includes('officiel'))
      return { alias: v, scope: 'national', target: 'NATIONAL', auto: false, remember: true, confidence: 0.9 };
    return bs >= 0.55
      ? { alias: v, scope: 'concession', target: best.id, auto: false, remember: true, confidence: bs }
      : { alias: v, scope: null, target: '', auto: false, remember: true, confidence: 0 };
  });
}

export async function wizardFile(file){
  setState({ wizard: { ...state.wizard, busy: true, error: null } });
  try {
    const aoa = await parseFile(file);
    if (!aoa.length || aoa.length < 2) throw new Error('Fichier vide ou sans données.');
    const headers = aoa[0].map(String);
    const source = detectSource(headers);
    const w = {
      step: 2, busy: false, error: null,
      fileName: file.name, headers, dataRows: aoa.slice(1).filter(r => r.some(c => c !== '' && c != null)),
      source, colMap: source ? autoMapColumns(headers, source) : {},
      monthIso: MET.MONTHS[MET.MONTHS.length - 1] || null,
      accounts: null, prepared: null
    };
    setState({ wizard: w });
  } catch (e) {
    setState({ wizard: { ...state.wizard, busy: false, error: e.message || String(e) } });
  }
}

export function wizardToMapping(){
  const w = state.wizard;
  if (!w.source) { setState({ wizard: { ...w, error: 'Choisissez la source.' } }); return; }
  if (!(w.colMap.account >= 0)) w.colMap = autoMapColumns(w.headers, w.source);
  const src = SOURCES[w.source];
  const accIdx = w.colMap.account;
  const values = [...new Set(w.dataRows.map(r => String(r[accIdx] ?? '').trim()).filter(Boolean))];
  const accounts = resolveAccounts(values, src.channel);
  setState({ wizard: { ...w, step: 3, accounts, error: null } });
}

export function wizardPrepare(){
  const w = state.wizard;
  const src = SOURCES[w.source];
  const accByAlias = new Map(w.accounts.map(a => [norm(a.alias), a]));
  const rows = [], skipped = [];
  let replaced = 0;
  w.dataRows.forEach((r, i) => {
    const aliasV = String(r[w.colMap.account] ?? '').trim();
    const acc = accByAlias.get(norm(aliasV));
    if (!acc || !acc.target) { skipped.push('Ligne ' + (i + 2) + ' : compte « ' + aliasV + ' » non rattaché'); return; }
    const month = w.colMap._month != null ? parseMonth(r[w.colMap._month]) : w.monthIso;
    if (!month) { skipped.push('Ligne ' + (i + 2) + ' : mois illisible'); return; }
    const row = { scope: acc.scope, target_id: acc.target, channel: src.channel, month };
    let hasVal = false;
    NUM_FIELDS.forEach(f => {
      if (w.colMap[f] != null) {
        const v = parseNum(r[w.colMap[f]]);
        if (v != null) { row[f] = f === 'rating' ? Math.round(v * 100) / 100 : Math.round(v); hasVal = true; }
      }
    });
    if (row.rating != null && (row.rating < 1 || row.rating > 5)) { skipped.push('Ligne ' + (i + 2) + ' : note hors [1,5]'); return; }
    if (!hasVal) { skipped.push('Ligne ' + (i + 2) + ' : aucune valeur numérique'); return; }
    if (MET.getRow(row.scope, row.target_id, src.channel, month)) replaced++;
    rows.push(row);
  });
  // fusion des lignes multiples même cible+mois (ex. GA4 par page) : somme
  const merged = new Map();
  rows.forEach(r => {
    const key = r.scope + '|' + r.target_id + '|' + r.month;
    if (!merged.has(key)) merged.set(key, r);
    else {
      const m = merged.get(key);
      NUM_FIELDS.forEach(f => { if (r[f] != null) m[f] = f === 'rating' ? r[f] : (m[f] || 0) + r[f]; });
    }
  });
  const finalRows = [...merged.values()];
  const months = [...new Set(finalRows.map(r => r.month))].sort();
  setState({ wizard: { ...w, step: 4, prepared: { rows: finalRows, skipped, replaced, months }, error: null } });
}

export async function wizardCommit(){
  const w = state.wizard;
  setState({ wizard: { ...w, busy: true, error: null } });
  try {
    // mémoriser les nouveaux alias
    for (const a of w.accounts) {
      if (a.target && a.remember && !a.auto) {
        await api.addAlias({ channel: SOURCES[w.source].channel, alias: a.alias, scope: a.scope, target_id: a.target });
      }
    }
    const p = w.prepared;
    await api.importMetrics({
      source: w.source, file_name: w.fileName,
      month_min: p.months[0], month_max: p.months[p.months.length - 1],
      status: p.skipped.length ? 'partial' : 'ok',
      report: p.skipped.length ? { skipped: p.skipped.slice(0, 50) } : null
    }, p.rows, state.profile.email);
    setState({ wizard: { ...w, busy: false, step: 5 } });
  } catch (e) {
    setState({ wizard: { ...w, busy: false, error: e.message || String(e) } });
  }
}

export function renderWizard(){
  const w = state.wizard;
  if (!w) return '';
  const steps = ['Fichier', 'Source', 'Rattachement', 'Validation', 'Terminé'];
  let body = '';

  if (w.step === 1) {
    body = '<div class="dropzone" id="dropzone"><div class="dz-ic">📄</div>'
      + '<div class="dz-t">Glissez-déposez votre export ici</div>'
      + '<div class="dz-s">Excel (.xlsx) ou CSV — Meta FB/IG, GA4, Google Business Profile, Leboncoin</div>'
      + '<label class="btn-ghost" style="margin-top:12px;display:inline-block;cursor:pointer">Parcourir un fichier…<input type="file" id="wiz-file" accept=".xlsx,.xls,.csv,.txt" style="display:none"></label>'
      + '<div class="src-formats"><span class="chip">.xlsx</span><span class="chip">.csv</span><span class="chip">détection automatique</span></div>'
      + '</div>';
  }
  else if (w.step === 2) {
    body = '<p class="m-sub">Fichier : <b>' + esc(w.fileName) + '</b> · ' + w.dataRows.length + ' lignes · '
      + (w.source ? 'source détectée : <b>' + SOURCES[w.source].label + '</b>' : '<b style="color:var(--orange-text)">source non reconnue — choisissez-la :</b>') + '</p>'
      + '<div class="field" style="max-width:280px"><label>Source</label><select id="wiz-source">'
      + Object.entries(SOURCES).map(([k, s]) => '<option value="' + k + '"' + (k === w.source ? ' selected' : '') + '>' + s.label + '</option>').join('') + '</select></div>'
      + '<div style="margin-top:14px"><div class="d-sec-t">Correspondance des colonnes</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
      + Object.keys(SOURCES[w.source || 'ga4'].fields).concat(['_month']).map(f => {
          const label = f === '_month' ? 'Mois (colonne)' : f === 'account' ? 'Compte / concession' : f;
          return '<div class="field" style="min-width:170px"><label>' + esc(label) + '</label>'
            + '<select data-wiz-col="' + f + '"><option value="">' + (f === '_month' ? '— global (sélecteur) —' : '— ignorer —') + '</option>'
            + w.headers.map((h, i) => '<option value="' + i + '"' + (w.colMap[f] === i ? ' selected' : '') + '>' + esc(h) + '</option>').join('')
            + '</select></div>';
        }).join('')
      + '</div></div>'
      + (w.colMap._month == null ? '<div class="field" style="max-width:220px;margin-top:10px"><label>Mois des données</label><select id="wiz-month">'
        + MET.MONTHS.slice().reverse().map(m => '<option value="' + m + '"' + (m === w.monthIso ? ' selected' : '') + '>' + m.slice(0, 7) + '</option>').join('')
        + '<option value="__next__">Mois suivant (' + nextMonthIso() + ')</option>'
        + '</select></div>' : '');
  }
  else if (w.step === 3) {
    const optionsFor = a => {
      const sel = (a.scope || '') + '|' + (a.target || '');
      const opt = (val, label) => '<option value="' + val + '"' + (val === sel ? ' selected' : '') + '>' + label + '</option>';
      return opt('|', '— ignorer —') + opt('national|NATIONAL', '🌐 Compte national')
        + MET.CONCESSIONS.map(c => opt('concession|' + esc(c.id), esc(shortName(c.name)) + ' (' + esc(c.bu) + ')')).join('');
    };
    body = '<p class="m-sub">' + w.accounts.length + ' comptes trouvés dans le fichier. Vérifiez le rattachement (les alias mémorisés passeront automatiquement la prochaine fois).</p>'
      + '<div class="map-table-wrap"><table class="adm"><thead><tr><th>Dans le fichier</th><th>Rattaché à</th><th>Mémoriser</th></tr></thead><tbody>'
      + w.accounts.map((a, i) =>
        '<tr' + (!a.target ? ' class="unresolved"' : '') + '><td style="font-weight:600">' + esc(a.alias) + (a.auto ? ' <span class="chip">alias connu</span>' : a.confidence ? ' <span class="chip">suggestion</span>' : '') + '</td>'
        + '<td><select data-wiz-acc="' + i + '">' + optionsFor(a) + '</select></td>'
        + '<td style="text-align:center"><input type="checkbox" data-wiz-rem="' + i + '"' + (a.remember && !a.auto ? ' checked' : '') + (a.auto ? ' disabled' : '') + '></td></tr>').join('')
      + '</tbody></table></div>';
  }
  else if (w.step === 4) {
    const p = w.prepared;
    body = '<div class="wiz-summary">'
      + '<span class="ok">✓ ' + p.rows.length + ' lignes prêtes</span>'
      + (p.replaced ? '<span style="color:var(--orange-text)">↻ ' + p.replaced + ' remplacements (données déjà présentes)</span>' : '')
      + (p.skipped.length ? '<span class="ko">✕ ' + p.skipped.length + ' ignorées</span>' : '')
      + '<span>Période : ' + p.months.map(m => m.slice(0, 7)).join(', ') + '</span>'
      + '</div>'
      + (p.skipped.length ? '<details class="data-table" style="margin-top:10px"><summary>Lignes ignorées</summary><div style="font-size:11.5px;color:var(--muted);max-height:140px;overflow-y:auto;margin-top:6px">' + p.skipped.slice(0, 30).map(esc).join('<br>') + '</div></details>' : '')
      + '<div class="dt-wrap" style="margin-top:12px;max-height:220px;overflow-y:auto"><table class="dt"><thead><tr><th>Cible</th><th>Mois</th>' + NUM_FIELDS.filter(f => p.rows.some(r => r[f] != null)).map(f => '<th>' + f + '</th>').join('') + '</tr></thead><tbody>'
      + p.rows.slice(0, 12).map(r => '<tr><td>' + esc(r.scope === 'national' ? '🌐 National' : shortName(MET.CONCESSIONS.find(c => c.id === r.target_id)?.name || r.target_id)) + '</td><td>' + r.month.slice(0, 7) + '</td>'
        + NUM_FIELDS.filter(f => p.rows.some(x => x[f] != null)).map(f => '<td>' + (r[f] ?? '—') + '</td>').join('') + '</tr>').join('')
      + '</tbody></table></div>'
      + (p.rows.length > 12 ? '<div class="card-sub" style="margin-top:6px">… et ' + (p.rows.length - 12) + ' autres lignes.</div>' : '');
  }
  else {
    body = '<div class="login-ok" style="font-size:14px">✓ Import terminé — ' + (w.prepared?.rows.length || 0) + ' lignes enregistrées. Le tableau de bord est à jour.</div>';
  }

  const canNext = { 1: false, 2: true, 3: w.accounts?.some(a => a.target), 4: true, 5: false }[w.step];
  const nextAction = { 2: 'wizard-mapping', 3: 'wizard-prepare', 4: 'wizard-commit' }[w.step];
  const nextLabel = { 2: 'Continuer', 3: 'Valider le rattachement', 4: w.busy ? 'Import…' : 'Importer maintenant' }[w.step];

  return '<div class="modal"><div class="overlay" data-action="wizard-close" style="z-index:605"></div><div class="m-box wiz-box">'
    + '<h3>Importer un export</h3>'
    + '<div class="wiz-steps">' + steps.map((s, i) =>
      '<span class="wiz-step' + (i + 1 === w.step ? ' on' : i + 1 < w.step ? ' done' : '') + '"><span class="n">' + (i + 1 < w.step ? '✓' : i + 1) + '</span>' + s + '</span>'
      + (i < steps.length - 1 ? '<span style="color:var(--border2)">—</span>' : '')).join('')
    + '</div>'
    + (w.error ? '<div class="login-err" style="margin-bottom:12px">' + esc(w.error) + '</div>' : '')
    + body
    + '<div class="wiz-actions">'
    + '<button class="btn-ghost" data-action="wizard-close">' + (w.step === 5 ? 'Fermer' : 'Annuler') + '</button>'
    + (canNext ? '<button class="btn-red" data-action="' + nextAction + '"' + (w.busy ? ' disabled' : '') + '>' + nextLabel + '</button>' : '')
    + '</div></div></div>';
}

function nextMonthIso(){
  const last = MET.MONTHS[MET.MONTHS.length - 1];
  if (!last) return '';
  let [y, m] = last.split('-').map(Number);
  m++; if (m > 12) { m = 1; y++; }
  return y + '-' + String(m).padStart(2, '0') + '-01';
}
export { nextMonthIso };

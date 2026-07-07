// =====================================================================
// Libertium Pulse v2 — assemblage : boot, rendu global, événements.
// =====================================================================
import { IS_DEMO, BU_ORDER, seasonOf } from './config.js';
import { state, setState, setRenderer } from './state.js';
import * as MET from './metrics.js';
import { loadData } from './api.js';
import { getProfile, setDemoProfile, sendMagicLink, verifyOtpCode, emailAllowed, signOut, watchAuth } from './auth.js';
import { installTooltip, resetCharts } from './charts.js';
import { mountMap, leafletAvailable } from './map.js';
import * as V from './views.js';
import * as ADM from './admin.js';
import { defaultTime } from './period.js';

const app = document.getElementById('app');

// ---------------------------------------------------------------------
// Rendu global
// ---------------------------------------------------------------------
function render(){
  resetCharts();
  if (state.loadError) {
    app.innerHTML = '<div class="login"><div class="p-logo">LIBERTIUM <span>pulse</span></div>'
      + '<div class="login-card"><div class="login-err">' + state.loadError + '</div>'
      + '<button class="btn-ghost" data-action="logout">Retour à la connexion</button></div></div>';
    return;
  }
  if (!state.profile) { app.innerHTML = V.renderLogin(); return; }
  if (!state.profile.role) {
    app.innerHTML = '<div class="login"><div class="p-logo">LIBERTIUM <span>pulse</span></div>'
      + '<div class="login-card"><h3>Accès non autorisé</h3>'
      + '<p>L’adresse <b>' + (state.profile.email || '') + '</b> n’est pas dans la liste d’accès. Contactez un administrateur Libertium Pulse.</p>'
      + '<button class="btn-red full" data-action="logout">Se déconnecter</button></div></div>';
    return;
  }
  if (state.loading) {
    app.innerHTML = '<div class="boot-splash"><div class="p-logo">LIBERTIUM <span>pulse</span></div><div class="boot-msg">Chargement des données…</div></div>';
    return;
  }

  let h = V.renderTopbar();
  if (state.view !== 'admin') h += V.renderSubbar();
  if (state.view === 'admin' && state.profile.role === 'admin') h += ADM.renderAdmin();
  else if (state.view === 'bu' && state.detailBu) h += V.renderBuDetail();
  else h += V.renderDashboard();
  h += V.renderDrawer();
  if (state.srcPop) h += V.renderSrcPop();
  if (state.wizard) h += ADM.renderWizard();
  h += V.renderToast();
  app.innerHTML = h;

  // Carte Leaflet persistante
  const slot = document.getElementById('map-slot');
  if (slot && leafletAvailable()) mountMap(slot, V.mapCtx());

  // Dropzone du wizard
  const dz = document.getElementById('dropzone');
  if (dz) {
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => { const f = e.dataTransfer.files?.[0]; if (f) ADM.wizardFile(f); });
  }
}
setRenderer(render);

// ---------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------
let toastTimer = null;
function showToast(title, body){
  clearTimeout(toastTimer);
  setState({ toast: { title, body } });
  toastTimer = setTimeout(() => setState({ toast: null }), 5200);
}

// ---------------------------------------------------------------------
// Chargement des données
// ---------------------------------------------------------------------
async function loadAll(){
  setState({ loading: true, loadError: null });
  try {
    const db = await loadData();
    window.__DB__ = db;
    MET.initMetrics(db);
    const t = defaultTime();
    setState({ loading: false, monthIso: state.monthIso && MET.MONTHS.includes(state.monthIso) ? state.monthIso : t.monthIso,
               seasonYear: state.seasonYear && MET.SEASONS.includes(state.seasonYear) ? state.seasonYear : t.seasonYear });
  } catch (e) {
    console.error(e);
    setState({ loading: false, loadError: 'Impossible de charger les données : ' + (e.message || e) });
  }
}

// ---------------------------------------------------------------------
// Événements — délégation globale
// ---------------------------------------------------------------------
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;

  // ----- auth -----
  if (a === 'demo-login') {
    const role = el.dataset.role, bu = el.dataset.bu || null;
    const p = { email: 'demo@libertium.fr', role, bu, name: 'Démo' };
    setDemoProfile(p);
    setState({ profile: p });
    await loadAll();
  }
  else if (a === 'send-link') {
    const email = document.getElementById('email-input')?.value.trim().toLowerCase();
    if (!email || !email.includes('@')) { setState({ login: { ...state.login, error: 'Adresse e-mail invalide.' } }); return; }
    setState({ login: { ...state.login, email, busy: true, error: null } });
    try {
      if (!(await emailAllowed(email))) {
        setState({ login: { ...state.login, email, busy: false, error: 'Cette adresse n’est pas autorisée. Contactez un administrateur.' } });
        return;
      }
      await sendMagicLink(email);
      setState({ login: { ...state.login, email, busy: false, sent: true, error: null } });
    } catch (err) {
      setState({ login: { ...state.login, email, busy: false, error: err.message || String(err) } });
    }
  }
  else if (a === 'verify-otp') {
    const code = document.getElementById('otp-input')?.value.trim();
    if (!code || code.length < 6) { setState({ login: { ...state.login, error: 'Saisissez le code à 6 chiffres.' } }); return; }
    setState({ login: { ...state.login, busy: true, error: null } });
    try {
      await verifyOtpCode(state.login.email, code);
      await onSignedIn();
    } catch (err) {
      setState({ login: { ...state.login, busy: false, error: 'Code invalide ou expiré.' } });
    }
  }
  else if (a === 'login-restart') setState({ login: { step: 'email', email: state.login.email, busy: false, error: null, sent: false } });
  else if (a === 'logout') {
    await signOut();
    setState({ profile: null, view: 'dashboard', drawer: null, wizard: null, adminData: null, login: { step: 'email', email: '', busy: false, error: null, sent: false } });
  }

  // ----- navigation -----
  else if (a === 'back-dashboard') { setState({ view: 'dashboard', detailBu: null }); window.scrollTo({ top: 0 }); }
  else if (a === 'open-admin') {
    if (state.profile.role !== 'admin') return;
    setState({ view: 'admin' });
    ensureAdmin();
  }
  else if (a === 'admin-tab') setState({ adminTab: el.dataset.tab });
  else if (a === 'open-bu') {
    const bu = el.dataset.bu;
    if (state.profile.role === 'directeur_bu' && bu !== state.profile.bu) return;
    setState({ view: 'bu', detailBu: bu, drawer: null });
    window.scrollTo({ top: 0 });
  }
  else if (a === 'open-conc') {
    const c = MET.CONCESSIONS.find(x => x.id === el.dataset.id);
    if (!c || (state.profile.role === 'directeur_bu' && c.bu !== state.profile.bu)) return;
    setState({ drawer: el.dataset.id });
  }
  else if (a === 'close-drawer') setState({ drawer: null });
  else if (a === 'fly-conc') {
    setState({ drawer: null, view: 'dashboard', detailBu: null, focusConc: el.dataset.id, mapFilterBu: null });
    document.querySelector('.map-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ----- temps -----
  else if (a === 'time-mode') setState({ timeMode: el.dataset.mode, focusConc: null });
  else if (a === 'month-set') setState({ monthIso: el.dataset.m });
  else if (a === 'season-set') setState({ seasonYear: +el.dataset.s });
  else if (a === 'time-prev' || a === 'time-next') {
    const dir = a === 'time-next' ? 1 : -1;
    const i = MET.MONTHS.indexOf(state.monthIso) + dir;
    if (i >= 0 && i < MET.MONTHS.length) setState({ monthIso: MET.MONTHS[i] });
  }

  // ----- carte / popovers -----
  else if (a === 'map-mode') setState({ mapMode: el.dataset.mode });
  else if (a === 'legend-bu') {
    const bu = el.dataset.bu;
    setState({ mapFilterBu: (!bu || state.mapFilterBu === bu) ? null : bu, focusConc: null });
  }
  else if (a === 'src-pop') setState({ srcPop: el.dataset.ch });
  else if (a === 'close-pop') setState({ srcPop: null });

  // ----- admin : accès -----
  else if (a === 'access-add') {
    const email = document.getElementById('acc-email')?.value.trim().toLowerCase();
    const role = document.getElementById('acc-role')?.value;
    const bu = document.getElementById('acc-bu')?.value || null;
    const display_name = document.getElementById('acc-name')?.value.trim() || null;
    if (!email || !email.includes('@')) { showToast('E-mail invalide', 'Saisissez une adresse valide.'); return; }
    if (role === 'directeur_bu' && !bu) { showToast('BU manquante', 'Un directeur de BU doit être rattaché à une BU.'); return; }
    try {
      await (await import('./api.js')).upsertAccess({ email, role, bu: role === 'directeur_bu' ? bu : null, display_name, active: true });
      await ADM.ensureAdminData(true);
      showToast('Accès enregistré', email + ' → ' + role + (bu && role === 'directeur_bu' ? ' (' + bu + ')' : ''));
    } catch (err) { showToast('Erreur', err.message || String(err)); }
  }
  else if (a === 'access-toggle' || a === 'access-del') {
    const email = el.dataset.email;
    const entry = state.adminData.accessList.find(x => x.email === email);
    try {
      const api = await import('./api.js');
      if (a === 'access-del') await api.deleteAccess(email);
      else await api.upsertAccess({ ...entry, active: entry.active === false });
      await ADM.ensureAdminData(true);
    } catch (err) { showToast('Erreur', err.message || String(err)); }
  }

  // ----- admin : alias -----
  else if (a === 'alias-add') {
    const channel = document.getElementById('al-ch')?.value;
    const alias = document.getElementById('al-alias')?.value.trim();
    const [scope, target_id] = (document.getElementById('al-target')?.value || '').split('|');
    if (!alias) return;
    try {
      await (await import('./api.js')).addAlias({ channel, alias, scope, target_id });
      await loadAll(); await ADM.ensureAdminData(true);
      showToast('Alias ajouté', alias + ' → ' + target_id);
    } catch (err) { showToast('Erreur', err.message || String(err)); }
  }
  else if (a === 'alias-del') {
    try {
      await (await import('./api.js')).deleteAlias(el.dataset.ch, el.dataset.alias);
      await loadAll(); await ADM.ensureAdminData(true);
    } catch (err) { showToast('Erreur', err.message || String(err)); }
  }

  // ----- admin : imports / wizard -----
  else if (a === 'lbc-template') {
    const blob = new Blob([ADM.LBC_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const u = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = u; link.download = 'modele-leboncoin.csv'; link.click();
    URL.revokeObjectURL(u);
  }
  else if (a === 'wizard-open') setState({ wizard: { step: 1, busy: false, error: null } });
  else if (a === 'wizard-close') {
    const finished = state.wizard?.step === 5;
    setState({ wizard: null });
    if (finished) { await loadAll(); await ADM.ensureAdminData(true); showToast('Import enregistré', 'Le tableau de bord est à jour.'); }
  }
  else if (a === 'wizard-mapping') ADM.wizardToMapping();
  else if (a === 'wizard-prepare') ADM.wizardPrepare();
  else if (a === 'wizard-commit') ADM.wizardCommit();
});

// Événements de formulaire (wizard)
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'wiz-file' && t.files?.[0]) ADM.wizardFile(t.files[0]);
  else if (t.id === 'wiz-source') {
    const w = state.wizard;
    setState({ wizard: { ...w, source: t.value, colMap: ADM.autoMapColumns(w.headers, t.value) } });
  }
  else if (t.dataset.wizCol != null) {
    const w = state.wizard;
    const map = { ...w.colMap };
    if (t.value === '') delete map[t.dataset.wizCol];
    else map[t.dataset.wizCol] = +t.value;
    setState({ wizard: { ...w, colMap: map } });
  }
  else if (t.id === 'wiz-month') {
    const v = t.value === '__next__' ? ADM.nextMonthIso() : t.value;
    setState({ wizard: { ...state.wizard, monthIso: v } });
  }
  else if (t.dataset.wizAcc != null) {
    const w = state.wizard;
    const [scope, target] = t.value.split('|');
    const accounts = w.accounts.slice();
    accounts[+t.dataset.wizAcc] = { ...accounts[+t.dataset.wizAcc], scope: scope || null, target: target || '' };
    setState({ wizard: { ...w, accounts } });
  }
  else if (t.dataset.wizRem != null) {
    const w = state.wizard;
    const accounts = w.accounts.slice();
    accounts[+t.dataset.wizRem] = { ...accounts[+t.dataset.wizRem], remember: t.checked };
    setState({ wizard: { ...w, accounts } });
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (state.srcPop) setState({ srcPop: null });
    else if (state.wizard && state.wizard.step !== 5) setState({ wizard: null });
    else if (state.drawer) setState({ drawer: null });
  }
});

async function ensureAdmin(){
  try { await ADM.ensureAdminData(); } catch (e) { showToast('Erreur admin', e.message || String(e)); }
}

async function onSignedIn(){
  const profile = await getProfile();
  setState({ profile, login: { step: 'email', email: '', busy: false, error: null, sent: false } });
  if (profile?.role) await loadAll();
}

// ---------------------------------------------------------------------
// BOOT
// ---------------------------------------------------------------------
(async function boot(){
  installTooltip();

  // Deep-link de test (mode démo uniquement) : #role=direction · #role=directeur_bu&bu=L.OUEST · #role=admin
  if (IS_DEMO && location.hash) {
    try {
      const h = new URLSearchParams(location.hash.slice(1));
      const role = h.get('role');
      if (['admin', 'direction', 'directeur_bu'].includes(role)) {
        const bu = h.get('bu');
        if (role !== 'directeur_bu' || BU_ORDER.includes(bu))
          setDemoProfile({ email: 'demo@libertium.fr', role, bu: role === 'directeur_bu' ? bu : null, name: 'Démo' });
      }
      if (h.get('view') === 'admin') state.view = 'admin';
      if (h.get('mois')) state.monthIso = h.get('mois');
      if (h.get('saison')) { state.timeMode = 'season'; state.seasonYear = +h.get('saison'); }
      if (h.get('conc')) state.drawer = h.get('conc');
      if (h.get('carte') === 'sante') state.mapMode = 'sante';
    } catch {}
  }

  const profile = await getProfile();
  state.profile = profile;
  if (profile?.role) {
    await loadAll();
    if (state.view === 'admin' && profile.role === 'admin') ensureAdmin();
  } else {
    setState({ loading: false });
  }
  watchAuth(async () => {
    const p = await getProfile();
    if ((p?.email || null) !== (state.profile?.email || null)) {
      setState({ profile: p });
      if (p?.role) await loadAll();
    }
  });
})();

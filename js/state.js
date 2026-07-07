// État global + re-render (pattern v1 conservé)
export const state = {
  profile: null,          // {email, role: 'admin'|'direction'|'directeur_bu', bu, name} — vient de l'auth, JAMAIS d'un choix utilisateur
  loading: true,
  loadError: null,
  view: 'dashboard',      // 'dashboard' | 'bu' | 'admin'
  timeMode: 'month',      // 'month' | 'season'
  monthIso: null,
  seasonYear: null,
  detailBu: null,
  drawer: null,           // id concession
  srcPop: null,           // clé canal (fb/ig/ga4/gmb/lbc)
  toast: null,
  mapMode: 'bu',          // 'bu' | 'sante'
  mapFilterBu: null,
  focusConc: null,
  adminTab: 'access',     // 'access' | 'imports' | 'aliases'
  adminData: null,        // {accessList, imports}
  wizard: null,           // état du wizard d'import
  login: { step: 'email', email: '', busy: false, error: null, sent: false }
};

let renderFn = null;
export function setRenderer(fn){ renderFn = fn; }
export function setState(patch){ Object.assign(state, patch); if (renderFn) renderFn(); }
export function rerender(){ if (renderFn) renderFn(); }

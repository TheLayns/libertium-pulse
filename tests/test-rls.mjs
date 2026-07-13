// =====================================================================
// Tests de sécurité RLS contre le projet Supabase réel.
// Usage (PowerShell) :
//   $env:SUPABASE_URL = "https://xxxx.supabase.co"
//   $env:SUPABASE_ANON_KEY = "<anon>"
//   $env:SUPABASE_SERVICE_KEY = "<service_role>"   # pour créer les sessions de test
//   node tests/test-rls.mjs
//
// Vérifie, PAR L'API DIRECTE (pas par l'écran) :
//   1. anonyme (pas de session)      -> 0 ligne partout
//   2. e-mail hors liste             -> profil null, 0 ligne
//   3. directeur L.OUEST             -> sa BU OK ; national = 0 ; autres BU = 0 ; écriture refusée
//   4. direction                     -> tout visible y compris national ; écriture refusée
//   5. admin                         -> écriture access_list OK
// =====================================================================
const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_KEY;
if (!URL_ || !ANON || !SVC) { console.error('SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY requis'); process.exit(1); }

let fails = 0;
const check = (label, ok, detail = '') => {
  console.log((ok ? '  ✓ ' : '  ✗ FAIL ') + label + (detail ? ' — ' + detail : ''));
  if (!ok) fails++;
};

async function rest(path, token, opts = {}){
  const r = await fetch(URL_ + '/rest/v1/' + path, {
    ...opts,
    headers: { apikey: ANON, Authorization: 'Bearer ' + (token || ANON), 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  let body = null;
  try { body = await r.json(); } catch {}
  return { status: r.status, body };
}

// Sessions de test : utilisateurs créés/maj via l'API admin avec mot de passe éphémère
const PWD = 'Rls-Test-' + Math.random().toString(36).slice(2) + '!9';
async function sessionFor(email){
  const admin = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
  const list = await (await fetch(URL_ + '/auth/v1/admin/users?page=1&per_page=200', { headers: admin })).json();
  const existing = (list.users || []).find(u => u.email === email);
  if (existing) {
    await fetch(URL_ + '/auth/v1/admin/users/' + existing.id, { method: 'PUT', headers: admin, body: JSON.stringify({ password: PWD, email_confirm: true }) });
  } else {
    await fetch(URL_ + '/auth/v1/admin/users', { method: 'POST', headers: admin, body: JSON.stringify({ email, password: PWD, email_confirm: true }) });
  }
  const r = await fetch(URL_ + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PWD })
  });
  const j = await r.json();
  if (!j.access_token) { console.error('Impossible d’ouvrir une session pour', email, j); process.exit(1); }
  return j.access_token;
}

console.log('Cible :', URL_);

// ---- 1. Anonyme ----
console.log('\n1. Anonyme (aucune session)');
for (const t of ['concessions', 'metrics_monthly', 'access_list', 'imports', 'account_aliases']) {
  const { body } = await rest(t + '?select=*&limit=5', null);
  check(t + ' vide', Array.isArray(body) && body.length === 0, Array.isArray(body) ? body.length + ' lignes' : JSON.stringify(body).slice(0, 80));
}

// ---- 2. E-mail hors liste ----
console.log('\n2. E-mail HORS liste (intrus@example.com)');
const tIntrus = await sessionFor('intrus@example.com');
{
  const { body } = await rest('rpc/get_my_profile', tIntrus, { method: 'POST', body: '{}' });
  check('profil null', Array.isArray(body) ? body.length === 0 : body == null, JSON.stringify(body).slice(0, 80));
  const m = await rest('metrics_monthly?select=*&limit=5', tIntrus);
  check('metrics vide', Array.isArray(m.body) && m.body.length === 0);
  const c = await rest('concessions?select=*&limit=5', tIntrus);
  check('concessions vide', Array.isArray(c.body) && c.body.length === 0);
}

// ---- 3. Directeur L.OUEST ----
console.log('\n3. Directeur L.OUEST (layns971@gmail.com)');
const tDir = await sessionFor('layns971@gmail.com');
{
  const own = await rest("metrics_monthly?select=scope,target_id&scope=eq.concession&limit=5", tDir);
  check('voit des concessions', own.body.length > 0);
  const nat = await rest("metrics_monthly?select=*&scope=eq.national&limit=5", tDir);
  check('scope national INVISIBLE', nat.body.length === 0, nat.body.length + ' lignes');
  const other = await rest("metrics_monthly?select=target_id&scope=eq.concession&target_id=eq.libertium-dax&limit=5", tDir); // L.SUD-OUEST
  check('concession d’une autre BU INVISIBLE', other.body.length === 0);
  const al = await rest('access_list?select=email', tDir);
  check('access_list limitée à sa ligne', al.body.length <= 1);
  const w = await rest('metrics_monthly', tDir, { method: 'POST', body: JSON.stringify({ scope: 'concession', target_id: 'libertium-brest-nord', channel: 'lbc', month: '2030-01-01', views: 1 }) });
  check('écriture metrics REFUSÉE', w.status === 401 || w.status === 403, 'status ' + w.status);
  const imp = await rest('rpc/import_metrics', tDir, { method: 'POST', body: JSON.stringify({ p_meta: { source: 'lbc' }, p_rows: [] }) });
  check('RPC import REFUSÉE', imp.status >= 400, 'status ' + imp.status);
}

// ---- 4. Direction ----
console.log('\n4. Direction (laywens.feriaux@gmail.com)');
const tDirection = await sessionFor('laywens.feriaux@gmail.com');
{
  const nat = await rest("metrics_monthly?select=*&scope=eq.national&limit=5", tDirection);
  check('voit le national', nat.body.length > 0);
  const all = await rest('concessions?select=id&limit=100', tDirection);
  check('voit les 67 concessions', all.body.length === 67, all.body.length + '');
  const w = await rest('access_list', tDirection, { method: 'POST', body: JSON.stringify({ email: 'pirate@example.com', role: 'admin' }) });
  check('écriture access_list REFUSÉE', w.status === 401 || w.status === 403, 'status ' + w.status);
}

// ---- 5. Admin ----
console.log('\n5. Admin (nuxnux02290@gmail.com)');
const tAdmin = await sessionFor('nuxnux02290@gmail.com');
{
  const al = await rest('access_list?select=email', tAdmin);
  check('voit toute la liste d’accès', al.body.length >= 3, al.body.length + '');
  const w = await rest('access_list', tAdmin, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ email: 'test-rls@libertium.fr', role: 'direction', display_name: 'Test RLS' }) });
  check('écriture access_list OK', w.status < 300, 'status ' + w.status);
  await rest('access_list?email=eq.test-rls@libertium.fr', tAdmin, { method: 'DELETE' });
}

console.log('\n' + (fails ? '✗ ' + fails + ' ÉCHEC(S) — la sécurité n’est PAS validée' : '✓ SÉCURITÉ VALIDÉE — tous les contrôles passent'));
process.exit(fails ? 1 : 0);

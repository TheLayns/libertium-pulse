// =====================================================================
// Accès aux données : Supabase en mode réel, générateur local en mode démo.
// Toutes les vues passent par ici — aucune autre couche ne parle au backend.
// =====================================================================
import { IS_DEMO, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { generateDemoData } from './demo.js';

let _sb = null;
export async function sb(){
  if (_sb) return _sb;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true }
  });
  return _sb;
}

// ----- Magasin démo (mutations locales, non persistées) -----
let _demo = null;
export function demoStore(){
  if (!_demo) _demo = generateDemoData();
  return _demo;
}

// ----- Chargement principal -----
export async function loadData(){
  if (IS_DEMO) {
    const d = demoStore();
    return { concessions: d.concessions, aliases: d.aliases, rows: d.rows };
  }
  const c = await sb();
  // PostgREST plafonne chaque requête à 1000 lignes : les métriques (plusieurs
  // milliers) doivent être chargées par pages, sinon la vue est amputée.
  const PAGE = 1000;
  const fetchAllMetrics = async () => {
    const all = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await c
        .from('metrics_monthly')
        .select('scope,target_id,channel,month,followers,reach,interactions,posts,sessions,users,rating,reviews_total,reviews_new,leads,ads_count,views')
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      all.push(...data);
      if (data.length < PAGE) break;
    }
    return all;
  };
  const [conc, ali, met] = await Promise.all([
    c.from('concessions').select('*').order('name'),
    c.from('account_aliases').select('*').range(0, 4999),
    fetchAllMetrics()
  ]);
  for (const r of [conc, ali]) if (r.error) throw r.error;
  return {
    concessions: conc.data.map(x => ({ ...x, city: x.city ?? '', brands: x.brands || [], ateliers: x.ateliers || [] })),
    aliases: ali.data,
    rows: met.map(x => ({ ...x, month: x.month.slice(0, 10) }))
  };
}

// ----- Administration : liste d'accès -----
export async function fetchAccessList(){
  if (IS_DEMO) return demoStore().accessList.slice();
  const { data, error } = await (await sb()).from('access_list').select('*').order('email');
  if (error) throw error;
  return data;
}
export async function upsertAccess(entry){
  if (IS_DEMO) {
    const list = demoStore().accessList;
    const i = list.findIndex(x => x.email === entry.email);
    if (i >= 0) list[i] = { ...list[i], ...entry }; else list.push({ active: true, ...entry });
    return;
  }
  const { error } = await (await sb()).from('access_list').upsert(entry);
  if (error) throw error;
}
export async function deleteAccess(email){
  if (IS_DEMO) {
    const list = demoStore().accessList;
    const i = list.findIndex(x => x.email === email);
    if (i >= 0) list.splice(i, 1);
    return;
  }
  const { error } = await (await sb()).from('access_list').delete().eq('email', email);
  if (error) throw error;
}

// ----- Administration : alias -----
export async function addAlias(alias){
  if (IS_DEMO) { demoStore().aliases.push(alias); return; }
  const { error } = await (await sb()).from('account_aliases').upsert(alias, { onConflict: 'channel,alias' });
  if (error) throw error;
}
export async function deleteAlias(channel, alias){
  if (IS_DEMO) {
    const a = demoStore().aliases;
    const i = a.findIndex(x => x.channel === channel && x.alias === alias);
    if (i >= 0) a.splice(i, 1);
    return;
  }
  const { error } = await (await sb()).from('account_aliases').delete().eq('channel', channel).eq('alias', alias);
  if (error) throw error;
}

// ----- Administration : imports -----
export async function fetchImports(){
  if (IS_DEMO) return demoStore().imports.slice().reverse();
  const { data, error } = await (await sb()).from('imports').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

// meta = {source, file_name, month_min, month_max, status, report}
// rows = lignes au format metrics_monthly
export async function importMetrics(meta, rows, importedBy){
  if (IS_DEMO) {
    const d = demoStore();
    rows.forEach(nr => {
      const i = d.rows.findIndex(r => r.scope === nr.scope && r.target_id === nr.target_id && r.channel === nr.channel && r.month === nr.month);
      if (i >= 0) d.rows[i] = { ...d.rows[i], ...nr }; else d.rows.push(nr);
    });
    d.imports.push({ id: d.imports.length + 1, created_at: new Date().toISOString(), imported_by: importedBy || 'demo',
      source: meta.source, file_name: meta.file_name, month_min: meta.month_min, month_max: meta.month_max,
      row_count: rows.length, status: meta.status || 'ok', report: meta.report || null });
    return d.imports.length;
  }
  const { data, error } = await (await sb()).rpc('import_metrics', { p_meta: meta, p_rows: rows });
  if (error) throw error;
  return data;
}

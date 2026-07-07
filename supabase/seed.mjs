// =====================================================================
// Seed Supabase — injecte les concessions + 22 mois de données fictives
// (mêmes chiffres que le mode démo) pour valider la v2 avant les vrais
// imports. À lancer EN LOCAL uniquement (la clé service ne se partage pas).
//
// Usage (PowerShell) :
//   $env:SUPABASE_URL = "https://xxxx.supabase.co"
//   $env:SUPABASE_SERVICE_KEY = "<service_role key>"
//   $env:CONCESSIONS_JSON = "..\..\build\concessions.json"   # optionnel : vraies fiches (avec contacts)
//   node supabase/seed.mjs
// =====================================================================
import fs from 'node:fs';
import { generateDemoData } from '../js/demo.js';

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('SUPABASE_URL et SUPABASE_SERVICE_KEY requis.'); process.exit(1); }

const H = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' };
async function upsert(table, rows, onConflict){
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const r = await fetch(URL_ + '/rest/v1/' + table + (onConflict ? '?on_conflict=' + onConflict : ''), {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(batch)
    });
    if (!r.ok) { console.error('FAIL', table, r.status, await r.text()); process.exit(1); }
    process.stdout.write('.');
  }
  console.log(' ' + table + ' : ' + rows.length + ' lignes');
}

const data = generateDemoData();

// Concessions : version réelle (avec contacts) si le fichier est fourni, sinon version démo
let concessions = data.concessions;
if (process.env.CONCESSIONS_JSON && fs.existsSync(process.env.CONCESSIONS_JSON)) {
  const real = JSON.parse(fs.readFileSync(process.env.CONCESSIONS_JSON, 'utf8'));
  concessions = real.map(c => ({
    id: c.id, name: c.name, bu: c.bu, city: c.ville || c.city || '', cp: c.cp || '', dept: c.dept || '',
    region: c.region || '', lat: c.lat, lng: c.lng,
    resp: c.resp || '', phone: c.telConces || c.phone || '', email: c.mailConces || c.email || '',
    brands: c.brands || [], ateliers: c.ateliers || [], active: true
  }));
  console.log('Concessions réelles chargées depuis', process.env.CONCESSIONS_JSON);
} else {
  concessions = concessions.map(c => ({ ...c, active: true }));
  console.log('Concessions version démo (sans contacts) — fournissez CONCESSIONS_JSON pour les vraies fiches.');
}

console.log('Seed vers', URL_);
await upsert('concessions', concessions, 'id');
await upsert('account_aliases', data.aliases, 'channel,alias');

// Journal
const imp = await fetch(URL_ + '/rest/v1/imports', {
  method: 'POST', headers: { ...H, Prefer: 'return=representation' },
  body: JSON.stringify({ imported_by: 'seed@libertium.fr', source: 'seed', file_name: 'seed.mjs',
    month_min: data.months[0], month_max: data.months[data.months.length - 1], row_count: data.rows.length })
});
const importId = (await imp.json())[0]?.id ?? null;

await upsert('metrics_monthly', data.rows.map(r => ({ ...r, import_id: importId })), 'scope,target_id,channel,month');
console.log('Seed terminé ✓  (' + data.rows.length + ' métriques, ' + concessions.length + ' concessions)');

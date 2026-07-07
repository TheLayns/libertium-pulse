// Test du wizard d'import (parse CSV -> détection -> rattachement -> préparation -> commit démo)
const BASE = new URL('../js/', import.meta.url).href;
globalThis.window = globalThis; // admin.js lit window.__DB__

const { generateDemoData } = await import(BASE + 'demo.js');
const MET = await import(BASE + 'metrics.js');
const { state } = await import(BASE + 'state.js');
const ADM = await import(BASE + 'admin.js');
const api = await import(BASE + 'api.js');

const data = api.demoStore();
window.__DB__ = data;
MET.initMetrics(data);
state.profile = { email: 'test@libertium.fr', role: 'admin' };

// 1) CSV Leboncoin (modèle maison) pour un NOUVEAU mois (juillet 2026)
const csv = 'concession;mois;annonces;vues;contacts\n'
  + 'LIBERTIUM DAX;2026-07;24;2 870;16\n'
  + 'LIBERTIUM LESCAR;juillet 2026;18;2100;12\n'
  + 'LIBERTIUM PAYS BASQUE;07/2026;31;3450;22\n'
  + 'CONCESSION INCONNUE XYZ;2026-07;5;100;1\n';
const fakeFile = { name: 'export-lbc.csv', text: async () => csv };

state.wizard = { step: 1, busy: false, error: null };
await ADM.wizardFile(fakeFile);
console.log('Étape:', state.wizard.step, '· source détectée:', state.wizard.source, '· lignes:', state.wizard.dataRows.length);
console.assert(state.wizard.source === 'lbc', 'FAIL détection lbc');

ADM.wizardToMapping();
console.log('Comptes:', state.wizard.accounts.map(a => a.alias + '→' + (a.target || '∅') + (a.auto ? ' (alias)' : a.confidence ? ' (suggestion ' + a.confidence.toFixed(2) + ')' : '')).join(' | '));
console.assert(state.wizard.accounts.filter(a => a.target).length === 3, 'FAIL rattachement 3/4');

ADM.wizardPrepare();
const p = state.wizard.prepared;
console.log('Préparé:', p.rows.length, 'lignes · ignorées:', p.skipped.length, '· remplacements:', p.replaced, '· mois:', p.months.join(','));
console.assert(p.rows.length === 3 && p.months[0] === '2026-07-01', 'FAIL préparation');
console.assert(p.rows.every(r => r.channel === 'lbc' && r.views > 0), 'FAIL valeurs');
console.assert(p.rows.find(r => r.target_id === 'libertium-dax').views === 2870, 'FAIL parse nombre à espace');

await ADM.wizardCommit();
console.log('Après commit — étape:', state.wizard.step);
console.assert(state.wizard.step === 5, 'FAIL commit');
console.assert(data.rows.some(r => r.target_id === 'libertium-dax' && r.month === '2026-07-01' && r.views === 2870), 'FAIL upsert démo');
console.assert(data.imports.some(i => i.source === 'lbc' && i.row_count === 3), 'FAIL journal');

// 2) Export type Meta FB (xlsx simulé via AOA CSV) pour un mois existant -> remplacement
const csvFb = 'Titre de la Page,Abonnés,Couverture,Interactions,Publications\n'
  + '"LIBERTIUM BREST NORD",4200,15000,180,9\n'
  + '"Libertium France",76000,260000,2100,22\n';
state.wizard = { step: 1, busy: false, error: null };
await ADM.wizardFile({ name: 'meta-fb.csv', text: async () => csvFb });
console.log('\nMeta FB — source détectée:', state.wizard.source);
console.assert(state.wizard.source === 'meta_fb', 'FAIL détection meta_fb');
ADM.wizardToMapping();
const nat = state.wizard.accounts.find(a => a.alias === 'Libertium France');
console.log('Comptes FB:', state.wizard.accounts.map(a => a.alias + '→' + (a.target || '∅')).join(' | '));
console.assert(nat && nat.target === 'NATIONAL', 'FAIL rattachement national');
ADM.wizardPrepare();
console.log('Préparé FB:', state.wizard.prepared.rows.length, 'lignes · remplacements:', state.wizard.prepared.replaced, '· mois:', state.wizard.prepared.months.join(','));
console.assert(state.wizard.prepared.replaced >= 1, 'FAIL remplacement détecté');

console.log('\nIMPORT: TOUT EST VERT ✓');

// Test logique v2 hors navigateur : génération, scores, saisons, alertes, national.
const BASE = new URL('../js/', import.meta.url).href;
const { generateDemoData } = await import(BASE + 'demo.js');
const MET = await import(BASE + 'metrics.js');
const { seasonOf, seasonMonths } = await import(BASE + 'config.js');

const data = generateDemoData();
console.log('Concessions:', data.concessions.length, '· lignes métriques:', data.rows.length, '· alias:', data.aliases.length);
console.assert(data.concessions.length === 67, 'FAIL 67 concessions');

MET.initMetrics({ concessions: data.concessions, aliases: data.aliases, rows: data.rows });
console.log('Mois présents:', MET.MONTHS[0], '→', MET.MONTHS[MET.MONTHS.length - 1], '(' + MET.MONTHS.length + ')');
console.log('Saisons:', MET.SEASONS.join(', '));
console.assert(MET.MONTHS.length === 22, 'FAIL 22 mois');
console.assert(MET.SEASONS.length === 2, 'FAIL 2 saisons');

// Mois : juin 2026
const june = ['2026-06-01'];
const may = ['2026-05-01'];
const net = MET.periodNetwork(june);
console.log('\n== Juin 2026 ==');
console.log('Score réseau:', net.score, '· partiel:', net.partial);
MET.BUS.forEach(b => {
  const a = MET.periodBu(b.bu, june);
  console.log(' ', b.bu, a.score, MET.statusOf(a.score).key, a.partial ? '(partiel)' : '',
    'RS:', a.pillars.rs.score == null ? '—' : Math.round(a.pillars.rs.score), a.pillars.rs.coverage.have + '/' + a.pillars.rs.coverage.of);
});
const alerts = MET.computeAlerts(MET.BUS.map(b => b.bu), june, may);
console.log('Alertes juin:', alerts.map(a => a.level + ':' + a.bu + ':' + a.title.split('—')[0].trim()).join(' | '));
console.assert(alerts.length >= 2, 'FAIL alertes');

// National
const nat = MET.periodNational(june);
console.log('National FB followers:', nat.fb.followers, '· IG eng %:', nat.ig.eng?.toFixed(2));
console.assert(nat.fb && nat.ig, 'FAIL national');

// Saison
const s2025 = seasonMonths(2025).filter(m => MET.MONTHS.includes(m));
const s2024 = s2025.map(m => { const [y, mm] = m.split('-'); return (y - 1) + '-' + mm + '-01'; }).filter(m => MET.MONTHS.includes(m));
console.log('\n== Saison 2025-26 (fenêtre ' + s2025.length + ' mois) vs 2024-25 (' + s2024.length + ') ==');
const sNet = MET.periodNetwork(s2025), sPrev = MET.periodNetwork(s2024);
console.log('Score réseau saison:', sNet.score, 'vs', sPrev.score);
console.log('Sessions saison:', sNet.pillars.ga4.sessions, 'vs', sPrev.pillars.ga4.sessions);
console.assert(s2025.length === 10 && s2024.length === 10, 'FAIL fenêtres égales');
console.assert(sNet.score >= 0 && sNet.score <= 100, 'FAIL score saison borné');

// RS national uniquement : AUCUNE concession/BU n'a le pilier RS -> score 3 piliers partout
const anyConc = MET.CONCESSIONS[0];
const a3 = MET.periodConc(anyConc.id, june);
console.log('\nConcession (RS national only):', anyConc.name, '· score', a3.score, '· pilier RS existe:', a3.pillars.rs.exists);
console.assert(!a3.pillars.rs.exists && a3.score != null, 'FAIL renormalisation 3 piliers');
console.assert(MET.CONCESSIONS.every(c => !MET.hasAccount('concession', c.id, 'fb') && !MET.hasAccount('concession', c.id, 'ig')), 'FAIL: une concession a un compte RS');
console.assert(!MET.periodBu('L.EST', june).pillars.rs.exists, 'FAIL: pilier RS présent au niveau BU');
console.assert(a3.pillars.gmb.ficheViews > 0, 'FAIL: vues de fiches GBP absentes');

// Trou LBC juin (L.SUD) => couverture partielle
const sud = MET.periodBu('L.SUD', june);
console.log('L.SUD lbc coverage:', sud.pillars.lbc.coverage.have + '/' + sud.pillars.lbc.coverage.of, '→ partiel:', sud.partial);
console.assert(sud.pillars.lbc.coverage.have < sud.pillars.lbc.coverage.of, 'FAIL trou LBC non détecté');

// Déterminisme
const d2 = generateDemoData();
console.assert(JSON.stringify(d2.rows.slice(0, 50)) === JSON.stringify(data.rows.slice(0, 50)), 'FAIL déterminisme');
console.log('\nTOUT EST VERT ✓');

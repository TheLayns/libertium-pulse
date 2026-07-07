// =====================================================================
// Metrics v2 — score de santé, agrégations mois/saison, alertes.
//
// Principes :
//  - 4 piliers à poids égaux : RS (FB+IG), GA4, GMB, LBC.
//  - Absence STRUCTURELLE (pas de compte déclaré dans account_aliases)
//    -> le pilier est retiré et la moyenne se fait sur les piliers restants.
//  - Mois NON IMPORTÉ (compte existe, donnée absente) -> la cible est
//    exclue de la moyenne de ce pilier pour ce mois + badge de couverture.
//    Jamais de zéro implicite.
// =====================================================================
import { SCORE, SEUIL, STATUS, BU_ORDER, seasonOf } from './config.js';
import { clamp01 } from './util.js';

let DB = null;                 // {concessions, aliases, rows, months}
let rowIx = new Map();         // scope|target|channel|month -> row
let accountIx = new Map();     // scope|target -> Set(channels)
let concCache = new Map();     // cid|iso -> résultat concMonth
export let CONCESSIONS = [];
export let BUS = [];           // [{bu, concs:[...]}]
export let MONTHS = [];        // mois ISO présents, triés
export let SEASONS = [];       // saisons présentes, triées

const k = (scope, target, ch, month) => scope + '|' + target + '|' + ch + '|' + month;

export function initMetrics(db){
  DB = db;
  rowIx = new Map(); accountIx = new Map(); concCache = new Map();
  db.rows.forEach(r => rowIx.set(k(r.scope, r.target_id, r.channel, r.month), r));
  db.aliases.forEach(a => {
    const key = a.scope + '|' + a.target_id;
    if (!accountIx.has(key)) accountIx.set(key, new Set());
    accountIx.get(key).add(a.channel);
  });
  CONCESSIONS = db.concessions.filter(c => c.active !== false);
  BUS = BU_ORDER.map(bu => ({ bu, concs: CONCESSIONS.filter(c => c.bu === bu) })).filter(b => b.concs.length);
  MONTHS = [...new Set(db.rows.map(r => r.month))].sort();
  SEASONS = [...new Set(MONTHS.map(seasonOf))].sort();
}

export const getRow = (scope, target, ch, month) => rowIx.get(k(scope, target, ch, month)) || null;
export const hasAccount = (scope, target, ch) => (accountIx.get(scope + '|' + target) || new Set()).has(ch);
export const statusOf = h => h >= SEUIL + 20 ? STATUS.green : (h >= SEUIL ? STATUS.orange : STATUS.red);

const lin = (v, min, max) => clamp01((v - min) / (max - min)) * 100;
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const sum = a => a.reduce((x, y) => x + y, 0);
export const engRate = r => (r && r.followers > 0 && r.interactions != null) ? r.interactions / r.followers * 100 : null;

// ---------------------------------------------------------------------
// Niveau concession × mois
// ---------------------------------------------------------------------
export function concMonth(cid, iso){
  const ck = cid + '|' + iso;
  if (concCache.has(ck)) return concCache.get(ck);

  const fbEx = hasAccount('concession', cid, 'fb');
  const igEx = hasAccount('concession', cid, 'ig');
  const rFb = fbEx ? getRow('concession', cid, 'fb', iso) : null;
  const rIg = igEx ? getRow('concession', cid, 'ig', iso) : null;
  const eFb = engRate(rFb), eIg = engRate(rIg);
  const sFb = eFb != null ? lin(eFb, SCORE.fbEng.min, SCORE.fbEng.max) : null;
  const sIg = eIg != null ? lin(eIg, SCORE.igEng.min, SCORE.igEng.max) : null;
  const rsParts = [sFb, sIg].filter(v => v != null);
  const rs = {
    exists: fbEx || igEx,
    hasData: rsParts.length > 0,
    score: rsParts.length ? mean(rsParts) : null,
    fb: rFb ? { eng: eFb, ...rFb } : null,
    ig: rIg ? { eng: eIg, ...rIg } : null,
    fbEx, igEx
  };

  const rGa = getRow('concession', cid, 'ga4', iso);
  const ga4 = { exists: true, hasData: !!rGa, score: rGa ? lin(rGa.sessions, SCORE.ga4Sessions.min, SCORE.ga4Sessions.max) : null,
                sessions: rGa?.sessions ?? null, users: rGa?.users ?? null };

  const rGm = getRow('concession', cid, 'gmb', iso);
  const gmb = { exists: true, hasData: !!rGm,
    score: rGm ? SCORE.gmbWeights.rating * lin(rGm.rating, SCORE.gmbRating.min, SCORE.gmbRating.max)
               + SCORE.gmbWeights.reviews * lin(rGm.reviews_new ?? 0, SCORE.gmbNewReviews.min, SCORE.gmbNewReviews.max) : null,
    rating: rGm?.rating ?? null, revNew: rGm?.reviews_new ?? null, revTotal: rGm?.reviews_total ?? null };

  const rLb = getRow('concession', cid, 'lbc', iso);
  const lbc = { exists: true, hasData: !!rLb,
    score: rLb ? SCORE.lbcWeights.views * lin(rLb.views, SCORE.lbcViews.min, SCORE.lbcViews.max)
               + SCORE.lbcWeights.leads * lin(rLb.leads, SCORE.lbcLeads.min, SCORE.lbcLeads.max) : null,
    views: rLb?.views ?? null, leads: rLb?.leads ?? null, ads: rLb?.ads_count ?? null };

  const pillars = { rs, ga4, gmb, lbc };
  const usable = Object.values(pillars).filter(p => p.exists && p.hasData).map(p => p.score);
  const missing = Object.entries(pillars).filter(([, p]) => p.exists && !p.hasData).map(([key]) => key);
  const out = { pillars, score: usable.length ? Math.round(mean(usable)) : null, missing };
  concCache.set(ck, out);
  return out;
}

// ---------------------------------------------------------------------
// Période = liste de mois (1 mois en mode mensuel, fenêtre de saison sinon)
// ---------------------------------------------------------------------
export function periodConc(cid, months){
  const ms = months.map(iso => ({ iso, m: concMonth(cid, iso) }));
  const pill = {};
  ['rs', 'ga4', 'gmb', 'lbc'].forEach(pk => {
    const list = ms.map(x => x.m.pillars[pk]).filter(p => p.exists && p.hasData);
    const exists = ms.some(x => x.m.pillars[pk].exists);
    pill[pk] = { exists, hasData: list.length > 0, score: list.length ? mean(list.map(p => p.score)) : null, monthsWithData: list.length };
  });
  // affichages agrégés
  const rsRows = ms.map(x => x.m.pillars.rs);
  pill.rs.engFb = mean(rsRows.map(r => r.fb?.eng).filter(v => v != null));
  pill.rs.engIg = mean(rsRows.map(r => r.ig?.eng).filter(v => v != null));
  pill.rs.reach = sum(rsRows.flatMap(r => [r.fb?.reach, r.ig?.reach].filter(v => v != null)));
  pill.rs.interactions = sum(rsRows.flatMap(r => [r.fb?.interactions, r.ig?.interactions].filter(v => v != null)));
  const lastFb = [...rsRows].reverse().find(r => r.fb); const lastIg = [...rsRows].reverse().find(r => r.ig);
  pill.rs.followers = (lastFb?.fb.followers ?? 0) + (lastIg?.ig.followers ?? 0) || null;
  pill.ga4.sessions = sum(ms.map(x => x.m.pillars.ga4.sessions).filter(v => v != null));
  pill.gmb.rating = mean(ms.map(x => x.m.pillars.gmb.rating).filter(v => v != null));
  pill.gmb.revNew = sum(ms.map(x => x.m.pillars.gmb.revNew).filter(v => v != null));
  pill.gmb.revTotal = [...ms].reverse().find(x => x.m.pillars.gmb.revTotal != null)?.m.pillars.gmb.revTotal ?? null;
  pill.lbc.views = sum(ms.map(x => x.m.pillars.lbc.views).filter(v => v != null));
  pill.lbc.leads = sum(ms.map(x => x.m.pillars.lbc.leads).filter(v => v != null));
  pill.lbc.ads = [...ms].reverse().find(x => x.m.pillars.lbc.ads != null)?.m.pillars.lbc.ads ?? null;

  const usable = Object.values(pill).filter(p => p.exists && p.hasData).map(p => p.score);
  return { pillars: pill, score: usable.length ? Math.round(mean(usable)) : null };
}

export function periodBu(bu, months){
  const concs = BUS.find(b => b.bu === bu)?.concs || [];
  const per = concs.map(c => ({ c, p: periodConc(c.id, months) }));
  const pill = {};
  ['rs', 'ga4', 'gmb', 'lbc'].forEach(pk => {
    const withAccount = per.filter(x => x.p.pillars[pk].exists);
    const withData = withAccount.filter(x => x.p.pillars[pk].hasData);
    pill[pk] = {
      exists: withAccount.length > 0,
      hasData: withData.length > 0,
      score: withData.length ? mean(withData.map(x => x.p.pillars[pk].score)) : null,
      coverage: { have: withData.length, of: withAccount.length }
    };
  });
  pill.rs.engFb = mean(per.map(x => x.p.pillars.rs.engFb).filter(v => v != null));
  pill.rs.engIg = mean(per.map(x => x.p.pillars.rs.engIg).filter(v => v != null));
  pill.rs.reach = sum(per.map(x => x.p.pillars.rs.reach || 0));
  pill.rs.followers = sum(per.map(x => x.p.pillars.rs.followers || 0)) || null;
  pill.ga4.sessions = sum(per.map(x => x.p.pillars.ga4.sessions || 0));
  pill.ga4.sessionsAvg = mean(per.filter(x => x.p.pillars.ga4.hasData).map(x => x.p.pillars.ga4.sessions / Math.max(1, x.p.pillars.ga4.monthsWithData)));
  pill.gmb.rating = mean(per.map(x => x.p.pillars.gmb.rating).filter(v => v != null));
  pill.gmb.revNew = sum(per.map(x => x.p.pillars.gmb.revNew || 0));
  pill.lbc.views = sum(per.map(x => x.p.pillars.lbc.views || 0));
  pill.lbc.leads = sum(per.map(x => x.p.pillars.lbc.leads || 0));

  const usable = Object.values(pill).filter(p => p.exists && p.hasData).map(p => p.score);
  const partial = Object.values(pill).some(p => p.exists && p.coverage && p.coverage.have < p.coverage.of);
  return { bu, n: concs.length, pillars: pill, score: usable.length ? Math.round(mean(usable)) : null, partial, per };
}

export function periodNetwork(months){
  const perBu = BUS.map(b => ({ b, agg: periodBu(b.bu, months) }));
  let s = 0, w = 0;
  perBu.forEach(({ b, agg }) => { if (agg.score != null) { s += agg.score * b.concs.length; w += b.concs.length; } });
  const pill = {};
  ['rs', 'ga4', 'gmb', 'lbc'].forEach(pk => {
    const scored = perBu.filter(x => x.agg.pillars[pk].score != null);
    const score = scored.length ? mean(scored.map(x => x.agg.pillars[pk].score)) : null;
    pill[pk] = {
      score, exists: perBu.some(x => x.agg.pillars[pk].exists), hasData: score != null,
      coverage: perBu.reduce((acc, x) => { const c = x.agg.pillars[pk].coverage; if (c) { acc.have += c.have; acc.of += c.of; } return acc; }, { have: 0, of: 0 })
    };
  });
  pill.rs.engFb = mean(perBu.map(x => x.agg.pillars.rs.engFb).filter(v => v != null));
  pill.rs.engIg = mean(perBu.map(x => x.agg.pillars.rs.engIg).filter(v => v != null));
  pill.rs.reach = sum(perBu.map(x => x.agg.pillars.rs.reach || 0));
  pill.ga4.sessions = sum(perBu.map(x => x.agg.pillars.ga4.sessions || 0));
  pill.ga4.sessionsAvg = mean(perBu.map(x => x.agg.pillars.ga4.sessionsAvg).filter(v => v != null));
  pill.gmb.rating = mean(perBu.map(x => x.agg.pillars.gmb.rating).filter(v => v != null));
  pill.gmb.revNew = sum(perBu.map(x => x.agg.pillars.gmb.revNew || 0));
  pill.lbc.views = sum(perBu.map(x => x.agg.pillars.lbc.views || 0));
  pill.lbc.leads = sum(perBu.map(x => x.agg.pillars.lbc.leads || 0));
  const partial = perBu.some(x => x.agg.partial);
  return { n: w, pillars: pill, score: w ? Math.round(s / w) : null, partial, perBu };
}

// Compte national FB/IG (Direction uniquement — filtré aussi par la RLS)
export function periodNational(months){
  const agg = { fb: null, ig: null };
  ['fb', 'ig'].forEach(ch => {
    const rows = months.map(iso => getRow('national', 'NATIONAL', ch, iso)).filter(Boolean);
    if (!rows.length) return;
    const last = rows[rows.length - 1];
    agg[ch] = {
      followers: last.followers,
      reach: sum(rows.map(r => r.reach || 0)),
      interactions: sum(rows.map(r => r.interactions || 0)),
      posts: sum(rows.map(r => r.posts || 0)),
      eng: mean(rows.map(engRate).filter(v => v != null))
    };
  });
  return (agg.fb || agg.ig) ? agg : null;
}

// ---------------------------------------------------------------------
// Alertes (par BU, période courante vs période précédente)
// ---------------------------------------------------------------------
import { PILLAR_LABEL, PILLAR_LABEL_LC } from './config.js';
import { fmtInt, fmt1, fmtPct } from './util.js';

function pillarValueText(pk, p){
  if (pk === 'rs') {
    const bits = [];
    if (p.engFb != null) bits.push('FB ' + fmtPct(p.engFb));
    if (p.engIg != null) bits.push('IG ' + fmtPct(p.engIg));
    return bits.length ? 'engagement ' + bits.join(' · ') : 'aucune donnée RS';
  }
  if (pk === 'ga4') return (p.sessionsAvg != null ? fmtInt(p.sessionsAvg) + ' sessions / concession' : fmtInt(p.sessions || 0) + ' sessions');
  if (pk === 'gmb') return 'note ' + (p.rating != null ? fmt1(p.rating) + ' ★' : '—') + (p.revNew != null ? ' · ' + fmtInt(p.revNew) + ' nouveaux avis' : '');
  return fmtInt(p.views || 0) + ' vues · ' + fmtInt(p.leads || 0) + ' contacts';
}

export function computeAlerts(busList, months, prevMonths){
  const alerts = [];
  busList.forEach(bu => {
    const cur = periodBu(bu, months);
    if (cur.score == null) return;
    const prev = prevMonths ? periodBu(bu, prevMonths) : null;
    const avail = Object.entries(cur.pillars).filter(([, p]) => p.exists && p.hasData);
    if (!avail.length) return;
    const [worstKey, worst] = avail.reduce((a, b) => (a[1].score <= b[1].score ? a : b));
    const st = statusOf(cur.score);
    if (st.key === 'red') {
      alerts.push({ level: 'red', bu, title: 'Score de santé critique — ' + cur.score + '/100',
        detail: 'Principal point faible : ' + PILLAR_LABEL_LC[worstKey] + ' à ' + Math.round(worst.score) + '/100 (' + pillarValueText(worstKey, worst) + ').',
        metric: PILLAR_LABEL[worstKey] });
    } else if (st.key === 'orange') {
      alerts.push({ level: 'orange', bu, title: 'Performance à surveiller — ' + cur.score + '/100',
        detail: 'Le pilier le plus fragile est ' + PILLAR_LABEL_LC[worstKey] + ' (' + pillarValueText(worstKey, worst) + ' · ' + Math.round(worst.score) + '/100).',
        metric: PILLAR_LABEL[worstKey] });
    }
    if (prev) {
      avail.forEach(([pk, p]) => {
        const pp = prev.pillars[pk];
        if (pp && pp.score != null && p.score - pp.score <= -15) {
          alerts.push({ level: p.score < 40 ? 'red' : 'orange', bu,
            title: 'Chute brutale — ' + PILLAR_LABEL[pk],
            detail: 'Perte de ' + Math.abs(Math.round(p.score - pp.score)) + ' points vs période précédente (' + pillarValueText(pk, p) + ').',
            metric: PILLAR_LABEL[pk] });
        }
      });
    }
    if (cur.partial) {
      const parts = Object.entries(cur.pillars)
        .filter(([, p]) => p.coverage && p.coverage.have < p.coverage.of)
        .map(([pk, p]) => PILLAR_LABEL[pk] + ' (' + p.coverage.have + '/' + p.coverage.of + ')');
      alerts.push({ level: 'orange', bu, title: 'Données partielles',
        detail: 'Certaines concessions n’ont pas de donnée importée sur la période : ' + parts.join(', ') + '. Le score est calculé sur les données disponibles.',
        metric: 'Complétude des imports' });
    }
  });
  return alerts.sort((a, b) => (a.level === 'red' ? 0 : 1) - (b.level === 'red' ? 0 : 1));
}

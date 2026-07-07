// =====================================================================
// Générateur de données fictives v2 — déterministe (même rendu à chaque
// ouverture). Utilisé par le MODE DÉMO du front et par supabase/seed.mjs.
// Périmètre : sept 2024 -> juin 2026 (saison 2024-25 complète + 2025-26
// en cours), canaux fb / ig / ga4 / gmb / lbc, compte national FB+IG.
// =====================================================================
import { DEMO_CONCESSIONS } from './demo-concessions.js';
import { mulberry32, hashStr, clamp } from './util.js';

export const DEMO_MONTHS = (() => {
  const out = [];
  let y = 2024, m = 9;
  while (y < 2026 || (y === 2026 && m <= 6)) {
    out.push(y + '-' + String(m).padStart(2, '0') + '-01');
    m++; if (m > 12) { m = 1; y++; }
  }
  return out; // 22 mois
})();

// Saisonnalité camping-car : pic juin, creux décembre
const seasonFactor = iso => {
  const m = +iso.split('-')[1];
  return 1 + 0.18 * Math.cos(2 * Math.PI * (m - 6) / 12);
};

// Quelles concessions ont des comptes RS propres (déterministe) :
// ~la moitié a une page Facebook, un tiers de celles-ci a aussi Instagram.
export function rsAccounts(concessions){
  const fb = [], ig = [];
  concessions.forEach(c => {
    const h = hashStr(c.id + ':rs') % 100;
    if (h < 48) { fb.push(c.id); if (h < 16) ig.push(c.id); }
  });
  return { fb: new Set(fb), ig: new Set(ig) };
}

export function generateDemoData(){
  const concessions = DEMO_CONCESSIONS.map(c => ({ ...c, resp: '', phone: '', email: '' }));
  const { fb: hasFb, ig: hasIg } = rsAccounts(concessions);

  const aliases = [];
  concessions.forEach(c => {
    aliases.push({ channel: 'ga4', alias: c.name, scope: 'concession', target_id: c.id });
    aliases.push({ channel: 'gmb', alias: c.name, scope: 'concession', target_id: c.id });
    aliases.push({ channel: 'lbc', alias: c.name, scope: 'concession', target_id: c.id });
    if (hasFb.has(c.id)) aliases.push({ channel: 'fb', alias: c.name, scope: 'concession', target_id: c.id });
    if (hasIg.has(c.id)) aliases.push({ channel: 'ig', alias: c.name + ' (IG)', scope: 'concession', target_id: c.id });
  });
  aliases.push({ channel: 'fb', alias: 'Libertium France', scope: 'national', target_id: 'NATIONAL' });
  aliases.push({ channel: 'ig', alias: 'libertium_officiel', scope: 'national', target_id: 'NATIONAL' });

  const rows = [];
  const push = (scope, target, channel, month, vals) =>
    rows.push({ scope, target_id: target, channel, month, ...vals });

  // ----- concessions -----
  concessions.forEach(c => {
    const rng = mulberry32(hashStr(c.id));
    const drift = (rng() - 0.42) * 0.03;
    const base = {
      sessions: 1600 + rng() * 3000,
      rating: 3.8 + rng() * 1.0,
      revTotal: Math.round(20 + rng() * 380),
      ads: Math.round(8 + rng() * 32),
      viewsPerAd: 100 + rng() * 120,
      leadRate: 0.004 + rng() * 0.004,          // contacts / vue
      fbFollowers: Math.round(800 + rng() * 14000),
      fbEng: 3.0 + rng() * 3.0,                 // % engagement FB
      igFollowers: Math.round(500 + rng() * 7500),
      igEng: 4.0 + rng() * 4.5                  // % engagement IG
    };
    let rating = base.rating, revTotal = base.revTotal;
    let fbF = base.fbFollowers, igF = base.igFollowers;

    DEMO_MONTHS.forEach((iso, mi) => {
      const s = seasonFactor(iso), d = Math.pow(1 + drift, mi);
      const n = () => 1 + (rng() - 0.5) * 0.16;

      // --- scénario démo (histoires visibles, déterministes) ---
      let fGa4 = 1, fFbEng = 1, fLbc = 1, dRating = 0;
      if (c.bu === 'L.OUEST') {
        if (iso === '2026-04-01') { fGa4 = .82; fFbEng = .88; }
        if (iso === '2026-05-01') { fGa4 = .62; fFbEng = .72; fLbc = .9; }
        if (iso === '2026-06-01') { fGa4 = .32; fFbEng = .44; fLbc = .52; }
      }
      if (c.bu === 'L.SUD-OUEST') {
        if (iso === '2026-05-01') fLbc = .8;
        if (iso === '2026-06-01') fLbc = .4;
      }
      if (c.bu === 'L.EST') {
        if (iso === '2026-05-01') dRating = -.2;
        if (iso === '2026-06-01') dRating = -.3;
      }

      // GA4
      const sessions = Math.round(base.sessions * s * d * n() * fGa4);
      push('concession', c.id, 'ga4', iso, { sessions, users: Math.round(sessions * (0.68 + rng() * 0.1)) });

      // GMB
      rating = clamp(rating + (rng() - 0.5) * 0.09 + dRating * 0.5, 3.1, 4.9);
      const revNew = Math.max(0, Math.round((3 + rng() * 9) * s * (dRating ? 0.6 : 1)));
      revTotal += revNew;
      push('concession', c.id, 'gmb', iso, { rating: Math.round(rating * 10) / 10, reviews_total: revTotal, reviews_new: revNew });

      // LBC — trou volontaire : 3 concessions L.SUD sans donnée en juin 2026
      const lbcHole = iso === '2026-06-01' && c.bu === 'L.SUD' && hashStr(c.id + ':hole') % 7 === 0;
      if (!lbcHole) {
        const ads = Math.max(3, Math.round(base.ads * (0.9 + rng() * 0.2)));
        const views = Math.round(ads * base.viewsPerAd * s * d * n() * fLbc);
        push('concession', c.id, 'lbc', iso, { ads_count: ads, views, leads: Math.round(views * base.leadRate * fLbc) });
      }

      // Facebook / Instagram (uniquement les concessions équipées)
      if (hasFb.has(c.id)) {
        fbF = Math.round(fbF * (1 + 0.004 + rng() * 0.008));
        const eng = clamp(base.fbEng * s * d * n() * fFbEng, 0.3, 9);
        push('concession', c.id, 'fb', iso, {
          followers: fbF, posts: Math.round(4 + rng() * 14),
          reach: Math.round(fbF * (1.6 + rng() * 2.2) * s),
          interactions: Math.round(fbF * eng / 100)
        });
      }
      if (hasIg.has(c.id)) {
        igF = Math.round(igF * (1 + 0.006 + rng() * 0.012));
        const eng = clamp(base.igEng * s * d * n() * fFbEng, 0.4, 12);
        push('concession', c.id, 'ig', iso, {
          followers: igF, posts: Math.round(6 + rng() * 16),
          reach: Math.round(igF * (2 + rng() * 3) * s),
          interactions: Math.round(igF * eng / 100)
        });
      }
    });
  });

  // ----- compte national (croissance saine, visible Direction uniquement) -----
  {
    const rng = mulberry32(hashStr('NATIONAL'));
    let fbF = 62000, igF = 34000;
    DEMO_MONTHS.forEach(iso => {
      const s = seasonFactor(iso), n = () => 1 + (rng() - 0.5) * 0.12;
      fbF = Math.round(fbF * (1 + 0.006 + rng() * 0.006));
      igF = Math.round(igF * (1 + 0.012 + rng() * 0.01));
      push('national', 'NATIONAL', 'fb', iso, {
        followers: fbF, posts: Math.round(18 + rng() * 10),
        reach: Math.round(fbF * (2.4 + rng() * 1.4) * s),
        interactions: Math.round(fbF * clamp(2.4 * s * n(), 0.5, 8) / 100)
      });
      push('national', 'NATIONAL', 'ig', iso, {
        followers: igF, posts: Math.round(22 + rng() * 12),
        reach: Math.round(igF * (3.2 + rng() * 2) * s),
        interactions: Math.round(igF * clamp(3.8 * s * n(), 0.8, 11) / 100)
      });
    });
  }

  const accessList = [
    { email: 'nuxnux02290@gmail.com', role: 'admin', bu: null, display_name: 'Admin (toi)', active: true },
    { email: 'chef@libertium.fr', role: 'admin', bu: null, display_name: 'Ton chef', active: true },
    { email: 'directeur.ouest@libertium.fr', role: 'directeur_bu', bu: 'L.OUEST', display_name: 'Directeur L.OUEST', active: true }
  ];
  const imports = [{
    id: 1, created_at: '2026-07-06T09:41:00Z', imported_by: 'demo@libertium.fr', source: 'seed',
    file_name: 'seed-demo.mjs', month_min: DEMO_MONTHS[0], month_max: DEMO_MONTHS[DEMO_MONTHS.length - 1],
    row_count: rows.length, status: 'ok', report: null
  }];

  return { concessions, aliases, rows, accessList, imports, months: DEMO_MONTHS.slice() };
}

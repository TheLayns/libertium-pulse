// =====================================================================
// Libertium Pulse v2 — configuration
// =====================================================================

// --- Supabase --------------------------------------------------------
// Laisser vide => MODE DÉMO (données fictives locales, aucun backend).
// Après création du projet Supabase (voir README), renseigner les deux
// valeurs ci-dessous : l'application bascule automatiquement en mode réel.
export const SUPABASE_URL = 'https://efowzpbhcwjqxersniug.supabase.co';
// Clé « publishable » (nouveau format Supabase) — publique par design, la RLS protège.
export const SUPABASE_ANON_KEY = 'sb_publishable_GlF9lOwLOFxBmeIrOyJGhw_A9vSqt1Y';
export const IS_DEMO = !SUPABASE_URL;

// --- Charte (Carte Libertium France) ---------------------------------
export const BU_ORDER = ['L.EST','L.LOIRE','L.OUEST','L.RENNES','L.STRASBOURG','L.SUD','L.SUD-OUEST'];
// brand = couleur exacte de la carte ; chart = variante validée dataviz
export const BU_COLORS = {
  'L.EST':        {brand:'#E8722B', chart:'#D96420', marker:'#E8722B'},
  'L.LOIRE':      {brand:'#4FA39B', chart:'#0F9180', marker:'#4FA39B'},
  'L.OUEST':      {brand:'#E0489E', chart:'#D63A8F', marker:'#E0489E'},
  'L.RENNES':     {brand:'#B58FD9', chart:'#7E4FB5', marker:'#7E4FB5'},
  'L.STRASBOURG': {brand:'#7FB8E6', chart:'#2E6FB0', marker:'#2E6FB0'},
  'L.SUD':        {brand:'#1F3A8A', chart:'#3A5FC2', marker:'#1F3A8A'},
  'L.SUD-OUEST':  {brand:'#E3B12E', chart:'#B8891A', marker:'#E3B12E'}
};
export const STATUS = {
  green:  {key:'green',  solid:'#1aa053', bg:'#e7f6ee', text:'#116b38', label:'Bonne santé', ic:'●'},
  orange: {key:'orange', solid:'#e8870f', bg:'#fdf3e4', text:'#9a5a06', label:'À surveiller', ic:'●'},
  red:    {key:'red',    solid:'#e0413a', bg:'#fdecea', text:'#C12A21', label:'Alerte', ic:'●'}
};

// --- Score de santé ---------------------------------------------------
export const SEUIL = 50;              // rouge < 50 · orange 50-69 · vert >= 70
export const SCORE = {
  // Réseaux sociaux : taux d'engagement mensuel = interactions / followers × 100
  fbEng: {min: 1, max: 6},            // Facebook : 1 % -> 6 %
  igEng: {min: 1, max: 8},            // Instagram : 1 % -> 8 % (structurellement plus élevé)
  ga4Sessions: {min: 800, max: 4000}, // sessions / mois / concession
  gmbRating: {min: 3, max: 4.8},
  gmbNewReviews: {min: 0, max: 10},   // nouveaux avis / mois
  gmbWeights: {rating: 0.7, reviews: 0.3},
  lbcViews: {min: 0, max: 5000},      // vues d'annonces / mois
  lbcLeads: {min: 0, max: 25},        // contacts / mois
  lbcWeights: {views: 0.5, leads: 0.5}
};

// --- Canaux (métadonnées d'affichage) ---------------------------------
export const CHANNELS = {
  fb:  {name:'Facebook',  fullName:'Meta — Page Facebook nationale', tag:'Réseaux sociaux',
        desc:'Page Facebook nationale « Libertium France » : abonnés, portée organique, interactions et publications. Les concessions n’ont pas de page propre — ces indicateurs sont visibles en vision globale uniquement et n’entrent pas dans le score des BU.'},
  ig:  {name:'Instagram', fullName:'Meta — Compte Instagram national', tag:'Réseaux sociaux',
        desc:'Compte Instagram national : abonnés, portée, interactions et publications. Comme Facebook, il n’existe qu’au niveau national (vision globale uniquement).'},
  ga4: {name:'Sessions site', fullName:'Google Analytics 4', tag:'Site web',
        desc:'Sessions mensuelles sur le site Libertium, ventilées par concession. Le score utilise la moyenne de sessions par concession.'},
  gmb: {name:'Fiches Google', fullName:'Google Business Profile', tag:'Visibilité locale',
        desc:'Fiches Google des concessions : note moyenne, avis (total et nouveaux du mois) et vues des fiches. Le score combine la note (70 %) et le volume de nouveaux avis (30 %) ; les vues sont informatives.'},
  lbc: {name:'Leboncoin', fullName:'Leboncoin Pro', tag:'Annonces',
        desc:'Annonces Leboncoin : volume actif, vues et contacts reçus. Le score combine les vues (50 %) et les contacts (50 %). Saisie via le modèle CSV fourni (pas d’API Leboncoin).'}
};

// Libellés utilisés par les alertes / diagnostics (piliers)
export const PILLARS = ['rs','ga4','gmb','lbc'];
export const PILLAR_LABEL = {rs:'Réseaux sociaux (FB + IG)', ga4:'Trafic site (GA4)', gmb:'Fiches Google (GBP)', lbc:'Visibilité Leboncoin'};
export const PILLAR_LABEL_LC = {rs:'les réseaux sociaux (FB + IG)', ga4:'le trafic site (GA4)', gmb:'les fiches Google (GBP)', lbc:'la visibilité Leboncoin'};

// --- Temps : mois ISO ('YYYY-MM-01') et saisons Libertium (sept -> août)
export const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
export const MONTH_SHORT = ['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'];
export const monthLabel = iso => { const [y,m] = iso.split('-'); return MONTH_NAMES[+m-1]+' '+y; };
export const monthShort = iso => { const [y,m] = iso.split('-'); return MONTH_SHORT[+m-1]; };
export const monthShortYear = iso => { const [y,m] = iso.split('-'); return MONTH_SHORT[+m-1]+' '+String(y).slice(2); };
export const seasonOf = iso => { const [y,m] = iso.split('-').map(Number); return m >= 9 ? y : y-1; };
export const seasonLabel = s => 'Saison '+s+'-'+String(s+1).slice(2);
export const seasonMonths = s => { // les 12 mois ISO d'une saison
  const out = [];
  for(let i=0;i<12;i++){ const m=(9+i-1)%12+1, y=s+(9+i>12?1:0); out.push(y+'-'+String(m).padStart(2,'0')+'-01'); }
  return out;
};
export const addMonths = (iso, n) => { let [y,m] = iso.split('-').map(Number); m+=n; y+=Math.floor((m-1)/12); m=((m-1)%12+12)%12+1; return y+'-'+String(m).padStart(2,'0')+'-01'; };

export const SVG_CITIES = [['Paris',48.86,2.35],['Lyon',45.76,4.84],['Marseille',43.30,5.37],['Toulouse',43.60,1.44],['Bordeaux',44.84,-0.58],['Nantes',47.22,-1.55],['Rennes',48.11,-1.68],['Lille',50.63,3.06],['Strasbourg',48.57,7.75]];

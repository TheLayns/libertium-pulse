// Utilitaires partagés (formatage, PRNG, échappement)
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
export const clamp01 = v => clamp(v, 0, 1);
export const fmtInt = n => Math.round(n).toLocaleString('fr-FR');
export const fmtK = n => n>=10000 ? (n/1000).toLocaleString('fr-FR',{maximumFractionDigits:1})+' k' : fmtInt(n);
export const fmt1 = n => n.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
export const fmt2 = n => n.toLocaleString('fr-FR',{maximumFractionDigits:2});
export const fmtPct = n => n.toLocaleString('fr-FR',{maximumFractionDigits:1})+' %';
export const cap = s => String(s??'').toLowerCase().replace(/(^|[\s\-'])\p{L}/gu, c=>c.toUpperCase());
export const shortName = n => String(n??'').replace(/^LIBERTIUM\s+/i,'');
export const norm = s => String(s??'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

// PRNG déterministe (repris de la v1)
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

// Similarité simple pour le rapprochement d'alias (0..1)
export function similarity(a, b){
  const na = norm(a), nb = norm(b);
  if(!na || !nb) return 0;
  if(na === nb) return 1;
  if(na.includes(nb) || nb.includes(na)) return 0.9;
  const ta = new Set(na.split(' ')), tb = new Set(nb.split(' '));
  let common = 0; ta.forEach(t=>{ if(tb.has(t)) common++; });
  return common / Math.max(ta.size, tb.size);
}

// Fenêtres temporelles : mode mois (1 mois) ou mode saison (sept -> août,
// limité aux mois réellement présents — comparaison N-1 à fenêtre égale).
import { state } from './state.js';
import { MONTHS, SEASONS } from './metrics.js';
import { monthLabel, monthShortYear, seasonLabel, seasonMonths, seasonOf, addMonths } from './config.js';

export function defaultTime(){
  const last = MONTHS[MONTHS.length - 1];
  return { monthIso: last, seasonYear: seasonOf(last) };
}

// Mois de la période sélectionnée (ceux présents dans les données)
export function currentMonths(){
  if (state.timeMode === 'month') return state.monthIso ? [state.monthIso] : [];
  return seasonMonths(state.seasonYear).filter(m => MONTHS.includes(m));
}

// Période de comparaison : mois précédent, ou même fenêtre de la saison N-1
export function previousMonths(){
  if (state.timeMode === 'month') {
    const i = MONTHS.indexOf(state.monthIso);
    return i > 0 ? [MONTHS[i - 1]] : null;
  }
  const win = currentMonths().map(m => addMonths(m, -12)).filter(m => MONTHS.includes(m));
  return win.length ? win : null;
}

export function periodTitle(){
  return state.timeMode === 'month' ? monthLabel(state.monthIso) : seasonLabel(state.seasonYear);
}
export function prevShortLabel(){
  if (state.timeMode === 'month') {
    const i = MONTHS.indexOf(state.monthIso);
    return i > 0 ? monthShortYear(MONTHS[i - 1]) : '';
  }
  return seasonLabel(state.seasonYear - 1).replace('Saison ', '');
}
// Fenêtre de sparkline : les mois affichés en tendance
export function sparkMonths(){
  if (state.timeMode === 'season') return currentMonths();
  const upto = MONTHS.filter(m => m <= state.monthIso);
  return upto.slice(-12);
}
export const seasonsAvailable = () => SEASONS;

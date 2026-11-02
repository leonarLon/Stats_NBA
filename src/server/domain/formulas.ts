import type { BoxCounts, SeasonTotals } from './types';

/**
 * Fórmulas documentadas em docs/STATS_FORMULAS.md.
 * Todas retornam null quando o denominador é zero (em vez de 0 ou NaN),
 * para a interface mostrar "—" e não um valor enganoso.
 */

export function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function round(value: number | null, digits: number): number | null {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Percentuais são sempre razão das somas, nunca média dos percentuais por jogo. */
export const fgPct = (t: Pick<BoxCounts, 'fgm' | 'fga'>) => ratio(t.fgm, t.fga);
export const fg3Pct = (t: Pick<BoxCounts, 'fg3m' | 'fg3a'>) => ratio(t.fg3m, t.fg3a);
export const ftPct = (t: Pick<BoxCounts, 'ftm' | 'fta'>) => ratio(t.ftm, t.fta);

export const efgPct = (t: Pick<BoxCounts, 'fgm' | 'fg3m' | 'fga'>) => ratio(t.fgm + 0.5 * t.fg3m, t.fga);

export const tsPct = (t: Pick<BoxCounts, 'pts' | 'fga' | 'fta'>) => ratio(t.pts, 2 * (t.fga + 0.44 * t.fta));

export const astToTov = (t: Pick<BoxCounts, 'ast' | 'tov'>) => ratio(t.ast, t.tov);

/** Média por jogo disputado. */
export function perGame(total: number, gamesPlayed: number): number | null {
  return ratio(total, gamesPlayed);
}

export function minutesPerGame(t: Pick<SeasonTotals, 'secondsPlayed' | 'gamesPlayed'>): number | null {
  const v = ratio(t.secondsPlayed, t.gamesPlayed);
  return v === null ? null : v / 60;
}

/** Posses estimadas do time: FGA − OREB + TOV + 0,44·FTA. Exige OREB. */
export function possessions(t: Pick<BoxCounts, 'fga' | 'oreb' | 'tov' | 'fta'>): number | null {
  if (t.oreb === null) return null;
  return t.fga - t.oreb + t.tov + 0.44 * t.fta;
}

export function rating(points: number, poss: number | null): number | null {
  return poss === null ? null : ratio(100 * points, poss);
}

/** Pace = 48 · média das posses dos dois times ÷ (minutos do time ÷ 5). */
export function pace(teamPoss: number | null, oppPoss: number | null, teamMinutes: number): number | null {
  if (teamPoss === null || oppPoss === null) return null;
  const perTeamMinutes = ratio(teamMinutes, 5);
  if (perTeamMinutes === null) return null;
  return (48 * ((teamPoss + oppPoss) / 2)) / perTeamMinutes;
}

const DOUBLE_CATEGORIES = ['pts', 'reb', 'ast', 'stl', 'blk'] as const;

export function doubleDigitCategories(line: Pick<BoxCounts, (typeof DOUBLE_CATEGORIES)[number]>): number {
  return DOUBLE_CATEGORIES.filter((k) => line[k] >= 10).length;
}

export const isDoubleDouble = (line: Pick<BoxCounts, (typeof DOUBLE_CATEGORIES)[number]>) =>
  doubleDigitCategories(line) >= 2;
export const isTripleDouble = (line: Pick<BoxCounts, (typeof DOUBLE_CATEGORIES)[number]>) =>
  doubleDigitCategories(line) >= 3;

/** Jogos mínimos para entrar em rankings de média: 70% dos jogos já disputados pelo time. */
export function minGamesToQualify(teamGamesPlayed: number): number {
  return Math.ceil(0.7 * teamGamesPlayed);
}

/** Tentativas mínimas por jogo para rankings de percentual. */
export const MIN_ATTEMPTS_PER_GAME = { fg: 5, fg3: 2, ft: 1.5 } as const;

/** Desvio padrão populacional. */
export function stddev(values: number[]): number | null {
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Coeficiente de variação (consistência). Exige ≥ 10 jogos e média ≥ 10. */
export function coefficientOfVariation(values: number[], opts = { minGames: 10, minMean: 10 }): number | null {
  if (values.length < opts.minGames) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean < opts.minMean) return null;
  const sd = stddev(values);
  return sd === null ? null : sd / mean;
}

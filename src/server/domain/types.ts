export const GAME_STATUSES = ['scheduled', 'in_progress', 'final', 'postponed', 'canceled'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const SEASON_TYPES = ['preseason', 'regular', 'play_in', 'playoffs', 'cup'] as const;
export type SeasonType = (typeof SEASON_TYPES)[number];

/** Contadores de box score (iguais para jogador e time). */
export interface BoxCounts {
  pts: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  /** Rebotes ofensivos e defensivos podem faltar em algumas fontes. */
  oreb: number | null;
  dreb: number | null;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
}

/** Linha de um jogador em um jogo, já normalizada (IDs ainda externos). */
export interface PlayerGameLine extends BoxCounts {
  playerExternalId: string;
  teamExternalId: string;
  isStarter: boolean;
  didNotPlay: boolean;
  secondsPlayed: number;
  plusMinus: number | null;
}

export interface GameScore {
  homeTeamExternalId: string;
  awayTeamExternalId: string;
  homeScore: number;
  awayScore: number;
  overtimePeriods: number;
}

/** Totais de uma temporada (base para médias). */
export interface SeasonTotals extends BoxCounts {
  gamesPlayed: number;
  secondsPlayed: number;
}

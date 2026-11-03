import type { GameStatus, SeasonType } from '../domain/types';

/**
 * Formato das linhas como vêm do banco (snake_case, iguais às tabelas).
 * O leitor do Supabase e o leitor fictício devolvem exatamente estes tipos,
 * e a camada de cálculo (compute.ts) os transforma nos modelos de tela abaixo.
 */

/** 'unavailable' não existe no banco: é um jogo encerrado sem box score porque saiu da janela da fonte. */
export type StatsStatus = 'pending' | 'complete' | 'partial' | 'invalid' | 'unavailable';

export interface SeasonRow {
  id: number;
  start_year: number;
  label: string;
}

export interface TeamRow {
  id: number;
  abbreviation: string;
  city: string;
  nickname: string;
  full_name: string;
  conference: 'East' | 'West' | null;
}

export interface GameRow {
  id: number;
  season_id: number;
  season_type: SeasonType;
  game_date: string;
  starts_at: string | null;
  status: GameStatus;
  stats_status: StatsStatus;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  overtime_periods: number;
}

interface CountsRow {
  pts: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number | null;
  dreb: number | null;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
}

export interface PlayerRef {
  display_name: string;
  position: string | null;
}

export interface PlayerGameRow extends CountsRow {
  game_id: number;
  player_id: number;
  team_id: number;
  game_date: string;
  is_starter: boolean;
  did_not_play: boolean;
  seconds_played: number;
  plus_minus: number | null;
  player: PlayerRef;
}

export interface TeamGameRow extends CountsRow {
  game_id: number;
  team_id: number;
}

export interface PlayerSeasonDbRow extends CountsRow {
  player_id: number;
  last_team_id: number | null;
  games_played: number;
  games_started: number;
  seconds_played: number;
  double_doubles: number;
  triple_doubles: number;
  team_partial_games: number;
  is_complete: boolean;
  player: PlayerRef;
}

export interface TeamSeasonDbRow extends CountsRow {
  team_id: number;
  games_played: number;
  wins: number;
  losses: number;
  opp_pts: number;
  possessions: number | null;
  opp_possessions: number | null;
  is_complete: boolean;
}

export interface StandingDbRow {
  team_id: number;
  conference: 'East' | 'West';
  conference_rank: number;
  wins: number;
  losses: number;
  win_pct: number;
  games_behind: number;
  home_wins: number;
  home_losses: number;
  away_wins: number;
  away_losses: number;
  last10_wins: number;
  last10_losses: number;
  streak: number;
}

export interface PlayerDbRow {
  id: number;
  display_name: string;
  position: string | null;
  current_team_id: number | null;
}

/** Fonte dos dados de leitura. Nenhum método aplica regra de acesso: isso fica em queries.ts. */
export interface StatsReader {
  currentSeason(): Promise<SeasonRow | null>;
  teams(): Promise<TeamRow[]>;
  standings(seasonId: number): Promise<StandingDbRow[]>;
  playerSeasons(seasonId: number, seasonType: SeasonType): Promise<PlayerSeasonDbRow[]>;
  teamSeasons(seasonId: number, seasonType: SeasonType): Promise<TeamSeasonDbRow[]>;
  /** Data (horário dos EUA) do último jogo iniciado; sem nenhum, a do primeiro agendado. */
  defaultGameDate(): Promise<string | null>;
  gamesOn(date: string): Promise<GameRow[]>;
  adjacentGameDates(date: string): Promise<{ prev: string | null; next: string | null }>;
  game(id: number): Promise<GameRow | null>;
  gamePlayerLines(gameId: number): Promise<PlayerGameRow[]>;
  gameTeamTotals(gameId: number): Promise<TeamGameRow[]>;
  player(id: number): Promise<PlayerDbRow | null>;
  playerGameLines(playerId: number, seasonId: number): Promise<PlayerGameRow[]>;
  gamesByIds(ids: number[]): Promise<GameRow[]>;
  teamGames(teamId: number, seasonId: number): Promise<GameRow[]>;
}

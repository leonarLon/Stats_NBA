import type { BoxCounts, GameStatus, PlayerGameLine, SeasonType } from '../domain/types';

/**
 * Contratos que todo provedor de dados esportivos implementa.
 * O resto da aplicação só conhece estes tipos, nunca o formato de uma API específica.
 * Ver DATA_SOURCES.md, seção 4.
 */

export type ProviderSlug = 'api-nba' | 'balldontlie' | 'fixture';

export interface ProviderTeam {
  externalId: string;
  abbreviation: string;
  city: string;
  nickname: string;
  fullName: string;
  conference: 'East' | 'West' | null;
  division: string | null;
}

export interface ProviderPlayer {
  externalId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  jerseyNumber: string | null;
  heightCm: number | null;
  weightKg: number | null;
  birthDate: string | null; // AAAA-MM-DD
  country: string | null;
  teamExternalId: string | null;
}

export interface ProviderGame {
  externalId: string;
  /** Ano de início da temporada (2026 = 2026-27). */
  seasonStartYear: number;
  seasonType: SeasonType;
  /** Data local do jogo nos EUA, AAAA-MM-DD. */
  gameDate: string;
  startsAt: string | null; // ISO 8601
  status: GameStatus;
  homeTeamExternalId: string;
  awayTeamExternalId: string;
  homeScore: number | null;
  awayScore: number | null;
  overtimePeriods: number;
}

export interface DateRange {
  /** AAAA-MM-DD, inclusivo. */
  from: string;
  /** AAAA-MM-DD, inclusivo. */
  to: string;
}

export interface ScheduleProvider {
  readonly slug: ProviderSlug;
  listGames(range: DateRange): Promise<ProviderGame[]>;
}

/** Totais de um time em um jogo, como a fonte informa (não é a soma dos jogadores). */
export interface ProviderTeamGameTotals extends BoxCounts {
  teamExternalId: string;
}

export interface BoxScoreProvider {
  readonly slug: ProviderSlug;
  /** Linhas dos jogadores dos dois times. Pode vir incompleto (ver classifyBoxScore). */
  getPlayerGameStats(gameExternalId: string): Promise<PlayerGameLine[]>;
  /** Totais dos dois times, fonte da verdade para team_game_stats. */
  getTeamGameStats(gameExternalId: string): Promise<ProviderTeamGameTotals[]>;
}

export interface ReferenceDataProvider {
  readonly slug: ProviderSlug;
  listTeams(): Promise<ProviderTeam[]>;
  listPlayers(params: { seasonStartYear: number; teamExternalId?: string }): Promise<ProviderPlayer[]>;
}

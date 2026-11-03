import type { BoxCounts, GameStatus, PlayerGameLine, SeasonType } from '../domain/types';

/**
 * Contratos que todo provedor de dados esportivos implementa.
 * O resto da aplicação só conhece estes tipos, nunca o formato de uma API específica.
 * Ver DATA_SOURCES.md, seção 4.
 *
 * Times são identificados entre provedores pela SIGLA (ex.: "GSW"), que é igual em todas
 * as fontes avaliadas. Por isso, nos campos de time de jogos e linhas, "TeamExternalId" é a sigla;
 * o ID numérico de cada provedor fica em ProviderTeam.externalId / external_refs.
 */

/** 'fixture-box': fixture no papel de provedor de box score (testes), com vínculos próprios. */
export type ProviderSlug = 'api-nba' | 'balldontlie' | 'fixture' | 'fixture-box';

export interface ProviderTeam {
  /** ID do time no provedor. */
  externalId: string;
  abbreviation: string;
  city: string;
  nickname: string;
  fullName: string;
  conference: 'East' | 'West' | null;
  division: string | null;
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
  /** Sigla do time mandante. */
  homeTeamExternalId: string;
  /** Sigla do time visitante. */
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

/** Linha de jogador com os dados necessários para criar o jogador na primeira vez que aparece. */
export interface ProviderPlayerLine extends PlayerGameLine {
  firstName: string;
  lastName: string;
  position: string | null;
}

/** Totais de um time em um jogo, como a fonte informa (não é a soma dos jogadores). */
export interface ProviderTeamGameTotals extends BoxCounts {
  /** Sigla do time. */
  teamExternalId: string;
}

export interface ScheduleProvider {
  readonly slug: ProviderSlug;
  /** Jogos por data local dos EUA. */
  listGames(range: DateRange): Promise<ProviderGame[]>;
}

export interface BoxScoreProvider {
  readonly slug: ProviderSlug;
  /** Jogos que COMEÇAM numa data UTC (usado para achar o ID do jogo neste provedor). */
  findGamesByUtcDate(utcDate: string): Promise<ProviderGame[]>;
  /** Linhas dos jogadores dos dois times. Pode vir incompleto (ver classifyBoxScore). */
  getPlayerGameStats(gameExternalId: string): Promise<ProviderPlayerLine[]>;
  /** Totais dos dois times, fonte da verdade para team_game_stats. */
  getTeamGameStats(gameExternalId: string): Promise<ProviderTeamGameTotals[]>;
}

export interface ReferenceDataProvider {
  readonly slug: ProviderSlug;
  listTeams(): Promise<ProviderTeam[]>;
}

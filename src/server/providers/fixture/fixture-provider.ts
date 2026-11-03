import { utcDate } from '../../domain/normalize';
import { AppError } from '../../lib/errors';
import type {
  BoxScoreProvider,
  DateRange,
  ProviderGame,
  ProviderPlayerLine,
  ProviderTeam,
  ProviderTeamGameTotals,
  ReferenceDataProvider,
  ScheduleProvider,
} from '../types';
import { FIXTURE_BOX_SCORES, FIXTURE_GAMES, FIXTURE_TEAMS } from './data';

export interface FixtureData {
  teams: ProviderTeam[];
  games: ProviderGame[];
  boxScores: Record<string, ProviderPlayerLine[]>;
  /** Totais de time explícitos; se ausentes, usa a soma das linhas dos jogadores. */
  teamTotals?: Record<string, ProviderTeamGameTotals[]>;
}

const COUNTERS = ['pts', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf'] as const;

/** Soma as linhas dos jogadores por time (útil quando o box score está completo). */
export function sumTeamTotals(lines: ProviderPlayerLine[]): ProviderTeamGameTotals[] {
  const totals = new Map<string, ProviderTeamGameTotals>();
  for (const l of lines) {
    const t = totals.get(l.teamExternalId) ?? {
      teamExternalId: l.teamExternalId, pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0,
      oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
    };
    for (const k of COUNTERS) t[k] += l[k];
    t.oreb = (t.oreb ?? 0) + (l.oreb ?? 0);
    t.dreb = (t.dreb ?? 0) + (l.dreb ?? 0);
    totals.set(l.teamExternalId, t);
  }
  return [...totals.values()];
}

/**
 * Provedor sem rede, com dados fictícios. Usado nos testes automatizados e no
 * desenvolvimento enquanto não há chaves de API (DATA_PROVIDER_MODE=fixture).
 * Nunca é usado em produção. Os dados podem ser trocados (ex.: simular box score parcial).
 */
export class FixtureProvider implements ScheduleProvider, BoxScoreProvider, ReferenceDataProvider {
  readonly slug: 'fixture' | 'fixture-box';
  data: FixtureData;
  /** Chamadas feitas, para os testes verificarem consumo. */
  readonly calls: string[] = [];

  constructor(data?: Partial<FixtureData>, slug: 'fixture' | 'fixture-box' = 'fixture') {
    this.slug = slug;
    this.data = {
      teams: data?.teams ?? FIXTURE_TEAMS,
      games: data?.games ?? FIXTURE_GAMES,
      boxScores: data?.boxScores ?? FIXTURE_BOX_SCORES,
      teamTotals: data?.teamTotals,
    };
  }

  async listGames(range: DateRange) {
    this.calls.push(`listGames:${range.from}:${range.to}`);
    return this.data.games.filter((g) => g.gameDate >= range.from && g.gameDate <= range.to).map((g) => ({ ...g }));
  }

  async findGamesByUtcDate(date: string) {
    this.calls.push(`findGamesByUtcDate:${date}`);
    return this.data.games.filter((g) => g.startsAt && utcDate(g.startsAt) === date).map((g) => ({ ...g }));
  }

  async getPlayerGameStats(gameExternalId: string) {
    this.calls.push(`getPlayerGameStats:${gameExternalId}`);
    const lines = this.data.boxScores[gameExternalId];
    if (!lines) throw new AppError('NOT_FOUND', `Fixture box score not found: ${gameExternalId}`);
    return lines.map((l) => ({ ...l }));
  }

  async getTeamGameStats(gameExternalId: string) {
    this.calls.push(`getTeamGameStats:${gameExternalId}`);
    const explicit = this.data.teamTotals?.[gameExternalId];
    if (explicit) return explicit.map((t) => ({ ...t }));
    const lines = this.data.boxScores[gameExternalId];
    if (!lines) throw new AppError('NOT_FOUND', `Fixture box score not found: ${gameExternalId}`);
    return sumTeamTotals(lines);
  }

  async listTeams() {
    this.calls.push('listTeams');
    return this.data.teams.map((t) => ({ ...t }));
  }
}

import { AppError } from '../../lib/errors';
import type { BoxScoreProvider, DateRange, ProviderTeamGameTotals, ReferenceDataProvider, ScheduleProvider } from '../types';
import { FIXTURE_BOX_SCORES, FIXTURE_GAMES, FIXTURE_PLAYERS, FIXTURE_TEAMS } from './data';

/**
 * Provedor sem rede, com dados fictícios. Usado nos testes automatizados e no
 * desenvolvimento enquanto não há chaves de API (DATA_PROVIDER_MODE=fixture).
 * Nunca é usado em produção.
 */
export class FixtureProvider implements ScheduleProvider, BoxScoreProvider, ReferenceDataProvider {
  readonly slug = 'fixture' as const;

  async listGames(range: DateRange) {
    return FIXTURE_GAMES.filter((g) => g.gameDate >= range.from && g.gameDate <= range.to).map((g) => ({ ...g }));
  }

  async getPlayerGameStats(gameExternalId: string) {
    const lines = FIXTURE_BOX_SCORES[gameExternalId];
    if (!lines) throw new AppError('NOT_FOUND', `Fixture box score not found: ${gameExternalId}`);
    return lines.map((l) => ({ ...l }));
  }

  async getTeamGameStats(gameExternalId: string) {
    const lines = await this.getPlayerGameStats(gameExternalId);
    // No fixture o box score é completo, então os totais do time são a soma dos jogadores
    const totals = new Map<string, ProviderTeamGameTotals>();
    for (const l of lines) {
      const t = totals.get(l.teamExternalId) ?? {
        teamExternalId: l.teamExternalId, pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0,
        oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
      };
      for (const k of ['pts', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf'] as const) t[k] += l[k];
      t.oreb = (t.oreb ?? 0) + (l.oreb ?? 0);
      t.dreb = (t.dreb ?? 0) + (l.dreb ?? 0);
      totals.set(l.teamExternalId, t);
    }
    return [...totals.values()];
  }

  async listTeams() {
    return FIXTURE_TEAMS.map((t) => ({ ...t }));
  }

  async listPlayers(params: { seasonStartYear: number; teamExternalId?: string }) {
    return FIXTURE_PLAYERS.filter((p) => !params.teamExternalId || p.teamExternalId === params.teamExternalId).map((p) => ({ ...p }));
  }
}

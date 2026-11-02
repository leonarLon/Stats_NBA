import { AppError } from '../../lib/errors';
import type { BoxScoreProvider, DateRange, ReferenceDataProvider, ScheduleProvider } from '../types';
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

  async listTeams() {
    return FIXTURE_TEAMS.map((t) => ({ ...t }));
  }

  async listPlayers(params: { seasonStartYear: number; teamExternalId?: string }) {
    return FIXTURE_PLAYERS.filter((p) => !params.teamExternalId || p.teamExternalId === params.teamExternalId).map((p) => ({ ...p }));
  }
}

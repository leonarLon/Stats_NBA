import { z } from 'zod';
import type { GameStatus } from '../../domain/types';
import type { HttpClient } from '../../lib/http';
import type { DateRange, ProviderGame, ProviderTeam, ReferenceDataProvider, ScheduleProvider } from '../types';

/**
 * balldontlie (plano Free): calendário, status e placares. Não fornece estatísticas de jogador no plano Free.
 * Formato conferido com chamadas reais em 03/11/2026 (DATA_SOURCES.md, seção 1.2).
 */

const teamSchema = z.object({
  id: z.number(),
  conference: z.string().nullish(),
  division: z.string().nullish(),
  city: z.string().nullish(),
  name: z.string(),
  full_name: z.string(),
  abbreviation: z.string(),
});

const gameSchema = z.object({
  id: z.number(),
  date: z.string(),
  season: z.number(),
  status: z.string(),
  status_state: z.string().nullish(),
  period: z.number().nullish(),
  postseason: z.boolean(),
  postponed: z.boolean().nullish(),
  home_team_score: z.number().nullish(),
  visitor_team_score: z.number().nullish(),
  datetime: z.string().nullish(),
  home_team: teamSchema,
  visitor_team: teamSchema,
});

const gamesPageSchema = z.object({
  data: z.array(gameSchema),
  meta: z.object({ next_cursor: z.number().nullish() }).partial().nullish(),
});

const teamsSchema = z.object({ data: z.array(teamSchema) });

type BdlGame = z.infer<typeof gameSchema>;

export function mapBdlStatus(g: Pick<BdlGame, 'status' | 'status_state' | 'period' | 'postponed'>): GameStatus {
  if (g.postponed) return 'postponed';
  switch (g.status_state) {
    case 'final':
      return 'final';
    case 'in_progress':
      return 'in_progress';
    case 'scheduled':
      return 'scheduled';
  }
  // Sem status_state: deduz do texto, como na documentação
  if (/^final/i.test(g.status)) return 'final';
  return (g.period ?? 0) > 0 ? 'in_progress' : 'scheduled';
}

export function mapBdlGame(g: BdlGame): ProviderGame {
  const status = mapBdlStatus(g);
  return {
    externalId: String(g.id),
    seasonStartYear: g.season,
    // O plano Free não distingue play-in nem final da Copa; postseason = playoffs
    seasonType: g.postseason ? 'playoffs' : 'regular',
    gameDate: g.date.slice(0, 10),
    startsAt: g.datetime ?? null,
    status,
    homeTeamExternalId: g.home_team.abbreviation,
    awayTeamExternalId: g.visitor_team.abbreviation,
    homeScore: status === 'scheduled' ? null : (g.home_team_score ?? null),
    awayScore: status === 'scheduled' ? null : (g.visitor_team_score ?? null),
    overtimePeriods: status === 'final' ? Math.max(0, (g.period ?? 4) - 4) : 0,
  };
}

export class BallDontLieProvider implements ScheduleProvider, ReferenceDataProvider {
  readonly slug = 'balldontlie' as const;

  constructor(private readonly http: HttpClient) {}

  async listGames(range: DateRange): Promise<ProviderGame[]> {
    const games: ProviderGame[] = [];
    let cursor: number | undefined;
    // Limite de segurança: 20 páginas × 100 jogos
    for (let page = 0; page < 20; page++) {
      const res = await this.http.getJson('/games', gamesPageSchema, {
        start_date: range.from,
        end_date: range.to,
        per_page: 100,
        cursor,
      });
      games.push(...res.data.map(mapBdlGame));
      const next = res.meta?.next_cursor;
      if (!next) break;
      cursor = next;
    }
    return games;
  }

  async listTeams(): Promise<ProviderTeam[]> {
    const res = await this.http.getJson('/teams', teamsSchema);
    // A lista inclui franquias históricas sem conferência; só as 30 atuais têm East/West
    return res.data
      .filter((t) => t.conference === 'East' || t.conference === 'West')
      .map((t) => ({
        externalId: String(t.id),
        abbreviation: t.abbreviation,
        city: t.city ?? '',
        nickname: t.name,
        fullName: t.full_name,
        conference: t.conference as 'East' | 'West',
        division: t.division ?? null,
      }));
  }
}

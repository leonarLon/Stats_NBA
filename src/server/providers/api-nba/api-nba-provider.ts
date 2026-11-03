import { z } from 'zod';
import { count, parseIntOrNull, parseMinutes, utcDate } from '../../domain/normalize';
import type { GameStatus } from '../../domain/types';
import { AppError } from '../../lib/errors';
import type { HttpClient } from '../../lib/http';
import type { BoxScoreProvider, ProviderGame, ProviderPlayerLine, ProviderTeamGameTotals } from '../types';

/**
 * API-NBA (api-sports.io, plano Free): box scores de jogadores e totais de time.
 * Formato conferido com chamadas reais em 03/11/2026 (DATA_SOURCES.md, seção 1.3).
 *
 * A API responde HTTP 200 mesmo com erro; o problema vem em "errors" (objeto ou lista).
 */

const num = z.number().nullish();

const envelope = <T extends z.ZodType>(item: T) =>
  z.object({
    errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
    response: z.array(item),
  });

const teamRef = z.object({ id: z.number(), code: z.string().nullish() });

const gameSchema = z.object({
  id: z.number(),
  season: z.number(),
  date: z.object({ start: z.string() }),
  status: z.object({ short: z.number().nullish(), long: z.string().nullish() }),
  periods: z.object({ total: z.number().nullish() }).partial().nullish(),
  teams: z.object({ home: teamRef, visitors: teamRef }),
  scores: z.object({ home: z.object({ points: num }), visitors: z.object({ points: num }) }),
});

const playerStatSchema = z.object({
  player: z.object({ id: z.number(), firstname: z.string().nullish(), lastname: z.string().nullish() }),
  team: teamRef,
  points: num, pos: z.string().nullish(), min: z.union([z.string(), z.number()]).nullish(),
  fgm: num, fga: num, ftm: num, fta: num, tpm: num, tpa: num,
  offReb: num, defReb: num, totReb: num, assists: num, pFouls: num, steals: num, turnovers: num, blocks: num,
  plusMinus: z.union([z.string(), z.number()]).nullish(),
});

const teamStatSchema = z.object({
  team: teamRef,
  statistics: z.array(
    z.object({
      points: num, fgm: num, fga: num, ftm: num, fta: num, tpm: num, tpa: num,
      offReb: num, defReb: num, totReb: num, assists: num, pFouls: num, steals: num, turnovers: num, blocks: num,
    }),
  ),
});

function assertNoErrors(errors: unknown[] | Record<string, unknown>, path: string): void {
  const list = Array.isArray(errors) ? errors : Object.values(errors);
  if (list.length === 0) return;
  const text = JSON.stringify(errors);
  if (/request limit|requests? for the day|quota/i.test(text)) {
    throw new AppError('QUOTA_EXHAUSTED', `API-NBA daily quota reached (${path})`);
  }
  // Erros de limite por minuto podem ser tentados de novo depois
  const retryable = /rate ?limit|too many/i.test(text);
  throw new AppError('UPSTREAM', `API-NBA error on ${path}`, { details: { errors }, retryable });
}

function teamCode(team: z.infer<typeof teamRef>): string {
  if (!team.code) throw new AppError('UPSTREAM', `API-NBA team ${team.id} without code`);
  return team.code;
}

export function mapApiNbaStatus(status: { short?: number | null; long?: string | null }): GameStatus {
  const long = status.long ?? '';
  if (/postpon/i.test(long)) return 'postponed';
  if (/cancel/i.test(long)) return 'canceled';
  if (status.short === 3 || /finished/i.test(long)) return 'final';
  if (status.short === 2) return 'in_progress';
  return 'scheduled';
}

export function mapApiNbaGame(g: z.infer<typeof gameSchema>): ProviderGame {
  const status = mapApiNbaStatus(g.status);
  return {
    externalId: String(g.id),
    seasonStartYear: g.season,
    seasonType: 'regular', // não usado: o calendário oficial vem do balldontlie
    gameDate: utcDate(g.date.start),
    startsAt: g.date.start,
    status,
    homeTeamExternalId: teamCode(g.teams.home),
    awayTeamExternalId: teamCode(g.teams.visitors),
    homeScore: g.scores.home.points ?? null,
    awayScore: g.scores.visitors.points ?? null,
    overtimePeriods: Math.max(0, (g.periods?.total ?? 4) - 4),
  };
}

export function mapApiNbaPlayerLine(r: z.infer<typeof playerStatSchema>): ProviderPlayerLine {
  const secondsPlayed = parseMinutes(r.min);
  return {
    playerExternalId: String(r.player.id),
    teamExternalId: teamCode(r.team),
    firstName: (r.player.firstname ?? '').trim(),
    lastName: (r.player.lastname ?? '').trim(),
    position: r.pos?.trim() || null,
    // A API-NBA não informa quem foi titular
    isStarter: false,
    didNotPlay: secondsPlayed === 0,
    secondsPlayed,
    pts: count(r.points),
    fgm: count(r.fgm), fga: count(r.fga),
    fg3m: count(r.tpm), fg3a: count(r.tpa),
    ftm: count(r.ftm), fta: count(r.fta),
    oreb: r.offReb ?? null, dreb: r.defReb ?? null, reb: count(r.totReb),
    ast: count(r.assists), stl: count(r.steals), blk: count(r.blocks), tov: count(r.turnovers), pf: count(r.pFouls),
    plusMinus: parseIntOrNull(r.plusMinus ?? null),
  };
}

export function mapApiNbaTeamTotals(r: z.infer<typeof teamStatSchema>): ProviderTeamGameTotals {
  const s = r.statistics[0];
  if (!s) throw new AppError('UPSTREAM', `API-NBA team ${r.team.id} without statistics`);
  return {
    teamExternalId: teamCode(r.team),
    pts: count(s.points),
    fgm: count(s.fgm), fga: count(s.fga),
    fg3m: count(s.tpm), fg3a: count(s.tpa),
    ftm: count(s.ftm), fta: count(s.fta),
    oreb: s.offReb ?? null, dreb: s.defReb ?? null, reb: count(s.totReb),
    ast: count(s.assists), stl: count(s.steals), blk: count(s.blocks), tov: count(s.turnovers), pf: count(s.pFouls),
  };
}

export class ApiNbaProvider implements BoxScoreProvider {
  readonly slug = 'api-nba' as const;

  constructor(private readonly http: HttpClient) {}

  async findGamesByUtcDate(date: string): Promise<ProviderGame[]> {
    const res = await this.http.getJson('/games', envelope(gameSchema), { date });
    assertNoErrors(res.errors, '/games');
    return res.response.map(mapApiNbaGame);
  }

  async getPlayerGameStats(gameExternalId: string): Promise<ProviderPlayerLine[]> {
    const res = await this.http.getJson('/players/statistics', envelope(playerStatSchema), { game: gameExternalId });
    assertNoErrors(res.errors, '/players/statistics');
    return res.response.map(mapApiNbaPlayerLine);
  }

  async getTeamGameStats(gameExternalId: string): Promise<ProviderTeamGameTotals[]> {
    const res = await this.http.getJson('/games/statistics', envelope(teamStatSchema), { id: gameExternalId });
    assertNoErrors(res.errors, '/games/statistics');
    return res.response.map(mapApiNbaTeamTotals);
  }
}

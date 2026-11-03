import { describe, expect, it } from 'vitest';
import { addDays, parseIntOrNull, parseMinutes, toSearchName, utcDate } from '@/server/domain/normalize';
import { createHttpClient } from '@/server/lib/http';
import { createLogger } from '@/server/lib/logger';
import { ApiNbaProvider, mapApiNbaStatus } from '@/server/providers/api-nba/api-nba-provider';
import { BallDontLieProvider, mapBdlStatus } from '@/server/providers/balldontlie/balldontlie-provider';

/**
 * Respostas com o MESMO FORMATO das APIs reais (conferido em 03/11/2026), mas com
 * valores fictícios: nenhum número aqui é estatística real.
 */

const silent = createLogger({}, { write: () => {} });

function clientReturning(routes: Record<string, unknown>) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}${url.search}`);
    const body = routes[url.pathname];
    return new Response(JSON.stringify(body ?? {}), { status: body ? 200 : 404 });
  }) as typeof fetch;
  return { http: createHttpClient({ baseUrl: 'https://api.test', fetchImpl, logger: silent, maxRetries: 0 }), calls };
}

const bdlTeam = (id: number, abbreviation: string, conference = 'East') => ({
  id, conference, division: 'Atlantic', city: 'Cidade', name: 'Time', full_name: `Cidade Time ${abbreviation}`, abbreviation,
});

describe('balldontlie', () => {
  const finalGame = {
    id: 9001, date: '2026-11-02', season: 2026, status: 'Final', status_state: 'final', period: 5, time: 'Final',
    postseason: false, postponed: false, home_team_score: 101, visitor_team_score: 99, datetime: '2026-11-03T00:00:00.000Z',
    home_team: bdlTeam(1, 'AAA'), visitor_team: bdlTeam(2, 'BBB', 'West'),
  };

  it('mapeia jogo encerrado com prorrogação e siglas', async () => {
    const { http, calls } = clientReturning({ '/games': { data: [finalGame], meta: { per_page: 100 } } });
    const [g] = await new BallDontLieProvider(http).listGames({ from: '2026-11-02', to: '2026-11-02' });
    expect(g).toEqual({
      externalId: '9001', seasonStartYear: 2026, seasonType: 'regular', gameDate: '2026-11-02',
      startsAt: '2026-11-03T00:00:00.000Z', status: 'final', homeTeamExternalId: 'AAA', awayTeamExternalId: 'BBB',
      homeScore: 101, awayScore: 99, overtimePeriods: 1,
    });
    expect(calls[0]).toBe('/games?start_date=2026-11-02&end_date=2026-11-02&per_page=100');
  });

  it('segue a paginação por cursor', async () => {
    let page = 0;
    const fetchImpl = (async () => {
      page++;
      const body = page === 1 ? { data: [finalGame], meta: { next_cursor: 25 } } : { data: [{ ...finalGame, id: 9002 }], meta: {} };
      return new Response(JSON.stringify(body));
    }) as typeof fetch;
    const http = createHttpClient({ baseUrl: 'https://api.test', fetchImpl, logger: silent });
    const games = await new BallDontLieProvider(http).listGames({ from: '2026-11-01', to: '2026-11-07' });
    expect(games.map((g) => g.externalId)).toEqual(['9001', '9002']);
  });

  it('jogo agendado não tem placar; playoffs vêm de postseason', async () => {
    const scheduled = { ...finalGame, status: '2026-11-05T00:00:00Z', status_state: 'scheduled', period: 0, home_team_score: 0, visitor_team_score: 0, postseason: true };
    const { http } = clientReturning({ '/games': { data: [scheduled] } });
    const [g] = await new BallDontLieProvider(http).listGames({ from: '2026-11-04', to: '2026-11-04' });
    expect(g).toMatchObject({ status: 'scheduled', homeScore: null, awayScore: null, seasonType: 'playoffs', overtimePeriods: 0 });
  });

  it('status: usa status_state e, sem ele, o texto', () => {
    expect(mapBdlStatus({ status: 'x', status_state: 'in_progress', period: 2, postponed: false })).toBe('in_progress');
    expect(mapBdlStatus({ status: 'Final', status_state: null, period: 4, postponed: false })).toBe('final');
    expect(mapBdlStatus({ status: '3rd Qtr', status_state: null, period: 3, postponed: false })).toBe('in_progress');
    expect(mapBdlStatus({ status: '7:00 pm ET', status_state: undefined, period: 0, postponed: false })).toBe('scheduled');
    expect(mapBdlStatus({ status: 'Final', status_state: 'final', period: 4, postponed: true })).toBe('postponed');
  });

  it('lista só os 30 times atuais (com conferência)', async () => {
    const { http } = clientReturning({ '/teams': { data: [bdlTeam(1, 'AAA'), bdlTeam(2, 'BBB', 'West'), { ...bdlTeam(40, 'OLD'), conference: ' ' }] } });
    const teams = await new BallDontLieProvider(http).listTeams();
    expect(teams.map((t) => t.abbreviation)).toEqual(['AAA', 'BBB']);
  });
});

describe('API-NBA', () => {
  const team = (id: number, code: string) => ({ id, name: 'Cidade Time', nickname: 'Time', code, logo: 'x' });
  const playerRow = {
    player: { id: 501, firstname: 'Fulano', lastname: 'de Tal' },
    team: team(10, 'AAA'), game: { id: 77 },
    points: 12, pos: 'G', min: '31', fgm: 5, fga: 11, fgp: '45.5', ftm: 1, fta: 2, ftp: '50.0', tpm: 1, tpa: 4, tpp: '25.0',
    offReb: 1, defReb: 4, totReb: 5, assists: 6, pFouls: 2, steals: 1, turnovers: 3, blocks: 0, plusMinus: '-4', comment: null,
  };

  it('mapeia linha de jogador (minutos inteiros em texto, +/- em texto)', async () => {
    const { http, calls } = clientReturning({ '/players/statistics': { errors: [], results: 1, response: [playerRow] } });
    const [l] = await new ApiNbaProvider(http).getPlayerGameStats('77');
    expect(l).toEqual({
      playerExternalId: '501', teamExternalId: 'AAA', firstName: 'Fulano', lastName: 'de Tal', position: 'G',
      isStarter: false, didNotPlay: false, secondsPlayed: 31 * 60,
      pts: 12, fgm: 5, fga: 11, fg3m: 1, fg3a: 4, ftm: 1, fta: 2, oreb: 1, dreb: 4, reb: 5,
      ast: 6, stl: 1, blk: 0, tov: 3, pf: 2, plusMinus: -4,
    });
    expect(calls[0]).toBe('/players/statistics?game=77');
  });

  it('jogador sem minutos e com estatísticas nulas vira DNP com zeros', async () => {
    const dnp = { ...playerRow, min: null, points: null, fgm: null, fga: null, totReb: null, offReb: null, defReb: null, plusMinus: null };
    const { http } = clientReturning({ '/players/statistics': { errors: [], response: [dnp] } });
    const [l] = await new ApiNbaProvider(http).getPlayerGameStats('77');
    expect(l).toMatchObject({ didNotPlay: true, secondsPlayed: 0, pts: 0, fgm: 0, reb: 0, oreb: null, plusMinus: null });
  });

  it('mapeia totais do time', async () => {
    const row = { team: team(10, 'AAA'), statistics: [{ points: 101, fgm: 40, fga: 85, ftm: 12, fta: 15, tpm: 9, tpa: 30, offReb: 10, defReb: 33, totReb: 43, assists: 25, pFouls: 18, steals: 7, turnovers: 12, blocks: 5 }] };
    const { http } = clientReturning({ '/games/statistics': { errors: [], response: [row] } });
    const [t] = await new ApiNbaProvider(http).getTeamGameStats('77');
    expect(t).toEqual({ teamExternalId: 'AAA', pts: 101, fgm: 40, fga: 85, fg3m: 9, fg3a: 30, ftm: 12, fta: 15, oreb: 10, dreb: 33, reb: 43, ast: 25, stl: 7, blk: 5, tov: 12, pf: 18 });
  });

  it('jogos por data UTC, com status e siglas', async () => {
    const game = {
      id: 77, league: 'standard', season: 2026, date: { start: '2026-11-02T01:30:00.000Z', end: null, duration: null }, stage: 2,
      status: { clock: null, halftime: false, short: 3, long: 'Finished' }, periods: { current: 4, total: 4, endOfPeriod: false },
      teams: { visitors: team(11, 'BBB'), home: team(10, 'AAA') },
      scores: { visitors: { points: 99 }, home: { points: 101 } },
    };
    const { http, calls } = clientReturning({ '/games': { errors: [], response: [game] } });
    const [g] = await new ApiNbaProvider(http).findGamesByUtcDate('2026-11-02');
    expect(g).toMatchObject({ externalId: '77', status: 'final', homeTeamExternalId: 'AAA', awayTeamExternalId: 'BBB', homeScore: 101, gameDate: '2026-11-02' });
    expect(calls[0]).toBe('/games?date=2026-11-02');
  });

  it('erro de cota com HTTP 200 vira QUOTA_EXHAUSTED', async () => {
    const { http } = clientReturning({ '/players/statistics': { errors: { requests: 'You have reached the request limit for the day' }, response: [] } });
    await expect(new ApiNbaProvider(http).getPlayerGameStats('77')).rejects.toMatchObject({ code: 'QUOTA_EXHAUSTED' });
  });

  it('erro de chave com HTTP 200 vira UPSTREAM sem nova tentativa', async () => {
    const { http } = clientReturning({ '/games/statistics': { errors: { token: 'Error/Missing application key' }, response: [] } });
    await expect(new ApiNbaProvider(http).getTeamGameStats('77')).rejects.toMatchObject({ code: 'UPSTREAM', retryable: false });
  });

  it('status do jogo', () => {
    expect(mapApiNbaStatus({ short: 1, long: 'Scheduled' })).toBe('scheduled');
    expect(mapApiNbaStatus({ short: 2, long: 'In Play' })).toBe('in_progress');
    expect(mapApiNbaStatus({ short: 3, long: 'Finished' })).toBe('final');
    expect(mapApiNbaStatus({ short: 1, long: 'Postponed' })).toBe('postponed');
  });
});

describe('normalização', () => {
  it('nome de busca sem acento', () => {
    expect(toSearchName('Luka', 'Dončić')).toBe('luka doncic');
    expect(toSearchName("De'Aaron", ' Fox ')).toBe("de'aaron fox");
    expect(toSearchName('Ícaro', null, 'Lima')).toBe('icaro lima');
  });

  it('minutos em vários formatos', () => {
    expect(parseMinutes('21')).toBe(1260);
    expect(parseMinutes('21:34')).toBe(1294);
    expect(parseMinutes('0')).toBe(0);
    expect(parseMinutes('')).toBe(0);
    expect(parseMinutes(null)).toBe(0);
    expect(parseMinutes('DNP')).toBe(0);
    expect(parseMinutes(30.5)).toBe(1830);
  });

  it('inteiros de texto', () => {
    expect(parseIntOrNull('-3')).toBe(-3);
    expect(parseIntOrNull('+5')).toBe(5);
    expect(parseIntOrNull('')).toBeNull();
    expect(parseIntOrNull('x')).toBeNull();
  });

  it('datas UTC', () => {
    expect(utcDate('2026-11-02T01:30:00.000Z')).toBe('2026-11-02');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

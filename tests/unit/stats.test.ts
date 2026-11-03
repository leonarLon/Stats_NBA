import { describe, expect, it } from 'vitest';
import { fmt1, fmtGameDate, fmtMinutes, fmtPct, fmtSigned, fmtStartTime, fmtStreak, fmtWinPct } from '@/lib/format';
import { parseDateParam, parseEnumParam, parseIdParam, parseSearchParam, parseTeamParam } from '@/lib/params';
import {
  buildBoxScore,
  buildGameLog,
  buildPlayerSeasonRows,
  buildStandings,
  buildTeamSeasonRows,
  rankPlayers,
  teamMap,
} from '@/server/stats/compute';
import { FixtureStatsReader } from '@/server/stats/fixture-reader';
import type { GameRow, PlayerGameRow, PlayerSeasonDbRow, TeamRow, TeamSeasonDbRow } from '@/server/stats/types';

/** Valores fictícios, só para testar as regras. */

const TEAMS: TeamRow[] = [
  { id: 1, abbreviation: 'AAA', city: 'A', nickname: 'As', full_name: 'A As', conference: 'East' },
  { id: 2, abbreviation: 'BBB', city: 'B', nickname: 'Bs', full_name: 'B Bs', conference: 'West' },
];
const teams = teamMap(TEAMS);

const counts = { pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 };

function playerSeason(id: number, over: Partial<PlayerSeasonDbRow>): PlayerSeasonDbRow {
  return {
    ...counts, player_id: id, last_team_id: 1, games_played: 10, games_started: 10, seconds_played: 10 * 30 * 60,
    double_doubles: 0, triple_doubles: 0, team_partial_games: 0, is_complete: true,
    player: { display_name: `Jogador ${id}`, position: 'G' }, ...over,
  };
}

function teamSeason(id: number, over: Partial<TeamSeasonDbRow>): TeamSeasonDbRow {
  return { ...counts, team_id: id, games_played: 10, wins: 5, losses: 5, opp_pts: 0, possessions: null, opp_possessions: null, is_complete: true, ...over };
}

describe('médias e qualificação de jogadores', () => {
  const teamSeasons = [teamSeason(1, {})];

  it('médias por jogo e percentuais pela razão das somas', () => {
    const [r] = buildPlayerSeasonRows([playerSeason(1, { pts: 250, fgm: 90, fga: 200, fg3m: 20, fg3a: 50, ftm: 50, fta: 60 })], teamSeasons, teams);
    expect(r.pts).toBe(25);
    expect(r.min).toBe(30);
    expect(r.fgPct).toBe(0.45);
    expect(r.fg3Pct).toBe(0.4);
    expect(r.team?.abbreviation).toBe('AAA');
  });

  it('exige 70% dos jogos do time para o ranking', () => {
    const rows = buildPlayerSeasonRows([playerSeason(1, { games_played: 7 }), playerSeason(2, { games_played: 6 })], teamSeasons, teams);
    expect(rows.map((r) => r.qualified)).toEqual([true, false]);
  });

  it('percentuais exigem tentativas mínimas por jogo', () => {
    const [r] = buildPlayerSeasonRows([playerSeason(1, { fga: 49, fgm: 30, fg3a: 20, fg3m: 10, fta: 15, ftm: 15 })], teamSeasons, teams);
    expect(r.qualifiedPct).toEqual({ fg: false, fg3: true, ft: true });
  });

  it('jogador sem jogos disputados não aparece', () => {
    expect(buildPlayerSeasonRows([playerSeason(1, { games_played: 0 })], teamSeasons, teams)).toEqual([]);
  });

  it('ranking ordena do maior para o menor e filtra qualificados', () => {
    const rows = buildPlayerSeasonRows(
      [
        playerSeason(1, { pts: 200 }),
        playerSeason(2, { pts: 300, games_played: 2 }), // média alta, mas poucos jogos
        playerSeason(3, { pts: 250 }),
      ],
      teamSeasons,
      teams,
    );
    expect(rankPlayers(rows, 'pts', true).map((r) => r.playerId)).toEqual([3, 1]);
    expect(rankPlayers(rows, 'pts', false).map((r) => r.playerId)).toEqual([2, 3, 1]);
  });

  it('ranking de percentual exclui quem não tem volume de tentativas', () => {
    const rows = buildPlayerSeasonRows(
      [playerSeason(1, { fgm: 9, fga: 10 }), playerSeason(2, { fgm: 50, fga: 100 })],
      teamSeasons,
      teams,
    );
    expect(rankPlayers(rows, 'fgPct', true).map((r) => r.playerId)).toEqual([2]);
  });
});

describe('times', () => {
  it('ratings ofensivo, defensivo e saldo; ordena pelo saldo', () => {
    const rows = buildTeamSeasonRows(
      [
        teamSeason(1, { pts: 1100, opp_pts: 1000, possessions: 1000, opp_possessions: 1000 }),
        teamSeason(2, { pts: 1000, opp_pts: 1100, possessions: 1000, opp_possessions: 1000 }),
      ],
      teams,
    );
    expect(rows.map((r) => r.team.abbreviation)).toEqual(['AAA', 'BBB']);
    expect(rows[0]).toMatchObject({ offRating: 110, defRating: 100, netRating: 10, pts: 110, oppPts: 100 });
  });

  it('sem posses, ratings ficam nulos (não zero)', () => {
    const [r] = buildTeamSeasonRows([teamSeason(1, { pts: 100 })], teams);
    expect(r.offRating).toBeNull();
    expect(r.netRating).toBeNull();
  });

  it('classificação separada por conferência e em ordem', () => {
    const base = { wins: 1, losses: 0, win_pct: 1, games_behind: 0, home_wins: 1, home_losses: 0, away_wins: 0, away_losses: 0, last10_wins: 1, last10_losses: 0, streak: 1 };
    const s = buildStandings(
      [
        { ...base, team_id: 2, conference: 'West', conference_rank: 1 },
        { ...base, team_id: 1, conference: 'East', conference_rank: 1 },
      ],
      teams,
    );
    expect(s.East.map((r) => r.team.abbreviation)).toEqual(['AAA']);
    expect(s.West[0]).toMatchObject({ home: [1, 0], last10: [1, 0] });
  });
});

describe('box score e jogo a jogo', () => {
  const game: GameRow = {
    id: 9, season_id: 1, season_type: 'regular', game_date: '2026-11-02', starts_at: '2026-11-03T00:00:00Z', status: 'final',
    stats_status: 'partial', home_team_id: 1, away_team_id: 2, home_score: 100, away_score: 90, overtime_periods: 0,
  };
  const line = (player_id: number, team_id: number, over: Partial<PlayerGameRow>): PlayerGameRow => ({
    ...counts, game_id: 9, player_id, team_id, game_date: '2026-11-02', is_starter: false, did_not_play: false,
    seconds_played: 600, plus_minus: 0, player: { display_name: `J${player_id}`, position: null }, ...over,
  });

  it('visitante primeiro; titulares antes, depois por minutos; quem não jogou no fim', () => {
    const box = buildBoxScore(
      game,
      [
        line(1, 1, { seconds_played: 1200 }),
        line(2, 1, { is_starter: true, seconds_played: 900 }),
        line(3, 1, { did_not_play: true, seconds_played: 0 }),
        line(4, 1, { seconds_played: 1500 }),
        line(5, 2, {}),
      ],
      [{ ...counts, game_id: 9, team_id: 1, pts: 100 }],
      teams,
    );
    expect(box.teams.map((t) => t.team.abbreviation)).toEqual(['BBB', 'AAA']);
    expect(box.teams[1].lines.map((l) => l.playerId)).toEqual([2, 4, 1, 3]);
    expect(box.teams[1].totals?.pts).toBe(100);
    expect(box.teams[0].totals).toBeNull();
    expect(box.game.statsStatus).toBe('partial');
  });

  it('jogo a jogo: adversário, mando e resultado do ponto de vista do jogador', () => {
    const [row] = buildGameLog([line(5, 2, { pts: 20 })], [game], teams);
    expect(row).toMatchObject({ isHome: false, teamScore: 90, oppScore: 100, won: false, statsStatus: 'partial' });
    expect(row.opponent.abbreviation).toBe('AAA');
    expect(row.line.pts).toBe(20);
  });
});

describe('leitor fictício', () => {
  const reader = new FixtureStatsReader();

  it('box score fictício bate com o placar e os totais', async () => {
    const [game] = await reader.gamesOn('2026-10-28');
    const lines = await reader.gamePlayerLines(game.id);
    const totals = await reader.gameTeamTotals(game.id);
    const box = buildBoxScore(game, lines, totals, teamMap(await reader.teams()));
    for (const side of box.teams) {
      expect(side.lines.reduce((a, l) => a + l.pts, 0)).toBe(side.score);
      expect(side.totals?.pts).toBe(side.score);
    }
  });

  it('classificação e médias coerentes com o jogo encerrado', async () => {
    const teams = teamMap(await reader.teams());
    const standings = buildStandings(await reader.standings(), teams);
    expect(standings.East.map((r) => `${r.team.abbreviation} ${r.wins}-${r.losses}`)).toEqual(['AUR 1-0', 'BRV 0-1']);
    const rows = buildPlayerSeasonRows(await reader.playerSeasons(1, 'regular'), await reader.teamSeasons(1, 'regular'), teams);
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.qualified && r.gp === 1)).toBe(true);
  });

  it('data padrão é a do último jogo iniciado, com navegação entre datas', async () => {
    expect(await reader.defaultGameDate()).toBe('2026-10-28');
    expect(await reader.adjacentGameDates('2026-10-28')).toEqual({ prev: null, next: '2026-11-03' });
  });
});

describe('formatação pt-BR', () => {
  it('números, percentuais e sinais', () => {
    expect(fmt1(25.35)).toBe('25,4');
    expect(fmt1(null)).toBe('—');
    expect(fmtPct(0.4521)).toBe('45,2%');
    expect(fmtWinPct(0.667)).toBe(',667');
    expect(fmtWinPct(1)).toBe('1,000');
    expect(fmtSigned(5)).toBe('+5');
    expect(fmtSigned(-3)).toBe('−3');
    expect(fmtSigned(0)).toBe('0');
    expect(fmtSigned(2.25, 1)).toBe('+2,3');
  });

  it('tempo, datas e sequência', () => {
    expect(fmtMinutes(2052)).toBe('34:12');
    expect(fmtMinutes(0)).toBe('0:00');
    expect(fmtGameDate('2026-11-02', 'short')).toBe('02/11');
    expect(fmtGameDate('2026-11-02')).toMatch(/2 de nov/);
    expect(fmtStartTime('2026-11-03T00:30:00Z')).toBe('21:30');
    expect(fmtStreak(3)).toBe('V3');
    expect(fmtStreak(-2)).toBe('D2');
  });
});

describe('parâmetros de URL', () => {
  it('data válida ou nula', () => {
    expect(parseDateParam({ data: '2026-11-02' }, 'data')).toBe('2026-11-02');
    expect(parseDateParam({ data: '2026-02-30' }, 'data')).toBeNull();
    expect(parseDateParam({ data: "2026-11-02' or 1=1" }, 'data')).toBeNull();
    expect(parseDateParam({ data: ['2026-11-02', 'x'] }, 'data')).toBe('2026-11-02');
    expect(parseDateParam({}, 'data')).toBeNull();
  });

  it('ordenação só aceita valores conhecidos', () => {
    expect(parseEnumParam({ ordem: 'reb' }, 'ordem', ['pts', 'reb'] as const)).toBe('reb');
    expect(parseEnumParam({ ordem: '__proto__' }, 'ordem', ['pts', 'reb'] as const)).toBeNull();
  });

  it('busca limitada, ids e siglas validados', () => {
    expect(parseSearchParam({ q: `  ${'a'.repeat(60)} ` }, 'q')).toHaveLength(40);
    expect(parseIdParam('123')).toBe(123);
    expect(parseIdParam('12a')).toBeNull();
    expect(parseIdParam('-1')).toBeNull();
    expect(parseTeamParam('bos')).toBe('BOS');
    expect(parseTeamParam('BOS;')).toBeNull();
  });
});

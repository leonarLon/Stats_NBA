import {
  MIN_ATTEMPTS_PER_GAME,
  efgPct,
  fg3Pct,
  fgPct,
  ftPct,
  minGamesToQualify,
  perGame,
  rating,
  tsPct,
} from '../domain/formulas';
import type { GameStatus } from '../domain/types';
import type {
  GameRow,
  PlayerGameRow,
  PlayerSeasonDbRow,
  StandingDbRow,
  StatsStatus,
  TeamGameRow,
  TeamRow,
  TeamSeasonDbRow,
} from './types';

/**
 * Modelos de tela e as funções puras que os montam a partir das linhas do banco.
 * Todas as fórmulas vêm de domain/formulas.ts (docs/STATS_FORMULAS.md).
 */

export interface TeamRef {
  id: number;
  abbreviation: string;
  name: string;
  city: string;
  nickname: string;
  conference: 'East' | 'West' | null;
}

export interface GameSummary {
  id: number;
  date: string;
  startsAt: string | null;
  status: GameStatus;
  statsStatus: StatsStatus;
  home: TeamRef;
  away: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
  overtimePeriods: number;
}

export interface Counts {
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

export interface BoxLine extends Counts {
  playerId: number;
  name: string;
  position: string | null;
  isStarter: boolean;
  didNotPlay: boolean;
  seconds: number;
  plusMinus: number | null;
}

export interface BoxTeam {
  team: TeamRef;
  score: number | null;
  totals: Counts | null;
  lines: BoxLine[];
}

export interface BoxScore {
  game: GameSummary;
  /** Visitante primeiro, mandante depois (convenção do placar). */
  teams: [BoxTeam, BoxTeam];
}

export interface PlayerSeasonRow {
  playerId: number;
  name: string;
  position: string | null;
  team: TeamRef | null;
  gp: number;
  gs: number;
  min: number | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  stl: number | null;
  blk: number | null;
  tov: number | null;
  fgPct: number | null;
  fg3Pct: number | null;
  ftPct: number | null;
  efgPct: number | null;
  tsPct: number | null;
  doubleDoubles: number;
  tripleDoubles: number;
  teamPartialGames: number;
  isComplete: boolean;
  /** Atinge o mínimo de jogos para rankings de média (seção 5 das fórmulas). */
  qualified: boolean;
  /** Atinge o mínimo de tentativas por jogo para cada ranking de percentual. */
  qualifiedPct: { fg: boolean; fg3: boolean; ft: boolean };
}

export interface TeamSeasonRow {
  team: TeamRef;
  gp: number;
  wins: number;
  losses: number;
  pts: number | null;
  oppPts: number | null;
  reb: number | null;
  ast: number | null;
  fgPct: number | null;
  fg3Pct: number | null;
  ftPct: number | null;
  offRating: number | null;
  defRating: number | null;
  netRating: number | null;
  isComplete: boolean;
}

export interface StandingRow {
  team: TeamRef;
  rank: number;
  wins: number;
  losses: number;
  winPct: number;
  gamesBehind: number;
  home: [number, number];
  away: [number, number];
  last10: [number, number];
  streak: number;
}

export interface GameLogRow {
  gameId: number;
  date: string;
  opponent: TeamRef;
  isHome: boolean;
  teamScore: number | null;
  oppScore: number | null;
  won: boolean | null;
  statsStatus: StatsStatus;
  line: BoxLine;
}

export type TeamMap = Map<number, TeamRef>;

export function toTeamRef(t: TeamRow): TeamRef {
  return { id: t.id, abbreviation: t.abbreviation, name: t.full_name, city: t.city, nickname: t.nickname, conference: t.conference };
}

export function teamMap(teams: TeamRow[]): TeamMap {
  return new Map(teams.map((t) => [t.id, toTeamRef(t)]));
}

function teamOf(teams: TeamMap, id: number): TeamRef {
  const team = teams.get(id);
  if (!team) throw new Error(`time ${id} não encontrado`);
  return team;
}

function counts(r: Counts): Counts {
  return {
    pts: r.pts, fgm: r.fgm, fga: r.fga, fg3m: r.fg3m, fg3a: r.fg3a, ftm: r.ftm, fta: r.fta,
    oreb: r.oreb, dreb: r.dreb, reb: r.reb, ast: r.ast, stl: r.stl, blk: r.blk, tov: r.tov, pf: r.pf,
  };
}

export function toGameSummary(g: GameRow, teams: TeamMap): GameSummary {
  return {
    id: g.id,
    date: g.game_date,
    startsAt: g.starts_at,
    status: g.status,
    statsStatus: g.stats_status,
    home: teamOf(teams, g.home_team_id),
    away: teamOf(teams, g.away_team_id),
    homeScore: g.home_score,
    awayScore: g.away_score,
    overtimePeriods: g.overtime_periods,
  };
}

export function toBoxLine(r: PlayerGameRow): BoxLine {
  return {
    ...counts(r),
    playerId: r.player_id,
    name: r.player.display_name,
    position: r.player.position,
    isStarter: r.is_starter,
    didNotPlay: r.did_not_play,
    seconds: r.seconds_played,
    plusMinus: r.plus_minus,
  };
}

/** Titulares primeiro, depois por minutos; quem não jogou vai para o fim. */
function byRole(a: BoxLine, b: BoxLine): number {
  if (a.didNotPlay !== b.didNotPlay) return a.didNotPlay ? 1 : -1;
  if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
  return b.seconds - a.seconds || a.name.localeCompare(b.name, 'pt-BR');
}

export function buildBoxScore(game: GameRow, lines: PlayerGameRow[], totals: TeamGameRow[], teams: TeamMap): BoxScore {
  const summary = toGameSummary(game, teams);
  const side = (team: TeamRef, score: number | null): BoxTeam => {
    const t = totals.find((x) => x.team_id === team.id);
    return {
      team,
      score,
      totals: t ? counts(t) : null,
      lines: lines.filter((l) => l.team_id === team.id).map(toBoxLine).sort(byRole),
    };
  };
  return { game: summary, teams: [side(summary.away, summary.awayScore), side(summary.home, summary.homeScore)] };
}

export function buildPlayerSeasonRows(rows: PlayerSeasonDbRow[], teamSeasons: TeamSeasonDbRow[], teams: TeamMap): PlayerSeasonRow[] {
  const teamGames = new Map(teamSeasons.map((t) => [t.team_id, t.games_played]));
  return rows
    .filter((r) => r.games_played > 0)
    .map((r) => {
      const gp = r.games_played;
      const teamGp = r.last_team_id === null ? 0 : (teamGames.get(r.last_team_id) ?? 0);
      return {
        playerId: r.player_id,
        name: r.player.display_name,
        position: r.player.position,
        team: r.last_team_id === null ? null : (teams.get(r.last_team_id) ?? null),
        gp,
        gs: r.games_started,
        min: perGame(r.seconds_played / 60, gp),
        pts: perGame(r.pts, gp),
        reb: perGame(r.reb, gp),
        ast: perGame(r.ast, gp),
        stl: perGame(r.stl, gp),
        blk: perGame(r.blk, gp),
        tov: perGame(r.tov, gp),
        fgPct: fgPct(r),
        fg3Pct: fg3Pct(r),
        ftPct: ftPct(r),
        efgPct: efgPct(r),
        tsPct: tsPct(r),
        doubleDoubles: r.double_doubles,
        tripleDoubles: r.triple_doubles,
        teamPartialGames: r.team_partial_games,
        isComplete: r.is_complete,
        qualified: teamGp > 0 && gp >= minGamesToQualify(teamGp),
        qualifiedPct: {
          fg: r.fga >= MIN_ATTEMPTS_PER_GAME.fg * gp,
          fg3: r.fg3a >= MIN_ATTEMPTS_PER_GAME.fg3 * gp,
          ft: r.fta >= MIN_ATTEMPTS_PER_GAME.ft * gp,
        },
      };
    });
}

export const PLAYER_SORT_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'min', 'gp', 'fgPct', 'fg3Pct', 'ftPct', 'tsPct'] as const;
export type PlayerSortKey = (typeof PLAYER_SORT_KEYS)[number];

const PCT_QUALIFIER: Partial<Record<PlayerSortKey, keyof PlayerSeasonRow['qualifiedPct']>> = {
  fgPct: 'fg',
  fg3Pct: 'fg3',
  ftPct: 'ft',
  tsPct: 'fg',
};

/**
 * Ranking de jogadores. Com `onlyQualified`, aplica o mínimo de jogos e, nos percentuais,
 * o mínimo de tentativas. Erros (tov) também ordenam do maior para o menor: é um ranking.
 */
export function rankPlayers(rows: PlayerSeasonRow[], key: PlayerSortKey, onlyQualified: boolean): PlayerSeasonRow[] {
  const pct = PCT_QUALIFIER[key];
  return rows
    .filter((r) => !onlyQualified || (r.qualified && (!pct || r.qualifiedPct[pct])))
    .filter((r) => r[key] !== null)
    .sort((a, b) => (b[key] as number) - (a[key] as number) || a.name.localeCompare(b.name, 'pt-BR'));
}

export function buildTeamSeasonRows(rows: TeamSeasonDbRow[], teams: TeamMap): TeamSeasonRow[] {
  return rows
    .filter((r) => teams.has(r.team_id))
    .map((r) => {
      const off = rating(r.pts, r.possessions);
      const def = rating(r.opp_pts, r.opp_possessions);
      return {
        team: teamOf(teams, r.team_id),
        gp: r.games_played,
        wins: r.wins,
        losses: r.losses,
        pts: perGame(r.pts, r.games_played),
        oppPts: perGame(r.opp_pts, r.games_played),
        reb: perGame(r.reb, r.games_played),
        ast: perGame(r.ast, r.games_played),
        fgPct: fgPct(r),
        fg3Pct: fg3Pct(r),
        ftPct: ftPct(r),
        offRating: off,
        defRating: def,
        netRating: off === null || def === null ? null : off - def,
        isComplete: r.is_complete,
      };
    })
    .sort((a, b) => (b.netRating ?? -Infinity) - (a.netRating ?? -Infinity) || a.team.abbreviation.localeCompare(b.team.abbreviation));
}

export function buildStandings(rows: StandingDbRow[], teams: TeamMap): Record<'East' | 'West', StandingRow[]> {
  const result: Record<'East' | 'West', StandingRow[]> = { East: [], West: [] };
  for (const r of rows) {
    const team = teams.get(r.team_id);
    if (!team) continue;
    result[r.conference].push({
      team,
      rank: r.conference_rank,
      wins: r.wins,
      losses: r.losses,
      winPct: Number(r.win_pct),
      gamesBehind: Number(r.games_behind),
      home: [r.home_wins, r.home_losses],
      away: [r.away_wins, r.away_losses],
      last10: [r.last10_wins, r.last10_losses],
      streak: r.streak,
    });
  }
  result.East.sort((a, b) => a.rank - b.rank);
  result.West.sort((a, b) => a.rank - b.rank);
  return result;
}

export function buildGameLog(lines: PlayerGameRow[], games: GameRow[], teams: TeamMap): GameLogRow[] {
  const byId = new Map(games.map((g) => [g.id, g]));
  const rows: GameLogRow[] = [];
  for (const l of lines) {
    const g = byId.get(l.game_id);
    if (!g) continue;
    const isHome = g.home_team_id === l.team_id;
    const teamScore = isHome ? g.home_score : g.away_score;
    const oppScore = isHome ? g.away_score : g.home_score;
    rows.push({
      gameId: g.id,
      date: g.game_date,
      opponent: teamOf(teams, isHome ? g.away_team_id : g.home_team_id),
      isHome,
      teamScore,
      oppScore,
      won: teamScore === null || oppScore === null ? null : teamScore > oppScore,
      statsStatus: g.stats_status,
      line: toBoxLine(l),
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.gameId - a.gameId);
}

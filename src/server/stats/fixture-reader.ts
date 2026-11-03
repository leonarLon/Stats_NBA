import { isDoubleDouble, isTripleDouble, possessions } from '../domain/formulas';
import type { SeasonType } from '../domain/types';
import { FIXTURE_BOX_SCORES, FIXTURE_GAMES, FIXTURE_TEAMS } from '../providers/fixture/data';
import { sumTeamTotals } from '../providers/fixture/fixture-provider';
import type {
  GameRow,
  PlayerGameRow,
  PlayerSeasonDbRow,
  StandingDbRow,
  StatsReader,
  TeamGameRow,
  TeamRow,
  TeamSeasonDbRow,
} from './types';

/**
 * Leitor com os dados FICTÍCIOS de providers/fixture, no mesmo formato do banco.
 * Usado quando o Supabase não está configurado: desenvolvimento sem credenciais e testes E2E.
 * Os agregados são calculados aqui de forma simples; os do banco vêm das funções SQL.
 */

const SEASON = { id: 1, start_year: 2026, label: '2026-27' };

const TEAMS: TeamRow[] = FIXTURE_TEAMS.map((t, i) => ({
  id: i + 1, abbreviation: t.abbreviation, city: t.city, nickname: t.nickname, full_name: t.fullName, conference: t.conference,
}));
const teamId = (abbr: string) => TEAMS.find((t) => t.abbreviation === abbr)!.id;

const GAMES: GameRow[] = FIXTURE_GAMES.map((g, i) => ({
  id: i + 1,
  season_id: SEASON.id,
  season_type: g.seasonType,
  game_date: g.gameDate,
  starts_at: g.startsAt,
  status: g.status,
  stats_status: FIXTURE_BOX_SCORES[g.externalId] ? 'complete' : 'pending',
  home_team_id: teamId(g.homeTeamExternalId),
  away_team_id: teamId(g.awayTeamExternalId),
  home_score: g.homeScore,
  away_score: g.awayScore,
  overtime_periods: g.overtimePeriods,
}));

const playerIds = new Map<string, number>();
const PLAYER_LINES: PlayerGameRow[] = [];
const TEAM_TOTALS: TeamGameRow[] = [];

FIXTURE_GAMES.forEach((g, i) => {
  const lines = FIXTURE_BOX_SCORES[g.externalId];
  if (!lines) return;
  for (const l of lines) {
    if (!playerIds.has(l.playerExternalId)) playerIds.set(l.playerExternalId, playerIds.size + 1);
    PLAYER_LINES.push({
      game_id: i + 1, player_id: playerIds.get(l.playerExternalId)!, team_id: teamId(l.teamExternalId), game_date: g.gameDate,
      is_starter: l.isStarter, did_not_play: l.didNotPlay, seconds_played: l.secondsPlayed, plus_minus: l.plusMinus,
      pts: l.pts, fgm: l.fgm, fga: l.fga, fg3m: l.fg3m, fg3a: l.fg3a, ftm: l.ftm, fta: l.fta,
      oreb: l.oreb, dreb: l.dreb, reb: l.reb, ast: l.ast, stl: l.stl, blk: l.blk, tov: l.tov, pf: l.pf,
      player: { display_name: `${l.firstName} ${l.lastName}`, position: l.position },
    });
  }
  for (const t of sumTeamTotals(lines)) {
    const { teamExternalId, ...rest } = t;
    TEAM_TOTALS.push({ game_id: i + 1, team_id: teamId(teamExternalId), ...rest });
  }
});

const COUNTERS = ['pts', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf'] as const;
const zero = () => ({ pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 });

function playerSeasons(): PlayerSeasonDbRow[] {
  const rows = new Map<number, PlayerSeasonDbRow>();
  for (const l of PLAYER_LINES) {
    if (l.did_not_play) continue;
    const r = rows.get(l.player_id) ?? {
      player_id: l.player_id, last_team_id: l.team_id, games_played: 0, games_started: 0, seconds_played: 0,
      double_doubles: 0, triple_doubles: 0, team_partial_games: 0, is_complete: true, player: l.player, ...zero(),
    };
    r.games_played++;
    r.games_started += l.is_starter ? 1 : 0;
    r.seconds_played += l.seconds_played;
    for (const k of COUNTERS) r[k] += l[k];
    r.oreb = (r.oreb ?? 0) + (l.oreb ?? 0);
    r.dreb = (r.dreb ?? 0) + (l.dreb ?? 0);
    r.double_doubles += isDoubleDouble(l) ? 1 : 0;
    r.triple_doubles += isTripleDouble(l) ? 1 : 0;
    rows.set(l.player_id, r);
  }
  return [...rows.values()];
}

function teamSeasons(): TeamSeasonDbRow[] {
  return TEAMS.map((team) => {
    const r: TeamSeasonDbRow = {
      team_id: team.id, games_played: 0, wins: 0, losses: 0, opp_pts: 0, possessions: 0, opp_possessions: 0, is_complete: true, ...zero(),
    };
    for (const t of TEAM_TOTALS.filter((x) => x.team_id === team.id)) {
      const opp = TEAM_TOTALS.find((x) => x.game_id === t.game_id && x.team_id !== team.id)!;
      r.games_played++;
      r[t.pts > opp.pts ? 'wins' : 'losses']++;
      for (const k of COUNTERS) r[k] += t[k];
      r.oreb = (r.oreb ?? 0) + (t.oreb ?? 0);
      r.dreb = (r.dreb ?? 0) + (t.dreb ?? 0);
      r.opp_pts += opp.pts;
      r.possessions = (r.possessions ?? 0) + (possessions(t) ?? 0);
      r.opp_possessions = (r.opp_possessions ?? 0) + (possessions(opp) ?? 0);
    }
    return r;
  });
}

function standings(): StandingDbRow[] {
  const seasons = teamSeasons();
  const rows: StandingDbRow[] = [];
  for (const conf of ['East', 'West'] as const) {
    const teams = TEAMS.filter((t) => t.conference === conf)
      .map((t) => ({ t, s: seasons.find((s) => s.team_id === t.id)! }))
      .sort((a, b) => b.s.wins - a.s.wins || a.s.losses - b.s.losses || a.t.abbreviation.localeCompare(b.t.abbreviation));
    const leader = teams[0]?.s;
    teams.forEach(({ t, s }, i) => {
      const home = GAMES.filter((g) => g.status === 'final' && g.home_team_id === t.id);
      const away = GAMES.filter((g) => g.status === 'final' && g.away_team_id === t.id);
      const homeWins = home.filter((g) => g.home_score! > g.away_score!).length;
      const awayWins = away.filter((g) => g.away_score! > g.home_score!).length;
      rows.push({
        team_id: t.id, conference: conf, conference_rank: i + 1, wins: s.wins, losses: s.losses,
        win_pct: s.games_played === 0 ? 0 : s.wins / s.games_played,
        games_behind: leader ? (leader.wins - s.wins + s.losses - leader.losses) / 2 : 0,
        home_wins: homeWins, home_losses: home.length - homeWins, away_wins: awayWins, away_losses: away.length - awayWins,
        last10_wins: s.wins, last10_losses: s.losses, streak: s.wins > 0 ? s.wins : -s.losses,
      });
    });
  }
  return rows;
}

const byDate = [...new Set(GAMES.map((g) => g.game_date))].sort();

export class FixtureStatsReader implements StatsReader {
  async currentSeason() {
    return SEASON;
  }
  async teams() {
    return TEAMS;
  }
  async standings() {
    return standings();
  }
  async playerSeasons(_seasonId: number, seasonType: SeasonType) {
    return seasonType === 'regular' ? playerSeasons() : [];
  }
  async teamSeasons(_seasonId: number, seasonType: SeasonType) {
    return seasonType === 'regular' ? teamSeasons() : [];
  }
  async defaultGameDate() {
    const started = GAMES.filter((g) => g.status === 'final' || g.status === 'in_progress').map((g) => g.game_date).sort();
    return started.at(-1) ?? byDate[0] ?? null;
  }
  async gamesOn(date: string) {
    return GAMES.filter((g) => g.game_date === date);
  }
  async adjacentGameDates(date: string) {
    return { prev: byDate.filter((d) => d < date).at(-1) ?? null, next: byDate.find((d) => d > date) ?? null };
  }
  async game(id: number) {
    return GAMES.find((g) => g.id === id) ?? null;
  }
  async gamePlayerLines(gameId: number) {
    return PLAYER_LINES.filter((l) => l.game_id === gameId);
  }
  async gameTeamTotals(gameId: number) {
    return TEAM_TOTALS.filter((t) => t.game_id === gameId);
  }
  async player(id: number) {
    const line = PLAYER_LINES.find((l) => l.player_id === id);
    return line ? { id, display_name: line.player.display_name, position: line.player.position, current_team_id: line.team_id } : null;
  }
  async playerGameLines(playerId: number) {
    return PLAYER_LINES.filter((l) => l.player_id === playerId);
  }
  async gamesByIds(ids: number[]) {
    return GAMES.filter((g) => ids.includes(g.id));
  }
  async teamGames(teamId: number) {
    return GAMES.filter((g) => g.home_team_id === teamId || g.away_team_id === teamId);
  }
}

import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { cache } from 'react';
import { requireAccess } from '../auth/session';
import { isSupabaseConfigured } from '../lib/config';
import { getSupabaseAdmin } from '../supabase/admin';
import {
  buildBoxScore,
  buildGameLog,
  buildPlayerSeasonRows,
  buildStandings,
  buildTeamSeasonRows,
  teamMap,
  toGameSummary,
  type TeamRef,
} from './compute';
import { FixtureStatsReader } from './fixture-reader';
import { SupabaseStatsReader } from './supabase-reader';
import { STATS_TAG } from './tags';
import type { StatsReader } from './types';

/**
 * Camada de acesso aos dados de estatística (padrão DAL da documentação do Next.js):
 * - as funções exportadas verificam o acesso do usuário (sessão + teste/assinatura) ANTES de ler;
 * - as leituras ficam em funções internas com 'use cache', compartilhadas entre usuários,
 *   porque os dados são os mesmos para todos. Elas não são exportadas, para que nada
 *   leia estatística sem passar pela verificação.
 * Sem Supabase configurado, usa os dados fictícios e não exige login (modo demonstração).
 */

const SEASON_TYPE = 'regular' as const;

export function isStatsDemo(): boolean {
  return !(isSupabaseConfigured() && process.env.SUPABASE_SECRET_KEY);
}

function reader(): StatsReader {
  return isStatsDemo() ? new FixtureStatsReader() : new SupabaseStatsReader(getSupabaseAdmin());
}

/** Uma verificação por requisição, mesmo com várias consultas na página. */
const ensureAccess = cache(async () => {
  if (isStatsDemo()) return;
  await requireAccess();
});

function cacheStats() {
  cacheLife('minutes');
  cacheTag(STATS_TAG);
}

async function seasonContext(r: StatsReader) {
  const [season, teams] = await Promise.all([r.currentSeason(), r.teams()]);
  return { season, teams: teamMap(teams) };
}

// ---------------------------------------------------------------------------
// Classificação
// ---------------------------------------------------------------------------

async function loadStandings() {
  'use cache';
  cacheStats();
  const r = reader();
  const { season, teams } = await seasonContext(r);
  if (!season) return null;
  return { season: season.label, standings: buildStandings(await r.standings(season.id), teams) };
}

export async function getStandings() {
  await ensureAccess();
  return loadStandings();
}

// ---------------------------------------------------------------------------
// Jogos
// ---------------------------------------------------------------------------

async function loadGamesOn(date: string | null) {
  'use cache';
  cacheStats();
  const r = reader();
  const day = date ?? (await r.defaultGameDate());
  if (!day) return null;
  const [games, adjacent, { teams }] = await Promise.all([r.gamesOn(day), r.adjacentGameDates(day), seasonContext(r)]);
  return { date: day, ...adjacent, games: games.map((g) => toGameSummary(g, teams)) };
}

/** Jogos de uma data (horário dos EUA). Sem data, o dia do último jogo iniciado. */
export async function getGamesOn(date: string | null) {
  await ensureAccess();
  return loadGamesOn(date);
}

async function loadBoxScore(gameId: number) {
  'use cache';
  cacheStats();
  const r = reader();
  const game = await r.game(gameId);
  if (!game) return null;
  const [lines, totals, { teams }] = await Promise.all([r.gamePlayerLines(gameId), r.gameTeamTotals(gameId), seasonContext(r)]);
  return buildBoxScore(game, lines, totals, teams);
}

export async function getBoxScore(gameId: number) {
  await ensureAccess();
  return loadBoxScore(gameId);
}

// ---------------------------------------------------------------------------
// Jogadores
// ---------------------------------------------------------------------------

async function loadPlayerSeasons() {
  'use cache';
  cacheStats();
  const r = reader();
  const { season, teams } = await seasonContext(r);
  if (!season) return null;
  const [players, teamSeasons] = await Promise.all([r.playerSeasons(season.id, SEASON_TYPE), r.teamSeasons(season.id, SEASON_TYPE)]);
  return { season: season.label, rows: buildPlayerSeasonRows(players, teamSeasons, teams) };
}

/** Médias da temporada atual de todos os jogadores (a página ordena e filtra). */
export async function getPlayerSeasons() {
  await ensureAccess();
  return loadPlayerSeasons();
}

async function loadPlayer(playerId: number) {
  'use cache';
  cacheStats();
  const r = reader();
  const player = await r.player(playerId);
  if (!player) return null;
  const { season, teams } = await seasonContext(r);
  if (!season) return null;
  const [lines, players, teamSeasons] = await Promise.all([
    r.playerGameLines(playerId, season.id),
    r.playerSeasons(season.id, SEASON_TYPE),
    r.teamSeasons(season.id, SEASON_TYPE),
  ]);
  const games = await r.gamesByIds([...new Set(lines.map((l) => l.game_id))]);
  const seasonRow = buildPlayerSeasonRows(players.filter((p) => p.player_id === playerId), teamSeasons, teams)[0] ?? null;
  const teamId = seasonRow?.team?.id ?? player.current_team_id;
  return {
    season: season.label,
    player: { id: player.id, name: player.display_name, position: player.position },
    team: teamId === null ? null : (teams.get(teamId) ?? null),
    seasonRow,
    gameLog: buildGameLog(lines, games, teams),
  };
}

export async function getPlayer(playerId: number) {
  await ensureAccess();
  return loadPlayer(playerId);
}

// ---------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------

async function loadTeamSeasons() {
  'use cache';
  cacheStats();
  const r = reader();
  const { season, teams } = await seasonContext(r);
  if (!season) return null;
  const [teamSeasons, standings] = await Promise.all([r.teamSeasons(season.id, SEASON_TYPE), r.standings(season.id)]);
  // Campanha (V-D) vem da classificação, que conta todos os jogos; as médias, só dos jogos com box score
  const records = new Map(standings.map((s) => [s.team_id, s]));
  const rows = buildTeamSeasonRows(teamSeasons, teams).map((row) => {
    const st = records.get(row.team.id);
    return st ? { ...row, wins: st.wins, losses: st.losses } : row;
  });
  return { season: season.label, rows };
}

export async function getTeamSeasons() {
  await ensureAccess();
  return loadTeamSeasons();
}

async function loadTeam(abbreviation: string) {
  'use cache';
  cacheStats();
  const r = reader();
  const { season, teams } = await seasonContext(r);
  const team: TeamRef | undefined = [...teams.values()].find((t) => t.abbreviation === abbreviation);
  if (!season || !team) return null;
  const [teamSeasons, players, standings, games] = await Promise.all([
    r.teamSeasons(season.id, SEASON_TYPE),
    r.playerSeasons(season.id, SEASON_TYPE),
    r.standings(season.id),
    r.teamGames(team.id, season.id),
  ]);
  const conference = team.conference ? buildStandings(standings, teams)[team.conference] : [];
  return {
    season: season.label,
    team,
    seasonRow: buildTeamSeasonRows(teamSeasons.filter((t) => t.team_id === team.id), teams)[0] ?? null,
    standing: conference.find((s) => s.team.id === team.id) ?? null,
    roster: buildPlayerSeasonRows(players.filter((p) => p.last_team_id === team.id), teamSeasons, teams).sort(
      (a, b) => (b.min ?? 0) - (a.min ?? 0),
    ),
    games: games.map((g) => toGameSummary(g, teams)),
  };
}

export async function getTeam(abbreviation: string) {
  await ensureAccess();
  return loadTeam(abbreviation);
}

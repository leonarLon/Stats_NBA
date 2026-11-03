import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeasonType } from '../domain/types';
import { UNAVAILABLE_REASON } from '../ingestion/constants';
import { AppError } from '../lib/errors';
import type {
  GameRow,
  PlayerDbRow,
  PlayerGameRow,
  PlayerSeasonDbRow,
  SeasonRow,
  StandingDbRow,
  StatsReader,
  TeamGameRow,
  TeamRow,
  TeamSeasonDbRow,
} from './types';

const GAME_COLS =
  'id, season_id, season_type, game_date, starts_at, status, stats_status, home_team_id, away_team_id, home_score, away_score, overtime_periods, sync:game_sync_state(last_error)';
const COUNT_COLS = 'pts, fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, blk, tov, pf';
const PLAYER_GAME_COLS = `game_id, player_id, team_id, game_date, is_starter, did_not_play, seconds_played, plus_minus, ${COUNT_COLS}, player:players(display_name, position)`;
/** Teto de linhas por consulta: uma temporada tem ~500 jogadores e ~1.300 jogos. */
const MAX_ROWS = 2000;

type GameDbRow = Omit<GameRow, 'stats_status'> & {
  stats_status: GameRow['stats_status'];
  sync: { last_error: string | null } | { last_error: string | null }[] | null;
};

/** Jogo encerrado que o worker desistiu de buscar por estar fora da janela da fonte. */
function toGameRow({ sync, ...g }: GameDbRow): GameRow {
  const state = Array.isArray(sync) ? sync[0] : sync;
  const unavailable = g.status === 'final' && g.stats_status === 'pending' && state?.last_error === UNAVAILABLE_REASON;
  return { ...g, stats_status: unavailable ? 'unavailable' : g.stats_status };
}

function unwrap<T>(what: string, result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new AppError('INTERNAL', `Falha ao ler ${what}`, { cause: result.error });
  return result.data as T;
}

/**
 * Leitura com a chave secreta (ignora o RLS). Só é chamado por queries.ts, que verifica
 * o acesso do usuário antes. A chave nunca chega ao navegador.
 */
export class SupabaseStatsReader implements StatsReader {
  constructor(private readonly db: SupabaseClient) {}

  async currentSeason() {
    return unwrap<SeasonRow | null>('temporada', await this.db.from('seasons').select('id, start_year, label').eq('is_current', true).maybeSingle());
  }

  async teams() {
    return unwrap<TeamRow[]>(
      'times',
      await this.db.from('teams').select('id, abbreviation, city, nickname, full_name, conference').eq('is_active', true).order('abbreviation'),
    );
  }

  async standings(seasonId: number) {
    return unwrap<StandingDbRow[]>('classificação', await this.db.from('standings').select('*').eq('season_id', seasonId));
  }

  async playerSeasons(seasonId: number, seasonType: SeasonType) {
    return unwrap<PlayerSeasonDbRow[]>(
      'médias de jogadores',
      await this.db
        .from('player_season_stats')
        .select(`player_id, last_team_id, games_played, games_started, seconds_played, double_doubles, triple_doubles, team_partial_games, is_complete, ${COUNT_COLS}, player:players(display_name, position)`)
        .eq('season_id', seasonId)
        .eq('season_type', seasonType)
        .range(0, MAX_ROWS - 1),
    );
  }

  async teamSeasons(seasonId: number, seasonType: SeasonType) {
    return unwrap<TeamSeasonDbRow[]>(
      'médias de times',
      await this.db
        .from('team_season_stats')
        .select(`team_id, games_played, wins, losses, opp_pts, possessions, opp_possessions, is_complete, ${COUNT_COLS}`)
        .eq('season_id', seasonId)
        .eq('season_type', seasonType),
    );
  }

  async defaultGameDate() {
    const started = unwrap<{ game_date: string }[]>(
      'datas de jogos',
      await this.db.from('games').select('game_date').in('status', ['final', 'in_progress']).order('game_date', { ascending: false }).limit(1),
    );
    if (started[0]) return started[0].game_date;
    const upcoming = unwrap<{ game_date: string }[]>(
      'datas de jogos',
      await this.db.from('games').select('game_date').order('game_date').limit(1),
    );
    return upcoming[0]?.game_date ?? null;
  }

  async gamesOn(date: string) {
    return unwrap<GameDbRow[]>('jogos', await this.db.from('games').select(GAME_COLS).eq('game_date', date).order('starts_at').order('id')).map(toGameRow);
  }

  async adjacentGameDates(date: string) {
    const [prev, next] = await Promise.all([
      this.db.from('games').select('game_date').lt('game_date', date).order('game_date', { ascending: false }).limit(1),
      this.db.from('games').select('game_date').gt('game_date', date).order('game_date').limit(1),
    ]);
    return {
      prev: unwrap<{ game_date: string }[]>('datas de jogos', prev)[0]?.game_date ?? null,
      next: unwrap<{ game_date: string }[]>('datas de jogos', next)[0]?.game_date ?? null,
    };
  }

  async game(id: number) {
    const row = unwrap<GameDbRow | null>('jogo', await this.db.from('games').select(GAME_COLS).eq('id', id).maybeSingle());
    return row ? toGameRow(row) : null;
  }

  async gamePlayerLines(gameId: number) {
    return unwrap<PlayerGameRow[]>('box score', await this.db.from('player_game_stats').select(PLAYER_GAME_COLS).eq('game_id', gameId));
  }

  async gameTeamTotals(gameId: number) {
    return unwrap<TeamGameRow[]>('totais do jogo', await this.db.from('team_game_stats').select(`game_id, team_id, ${COUNT_COLS}`).eq('game_id', gameId));
  }

  async player(id: number) {
    return unwrap<PlayerDbRow | null>(
      'jogador',
      await this.db.from('players').select('id, display_name, position, current_team_id').eq('id', id).maybeSingle(),
    );
  }

  async playerGameLines(playerId: number, seasonId: number) {
    return unwrap<PlayerGameRow[]>(
      'jogos do jogador',
      await this.db
        .from('player_game_stats')
        .select(PLAYER_GAME_COLS)
        .eq('player_id', playerId)
        .eq('season_id', seasonId)
        .order('game_date', { ascending: false })
        .range(0, MAX_ROWS - 1),
    );
  }

  async gamesByIds(ids: number[]) {
    if (ids.length === 0) return [];
    return unwrap<GameDbRow[]>('jogos', await this.db.from('games').select(GAME_COLS).in('id', ids)).map(toGameRow);
  }

  async teamGames(teamId: number, seasonId: number) {
    // teamId é número validado; não há texto do usuário no filtro
    return unwrap<GameDbRow[]>(
      'jogos do time',
      await this.db
        .from('games')
        .select(GAME_COLS)
        .eq('season_id', seasonId)
        .or(`home_team_id.eq.${Math.trunc(teamId)},away_team_id.eq.${Math.trunc(teamId)}`)
        .order('starts_at')
        .range(0, MAX_ROWS - 1),
    ).map(toGameRow);
  }
}

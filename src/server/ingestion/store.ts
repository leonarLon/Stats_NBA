import type { SeasonType } from '../domain/types';
import type { ProviderGame, ProviderSlug, ProviderTeam } from '../providers/types';
import type { Rpc } from './rpc';

export type StatsStatus = 'pending' | 'complete' | 'partial' | 'invalid';
export type JobType = 'schedule' | 'status_poll' | 'ingest_game' | 'reconcile' | 'backfill' | 'reference_data' | 'recompute';
export type JobStatus = 'running' | 'succeeded' | 'partial' | 'failed' | 'skipped';

export interface DueGame {
  game_id: number;
  starts_at: string | null;
  game_date: string;
  season_id: number;
  season_type: SeasonType;
  home_team_id: number;
  away_team_id: number;
  home: string;
  away: string;
  home_score: number;
  away_score: number;
  overtime_periods: number;
  stats_status: StatsStatus;
  finalized_at: string | null;
  attempts: number;
  reconcile_stage: number;
  box_ref: string | null;
}

export interface ResolvedPlayerLine {
  player_id: number;
  team_id: number;
  is_starter: boolean;
  did_not_play: boolean;
  seconds_played: number;
  pts: number; fgm: number; fga: number; fg3m: number; fg3a: number; ftm: number; fta: number;
  oreb: number | null; dreb: number | null; reb: number;
  ast: number; stl: number; blk: number; tov: number; pf: number;
  plus_minus: number | null;
}

export interface ResolvedTeamTotals {
  team_id: number;
  pts: number; fgm: number; fga: number; fg3m: number; fg3a: number; ftm: number; fta: number;
  oreb: number | null; dreb: number | null; reb: number;
  ast: number; stl: number; blk: number; tov: number; pf: number;
}

export interface SyncStatePatch {
  attempts: number;
  nextCheckAt: Date | null;
  reconcileStage: number;
  reconcileAt: Date | null;
  reconciledAt: Date | null;
  lastError: string | null;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Acesso tipado às funções SQL da ingestão. Toda escrita é atômica dentro da função. */
export class IngestionStore {
  constructor(private readonly rpc: Rpc) {}

  acquireLock(name: string, holder: string, ttlSeconds: number) {
    return this.rpc<boolean>('ingest_acquire_lock', { p_name: name, p_holder: holder, p_ttl_seconds: ttlSeconds });
  }

  releaseLock(name: string, holder: string) {
    return this.rpc<boolean>('ingest_release_lock', { p_name: name, p_holder: holder });
  }

  consumeQuota(provider: ProviderSlug, limit: number) {
    return this.rpc<boolean>('ingest_consume_quota', { p_provider_slug: provider, p_limit: limit });
  }

  startJob(type: JobType, trigger: 'cron' | 'manual', params: Record<string, unknown>) {
    return this.rpc<string>('ingest_start_job', { p_job_type: type, p_trigger: trigger, p_params: params });
  }

  finishJob(
    jobId: string,
    r: { status: JobStatus; expected?: number | null; processed: number; failed: number; providerRequests: number; error?: unknown },
  ) {
    return this.rpc<boolean>('ingest_finish_job', {
      p_job_id: jobId,
      p_status: r.status,
      p_items_expected: r.expected ?? null,
      p_items_processed: r.processed,
      p_items_failed: r.failed,
      p_provider_requests: r.providerRequests,
      p_error: r.error ?? null,
    });
  }

  log(jobId: string | null, level: 'debug' | 'info' | 'warn' | 'error', message: string, context: Record<string, unknown> = {}) {
    return this.rpc<boolean>('ingest_log', { p_job_id: jobId, p_level: level, p_message: message, p_context: context });
  }

  upsertTeams(provider: ProviderSlug, teams: ProviderTeam[]) {
    return this.rpc<number>('ingest_upsert_teams', {
      p_provider_slug: provider,
      p_teams: teams.map((t) => ({
        external_id: t.externalId, abbreviation: t.abbreviation, city: t.city, nickname: t.nickname,
        full_name: t.fullName, conference: t.conference, division: t.division,
      })),
    });
  }

  upsertGames(provider: ProviderSlug, games: ProviderGame[], now: Date) {
    return this.rpc<Array<{ game_id: number; external_id: string; became_final: boolean }>>('ingest_upsert_games', {
      p_provider_slug: provider,
      p_games: games.map((g) => ({
        external_id: g.externalId, season_start_year: g.seasonStartYear, season_type: g.seasonType,
        game_date: g.gameDate, starts_at: g.startsAt, status: g.status,
        home: g.homeTeamExternalId, away: g.awayTeamExternalId,
        home_score: g.homeScore, away_score: g.awayScore, overtime_periods: g.overtimePeriods,
      })),
      p_now: now.toISOString(),
    });
  }

  ensureSeason(startYear: number) {
    return this.rpc<number>('ingest_ensure_season', { p_start_year: startYear });
  }

  gamesAwaitingFinal(now: Date, minAgeMinutes: number) {
    return this.rpc<Array<{ game_id: number; game_date: string }>>('ingest_games_awaiting_final', {
      p_now: now.toISOString(),
      p_min_age_minutes: minAgeMinutes,
    });
  }

  dueGames(now: Date, boxProvider: ProviderSlug, limit: number) {
    return this.rpc<DueGame[]>('ingest_due_games', { p_now: now.toISOString(), p_box_provider_slug: boxProvider, p_limit: limit });
  }

  saveRef(provider: ProviderSlug, entity: 'team' | 'player' | 'game' | 'season', externalId: string, entityId: number) {
    return this.rpc<boolean>('ingest_save_ref', {
      p_provider_slug: provider, p_entity_type: entity, p_external_id: externalId, p_entity_id: entityId,
    });
  }

  ensurePlayers(
    provider: ProviderSlug,
    players: Array<{ externalId: string; firstName: string; lastName: string; searchName: string; position: string | null; teamId: number }>,
  ) {
    return this.rpc<Record<string, number>>('ingest_ensure_players', {
      p_provider_slug: provider,
      p_players: players.map((p) => ({
        external_id: p.externalId, first_name: p.firstName, last_name: p.lastName,
        search_name: p.searchName, position: p.position, team_id: p.teamId,
      })),
    });
  }

  saveBoxScore(gameId: number, status: 'complete' | 'partial', payloadHash: string, lines: ResolvedPlayerLine[], totals: ResolvedTeamTotals[]) {
    return this.rpc<{ changed: boolean; version: number }>('ingest_save_box_score', {
      p_game_id: gameId, p_stats_status: status, p_payload_hash: payloadHash, p_player_lines: lines, p_team_totals: totals,
    });
  }

  markInvalid(gameId: number) {
    return this.rpc<boolean>('ingest_mark_invalid', { p_game_id: gameId });
  }

  setSyncState(gameId: number, s: SyncStatePatch) {
    return this.rpc<boolean>('ingest_set_sync_state', {
      p_game_id: gameId,
      p_attempts: s.attempts,
      p_next_check_at: iso(s.nextCheckAt),
      p_reconcile_stage: s.reconcileStage,
      p_reconcile_at: iso(s.reconcileAt),
      p_reconciled_at: iso(s.reconciledAt),
      p_last_error: s.lastError,
    });
  }

  recomputeSeason(seasonId: number, seasonType: SeasonType, playerIds: number[] | null, teamIds: number[] | null) {
    return this.rpc<boolean>('recompute_season_aggregates', {
      p_season_id: seasonId, p_season_type: seasonType, p_player_ids: playerIds, p_team_ids: teamIds,
    });
  }

  recomputeStandings(seasonId: number) {
    return this.rpc<boolean>('recompute_standings', { p_season_id: seasonId });
  }
}

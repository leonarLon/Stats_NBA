import { createHash, randomUUID } from 'node:crypto';
import { addDays, toSearchName, utcDate } from '../domain/normalize';
import type { GameScore, SeasonType } from '../domain/types';
import { classifyBoxScore, type BoxScoreResult } from '../domain/validation';
import { AppError, isAppError } from '../lib/errors';
import type { Logger } from '../lib/logger';
import type { BoxScoreProvider, DateRange, ProviderGame, ReferenceDataProvider, ScheduleProvider } from '../providers/types';
import type { DueGame, IngestionStore, JobStatus, JobType, ResolvedPlayerLine, ResolvedTeamTotals } from './store';

/**
 * Pipeline de ingestão (ARCHITECTURE.md, seção 5).
 * Calendário/status: ScheduleProvider (balldontlie). Box score: BoxScoreProvider (API-NBA).
 */

export interface PipelineDeps {
  store: IngestionStore;
  schedule: ScheduleProvider & ReferenceDataProvider;
  box: BoxScoreProvider;
  logger: Logger;
  now?: () => Date;
  /** Contadores de requisições externas, preenchidos pelos clientes HTTP. */
  metrics?: { requests: Record<string, number> };
}

/** Atrasos das reconciliações de jogos parciais, contados a partir do fim do jogo. */
export const RECONCILE_DELAYS_HOURS = [24, 72, 168] as const;
/** Espera entre tentativas após falha de rede/fonte. */
export const RETRY_BACKOFF_MINUTES = [15, 30, 60, 120, 360] as const;
/** Desiste de buscar o box score se a fonte falhar por mais que isso após o fim do jogo. */
export const GIVE_UP_AFTER_HOURS = 72;
/** Jogo é considerado "provavelmente encerrado" após este tempo do início. */
export const AWAITING_FINAL_MIN_AGE_MINUTES = 135;

const HOUR = 3_600_000;
const MINUTE = 60_000;

const nowOf = (deps: PipelineDeps) => (deps.now ? deps.now() : new Date());

// ---------------------------------------------------------------------------
// Times e calendário
// ---------------------------------------------------------------------------

export async function syncTeams(deps: PipelineDeps): Promise<number> {
  const teams = await deps.schedule.listTeams();
  return deps.store.upsertTeams(deps.schedule.slug, teams);
}

async function upsertGamesWithTeamRetry(deps: PipelineDeps, games: ProviderGame[]) {
  try {
    return await deps.store.upsertGames(deps.schedule.slug, games, nowOf(deps));
  } catch (error) {
    // Time desconhecido: carrega os times uma vez e tenta de novo
    if (error instanceof Error && /unknown team/i.test(error.message)) {
      await syncTeams(deps);
      return deps.store.upsertGames(deps.schedule.slug, games, nowOf(deps));
    }
    throw error;
  }
}

export interface ScheduleResult {
  games: number;
  newlyFinal: number;
  seasons: number[];
}

/** Sincroniza calendário, status e placares no intervalo (datas locais dos EUA). */
export async function syncSchedule(deps: PipelineDeps, range: DateRange): Promise<ScheduleResult> {
  const games = await deps.schedule.listGames(range);
  if (games.length === 0) return { games: 0, newlyFinal: 0, seasons: [] };

  let newlyFinal = 0;
  for (let i = 0; i < games.length; i += 200) {
    const saved = await upsertGamesWithTeamRetry(deps, games.slice(i, i + 200));
    newlyFinal += saved.filter((g) => g.became_final).length;
  }

  // A classificação depende só de placares: recalcula quando algum jogo terminou
  const years = [...new Set(games.filter((g) => g.status === 'final').map((g) => g.seasonStartYear))];
  const seasons: number[] = [];
  if (newlyFinal > 0) {
    for (const year of years) {
      const seasonId = await deps.store.ensureSeason(year);
      await deps.store.recomputeStandings(seasonId);
      seasons.push(seasonId);
    }
  }
  return { games: games.length, newlyFinal, seasons };
}

/** Consulta o status só dos jogos que já deveriam ter terminado. Sem candidatos, não chama a API. */
export async function pollAwaitingGames(deps: PipelineDeps): Promise<ScheduleResult> {
  const pending = await deps.store.gamesAwaitingFinal(nowOf(deps), AWAITING_FINAL_MIN_AGE_MINUTES);
  if (pending.length === 0) return { games: 0, newlyFinal: 0, seasons: [] };
  const dates = pending.map((g) => g.game_date).sort();
  return syncSchedule(deps, { from: dates[0], to: dates[dates.length - 1] });
}

// ---------------------------------------------------------------------------
// Box score
// ---------------------------------------------------------------------------

/** Hash estável do box score normalizado: mesmo conteúdo, mesmo hash. */
export function hashBoxScore(lines: ResolvedPlayerLine[], totals: ResolvedTeamTotals[]): string {
  const sortedLines = [...lines].sort((a, b) => a.player_id - b.player_id);
  const sortedTotals = [...totals].sort((a, b) => a.team_id - b.team_id);
  return createHash('sha256').update(JSON.stringify({ l: sortedLines, t: sortedTotals })).digest('hex');
}

/** Próximo estado de sincronização depois de processar um jogo com sucesso. */
export function nextSyncStateAfterIngest(game: Pick<DueGame, 'reconcile_stage' | 'finalized_at'>, status: BoxScoreResult['status'], now: Date) {
  if (status === 'complete' || game.reconcile_stage >= RECONCILE_DELAYS_HOURS.length) {
    return { attempts: 0, nextCheckAt: null, reconcileStage: game.reconcile_stage, reconcileAt: null, reconciledAt: now, lastError: null };
  }
  // Parcial ou inválido: agenda a próxima reconciliação (24h → 72h → 7 dias após o fim do jogo)
  const base = game.finalized_at ? new Date(game.finalized_at) : now;
  const stage = game.reconcile_stage + 1;
  const at = new Date(base.getTime() + RECONCILE_DELAYS_HOURS[stage - 1] * HOUR);
  return {
    attempts: 0,
    nextCheckAt: null,
    reconcileStage: stage,
    reconcileAt: at > now ? at : new Date(now.getTime() + RECONCILE_DELAYS_HOURS[0] * HOUR),
    reconciledAt: null,
    lastError: status === 'invalid' ? 'box score inválido na fonte' : null,
  };
}

/** Próximo estado depois de uma falha (rede, fonte fora do ar, jogo não encontrado). */
export function nextSyncStateAfterFailure(game: Pick<DueGame, 'attempts' | 'reconcile_stage' | 'finalized_at'>, error: string, now: Date) {
  const attempts = game.attempts + 1;
  const finalizedAt = game.finalized_at ? new Date(game.finalized_at) : now;
  if (now.getTime() - finalizedAt.getTime() > GIVE_UP_AFTER_HOURS * HOUR) {
    return { attempts, nextCheckAt: null, reconcileStage: game.reconcile_stage, reconcileAt: null, reconciledAt: now, lastError: `desistiu: ${error}` };
  }
  const wait = RETRY_BACKOFF_MINUTES[Math.min(attempts - 1, RETRY_BACKOFF_MINUTES.length - 1)];
  return {
    attempts,
    nextCheckAt: new Date(now.getTime() + wait * MINUTE),
    reconcileStage: game.reconcile_stage,
    reconcileAt: null,
    reconciledAt: null,
    lastError: error,
  };
}

async function resolveBoxRef(deps: PipelineDeps, game: DueGame, cache: Map<string, ProviderGame[]>): Promise<string> {
  if (game.box_ref) return game.box_ref;
  const date = utcDate(game.starts_at ?? `${game.game_date}T00:00:00Z`);
  let candidates = cache.get(date);
  if (!candidates) {
    candidates = await deps.box.findGamesByUtcDate(date);
    cache.set(date, candidates);
  }
  const match = candidates.find((c) => c.homeTeamExternalId === game.home && c.awayTeamExternalId === game.away);
  if (!match) {
    throw new AppError('NOT_FOUND', `game ${game.away} @ ${game.home} not found in ${deps.box.slug} on ${date}`, { retryable: true });
  }
  await deps.store.saveRef(deps.box.slug, 'game', match.externalId, game.game_id);
  return match.externalId;
}

export interface IngestOutcome {
  gameId: number;
  status: BoxScoreResult['status'];
  changed: boolean;
  issues: string[];
}

/** Busca, classifica e grava o box score de um jogo. Não agenda nada (ver ingestDueGames). */
export async function ingestGame(deps: PipelineDeps, game: DueGame, cache: Map<string, ProviderGame[]>): Promise<IngestOutcome & { playerIds: number[] }> {
  const boxRef = await resolveBoxRef(deps, game, cache);
  const lines = await deps.box.getPlayerGameStats(boxRef);
  const totals = await deps.box.getTeamGameStats(boxRef);

  const teamIds: Record<string, number> = { [game.home]: game.home_team_id, [game.away]: game.away_team_id };
  const score: GameScore = {
    homeTeamExternalId: game.home,
    awayTeamExternalId: game.away,
    homeScore: game.home_score,
    awayScore: game.away_score,
    overtimePeriods: game.overtime_periods,
  };

  const result = classifyBoxScore(score, lines);

  // Totais de time precisam bater com o placar; se não, a fonte está contraditória
  for (const [abbr, expected] of [[game.home, game.home_score], [game.away, game.away_score]] as const) {
    const t = totals.find((x) => x.teamExternalId === abbr);
    if (!t) result.errors.push({ rule: 'team_totals_missing', message: `totais do time ${abbr} ausentes`, teamExternalId: abbr });
    else if (t.pts !== expected) result.errors.push({ rule: 'team_totals_score', message: `totais do time ${abbr} (${t.pts}) diferem do placar (${expected})`, teamExternalId: abbr });
  }
  const status: BoxScoreResult['status'] = result.errors.length > 0 ? 'invalid' : result.status;
  const issues = [...result.errors, ...result.gaps].map((i) => `${i.rule}: ${i.message}`);

  if (status === 'invalid') {
    await deps.store.markInvalid(game.game_id);
    return { gameId: game.game_id, status, changed: false, issues, playerIds: [] };
  }

  const playerMap = await deps.store.ensurePlayers(
    deps.box.slug,
    lines.map((l) => ({
      externalId: l.playerExternalId,
      firstName: l.firstName,
      lastName: l.lastName,
      searchName: toSearchName(l.firstName, l.lastName),
      position: l.position,
      teamId: teamIds[l.teamExternalId],
    })),
  );

  const resolvedLines: ResolvedPlayerLine[] = lines.map((l) => ({
    player_id: playerMap[l.playerExternalId],
    team_id: teamIds[l.teamExternalId],
    is_starter: l.isStarter,
    did_not_play: l.didNotPlay,
    seconds_played: l.secondsPlayed,
    pts: l.pts, fgm: l.fgm, fga: l.fga, fg3m: l.fg3m, fg3a: l.fg3a, ftm: l.ftm, fta: l.fta,
    oreb: l.oreb, dreb: l.dreb, reb: l.reb, ast: l.ast, stl: l.stl, blk: l.blk, tov: l.tov, pf: l.pf,
    plus_minus: l.plusMinus,
  }));
  const resolvedTotals: ResolvedTeamTotals[] = totals.map((t) => ({
    team_id: teamIds[t.teamExternalId],
    pts: t.pts, fgm: t.fgm, fga: t.fga, fg3m: t.fg3m, fg3a: t.fg3a, ftm: t.ftm, fta: t.fta,
    oreb: t.oreb, dreb: t.dreb, reb: t.reb, ast: t.ast, stl: t.stl, blk: t.blk, tov: t.tov, pf: t.pf,
  }));

  const saved = await deps.store.saveBoxScore(game.game_id, status, hashBoxScore(resolvedLines, resolvedTotals), resolvedLines, resolvedTotals);
  return { gameId: game.game_id, status, changed: saved.changed, issues, playerIds: resolvedLines.map((l) => l.player_id) };
}

export interface IngestDueResult {
  due: number;
  processed: number;
  failed: number;
  changed: number;
  byStatus: Record<BoxScoreResult['status'], number>;
  stoppedForQuota: boolean;
}

/** Processa os jogos encerrados pendentes, respeitando a cota. Recalcula os agregados afetados no fim. */
export async function ingestDueGames(deps: PipelineDeps, jobId: string | null, maxGames = 20): Promise<IngestDueResult> {
  const due = await deps.store.dueGames(nowOf(deps), deps.box.slug, maxGames);
  const cache = new Map<string, ProviderGame[]>();
  const affected = new Map<string, { seasonId: number; seasonType: SeasonType; players: Set<number>; teams: Set<number> }>();
  const result: IngestDueResult = { due: due.length, processed: 0, failed: 0, changed: 0, byStatus: { complete: 0, partial: 0, invalid: 0 }, stoppedForQuota: false };

  for (const game of due) {
    try {
      const outcome = await ingestGame(deps, game, cache);
      result.processed++;
      result.byStatus[outcome.status]++;
      await deps.store.setSyncState(game.game_id, nextSyncStateAfterIngest(game, outcome.status, nowOf(deps)));

      if (outcome.status !== 'complete') {
        await deps.store.log(jobId, outcome.status === 'invalid' ? 'warn' : 'info', `box score ${outcome.status}`, {
          game_id: game.game_id, matchup: `${game.away} @ ${game.home}`, issues: outcome.issues.slice(0, 10),
        });
      }
      if (outcome.changed) {
        result.changed++;
        const key = `${game.season_id}:${game.season_type}`;
        const entry = affected.get(key) ?? { seasonId: game.season_id, seasonType: game.season_type, players: new Set(), teams: new Set() };
        outcome.playerIds.forEach((id) => entry.players.add(id));
        entry.teams.add(game.home_team_id).add(game.away_team_id);
        affected.set(key, entry);
      }
    } catch (error) {
      if (isAppError(error) && error.code === 'QUOTA_EXHAUSTED') {
        result.stoppedForQuota = true;
        await deps.store.log(jobId, 'warn', 'cota diária esgotada; restante fica para o próximo ciclo', { game_id: game.game_id });
        break;
      }
      result.failed++;
      const message = error instanceof Error ? error.message : String(error);
      await deps.store.setSyncState(game.game_id, nextSyncStateAfterFailure(game, message, nowOf(deps)));
      await deps.store.log(jobId, 'error', 'falha ao processar jogo', { game_id: game.game_id, matchup: `${game.away} @ ${game.home}`, error: message });
      deps.logger.error('ingest game failed', { gameId: game.game_id, error: message });
    }
  }

  // Agregados só dos jogadores e times afetados; classificação depende só dos placares
  for (const entry of affected.values()) {
    await deps.store.recomputeSeason(entry.seasonId, entry.seasonType, [...entry.players], [...entry.teams]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Jobs (com trava e registro em sync_jobs)
// ---------------------------------------------------------------------------

async function runJob<T extends { failed?: number; stoppedForQuota?: boolean }>(
  deps: PipelineDeps,
  type: JobType,
  trigger: 'cron' | 'manual',
  params: Record<string, unknown>,
  body: (jobId: string) => Promise<T & { processed?: number; expected?: number }>,
): Promise<{ status: JobStatus; result?: T }> {
  const holder = randomUUID();
  if (!(await deps.store.acquireLock('ingestion', holder, 15 * 60))) {
    deps.logger.warn('another ingestion job is running; skipping', { type });
    return { status: 'skipped' };
  }
  const jobId = await deps.store.startJob(type, trigger, params);
  const requestsBefore = totalRequests(deps);
  try {
    const result = await body(jobId);
    const status: JobStatus = (result.failed ?? 0) > 0 || result.stoppedForQuota ? 'partial' : 'succeeded';
    await deps.store.finishJob(jobId, {
      status,
      expected: result.expected ?? null,
      processed: result.processed ?? 0,
      failed: result.failed ?? 0,
      providerRequests: totalRequests(deps) - requestsBefore,
    });
    deps.logger.info('job finished', { type, status, ...result });
    return { status, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.store.finishJob(jobId, {
      status: 'failed', processed: 0, failed: 0, providerRequests: totalRequests(deps) - requestsBefore, error: { message },
    });
    deps.logger.error('job failed', { type, error: message });
    throw error;
  } finally {
    await deps.store.releaseLock('ingestion', holder);
  }
}

function totalRequests(deps: PipelineDeps): number {
  return Object.values(deps.metrics?.requests ?? {}).reduce((a, b) => a + b, 0);
}

/** Diário: times + calendário de ontem até 7 dias à frente. */
export function runScheduleJob(deps: PipelineDeps, trigger: 'cron' | 'manual' = 'cron') {
  const today = utcDate(nowOf(deps));
  const range = { from: addDays(today, -1), to: addDays(today, 7) };
  return runJob(deps, 'schedule', trigger, range, async () => {
    const teams = await syncTeams(deps);
    const schedule = await syncSchedule(deps, range);
    return { ...schedule, teams, processed: schedule.games };
  });
}

/** A cada 15 min na janela de jogos: status dos jogos em andamento + box scores pendentes. */
export function runTickJob(deps: PipelineDeps, trigger: 'cron' | 'manual' = 'cron') {
  return runJob(deps, 'ingest_game', trigger, {}, async (jobId) => {
    const poll = await pollAwaitingGames(deps);
    const ingest = await ingestDueGames(deps, jobId);
    return { ...ingest, polled: poll.games, newlyFinal: poll.newlyFinal, expected: ingest.due };
  });
}

/**
 * Carga histórica: calendário do intervalo e box scores, até a cota acabar.
 * Pode ser executado várias vezes: continua de onde parou.
 */
export function runBackfillJob(deps: PipelineDeps, range: DateRange, maxGames = 40, trigger: 'cron' | 'manual' = 'manual') {
  return runJob(deps, 'backfill', trigger, { ...range, maxGames }, async (jobId) => {
    let schedule = 0;
    for (let from = range.from; from <= range.to; from = addDays(from, 7)) {
      const to = addDays(from, 6) < range.to ? addDays(from, 6) : range.to;
      schedule += (await syncSchedule(deps, { from, to })).games;
    }
    const ingest = await ingestDueGames(deps, jobId, maxGames);
    return { ...ingest, scheduleGames: schedule, expected: ingest.due };
  });
}

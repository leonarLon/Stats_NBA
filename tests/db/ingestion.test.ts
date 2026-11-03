import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  RECONCILE_DELAYS_HOURS,
  runBackfillJob,
  runScheduleJob,
  runTickJob,
  type PipelineDeps,
} from '@/server/ingestion/pipeline';
import { IngestionStore } from '@/server/ingestion/store';
import { AppError } from '@/server/lib/errors';
import { createLogger } from '@/server/lib/logger';
import { FIXTURE_BOX_SCORES, FIXTURE_GAMES } from '@/server/providers/fixture/data';
import { FixtureProvider, sumTeamTotals } from '@/server/providers/fixture/fixture-provider';
import type { ProviderGame, ProviderPlayerLine } from '@/server/providers/types';
import { createTestDb, pgliteRpc } from '../support/pglite';

/**
 * Pipeline completo contra as funções SQL reais (PGlite), com provedor de fixtures.
 * Cobre: atualização após jogo, idempotência, correção, parcial, inválido, cota, falha, trava.
 */

const silent = createLogger({}, { write: () => {} });
let db: PGlite;
let fixture: FixtureProvider;
/** Mesmos dados, no papel de provedor de box score (como a API-NBA em produção). */
let boxFixture: FixtureProvider;
let clock: Date;
let deps: PipelineDeps;

const q = async <T = Record<string, unknown>>(sql: string) => (await db.query<T>(sql)).rows;
const one = async <T = Record<string, unknown>>(sql: string) => (await q<T>(sql))[0];
const at = (iso: string) => {
  clock = new Date(iso);
};
const hoursLater = (h: number) => {
  clock = new Date(clock.getTime() + h * 3_600_000);
};
/** Força um novo processamento do jogo encerrado, usando o relógio simulado (não o do banco). */
const makeDue = () =>
  db.query(`update game_sync_state set reconciled_at = null, next_check_at = $1`, [new Date(clock.getTime() - 60_000).toISOString()]);

beforeEach(async () => {
  db = await createTestDb();
  fixture = new FixtureProvider({
    games: FIXTURE_GAMES.map((g) => ({ ...g })),
    boxScores: Object.fromEntries(Object.entries(FIXTURE_BOX_SCORES).map(([k, v]) => [k, v.map((l) => ({ ...l }))])),
  });
  boxFixture = new FixtureProvider(fixture.data, 'fixture-box');
  // Mesmo objeto de dados: alterar fixture.data afeta as duas fontes
  boxFixture.data = fixture.data;
  at('2026-10-29T12:00:00Z');
  deps = { store: new IngestionStore(pgliteRpc(db)), schedule: fixture, box: boxFixture, logger: silent, now: () => clock };
});

describe('atualização após o jogo', () => {
  it('calendário diário cria times, jogos e classificação', async () => {
    const res = await runScheduleJob(deps);
    expect(res.status).toBe('succeeded');
    expect((await one<{ n: number }>('select count(*)::int as n from teams')).n).toBe(3);
    expect((await one<{ n: number }>('select count(*)::int as n from games')).n).toBe(2);
    expect(await one(`select label, is_current from seasons`)).toEqual({ label: '2026-27', is_current: true });

    const standings = await q<{ abbreviation: string; wins: number; losses: number; conference_rank: number; streak: number }>(`
      select t.abbreviation, s.wins, s.losses, s.conference_rank, s.streak
      from standings s join teams t on t.id = s.team_id where t.conference = 'East' order by s.conference_rank`);
    expect(standings).toEqual([
      { abbreviation: 'AUR', wins: 1, losses: 0, conference_rank: 1, streak: 1 },
      { abbreviation: 'BRV', wins: 0, losses: 1, conference_rank: 2, streak: -1 },
    ]);

    const job = await one(`select job_type, status, items_processed from sync_jobs`);
    expect(job).toEqual({ job_type: 'schedule', status: 'succeeded', items_processed: 2 });
  });

  it('tick grava o box score, os agregados e encerra a sincronização do jogo', async () => {
    await runScheduleJob(deps);
    const res = await runTickJob(deps);
    expect(res.status).toBe('succeeded');

    expect(await one(`select stats_status, version from games where status = 'final'`)).toEqual({ stats_status: 'complete', version: 1 });
    expect((await one<{ n: number }>('select count(*)::int as n from player_game_stats')).n).toBe(10);
    expect(await q(`select t.abbreviation, s.pts, s.won from team_game_stats s join teams t on t.id = s.team_id order by t.abbreviation`)).toEqual([
      { abbreviation: 'AUR', pts: 105, won: true },
      { abbreviation: 'BRV', pts: 94, won: false },
    ]);

    // Ícaro Lima: 10 FGM, 3 3PM, 6 FTM = 29 pontos
    const icaro = await one(`select a.pts_pg, a.games_played, a.is_complete from player_season_averages a
      join players p on p.id = a.player_id where p.search_name = 'icaro lima'`);
    expect(icaro).toMatchObject({ pts_pg: '29.0', games_played: 1, is_complete: true });

    const team = await one(`select a.wins, a.pts_pg from team_season_averages a join teams t on t.id = a.team_id where t.abbreviation = 'AUR'`);
    expect(team).toEqual({ wins: 1, pts_pg: '105.0' });

    const state = await one<{ reconciled_at: string | null; next_check_at: string | null }>(`select reconciled_at, next_check_at from game_sync_state`);
    expect(state.reconciled_at).not.toBeNull();
    expect(state.next_check_at).toBeNull();

    // Vínculo com o jogo no provedor de box score foi salvo; busca por data só uma vez
    expect(boxFixture.calls.filter((c) => c.startsWith('findGamesByUtcDate'))).toEqual(['findGamesByUtcDate:2026-10-28']);
  });

  it('tick sem jogos pendentes não chama nenhuma API', async () => {
    await runScheduleJob(deps);
    await runTickJob(deps);
    const before = fixture.calls.length + boxFixture.calls.length;
    const res = await runTickJob(deps);
    expect(res.status).toBe('succeeded');
    expect(fixture.calls.length + boxFixture.calls.length).toBe(before);
  });

  it('detecta jogo encerrado na janela de polling e processa no mesmo ciclo', async () => {
    await runScheduleJob(deps);
    await runTickJob(deps);
    // Jogo 2 termina; a fonte passa a ter placar e box score
    const g2 = fixture.data.games.find((g) => g.externalId === 'fx-g2')!;
    Object.assign(g2, { status: 'final', homeScore: 94, awayScore: 105 });
    fixture.data.boxScores['fx-g2'] = FIXTURE_BOX_SCORES['fx-g1'].map((l) => ({
      ...l,
      // Mesmo box score, com AUR→CDR (visitante) e BRV (mandante): placar 94 x 105
      teamExternalId: l.teamExternalId === 'AUR' ? 'CDR' : 'BRV',
      playerExternalId: l.teamExternalId === 'AUR' ? `${l.playerExternalId}-cdr` : l.playerExternalId,
    }));
    at('2026-11-04T03:00:00Z'); // 3h após o início

    const res = await runTickJob(deps);
    expect(res.result).toMatchObject({ newlyFinal: 1, processed: 1, byStatus: { complete: 1 } });
    expect(await one(`select stats_status from games g join teams t on t.id = g.home_team_id where t.abbreviation = 'BRV' and g.game_date = '2026-11-03'`)).toEqual({ stats_status: 'complete' });
    // BRV jogou 2 jogos agora
    expect(await one(`select a.games_played from player_season_averages a join players p on p.id = a.player_id where p.search_name = 'rai teles'`)).toEqual({ games_played: 2 });
  });
});

describe('idempotência e correções', () => {
  it('reprocessar o mesmo box score não muda nada', async () => {
    await runScheduleJob(deps);
    await runTickJob(deps);
    await makeDue();
    await runTickJob(deps);
    expect(await one(`select version from games where status = 'final'`)).toEqual({ version: 1 });
    expect((await one<{ n: number }>('select count(*)::int as n from player_game_stats')).n).toBe(10);
  });

  it('correção na fonte gera nova versão e atualiza os agregados', async () => {
    await runScheduleJob(deps);
    await runTickJob(deps);
    fixture.data.boxScores['fx-g1'][0].ast += 1; // 8 → 9 assistências
    await makeDue();
    await runTickJob(deps);
    expect(await one(`select version from games where status = 'final'`)).toEqual({ version: 2 });
    expect(await one(`select a.ast_pg from player_season_averages a join players p on p.id = a.player_id where p.search_name = 'icaro lima'`)).toEqual({ ast_pg: '9.0' });
  });
});

describe('box score incompleto (parcial)', () => {
  it('grava o que veio, marca parcial, reconcilia e completa depois', async () => {
    const full = FIXTURE_BOX_SCORES['fx-g1'];
    // Fonte omite dois jogadores do AUR; totais do time continuam corretos
    fixture.data.boxScores['fx-g1'] = full.filter((l) => l.playerExternalId !== 'fx-p4' && l.playerExternalId !== 'fx-p5');
    fixture.data.teamTotals = { 'fx-g1': sumTeamTotals(full) };

    await runScheduleJob(deps);
    const tick = await runTickJob(deps);
    expect(tick.status).toBe('succeeded');
    expect(tick.result).toMatchObject({ byStatus: { partial: 1 } });

    expect(await one(`select stats_status from games where status = 'final'`)).toEqual({ stats_status: 'partial' });
    expect((await one<{ n: number }>('select count(*)::int as n from player_game_stats')).n).toBe(8);
    // Totais do time vêm da fonte, não da soma dos jogadores
    expect(await one(`select s.pts from team_game_stats s join teams t on t.id = s.team_id where t.abbreviation = 'AUR'`)).toEqual({ pts: 105 });
    expect(await one(`select a.team_partial_games, a.is_complete from player_season_averages a
      join players p on p.id = a.player_id where p.search_name = 'icaro lima'`)).toEqual({ team_partial_games: 1, is_complete: false });

    const state = await one<{ reconcile_stage: number; reconcile_at: string; reconciled_at: string | null }>(`select reconcile_stage, reconcile_at, reconciled_at from game_sync_state`);
    expect(state.reconcile_stage).toBe(1);
    expect(state.reconciled_at).toBeNull();
    const log = await one(`select level, message from sync_logs where message like 'box score%'`);
    expect(log).toEqual({ level: 'info', message: 'box score partial' });

    // Antes de 24h: nada a fazer
    hoursLater(12);
    const early = await runTickJob(deps);
    expect(early.result).toMatchObject({ due: 0 });

    // Depois de 24h a fonte completou: o jogo vira complete e a reconciliação termina
    fixture.data.boxScores['fx-g1'] = full;
    hoursLater(RECONCILE_DELAYS_HOURS[0]);
    const late = await runTickJob(deps);
    expect(late.result).toMatchObject({ byStatus: { complete: 1 } });
    expect(await one(`select stats_status, version from games where status = 'final'`)).toEqual({ stats_status: 'complete', version: 2 });
    expect((await one<{ n: number }>('select count(*)::int as n from player_game_stats')).n).toBe(10);
    expect(await one(`select a.team_partial_games, a.is_complete from player_season_averages a
      join players p on p.id = a.player_id where p.search_name = 'icaro lima'`)).toEqual({ team_partial_games: 0, is_complete: true });
    expect((await one<{ reconciled_at: string | null }>(`select reconciled_at from game_sync_state`)).reconciled_at).not.toBeNull();
  });
});

describe('box score inválido', () => {
  it('não grava linhas contraditórias e registra alerta', async () => {
    // Pontos dos jogadores acima do placar
    fixture.data.boxScores['fx-g1'] = FIXTURE_BOX_SCORES['fx-g1'].map((l, i) =>
      i === 0 ? ({ ...l, ftm: l.ftm + 4, fta: l.fta + 4, pts: l.pts + 4 } as ProviderPlayerLine) : l,
    );
    fixture.data.teamTotals = { 'fx-g1': sumTeamTotals(FIXTURE_BOX_SCORES['fx-g1']) };
    await runScheduleJob(deps);
    await runTickJob(deps);
    expect(await one(`select stats_status from games where status = 'final'`)).toEqual({ stats_status: 'invalid' });
    expect((await one<{ n: number }>('select count(*)::int as n from player_game_stats')).n).toBe(0);
    expect(await one(`select level, message from sync_logs where message like 'box score%'`)).toEqual({ level: 'warn', message: 'box score invalid' });
  });

  it('não apaga dados bons se uma reconciliação vier contraditória', async () => {
    await runScheduleJob(deps);
    await runTickJob(deps);
    fixture.data.boxScores['fx-g1'] = [...FIXTURE_BOX_SCORES['fx-g1'], FIXTURE_BOX_SCORES['fx-g1'][0]]; // jogador repetido
    await makeDue();
    await runTickJob(deps);
    expect(await one(`select stats_status, version from games where status = 'final'`)).toEqual({ stats_status: 'complete', version: 1 });
    expect((await one<{ n: number }>('select count(*)::int as n from player_game_stats')).n).toBe(10);
  });
});

describe('falhas e limites', () => {
  it('cota esgotada interrompe sem marcar falha; o jogo continua pendente', async () => {
    await runScheduleJob(deps);
    deps.box = Object.assign(Object.create(boxFixture), {
      getPlayerGameStats: async () => {
        throw new AppError('QUOTA_EXHAUSTED', 'daily quota reached');
      },
    });
    const res = await runTickJob(deps);
    expect(res.status).toBe('partial');
    expect(res.result).toMatchObject({ stoppedForQuota: true, failed: 0, processed: 0 });
    expect(await one(`select attempts, reconciled_at from game_sync_state`)).toEqual({ attempts: 0, reconciled_at: null });
    expect(await one(`select status from sync_jobs where job_type = 'ingest_game'`)).toEqual({ status: 'partial' });
  });

  it('falha da fonte agenda nova tentativa com backoff', async () => {
    await runScheduleJob(deps);
    deps.box = Object.assign(Object.create(boxFixture), {
      getPlayerGameStats: async () => {
        throw new AppError('UPSTREAM', 'HTTP 503', { retryable: true });
      },
    });
    const res = await runTickJob(deps);
    expect(res.result).toMatchObject({ failed: 1 });
    const state = await one<{ attempts: number; next_check_at: Date; last_error: string }>(`select attempts, next_check_at, last_error from game_sync_state`);
    expect(state.attempts).toBe(1);
    expect(new Date(state.next_check_at).getTime() - clock.getTime()).toBe(15 * 60_000);
    expect(state.last_error).toContain('503');
    expect(await one(`select level from sync_logs where message = 'falha ao processar jogo'`)).toEqual({ level: 'error' });
  });

  it('jogo que não existe no provedor de box score vira falha com nova tentativa', async () => {
    fixture.data.games = fixture.data.games.map((g): ProviderGame => (g.externalId === 'fx-g1' ? { ...g, startsAt: '2026-10-27T23:30:00Z' } : g));
    await runScheduleJob(deps);
    deps.box = Object.assign(Object.create(boxFixture), { findGamesByUtcDate: async () => [] });
    const res = await runTickJob(deps);
    expect(res.result).toMatchObject({ failed: 1 });
    expect((await one<{ last_error: string }>(`select last_error from game_sync_state`)).last_error).toMatch(/not found/);
  });

  it('não roda dois jobs ao mesmo tempo', async () => {
    await db.query(`select ingest_acquire_lock('ingestion', 'outro-processo', 600)`);
    const res = await runTickJob(deps);
    expect(res.status).toBe('skipped');
    expect((await one<{ n: number }>('select count(*)::int as n from sync_jobs')).n).toBe(0);
  });

  it('trava expirada é liberada', async () => {
    await db.exec(`insert into job_locks (name, holder, locked_until) values ('ingestion', 'travado', now() - interval '1 minute')`);
    expect((await runTickJob(deps)).status).toBe('succeeded');
  });
});

describe('carga histórica', () => {
  it('backfill sincroniza o intervalo e processa os jogos encerrados', async () => {
    const res = await runBackfillJob(deps, { from: '2026-10-21', to: '2026-11-05' });
    expect(res.status).toBe('succeeded');
    expect(res.result).toMatchObject({ processed: 1, byStatus: { complete: 1 } });
    expect(fixture.calls.filter((c) => c.startsWith('listGames'))).toEqual([
      'listGames:2026-10-21:2026-10-27',
      'listGames:2026-10-28:2026-11-03',
      'listGames:2026-11-04:2026-11-05',
    ]);
  });

  it('com a fila cheia, processa primeiro os jogos mais recentes', async () => {
    // Um jogo mais antigo, também encerrado, com o mesmo box score fictício
    fixture.data.games.push({ ...FIXTURE_GAMES[0], externalId: 'fx-g0', gameDate: '2026-10-21', startsAt: '2026-10-21T23:30:00Z' });
    fixture.data.boxScores['fx-g0'] = FIXTURE_BOX_SCORES['fx-g1'].map((l) => ({ ...l }));

    const res = await runBackfillJob(deps, { from: '2026-10-21', to: '2026-10-28' }, 1);
    expect(res.result).toMatchObject({ due: 1, processed: 1 });
    expect(await q(`select game_date::text, stats_status from games where status = 'final' order by game_date`)).toEqual([
      { game_date: '2026-10-21', stats_status: 'pending' },
      { game_date: '2026-10-28', stats_status: 'complete' },
    ]);

    // Na execução seguinte, o mais antigo
    await runBackfillJob(deps, { from: '2026-10-21', to: '2026-10-28' }, 1);
    expect((await one<{ n: number }>(`select count(*)::int as n from games where stats_status = 'complete'`)).n).toBe(2);
  });
});

describe('permissões', () => {
  it('usuários comuns não executam as funções de ingestão', async () => {
    for (const fn of [
      `ingest_save_box_score(1, 'complete', 'x', '[]', '[]')`,
      `ingest_upsert_games('fixture', '[]')`,
      `recompute_standings(1::smallint)`,
      `ingest_consume_quota('api-nba', 100)`,
    ]) {
      await db.exec('set role authenticated');
      await expect(db.query(`select public.${fn}`), fn).rejects.toThrow(/permission denied/);
      await db.exec('reset role');
    }
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subscriptionGrantsAccess, type SubscriptionStatus } from '@/server/auth/access';

/**
 * Executa as migrations num Postgres em memória (PGlite) com stubs mínimos do Supabase
 * (roles, schema auth, auth.uid(), search_path) e verifica RLS, regras de acesso e restrições.
 * Não substitui um teste no Supabase real, mas pega erros de SQL e de política antes do deploy.
 */

const MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);
const U1 = '00000000-0000-0000-0000-000000000001';
const U2 = '00000000-0000-0000-0000-000000000002';

let db: PGlite;

async function asRole<T>(role: 'anon' | 'authenticated', uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

const rows = async (role: 'anon' | 'authenticated', uid: string | null, sql: string) =>
  asRole(role, uid, async () => (await db.query(sql)).rows);

const fails = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
};

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema extensions;
    create schema auth;
    set search_path = "$user", public, extensions;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, extensions, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }

  await db.exec(`
    insert into auth.users (id, email) values ('${U1}', 'a@x.com'), ('${U2}', 'b@x.com');
    insert into public.seasons (start_year, label, is_current) values (2026, '2026-27', true);
    insert into public.teams (abbreviation, city, nickname, full_name, conference) values
      ('AUR', 'Aurora', 'Cometas', 'Aurora Cometas', 'East'), ('BRV', 'Brava', 'Marés', 'Brava Marés', 'East');
    insert into public.players (first_name, last_name, display_name, search_name) values ('Ícaro', 'Lima', 'Ícaro Lima', 'icaro lima');
    insert into public.games (season_id, season_type, game_date, status, home_team_id, away_team_id, home_score, away_score)
      values (1, 'regular', '2026-10-28', 'final', 1, 2, 105, 94);
    insert into public.player_season_stats (player_id, season_id, season_type, games_played, pts, fgm, fga, fg3m, fg3a, ftm, fta, reb, ast)
      values (1, 1, 'regular', 2, 50, 18, 36, 4, 10, 10, 12, 14, 9);
    insert into public.data_providers (slug, name) values ('api-nba', 'API-NBA');
  `);
});

afterAll(async () => {
  await db?.close();
});

describe('cadastro e perfil', () => {
  it('cria perfil automaticamente no cadastro', async () => {
    expect((await db.query<{ n: number }>('select count(*)::int as n from public.profiles')).rows[0].n).toBe(2);
  });

  it('usuário edita só os próprios campos permitidos', async () => {
    expect(await rows('authenticated', U1, `update public.profiles set display_name = 'Leo' where id = '${U1}' returning id`)).toHaveLength(1);
    expect(await fails(() => rows('authenticated', U1, `update public.profiles set trial_started_at = null where id = '${U1}'`))).toBe(true);
    expect(await rows('authenticated', U2, `select * from public.profiles where id = '${U1}'`)).toHaveLength(0);
  });
});

describe('acesso aos dados esportivos', () => {
  it('anon e usuário sem acesso não leem nada; planos são públicos', async () => {
    expect(await rows('anon', null, 'select * from public.teams')).toHaveLength(0);
    expect(await rows('authenticated', U1, 'select * from public.teams')).toHaveLength(0);
    expect(await rows('anon', null, 'select * from public.plans')).toHaveLength(1);
  });

  it('teste grátis: só o servidor inicia, uma vez por conta, libera só o próprio usuário', async () => {
    expect(await fails(() => rows('authenticated', U1, `select public.start_trial('${U1}')`))).toBe(true);
    await db.query(`select public.start_trial('${U1}')`);
    expect(await rows('authenticated', U1, 'select * from public.teams')).toHaveLength(2);
    expect(await rows('authenticated', U2, 'select * from public.teams')).toHaveLength(0);
    await expect(db.query(`select public.start_trial('${U1}')`)).rejects.toThrow(/trial_already_used/);
  });

  it('usuário não cria nem altera assinatura', async () => {
    expect(
      await fails(() => rows('authenticated', U2, `insert into public.subscriptions (user_id, status, trial_ends_at) values ('${U2}', 'trialing', now() + interval '9 days')`)),
    ).toBe(true);
  });

  it('views de médias respeitam RLS e calculam corretamente', async () => {
    const [avg] = await rows('authenticated', U1, 'select pts_pg, fg_pct, ts_pct from public.player_season_averages');
    expect(avg).toMatchObject({ pts_pg: '25.0', fg_pct: '0.500', ts_pct: '0.606' });
    expect(await rows('authenticated', U2, 'select * from public.player_season_averages')).toHaveLength(0);
  });

  it('busca aproximada de jogadores por trigramas', async () => {
    expect(await rows('authenticated', U1, `select id from public.players where search_name % 'icaro lim'`)).toHaveLength(1);
  });

  it('tabelas internas são inacessíveis', async () => {
    for (const table of ['sync_logs', 'sync_jobs', 'payment_events', 'external_refs', 'audit_logs', 'provider_quota_usage']) {
      expect(await rows('authenticated', U1, `select * from public.${table}`), table).toHaveLength(0);
    }
  });
});

describe('jogos parciais', () => {
  it('aceita stats_status partial e expõe team_partial_games na view', async () => {
    await db.exec(`update public.games set stats_status = 'partial' where id = 1`);
    await db.exec(`update public.player_season_stats set team_partial_games = 1 where player_id = 1`);
    const [row] = await rows('authenticated', U1, 'select team_partial_games, is_complete from public.player_season_averages');
    expect(row).toMatchObject({ team_partial_games: 1, is_complete: false });
  });

  it('etapa de reconciliação limitada a 0..3', async () => {
    await db.exec(`insert into public.game_sync_state (game_id, reconcile_stage) values (1, 3)`);
    await expect(db.exec(`update public.game_sync_state set reconcile_stage = 4 where game_id = 1`)).rejects.toThrow();
  });
});

describe('restrições estatísticas', () => {
  it('rejeita FGM > FGA', async () => {
    await expect(
      db.exec(`insert into public.player_game_stats (game_id, player_id, team_id, season_id, season_type, game_date, fgm, fga) values (1, 1, 1, 1, 'regular', '2026-10-28', 8, 5)`),
    ).rejects.toThrow();
  });
});

describe('cota diária do provedor', () => {
  it('para exatamente no limite', async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      results.push((await db.query<{ ok: boolean }>('select public.try_consume_provider_quota(1::smallint, 3) as ok')).rows[0].ok);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});

describe('regra de acesso SQL = regra de acesso TypeScript', () => {
  const cases: Array<[SubscriptionStatus, number | null, number | null]> = [
    ['trialing', 1, null], ['trialing', -1, null],
    ['active', null, 10], ['active', null, -1],
    ['past_due', null, 2], ['past_due', null, -2],
    ['canceled', null, 5], ['canceled', null, -5],
    ['pending', null, 30], ['incomplete', null, 30], ['expired', null, 30],
  ];

  it.each(cases)('%s (teste %s d, período %s d)', async (status, trialDays, periodDays) => {
    await db.exec(`delete from public.subscriptions where user_id = '${U2}'`);
    const trial = trialDays === null ? 'null' : `now() + interval '${trialDays} days'`;
    const period = periodDays === null ? 'null' : `now() + interval '${periodDays} days'`;
    await db.exec(`insert into public.subscriptions (user_id, status, trial_ends_at, current_period_end) values ('${U2}', '${status}', ${trial}, ${period})`);

    const sql = (await db.query<{ ok: boolean }>(`select public.user_has_access('${U2}') as ok`)).rows[0].ok;
    const now = new Date();
    const ts = subscriptionGrantsAccess(
      {
        status,
        trialEndsAt: trialDays === null ? null : new Date(now.getTime() + trialDays * 86_400_000),
        currentPeriodEnd: periodDays === null ? null : new Date(now.getTime() + periodDays * 86_400_000),
      },
      now,
    );
    expect(sql).toBe(ts);
  });

  it('teste grátis e assinatura paga coexistem; duas pagas vigentes não', async () => {
    await db.exec(`delete from public.subscriptions where user_id = '${U2}'`);
    await db.exec(`insert into public.subscriptions (user_id, status, trial_ends_at) values ('${U2}', 'trialing', now() + interval '1 day')`);
    await db.exec(`insert into public.subscriptions (user_id, plan_id, status, provider, provider_subscription_id, current_period_end) values ('${U2}', 'monthly', 'active', 'mercadopago', 'mp-1', now() + interval '1 month')`);
    await expect(
      db.exec(`insert into public.subscriptions (user_id, plan_id, status, provider, provider_subscription_id, current_period_end) values ('${U2}', 'monthly', 'past_due', 'mercadopago', 'mp-2', now() + interval '1 month')`),
    ).rejects.toThrow();
  });
});

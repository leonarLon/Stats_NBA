import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import type { Rpc } from '@/server/ingestion/rpc';

const MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);

/**
 * Postgres em memória com stubs mínimos do Supabase (roles, schema auth, auth.uid(), search_path)
 * e todas as migrations do projeto aplicadas em ordem.
 */
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pg_trgm } });
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
  return db;
}

function serialize(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  // Listas de números viram arrays do Postgres (bigint[]); o resto, JSON (jsonb)
  if (Array.isArray(value) && value.every((v) => typeof v === 'number')) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

/** Mesma interface do supabase.rpc(), executando as funções SQL no PGlite. */
export function pgliteRpc(db: PGlite): Rpc {
  return async <T>(fn: string, args: Record<string, unknown>) => {
    const names = Object.keys(args);
    const sql = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as result`;
    const { rows } = await db.query<{ result: T }>(sql, names.map((n) => serialize(args[n])));
    return rows[0].result;
  };
}

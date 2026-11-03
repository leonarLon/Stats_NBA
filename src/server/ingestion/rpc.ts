import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../lib/errors';

/**
 * Chamada de função SQL (supabase/migrations/..._ingestion.sql).
 * Produção: supabase.rpc(). Testes: as mesmas funções num Postgres em memória (PGlite).
 */
export type Rpc = <T = unknown>(fn: string, args: Record<string, unknown>) => Promise<T>;

export function supabaseRpc(client: SupabaseClient): Rpc {
  return async <T>(fn: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(fn, args);
    if (error) {
      throw new AppError('INTERNAL', `RPC ${fn} failed: ${error.message}`, {
        details: { code: error.code, hint: error.hint },
        // Falhas de rede/timeout do PostgREST podem ser tentadas de novo
        retryable: !error.code || error.code.startsWith('PGRST0'),
      });
    }
    return data as T;
  };
}

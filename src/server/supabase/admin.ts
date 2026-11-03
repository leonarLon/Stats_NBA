import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminConfig, getSupabasePublicConfig } from '../lib/config';

let client: SupabaseClient | undefined;

/**
 * Cliente com a service role: ignora o RLS. Uso exclusivo do servidor e do worker de ingestão.
 * Não importa 'server-only' porque o worker roda em Node fora do Next.js.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseAdmin must never run in the browser');
  }
  if (!client) {
    const { NEXT_PUBLIC_SUPABASE_URL } = getSupabasePublicConfig();
    const { SUPABASE_SECRET_KEY } = getSupabaseAdminConfig();
    client = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

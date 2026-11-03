import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabasePublicConfig } from '../lib/config';

/**
 * Cliente do Supabase com a sessão do usuário (cookies), sujeito ao RLS.
 * Lê cookies, então quem usa precisa estar dentro de <Suspense> (Cache Components).
 */
export async function createSupabaseServerClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = getSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components não podem gravar cookies; o proxy.ts renova a sessão.
        }
      },
    },
  });
}

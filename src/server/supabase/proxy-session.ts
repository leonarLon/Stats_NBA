import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabasePublicConfig } from '../lib/config';

/**
 * Renova o token de sessão do Supabase a cada requisição e devolve os cookies atualizados.
 * Não decide acesso: isso é feito no servidor, perto dos dados (server/auth/session.ts).
 * Padrão da documentação do @supabase/ssr para Next.js.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = getSupabasePublicConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Resposta com cookie de sessão nunca pode ficar em cache de CDN
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Precisa rodar antes de qualquer resposta: é o que dispara a renovação do token
  await supabase.auth.getClaims();
  return response;
}

import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from '@/server/auth/validation';
import { isSupabaseConfigured } from '@/server/lib/config';
import { logger } from '@/server/lib/logger';
import { createSupabaseServerClient } from '@/server/supabase/server';

const OTP_TYPES: EmailOtpType[] = ['signup', 'email', 'recovery', 'invite', 'email_change', 'magiclink'];

/**
 * Destino dos links enviados por e-mail (confirmação de cadastro e nova senha).
 * Aceita os dois formatos do Supabase:
 * - ?code=...                     (modelo de e-mail padrão; exige abrir no mesmo navegador do cadastro)
 * - ?token_hash=...&type=...      (modelo de e-mail ajustado; funciona em qualquer navegador)
 * Em caso de sucesso, a sessão fica gravada em cookie e a pessoa segue para ?proximo=.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get('proximo'), '/planos');
  const fail = NextResponse.redirect(new URL('/entrar?erro=link', url.origin));
  if (!isSupabaseConfigured()) return fail;

  const supabase = await createSupabaseServerClient();
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  let error: { code?: string } | null = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    return fail;
  }

  if (error) {
    logger.warn('email link rejected', { component: 'auth', code: error.code });
    return fail;
  }
  return NextResponse.redirect(new URL(next, url.origin));
}

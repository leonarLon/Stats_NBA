import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from './server/lib/config';
import { updateSession } from './server/supabase/proxy-session';

/** Só renova a sessão. Sem Supabase configurado (modo demonstração), não faz nada. */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  // Tudo, menos arquivos estáticos e imagens
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};

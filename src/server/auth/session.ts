import 'server-only';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';
import { AppError } from '../lib/errors';
import { isSupabaseConfigured } from '../lib/config';
import { getSupabaseAdmin } from '../supabase/admin';
import { createSupabaseServerClient } from '../supabase/server';
import { accessEndsAt, hasAccess, type SubscriptionAccessFields, type SubscriptionStatus } from './access';

export interface CurrentUser {
  id: string;
  email: string | null;
}

/** Sem Supabase configurado (modo demonstração), não há login. */
export function isAuthEnabled(): boolean {
  return isSupabaseConfigured();
}

/**
 * Usuário da sessão. getClaims() valida a assinatura do token (localmente, com as chaves
 * públicas do projeto, ou no servidor do Auth); nunca confia só no cookie.
 * Uma leitura por requisição, mesmo chamada por vários componentes.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isAuthEnabled()) return null;
  // A validação compara a validade do token com a hora atual: só pode rodar na requisição,
  // nunca na pré-renderização (senão o Next acusa "unstable value Date.now()")
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: typeof data.claims.email === 'string' ? data.claims.email : null };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar');
  return user;
}

export interface AccountStatus {
  hasAccess: boolean;
  /** Fim do acesso atual (teste ou período pago), se houver. */
  accessEndsAt: Date | null;
  trialUsed: boolean;
  trialEndsAt: Date | null;
}

export const getAccountStatus = cache(async (userId: string, now = new Date()): Promise<AccountStatus> => {
  const admin = getSupabaseAdmin();
  const [subs, profile] = await Promise.all([
    admin.from('subscriptions').select('status, trial_ends_at, current_period_end').eq('user_id', userId),
    admin.from('profiles').select('trial_started_at').eq('id', userId).maybeSingle(),
  ]);
  if (subs.error) throw new AppError('INTERNAL', 'Failed to read subscriptions', { cause: subs.error });
  if (profile.error) throw new AppError('INTERNAL', 'Failed to read profile', { cause: profile.error });

  const rows: SubscriptionAccessFields[] = (subs.data ?? []).map((row) => ({
    status: row.status as SubscriptionStatus,
    trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at) : null,
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
  }));
  const trial = rows.find((r) => r.status === 'trialing' || r.trialEndsAt !== null);
  return {
    hasAccess: hasAccess(rows, now),
    accessEndsAt: accessEndsAt(rows, now),
    trialUsed: Boolean(profile.data?.trial_started_at),
    trialEndsAt: trial?.trialEndsAt ?? null,
  };
});

/** Porta única para conteúdo restrito: exige sessão e acesso ativo (teste ou assinatura). */
export async function requireAccess(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!(await getAccountStatus(user.id)).hasAccess) redirect('/planos');
  return user;
}

import 'server-only';
import { redirect } from 'next/navigation';
import { AppError } from '../lib/errors';
import { getSupabaseAdmin } from '../supabase/admin';
import { createSupabaseServerClient } from '../supabase/server';
import { hasAccess, type SubscriptionStatus } from './access';

export interface CurrentUser {
  id: string;
  email: string | null;
}

/** Usuário da sessão, validado no servidor do Auth (getUser), nunca só pelo cookie. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar');
  return user;
}

export async function userHasAccess(userId: string, now = new Date()): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('status, trial_ends_at, current_period_end')
    .eq('user_id', userId);
  if (error) throw new AppError('INTERNAL', 'Failed to read subscriptions', { cause: error });

  return hasAccess(
    (data ?? []).map((row) => ({
      status: row.status as SubscriptionStatus,
      trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at) : null,
      currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
    })),
    now,
  );
}

/** Porta única para conteúdo restrito: exige sessão e acesso ativo (teste ou assinatura). */
export async function requireAccess(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!(await userHasAccess(user.id))) redirect('/planos');
  return user;
}

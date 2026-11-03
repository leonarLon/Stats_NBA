'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_RULES, authLimiter, type AttemptRule } from '../lib/attempt-limiter';
import { getAppConfig } from '../lib/config';
import { logger } from '../lib/logger';
import { getSupabaseAdmin } from '../supabase/admin';
import { createSupabaseServerClient } from '../supabase/server';
import { getCurrentUser, isAuthEnabled, requireUser } from './session';
import {
  deleteAccountSchema,
  fieldErrors,
  newPasswordSchema,
  resetRequestSchema,
  safeNextPath,
  signInSchema,
  signUpSchema,
  type FieldErrors,
} from './validation';

/**
 * Ações dos formulários de conta. Cada uma valida a entrada no servidor (nunca confia no
 * navegador) e devolve mensagens em português. Nenhuma revela se um e-mail está cadastrado.
 */

export interface FormState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fields?: FieldErrors;
  /** Valores para repreencher o formulário (nunca a senha). */
  email?: string;
}

const log = logger.child({ component: 'auth' });

const DEMO: FormState = { status: 'error', message: 'Cadastro e login não funcionam no modo demonstração (Supabase não configurado).' };
const GENERIC = 'Não foi possível concluir agora. Tente de novo em instantes.';

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  over_request_rate_limit: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  over_email_send_rate_limit: 'Muitos e-mails enviados em pouco tempo. Aguarde alguns minutos e tente de novo.',
  weak_password: 'Senha fraca. Use uma senha mais longa, com letras e números.',
  same_password: 'A nova senha precisa ser diferente da atual.',
  signup_disabled: 'Novos cadastros estão temporariamente fechados.',
};

function authError(action: string, error: { code?: string; status?: number }): string {
  const message = error.code ? MESSAGES[error.code] : undefined;
  if (!message) log.warn('auth action failed', { action, code: error.code, status: error.status });
  return message ?? GENERIC;
}

function emailOf(formData: FormData): string {
  return String(formData.get('email') ?? '').slice(0, 254);
}

/** IP do visitante. Na Vercel, x-forwarded-for é preenchido pela própria plataforma. */
async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'desconhecido';
}

/** Conta a tentativa em todas as regras; devolve a mensagem de espera se alguma estourou. */
function tooManyAttempts(checks: Array<[AttemptRule, string]>): string | null {
  const wait = Math.max(...checks.map(([rule, key]) => authLimiter.hit(rule, key)));
  if (wait === 0) return null;
  log.warn('auth attempts limited', { rules: checks.map(([r]) => r.name) });
  const minutes = Math.max(1, Math.ceil(wait / 60));
  return `Muitas tentativas seguidas. Tente de novo em ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`;
}

function siteUrl(path: string): string {
  return new URL(path, getAppConfig().NEXT_PUBLIC_SITE_URL).toString();
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isAuthEnabled()) return { ...DEMO, email: emailOf(formData) };
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: 'error', fields: fieldErrors(parsed.error), email: emailOf(formData) };

  const ip = await clientIp();
  const limited = tooManyAttempts([[AUTH_RULES.loginPerIp, ip], [AUTH_RULES.loginPerEmail, parsed.data.email]]);
  if (limited) return { status: 'error', message: limited, email: parsed.data.email };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: 'error', message: authError('sign_in', error), email: parsed.data.email };
  authLimiter.reset(AUTH_RULES.loginPerEmail, parsed.data.email);

  redirect(safeNextPath(formData.get('proximo')));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isAuthEnabled()) return { ...DEMO, email: emailOf(formData) };
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: 'error', fields: fieldErrors(parsed.error), email: emailOf(formData) };

  const limited = tooManyAttempts([[AUTH_RULES.signupPerIp, await clientIp()]]);
  if (limited) return { status: 'error', message: limited, email: parsed.data.email };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: siteUrl('/auth/confirm?proximo=/planos') },
  });
  if (error) return { status: 'error', message: authError('sign_up', error), email: parsed.data.email };

  // Aceite dos termos. Para e-mail já cadastrado, o Supabase devolve um id fictício e nada é alterado.
  if (data.user) {
    const { error: termsError } = await getSupabaseAdmin()
      .from('profiles')
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq('id', data.user.id)
      .is('terms_accepted_at', null);
    if (termsError) log.error('failed to record terms acceptance', { code: termsError.code });
  }

  // Confirmação de e-mail desligada no projeto: a sessão já vem pronta
  if (data.session) redirect('/planos');

  return {
    status: 'success',
    message: `Se o e-mail ${parsed.data.email} ainda não tiver conta, enviamos um link de confirmação para ele. Abra o link para ativar a conta.`,
  };
}

export async function signOut(): Promise<void> {
  if (isAuthEnabled()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect('/');
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isAuthEnabled()) return { ...DEMO, email: emailOf(formData) };
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: 'error', fields: fieldErrors(parsed.error), email: emailOf(formData) };

  // O limite vale para qualquer e-mail, cadastrado ou não: a mensagem não revela nada
  const limited = tooManyAttempts([[AUTH_RULES.resetPerIp, await clientIp()], [AUTH_RULES.resetPerEmail, parsed.data.email]]);
  if (limited) return { status: 'error', message: limited, email: parsed.data.email };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: siteUrl('/auth/confirm?proximo=/redefinir-senha'),
  });
  // Erro de limite é mostrado; os demais não, para não revelar se o e-mail existe
  if (error?.code?.startsWith('over_')) return { status: 'error', message: authError('reset', error), email: parsed.data.email };
  if (error) authError('reset', error);

  return {
    status: 'success',
    message: `Se houver uma conta com o e-mail ${parsed.data.email}, enviamos um link para criar uma nova senha.`,
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isAuthEnabled()) return DEMO;
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'O link expirou ou já foi usado. Peça um novo na página "Esqueci a senha".' };

  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: 'error', fields: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: 'error', message: authError('update_password', error) };

  redirect('/conta?senha=alterada');
}

export async function startTrial(): Promise<FormState> {
  if (!isAuthEnabled()) return DEMO;
  const user = await requireUser();

  const { error } = await getSupabaseAdmin().rpc('start_trial', { p_user_id: user.id });
  if (error) {
    if (error.message.includes('trial_already_used')) {
      return { status: 'error', message: 'O teste grátis já foi usado nesta conta.' };
    }
    log.error('start_trial failed', { code: error.code });
    return { status: 'error', message: GENERIC };
  }
  log.info('trial started');
  redirect('/jogos');
}

export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isAuthEnabled()) return DEMO;
  const user = await requireUser();
  const parsed = deleteAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: 'error', fields: fieldErrors(parsed.error) };

  // Apaga o usuário do Auth; perfil e assinaturas são apagados em cascata (LGPD)
  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(user.id);
  if (error) {
    log.error('delete account failed', { code: error.code });
    return { status: 'error', message: GENERIC };
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: 'local' });
  log.info('account deleted');
  redirect('/?conta=excluida');
}

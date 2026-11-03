'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  deleteAccount,
  requestPasswordReset,
  signIn,
  signUp,
  startTrial,
  updatePassword,
  type FormState,
} from '@/server/auth/actions';
import { Field, FormMessage, SubmitButton } from './fields';

const IDLE: FormState = { status: 'idle' };

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, IDLE);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="proximo" value={next} />
      <FormMessage status={state.status} message={state.message} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required defaultValue={state.email} error={state.fields?.email} />
      <Field label="Senha" name="password" type="password" autoComplete="current-password" required error={state.fields?.password} />
      <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
      <p className="text-sm">
        <Link href="/recuperar-senha" className="text-muted underline hover:text-text">
          Esqueci a senha
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, IDLE);
  if (state.status === 'success') return <FormMessage status="success" message={state.message} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required defaultValue={state.email} error={state.fields?.email} />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        hint="Pelo menos 8 caracteres."
        error={state.fields?.password}
      />
      <Field label="Repita a senha" name="confirmPassword" type="password" autoComplete="new-password" required error={state.fields?.confirmPassword} />
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <input
            id="campo-terms"
            name="terms"
            type="checkbox"
            required
            aria-invalid={state.fields?.terms ? true : undefined}
            aria-describedby={state.fields?.terms ? 'campo-terms-erro' : undefined}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <label htmlFor="campo-terms" className="text-sm">
            Li e aceito os{' '}
            <Link href="/termos" className="underline">
              termos de uso
            </Link>{' '}
            e a{' '}
            <Link href="/privacidade" className="underline">
              política de privacidade
            </Link>
            .
          </label>
        </div>
        {state.fields?.terms && (
          <p id="campo-terms-erro" className="text-sm text-negative">
            {state.fields.terms}
          </p>
        )}
      </div>
      <SubmitButton pendingText="Criando conta…">Criar conta</SubmitButton>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, IDLE);
  if (state.status === 'success') return <FormMessage status="success" message={state.message} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <Field label="E-mail da conta" name="email" type="email" autoComplete="email" required defaultValue={state.email} error={state.fields?.email} />
      <SubmitButton pendingText="Enviando…">Enviar link</SubmitButton>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, IDLE);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <Field
        label="Nova senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        hint="Pelo menos 8 caracteres."
        error={state.fields?.password}
      />
      <Field label="Repita a nova senha" name="confirmPassword" type="password" autoComplete="new-password" required error={state.fields?.confirmPassword} />
      <SubmitButton pendingText="Salvando…">Salvar nova senha</SubmitButton>
    </form>
  );
}

export function StartTrialForm() {
  const [state, action] = useActionState(startTrial, IDLE);
  return (
    <form action={action} className="space-y-3">
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Liberando acesso…">Começar teste grátis de 3 dias</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, IDLE);
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <Field
        label="Para confirmar, digite EXCLUIR"
        name="confirmation"
        autoComplete="off"
        required
        error={state.fields?.confirmation}
      />
      <SubmitButton pendingText="Excluindo…" className="bg-negative text-bg">
        Excluir minha conta
      </SubmitButton>
    </form>
  );
}

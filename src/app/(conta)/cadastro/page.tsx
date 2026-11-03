import type { Metadata } from 'next';
import Link from 'next/link';
import { SignUpForm } from '@/components/auth/forms';

export const metadata: Metadata = { title: 'Criar conta' };

export default function SignUpPage() {
  return (
    <>
      <div>
        <h1 className="font-display text-4xl font-bold tracking-wide">Criar conta</h1>
        <p className="mt-1 text-muted">Depois de confirmar o e-mail, você libera 3 dias de acesso completo, sem cartão.</p>
      </div>
      <SignUpForm />
      <p className="text-sm text-muted">
        Já tem conta?{' '}
        <Link href="/entrar" className="text-text underline">
          Entrar
        </Link>
      </p>
    </>
  );
}

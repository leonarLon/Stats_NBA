import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { SignInForm } from '@/components/auth/forms';
import { Skeleton } from '@/components/ui/feedback';
import { getCurrentUser } from '@/server/auth/session';
import { safeNextPath } from '@/server/auth/validation';

export const metadata: Metadata = { title: 'Entrar' };

export default function SignInPage({ searchParams }: PageProps<'/entrar'>) {
  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-wide">Entrar</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        {searchParams.then((sp) => (
          <SignIn next={safeNextPath(sp.proximo)} linkError={sp.erro === 'link'} />
        ))}
      </Suspense>
      <p className="text-sm text-muted">
        Não tem conta?{' '}
        <Link href="/cadastro" className="text-text underline">
          Cadastre-se e teste grátis por 3 dias
        </Link>
      </p>
    </>
  );
}

async function SignIn({ next, linkError }: { next: string; linkError: boolean }) {
  if (await getCurrentUser()) redirect(next);
  return (
    <>
      {linkError && (
        <p role="alert" className="rounded-lg border border-negative/50 bg-negative/10 px-3 py-2 text-sm">
          O link expirou ou já foi usado. Entre com e-mail e senha ou peça um novo link.
        </p>
      )}
      <SignInForm next={next} />
    </>
  );
}

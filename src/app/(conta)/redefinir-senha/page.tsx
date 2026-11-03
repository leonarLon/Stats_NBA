import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { NewPasswordForm } from '@/components/auth/forms';
import { Skeleton } from '@/components/ui/feedback';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Nova senha' };

export default function NewPasswordPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-wide">Nova senha</h1>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <NewPassword />
      </Suspense>
    </>
  );
}

/** Chega-se aqui pelo link do e-mail, que já abre uma sessão temporária. */
async function NewPassword() {
  if (!(await getCurrentUser())) {
    return (
      <p role="alert" className="rounded-lg border border-negative/50 bg-negative/10 px-3 py-2 text-sm">
        O link expirou ou já foi usado.{' '}
        <Link href="/recuperar-senha" className="underline">
          Peça um novo link
        </Link>
        .
      </p>
    );
  }
  return <NewPasswordForm />;
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetRequestForm } from '@/components/auth/forms';

export const metadata: Metadata = { title: 'Esqueci a senha' };

export default function ResetRequestPage() {
  return (
    <>
      <div>
        <h1 className="font-display text-4xl font-bold tracking-wide">Esqueci a senha</h1>
        <p className="mt-1 text-muted">Enviamos um link para você criar uma nova senha.</p>
      </div>
      <ResetRequestForm />
      <p className="text-sm">
        <Link href="/entrar" className="text-muted underline hover:text-text">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}

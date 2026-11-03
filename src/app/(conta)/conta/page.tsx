import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { DeleteAccountForm, StartTrialForm } from '@/components/auth/forms';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/feedback';
import { fmtDateTime } from '@/lib/format';
import { signOut } from '@/server/auth/actions';
import { getAccountStatus, isAuthEnabled, requireUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Minha conta' };

export default function AccountPage({ searchParams }: PageProps<'/conta'>) {
  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-wide">Minha conta</h1>
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        {searchParams.then((sp) => (
          <Account passwordChanged={sp.senha === 'alterada'} />
        ))}
      </Suspense>
    </>
  );
}

async function Account({ passwordChanged }: { passwordChanged: boolean }) {
  if (!isAuthEnabled()) return <p className="text-muted">Indisponível no modo demonstração.</p>;
  const user = await requireUser();
  const status = await getAccountStatus(user.id);

  return (
    <div className="space-y-6">
      {passwordChanged && (
        <p role="status" className="rounded-lg border border-positive/50 bg-positive/10 px-3 py-2 text-sm">
          Senha alterada.
        </p>
      )}

      <Card className="space-y-3">
        <CardTitle>Acesso</CardTitle>
        <p className="text-sm text-muted">{user.email}</p>
        {status.hasAccess ? (
          <>
            <p>
              Acesso liberado até <strong>{status.accessEndsAt ? fmtDateTime(status.accessEndsAt) : '—'}</strong> (horário de Brasília).
            </p>
            <ButtonLink href="/jogos" className="w-full">
              Ver estatísticas
            </ButtonLink>
          </>
        ) : status.trialUsed ? (
          <p>
            Seu teste grátis terminou{status.trialEndsAt ? ` em ${fmtDateTime(status.trialEndsAt)}` : ''}. A assinatura mensal estará
            disponível em breve.
          </p>
        ) : (
          <>
            <p>Você ainda não usou o teste grátis: 3 dias de acesso completo, sem cartão.</p>
            <StartTrialForm />
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle>Sessão e senha</CardTitle>
        <p className="text-sm text-muted">
          Para trocar a senha, use{' '}
          <Link href="/recuperar-senha" className="underline">
            Esqueci a senha
          </Link>
          : enviamos um link para o seu e-mail.
        </p>
        <form action={signOut}>
          <Button type="submit" variant="secondary" className="w-full">
            Sair
          </Button>
        </form>
      </Card>

      <Card className="space-y-3 border-negative/40">
        <CardTitle>Excluir conta</CardTitle>
        <p className="text-sm text-muted">
          Apaga definitivamente seu cadastro, o histórico de acesso e o teste grátis. Não é possível desfazer.
        </p>
        <DeleteAccountForm />
      </Card>
    </div>
  );
}

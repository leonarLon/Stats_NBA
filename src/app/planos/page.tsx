import type { Metadata } from 'next';
import { Suspense } from 'react';
import { StartTrialForm } from '@/components/auth/forms';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge, Skeleton } from '@/components/ui/feedback';
import { fmtDateTime } from '@/lib/format';
import { getAccountStatus, getCurrentUser, isAuthEnabled } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Planos' };

export default function PlansPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:py-14">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-wide">Planos</h1>
        <p className="mt-1 max-w-prose text-muted">
          As estatísticas de jogadores, times e partidas exigem uma conta com acesso ativo: o teste grátis ou, quando estiver
          disponível, a assinatura mensal.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-3 border-primary/60">
          <CardTitle>Teste grátis</CardTitle>
          <p className="tabular font-display text-4xl font-bold">
            R$ 0 <span className="text-base font-normal text-muted">por 3 dias</span>
          </p>
          <p className="text-muted">Acesso completo, sem cartão de crédito. Uma vez por conta.</p>
          <div className="mt-auto">
            <Suspense fallback={<Skeleton className="h-12 w-full" />}>
              <TrialAction />
            </Suspense>
          </div>
        </Card>
        <Card className="flex flex-col gap-3">
          <CardTitle>Mensal</CardTitle>
          <p className="tabular font-display text-4xl font-bold">
            R$ 19,90 <span className="text-base font-normal text-muted">por mês</span>
          </p>
          <p className="text-muted">Acesso completo a todas as estatísticas.</p>
          <Badge className="mt-auto self-start">Em breve</Badge>
        </Card>
      </div>
    </div>
  );
}

/** O botão do teste depende de quem está vendo: visitante, conta nova, em teste ou teste usado. */
async function TrialAction() {
  if (!isAuthEnabled()) return <Badge>Indisponível no modo demonstração</Badge>;
  const user = await getCurrentUser();
  if (!user) {
    return (
      <ButtonLink href="/cadastro" size="lg" className="w-full">
        Criar conta e testar
      </ButtonLink>
    );
  }
  const status = await getAccountStatus(user.id);
  if (status.hasAccess) {
    return (
      <div className="space-y-2">
        <p className="text-sm">
          Acesso liberado até <strong>{status.accessEndsAt ? fmtDateTime(status.accessEndsAt) : '—'}</strong>.
        </p>
        <ButtonLink href="/jogos" size="lg" className="w-full">
          Ver estatísticas
        </ButtonLink>
      </div>
    );
  }
  if (status.trialUsed) return <p className="text-sm text-muted">Você já usou o teste grátis nesta conta.</p>;
  return <StartTrialForm />;
}

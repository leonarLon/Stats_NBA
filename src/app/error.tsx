'use client';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback';

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <ErrorState
        description="Não foi possível carregar esta página. Tente novamente em instantes."
        action={<Button onClick={() => retry()}>Tentar de novo</Button>}
      />
    </div>
  );
}

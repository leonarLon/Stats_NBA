import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <h1 className="sr-only">Página não encontrada</h1>
      <EmptyState
        title="Página não encontrada"
        description="O endereço pode ter mudado ou não existir."
        action={<ButtonLink href="/">Voltar ao início</ButtonLink>}
      />
    </div>
  );
}

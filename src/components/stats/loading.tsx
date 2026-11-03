import { Skeleton } from '@/components/ui/feedback';

/** Esqueleto de tabela enquanto os dados chegam. O texto de status é lido por leitores de tela. */
export function TableSkeleton({ rows = 8, label = 'Carregando estatísticas…' }: { rows?: number; label?: string }) {
  return (
    <div aria-busy="true" className="space-y-2">
      <p className="sr-only" role="status">
        {label}
      </p>
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

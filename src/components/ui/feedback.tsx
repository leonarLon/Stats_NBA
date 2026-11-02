import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted', className)}
      {...props}
    />
  );
}

/** Bloco de carregamento. Decorativo: o texto de status fica no contêiner com aria-busy. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-surface-2', className)} />;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-prose text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Algo deu errado', description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-xl border border-negative/40 bg-negative/5 p-8 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-prose text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

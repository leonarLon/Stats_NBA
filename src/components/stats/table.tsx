import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Tabela com rolagem horizontal própria (a página nunca rola de lado).
 * A região rolável recebe foco pelo teclado e tem nome acessível.
 */
export function StatTable({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={cn('overflow-x-auto rounded-xl border border-border', className)}>
      <table className="tabular w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({ className, numeric = true, ...props }: ComponentProps<'th'> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap border-b border-border bg-surface px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-muted',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, numeric = true, ...props }: ComponentProps<'td'> & { numeric?: boolean }) {
  return (
    <td
      className={cn('whitespace-nowrap border-b border-border/60 px-2.5 py-2', numeric ? 'text-right' : 'text-left', className)}
      {...props}
    />
  );
}

/** Primeira coluna (nome), fixa durante a rolagem horizontal. */
export function StickyTh({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="row"
      className={cn('sticky left-0 z-10 whitespace-nowrap border-b border-border/60 bg-bg px-2.5 py-2 text-left font-medium', className)}
      {...props}
    />
  );
}

/** Abreviação com o nome completo para leitores de tela e para o mouse. */
export function Abbr({ short, full }: { short: string; full: string }) {
  return (
    <abbr title={full} className="no-underline">
      {short}
    </abbr>
  );
}

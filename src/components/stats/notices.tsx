import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/feedback';
import { cn } from '@/lib/cn';
import { fmtStartTime } from '@/lib/format';
import type { GameSummary } from '@/server/stats/compute';

export function PageHeader({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-wide">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** Aviso fixo no modo demonstração (sem Supabase): os números são inventados. */
export function DemoNotice() {
  return (
    <p role="note" className="rounded-lg border border-secondary/50 bg-secondary/10 px-4 py-2 text-sm">
      <strong>Modo demonstração:</strong> times, jogadores e números desta página são fictícios.
    </p>
  );
}

export function Notice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="note" className={cn('rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted', className)}>
      {children}
    </p>
  );
}

export function PartialBadge({ className }: { className?: string }) {
  return (
    // Laranja de alerta (não usa o Badge, para a cor não depender da ordem das classes no CSS)
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-warning/60 bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning',
        className,
      )}
      title="A fonte enviou o box score sem alguns jogadores"
    >
      Box score parcial
    </span>
  );
}

/** Situação do jogo e, se encerrado, do box score. */
export function GameStatusLabel({ game }: { game: GameSummary }) {
  switch (game.status) {
    case 'scheduled':
      return <span className="text-muted">{game.startsAt ? `${fmtStartTime(game.startsAt)} (Brasília)` : 'Horário a definir'}</span>;
    case 'in_progress':
      return <span className="font-semibold text-positive">Em andamento</span>;
    case 'postponed':
      return <span className="text-muted">Adiado</span>;
    case 'canceled':
      return <span className="text-muted">Cancelado</span>;
    case 'final':
      return (
        <span className="text-muted">
          Final{game.overtimePeriods > 0 ? ` (${game.overtimePeriods > 1 ? `${game.overtimePeriods}× ` : ''}prorrogação)` : ''}
        </span>
      );
  }
}

export function BoxScoreStatus({ game }: { game: GameSummary }) {
  if (game.status !== 'final') return null;
  if (game.statsStatus === 'partial') return <PartialBadge />;
  if (game.statsStatus === 'pending') return <Badge>Box score em processamento</Badge>;
  if (game.statsStatus === 'invalid') return <Badge>Box score indisponível</Badge>;
  if (game.statsStatus === 'unavailable') return <Badge title="A fonte gratuita não libera mais este jogo">Sem box score</Badge>;
  return null;
}

/** Aviso de cobertura das médias. Não aparece no modo demonstração (dados fictícios). */
export function CoverageNote({ demo }: { demo: boolean }) {
  if (demo) return null;
  return (
    <Notice>
      As médias e totais usam só jogos com box score, coletados a partir de 02/11/2026. A fonte gratuita libera box scores
      apenas de até um dia atrás, então os jogos anteriores entram na classificação e nos resultados, mas não nas médias.
    </Notice>
  );
}

export function TeamLink({ team, full = false, className }: { team: { abbreviation: string; name: string }; full?: boolean; className?: string }) {
  return (
    <Link href={`/times/${team.abbreviation}`} className={cn('hover:text-primary hover:underline', className)}>
      {full ? team.name : <abbr title={team.name} className="no-underline">{team.abbreviation}</abbr>}
    </Link>
  );
}

import type { ReactNode } from 'react';
import { DemoNotice } from '@/components/stats/notices';
import { isStatsDemo } from '@/server/stats/queries';

/**
 * Área de estatísticas. O acesso NÃO é verificado aqui: cada consulta de server/stats/queries.ts
 * verifica sessão e acesso antes de ler (um layout não roda de novo em toda navegação).
 */
export default function StatsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:py-10">
      {isStatsDemo() && <DemoNotice />}
      {children}
    </div>
  );
}

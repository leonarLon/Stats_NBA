import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/stats/loading';
import { BoxScoreStatus, GameStatusLabel, PageHeader } from '@/components/stats/notices';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { cn } from '@/lib/cn';
import { fmtGameDate } from '@/lib/format';
import { parseDateParam } from '@/lib/params';
import type { GameSummary } from '@/server/stats/compute';
import { getGamesOn } from '@/server/stats/queries';

export const metadata: Metadata = { title: 'Jogos' };

export default function GamesPage({ searchParams }: PageProps<'/jogos'>) {
  return (
    <>
      <PageHeader title="Jogos" description="Resultados e box scores, pela data do jogo nos Estados Unidos. Horários em Brasília." />
      <Suspense fallback={<TableSkeleton rows={6} label="Carregando jogos…" />}>
        {searchParams.then((sp) => (
          <GamesOn date={parseDateParam(sp, 'data')} />
        ))}
      </Suspense>
    </>
  );
}

async function GamesOn({ date }: { date: string | null }) {
  const data = await getGamesOn(date);
  if (!data) return <EmptyState title="Nenhum jogo cadastrado" description="Os jogos aparecem assim que o calendário for carregado." />;

  return (
    <section aria-labelledby="dia" className="space-y-4">
      <nav aria-label="Navegar entre datas" className="flex items-center justify-between gap-3">
        <DayLink date={data.prev} label="Dia anterior" arrow="←" />
        <h2 id="dia" className="text-center font-display text-2xl font-semibold tracking-wide first-letter:uppercase">
          {fmtGameDate(data.date)}
        </h2>
        <DayLink date={data.next} label="Próximo dia" arrow="→" />
      </nav>
      {data.games.length === 0 ? (
        <EmptyState title="Nenhum jogo nesta data" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.games.map((g) => (
            <li key={g.id}>
              <GameCard game={g} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DayLink({ date, label, arrow }: { date: string | null; label: string; arrow: string }) {
  if (!date) return <span className="w-24" aria-hidden="true" />;
  return (
    <Link href={`/jogos?data=${date}`} className={buttonClasses('secondary', 'md', 'w-24 shrink-0')}>
      <span className="sr-only">
        {label}: {fmtGameDate(date)}
      </span>
      <span aria-hidden="true">{arrow === '←' ? `${arrow} ${fmtGameDate(date, 'short')}` : `${fmtGameDate(date, 'short')} ${arrow}`}</span>
    </Link>
  );
}

function GameCard({ game }: { game: GameSummary }) {
  const final = game.status === 'final';
  const winner = final && game.homeScore !== null && game.awayScore !== null ? (game.homeScore > game.awayScore ? 'home' : 'away') : null;
  const row = (side: 'away' | 'home') => {
    const team = game[side];
    const score = side === 'home' ? game.homeScore : game.awayScore;
    return (
      <div className={cn('flex items-center justify-between gap-3', winner && winner !== side && 'text-muted')}>
        <span>
          <span className="font-semibold">{team.abbreviation}</span> <span className="text-sm text-muted">{team.nickname}</span>
        </span>
        <span className="tabular font-display text-2xl font-bold">{score ?? ''}</span>
      </div>
    );
  };
  const label = `${game.away.name} ${game.awayScore ?? ''} @ ${game.home.name} ${game.homeScore ?? ''}`.replace(/\s+/g, ' ').trim();

  return (
    <Card className="relative space-y-2 p-4 transition-colors focus-within:border-primary hover:border-primary/60">
      {row('away')}
      {row('home')}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-sm">
        <GameStatusLabel game={game} />
        <BoxScoreStatus game={game} />
      </div>
      {final && (
        <Link href={`/jogos/${game.id}`} className="absolute inset-0 rounded-xl" aria-label={`Box score: ${label}`} />
      )}
    </Card>
  );
}

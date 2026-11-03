import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BoxScoreTable } from '@/components/stats/box-score-table';
import { TableSkeleton } from '@/components/stats/loading';
import { BoxScoreStatus, GameStatusLabel, Notice, TeamLink } from '@/components/stats/notices';
import { fmtGameDate } from '@/lib/format';
import { parseIdParam } from '@/lib/params';
import { getBoxScore } from '@/server/stats/queries';

export const metadata: Metadata = { title: 'Box score' };

export default function BoxScorePage({ params }: PageProps<'/jogos/[id]'>) {
  return (
    <Suspense fallback={<TableSkeleton rows={12} label="Carregando box score…" />}>
      {params.then(({ id }) => (
        <BoxScore id={parseIdParam(id)} />
      ))}
    </Suspense>
  );
}

async function BoxScore({ id }: { id: number | null }) {
  if (id === null) notFound();
  const box = await getBoxScore(id);
  if (!box) notFound();
  const { game, teams } = box;

  return (
    <article className="space-y-6">
      <Link href={`/jogos?data=${game.date}`} className="text-sm text-muted hover:text-text">
        ← Jogos de {fmtGameDate(game.date)}
      </Link>

      <header className="space-y-3">
        <h1 className="font-display text-3xl font-bold tracking-wide sm:text-4xl">
          {game.away.name} <span className="text-muted">@</span> {game.home.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {teams.map((side) => (
            <p key={side.team.id} className="flex items-baseline gap-2">
              <TeamLink team={side.team} className="font-semibold" />
              <span className="tabular font-display text-4xl font-bold">{side.score ?? '—'}</span>
            </p>
          ))}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <GameStatusLabel game={game} />
            <BoxScoreStatus game={game} />
          </div>
        </div>
      </header>

      {game.statsStatus === 'partial' && (
        <Notice>
          A fonte de dados enviou este box score sem alguns jogadores. O placar e os totais dos times estão corretos; a soma
          das linhas dos jogadores pode ficar abaixo deles. Uma nova tentativa é feita 24 horas, 3 dias e 7 dias após o jogo.
        </Notice>
      )}
      {game.status === 'final' && game.statsStatus === 'pending' && (
        <Notice>O box score deste jogo ainda está sendo processado. Volte em alguns minutos.</Notice>
      )}
      {game.status === 'final' && game.statsStatus === 'invalid' && (
        <Notice>
          Os números enviados pela fonte para este jogo não passaram na validação e não são exibidos. Uma nova tentativa é
          feita automaticamente.
        </Notice>
      )}

      {teams.map((side) =>
        side.lines.length > 0 || side.totals ? (
          <section key={side.team.id} aria-labelledby={`time-${side.team.id}`} className="space-y-2">
            <h2 id={`time-${side.team.id}`} className="font-display text-2xl font-semibold tracking-wide">
              {side.team.name}
            </h2>
            <BoxScoreTable side={side} />
          </section>
        ) : null,
      )}
    </article>
  );
}

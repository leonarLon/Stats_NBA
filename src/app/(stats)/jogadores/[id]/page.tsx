import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BOX_COLUMNS, BoxCountCells } from '@/components/stats/box-score-table';
import { TableSkeleton } from '@/components/stats/loading';
import { Notice, PartialBadge, TeamLink } from '@/components/stats/notices';
import { Abbr, StatTable, StickyTh, Td, Th } from '@/components/stats/table';
import { EmptyState } from '@/components/ui/feedback';
import { fmt1, fmtGameDate, fmtMinutes, fmtPct, fmtSigned } from '@/lib/format';
import { parseIdParam } from '@/lib/params';
import { getPlayer } from '@/server/stats/queries';

export const metadata: Metadata = { title: 'Jogador' };

export default function PlayerPage({ params }: PageProps<'/jogadores/[id]'>) {
  return (
    <Suspense fallback={<TableSkeleton rows={12} label="Carregando jogador…" />}>
      {params.then(({ id }) => (
        <Player id={parseIdParam(id)} />
      ))}
    </Suspense>
  );
}

async function Player({ id }: { id: number | null }) {
  if (id === null) notFound();
  const data = await getPlayer(id);
  if (!data) notFound();
  const { player, team, seasonRow: s, gameLog } = data;

  const highlights = s
    ? [
        { label: 'Pontos', value: fmt1(s.pts) },
        { label: 'Rebotes', value: fmt1(s.reb) },
        { label: 'Assistências', value: fmt1(s.ast) },
        { label: 'Minutos', value: fmt1(s.min) },
        { label: 'Arremessos', value: fmtPct(s.fgPct) },
        { label: 'Bolas de três', value: fmtPct(s.fg3Pct) },
        { label: 'Lances livres', value: fmtPct(s.ftPct) },
        { label: 'True shooting (est.)', value: fmtPct(s.tsPct) },
      ]
    : [];

  return (
    <article className="space-y-6">
      <Link href="/jogadores" className="text-sm text-muted hover:text-text">
        ← Jogadores
      </Link>
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide">{player.name}</h1>
        <p className="mt-1 text-muted">
          {player.position && <>{player.position} · </>}
          {team && (
            <>
              <TeamLink team={team} full /> ·{' '}
            </>
          )}
          Temporada {data.season}
        </p>
      </header>

      {s ? (
        <section aria-labelledby="medias" className="space-y-3">
          <h2 id="medias" className="font-display text-2xl font-semibold tracking-wide">
            Médias por jogo
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {highlights.map((h) => (
              <div key={h.label} className="rounded-xl border border-border bg-surface p-4">
                <dt className="text-sm text-muted">{h.label}</dt>
                <dd className="tabular font-display text-3xl font-bold">{h.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted">
            {/* Titularidade não aparece: a fonte gratuita não informa quem começou o jogo */}
            {s.gp} {s.gp === 1 ? 'jogo' : 'jogos'} · {s.doubleDoubles} double-doubles · {s.tripleDoubles} triple-doubles
          </p>
          {s.teamPartialGames > 0 && (
            <Notice>
              {s.teamPartialGames === 1 ? '1 jogo do time tem' : `${s.teamPartialGames} jogos do time têm`} box score incompleto na
              fonte; os totais deste jogador podem estar abaixo do real. As médias por jogo continuam corretas para os jogos em
              que ele aparece.
            </Notice>
          )}
        </section>
      ) : (
        <EmptyState title="Sem jogos nesta temporada" />
      )}

      {gameLog.length > 0 && (
        <section aria-labelledby="jogos" className="space-y-3">
          <h2 id="jogos" className="font-display text-2xl font-semibold tracking-wide">
            Jogo a jogo
          </h2>
          <StatTable label={`Jogos de ${player.name} na temporada`}>
            <thead>
              <tr>
                <Th numeric={false} className="sticky left-0 z-10">Data</Th>
                <Th numeric={false}><Abbr short="Adv." full="Adversário" /></Th>
                <Th numeric={false}><Abbr short="Res." full="Resultado" /></Th>
                {BOX_COLUMNS}
                <Th><Abbr short="+/-" full="Saldo de pontos com o jogador em quadra" /></Th>
              </tr>
            </thead>
            <tbody>
              {gameLog.map((g) => (
                <tr key={g.gameId}>
                  <StickyTh>
                    <Link href={`/jogos/${g.gameId}`} className="hover:text-primary hover:underline">
                      {fmtGameDate(g.date, 'short')}
                    </Link>
                  </StickyTh>
                  <Td numeric={false}>
                    {g.isHome ? 'vs ' : '@ '}
                    <TeamLink team={g.opponent} />
                  </Td>
                  <Td numeric={false} className={g.won === null ? undefined : g.won ? 'text-positive' : 'text-negative'}>
                    {g.won === null ? '—' : `${g.won ? 'V' : 'D'} ${g.teamScore}-${g.oppScore}`}
                    {g.statsStatus === 'partial' && <PartialBadge className="ml-2" />}
                  </Td>
                  {g.line.didNotPlay ? (
                    <Td numeric={false} colSpan={13} className="text-muted">
                      Não jogou
                    </Td>
                  ) : (
                    <>
                      <Td>{fmtMinutes(g.line.seconds)}</Td>
                      <BoxCountCells c={g.line} />
                      <Td>{fmtSigned(g.line.plusMinus)}</Td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </StatTable>
        </section>
      )}
    </article>
  );
}

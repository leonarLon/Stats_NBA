import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/stats/loading';
import { BoxScoreStatus, GameStatusLabel, TeamLink } from '@/components/stats/notices';
import { Abbr, StatTable, StickyTh, Td, Th } from '@/components/stats/table';
import { EmptyState } from '@/components/ui/feedback';
import { fmt1, fmtGameDate, fmtPct, fmtRecord, fmtSigned, fmtStreak } from '@/lib/format';
import { parseTeamParam } from '@/lib/params';
import type { GameSummary, TeamRef } from '@/server/stats/compute';
import { getTeam } from '@/server/stats/queries';

export const metadata: Metadata = { title: 'Time' };

const CONFERENCE = { East: 'Leste', West: 'Oeste' } as const;

export default function TeamPage({ params }: PageProps<'/times/[sigla]'>) {
  return (
    <Suspense fallback={<TableSkeleton rows={12} label="Carregando time…" />}>
      {params.then(({ sigla }) => (
        <Team abbreviation={parseTeamParam(sigla)} />
      ))}
    </Suspense>
  );
}

async function Team({ abbreviation }: { abbreviation: string | null }) {
  if (abbreviation === null) notFound();
  const data = await getTeam(abbreviation);
  if (!data) notFound();
  const { team, seasonRow: s, standing, roster, games } = data;

  const played = games.filter((g) => g.status === 'final').slice(-10).reverse();
  const upcoming = games.filter((g) => g.status === 'scheduled' || g.status === 'in_progress').slice(0, 5);
  const highlights = s
    ? [
        { label: 'Campanha', value: fmtRecord(s.wins, s.losses) },
        { label: 'Pontos', value: fmt1(s.pts) },
        { label: 'Pontos sofridos', value: fmt1(s.oppPts) },
        { label: 'Saldo por 100 posses', value: fmtSigned(s.netRating, 1) },
      ]
    : [];

  return (
    <article className="space-y-8">
      <Link href="/times" className="text-sm text-muted hover:text-text">
        ← Times
      </Link>
      <header>
        <h1 className="font-display text-4xl font-bold tracking-wide">{team.name}</h1>
        <p className="mt-1 text-muted">
          {team.conference && standing
            ? `${standing.rank}º na Conferência ${CONFERENCE[team.conference]} · sequência ${fmtStreak(standing.streak)} · `
            : ''}
          Temporada {data.season}
        </p>
      </header>

      {s && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {highlights.map((h) => (
            <div key={h.label} className="rounded-xl border border-border bg-surface p-4">
              <dt className="text-sm text-muted">{h.label}</dt>
              <dd className="tabular font-display text-3xl font-bold">{h.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <section aria-labelledby="elenco" className="space-y-3">
        <h2 id="elenco" className="font-display text-2xl font-semibold tracking-wide">
          Elenco
        </h2>
        {roster.length === 0 ? (
          <EmptyState title="Nenhum jogador com jogos nesta temporada" />
        ) : (
          <StatTable label={`Elenco de ${team.name}: médias por jogo`}>
            <thead>
              <tr>
                <Th numeric={false} className="sticky left-0 z-10">Jogador</Th>
                <Th><Abbr short="J" full="Jogos disputados" /></Th>
                <Th><Abbr short="MIN" full="Minutos por jogo" /></Th>
                <Th><Abbr short="PTS" full="Pontos por jogo" /></Th>
                <Th><Abbr short="REB" full="Rebotes por jogo" /></Th>
                <Th><Abbr short="AST" full="Assistências por jogo" /></Th>
                <Th><Abbr short="AR%" full="Aproveitamento nos arremessos de quadra" /></Th>
                <Th><Abbr short="3P%" full="Aproveitamento nas bolas de três" /></Th>
                <Th><Abbr short="LL%" full="Aproveitamento nos lances livres" /></Th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.playerId}>
                  <StickyTh>
                    <Link href={`/jogadores/${r.playerId}`} className="hover:text-primary hover:underline">
                      {r.name}
                    </Link>
                  </StickyTh>
                  <Td>{r.gp}</Td>
                  <Td>{fmt1(r.min)}</Td>
                  <Td>{fmt1(r.pts)}</Td>
                  <Td>{fmt1(r.reb)}</Td>
                  <Td>{fmt1(r.ast)}</Td>
                  <Td>{fmtPct(r.fgPct)}</Td>
                  <Td>{fmtPct(r.fg3Pct)}</Td>
                  <Td>{fmtPct(r.ftPct)}</Td>
                </tr>
              ))}
            </tbody>
          </StatTable>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <GameList title="Últimos jogos" id="ultimos" team={team} games={played} empty="Nenhum jogo disputado ainda" />
        <GameList title="Próximos jogos" id="proximos" team={team} games={upcoming} empty="Nenhum jogo agendado nos próximos dias" />
      </div>
    </article>
  );
}

function GameList({ title, id, team, games, empty }: { title: string; id: string; team: TeamRef; games: GameSummary[]; empty: string }) {
  return (
    <section aria-labelledby={id} className="min-w-0 space-y-3">
      <h2 id={id} className="font-display text-2xl font-semibold tracking-wide">
        {title}
      </h2>
      {games.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {games.map((g) => {
            const isHome = g.home.id === team.id;
            const opponent = isHome ? g.away : g.home;
            const own = isHome ? g.homeScore : g.awayScore;
            const opp = isHome ? g.awayScore : g.homeScore;
            const won = g.status === 'final' && own !== null && opp !== null ? own > opp : null;
            return (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                <span>
                  <span className="text-muted">{fmtGameDate(g.date, 'short')}</span> {isHome ? 'vs' : '@'}{' '}
                  <TeamLink team={opponent} full />
                </span>
                <span className="flex items-center gap-2 text-sm">
                  {won === null ? (
                    <GameStatusLabel game={g} />
                  ) : (
                    <Link href={`/jogos/${g.id}`} className={`tabular font-semibold hover:underline ${won ? 'text-positive' : 'text-negative'}`}>
                      <span className="sr-only">{won ? 'Vitória' : 'Derrota'} por </span>
                      <span aria-hidden="true">{won ? 'V' : 'D'} </span>
                      {own}-{opp}
                      <span className="sr-only">: ver box score</span>
                    </Link>
                  )}
                  <BoxScoreStatus game={g} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

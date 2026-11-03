import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/stats/loading';
import { CoverageNote, Notice, PageHeader, TeamLink } from '@/components/stats/notices';
import { Abbr, StatTable, StickyTh, Td, Th } from '@/components/stats/table';
import { EmptyState } from '@/components/ui/feedback';
import { fmt1, fmtPct, fmtSigned } from '@/lib/format';
import { getTeamSeasons, isStatsDemo } from '@/server/stats/queries';

export const metadata: Metadata = { title: 'Times' };

export default function TeamsPage() {
  return (
    <>
      <PageHeader title="Times" description="Médias por jogo e ratings da temporada regular, ordenados pelo saldo por 100 posses." />
      <Suspense fallback={<TableSkeleton rows={15} label="Carregando times…" />}>
        <Teams />
      </Suspense>
    </>
  );
}

async function Teams() {
  const data = await getTeamSeasons();
  if (!data || data.rows.length === 0) {
    return <EmptyState title="Nenhuma estatística ainda" description="As médias aparecem depois que os primeiros box scores forem processados." />;
  }

  return (
    <div className="space-y-4">
      <StatTable label={`Estatísticas dos times na temporada ${data.season}`}>
        <thead>
          <tr>
            <Th numeric={false} className="sticky left-0 z-10">Time</Th>
            <Th><Abbr short="J" full="Jogos com box score (base das médias)" /></Th>
            <Th><Abbr short="V-D" full="Vitórias e derrotas na temporada" /></Th>
            <Th><Abbr short="PTS" full="Pontos por jogo" /></Th>
            <Th><Abbr short="SOF" full="Pontos sofridos por jogo" /></Th>
            <Th><Abbr short="REB" full="Rebotes por jogo" /></Th>
            <Th><Abbr short="AST" full="Assistências por jogo" /></Th>
            <Th><Abbr short="AR%" full="Aproveitamento nos arremessos de quadra" /></Th>
            <Th><Abbr short="3P%" full="Aproveitamento nas bolas de três" /></Th>
            <Th><Abbr short="LL%" full="Aproveitamento nos lances livres" /></Th>
            <Th><Abbr short="ORtg" full="Rating ofensivo: pontos por 100 posses (estimado)" /></Th>
            <Th><Abbr short="DRtg" full="Rating defensivo: pontos sofridos por 100 posses (estimado)" /></Th>
            <Th><Abbr short="Saldo" full="Net rating: rating ofensivo menos defensivo (estimado)" /></Th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.team.id}>
              <StickyTh>
                <TeamLink team={r.team} full className="hidden sm:inline" />
                <TeamLink team={r.team} className="sm:hidden" />
              </StickyTh>
              <Td>{r.gp}</Td>
              <Td>{`${r.wins}-${r.losses}`}</Td>
              <Td>{fmt1(r.pts)}</Td>
              <Td>{fmt1(r.oppPts)}</Td>
              <Td>{fmt1(r.reb)}</Td>
              <Td>{fmt1(r.ast)}</Td>
              <Td>{fmtPct(r.fgPct)}</Td>
              <Td>{fmtPct(r.fg3Pct)}</Td>
              <Td>{fmtPct(r.ftPct)}</Td>
              <Td>{fmt1(r.offRating)}</Td>
              <Td>{fmt1(r.defRating)}</Td>
              <Td className={r.netRating === null ? undefined : r.netRating >= 0 ? 'text-positive' : 'text-negative'}>
                {fmtSigned(r.netRating, 1)}
              </Td>
            </tr>
          ))}
        </tbody>
      </StatTable>
      <Notice>
        Posses estimadas pelo box score (arremessos − rebotes ofensivos + erros + 0,44 × lances livres). Os ratings são
        estimativas e podem diferir dos números oficiais. Temporada {data.season}.
      </Notice>
      <CoverageNote demo={isStatsDemo()} />
    </div>
  );
}

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/stats/loading';
import { PageHeader, TeamLink } from '@/components/stats/notices';
import { Abbr, StatTable, StickyTh, Td, Th } from '@/components/stats/table';
import { EmptyState } from '@/components/ui/feedback';
import { cn } from '@/lib/cn';
import { fmtGamesBehind, fmtRecord, fmtStreak, fmtWinPct } from '@/lib/format';
import type { StandingRow } from '@/server/stats/compute';
import { getStandings } from '@/server/stats/queries';

export const metadata: Metadata = { title: 'Classificação' };

const CONFERENCES = [
  { key: 'East', title: 'Conferência Leste' },
  { key: 'West', title: 'Conferência Oeste' },
] as const;

export default function StandingsPage() {
  return (
    <>
      <PageHeader title="Classificação" description="Campanha dos times por conferência, recalculada depois de cada jogo." />
      <Suspense fallback={<TableSkeleton rows={15} />}>
        <Standings />
      </Suspense>
    </>
  );
}

async function Standings() {
  const data = await getStandings();
  if (!data) return <EmptyState title="Temporada ainda não cadastrada" description="A classificação aparece assim que o calendário for carregado." />;

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      {CONFERENCES.map((c) => (
        <section key={c.key} aria-labelledby={`conf-${c.key}`} className="min-w-0 space-y-3">
          <h2 id={`conf-${c.key}`} className="font-display text-2xl font-semibold tracking-wide">
            {c.title}
          </h2>
          <ConferenceTable title={c.title} rows={data.standings[c.key]} />
        </section>
      ))}
      <p className="text-sm text-muted xl:col-span-2">
        Temporada {data.season}. As linhas tracejadas separam os 6 primeiros (vaga direta nos playoffs) e os 10
        primeiros (play-in). Desempate simplificado (aproveitamento, vitórias e sigla); os critérios oficiais da NBA
        consideram confronto direto e outros fatores.
      </p>
    </div>
  );
}

function ConferenceTable({ title, rows }: { title: string; rows: StandingRow[] }) {
  if (rows.length === 0) return <EmptyState title="Nenhum jogo disputado ainda" />;
  return (
    <StatTable label={`Classificação da ${title}`}>
      <thead>
        <tr>
          <Th>#</Th>
          <Th numeric={false}>Time</Th>
          <Th><Abbr short="V" full="Vitórias" /></Th>
          <Th><Abbr short="D" full="Derrotas" /></Th>
          <Th><Abbr short="%" full="Aproveitamento" /></Th>
          <Th><Abbr short="JA" full="Jogos atrás do líder" /></Th>
          <Th>Casa</Th>
          <Th>Fora</Th>
          <Th><Abbr short="Últ. 10" full="Últimos 10 jogos" /></Th>
          <Th><Abbr short="Seq." full="Sequência atual" /></Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          // Linha pontilhada depois do 6º (playoffs diretos) e do 10º (play-in)
          <tr key={r.team.id} className={cn((r.rank === 6 || r.rank === 10) && '[&>*]:border-b-2 [&>*]:border-dashed [&>*]:border-b-border')}>
            <Td className="text-muted">{r.rank}</Td>
            <StickyTh>
              <TeamLink team={r.team} full className="hidden sm:inline" />
              <TeamLink team={r.team} className="sm:hidden" />
            </StickyTh>
            <Td>{r.wins}</Td>
            <Td>{r.losses}</Td>
            <Td>{fmtWinPct(r.winPct)}</Td>
            <Td>{fmtGamesBehind(r.gamesBehind)}</Td>
            <Td>{fmtRecord(...r.home)}</Td>
            <Td>{fmtRecord(...r.away)}</Td>
            <Td>{fmtRecord(...r.last10)}</Td>
            <Td className={r.streak > 0 ? 'text-positive' : r.streak < 0 ? 'text-negative' : undefined}>{fmtStreak(r.streak)}</Td>
          </tr>
        ))}
      </tbody>
    </StatTable>
  );
}

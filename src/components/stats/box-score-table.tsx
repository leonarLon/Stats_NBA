import Link from 'next/link';
import { fmtMinutes, fmtPct, fmtSigned } from '@/lib/format';
import type { BoxTeam, Counts } from '@/server/stats/compute';
import { fg3Pct, fgPct, ftPct } from '@/server/domain/formulas';
import { Abbr, StatTable, StickyTh, Td, Th } from './table';

export const BOX_COLUMNS = (
  <>
    <Th><Abbr short="MIN" full="Minutos" /></Th>
    <Th><Abbr short="PTS" full="Pontos" /></Th>
    <Th><Abbr short="REB" full="Rebotes" /></Th>
    <Th><Abbr short="AST" full="Assistências" /></Th>
    <Th><Abbr short="ROU" full="Roubos de bola" /></Th>
    <Th><Abbr short="TOC" full="Tocos" /></Th>
    <Th><Abbr short="ERR" full="Erros (perdas de posse)" /></Th>
    <Th><Abbr short="AR" full="Arremessos de quadra (certos-tentados)" /></Th>
    <Th><Abbr short="3P" full="Bolas de três (certas-tentadas)" /></Th>
    <Th><Abbr short="LL" full="Lances livres (certos-tentados)" /></Th>
    <Th><Abbr short="RO" full="Rebotes ofensivos" /></Th>
    <Th><Abbr short="FC" full="Faltas cometidas" /></Th>
  </>
);

export function BoxCountCells({ c }: { c: Counts }) {
  return (
    <>
      <Td className="font-semibold">{c.pts}</Td>
      <Td>{c.reb}</Td>
      <Td>{c.ast}</Td>
      <Td>{c.stl}</Td>
      <Td>{c.blk}</Td>
      <Td>{c.tov}</Td>
      <Td>{`${c.fgm}-${c.fga}`}</Td>
      <Td>{`${c.fg3m}-${c.fg3a}`}</Td>
      <Td>{`${c.ftm}-${c.fta}`}</Td>
      <Td>{c.oreb ?? '—'}</Td>
      <Td>{c.pf}</Td>
    </>
  );
}

export function BoxScoreTable({ side }: { side: BoxTeam }) {
  const played = side.lines.filter((l) => !l.didNotPlay);
  const dnp = side.lines.filter((l) => l.didNotPlay);
  return (
    <StatTable label={`Box score de ${side.team.name}`}>
      <thead>
        <tr>
          <Th numeric={false} className="sticky left-0 z-10">Jogador</Th>
          {BOX_COLUMNS}
          <Th><Abbr short="+/-" full="Saldo de pontos com o jogador em quadra" /></Th>
        </tr>
      </thead>
      <tbody>
        {played.map((l) => (
          <tr key={l.playerId}>
            <StickyTh>
              <Link href={`/jogadores/${l.playerId}`} className="hover:text-primary hover:underline">
                {l.name}
              </Link>
              {l.position && <span className="ml-1.5 text-xs text-muted">{l.position}</span>}
            </StickyTh>
            <Td>{fmtMinutes(l.seconds)}</Td>
            <BoxCountCells c={l} />
            <Td>{fmtSigned(l.plusMinus)}</Td>
          </tr>
        ))}
        {dnp.length > 0 && (
          <tr>
            <Td numeric={false} colSpan={14} className="text-muted">
              Não jogaram: {dnp.map((l) => l.name).join(', ')}
            </Td>
          </tr>
        )}
      </tbody>
      {side.totals && (
        <tfoot className="bg-surface font-semibold">
          <tr>
            <StickyTh className="bg-surface">Total do time</StickyTh>
            <Td />
            <BoxCountCells c={side.totals} />
            <Td />
          </tr>
          <tr className="text-muted">
            <StickyTh className="bg-surface font-normal">Aproveitamento</StickyTh>
            <Td colSpan={7} />
            <Td>{fmtPct(fgPct(side.totals))}</Td>
            <Td>{fmtPct(fg3Pct(side.totals))}</Td>
            <Td>{fmtPct(ftPct(side.totals))}</Td>
            <Td colSpan={3} />
          </tr>
        </tfoot>
      )}
    </StatTable>
  );
}

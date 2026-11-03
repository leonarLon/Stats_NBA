import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/stats/loading';
import { Notice, PageHeader, TeamLink } from '@/components/stats/notices';
import { Abbr, StatTable, StickyTh, Td, Th } from '@/components/stats/table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { cn } from '@/lib/cn';
import { fmt1, fmtPct } from '@/lib/format';
import { parseEnumParam, parseSearchParam } from '@/lib/params';
import { toSearchName } from '@/server/domain/normalize';
import { PLAYER_SORT_KEYS, rankPlayers, type PlayerSeasonRow, type PlayerSortKey } from '@/server/stats/compute';
import { getPlayerSeasons } from '@/server/stats/queries';

export const metadata: Metadata = { title: 'Jogadores' };

const PAGE_SIZE = 50;

const COLUMNS: { key: PlayerSortKey; short: string; full: string; format: (r: PlayerSeasonRow) => string }[] = [
  { key: 'gp', short: 'J', full: 'Jogos disputados', format: (r) => String(r.gp) },
  { key: 'min', short: 'MIN', full: 'Minutos por jogo', format: (r) => fmt1(r.min) },
  { key: 'pts', short: 'PTS', full: 'Pontos por jogo', format: (r) => fmt1(r.pts) },
  { key: 'reb', short: 'REB', full: 'Rebotes por jogo', format: (r) => fmt1(r.reb) },
  { key: 'ast', short: 'AST', full: 'Assistências por jogo', format: (r) => fmt1(r.ast) },
  { key: 'stl', short: 'ROU', full: 'Roubos de bola por jogo', format: (r) => fmt1(r.stl) },
  { key: 'blk', short: 'TOC', full: 'Tocos por jogo', format: (r) => fmt1(r.blk) },
  { key: 'tov', short: 'ERR', full: 'Erros por jogo', format: (r) => fmt1(r.tov) },
  { key: 'fgPct', short: 'AR%', full: 'Aproveitamento nos arremessos de quadra', format: (r) => fmtPct(r.fgPct) },
  { key: 'fg3Pct', short: '3P%', full: 'Aproveitamento nas bolas de três', format: (r) => fmtPct(r.fg3Pct) },
  { key: 'ftPct', short: 'LL%', full: 'Aproveitamento nos lances livres', format: (r) => fmtPct(r.ftPct) },
  { key: 'tsPct', short: 'TS%', full: 'Aproveitamento real (true shooting, estimado)', format: (r) => fmtPct(r.tsPct) },
];

export default function PlayersPage({ searchParams }: PageProps<'/jogadores'>) {
  return (
    <>
      <PageHeader title="Jogadores" description="Médias por jogo na temporada regular. Clique no título de uma coluna para ordenar." />
      <Suspense fallback={<TableSkeleton rows={15} label="Carregando jogadores…" />}>
        {searchParams.then((sp) => (
          <Players
            sort={parseEnumParam(sp, 'ordem', PLAYER_SORT_KEYS) ?? 'pts'}
            query={parseSearchParam(sp, 'q')}
            all={parseEnumParam(sp, 'todos', ['1'] as const) === '1'}
          />
        ))}
      </Suspense>
    </>
  );
}

function href(sort: PlayerSortKey, query: string, all: boolean) {
  const p = new URLSearchParams();
  if (sort !== 'pts') p.set('ordem', sort);
  if (query) p.set('q', query);
  if (all) p.set('todos', '1');
  const s = p.toString();
  return s ? `/jogadores?${s}` : '/jogadores';
}

async function Players({ sort, query, all }: { sort: PlayerSortKey; query: string; all: boolean }) {
  const data = await getPlayerSeasons();
  if (!data || data.rows.length === 0) {
    return <EmptyState title="Nenhuma estatística ainda" description="As médias aparecem depois que os primeiros box scores forem processados." />;
  }

  const needle = toSearchName(query);
  // Na busca, mostra todos os jogadores encontrados, qualificados ou não
  const filtered = needle ? data.rows.filter((r) => toSearchName(r.name).includes(needle)) : data.rows;
  const ranked = rankPlayers(filtered, sort, !all && !needle);
  const shown = ranked.slice(0, PAGE_SIZE);
  const sortLabel = COLUMNS.find((c) => c.key === sort)!.full.toLowerCase();

  return (
    <div className="space-y-4">
      <form action="/jogadores" className="flex flex-wrap items-end gap-3" role="search">
        <div className="flex w-full flex-col gap-1 sm:w-72">
          <label htmlFor="busca" className="text-sm font-medium">
            Buscar jogador
          </label>
          <input
            id="busca"
            name="q"
            type="search"
            defaultValue={query}
            maxLength={40}
            autoComplete="off"
            className="min-h-10 rounded-lg border border-border bg-surface px-3 text-text placeholder:text-muted"
            placeholder="Nome ou sobrenome"
          />
        </div>
        {sort !== 'pts' && <input type="hidden" name="ordem" value={sort} />}
        {all && <input type="hidden" name="todos" value="1" />}
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
        {!needle && (
          <Link href={href(sort, '', !all)} className="min-h-10 content-center text-sm text-muted underline hover:text-text">
            {all ? 'Mostrar só qualificados' : 'Mostrar todos os jogadores'}
          </Link>
        )}
      </form>

      <p className="text-sm text-muted" role="status">
        {needle
          ? `${ranked.length} ${ranked.length === 1 ? 'jogador encontrado' : 'jogadores encontrados'} para “${query}”`
          : `${all ? 'Todos os jogadores' : 'Jogadores qualificados'}, ordenados por ${sortLabel}`}
        {ranked.length > PAGE_SIZE && ` (mostrando os ${PAGE_SIZE} primeiros)`}. Temporada {data.season}.
      </p>

      {shown.length === 0 ? (
        <EmptyState
          title={needle ? 'Nenhum jogador encontrado' : 'Nenhum jogador qualificado ainda'}
          description={needle ? 'Confira a grafia ou busque só pelo sobrenome.' : 'No início da temporada, use “Mostrar todos os jogadores”.'}
        />
      ) : (
        <StatTable label={`Jogadores ordenados por ${sortLabel}`}>
          <thead>
            <tr>
              <Th>#</Th>
              <Th numeric={false} className="sticky left-0 z-10">Jogador</Th>
              <Th numeric={false}>Time</Th>
              {COLUMNS.map((c) => (
                <Th key={c.key} aria-sort={c.key === sort ? 'descending' : undefined}>
                  <Link href={href(c.key, query, all)} className={cn('hover:text-text', c.key === sort && 'text-primary underline')}>
                    <Abbr short={c.short} full={c.full} />
                  </Link>
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.playerId}>
                <Td className="text-muted">{i + 1}</Td>
                <StickyTh>
                  <Link href={`/jogadores/${r.playerId}`} className="hover:text-primary hover:underline">
                    {r.name}
                  </Link>
                  {r.teamPartialGames > 0 && (
                    <sup className="ml-0.5 text-warning" title="Algum jogo do time tem box score parcial">
                      *
                    </sup>
                  )}
                </StickyTh>
                <Td numeric={false}>{r.team ? <TeamLink team={r.team} /> : '—'}</Td>
                {COLUMNS.map((c) => (
                  <Td key={c.key} className={c.key === sort ? 'font-semibold' : undefined}>
                    {c.format(r)}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </StatTable>
      )}

      <Notice>
        Qualificados: pelo menos 70% dos jogos do time; nos percentuais, também um mínimo de tentativas por jogo (5 arremessos,
        2 bolas de três, 1,5 lance livre). São critérios do STATS ALL IN, não os oficiais da NBA. * O time do jogador tem jogo
        com box score parcial na fonte; os totais podem estar abaixo do real.
      </Notice>
    </div>
  );
}

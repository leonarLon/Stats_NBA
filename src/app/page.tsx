import { ButtonLink } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/feedback';

const FEATURES = [
  { title: 'Jogadores', text: 'Médias da temporada, game log jogo a jogo, evolução recente e consistência.' },
  { title: 'Times', text: 'Campanha, desempenho em casa e fora, últimos jogos e ratings ofensivo e defensivo.' },
  { title: 'Partidas', text: 'Box score completo de cada jogo, com totais por time e destaques individuais.' },
  { title: 'Rankings', text: 'Líderes por estatística, com critérios mínimos de jogos para comparações justas.' },
  { title: 'Comparador', text: 'Coloque jogadores lado a lado na mesma temporada ou em temporadas diferentes.' },
  { title: 'Atualização automática', text: 'Os números são atualizados sozinhos depois que cada partida termina.' },
];

const PRINCIPLES = [
  'Todas as médias são calculadas a partir do box score de cada jogo, com fórmulas públicas.',
  'Percentuais usam a soma das tentativas da temporada, nunca a média dos percentuais.',
  'Estatísticas avançadas são marcadas como estimativas.',
  'Enquanto a temporada está em andamento, os números aparecem como parciais, com a data da última atualização.',
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
        <Badge>Temporada 2026-27</Badge>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-wide sm:text-6xl">
          Estatística de basquete, <span className="text-primary">explicada.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Jogadores, times, partidas e rankings da NBA em português, com cada número calculado de forma transparente e
          atualizado depois de cada jogo.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/#planos" size="lg">
            Teste grátis por 3 dias
          </ButtonLink>
          <ButtonLink href="/#recursos" size="lg" variant="secondary">
            Ver recursos
          </ButtonLink>
        </div>
      </section>

      <section id="recursos" aria-labelledby="recursos-titulo" className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 id="recursos-titulo" className="font-display text-3xl font-bold tracking-wide">
            Recursos
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <Card className="h-full">
                  <CardTitle>{f.title}</CardTitle>
                  <p className="mt-2 text-muted">{f.text}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="dados" aria-labelledby="dados-titulo" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 id="dados-titulo" className="font-display text-3xl font-bold tracking-wide">
            Como calculamos
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <li key={p} className="flex gap-3 rounded-lg border border-border p-4">
                <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-secondary" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="planos" aria-labelledby="planos-titulo" className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 id="planos-titulo" className="font-display text-3xl font-bold tracking-wide">
            Planos
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card className="flex flex-col gap-3 border-primary/60">
              <CardTitle>Teste grátis</CardTitle>
              <p className="tabular font-display text-4xl font-bold">
                R$ 0 <span className="text-base font-normal text-muted">por 3 dias</span>
              </p>
              <p className="text-muted">Acesso completo, sem cartão de crédito. Uma vez por conta.</p>
              <Badge className="self-start">Cadastro em breve</Badge>
            </Card>
            <Card className="flex flex-col gap-3">
              <CardTitle>Mensal</CardTitle>
              <p className="tabular font-display text-4xl font-bold">
                R$ 19,90 <span className="text-base font-normal text-muted">por mês</span>
              </p>
              <p className="text-muted">Acesso completo a todas as estatísticas e ao comparador.</p>
              <Badge className="self-start">Em breve</Badge>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}

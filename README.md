# STATS ALL IN

Estatísticas de jogadores, times e partidas da NBA em português, atualizadas automaticamente após cada jogo, com fórmulas públicas e acesso por cadastro (teste grátis de 3 dias; assinatura preparada, mas desligada).

> Projeto independente, sem afiliação com a NBA. Uso atual: **não comercial**.

## Estado atual

| Parte | Status |
|---|---|
| Documentação de arquitetura, fontes de dados e custos | Pronta |
| Modelo de dados (migrations SQL) | Aplicado no Supabase em 03/11/2026; RLS verificado |
| Fundação (config, erros, logs, cliente HTTP com limite por minuto, fórmulas, validações, contratos) | Implementada e testada |
| Landing page e design system | Implementados |
| Ingestão de dados reais | Implementada; migration 0004 aplicada e primeira ingestão real feita em 03/11/2026. Falta cadastrar os secrets no GitHub para o agendamento |
| Páginas de estatística | Jogos, box score, classificação, jogadores (ranking e busca), jogador, times e time. Exigem login com acesso ativo (Fase 6); sem Supabase, abrem em modo demonstração |
| Cadastro, login e teste grátis | Implementados (cadastro com confirmação de e-mail, login, nova senha, teste de 3 dias por botão, exclusão de conta). Falta configurar as URLs no Supabase e validar com e-mail real |
| Revisão de segurança | Feita em 03/11/2026: CSP, limite de tentativas, segredos, dependências ([SECURITY.md](SECURITY.md)) |
| Cobrança (Mercado Pago) | Preparada como contrato; desligada |

## Tecnologias

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) · Zod · Vitest · PGlite · Playwright.

## Pré-requisitos

- Node.js 24 ou mais recente
- npm 11

## Instalação

```bash
npm install
cp .env.example .env.local   # no Windows: copy .env.example .env.local
npm run dev                  # http://localhost:3000
```

Sem as variáveis do Supabase, o site sobe em **modo demonstração**: as páginas de estatística mostram times e jogadores fictícios, com aviso na tela e sem exigir login. Com o Supabase configurado, elas mostram os dados reais e exigem login com teste ou assinatura ativa.

## Variáveis de ambiente

Todas estão documentadas em [.env.example](.env.example). Regras:

- Só `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SITE_URL` vão para o navegador.
- `SUPABASE_SECRET_KEY`, chaves de API e do Mercado Pago ficam só no servidor.
- A chave da API-NBA deve ser criada em dashboard.api-football.com, **não** pelo RapidAPI (que cobra excedentes).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota do Next e roda o TypeScript |
| `npm test` | Testes unitários e de banco (Vitest + PGlite) |
| `npm run test:e2e` | Testes E2E em 390, 768 e 1440 px (Playwright + axe), sempre em modo demonstração. Na primeira vez: `npx playwright install chromium` |
| `npm run check` | lint + typecheck + testes |
| `npm run ingest:local -- schedule` | Calendário de ontem até +7 dias (exige `DATA_PROVIDER_MODE=live`) |
| `npm run ingest:local -- tick` | Status dos jogos + box scores pendentes |
| `npm run ingest:local -- backfill AAAA-MM-DD AAAA-MM-DD` | Calendário e placares de um intervalo (box score só para jogos dentro da janela da fonte) |

Os testes não usam rede nem credenciais: o banco roda em memória (PGlite) e os dados esportivos vêm do `FixtureProvider`.

## Páginas

| Rota | Conteúdo |
|---|---|
| `/jogos?data=AAAA-MM-DD` | Jogos do dia (data dos EUA), placar e situação do box score |
| `/jogos/[id]` | Box score com totais e aproveitamento dos times |
| `/classificacao` | Leste e Oeste, com casa/fora, últimos 10 e sequência |
| `/jogadores?ordem=pts&q=nome&todos=1` | Ranking por estatística, busca sem acento, filtro de qualificados |
| `/jogadores/[id]` | Médias da temporada e jogo a jogo |
| `/times` e `/times/[sigla]` | Médias e ratings; elenco, últimos e próximos jogos |
| `/entrar`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha` | Conta (públicas) |
| `/conta` | Situação do acesso, teste grátis, sair, excluir conta |
| `/planos` | Teste grátis e assinatura (em breve) |
| `/termos`, `/privacidade` | Textos legais |

## Deploy

Vercel (plano Hobby, permitido para uso não comercial). Configure as variáveis de ambiente no painel da Vercel. Antes de ativar cobrança, migrar para o plano Pro (ver [COST_ESTIMATE.md](COST_ESTIMATE.md)).

As migrations em `supabase/migrations/` já foram aplicadas. Arquivos aplicados não devem ser editados: qualquer mudança no banco vai em uma nova migration, aplicada só depois de aprovada.

## Documentação

- [ARCHITECTURE.md](ARCHITECTURE.md) — módulos, pipeline, modelo de dados, segurança
- [DATA_SOURCES.md](DATA_SOURCES.md) — fontes avaliadas, termos de uso, limites, contingência
- [COST_ESTIMATE.md](COST_ESTIMATE.md) — limites gratuitos e custos futuros
- [SECURITY.md](SECURITY.md) — revisão de segurança, cabeçalhos, limites e pendências
- [docs/STATS_FORMULAS.md](docs/STATS_FORMULAS.md) — fórmulas e regras de validação
- [docs/BRAND.md](docs/BRAND.md) — nome, identidade visual e tom de voz

## Limitações conhecidas

- Atualização 15 a 45 minutos após o fim do jogo (não é tempo real).
- A fonte gratuita não informa quem foi titular, então essa informação não aparece.
- O SMTP padrão do Supabase só entrega e-mails para membros da equipe do projeto e tem cota baixa. Antes de abrir o cadastro ao público, é preciso configurar um SMTP próprio.
- Quem exclui a conta e se cadastra de novo com o mesmo e-mail ganha outro teste grátis.
- Com a pasta do projeto no OneDrive, a pasta `.next` às vezes fica bloqueada e o build falha com `EPERM`. Basta apagar `.next` e rodar de novo.
- O plano gratuito da API-NBA só libera box scores de ontem, hoje e amanhã. Por isso as médias de 2026-27 começam em 02/11/2026 (início da coleta) e não há temporadas anteriores. Classificação e resultados cobrem a temporada inteira.
- Estatísticas avançadas são estimativas a partir do box score.
- O balldontlie não publica termos de uso; ele é usado só para status e placares, e o sistema funciona sem ele.

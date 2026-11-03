# Tabelinha

Estatísticas de jogadores, times e partidas da NBA em português, atualizadas automaticamente após cada jogo, com fórmulas públicas e acesso por cadastro (teste grátis de 3 dias; assinatura preparada, mas desligada).

> Projeto independente, sem afiliação com a NBA. Uso atual: **não comercial**.

## Estado atual

| Parte | Status |
|---|---|
| Documentação de arquitetura, fontes de dados e custos | Pronta |
| Modelo de dados (migrations SQL) | Aplicado no Supabase em 03/11/2026; RLS verificado |
| Fundação (config, erros, logs, cliente HTTP com limite por minuto, fórmulas, validações, contratos) | Implementada e testada |
| Landing page e design system | Implementados |
| Ingestão de dados reais | Pendente (Fase 4): chaves das APIs e banco já configurados e testados |
| Páginas de estatística | Pendente (Fase 5) |
| Cadastro, login e teste grátis | Pendente (Fase 6) |
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

Sem nenhuma variável preenchida, o site sobe normalmente e usa dados fictícios (`DATA_PROVIDER_MODE=fixture`).

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
| `npm run test:e2e` | Testes E2E em 390, 768 e 1440 px (Playwright + axe). Na primeira vez: `npx playwright install chromium` |
| `npm run check` | lint + typecheck + testes |

Os testes não usam rede nem credenciais: o banco roda em memória (PGlite) e os dados esportivos vêm do `FixtureProvider`.

## Deploy

Vercel (plano Hobby, permitido para uso não comercial). Configure as variáveis de ambiente no painel da Vercel. Antes de ativar cobrança, migrar para o plano Pro (ver [COST_ESTIMATE.md](COST_ESTIMATE.md)).

As migrations em `supabase/migrations/` já foram aplicadas. Arquivos aplicados não devem ser editados: qualquer mudança no banco vai em uma nova migration, aplicada só depois de aprovada.

## Documentação

- [ARCHITECTURE.md](ARCHITECTURE.md) — módulos, pipeline, modelo de dados, segurança
- [DATA_SOURCES.md](DATA_SOURCES.md) — fontes avaliadas, termos de uso, limites, contingência
- [COST_ESTIMATE.md](COST_ESTIMATE.md) — limites gratuitos e custos futuros
- [docs/STATS_FORMULAS.md](docs/STATS_FORMULAS.md) — fórmulas e regras de validação
- [docs/BRAND.md](docs/BRAND.md) — nome, identidade visual e tom de voz

## Limitações conhecidas

- Atualização 15 a 45 minutos após o fim do jogo (não é tempo real).
- Cota gratuita da API-NBA (100 requisições/dia) limita a carga de temporadas antigas (~20 dias por temporada).
- Estatísticas avançadas são estimativas a partir do box score.
- O balldontlie não publica termos de uso; ele é usado só para status e placares, e o sistema funciona sem ele.

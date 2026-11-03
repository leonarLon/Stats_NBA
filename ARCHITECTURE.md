# Arquitetura — STATS ALL IN

Última revisão: 02/11/2026. Status: **proposta para aprovação (Fase 2)**. Nada desta arquitetura foi criado no Supabase ainda.

**Escopo atual:** projeto **não comercial** (decisão de 02/11/2026). Sem funcionalidades de IA. A estrutura de assinaturas fica preparada no código, mas a cobrança só será ativada se o projeto passar a ser comercial (ver seção 12).

---

## 1. Visão geral

```
                    ┌─────────────────────────── Vercel (Hobby) ─────────────────────────────┐
 Navegador ───────► │ Next.js (App Router, TypeScript)                                       │
                    │  ├─ Páginas públicas: landing, planos, login, cadastro                │
                    │  ├─ Páginas restritas: dashboard, jogadores, times, jogos, rankings   │
                    │  │    (Server Components verificam sessão + acesso no servidor)       │
                    │  └─ Route Handlers: /api/billing/*, /api/webhooks/mp, /api/revalidate │
                    │                     │                                                  │
                    │            src/server/ (domínio, sem React)                            │
                    └─────────────────────┼──────────────────────────────────────────────────┘
                                          │
                       ┌──────────────────┼────────────────────┐
                       ▼                  ▼                    ▼
                Supabase Postgres    Supabase Auth       Mercado Pago
                + RLS + pg_trgm                          (preparado, desligado)
                       ▲
                       │ escrita (service role)
 ┌─────────────────────┴──────── GitHub Actions (cron) ────────────┐
 │ Worker de ingestão (Node, mesmo código de src/server/)           │
 │  balldontlie (status) ──► API-NBA (box score) ──► validação ──► │
 │  gravação ──► recálculo de agregados ──► revalidação das páginas │
 └──────────────────────────────────────────────────────────────────┘
```

## 2. Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Linguagem | TypeScript (strict) em tudo | Um só idioma; contratos tipados entre frontend, backend e worker |
| Web | Next.js 16 (App Router, Cache Components) | Renderização no servidor; proteção dos dados restritos no servidor; deploy nativo na Vercel |
| UI | Tailwind CSS + componentes próprios (padrão shadcn/ui, código copiado para o projeto) | Sem dependência de biblioteca visual pesada; acessibilidade via Radix |
| Gráficos | Recharts | Leve, componível, SVG acessível |
| Validação | Zod | Mesma validação em entradas HTTP, variáveis de ambiente e respostas dos provedores |
| Banco | Supabase Postgres + RLS + pg_trgm | Já definido; busca por nome com trigramas |
| Auth | Supabase Auth (e-mail e senha, verificação de e-mail, recuperação de senha) via `@supabase/ssr` | Sessão em cookie httpOnly, lida no servidor |
| Pagamentos | Mercado Pago — Assinaturas (preapproval) + webhooks | Decisão do usuário; **preparado, não ativado** |
| Agendamento | GitHub Actions cron | Gratuito; a Vercel Hobby só permite cron diário |
| Testes | Vitest (unidade/integração), PGlite (migrations e RLS em memória), Playwright (E2E, 390/768/1440 px, axe para acessibilidade) | Padrão do ecossistema; testes sem depender de serviços externos |

**Next.js 16 — diferenças que afetam o projeto:** o antigo `middleware.ts` agora se chama `proxy.ts`; o cache usa `'use cache'` + `cacheLife` + `cacheTag` (Cache Components ligado); leituras de sessão (cookies) precisam ficar dentro de `<Suspense>`; `revalidateTag` exige o segundo argumento (`'max'`); `error.tsx` recebe `retry()`. A documentação da versão instalada fica em `node_modules/next/dist/docs/`.

## 3. Estrutura de pastas

```
src/
  app/                    # rotas Next.js (somente UI e composição)
    page.tsx              # landing (pública)
    (stats)/              # jogos, classificacao, jogadores, times (acesso verificado nas consultas)
    (conta)/              # entrar, cadastro, recuperar-senha, redefinir-senha, conta
    (legal)/              # termos, privacidade
    planos/               # teste grátis e assinatura (em breve)
    auth/confirm/         # destino dos links de e-mail (confirmação e nova senha)
    api/                  # route handlers (revalidate; billing e webhooks na Fase 6)
  components/             # componentes visuais, sem regra de negócio
  server/                 # tudo que roda só no servidor
    domain/               # tipos e regras puras (fórmulas, validações)
    stats/                # leitura das estatísticas: leitores (Supabase/fictício), cálculos e consultas com cache
    providers/            # contratos e adaptadores (api-nba, balldontlie, fixture)
    ingestion/            # pipeline de sincronização
    billing/              # contrato PaymentGateway + adaptador Mercado Pago
    auth/                 # sessão, requireUser, requireAccess
    lib/                  # http client, erros, logger, config (env validado)
scripts/                  # entradas do worker (ingest, backfill, recompute)
supabase/migrations/      # SQL aplicado no Supabase (mudanças sempre em migration nova)
tests/                    # fixtures, unit, integration, db, e2e
```

`src/server/**` importa `server-only` para impedir uso acidental no navegador.

## 4. Responsabilidades dos módulos

| Módulo | Faz | Não faz |
|---|---|---|
| `domain` | Fórmulas, validações, tipos | I/O |
| `stats` | Ler o banco, montar os modelos de tela com as fórmulas de `domain`, verificar acesso e cachear (`queries.ts`) | Gravar no banco |
| `providers` | Falar com APIs externas, respeitar limites por minuto e converter para tipos de domínio | Gravar no banco |
| `ingestion` | Orquestrar status → box score → validação → gravação → agregados | Expor HTTP |
| `billing` | Checkout, cancelamento, verificação de webhook, máquina de estados da assinatura | Decidir acesso a dados (isso é `auth`) |
| `auth` | `requireUser()`, `requireAccess()` — a única porta para dados restritos | — |

## 5. Fluxo de dados esportivos (pipeline)

1. **Calendário** (diário): `ScheduleProvider.listGames(7 dias)` → upsert em `games` (`status = scheduled`) e `external_refs`.
2. **Status** (a cada 15 min na janela): para jogos com término previsto já passado e `status <> final`, consulta o status.
3. **Finalizado detectado:** `status = final`, cria a entrada em `game_sync_state` com `next_check_at = now()`.
4. **Box score:** `getPlayerGameStats()` e `getTeamGameStats()` da API-NBA (2 requisições por jogo, registradas em `provider_quota_usage`).
5. **Normalização:** conversão para `PlayerGameLine` (minutos para segundos, IDs externos para internos, criando jogadores novos).
6. **Classificação:** `classifyBoxScore()` ([docs/STATS_FORMULAS.md](docs/STATS_FORMULAS.md), seção 2.1) → `complete`, `partial` (jogadores faltando na fonte) ou `invalid` (dados contraditórios, não entra em agregado).
7. **Gravação idempotente** em uma transação: `hash(payload normalizado)` igual ao já gravado → nada muda. Diferente → `delete + insert` das linhas do jogo, `version + 1`.
8. **Totais do time** (`team_game_stats`) gravados a partir das estatísticas de time da fonte, que vieram corretas no teste real, e conferidos com o placar.
9. **Agregados:** recálculo de `player_season_stats` e `team_season_stats` **apenas** dos jogadores e times do jogo, e de `standings` da temporada.
10. **Frontend:** as consultas usam `'use cache'` com `cacheLife('minutes')` e `cacheTag`; o worker chama `/api/revalidate` (protegida por segredo), que executa `revalidateTag(tag, 'max')`.
11. **Histórico:** `sync_jobs` (uma linha por execução) e `sync_logs` (eventos). A sincronização só termina como `succeeded` se o número de linhas gravadas for igual ao recebido e as validações por jogo passarem.

**Reconciliação:** só para jogos `partial` (os `complete` não gastam cota). `game_sync_state.reconcile_stage` avança 24h → 72h → 7 dias após o fim do jogo. Ao reprocessar, se o hash mudou, os passos 7–10 rodam de novo. Depois da 3ª tentativa, o jogo fica `partial` em definitivo.

**Gravação:** toda escrita da ingestão passa por funções SQL ([supabase/migrations/20261103000004_ingestion.sql](supabase/migrations/20261103000004_ingestion.sql)) chamadas via RPC com a chave secreta. Cada função é atômica, e nenhuma pode ser executada por `anon`/`authenticated`. Os testes rodam o pipeline inteiro contra essas mesmas funções num Postgres em memória.

**Concorrência:** trava com prazo na tabela `job_locks` (15 min). Duas execuções simultâneas não processam o mesmo jogo; uma trava esquecida expira sozinha. O workflow também usa `concurrency` do GitHub Actions.

**Retentativas:** erros de rede e 5xx: até 3 tentativas com backoff exponencial dentro do job; depois, `game_sync_state.next_check_at` é reagendado (15 min, 30 min, 1h, 2h, 6h…) até 72h.

**Limites dos provedores:** o cliente HTTP de cada provedor respeita o limite por minuto (API-NBA: 10/min; balldontlie: 5/min) com uma fila local. Os termos da API-Sports tratam o desrespeito ao limite por minuto como violação grave, passível de bloqueio da conta.

## 6. Modelo de dados

SQL completo em [supabase/migrations/](supabase/migrations/) — **aplicado no Supabase em 03/11/2026**.

### 6.1. Esportes

| Tabela | Conteúdo | Chave | Índices principais |
|---|---|---|---|
| `data_providers` | Fontes cadastradas | `id`; `slug` único | — |
| `external_refs` | Mapeamento ID externo ↔ ID interno, por provedor e tipo de entidade | `(provider_id, entity_type, external_id)` único | `(entity_type, entity_id)` |
| `seasons` | Temporadas (`start_year` 2026 = "2026-27") | `id`; `start_year` único | Uma única com `is_current` |
| `teams` | Equipes | `id`; `abbreviation` único | — |
| `players` | Jogadores, `search_name` normalizado (sem acento, minúsculo) | `id` | GIN trigram em `search_name` |
| `games` | Data, horário, times, placar, status, tipo de temporada, `payload_hash`, `version`, `stats_status` | `id` | `(game_date)`, `(season_id, season_type)`, `(status, starts_at)` |
| `game_sync_state` | Fila de processamento de cada jogo (tentativas, próxima checagem, reconciliação) | `game_id` | `(next_check_at)` parcial |
| `player_game_stats` | Box score por jogador por jogo. Inclui `season_id`, `season_type` e `game_date` desnormalizados para consultas rápidas de game log | `(game_id, player_id)` | `(player_id, game_date desc)`, `(season_id, season_type)` |
| `team_game_stats` | Totais do time por jogo, posses estimadas, vitória | `(game_id, team_id)` | `(team_id, game_date desc)` |
| `player_season_stats` | Totais por jogador, temporada e tipo; GP, GS, DD, TD, `is_complete` | `(player_id, season_id, season_type)` | `(season_id, season_type)` |
| `team_season_stats` | Totais e V/D por time, temporada e tipo | `(team_id, season_id, season_type)` | — |
| `standings` | Classificação calculada (conferência, posição, GB, sequência, últimos 10) | `(season_id, team_id)` | — |
| `sync_jobs`, `sync_logs` | Execuções e eventos | `id` | `(status, started_at)` |
| `provider_quota_usage` | Requisições por provedor por dia (UTC) | `(provider_id, usage_date)` | — |

Médias por jogo são **views** (`player_season_averages`, `team_season_averages`) sobre as tabelas de totais, com `security_invoker` para respeitar o RLS.

### 6.2. Usuários e assinaturas

| Tabela | Conteúdo |
|---|---|
| `profiles` | 1:1 com `auth.users`; nome, time favorito, `trial_started_at`, aceite dos termos |
| `plans` | Planos (preço em centavos, intervalo, ID do plano no Mercado Pago) |
| `subscriptions` | Status, período vigente, fim do teste, ID da assinatura no Mercado Pago |
| `payment_events` | Todo webhook recebido; `(provider, provider_event_id)` único garante idempotência |
| `payment_transactions` | Pagamentos confirmados ou recusados, valor, método, data |
| `audit_logs` | Ações sensíveis (mudança de status de assinatura, reprocessamento manual, exclusão de conta) |

### 6.3. Segurança no banco (RLS)

| Grupo | Leitura | Escrita |
|---|---|---|
| Esportes | Usuário autenticado **com acesso ativo** (`public.has_active_access()`) | Somente service role (worker) |
| `plans` | Qualquer pessoa (planos ativos) | Somente service role |
| `profiles` | Próprio usuário | Próprio usuário (só `display_name`, `favorite_team_id`, `terms_accepted_at`) |
| `subscriptions`, `payment_transactions` | Próprio usuário | Somente service role (servidor) |
| `payment_events`, `sync_*`, `external_refs`, `audit_logs`, `provider_quota_usage`, `game_sync_state`, `data_providers` | Ninguém (só service role) | Somente service role |

A aplicação **não** depende só do RLS: as consultas de estatística (`src/server/stats/queries.ts`) chamam `requireAccess()` no servidor antes de ler. Como os números são iguais para todos os usuários, a leitura em si usa a chave secreta dentro de um cache compartilhado (`'use cache'`), e as funções que leem não são exportadas: nada chega a elas sem passar pela verificação. O RLS protege o acesso direto ao banco com a chave publicável.

## 7. Autenticação

- Supabase Auth com e-mail e senha, **verificação de e-mail obrigatória**, recuperação de senha por e-mail.
- Sessão em cookies httpOnly via `@supabase/ssr`; o `src/proxy.ts` (antigo middleware) só renova o token. **A decisão de acesso é feita no servidor, perto dos dados**, com `supabase.auth.getClaims()`, que valida a assinatura do token (nunca confia apenas no cookie).
- Formulários com Server Actions (`src/server/auth/actions.ts`): validação Zod no servidor, mensagens em português, nenhuma resposta revela se um e-mail está cadastrado, destino pós-login restrito a caminhos internos (`safeNextPath`).
- Links de e-mail chegam em `/auth/confirm`, que aceita `?code=` (modelo padrão do Supabase, mesmo navegador) e `?token_hash=&type=` (modelo ajustado, qualquer navegador).
- **Teste grátis:** iniciado por botão em `/planos` ou `/conta`, depois do login, pela função `start_trial` (uma vez por conta). Assim os 3 dias começam quando a pessoa quer usar, não no cadastro.
- **Exclusão de conta** em `/conta`: apaga o usuário do Auth; perfil, assinaturas e pagamentos saem em cascata.
- Logout invalida a sessão no Supabase e limpa os cookies.
- O SMTP padrão do Supabase Free tem cota baixa de e-mails e serve só para testes. Antes de abrir o site ao público, será preciso configurar um SMTP próprio (há opções gratuitas com cota limitada; a decidir na Fase 6).

## 8. Acesso e assinaturas

### 8.1. Enquanto o projeto for não comercial

O acesso funciona por **cadastro + teste de 3 dias**, com a mesma regra de acesso do banco. A cobrança fica **desligada** por variável de ambiente (`BILLING_ENABLED=false`): a página de planos mostra o preço provisório como "em breve" e não abre checkout.

O teste de 3 dias é mantido como funcionalidade do produto (decisão 8, seção 12).

### 8.2. Planos (provisórios)

| Plano | Preço | Acesso |
|---|---|---|
| Teste grátis | R$ 0 por **3 dias**, uma vez por conta, sem cartão | Completo |
| Mensal | **R$ 19,90/mês** (provisório; cobrança desligada) | Completo |

### 8.3. Estados da assinatura

| Status | Significado | Tem acesso? |
|---|---|---|
| `trialing` | Em teste | Sim, até `trial_ends_at` |
| `pending` | Checkout iniciado, pagamento não confirmado | Não |
| `incomplete` | Checkout abandonado ou recusado | Não |
| `active` | Pagamento confirmado por webhook | Sim, até `current_period_end` |
| `past_due` | Cobrança da renovação falhou; Mercado Pago está tentando de novo | Sim, até `current_period_end` (período já pago) |
| `canceled` | Usuário cancelou | Sim, até `current_period_end` (período já pago) |
| `expired` | Período terminou sem pagamento | Não |

A regra fica em uma única função SQL, `public.user_has_access(uuid)` (só service role). O RLS usa `public.has_active_access()`, que aplica a mesma regra apenas ao usuário logado; o servidor chama `requireAccess()`, que consulta a mesma função. O teste grátis e uma assinatura paga podem coexistir: quem assina durante o teste não perde os dias restantes.

### 8.4. Fluxo comercial (para quando a cobrança for ativada)

1. Visitante vê landing e planos (públicos).
2. Cria a conta e confirma o e-mail → pode iniciar o **teste de 3 dias** com um clique (`trialing`).
3. Para assinar: servidor cria a assinatura no Mercado Pago (`pending`) e redireciona ao checkout.
4. Mercado Pago chama o **webhook**. O servidor:
   - valida a assinatura HMAC (`x-signature`) com o segredo do webhook;
   - grava o evento em `payment_events` (se o `id` já existe, responde 200 e para);
   - **consulta o recurso na API do Mercado Pago** (nunca confia só no corpo do webhook);
   - atualiza `subscriptions` e `payment_transactions` e registra em `audit_logs`.
5. A página de retorno do checkout apenas mostra "confirmando pagamento" e consulta o status no servidor. **O retorno do navegador não libera acesso.**
6. Renovação, falha, cancelamento e expiração chegam pelos mesmos webhooks. Um job diário também marca como `expired` as assinaturas com período vencido, caso algum webhook se perca.

Tudo será testado no **ambiente de testes (sandbox)** do Mercado Pago, sem dinheiro real. A confirmar na Fase 6: disponibilidade de Pix em assinaturas recorrentes e o formato exato da validação de assinatura do webhook.

## 9. Cache

| O quê | Como | Invalidação |
|---|---|---|
| Páginas de estatística | `'use cache'` + `cacheLife('minutes')` + `cacheTag('stats')` nas funções internas de `stats/queries.ts`. A página entrega a casca estática na hora e o conteúdo chega por streaming, dentro de `<Suspense>` | `revalidateTag('stats', 'max')` via `/api/revalidate` (Bearer `REVALIDATE_SECRET`), chamado pelo worker quando grava algo novo. Sem o aviso, o `cacheLife` atualiza em minutos |
| Rankings e líderes | Lidos de tabelas de totais já agregadas | Recalculadas na ingestão |

## 10. Segurança

- Segredos (`SUPABASE_SECRET_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `APISPORTS_KEY`, `BALLDONTLIE_KEY`, `REVALIDATE_SECRET`) só em variáveis **sem** prefixo `NEXT_PUBLIC_`, lidas apenas em `src/server/lib/config.ts`, validadas com Zod na inicialização.
- No navegador: apenas `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (públicas por design; protegidas pelo RLS).
- Entradas validadas com Zod em todas as rotas e parâmetros de URL.
- Rate limiting nas rotas de auth (proteção nativa do Supabase Auth) e nas rotas de billing.
- Webhooks: assinatura HMAC, idempotência e consulta de confirmação à API.
- Cabeçalhos: CSP, `X-Frame-Options`, `Referrer-Policy`, HSTS (via `next.config`).
- Logs estruturados em JSON, sem e-mail, senha, tokens ou dados de cartão.
- LGPD: política de privacidade e termos; exclusão de conta apaga dados pessoais (cascade).
- Sem logos, fotos ou marcas da NBA e dos times (os termos da API-Sports deixam o licenciamento dessas imagens por conta do usuário).

## 11. Escalabilidade

- Consultas sempre paginadas e filtradas por temporada; nenhuma rota lê o histórico inteiro.
- Agregados pré-calculados; recálculo incremental só dos afetados.
- Índices definidos pelos padrões de acesso (game log por jogador, jogos por data, ranking por temporada).
- Se a carga crescer: mover o worker para uma fila dedicada e o banco para o plano pago, sem mudar o código de domínio.

## 12. Registro de decisões

| # | Decisão | Alternativas consideradas | Motivo |
|---|---|---|---|
| 1 | Somente fontes gratuitas: API-NBA + balldontlie | NBA.com, ESPN, Basketball-Reference (termos proíbem); APIs pagas (regra do projeto) | Decisão do usuário; termos da API-Sports lidos em 02/11/2026 (ver [DATA_SOURCES.md](DATA_SOURCES.md)) |
| 2 | Agregados calculados por nós | Usar médias prontas das fontes | Não existem nos planos gratuitos; garante fórmulas consistentes e documentadas |
| 3 | GitHub Actions como agendador | Vercel Cron (Hobby: diário), Supabase pg_cron + Edge Function (Deno) | Gratuito, roda Node sem limite curto de tempo, reaproveita o mesmo código |
| 4 | Vercel Hobby | Vercel Pro, Cloudflare | Projeto não comercial por enquanto; o Hobby é permitido para uso pessoal e não comercial. **Se o projeto passar a cobrar, migrar para o Pro antes.** |
| 5 | Teste sem cartão, controlado por nós | Teste nativo do Mercado Pago (exige cartão) | Menos atrito; um teste por conta |
| 6 | Sem funcionalidades de IA | Gemini gratuito (dados usados para treino), Claude (pago) | Decisão do usuário em 02/11/2026 |
| 7 | Cobrança preparada mas desligada | Remover billing | O projeto pode virar comercial; a estrutura fica pronta e testada em sandbox |

| 8 | Teste grátis de 3 dias mantido mesmo sem cobrança | Liberar acesso a qualquer cadastrado | Decisão do usuário (03/11/2026): o teste é funcionalidade do produto e serve para demonstrações a interessados no projeto |
| 9 | Box scores incompletos gravados como `partial` | Descartar jogos incompletos; medir antes de decidir | Decisão do usuário (03/11/2026) após teste real mostrar jogadores faltando na API-NBA gratuita |
| 10 | Estatísticas lidas com a chave secreta em cache compartilhado, depois de `requireAccess()` | Ler com a sessão do usuário (RLS) a cada visita | Os dados são iguais para todos; um cache por usuário multiplicaria as consultas ao banco gratuito. Segue o padrão de camada de acesso a dados da documentação do Next.js |
| 11 | Modo demonstração com dados fictícios quando o Supabase não está configurado | Exigir credenciais para rodar o site | Desenvolvimento e testes E2E sem banco nem login; os dados são inventados e a página avisa |
| 12 | Teste grátis começa por botão, não no cadastro | Iniciar automaticamente na confirmação do e-mail | Quem se cadastra para conhecer o projeto escolhe quando gastar os 3 dias |

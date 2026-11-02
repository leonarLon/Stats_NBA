# Fase 1 — Diagnóstico

Data da pesquisa: 02/11/2026. Preços e termos consultados nesta data; confirme antes de contratar qualquer serviço.

---

## 1. Inventário do repositório

| Item | Estado |
|---|---|
| Arquivos de código | Nenhum |
| README.md, CLAUDE.md, AGENTS.md | Não existem |
| package.json, lockfile | Não existem |
| Git | Repositório iniciado, branch `main`, **sem commits** |
| Remoto | `origin` → `https://github.com/leonarLon/Stats_NBA.git` |
| Ferramentas locais | Node v24.22.1, npm 11.19.1, Python 3.13.2, Git 2.44 |

**Conclusão:** o projeto começa do zero. Não há funcionalidades nem padrões existentes para reaproveitar.

---

## 2. Análise dos concorrentes

Os 5 sites foram acessados. A análise se limita ao conteúdo público das páginas iniciais; áreas logadas e pagas não foram avaliadas.

| Referência | Funcionalidades | Diferenciais | Oportunidades de melhoria |
|---|---|---|---|
| **NBA Stats** (nba.com/stats) | Estatísticas tradicionais, avançadas, tracking, hustle, clutch, play types, lineups, box scores, líderes. Temporadas desde 1996-97. | Fonte oficial. Filtros extremamente granulares (temporada, segmento, per mode, situação de jogo, adversário, posição etc.). | Interface densa e técnica, voltada a especialistas. Sem comparador direto de jogadores. Sem explicações em linguagem natural. Somente em inglês. |
| **GlasslyStats** | Placar ao vivo, play-by-play, box scores, líderes, páginas de jogadores e times, comparações, "Pair Effect" (desempenho do time com e sem um jogador). | Modelo freemium claro: dia de jogo grátis, análises no Pro (teste de 7 dias). Web + apps. | Preço não aparece no site. Recursos voltados a apostas (odds, previsões). Sem IA explicativa. |
| **Hoopology** | Calendário da temporada, box scores, four factors, scatter plots, dashboards, dados de tracking/hustle/defesa/zonas de arremesso. Exportação de gráficos. | Qualquer estatística pode ser recalculada para **qualquer intervalo de datas**. | Sem modelo comercial visível. Navegação centrada em calendário, pouco amigável para iniciantes. |
| **PLVYOFF** | Jogos do dia com ratings ofensivo/defensivo, líderes do dia, sequências de vitórias, filtros, "Scenario Builder", favoritos, previsões. | Foco no dia a dia e em cenários de playoffs. | Recursos premium e preços não descritos. Linhas de aposta misturadas com estatística. |
| **StatsPads** | Comparador de jogadores e times com gráfico radar, líderes, escalações, corridas de MVP e Calouro do Ano, classificação, lesões, blog, alertas por time. | Gratuito, simples, com bom comparador visual. | Sem aprofundamento avançado. Sem modelo pago. Sem IA. |

### Lacunas que viram oportunidade para o produto

1. **Nenhum concorrente analisado oferece perguntas em linguagem natural** com respostas fundamentadas em dados e com fontes citadas. Esse é o diferencial central.
2. **Nenhum está em português.** O público brasileiro de NBA é grande e mal atendido.
3. Recortes por intervalo arbitrário (ideia do Hoopology) combinados com comparação visual (ideia do StatsPads) são uma combinação forte.
4. Explicar estatísticas avançadas de forma didática (o que significa TS%, USG% etc.) é um espaço livre.

---

## 3. Fontes de dados esportivos — **ponto bloqueante**

### 3.1. Resultado da pesquisa

| Fonte | Custo | Dados | Autenticação / limites | Uso comercial | Riscos |
|---|---|---|---|---|---|
| **NBA.com / stats.nba.com** (via biblioteca `nba_api`, licença MIT) | Grátis | Completos: box scores, game logs, play-by-play, tracking, histórico desde 1996-97. Dados ao vivo via cdn.nba.com. | Sem chave. Throttling. **Não responde a muitas faixas de IP de nuvem** (documentado no `nba_api`). Endpoints não documentados podem mudar sem aviso. | **Proibido.** Os termos limitam o uso a fins "pessoais e não comerciais" e vetam o uso em "qualquer site, produto ou serviço que apresente um banco de dados" de estatísticas atualizadas regularmente sem consentimento prévio. Também vetam uso em apostas e fantasy. | Violação de termos, bloqueio de IP, quebra de endpoints. |
| **ESPN** (API não oficial site.api.espn.com) | Grátis | Placar, resumo, box score. | Sem documentação oficial; engenharia reversa. | **Proibido.** Os termos da Disney (que cobrem a ESPN) vetam acesso automatizado, "data mining", criar coleções de dados e uso comercial, além de vetar uso para IA. | Violação de termos, mudanças sem aviso. |
| **Basketball-Reference** (Sports Reference) | Grátis | Histórico profundo. | Rate limit (relatado por terceiros em ~20 req/min; não confirmado no site oficial). | **Proibido para este produto.** Os termos (versão de 17/04/2026) vetam acesso automatizado sem permissão, uso para criar banco de dados ou serviço concorrente, e uso para "treinar, fazer prompting ou instruir modelos de IA" ou "gerar respostas, estatísticas". | Violação de termos. |
| **balldontlie** | Free: US$ 0. All-Star: US$ 9,99/mês. GOAT: US$ 39,99/mês. | **Free:** só times, jogadores e jogos (placar). **All-Star:** + estatísticas por jogador por partida, lesões. **GOAT:** + médias, box scores, ao vivo, classificação, estatísticas avançadas, play-by-play. | Chave de API obrigatória. Free 5 req/min; All-Star 60; GOAT 600. | **Não verificado.** A página de termos não carregou e a documentação não trata de uso comercial. Precisa ser confirmado diretamente com eles. | Fornecedor pequeno; dependência de terceiro. |
| **Datasets públicos** (Kaggle, ex.: `wyattowalsh/basketball`) | Grátis | Histórico. | Download manual. | Licença não confirmada. O dataset citado é extraído do stats.nba.com, então herda as restrições da NBA. | Não atualiza após cada jogo. |
| **Provedores licenciados** (Sportradar, SportsDataIO etc.) | Pagos, geralmente caros | Completos, com licença comercial. | Contrato. | Permitido mediante contrato. | Custo. Não pesquisei preços porque violam a regra "sem APIs pagas". |

### 3.2. Conclusão honesta

**Não encontrei nenhuma fonte gratuita que permita legalmente uso comercial dos dados da NBA com atualização após cada partida.** As fontes gratuitas com dados completos (NBA.com, ESPN, Basketball-Reference) proíbem explicitamente o tipo de produto proposto. A única fonte gratuita com termos possivelmente compatíveis (balldontlie Free) **não fornece estatísticas de jogadores**, apenas placares.

As regras "sem APIs pagas" e "produto comercial por assinatura" são incompatíveis entre si com as fontes disponíveis hoje. **Essa é a principal decisão que depende de você** (seção 12).

### 3.3. Opções

| Opção | Custo dos dados | Legalidade comercial | Observação |
|---|---|---|---|
| **A. balldontlie All-Star** | US$ 9,99/mês | A confirmar com o fornecedor | Estatísticas por jogador por partida bastam: médias, rankings, classificação, estatísticas de time e indicadores avançados básicos podem ser **calculados por nós** a partir dos box scores, de forma determinística. |
| **B. balldontlie GOAT** | US$ 39,99/mês | A confirmar | Adiciona box scores ao vivo, classificação oficial, estatísticas avançadas e 600 req/min. Útil para conferir nossos cálculos. |
| **C. NBA.com via `nba_api`** | Grátis | **Viola os termos** | Só seria aceitável para protótipo pessoal e não comercial. Não recomendo para o produto. |
| **D. Pedir licença à NBA ou a um provedor licenciado** | Negociação | Sim | Caminho mais seguro em escala, porém mais caro e lento. |

**Recomendação:** começar com a **opção A**, depois de obter do balldontlie uma confirmação por escrito de que o uso comercial com exibição a assinantes é permitido. O desenvolvimento roda com fixtures e o plano gratuito, sem custo, até o lançamento.

Independentemente da escolha, a arquitetura terá uma camada de provedores (`SportsDataProvider`) para que a troca de fonte não exija reescrever o produto.

---

## 4. Viabilidade da atualização automática

Viável, com as ressalvas abaixo.

**Estratégia proposta (polling incremental):**

1. Uma vez por dia, sincroniza o calendário dos próximos 7 dias (`games` com status `scheduled`).
2. Durante a janela de jogos (aprox. 19h às 3h no horário de Brasília, configurável), consulta a cada **10 minutos** somente os jogos do dia que ainda não estão finalizados.
3. Quando um jogo muda para `final`, busca as estatísticas, valida, grava e recalcula os agregados afetados.
4. **Reconciliação:** cada jogo finalizado é reprocessado em T+6h, T+24h e T+72h para capturar correções oficiais da NBA. Se o hash do payload mudar, gera uma nova versão e recalcula.
5. Toda execução registra `sync_jobs` e `sync_logs`. A sincronização só é marcada como concluída depois de conferir que o número de linhas gravadas bate com o recebido e que as somas dos jogadores batem com o placar do time.

**Limitações:**
- Não é tempo real. O atraso esperado entre o fim do jogo e a atualização é de 10 a 20 minutos, mais o atraso da própria fonte.
- No plano Free do balldontlie (5 req/min), uma rodada com 15 jogos já usa a cota de 3 minutos. Por isso o plano pago é necessário em produção.
- **Agendador:** Supabase `pg_cron` disparando uma Edge Function, ou GitHub Actions com cron. A disponibilidade de `pg_cron` em cada plano não foi confirmada na página de preços e será verificada na Fase 2.

---

## 5. Arquitetura recomendada

```
[Navegador] ── Next.js (App Router, TypeScript) ──────────────┐
                 │ Server Components / Route Handlers          │
                 │  • valida sessão e assinatura no servidor   │
                 ▼                                             │
        Camada de domínio (TS puro)                            │
        stats · players · teams · games · subscriptions · ai   │
                 │                                             │
   ┌─────────────┼──────────────┬──────────────┐               │
   ▼             ▼              ▼              ▼               │
Supabase     Provedores      Gateway de     Provedor LLM       │
Postgres     esportivos      pagamento      (interface)        │
+ Auth       (interface)     (interface)    + RAG (pgvector)   │
+ RLS            ▲                                              │
+ pgvector       │                                              │
             Worker de ingestão (agendado) ◄────────────────────┘
```

| Decisão | Escolha | Justificativa |
|---|---|---|
| Linguagem | TypeScript em todo o projeto | Um só idioma para frontend, backend e worker. Contratos tipados entre módulos. |
| Framework web | Next.js | SSR e rotas de servidor no mesmo projeto. A proteção dos dados premium fica no servidor. |
| Banco, auth, vetores | Supabase (Postgres, Auth, RLS, pgvector) | Já definido por você. Cobre autenticação, RLS e vetores sem serviços extras. |
| Ingestão | Worker TypeScript separado, chamando a mesma camada de domínio | Pode rodar em Edge Function, GitHub Actions ou servidor sem mudar a lógica. |
| Testes | Vitest (unidade e integração) e Playwright (E2E e viewports 390/768/1440) | Padrão do ecossistema. Testes com fixtures e um `FixtureProvider`, sem depender de API externa. |
| Gráficos | Recharts ou similar (a decidir na Fase 3) | Leve e acessível. |

**Contratos principais (interfaces):**
- `SportsDataProvider`: `listTeams`, `listPlayers`, `listGames(range)`, `getGameStatus`, `getPlayerGameStats(gameId)`, `getSeasons`.
- `PaymentGateway`: `createCheckout`, `cancelSubscription`, `verifyWebhook`, `parseEvent`.
- `LlmProvider`: `chat(messages, tools)`, com suporte a tool use.
- `EmbeddingProvider`: `embed(texts)`.

---

## 6. Modelo de dados proposto (para revisão; nada será criado no Supabase sem sua autorização)

**Domínio esportivo**

| Tabela | Responsabilidade | Chaves e restrições principais |
|---|---|---|
| `data_providers` | Cadastro das fontes | `slug` único |
| `seasons` | Temporadas (ex.: 2026-27) | `year` único |
| `teams` | Equipes | `(provider_id, external_id)` único |
| `players` | Jogadores | `(provider_id, external_id)` único |
| `games` | Partidas, status, placar, `payload_hash`, `version` | `(provider_id, external_id)` único; índice em `(game_date, status)` |
| `player_game_stats` | Box score por jogador por jogo (fonte da verdade estatística) | PK `(game_id, player_id)`; `CHECK` para valores ≥ 0 e convertidos ≤ tentados |
| `team_game_stats` | Totais do time por jogo (calculados e conferidos com o placar) | PK `(game_id, team_id)` |
| `player_season_stats` | Agregados materializados por temporada e tipo (regular/playoffs) | PK `(player_id, season_id, season_type)`; flag `is_complete` |
| `team_season_stats`, `standings` | Agregados de time e classificação calculada | — |
| `sync_jobs`, `sync_logs` | Execuções, status, contagens, erros | Índice em `(status, started_at)` |

**Usuários e monetização**

| Tabela | Responsabilidade |
|---|---|
| `profiles` | Dados do usuário (1:1 com `auth.users`) |
| `plans` | Planos e limites (ex.: perguntas de IA por mês) |
| `subscriptions` | Status (`pending`, `active`, `past_due`, `canceled`, `expired`, `incomplete`), período vigente, ID externo do gateway |
| `payment_events` | Webhooks recebidos; `event_id` único garante idempotência |
| `usage_counters` | Uso de IA por usuário e período |
| `audit_logs` | Ações sensíveis |

**IA**

| Tabela | Responsabilidade |
|---|---|
| `ai_conversations`, `ai_messages` | Histórico de conversas; mensagens guardam as chamadas de ferramenta e as fontes usadas |
| `knowledge_documents` | Documentos indexáveis, com `content_hash` e `source_type` |
| `document_chunks` | Trechos com `embedding vector(N)`, metadados (jogador, time, temporada) e índice HNSW |

**RLS (resumo):** dados esportivos podem ser lidos apenas por usuários com assinatura ativa, via função `has_active_subscription()`. `profiles`, `ai_*` e `usage_counters` ficam isolados por `user_id = auth.uid()`. Escrita em tabelas esportivas, `subscriptions` e `payment_events` somente pela service role, no servidor.

O modelo detalhado (tipos, índices, migrations SQL) será entregue na Fase 2 para aprovação.

---

## 7. Estratégia de LLM e RAG

**Princípio:** a LLM não calcula números. Ela escolhe ferramentas, o backend executa SQL determinístico e a LLM explica o resultado.

**Ferramentas expostas ao modelo** (todas validadas por schema e executadas com as permissões do usuário):
`search_player`, `search_team`, `get_player_season_stats`, `get_player_game_log(last_n | date_range)`, `compare_players`, `get_leaders(stat, season, min_games)`, `get_team_recent_form`, `get_standings`, `get_game_box_score`, `search_knowledge`.

**RAG — onde faz sentido de verdade:** a maior parte das perguntas é respondida melhor por consultas estruturadas do que por busca vetorial. O RAG ficará para conteúdo textual:
- Resumos de partidas gerados a partir dos próprios box scores (e regenerados quando o jogo é corrigido).
- Glossário e fórmulas das estatísticas (documentação interna).
- Contexto de jogadores a partir de fontes licenciadas, se houver.

**Embeddings:** como as perguntas serão em português, o modelo `gte-small` embutido no Supabase não serve (é só inglês e corta em 512 tokens). Alternativa: `gemini-embedding-001` (US$ 0,15 por 1M tokens; o volume previsto custa centavos por mês). Reindexação somente quando o `content_hash` muda.

**Rastreabilidade:** cada resposta mostra blocos separados de "Dados oficiais consultados" (com a ferramenta e os parâmetros usados), "Contexto recuperado" e "Interpretação da IA".

**Segurança:** o conteúdo recuperado vai sempre como dado, nunca como instrução. Limite de perguntas por plano, validação de entrada, timeout e logs sem dados pessoais.

### Comparação de provedores de LLM (preços por 1M tokens)

| Modelo | Entrada | Saída | Plano gratuito | Observação |
|---|---|---|---|---|
| Claude Haiku 5.5 | US$ 0,10 | US$ 0,50 | Não | Prompts até 100K tokens; acima disso, US$ 0,50 / US$ 2,50. Bom em tool use. |
| Claude Sonnet 5.5 | US$ 2,00 | US$ 10,00 | Não | Qualidade maior, cerca de 20× o custo. |
| Gemini 2.5 Flash-Lite | US$ 0,10 | US$ 0,40 | Sim | **No plano gratuito, os dados são usados pelo Google para melhorar produtos.** Inaceitável para conversas de clientes pagantes. |
| Gemini 3.1 Flash-Lite | US$ 0,25 | US$ 1,50 | Sim (mesma ressalva) | — |

**Recomendação:** Gemini gratuito somente em desenvolvimento, com dados de teste. Em produção, **Claude Haiku 5.5** como padrão, com possibilidade de usar Sonnet 5.5 em relatórios longos. Custo estimado por pergunta com Haiku 5.5 (~4.000 tokens de entrada e ~500 de saída): **cerca de US$ 0,00065**. Depende da sua aprovação.

---

## 8. Assinatura e monetização

**Fluxo:** landing page → planos → cadastro (Supabase Auth com verificação de e-mail) → checkout no gateway → **webhook** confirma o pagamento → `subscriptions.status = active` → acesso liberado. O retorno do navegador após o checkout apenas mostra "processando"; não libera nada.

**Gateways (taxas públicas consultadas em 02/11/2026):**

| Gateway | Cartão | Pix | Recorrência | Custo fixo | Observação |
|---|---|---|---|---|---|
| **Stripe Brasil** | 3,99% + R$ 0,39 | 1,19% (**somente por convite**) | Sim (Billing +0,7%) | Nenhum | Melhor documentação e webhooks. Pix não é garantido. |
| **Asaas** | 2,99% + R$ 0,49 (à vista e assinaturas) | Taxa não confirmada | Sim, cartão e Pix | Não informado | Foco no mercado brasileiro. Confirmar a taxa do Pix. |
| **Mercado Pago** | ~3,08% a 3,99% (fontes divergem) | Grátis a 0,99% (fontes divergem) | Sim (cartão, Pix, boleto) | Não informado | Não achei uma tabela oficial de assinaturas; precisa confirmar. |

**Recomendação inicial:** Asaas ou Mercado Pago, por terem Pix e recorrência sem convite. A escolha fica com você depois de confirmar as taxas nos painéis oficiais.

---

## 9. Estimativa inicial de custos

Premissas: plano de R$ 29,90/mês (exemplo, a definir); cada usuário faz 100 perguntas de IA por mês; IA com Haiku 5.5; dados via balldontlie. Valores em dólar não foram convertidos para real porque o câmbio varia.

| Cenário | Supabase | Hospedagem | Dados NBA | LLM (Haiku 5.5) | Embeddings | Total fixo + variável |
|---|---|---|---|---|---|---|
| Desenvolvimento | US$ 0 (Free) | US$ 0 (Vercel Hobby, uso não comercial) | US$ 0 (fixtures + Free) | US$ 0 (Gemini grátis com dados fictícios) | US$ 0 | **US$ 0** |
| Primeiros usuários (~20) | US$ 25 (Pro) | US$ 20 (Vercel Pro) | US$ 9,99 | ~US$ 1,30 | < US$ 1 | **~US$ 57/mês** |
| 100 usuários | US$ 25 | US$ 20 | US$ 9,99–39,99 | ~US$ 6,50 | < US$ 1 | **~US$ 62–92/mês** |
| 500 usuários | US$ 25–35 | US$ 20 | US$ 39,99 | ~US$ 33 | < US$ 1 | **~US$ 118–128/mês** |
| 1.000 usuários | US$ 35–60 | US$ 20–40 | US$ 39,99 | ~US$ 65 | ~US$ 1 | **~US$ 160–205/mês** |

**Taxas de pagamento** (exemplo com Asaas no cartão, R$ 29,90): 2,99% + R$ 0,49 ≈ **R$ 1,38 por assinatura por mês**. Com 1.000 assinantes, isso dá ≈ R$ 1.380/mês, contra uma receita bruta de R$ 29.900.

**Observações:**
- O Vercel Hobby **proíbe uso comercial**. Em produção, é preciso o Pro (US$ 20/mês) ou uma alternativa (ex.: Cloudflare), a avaliar na Fase 2.
- O Supabase Free **pausa o projeto após 1 semana sem uso**, então não serve para produção.
- Os custos de Supabase acima de 500 usuários são estimativas: dependem do tamanho do banco (o Pro inclui 8 GB) e do egress.
- O custo da IA é o item mais sensível. Com Sonnet 5.5, os mesmos 1.000 usuários custariam ~US$ 1.300/mês, por isso os limites por plano são obrigatórios.

---

## 10. Plano de execução por fases

| Fase | Entregas | Depende de |
|---|---|---|
| 1. Diagnóstico | Este documento | — (concluída) |
| 2. Arquitetura | ARCHITECTURE.md, DATA_SOURCES.md, AI_ARCHITECTURE.md, COST_ESTIMATE.md, migrations SQL **locais** para revisão | Decisão sobre a fonte de dados |
| 3. Fundação | Next.js + TS, estrutura de módulos, contratos, erros, Vitest/Playwright, design system, `FixtureProvider` | Aprovação da stack |
| 4. Dados esportivos | Provedor real, ingestão idempotente, versionamento, reconciliação, cálculos e testes | Chave do provedor; projeto Supabase criado por você |
| 5. Produto e interface | Landing, dashboard, jogadores, times, jogos, rankings, comparador, gráficos, filtros na URL | Fase 4 |
| 6. Auth e monetização | Cadastro, sessão, planos, checkout, webhooks, bloqueio no servidor | Escolha do gateway (sandbox) |
| 7. LLM e RAG | Ferramentas, provedor, embeddings, rastreabilidade, limites | Aprovação do provedor de LLM |
| 8. Segurança e qualidade | Testes E2E, RLS, isolamento, acessibilidade, performance | — |
| 9. Deploy | Configuração de produção, monitoramento, documentação final | Sua autorização para contratar serviços |

---

## 11. Riscos identificados

| Risco | Impacto | Mitigação |
|---|---|---|
| Licenciamento dos dados (seção 3) | **Crítico**: pode inviabilizar a comercialização | Confirmar por escrito com o fornecedor antes do lançamento |
| Uso de marcas e logos da NBA e dos times | Alto | Não usar logos oficiais nem o nome "NBA" na marca do produto. Incluir um aviso de não afiliação. |
| Dependência de um fornecedor pequeno | Médio | Camada de provedores, cache local completo e dados históricos próprios |
| Custo da IA fora de controle | Médio | Limites por plano, modelo barato como padrão, cache de respostas frequentes |
| Alucinação numérica | Alto para a credibilidade | Números somente vindos de ferramentas; teste automatizado comparando números da resposta com os da ferramenta |
| Correções oficiais tardias de estatísticas | Baixo | Reconciliação em T+6h/24h/72h com versionamento |
| A temporada 2026-27 já está em andamento | Baixo | Carga histórica inicial da temporada atual na Fase 4 |

---

## 12. Decisões que dependem de você

1. **Fonte de dados** (bloqueante): aceita uma exceção à regra "sem APIs pagas" para usar o balldontlie (US$ 9,99 ou 39,99/mês), após confirmação dos termos comerciais? Ou prefere outro caminho (seção 3.3)?
2. **Gateway de pagamento:** Asaas, Mercado Pago ou Stripe?
3. **Provedor de LLM em produção:** Claude Haiku 5.5 (recomendado) ou outro?
4. **Hospedagem:** Vercel Pro (US$ 20/mês) ou avaliar uma alternativa mais barata na Fase 2?
5. **Preço e planos:** valor da assinatura, existência de plano gratuito limitado ou teste grátis, e limites de IA por plano.
6. **Nome e identidade visual** do produto (sem usar "NBA" na marca).

---

## Fontes consultadas

- NBA Stats: https://www.nba.com/stats · Termos: https://www.nba.com/termsofuse
- GlasslyStats: https://glasslystats.com
- Hoopology: https://hoopologyviz.com
- PLVYOFF: https://plvyoff.com
- StatsPads: https://statspads.com
- nba_api: https://github.com/swar/nba_api
- balldontlie: https://www.balldontlie.io/ · https://docs.balldontlie.io/
- Termos Disney/ESPN: https://disneytermsofuse.com/english/
- Termos Sports Reference (cópia de 17/04/2026): https://tostracker.app/document/sports-reference
- Rate limit do Basketball-Reference (relato de terceiros): https://github.com/vishaalagartha/basketball_reference_scraper
- Dataset Kaggle / nba-db: https://nba-db.readthedocs.io/user_guide/index.html
- Supabase: https://supabase.com/pricing · https://supabase.com/docs/guides/functions/ai-models
- Vercel: https://vercel.com/pricing
- Stripe Brasil: https://stripe.com/br/pricing
- Asaas: https://asaas.com/precos-e-taxas
- Mercado Pago (agregador, não oficial): https://www.calculadoradetaxas.com.br/mercado-pago/taxas
- Gemini API: https://aistudio.google.com/docs/pricing
- Preços Claude: tabela de modelos da documentação da Anthropic (cache de 06/10/2026)

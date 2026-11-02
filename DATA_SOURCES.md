# Fontes de dados — Tabelinha

Última revisão: 02/11/2026.

Regra do projeto: **nenhuma API esportiva paga**. Só usamos fontes gratuitas e só de formas que não contrariem os termos de uso de cada uma.

---

## 1. Fontes avaliadas

| Fonte | Custo | Dados | Limites | Uso comercial | Decisão |
|---|---|---|---|---|---|
| **API-NBA** (api-sports.io), plano Free | Grátis, sem prazo, sem cartão | Times, jogadores, temporadas, jogos, **estatísticas por jogador por jogo**, estatísticas de time por jogo, classificação | **100 requisições/dia** (zera às 00:00 UTC) e 10/min. Chave obrigatória (`x-apisports-key`). | Termos lidos (versão de 21/05/2025, seção 1.1). Permite usar os dados em sites e aplicativos; proíbe revender os dados. **Não licencia a publicação**: autorização dos detentores dos direitos fica por conta do usuário. | **Fonte principal de box scores** |
| **balldontlie**, plano Free | Grátis | Times, jogadores, jogos (placar e status). **Sem estatísticas de jogador.** | 5 req/min. Chave obrigatória. | Não verificado (termos não carregaram; a documentação não trata do tema). | **Fonte de status e placares** (detecta jogos finalizados sem gastar a cota da API-NBA) |
| NBA.com / stats.nba.com (`nba_api`) | Grátis | Completos | Bloqueia muitos IPs de nuvem | **Proibido**: uso "pessoal e não comercial"; veta bancos de dados de estatísticas atualizadas sem consentimento | Descartada |
| ESPN (API não oficial) | Grátis | Placar, box score | Não documentada | **Proibido**: termos da Disney vetam acesso automatizado, coleta de dados e uso comercial | Descartada |
| Basketball-Reference | Grátis | Histórico | Rate limit | **Proibido**: veta acesso automatizado, banco concorrente e uso para gerar respostas de IA | Descartada |
| TheSportsDB, chave gratuita | Grátis | Eventos e placares; sem estatísticas de jogador na documentação | Não informado | Chave grátis só para "projetos de desenvolvimento"; publicar apps exige plano pago | Descartada |
| Datasets Kaggle | Grátis | Histórico | — | O mais completo (`wyattowalsh/basketball`) vem do stats.nba.com e herda as restrições | Descartada |

### 1.1. Termos da API-Sports (versão de 21/05/2025, enviada pelo usuário em 02/11/2026)

| Ponto | O que os termos dizem | Impacto no Tabelinha |
|---|---|---|
| Uso permitido | "Fornecemos dados para você criar projetos como aplicativos, sites, jogos de fantasy etc." | ✅ Um site de estatísticas é um uso previsto |
| Revenda | Proibido vender os dados diretamente ou revendê-los a terceiros | ✅ Não revendemos dados nem oferecemos API/exportação em massa. Não incluir botão de "baixar CSV de toda a temporada" |
| Licença de publicação | "Não fornecemos licença para uso e publicação dos dados… qualquer licença deve ser solicitada pelo usuário às autoridades competentes." Não concedem direitos comerciais sobre as competições | ⚠️ A API-Sports não cobre os direitos da NBA. Para uso não comercial, o risco é baixo. **Antes de cobrar**, é preciso avaliar com um advogado se há necessidade de autorização da NBA |
| Reclamação de detentor de direitos | Se a liga reclamar formalmente, a API-Sports pode cortar o acesso imediatamente | ⚠️ Risco de perder a fonte. Mitigação: dados já gravados ficam no nosso banco; camada de provedores permite troca |
| Logos e imagens | Fornecidos só para identificação; podem exigir autorização dos detentores | ✅ Já decidido: não usamos logos nem fotos |
| Conta | Uma conta por pessoa; **proibido criar várias contas** para ampliar o plano gratuito | ✅ Uma única chave |
| Limite por minuto | Desrespeitar o limite por minuto é **violação grave**, com bloqueio sem aviso | ✅ Fila no cliente HTTP limitada a 10/min |
| Cota diária | No dashboard próprio, ao atingir a cota a conta fica suspensa até 00:00 UTC (sem cobrança extra) | ✅ Controle em `provider_quota_usage` |
| **RapidAPI** | Pelo RapidAPI, ultrapassar a cota gera **cobrança de excedente** | ⚠️ **Cadastrar a chave pelo dashboard próprio (dashboard.api-football.com), nunca pelo RapidAPI** |
| Plano gratuito | "Limitado em termos de dados disponíveis"; pode mudar a qualquer momento sem aviso | ⚠️ Confirma que temporadas anteriores podem não estar disponíveis. Verificar na Fase 4 |
| Qualidade | Dados "como estão", podem conter erros | ✅ Validações por linha e por jogo; reconciliação após 24h |

**Conclusão:** para um projeto **não comercial**, o uso previsto está dentro dos termos da API-Sports. Se o projeto passar a cobrar, a pendência é a licença dos dados junto aos detentores dos direitos, que a API-Sports expressamente não fornece.

### 1.2. balldontlie: termos e documentação (lidos em 02/11/2026)

**Termos de uso:** a documentação completa (www.balldontlie.io/docs e docs.balldontlie.io) **não tem termos de uso**, nem trata de uso comercial, atribuição ou armazenamento. O único texto jurídico é "© 2026 BALLDONTLIE LLC. All rights reserved." Também não há link para uma página de termos.

**Consequência:** sem termos publicados, não há permissão explícita nem proibição. Para uso não comercial, mantemos o balldontlie só para status e placares (dados factuais), com atribuição no rodapé. Antes de qualquer uso comercial, pedir confirmação por escrito em hello@balldontlie.io. O sistema funciona sem ele (seção 6).

**Endpoint usado: `GET https://api.balldontlie.io/v1/games`** (disponível no plano Free)

| Item | Detalhe |
|---|---|
| Autenticação | Cabeçalho `Authorization: <chave>` (a chave pura, sem "Bearer") |
| Filtros | `dates[]`, `start_date`, `end_date` (AAAA-MM-DD), `seasons[]`, `team_ids[]`, `season_type` (`preseason`, `regular`, `ist`, `playin`, `playoffs`) |
| Paginação | Cursor: `meta.next_cursor` → `?cursor=`. `per_page` padrão 25, **máximo 100** |
| Status | Usar **`status_state`** (`scheduled`, `in_progress`, `final`), como a própria documentação recomenda. `status` é texto livre ("7:00 pm ET", "2nd Qtr", "Final") |
| Outros campos | `date`, `season`, `period`, `time`, `postseason`, `postponed`, `home_team_score`, `visitor_team_score`, `home_team`/`visitor_team` (id, abreviação, nome) |

**Uso de cota:** com `per_page=100`, **uma requisição** traz todos os jogos de um dia. A consulta de status a cada 15 minutos fica bem abaixo do limite de 5/min.

**Mapeamento de `season_type`:** `ist` → `cup` e `playin` → `play_in`; os demais têm o mesmo nome.

O formato da resposta será conferido com uma chamada real na Fase 4, antes de o adaptador entrar em uso.

---

## 2. Como as fontes se dividem

| Tarefa | Fonte | Custo diário estimado |
|---|---|---|
| Calendário e status dos jogos (polling) | balldontlie Free | ~20–40 req/dia, dentro de 5/min |
| Box score de jogo finalizado (estatísticas por jogador) | API-NBA | 1 req por jogo finalizado (~0–15/dia) |
| Reconciliação T+24h | API-NBA | 1 req por jogo (~0–15/dia) |
| Carga histórica (backfill) | API-NBA | O que sobrar da cota diária |
| Cadastro de times e jogadores | API-NBA (semanal) | ~2–3 req/semana |
| Classificação | **Calculada por nós** a partir dos jogos | 0 |
| Médias, rankings, recordes, indicadores avançados | **Calculados por nós** a partir dos box scores | 0 |

**Orçamento da API-NBA:** o sistema controla o consumo diário na tabela `provider_quota_usage` e para ao atingir **90 requisições**, deixando 10 de reserva para reprocessamento manual.

---

## 3. Atualização automática

### Frequência

- **Agendador:** GitHub Actions (cron), rodando o worker de ingestão em Node. A Vercel Hobby só permite cron diário, por isso não serve aqui.
- **Calendário:** uma vez por dia (12:00 UTC), sincroniza os jogos dos próximos 7 dias via balldontlie.
- **Janela de jogos:** a cada **15 minutos** entre 23:00 e 08:00 UTC (20:00 às 05:00 em Brasília). Fora da janela, o job sai sem chamar nenhuma API. Tudo configurável por variável de ambiente.
- **Consulta inteligente:** só consulta o status de jogos cujo horário previsto de término (início + 2h15) já passou e que ainda não estão finalizados.

### Atraso esperado

Entre o fim real do jogo e os dados aparecerem no site: **de 15 a 45 minutos**. Isso soma o intervalo do cron, os possíveis atrasos do agendador do GitHub e o tempo que as fontes levam para publicar o box score. **Não é tempo real.**

### Correções

Cada jogo finalizado é reprocessado após **24 horas** (cota permitindo, também após 72h). Se o hash do conteúdo mudar, o jogo ganha uma nova `version` e as estatísticas agregadas são recalculadas.

---

## 4. Camada de provedores

O resto do sistema não conhece nenhuma API. Cada fonte implementa contratos em `src/server/providers/`:

```ts
interface ScheduleProvider {
  listGames(range: { from: string; to: string }): Promise<ProviderGame[]>;
}

interface BoxScoreProvider {
  getPlayerGameStats(gameRef: ProviderGameRef): Promise<ProviderPlayerLine[]>;
}

interface ReferenceDataProvider {
  listTeams(): Promise<ProviderTeam[]>;
  listPlayers(params: { season: number; teamExternalId?: string }): Promise<ProviderPlayer[]>;
}
```

- Os dados de cada provedor são convertidos para os tipos de domínio (`ProviderGame`, `ProviderPlayerLine` etc.) dentro do próprio adaptador.
- Os IDs externos ficam na tabela `external_refs`. O **mesmo jogo** tem um ID no balldontlie e outro na API-NBA; o vínculo é feito por data, time mandante e time visitante.
- Implementações previstas: `ApiNbaProvider`, `BallDontLieProvider` e `FixtureProvider` (testes automatizados, sem rede).

---

## 5. Limitações conhecidas

1. **Histórico limitado pela cota.** A temporada tem ~1.230 jogos. Com ~60 requisições livres por dia, carregar uma temporada passada inteira leva **cerca de 20 dias**. Prioridade: (1) temporada atual 2026-27, (2) 2025-26 para comparações "temporada atual × anterior".
2. **Não confirmado:** se o plano Free da API-NBA dá acesso a temporadas anteriores. Será verificado com chamadas reais na Fase 4.
3. **Estatísticas avançadas oficiais** (tracking, hustle, play types) não existem nas fontes gratuitas. Calcularemos apenas o que é possível a partir do box score (seção 6 de [docs/STATS_FORMULAS.md](docs/STATS_FORMULAS.md)).
4. **Dependência de terceiros pequenos.** Se uma fonte cair, o site continua mostrando os dados já gravados, com o aviso "dados atualizados até <data>".
5. O **formato exato** das respostas da API-NBA será validado com chamadas reais na Fase 4; os adaptadores não assumem campos sem testar.

---

## 6. Contingência

| Falha | Comportamento |
|---|---|
| balldontlie fora do ar ou descartado pelos termos | O job usa `games?date=` da API-NBA como fonte de status, com intervalo maior (30 min) para economizar cota |
| API-NBA fora do ar ou cota esgotada | O jogo fica `stats_status = pending` e é tentado de novo no ciclo seguinte (backoff: 15 min, 30 min, 1h, 2h, depois a cada 6h por até 72h) |
| Dados inconsistentes (ex.: soma dos pontos dos jogadores ≠ placar) | Jogo marcado `stats_status = invalid`, não entra nos agregados, alerta registrado em `sync_logs` |
| Fonte encerra o plano gratuito | Troca de adaptador. Os dados já gravados continuam válidos |

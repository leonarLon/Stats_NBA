# Fontes de dados — STATS ALL IN

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

| Ponto | O que os termos dizem | Impacto no STATS ALL IN |
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
| Qualidade | Dados "como estão", podem conter erros | ✅ Validações por linha e por jogo; reconciliação 6h e 18h após o jogo |

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

### 1.3. Teste real das APIs (03/11/2026)

Feito com as chaves do projeto, gastando 6 requisições da cota da API-NBA.

| Verificação | Resultado |
|---|---|
| API-NBA `/status` | Plano **Free**, ativo, 100 requisições/dia |
| API-NBA `/games?date=` | Filtra pela **data UTC** de início (um jogo das 22h30 em Los Angeles cai no dia seguinte). Status em `status.short` (3 = encerrado) e `status.long` ("Finished") |
| API-NBA `/games/statistics?id=` (totais do time) | ✅ Corretos: batem com o placar e com o balldontlie |
| API-NBA `/players/statistics?game=` (box score de jogadores) | ❌ **Incompleto em 3 de 4 times testados.** LAC @ GSW (124-112): os jogadores somam 85 e 100 pontos. TOR @ LAL (125-131): LAL completo; TOR soma 119 pontos e 225 minutos. O jogo incompleto terminou havia mais de 24h |
| Minutos na API-NBA | Texto com minutos inteiros (`"21"`), sem segundos. A soma do time fica ±5 min de 240 |
| Percentuais e +/- na API-NBA | Texto (`"14.3"`, `"0"`); recalculados por nós |
| balldontlie `/v1/games?dates[]=` | ✅ 15 jogos de 02/11, todos `status_state = final`, placares corretos |
| Supabase | Chaves publishable e secret válidas; nenhuma tabela criada ainda |

**Consequências para o projeto:**
1. Os totais de time vêm de `/games/statistics` (1 requisição extra por jogo), não da soma dos jogadores.
2. Box scores de jogadores incompletos são comuns no plano gratuito. Decisão do usuário (03/11/2026): gravar o que vier, marcar o jogo como `partial`, tentar de novo após 6h e 18h e avisar na interface (docs/STATS_FORMULAS.md, seção 2.1).
3. A validação de minutos precisa de tolerância maior (minutos inteiros arredondados).
4. O vínculo entre jogos das duas fontes usa times + horário de início, nunca só a data.

### 1.4. Primeira ingestão real (03/11/2026)

Feita com o worker, depois de aplicada a migration 0004.

| Etapa | Resultado | Requisições |
|---|---|---|
| Calendário (02/11 a 10/11) | 30 times, 68 jogos, 15 encerrados, classificação recalculada | balldontlie: 2 |
| Box score de 2 jogos de 02/11 | Ambos `partial`. Placar e totais dos times corretos. Faltam jogadores: OKC @ CLE com 9 e 8 jogadores (CLE soma 83 de 112 pontos); DET @ CHA com 12 e 11 jogadores (somam 120 de 124 e 81 de 91 pontos) | API-NBA: 5 (1 busca por data + 2 por jogo) |

Isso confirma o padrão da seção 1.3. O jogo fica `partial` até alguma reconciliação trazer o box score completo.

### 1.5. Janela de datas do plano gratuito (03/11/2026)

A carga da temporada (20/10 a 01/11) falhou em 38 de 40 jogos. A API-NBA respondeu, para `/games?date=2026-10-27`:

> `Free plans do not have access to this date, try from 2026-11-02 to 2026-11-04.`

**O plano gratuito só libera ontem, hoje e amanhã (datas UTC).** Consequências:

1. **Não há como obter box scores de jogos antigos** em nenhuma fonte gratuita (o balldontlie gratuito não tem estatística de jogador). A temporada 2026-27 tem box scores a partir de 02/11/2026, quando a coleta começou. Calendário, placares e classificação cobrem a temporada inteira, porque vêm do balldontlie.
2. As reconciliações de jogos parciais passaram de 24h/72h/7 dias para **6h e 18h** após o fim do jogo, dentro da janela.
3. O worker não consulta a API para jogos fora da janela: encerra a sincronização com `last_error = 'fora da janela de datas da fonte gratuita'`, e o site mostra "Sem box score". O mesmo acontece se a API recusar a data.
4. Comparações com temporadas anteriores não são possíveis com fontes gratuitas.

## 2. Como as fontes se dividem

| Tarefa | Fonte | Custo diário estimado |
|---|---|---|
| Calendário e status dos jogos (polling) | balldontlie Free | ~20–40 req/dia, dentro de 5/min |
| Box score de jogo finalizado (jogadores + totais do time) | API-NBA | 2 req por jogo finalizado (~0–30/dia) |
| Reconciliação de jogos `partial` (6h e 18h após o fim) | API-NBA | 2 req por jogo parcial por etapa (estimativa: ~20–40/dia) |
| Carga histórica (backfill) | balldontlie (calendário e placares); API-NBA só dentro da janela de 1 dia | Sem custo de API-NBA para jogos antigos |
| Cadastro de times e jogadores | API-NBA (semanal) | ~2–3 req/semana |
| Classificação | **Calculada por nós** a partir dos jogos | 0 |
| Médias, rankings, recordes, indicadores avançados | **Calculados por nós** a partir dos box scores | 0 |

**Orçamento da API-NBA:** o sistema controla o consumo diário na tabela `provider_quota_usage` e para ao atingir **90 requisições**, deixando 10 de reserva para reprocessamento manual.

---

## 3. Atualização automática

### Frequência

- **Agendador:** GitHub Actions (cron), rodando o worker de ingestão em Node. A Vercel Hobby só permite cron diário, por isso não serve aqui.
- **Calendário:** uma vez por dia (12:00 UTC), sincroniza os jogos dos próximos 7 dias via balldontlie.
- **Janela de jogos:** a cada **15 minutos** entre 22:00 e 08:59 UTC (19:00 às 05:59 em Brasília), em [.github/workflows/ingest.yml](.github/workflows/ingest.yml). Sem jogos pendentes, o ciclo não chama nenhuma API.
- **Custo:** o repositório é público, então os minutos do GitHub Actions são ilimitados. Atenção: o GitHub **desativa crons de repositórios públicos após 60 dias sem commits**; se isso acontecer, basta reativar na aba Actions.
- **Consulta inteligente:** só consulta o status de jogos cujo horário previsto de término (início + 2h15) já passou e que ainda não estão finalizados.

### Atraso esperado

Entre o fim real do jogo e os dados aparecerem no site: **de 15 a 45 minutos**. Isso soma o intervalo do cron, os possíveis atrasos do agendador do GitHub e o tempo que as fontes levam para publicar o box score. **Não é tempo real.**

### Correções

Só os jogos `partial` são reprocessados, **6 e 18 horas** após o fim do jogo (a fonte gratuita não libera jogos mais antigos que ontem). Se o hash do conteúdo mudar, o jogo ganha uma nova `version` e as estatísticas agregadas são recalculadas. Jogos `complete` não são consultados de novo.

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

1. **Sem histórico de box score.** O plano gratuito da API-NBA só libera jogos de ontem, hoje e amanhã (seção 1.5). As médias da temporada 2026-27 começam em 02/11/2026, e não há temporadas anteriores.
2. **Box scores parciais podem ficar parciais para sempre** se a fonte não completar dentro da janela de um dia.
3. **Estatísticas avançadas oficiais** (tracking, hustle, play types) não existem nas fontes gratuitas. Calcularemos apenas o que é possível a partir do box score (seção 6 de [docs/STATS_FORMULAS.md](docs/STATS_FORMULAS.md)).
4. **Dependência de terceiros pequenos.** Se uma fonte cair, o site continua mostrando os dados já gravados, com o aviso "dados atualizados até <data>".
5. O formato das respostas foi conferido com chamadas reais em 03/11/2026 (seção 1.3).

---

## 6. Contingência

| Falha | Comportamento |
|---|---|
| balldontlie fora do ar ou descartado pelos termos | O job usa `games?date=` da API-NBA como fonte de status, com intervalo maior (30 min) para economizar cota |
| API-NBA fora do ar ou cota esgotada | O jogo fica `stats_status = pending` e é tentado de novo no ciclo seguinte (backoff: 15 min, 30 min, 1h, 2h, depois a cada 6h), até sair da janela de datas da fonte |
| Dados inconsistentes (ex.: soma dos pontos dos jogadores ≠ placar) | Jogo marcado `stats_status = invalid`, não entra nos agregados, alerta registrado em `sync_logs` |
| Fonte encerra o plano gratuito | Troca de adaptador. Os dados já gravados continuam válidos |

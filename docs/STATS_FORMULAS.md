# Fórmulas e regras de cálculo

Todas as estatísticas agregadas são calculadas pelo backend a partir de `player_game_stats`, que é a única fonte da verdade. Nenhum número exibido vem pronto da fonte sem passar por essas regras.

## 1. Escopo dos dados

- Agregados são sempre separados por **temporada** e **tipo de temporada** (`regular`, `play_in`, `playoffs`, `cup`, `preseason`). Pré-temporada nunca entra em médias da temporada regular.
- Só entram nos agregados jogos com `games.status = 'final'` e `stats_status = 'complete'`.
- Jogador transferido no meio da temporada: o agregado da temporada soma todos os times; o detalhe por time vem da consulta por jogo.

## 2. Validações por linha (jogador × jogo)

Uma linha é rejeitada (e o jogo marcado `invalid`) se falhar em:

| Regra | Fórmula |
|---|---|
| Não negativos | todos os contadores ≥ 0 (exceto `plus_minus`) |
| Arremessos | `fgm ≤ fga`, `fg3m ≤ fg3a`, `ftm ≤ fta`, `fg3m ≤ fgm`, `fg3a ≤ fga` |
| Pontos | `pts = 2·fgm + fg3m + ftm` |
| Rebotes | `reb = oreb + dreb` (quando ambos existem) |
| Minutos | `0 ≤ seconds_played ≤ 48·60 + 5·60·n_prorrogações` |

Validações por jogo:

| Regra | Fórmula |
|---|---|
| Placar | Σ `pts` dos jogadores do time = placar do time |
| Minutos do time | Σ minutos dos jogadores ≈ 240 + 25·n_prorrogações (tolerância de 1 min, por arredondamento da fonte) |

## 3. Médias e percentuais

| Indicador | Fórmula | Observação |
|---|---|---|
| Jogos disputados (GP) | nº de jogos com `seconds_played > 0` | DNP não conta |
| Média por jogo | total ÷ GP | — |
| FG% | Σfgm ÷ Σfga | **Razão das somas**, nunca média dos percentuais por jogo. Nulo se Σfga = 0 |
| 3P% | Σfg3m ÷ Σfg3a | idem |
| FT% | Σftm ÷ Σfta | idem |
| Minutos por jogo | Σseconds ÷ GP ÷ 60 | — |

## 4. Double-double e triple-double

Contam as categorias `pts`, `reb`, `ast`, `stl`, `blk` com valor ≥ 10 no jogo:
- **Double-double:** ≥ 2 categorias
- **Triple-double:** ≥ 3 categorias (um triple-double também conta como double-double)

## 5. Rankings e qualificação

Para não colocar no topo um jogador com 2 jogos, os rankings de média exigem um mínimo de jogos:

`min_games = ceil(0,70 × jogos já disputados pelo time do jogador na temporada)`

Os rankings de percentual exigem também um volume mínimo de tentativas por jogo (FG%: 5 FGA/jogo; 3P%: 2 3PA/jogo; FT%: 1,5 FTA/jogo). Esses critérios são do Tabelinha e não seguem necessariamente os critérios oficiais da NBA; a interface informa isso.

## 6. Indicadores avançados calculados a partir do box score

| Indicador | Fórmula |
|---|---|
| eFG% | (Σfgm + 0,5·Σfg3m) ÷ Σfga |
| TS% | Σpts ÷ (2 · (Σfga + 0,44·Σfta)) |
| Posses do time (estimativa) | fga − oreb + tov + 0,44·fta |
| Rating ofensivo do time | 100 · pts ÷ posses |
| Rating defensivo do time | 100 · pts sofridos ÷ posses do adversário |
| Net rating | ORtg − DRtg |
| Pace | 48 · ((posses do time + posses do adversário) ÷ 2) ÷ (minutos do time ÷ 5) |
| AST/TO | Σast ÷ Σtov |

Os valores são **estimativas** baseadas no box score e podem diferir ligeiramente dos números oficiais da NBA. A interface os rotula como "estimado".

## 7. Consistência ("quais jogadores são mais consistentes?")

Coeficiente de variação dos pontos nos jogos disputados: `CV = desvio padrão(pts) ÷ média(pts)`. Quanto menor, mais consistente. Exige mínimo de 10 jogos e média ≥ 10 pontos.

## 8. Evolução ("quem mais evoluiu?")

Diferença entre a média dos últimos N jogos (padrão 10) e a média da temporada até então, para cada estatística. Exige GP ≥ 15.

## 9. Dados incompletos

- Enquanto a temporada estiver em andamento, as médias são exibidas como "parciais, até <data>".
- Se houver jogos do time ainda com `stats_status` diferente de `complete`, `player_season_stats.is_complete = false` e a interface mostra o aviso "faltam N jogos para processar".

# Estimativa de custos — Tabelinha

Preços e limites consultados em 02/11/2026 nas páginas oficiais, salvo indicação. Confirme antes de usar em decisões.

Premissa atual: projeto **não comercial** e **custo zero**. Todos os serviços estão no plano gratuito. A cobrança de assinaturas está preparada, mas desligada.

---

## 1. Serviços e limites gratuitos

| Serviço | Plano | Custo | Limites relevantes | Ponto de atenção |
|---|---|---|---|---|
| **Vercel** | Hobby | US$ 0 | 1M invocações de função/mês; 100 GB de banda/mês; cron só diário | Permitido para uso pessoal e não comercial. Se o projeto passar a cobrar, migrar para o Pro antes |
| **Supabase** | Free | US$ 0 | 500 MB de banco; 50.000 usuários ativos/mês; 5 GB de egress; 2 projetos | Projeto **pausa após 1 semana sem atividade** (a ingestão diária deve mantê-lo ativo). SMTP padrão serve só para testes. Sem backups automáticos |
| **GitHub Actions** | Free | US$ 0 | Repositório público: ilimitado. Privado: 2.000 min/mês | O repositório é **público** (verificado em 03/11/2026): ~45 execuções/dia sem custo. Se ficar privado, o uso (~2.000 min/mês) estoura o limite e o cron precisa ser reduzido. O cron pode atrasar em horários de pico |
| **API-NBA** (api-sports) | Free | US$ 0 | 100 requisições/dia, 10/min | **Cadastrar pelo dashboard próprio, não pelo RapidAPI** (no RapidAPI, excedentes são cobrados) |
| **balldontlie** | Free | US$ 0 | 5 requisições/min | Não publica termos de uso; usado só para status e placares |
| **Mercado Pago** | — | Sem mensalidade | Taxa só sobre pagamentos recebidos | Desligado enquanto o projeto for não comercial; testes só no sandbox |
| **Domínio** | — | US$ 0 | `tabelinha.vercel.app` | Domínio próprio `.com.br` é pago (registro.br) |

### Volume de dados no Supabase (500 MB)

| Dado | Estimativa por temporada |
|---|---|
| `player_game_stats` (~1.230 jogos × ~26 linhas) | ~32 mil linhas, ~15 MB com índices |
| Demais tabelas esportivas | < 5 MB |

Cabem com folga várias temporadas no plano gratuito.

## 2. Quando o gratuito deixa de bastar

Nada será contratado sem sua autorização.

| Gatilho | Opção | Custo de referência (02/11/2026) |
|---|---|---|
| Projeto passa a cobrar assinaturas | Vercel Pro | US$ 20/mês |
| Projeto pausado, banco cheio ou necessidade de backup | Supabase Pro | US$ 25/mês |
| Histórico completo de várias temporadas rapidamente | API-NBA paga | Não pesquisado (regra: sem APIs pagas) |
| Egress acima de 5 GB/mês | Supabase Pro | US$ 25/mês (inclui 250 GB) |

## 3. Se a cobrança for ativada no futuro

Taxas do Mercado Pago (fontes não oficiais, divergentes; conferir no painel):

| Meio | Taxa | Por assinatura de R$ 19,90 |
|---|---|---|
| Cartão de crédito | ~3,08% a 3,99% | ~R$ 0,61 a R$ 0,79 |
| Pix | 0% a 0,99% | R$ 0,00 a R$ 0,20 |

| Assinantes | Receita bruta/mês | Taxas MP (pior caso, 3,99%) | Custo fixo mínimo (Vercel Pro) |
|---|---|---|---|
| 100 | R$ 1.990 | ~R$ 79 | US$ 20 |
| 500 | R$ 9.950 | ~R$ 397 | US$ 20 (+ US$ 25 do Supabase Pro, provavelmente) |
| 1.000 | R$ 19.900 | ~R$ 794 | US$ 45 |

Além disso: licença dos dados junto aos detentores dos direitos (ver [DATA_SOURCES.md](DATA_SOURCES.md), seção 1.1), impostos e contabilidade, não estimados aqui.

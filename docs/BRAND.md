# Marca — STATS ALL IN

## Nome

**STATS ALL IN** (escrito sempre em maiúsculas; no logo, "ALL IN" em vermelho)

- Troca de nome decidida pelo usuário em 03/11/2026; o nome anterior era "Tabelinha".
- *All in*: ir com tudo. Combina com a proposta de reunir todas as estatísticas num lugar só.
- Não usa "NBA" nem nomes de times.

**Antes de registrar:** pesquisar marca no INPI (classes 9, 35, 41 e 42) e verificar a disponibilidade do domínio. Essa checagem não foi feita. Atenção: "all in" também é termo de pôquer e de apostas; o site não deve sugerir ligação com apostas.

**Slogan:** "Estatística de basquete, explicada."

**Aviso obrigatório no rodapé:** "O STATS ALL IN é um projeto independente, sem afiliação com a NBA ou com qualquer equipe. Dados fornecidos por API-NBA e balldontlie."

## O que não usar

- Logos, cores oficiais ou fotos da NBA e dos times. Times são identificados pela sigla (BOS, LAL…) num selo neutro.
- Fotos de jogadores (direitos de imagem). Os jogadores aparecem com iniciais num avatar.
- Elementos visuais, layouts ou textos dos sites de referência.

## Identidade visual

Tema escuro por padrão (uso noturno, horário dos jogos no Brasil), com tema claro disponível.

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `bg` | `#09090B` | `#F8F7FA` | Fundo (preto) |
| `surface` / `surface-2` | `#131217` / `#1D1B24` | `#FFFFFF` / `#EFEDF3` | Cartões e tabelas, com leve tom roxo |
| `border` | `#2E2A3A` | `#D9D5E0` | Bordas |
| `text` | `#F2F1F5` | `#121016` | Texto principal |
| `muted` | `#A6A1B4` | `#57526A` | Texto secundário |
| `primary` (vermelho) | `#FF3B4F` | `#C8102E` | Ações, destaques, "ALL IN" do logo |
| `secondary` (roxo) | `#A78BFA` | `#6D28D9` | Detalhes, avisos, segunda seta do logo |
| `positive` / `negative` | `#4ADE80` / `#FB7185` | `#067647` / `#B42318` | Vitória/derrota, saldo |

No tema escuro, o texto dos botões vermelhos é preto (contraste 5,7:1); branco sobre esse vermelho daria só 3,5:1. O título da landing usa um degradê do vermelho ao roxo.

Todos os pares de texto e fundo passam de 4,5:1 (WCAG AA), verificados em `tests/unit/contrast.test.ts`. Positivo e negativo nunca são indicados só por cor; sempre têm sinal (+/−) ou ícone.

**Tipografia** (Google Fonts, licença OFL):
- Títulos: **Barlow Condensed** (semibold), lembra placar de ginásio.
- Texto e tabelas: **Inter**, com números tabulares (`font-variant-numeric: tabular-nums`) para alinhar colunas de estatísticas.

**Logo:** duas setas curvas, uma vermelha e uma roxa, que formam juntas o contorno de uma bola (`src/components/brand/logo.tsx` e `src/app/icon.svg`).

## Tom de voz

Português do Brasil, direto e didático. Explica a sigla na primeira vez que aparece ("TS% — aproveitamento real de arremessos"). Diferencia sempre dado oficial de opinião.

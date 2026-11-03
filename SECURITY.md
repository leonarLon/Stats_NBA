# Segurança — STATS ALL IN

Revisão da Fase 8, feita em 03/11/2026. Descreve o que está protegido, como foi verificado e o que fica pendente.

## 1. Segredos

| Segredo | Onde fica | Verificação |
|---|---|---|
| `SUPABASE_SECRET_KEY`, `APISPORTS_KEY`, `BALLDONTLIE_KEY`, `REVALIDATE_SECRET`, `MP_*` | Só no servidor (`.env.local`, painel da Vercel, secrets do GitHub). Lidos apenas em `src/server/lib/config.ts` | Busca no build de produção (`.next/static`): nenhum valor encontrado nos arquivos enviados ao navegador |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pública por natureza, protegida pelo RLS | Também não aparece no navegador: o site não tem cliente Supabase no navegador |

- `.env.local` está no `.gitignore` e nunca foi commitado.
- Os logs passam por `redact()` (`src/server/lib/logger.ts`) e não registram e-mail, senha, token nem id de usuário nas ações de conta.

## 2. Pontos de entrada

| Entrada | Proteção |
|---|---|
| Server Actions de conta (`src/server/auth/actions.ts`) | Validação Zod no servidor; a sessão é lida no servidor (o navegador nunca informa o usuário); proteção nativa do Next contra CSRF (compara `Origin` e `Host`); limite de tentativas por IP e por e-mail |
| `/auth/confirm` | Só aceita `code` ou `token_hash` com tipo conhecido; destino restrito a caminhos internos (`safeNextPath`) |
| `/api/revalidate` | Só `POST`, com `Authorization: Bearer <REVALIDATE_SECRET>` comparado em tempo constante; desligada sem segredo |
| Parâmetros de URL das páginas | Validados (`src/lib/params.ts`): datas, ids, siglas e ordenação só aceitam formatos conhecidos; a busca tem no máximo 40 caracteres e é filtrada em memória, sem entrar em SQL |

## 3. Acesso aos dados

- Estatísticas: `requireAccess()` antes de qualquer leitura (`src/server/stats/queries.ts`), e as funções que leem não são exportadas.
- Banco: RLS em todas as tabelas. Usuário comum só lê estatística com acesso ativo, e só o próprio perfil e as próprias assinaturas. Funções de ingestão e `start_trial` não podem ser chamadas por `anon`/`authenticated` (testado em `tests/db`).
- Sem acesso a dados de outro usuário: todas as ações usam o id da sessão, nunca um id vindo do formulário (testado em `tests/unit/auth.test.ts`).

## 4. Cabeçalhos HTTP (`next.config.ts`)

| Cabeçalho | Valor |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; scripts e estilos só do próprio site (+ inline); `connect-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests` |
| `Strict-Transport-Security` | 2 anos, com subdomínios |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | câmera, microfone e localização desligados |
| `Cross-Origin-Opener-Policy` | `same-origin` |

**Por que a CSP aceita script inline:** a CSP com nonce obrigaria a renderizar cada página a cada visita, e o guia do Next.js a declara incompatível com o Partial Prerendering. O risco que sobra é baixo: o site não exibe HTML de usuários, e o React escapa todo texto. O teste E2E navega pelo site e falha se o navegador registrar qualquer bloqueio de CSP.

## 5. Limite de tentativas (`src/server/lib/attempt-limiter.ts`)

| Ação | Limite |
|---|---|
| Login | 8 por e-mail e 30 por IP a cada 15 min (login certo zera a contagem do e-mail) |
| Cadastro | 5 por IP por hora |
| Nova senha | 3 por e-mail e 5 por IP por hora |

As chamadas ao Supabase Auth saem do servidor, então o limite do próprio Supabase enxerga só o IP do servidor. Por isso o limite é contado aqui. A contagem fica na memória de cada instância da Vercel: é proteção de melhor esforço. Um limite global exigiria uma tabela no banco (nova migration).

## 6. Dependências

`npm audit --omit=dev`: **0 vulnerabilidades** em produção (03/11/2026). As 16 moderadas são do ESLint e dos seus plugins (`minimatch`, negação de serviço), usados só no desenvolvimento. A "correção" sugerida rebaixa o ESLint para uma versão incompatível, então não foi aplicada.

## 7. Pendências e recomendações

| Item | Quando |
|---|---|
| No Supabase: **Authentication → Providers → Email → Minimum password length = 8**, igual à regra do site (o padrão é 6) | Antes de publicar |
| SMTP próprio para os e-mails de conta (o padrão do Supabase só entrega para a equipe) | Fase 9 |
| Atualizar Site URL e Redirect URLs do Supabase para o domínio da Vercel | Fase 9 |
| CAPTCHA no cadastro (Supabase Auth suporta hCaptcha e Turnstile, gratuitos), se aparecer cadastro automatizado | Se necessário |
| Limite de tentativas global, guardado no banco | Se o tráfego crescer |
| Quem exclui a conta e se cadastra de novo com o mesmo e-mail ganha outro teste grátis | Aceito enquanto o projeto não for comercial |

## 8. Como reportar um problema

Abra uma issue privada (Security advisory) no repositório do GitHub. Não publique detalhes de falhas em issues abertas.

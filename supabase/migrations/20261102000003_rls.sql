-- Tabelinha — 0003: Row Level Security
-- Aplicada no Supabase em 03/11/2026 (SQL Editor), com autorização do usuário. Não editar: mudanças vão em uma nova migration.
--
-- Regras:
--  * Dados esportivos: leitura só para usuários com acesso ativo (teste ou assinatura).
--  * Dados do usuário: só o próprio usuário lê.
--  * Escrita em tudo que envolve dinheiro, acesso ou dados esportivos: somente service role
--    (que ignora o RLS). Tabelas sem policy ficam inacessíveis para anon/authenticated.
--  * `(select public.has_active_access())` é avaliado uma vez por consulta, não por linha.

-- ---------------------------------------------------------------------------
-- Habilitar RLS em todas as tabelas
-- ---------------------------------------------------------------------------

alter table public.data_providers        enable row level security;
alter table public.external_refs         enable row level security;
alter table public.seasons               enable row level security;
alter table public.teams                 enable row level security;
alter table public.players               enable row level security;
alter table public.games                 enable row level security;
alter table public.game_sync_state       enable row level security;
alter table public.player_game_stats     enable row level security;
alter table public.team_game_stats       enable row level security;
alter table public.player_season_stats   enable row level security;
alter table public.team_season_stats     enable row level security;
alter table public.standings             enable row level security;
alter table public.sync_jobs             enable row level security;
alter table public.sync_logs             enable row level security;
alter table public.provider_quota_usage  enable row level security;

alter table public.profiles              enable row level security;
alter table public.plans                 enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.payment_events        enable row level security;
alter table public.payment_transactions  enable row level security;
alter table public.audit_logs            enable row level security;


-- ---------------------------------------------------------------------------
-- Dados esportivos: leitura premium
-- ---------------------------------------------------------------------------

create policy "premium read" on public.seasons
  for select to authenticated using ((select public.has_active_access()));
create policy "premium read" on public.teams
  for select to authenticated using ((select public.has_active_access()));
create policy "premium read" on public.players
  for select to authenticated using ((select public.has_active_access()));
create policy "premium read" on public.games
  for select to authenticated using ((select public.has_active_access()));
create policy "premium read" on public.player_game_stats
  for select to authenticated using ((select public.has_active_access()));
create policy "premium read" on public.team_game_stats
  for select to authenticated using ((select public.has_active_access()));
create policy "premium read" on public.player_season_stats
  for select to authenticated using ((select public.has_active_access()));
create policy "premium read" on public.team_season_stats
  for select to authenticated using ((select public.has_active_access()));
create policy "premium read" on public.standings
  for select to authenticated using ((select public.has_active_access()));

-- Sem policies (somente service role): data_providers, external_refs, game_sync_state,
-- sync_jobs, sync_logs, provider_quota_usage, payment_events, audit_logs.

-- ---------------------------------------------------------------------------
-- Planos: públicos (página de preços)
-- ---------------------------------------------------------------------------

create policy "public read active plans" on public.plans
  for select to anon, authenticated using (is_active);

-- ---------------------------------------------------------------------------
-- Perfil: o próprio usuário lê e edita campos limitados
-- ---------------------------------------------------------------------------

create policy "own profile read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "own profile update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Só estas colunas podem ser alteradas pelo usuário (trial_started_at fica de fora)
revoke update on public.profiles from authenticated;
grant update (display_name, favorite_team_id, terms_accepted_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Assinatura e pagamentos: o próprio usuário só lê
-- ---------------------------------------------------------------------------

create policy "own subscriptions read" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

create policy "own payments read" on public.payment_transactions
  for select to authenticated using (user_id = (select auth.uid()));

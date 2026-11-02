-- Tabelinha — 0001: extensões, utilidades e domínio esportivo
-- PARA REVISÃO. Não executar no Supabase sem autorização explícita.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.game_status as enum ('scheduled', 'in_progress', 'final', 'postponed', 'canceled');
create type public.season_type as enum ('preseason', 'regular', 'play_in', 'playoffs', 'cup');
create type public.stats_status as enum ('pending', 'complete', 'invalid');
create type public.entity_type as enum ('team', 'player', 'game', 'season');

-- ---------------------------------------------------------------------------
-- Provedores e mapeamento de IDs externos
-- ---------------------------------------------------------------------------

create table public.data_providers (
  id smallint generated always as identity primary key,
  slug text not null unique,               -- 'api-nba', 'balldontlie', 'fixture'
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.external_refs (
  provider_id smallint not null references public.data_providers (id),
  entity_type public.entity_type not null,
  external_id text not null,
  entity_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (provider_id, entity_type, external_id),
  unique (provider_id, entity_type, entity_id)
);

create index external_refs_entity_idx on public.external_refs (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Temporadas, times, jogadores
-- ---------------------------------------------------------------------------

create table public.seasons (
  id smallint generated always as identity primary key,
  start_year smallint not null unique check (start_year between 1946 and 2100),
  label text not null,                     -- '2026-27'
  is_current boolean not null default false,
  starts_on date,
  ends_on date
);

create unique index seasons_single_current_idx on public.seasons (is_current) where is_current;

create table public.teams (
  id bigint generated always as identity primary key,
  abbreviation text not null unique check (abbreviation ~ '^[A-Z]{2,4}$'),
  city text not null,
  nickname text not null,
  full_name text not null,
  conference text check (conference in ('East', 'West')),
  division text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();

create table public.players (
  id bigint generated always as identity primary key,
  first_name text not null,
  last_name text not null,
  display_name text not null,
  search_name text not null,               -- minúsculo e sem acento, preenchido pela aplicação
  position text,
  jersey_number text,
  height_cm smallint check (height_cm between 150 and 250),
  weight_kg smallint check (weight_kg between 50 and 200),
  birth_date date,
  country text,
  current_team_id bigint references public.teams (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index players_search_name_trgm_idx on public.players using gin (search_name extensions.gin_trgm_ops);
create index players_current_team_idx on public.players (current_team_id);

create trigger players_updated_at before update on public.players
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Jogos
-- ---------------------------------------------------------------------------

create table public.games (
  id bigint generated always as identity primary key,
  season_id smallint not null references public.seasons (id),
  season_type public.season_type not null,
  game_date date not null,                 -- data local do jogo (horário dos EUA)
  starts_at timestamptz,
  status public.game_status not null default 'scheduled',
  home_team_id bigint not null references public.teams (id),
  away_team_id bigint not null references public.teams (id),
  home_score smallint check (home_score >= 0),
  away_score smallint check (away_score >= 0),
  overtime_periods smallint not null default 0 check (overtime_periods between 0 and 10),
  stats_status public.stats_status not null default 'pending',
  payload_hash text,                       -- hash do box score normalizado gravado
  version integer not null default 0,      -- incrementa a cada box score diferente gravado
  finalized_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  check (status <> 'final' or (home_score is not null and away_score is not null))
);

create index games_game_date_idx on public.games (game_date);
create index games_season_idx on public.games (season_id, season_type);
create index games_status_starts_idx on public.games (status, starts_at);
create index games_home_team_idx on public.games (home_team_id, game_date desc);
create index games_away_team_idx on public.games (away_team_id, game_date desc);

create trigger games_updated_at before update on public.games
  for each row execute function public.set_updated_at();

-- Fila de processamento de cada jogo (uso interno do worker)
create table public.game_sync_state (
  game_id bigint primary key references public.games (id) on delete cascade,
  attempts integer not null default 0,
  next_check_at timestamptz,
  reconcile_at timestamptz,                -- finalized_at + 24h
  reconciled_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create index game_sync_state_next_check_idx on public.game_sync_state (next_check_at)
  where next_check_at is not null;
create index game_sync_state_reconcile_idx on public.game_sync_state (reconcile_at)
  where reconciled_at is null;

create trigger game_sync_state_updated_at before update on public.game_sync_state
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Estatísticas por jogo
-- Validações de consistência (pontos = 2·FGM + 3PM + FTM, soma = placar etc.)
-- são feitas na aplicação, que marca o jogo como 'invalid' em vez de abortar.
-- ---------------------------------------------------------------------------

create table public.player_game_stats (
  game_id bigint not null references public.games (id) on delete cascade,
  player_id bigint not null references public.players (id),
  team_id bigint not null references public.teams (id),
  season_id smallint not null references public.seasons (id),   -- desnormalizado de games
  season_type public.season_type not null,                       -- desnormalizado de games
  game_date date not null,                                       -- desnormalizado de games
  is_starter boolean not null default false,
  did_not_play boolean not null default false,
  seconds_played integer not null default 0 check (seconds_played between 0 and 5400),
  pts smallint not null default 0 check (pts >= 0),
  fgm smallint not null default 0 check (fgm >= 0),
  fga smallint not null default 0 check (fga >= fgm),
  fg3m smallint not null default 0 check (fg3m >= 0 and fg3m <= fgm),
  fg3a smallint not null default 0 check (fg3a >= fg3m and fg3a <= fga),
  ftm smallint not null default 0 check (ftm >= 0),
  fta smallint not null default 0 check (fta >= ftm),
  oreb smallint check (oreb >= 0),
  dreb smallint check (dreb >= 0),
  reb smallint not null default 0 check (reb >= 0),
  ast smallint not null default 0 check (ast >= 0),
  stl smallint not null default 0 check (stl >= 0),
  blk smallint not null default 0 check (blk >= 0),
  tov smallint not null default 0 check (tov >= 0),
  pf smallint not null default 0 check (pf between 0 and 6),
  plus_minus smallint,
  primary key (game_id, player_id)
);

create index player_game_stats_player_date_idx on public.player_game_stats (player_id, game_date desc);
create index player_game_stats_season_idx on public.player_game_stats (season_id, season_type);
create index player_game_stats_team_idx on public.player_game_stats (team_id, game_date desc);

create table public.team_game_stats (
  game_id bigint not null references public.games (id) on delete cascade,
  team_id bigint not null references public.teams (id),
  opponent_team_id bigint not null references public.teams (id),
  season_id smallint not null references public.seasons (id),
  season_type public.season_type not null,
  game_date date not null,
  is_home boolean not null,
  won boolean not null,
  pts smallint not null,
  opp_pts smallint not null,
  fgm smallint not null, fga smallint not null,
  fg3m smallint not null, fg3a smallint not null,
  ftm smallint not null, fta smallint not null,
  oreb smallint, dreb smallint, reb smallint not null,
  ast smallint not null, stl smallint not null, blk smallint not null,
  tov smallint not null, pf smallint not null,
  possessions numeric(6, 2),               -- estimativa: fga - oreb + tov + 0.44*fta
  primary key (game_id, team_id),
  check (team_id <> opponent_team_id)
);

create index team_game_stats_team_date_idx on public.team_game_stats (team_id, game_date desc);
create index team_game_stats_season_idx on public.team_game_stats (season_id, season_type);

-- ---------------------------------------------------------------------------
-- Agregados por temporada (recalculados pelo worker)
-- ---------------------------------------------------------------------------

create table public.player_season_stats (
  player_id bigint not null references public.players (id),
  season_id smallint not null references public.seasons (id),
  season_type public.season_type not null,
  last_team_id bigint references public.teams (id),
  games_played smallint not null default 0,
  games_started smallint not null default 0,
  seconds_played integer not null default 0,
  pts integer not null default 0,
  fgm integer not null default 0, fga integer not null default 0,
  fg3m integer not null default 0, fg3a integer not null default 0,
  ftm integer not null default 0, fta integer not null default 0,
  oreb integer, dreb integer, reb integer not null default 0,
  ast integer not null default 0, stl integer not null default 0,
  blk integer not null default 0, tov integer not null default 0,
  pf integer not null default 0,
  plus_minus integer,
  double_doubles smallint not null default 0,
  triple_doubles smallint not null default 0,
  pts_stddev numeric(6, 2),                -- para o índice de consistência
  is_complete boolean not null default false,
  computed_at timestamptz not null default now(),
  primary key (player_id, season_id, season_type)
);

create index player_season_stats_season_idx on public.player_season_stats (season_id, season_type);

create table public.team_season_stats (
  team_id bigint not null references public.teams (id),
  season_id smallint not null references public.seasons (id),
  season_type public.season_type not null,
  games_played smallint not null default 0,
  wins smallint not null default 0,
  losses smallint not null default 0,
  pts integer not null default 0,
  opp_pts integer not null default 0,
  fgm integer not null default 0, fga integer not null default 0,
  fg3m integer not null default 0, fg3a integer not null default 0,
  ftm integer not null default 0, fta integer not null default 0,
  oreb integer, dreb integer, reb integer not null default 0,
  ast integer not null default 0, stl integer not null default 0,
  blk integer not null default 0, tov integer not null default 0,
  pf integer not null default 0,
  possessions numeric(9, 2),
  opp_possessions numeric(9, 2),
  is_complete boolean not null default false,
  computed_at timestamptz not null default now(),
  primary key (team_id, season_id, season_type),
  check (wins + losses = games_played)
);

create table public.standings (
  season_id smallint not null references public.seasons (id),
  team_id bigint not null references public.teams (id),
  conference text not null check (conference in ('East', 'West')),
  conference_rank smallint not null,
  wins smallint not null,
  losses smallint not null,
  win_pct numeric(4, 3) not null,
  games_behind numeric(4, 1) not null,
  home_wins smallint not null, home_losses smallint not null,
  away_wins smallint not null, away_losses smallint not null,
  last10_wins smallint not null, last10_losses smallint not null,
  streak smallint not null,                -- positivo = vitórias seguidas, negativo = derrotas
  computed_at timestamptz not null default now(),
  primary key (season_id, team_id)
);

-- Médias por jogo (views respeitam o RLS das tabelas base)
create view public.player_season_averages
with (security_invoker = true)
as
select
  s.player_id, s.season_id, s.season_type, s.last_team_id,
  s.games_played, s.games_started, s.is_complete,
  round(s.seconds_played::numeric / nullif(s.games_played, 0) / 60, 1) as min_pg,
  round(s.pts::numeric / nullif(s.games_played, 0), 1) as pts_pg,
  round(s.reb::numeric / nullif(s.games_played, 0), 1) as reb_pg,
  round(s.ast::numeric / nullif(s.games_played, 0), 1) as ast_pg,
  round(s.stl::numeric / nullif(s.games_played, 0), 1) as stl_pg,
  round(s.blk::numeric / nullif(s.games_played, 0), 1) as blk_pg,
  round(s.tov::numeric / nullif(s.games_played, 0), 1) as tov_pg,
  round(s.fgm::numeric / nullif(s.fga, 0), 3) as fg_pct,
  round(s.fg3m::numeric / nullif(s.fg3a, 0), 3) as fg3_pct,
  round(s.ftm::numeric / nullif(s.fta, 0), 3) as ft_pct,
  round((s.fgm + 0.5 * s.fg3m) / nullif(s.fga, 0), 3) as efg_pct,
  round(s.pts / nullif(2 * (s.fga + 0.44 * s.fta), 0), 3) as ts_pct,
  s.double_doubles, s.triple_doubles,
  round(s.pts_stddev / nullif(s.pts::numeric / nullif(s.games_played, 0), 0), 3) as pts_cv
from public.player_season_stats s;

create view public.team_season_averages
with (security_invoker = true)
as
select
  t.team_id, t.season_id, t.season_type, t.games_played, t.wins, t.losses, t.is_complete,
  round(t.pts::numeric / nullif(t.games_played, 0), 1) as pts_pg,
  round(t.opp_pts::numeric / nullif(t.games_played, 0), 1) as opp_pts_pg,
  round(t.reb::numeric / nullif(t.games_played, 0), 1) as reb_pg,
  round(t.ast::numeric / nullif(t.games_played, 0), 1) as ast_pg,
  round(t.fgm::numeric / nullif(t.fga, 0), 3) as fg_pct,
  round(t.fg3m::numeric / nullif(t.fg3a, 0), 3) as fg3_pct,
  round(t.ftm::numeric / nullif(t.fta, 0), 3) as ft_pct,
  round(100 * t.pts / nullif(t.possessions, 0), 1) as off_rating,
  round(100 * t.opp_pts / nullif(t.opp_possessions, 0), 1) as def_rating
from public.team_season_stats t;

-- ---------------------------------------------------------------------------
-- Sincronização (uso interno)
-- ---------------------------------------------------------------------------

create type public.sync_job_type as enum
  ('schedule', 'status_poll', 'ingest_game', 'reconcile', 'backfill', 'reference_data', 'recompute', 'expire_subscriptions');
create type public.sync_job_status as enum ('running', 'succeeded', 'partial', 'failed', 'skipped');

create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type public.sync_job_type not null,
  status public.sync_job_status not null default 'running',
  trigger text not null default 'cron',    -- 'cron' | 'manual'
  params jsonb not null default '{}',
  items_expected integer,
  items_processed integer not null default 0,
  items_failed integer not null default 0,
  provider_requests integer not null default 0,
  error jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index sync_jobs_status_started_idx on public.sync_jobs (status, started_at desc);
create index sync_jobs_type_started_idx on public.sync_jobs (job_type, started_at desc);

create table public.sync_logs (
  id bigint generated always as identity primary key,
  job_id uuid references public.sync_jobs (id) on delete cascade,
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  message text not null,
  context jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index sync_logs_job_idx on public.sync_logs (job_id, created_at);
create index sync_logs_level_idx on public.sync_logs (level, created_at desc) where level in ('warn', 'error');

create table public.provider_quota_usage (
  provider_id smallint not null references public.data_providers (id),
  usage_date date not null,                -- dia em UTC
  requests_used integer not null default 0 check (requests_used >= 0),
  primary key (provider_id, usage_date)
);

-- Reserva atômica de cota diária: retorna true se ainda havia cota disponível.
-- O limite por minuto (API-NBA: 10/min) é controlado no cliente HTTP do worker.
create or replace function public.try_consume_provider_quota(p_provider_id smallint, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
begin
  insert into public.provider_quota_usage (provider_id, usage_date, requests_used)
  values (p_provider_id, (now() at time zone 'utc')::date, 1)
  on conflict (provider_id, usage_date)
  do update set requests_used = public.provider_quota_usage.requests_used + 1
  where public.provider_quota_usage.requests_used < p_limit
  returning requests_used into v_used;

  return v_used is not null;
end;
$$;

revoke execute on function public.try_consume_provider_quota(smallint, integer) from public, anon, authenticated;

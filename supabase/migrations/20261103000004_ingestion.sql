-- Tabelinha — 0004: funções da ingestão de dados esportivos
-- Aplicada no Supabase em 03/11/2026 (SQL Editor), com autorização do usuário. Não editar: mudanças vão em uma nova migration.
--
-- Toda escrita da ingestão passa por estas funções (chamadas via RPC com a chave secreta).
-- Cada função é atômica: ou grava tudo, ou nada. Nenhuma pode ser executada por anon/authenticated.

-- ---------------------------------------------------------------------------
-- Trava de execução (evita dois crons processando ao mesmo tempo)
-- ---------------------------------------------------------------------------

create table public.job_locks (
  name text primary key,
  holder text not null,
  locked_until timestamptz not null
);

alter table public.job_locks enable row level security;

create or replace function public.ingest_acquire_lock(p_name text, p_holder text, p_ttl_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  insert into public.job_locks (name, holder, locked_until)
  values (p_name, p_holder, now() + make_interval(secs => p_ttl_seconds))
  on conflict (name) do update
    set holder = excluded.holder, locked_until = excluded.locked_until
    where public.job_locks.locked_until < now() or public.job_locks.holder = excluded.holder
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

create or replace function public.ingest_release_lock(p_name text, p_holder text)
returns boolean
language sql
set search_path = ''
as $$
  with d as (delete from public.job_locks where name = p_name and holder = p_holder returning 1)
  select exists (select 1 from d);
$$;

-- ---------------------------------------------------------------------------
-- Provedores, cota e registro de execução
-- ---------------------------------------------------------------------------

create or replace function public.ingest_provider_id(p_slug text)
returns smallint
language plpgsql
set search_path = ''
as $$
declare
  v_id smallint;
begin
  select id into v_id from public.data_providers where slug = p_slug;
  if v_id is null then
    insert into public.data_providers (slug, name) values (p_slug, p_slug)
    on conflict (slug) do nothing;
    select id into v_id from public.data_providers where slug = p_slug;
  end if;
  return v_id;
end;
$$;

create or replace function public.ingest_consume_quota(p_provider_slug text, p_limit integer)
returns boolean
language sql
set search_path = ''
as $$
  select public.try_consume_provider_quota(public.ingest_provider_id(p_provider_slug), p_limit);
$$;

create or replace function public.ingest_start_job(p_job_type public.sync_job_type, p_trigger text, p_params jsonb)
returns uuid
language sql
set search_path = ''
as $$
  insert into public.sync_jobs (job_type, trigger, params) values (p_job_type, p_trigger, coalesce(p_params, '{}'))
  returning id;
$$;

create or replace function public.ingest_finish_job(
  p_job_id uuid,
  p_status public.sync_job_status,
  p_items_expected integer,
  p_items_processed integer,
  p_items_failed integer,
  p_provider_requests integer,
  p_error jsonb
)
returns boolean
language sql
set search_path = ''
as $$
  with u as (
    update public.sync_jobs
       set status = p_status, items_expected = p_items_expected, items_processed = p_items_processed,
           items_failed = p_items_failed, provider_requests = p_provider_requests, error = p_error, finished_at = now()
     where id = p_job_id
    returning 1
  )
  select exists (select 1 from u);
$$;

create or replace function public.ingest_log(p_job_id uuid, p_level text, p_message text, p_context jsonb)
returns boolean
language sql
set search_path = ''
as $$
  insert into public.sync_logs (job_id, level, message, context) values (p_job_id, p_level, p_message, coalesce(p_context, '{}'))
  returning true;
$$;

create or replace function public.ingest_save_ref(p_provider_slug text, p_entity_type public.entity_type, p_external_id text, p_entity_id bigint)
returns boolean
language sql
set search_path = ''
as $$
  insert into public.external_refs (provider_id, entity_type, external_id, entity_id)
  values (public.ingest_provider_id(p_provider_slug), p_entity_type, p_external_id, p_entity_id)
  on conflict (provider_id, entity_type, external_id) do update set entity_id = excluded.entity_id
  returning true;
$$;

-- ---------------------------------------------------------------------------
-- Times e temporadas
-- ---------------------------------------------------------------------------

-- p_teams: [{ external_id, abbreviation, city, nickname, full_name, conference, division }]
-- A sigla é a chave comum entre os provedores.
create or replace function public.ingest_upsert_teams(p_provider_slug text, p_teams jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_provider smallint := public.ingest_provider_id(p_provider_slug);
  v_count integer := 0;
  t record;
  v_team_id bigint;
begin
  for t in
    select * from jsonb_to_recordset(p_teams)
      as x(external_id text, abbreviation text, city text, nickname text, full_name text, conference text, division text)
  loop
    insert into public.teams (abbreviation, city, nickname, full_name, conference, division)
    values (t.abbreviation, t.city, t.nickname, t.full_name, t.conference, t.division)
    on conflict (abbreviation) do update
      set city = excluded.city, nickname = excluded.nickname, full_name = excluded.full_name,
          conference = coalesce(excluded.conference, public.teams.conference),
          division = coalesce(excluded.division, public.teams.division)
    returning id into v_team_id;

    insert into public.external_refs (provider_id, entity_type, external_id, entity_id)
    values (v_provider, 'team', t.external_id, v_team_id)
    on conflict (provider_id, entity_type, external_id) do update set entity_id = excluded.entity_id;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.ingest_ensure_season(p_start_year smallint)
returns smallint
language plpgsql
set search_path = ''
as $$
declare
  v_id smallint;
  v_max smallint;
begin
  insert into public.seasons (start_year, label)
  values (p_start_year, p_start_year || '-' || lpad(((p_start_year + 1) % 100)::text, 2, '0'))
  on conflict (start_year) do nothing;
  select id into v_id from public.seasons where start_year = p_start_year;

  -- A temporada atual é sempre a mais recente
  select max(start_year) into v_max from public.seasons;
  update public.seasons set is_current = false where is_current and start_year <> v_max;
  update public.seasons set is_current = true where start_year = v_max and not is_current;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Jogos (calendário e status)
-- ---------------------------------------------------------------------------

-- p_games: [{ external_id, season_start_year, season_type, game_date, starts_at, status,
--             home, away (siglas), home_score, away_score, overtime_periods }]
-- Retorna [{ game_id, external_id, became_final }]. Não toca nas estatísticas do jogo.
-- p_now: instante de referência (o worker passa o próprio relógio).
create or replace function public.ingest_upsert_games(p_provider_slug text, p_games jsonb, p_now timestamptz default now())
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_provider smallint := public.ingest_provider_id(p_provider_slug);
  v_result jsonb := '[]';
  g record;
  v_season smallint;
  v_home bigint;
  v_away bigint;
  v_game_id bigint;
  v_prev public.game_status;
  v_became_final boolean;
begin
  for g in
    select * from jsonb_to_recordset(p_games) as x(
      external_id text, season_start_year smallint, season_type public.season_type, game_date date,
      starts_at timestamptz, status public.game_status, home text, away text,
      home_score smallint, away_score smallint, overtime_periods smallint)
  loop
    v_season := public.ingest_ensure_season(g.season_start_year);
    select id into v_home from public.teams where abbreviation = g.home;
    select id into v_away from public.teams where abbreviation = g.away;
    if v_home is null or v_away is null then
      raise exception 'unknown team in game %: % x %', g.external_id, g.home, g.away using errcode = 'P0002';
    end if;

    select entity_id into v_game_id from public.external_refs
     where provider_id = v_provider and entity_type = 'game' and external_id = g.external_id;

    if v_game_id is null then
      v_prev := null;
      insert into public.games (season_id, season_type, game_date, starts_at, status, home_team_id, away_team_id,
                                home_score, away_score, overtime_periods)
      values (v_season, g.season_type, g.game_date, g.starts_at, g.status, v_home, v_away,
              g.home_score, g.away_score, coalesce(g.overtime_periods, 0))
      returning id into v_game_id;
      insert into public.external_refs (provider_id, entity_type, external_id, entity_id)
      values (v_provider, 'game', g.external_id, v_game_id);
    else
      select status into v_prev from public.games where id = v_game_id;
      update public.games
         set season_id = v_season, season_type = g.season_type, game_date = g.game_date, starts_at = g.starts_at,
             status = g.status, home_team_id = v_home, away_team_id = v_away,
             home_score = g.home_score, away_score = g.away_score, overtime_periods = coalesce(g.overtime_periods, 0)
       where id = v_game_id;
    end if;

    v_became_final := g.status = 'final' and v_prev is distinct from 'final';
    if v_became_final then
      update public.games set finalized_at = coalesce(finalized_at, p_now) where id = v_game_id;
      insert into public.game_sync_state (game_id, next_check_at) values (v_game_id, p_now)
      on conflict (game_id) do nothing;
    end if;

    v_result := v_result || jsonb_build_object('game_id', v_game_id, 'external_id', g.external_id, 'became_final', v_became_final);
  end loop;
  return v_result;
end;
$$;

-- Jogos que já deveriam ter terminado mas ainda não estão como final (até 3 dias atrás)
create or replace function public.ingest_games_awaiting_final(p_now timestamptz, p_min_age_minutes integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('game_id', g.id, 'game_date', g.game_date) order by g.starts_at), '[]')
  from public.games g
  where g.status in ('scheduled', 'in_progress')
    and g.starts_at <= p_now - make_interval(mins => p_min_age_minutes)
    and g.starts_at >= p_now - interval '3 days';
$$;

-- Jogos encerrados com box score a buscar (primeira vez, nova tentativa ou reconciliação)
create or replace function public.ingest_due_games(p_now timestamptz, p_box_provider_slug text, p_limit integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(d) order by d.starts_at), '[]')
  from (
    select g.id as game_id, g.starts_at, g.game_date, g.season_id, g.season_type,
           g.home_team_id, g.away_team_id, th.abbreviation as home, ta.abbreviation as away,
           g.home_score, g.away_score, g.overtime_periods, g.stats_status, g.finalized_at,
           s.attempts, s.reconcile_stage,
           (select r.external_id from public.external_refs r
              join public.data_providers p on p.id = r.provider_id
             where p.slug = p_box_provider_slug and r.entity_type = 'game' and r.entity_id = g.id
             limit 1) as box_ref
    from public.game_sync_state s
    join public.games g on g.id = s.game_id
    join public.teams th on th.id = g.home_team_id
    join public.teams ta on ta.id = g.away_team_id
    where g.status = 'final'
      and s.reconciled_at is null
      and ((s.next_check_at is not null and s.next_check_at <= p_now)
        or (s.reconcile_at is not null and s.reconcile_at <= p_now))
    order by g.starts_at
    limit p_limit
  ) d;
$$;

create or replace function public.ingest_set_sync_state(
  p_game_id bigint,
  p_attempts integer,
  p_next_check_at timestamptz,
  p_reconcile_stage smallint,
  p_reconcile_at timestamptz,
  p_reconciled_at timestamptz,
  p_last_error text
)
returns boolean
language sql
set search_path = ''
as $$
  insert into public.game_sync_state (game_id, attempts, next_check_at, reconcile_stage, reconcile_at, reconciled_at, last_error)
  values (p_game_id, p_attempts, p_next_check_at, p_reconcile_stage, p_reconcile_at, p_reconciled_at, p_last_error)
  on conflict (game_id) do update
    set attempts = excluded.attempts, next_check_at = excluded.next_check_at,
        reconcile_stage = excluded.reconcile_stage, reconcile_at = excluded.reconcile_at,
        reconciled_at = excluded.reconciled_at, last_error = excluded.last_error
  returning true;
$$;

-- ---------------------------------------------------------------------------
-- Jogadores
-- ---------------------------------------------------------------------------

-- p_players: [{ external_id, first_name, last_name, search_name, position, team_id }]
-- Retorna { "<external_id>": player_id, ... }
create or replace function public.ingest_ensure_players(p_provider_slug text, p_players jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_provider smallint := public.ingest_provider_id(p_provider_slug);
  v_result jsonb := '{}';
  p record;
  v_id bigint;
begin
  for p in
    select * from jsonb_to_recordset(p_players)
      as x(external_id text, first_name text, last_name text, search_name text, position text, team_id bigint)
  loop
    select entity_id into v_id from public.external_refs
     where provider_id = v_provider and entity_type = 'player' and external_id = p.external_id;

    if v_id is null then
      insert into public.players (first_name, last_name, display_name, search_name, position, current_team_id)
      values (p.first_name, p.last_name, trim(p.first_name || ' ' || p.last_name), p.search_name, p.position, p.team_id)
      returning id into v_id;
      insert into public.external_refs (provider_id, entity_type, external_id, entity_id)
      values (v_provider, 'player', p.external_id, v_id);
    else
      update public.players
         set current_team_id = coalesce(p.team_id, current_team_id),
             position = coalesce(p.position, position)
       where id = v_id;
    end if;

    v_result := v_result || jsonb_build_object(p.external_id, v_id);
  end loop;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Box score
-- ---------------------------------------------------------------------------

-- Grava o box score de um jogo de forma idempotente.
-- p_player_lines: [{ player_id, team_id, is_starter, did_not_play, seconds_played, pts, fgm, fga, fg3m, fg3a,
--                    ftm, fta, oreb, dreb, reb, ast, stl, blk, tov, pf, plus_minus }]
-- p_team_totals:  [{ team_id, pts, fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, blk, tov, pf }] (2 times)
-- Retorna { changed, version }. Mesmo hash e mesmo status = nada muda.
create or replace function public.ingest_save_box_score(
  p_game_id bigint,
  p_stats_status public.stats_status,
  p_payload_hash text,
  p_player_lines jsonb,
  p_team_totals jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
  v_team_count integer;
begin
  if p_stats_status not in ('complete', 'partial') then
    raise exception 'ingest_save_box_score only accepts complete or partial (got %)', p_stats_status;
  end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game % not found', p_game_id using errcode = 'P0002';
  end if;

  select count(distinct x.team_id) into v_team_count
  from jsonb_to_recordset(p_team_totals) as x(team_id bigint)
  where x.team_id in (v_game.home_team_id, v_game.away_team_id);
  if v_team_count <> 2 or jsonb_array_length(p_team_totals) <> 2 then
    raise exception 'team totals must contain exactly the two teams of game %', p_game_id;
  end if;

  if v_game.payload_hash is not distinct from p_payload_hash and v_game.stats_status = p_stats_status then
    update public.games set last_synced_at = now() where id = p_game_id;
    return jsonb_build_object('changed', false, 'version', v_game.version);
  end if;

  delete from public.player_game_stats where game_id = p_game_id;
  delete from public.team_game_stats where game_id = p_game_id;

  insert into public.player_game_stats (
    game_id, player_id, team_id, season_id, season_type, game_date, is_starter, did_not_play, seconds_played,
    pts, fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, blk, tov, pf, plus_minus)
  select p_game_id, l.player_id, l.team_id, v_game.season_id, v_game.season_type, v_game.game_date,
         l.is_starter, l.did_not_play, l.seconds_played,
         l.pts, l.fgm, l.fga, l.fg3m, l.fg3a, l.ftm, l.fta, l.oreb, l.dreb, l.reb, l.ast, l.stl, l.blk, l.tov, l.pf, l.plus_minus
  from jsonb_to_recordset(p_player_lines) as l(
    player_id bigint, team_id bigint, is_starter boolean, did_not_play boolean, seconds_played integer,
    pts smallint, fgm smallint, fga smallint, fg3m smallint, fg3a smallint, ftm smallint, fta smallint,
    oreb smallint, dreb smallint, reb smallint, ast smallint, stl smallint, blk smallint, tov smallint, pf smallint,
    plus_minus smallint);

  insert into public.team_game_stats (
    game_id, team_id, opponent_team_id, season_id, season_type, game_date, is_home, won, pts, opp_pts,
    fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, blk, tov, pf, possessions)
  select p_game_id, t.team_id, o.team_id, v_game.season_id, v_game.season_type, v_game.game_date,
         t.team_id = v_game.home_team_id, t.pts > o.pts, t.pts, o.pts,
         t.fgm, t.fga, t.fg3m, t.fg3a, t.ftm, t.fta, t.oreb, t.dreb, t.reb, t.ast, t.stl, t.blk, t.tov, t.pf,
         case when t.oreb is null then null else round(t.fga - t.oreb + t.tov + 0.44 * t.fta, 2) end
  from jsonb_to_recordset(p_team_totals) as t(
    team_id bigint, pts smallint, fgm smallint, fga smallint, fg3m smallint, fg3a smallint, ftm smallint, fta smallint,
    oreb smallint, dreb smallint, reb smallint, ast smallint, stl smallint, blk smallint, tov smallint, pf smallint)
  join jsonb_to_recordset(p_team_totals) as o(team_id bigint, pts smallint) on o.team_id <> t.team_id;

  update public.games
     set stats_status = p_stats_status, payload_hash = p_payload_hash, version = version + 1, last_synced_at = now()
   where id = p_game_id;

  return jsonb_build_object('changed', true, 'version', v_game.version + 1);
end;
$$;

-- Marca o jogo como inválido só se ainda não houver dados bons gravados (nunca apaga dados válidos)
create or replace function public.ingest_mark_invalid(p_game_id bigint)
returns boolean
language sql
set search_path = ''
as $$
  with u as (
    update public.games set stats_status = 'invalid', last_synced_at = now()
     where id = p_game_id and stats_status in ('pending', 'invalid')
    returning 1
  )
  select exists (select 1 from u);
$$;

-- ---------------------------------------------------------------------------
-- Agregados por temporada
-- ---------------------------------------------------------------------------

-- Recalcula totais de jogadores e times. Listas nulas = todos da temporada.
-- Só usa jogos com box score complete ou partial (docs/STATS_FORMULAS.md, seção 2.1).
create or replace function public.recompute_season_aggregates(
  p_season_id smallint,
  p_season_type public.season_type,
  p_player_ids bigint[] default null,
  p_team_ids bigint[] default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  -- Jogadores
  with lines as (
    select s.*
    from public.player_game_stats s
    join public.games g on g.id = s.game_id
    where s.season_id = p_season_id and s.season_type = p_season_type
      and g.stats_status in ('complete', 'partial')
      and (p_player_ids is null or s.player_id = any (p_player_ids))
  ),
  agg as (
    select
      player_id,
      count(*) filter (where seconds_played > 0) as gp,
      count(*) filter (where is_starter and seconds_played > 0) as gs,
      sum(seconds_played) as secs,
      sum(pts) as pts, sum(fgm) as fgm, sum(fga) as fga, sum(fg3m) as fg3m, sum(fg3a) as fg3a,
      sum(ftm) as ftm, sum(fta) as fta, sum(oreb) as oreb, sum(dreb) as dreb, sum(reb) as reb,
      sum(ast) as ast, sum(stl) as stl, sum(blk) as blk, sum(tov) as tov, sum(pf) as pf,
      sum(plus_minus) as plus_minus,
      count(*) filter (where (pts >= 10)::int + (reb >= 10)::int + (ast >= 10)::int + (stl >= 10)::int + (blk >= 10)::int >= 2) as dd,
      count(*) filter (where (pts >= 10)::int + (reb >= 10)::int + (ast >= 10)::int + (stl >= 10)::int + (blk >= 10)::int >= 3) as td,
      round(stddev_pop(pts) filter (where seconds_played > 0), 2) as sd,
      (array_agg(team_id order by game_date desc, game_id desc))[1] as last_team
    from lines
    group by player_id
  )
  insert into public.player_season_stats (
    player_id, season_id, season_type, last_team_id, games_played, games_started, seconds_played,
    pts, fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, blk, tov, pf, plus_minus,
    double_doubles, triple_doubles, pts_stddev, team_partial_games, is_complete, computed_at)
  select
    a.player_id, p_season_id, p_season_type, a.last_team, a.gp, a.gs, a.secs,
    a.pts, a.fgm, a.fga, a.fg3m, a.fg3a, a.ftm, a.fta, a.oreb, a.dreb, a.reb, a.ast, a.stl, a.blk, a.tov, a.pf, a.plus_minus,
    a.dd, a.td, a.sd,
    (select count(*) from public.games g
      where g.season_id = p_season_id and g.season_type = p_season_type and g.status = 'final'
        and g.stats_status = 'partial' and a.last_team in (g.home_team_id, g.away_team_id)),
    not exists (select 1 from public.games g
      where g.season_id = p_season_id and g.season_type = p_season_type and g.status = 'final'
        and g.stats_status <> 'complete' and a.last_team in (g.home_team_id, g.away_team_id)),
    now()
  from agg a
  on conflict (player_id, season_id, season_type) do update set
    last_team_id = excluded.last_team_id, games_played = excluded.games_played, games_started = excluded.games_started,
    seconds_played = excluded.seconds_played, pts = excluded.pts, fgm = excluded.fgm, fga = excluded.fga,
    fg3m = excluded.fg3m, fg3a = excluded.fg3a, ftm = excluded.ftm, fta = excluded.fta, oreb = excluded.oreb,
    dreb = excluded.dreb, reb = excluded.reb, ast = excluded.ast, stl = excluded.stl, blk = excluded.blk,
    tov = excluded.tov, pf = excluded.pf, plus_minus = excluded.plus_minus, double_doubles = excluded.double_doubles,
    triple_doubles = excluded.triple_doubles, pts_stddev = excluded.pts_stddev,
    team_partial_games = excluded.team_partial_games, is_complete = excluded.is_complete, computed_at = excluded.computed_at;

  -- Times (totais vêm de team_game_stats, que é o total oficial da fonte)
  with tg as (
    select t.*, o.possessions as opp_poss
    from public.team_game_stats t
    join public.games g on g.id = t.game_id
    left join public.team_game_stats o on o.game_id = t.game_id and o.team_id = t.opponent_team_id
    where t.season_id = p_season_id and t.season_type = p_season_type
      and g.stats_status in ('complete', 'partial')
      and (p_team_ids is null or t.team_id = any (p_team_ids))
  ),
  agg as (
    select team_id, count(*) as gp, count(*) filter (where won) as w, count(*) filter (where not won) as l,
           sum(pts) as pts, sum(opp_pts) as opp_pts, sum(fgm) as fgm, sum(fga) as fga, sum(fg3m) as fg3m, sum(fg3a) as fg3a,
           sum(ftm) as ftm, sum(fta) as fta, sum(oreb) as oreb, sum(dreb) as dreb, sum(reb) as reb, sum(ast) as ast,
           sum(stl) as stl, sum(blk) as blk, sum(tov) as tov, sum(pf) as pf,
           sum(possessions) as poss, sum(opp_poss) as opp_poss
    from tg
    group by team_id
  )
  insert into public.team_season_stats (
    team_id, season_id, season_type, games_played, wins, losses, pts, opp_pts, fgm, fga, fg3m, fg3a, ftm, fta,
    oreb, dreb, reb, ast, stl, blk, tov, pf, possessions, opp_possessions, is_complete, computed_at)
  select a.team_id, p_season_id, p_season_type, a.gp, a.w, a.l, a.pts, a.opp_pts, a.fgm, a.fga, a.fg3m, a.fg3a, a.ftm, a.fta,
         a.oreb, a.dreb, a.reb, a.ast, a.stl, a.blk, a.tov, a.pf, a.poss, a.opp_poss,
         not exists (select 1 from public.games g
           where g.season_id = p_season_id and g.season_type = p_season_type and g.status = 'final'
             and g.stats_status not in ('complete', 'partial') and a.team_id in (g.home_team_id, g.away_team_id)),
         now()
  from agg a
  on conflict (team_id, season_id, season_type) do update set
    games_played = excluded.games_played, wins = excluded.wins, losses = excluded.losses, pts = excluded.pts,
    opp_pts = excluded.opp_pts, fgm = excluded.fgm, fga = excluded.fga, fg3m = excluded.fg3m, fg3a = excluded.fg3a,
    ftm = excluded.ftm, fta = excluded.fta, oreb = excluded.oreb, dreb = excluded.dreb, reb = excluded.reb,
    ast = excluded.ast, stl = excluded.stl, blk = excluded.blk, tov = excluded.tov, pf = excluded.pf,
    possessions = excluded.possessions, opp_possessions = excluded.opp_possessions,
    is_complete = excluded.is_complete, computed_at = excluded.computed_at;

  return true;
end;
$$;

-- Classificação da temporada regular a partir dos placares (não depende do box score).
-- Desempate simplificado: aproveitamento, depois vitórias, depois sigla.
create or replace function public.recompute_standings(p_season_id smallint)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  delete from public.standings where season_id = p_season_id;

  with results as (
    select g.id, g.game_date, g.starts_at, r.team_id, r.is_home, r.won
    from public.games g
    cross join lateral (values
      (g.home_team_id, true, g.home_score > g.away_score),
      (g.away_team_id, false, g.away_score > g.home_score)) as r(team_id, is_home, won)
    where g.season_id = p_season_id and g.season_type = 'regular' and g.status = 'final'
  ),
  ordered as (
    select r.*, row_number() over (partition by r.team_id order by r.game_date desc, r.starts_at desc nulls last, r.id desc) as rn
    from results r
  ),
  first_result as (
    select team_id, won as first_won from ordered where rn = 1
  ),
  streaks as (
    select o.team_id, f.first_won,
           coalesce(min(o.rn) filter (where o.won <> f.first_won) - 1, count(*)) as len
    from ordered o join first_result f using (team_id)
    group by o.team_id, f.first_won
  ),
  agg as (
    select team_id,
           count(*) filter (where won) as w, count(*) filter (where not won) as l,
           count(*) filter (where won and is_home) as hw, count(*) filter (where not won and is_home) as hl,
           count(*) filter (where won and not is_home) as aw, count(*) filter (where not won and not is_home) as al,
           count(*) filter (where won and rn <= 10) as l10w, count(*) filter (where not won and rn <= 10) as l10l
    from ordered
    group by team_id
  ),
  base as (
    select t.id as team_id, t.abbreviation, t.conference,
           coalesce(a.w, 0) as w, coalesce(a.l, 0) as l, coalesce(a.hw, 0) as hw, coalesce(a.hl, 0) as hl,
           coalesce(a.aw, 0) as aw, coalesce(a.al, 0) as al, coalesce(a.l10w, 0) as l10w, coalesce(a.l10l, 0) as l10l,
           case when s.team_id is null then 0 when s.first_won then s.len else -s.len end as streak,
           case when coalesce(a.w, 0) + coalesce(a.l, 0) = 0 then 0
                else a.w::numeric / (a.w + a.l) end as pct
    from public.teams t
    left join agg a on a.team_id = t.id
    left join streaks s on s.team_id = t.id
    where t.is_active and t.conference is not null
  ),
  ranked as (
    select b.*,
           row_number() over (partition by conference order by pct desc, w desc, abbreviation) as rk,
           first_value(w) over (partition by conference order by pct desc, w desc, abbreviation) as lead_w,
           first_value(l) over (partition by conference order by pct desc, w desc, abbreviation) as lead_l
    from base b
  )
  insert into public.standings (
    season_id, team_id, conference, conference_rank, wins, losses, win_pct, games_behind,
    home_wins, home_losses, away_wins, away_losses, last10_wins, last10_losses, streak, computed_at)
  select p_season_id, team_id, conference, rk, w, l, round(pct, 3),
         ((lead_w - w) + (l - lead_l)) / 2.0, hw, hl, aw, al, l10w, l10l, streak, now()
  from ranked;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões: somente service role (chave secreta) executa estas funções
-- ---------------------------------------------------------------------------

revoke execute on function public.ingest_acquire_lock(text, text, integer) from public, anon, authenticated;
revoke execute on function public.ingest_release_lock(text, text) from public, anon, authenticated;
revoke execute on function public.ingest_provider_id(text) from public, anon, authenticated;
revoke execute on function public.ingest_consume_quota(text, integer) from public, anon, authenticated;
revoke execute on function public.ingest_start_job(public.sync_job_type, text, jsonb) from public, anon, authenticated;
revoke execute on function public.ingest_finish_job(uuid, public.sync_job_status, integer, integer, integer, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.ingest_log(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.ingest_save_ref(text, public.entity_type, text, bigint) from public, anon, authenticated;
revoke execute on function public.ingest_upsert_teams(text, jsonb) from public, anon, authenticated;
revoke execute on function public.ingest_ensure_season(smallint) from public, anon, authenticated;
revoke execute on function public.ingest_upsert_games(text, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.ingest_games_awaiting_final(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.ingest_due_games(timestamptz, text, integer) from public, anon, authenticated;
revoke execute on function public.ingest_set_sync_state(bigint, integer, timestamptz, smallint, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.ingest_ensure_players(text, jsonb) from public, anon, authenticated;
revoke execute on function public.ingest_save_box_score(bigint, public.stats_status, text, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.ingest_mark_invalid(bigint) from public, anon, authenticated;
revoke execute on function public.recompute_season_aggregates(smallint, public.season_type, bigint[], bigint[]) from public, anon, authenticated;
revoke execute on function public.recompute_standings(smallint) from public, anon, authenticated;

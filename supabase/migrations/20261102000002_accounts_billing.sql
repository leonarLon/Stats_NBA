-- Tabelinha — 0002: perfis, planos, assinaturas, pagamentos e auditoria
-- Aplicada no Supabase em 03/11/2026 (SQL Editor), com autorização do usuário. Não editar: mudanças vão em uma nova migration.

create type public.subscription_status as enum
  ('trialing', 'pending', 'incomplete', 'active', 'past_due', 'canceled', 'expired');

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  favorite_team_id bigint references public.teams (id),
  trial_started_at timestamptz,            -- preenchido uma única vez
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente no cadastro
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Planos
-- ---------------------------------------------------------------------------

create table public.plans (
  id text primary key,                     -- 'monthly'
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'BRL',
  billing_interval text not null check (billing_interval in ('month', 'year')),
  mp_preapproval_plan_id text unique,      -- ID do plano no Mercado Pago
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Preço provisório; ajustável sem migration
insert into public.plans (id, name, price_cents, billing_interval)
values ('monthly', 'Tabelinha Mensal', 1990, 'month');

-- ---------------------------------------------------------------------------
-- Assinaturas
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id text references public.plans (id),       -- nulo durante o teste grátis
  status public.subscription_status not null,
  provider text check (provider in ('mercadopago')),
  provider_subscription_id text,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id),
  check (status <> 'trialing' or trial_ends_at is not null),
  check (status not in ('active', 'past_due', 'canceled') or current_period_end is not null)
);

-- No máximo uma assinatura paga vigente, um checkout pendente e um teste por usuário.
-- O teste e a assinatura paga podem coexistir (quem assina durante o teste não perde dias).
create unique index subscriptions_one_paid_per_user_idx on public.subscriptions (user_id)
  where status in ('active', 'past_due');
create unique index subscriptions_one_pending_per_user_idx on public.subscriptions (user_id)
  where status = 'pending';
create unique index subscriptions_one_trial_per_user_idx on public.subscriptions (user_id)
  where status = 'trialing';

create index subscriptions_user_idx on public.subscriptions (user_id, created_at desc);
create index subscriptions_period_end_idx on public.subscriptions (current_period_end)
  where status in ('active', 'past_due', 'canceled');

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Regra única de acesso premium.
-- user_has_access(uuid): uso do servidor (service role).
-- has_active_access(): uso do RLS; só consulta o próprio usuário (auth.uid()).
create or replace function public.user_has_access(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and (
        (s.status = 'trialing' and s.trial_ends_at > now())
        or (s.status in ('active', 'past_due', 'canceled') and s.current_period_end > now())
      )
  );
$$;

revoke execute on function public.user_has_access(uuid) from public, anon, authenticated;

create or replace function public.has_active_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and public.user_has_access(auth.uid());
$$;

revoke execute on function public.has_active_access() from public, anon;
grant execute on function public.has_active_access() to authenticated;

-- Início do teste grátis: uma vez por conta, 3 dias, chamado pelo servidor
create or replace function public.start_trial(p_user_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  update public.profiles
     set trial_started_at = now()
   where id = p_user_id and trial_started_at is null;

  if not found then
    raise exception 'trial_already_used' using errcode = 'P0001';
  end if;

  insert into public.subscriptions (user_id, status, trial_ends_at)
  values (p_user_id, 'trialing', now() + interval '3 days')
  returning * into v_sub;

  return v_sub;
end;
$$;

revoke execute on function public.start_trial(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pagamentos
-- ---------------------------------------------------------------------------

create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  resource_id text,
  payload jsonb not null,
  signature_valid boolean not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, provider_event_id)
);

create index payment_events_unprocessed_idx on public.payment_events (received_at)
  where processed_at is null;

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider text not null,
  provider_payment_id text not null,
  status text not null,                    -- 'approved', 'rejected', 'refunded', ...
  method text,                             -- 'credit_card', 'pix', ...
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create index payment_transactions_user_idx on public.payment_transactions (user_id, created_at desc);

create trigger payment_transactions_updated_at before update on public.payment_transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid,                      -- nulo = sistema
  action text not null,                    -- 'subscription.status_changed', 'game.reprocessed', ...
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_logs_target_idx on public.audit_logs (target_type, target_id, created_at desc);

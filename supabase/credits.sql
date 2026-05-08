create extension if not exists pgcrypto;

create table if not exists public.user_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_points integer not null default 0 check (balance_points >= 0),
  frozen_points integer not null default 0 check (frozen_points >= 0),
  lifetime_granted_points integer not null default 0 check (lifetime_granted_points >= 0),
  lifetime_spent_points integer not null default 0 check (lifetime_spent_points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint frozen_not_above_balance check (frozen_points <= balance_points)
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('grant', 'reserve', 'spend', 'refund', 'adjust')),
  status text not null check (status in ('completed', 'pending', 'refunded', 'failed')),
  points integer not null check (points > 0),
  feature text,
  model text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  related_transaction_id uuid references public.credit_transactions(id),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table if not exists public.credit_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  feature text not null,
  model text not null,
  rule jsonb not null default '{}'::jsonb,
  points integer not null check (points > 0),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (feature, model, rule)
);

create index if not exists credit_transactions_user_created_idx
  on public.credit_transactions (user_id, created_at desc);

alter table public.user_credit_accounts enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.credit_pricing_rules enable row level security;

drop policy if exists "Users can read own credit account" on public.user_credit_accounts;
create policy "Users can read own credit account"
  on public.user_credit_accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own credit transactions" on public.credit_transactions;
create policy "Users can read own credit transactions"
  on public.credit_transactions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read enabled pricing rules" on public.credit_pricing_rules;
create policy "Users can read enabled pricing rules"
  on public.credit_pricing_rules for select
  using (is_enabled = true);

create or replace function public.touch_credit_account_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_credit_account_updated_at on public.user_credit_accounts;
create trigger touch_credit_account_updated_at
  before update on public.user_credit_accounts
  for each row execute function public.touch_credit_account_updated_at();

create or replace function public.grant_user_credits(
  p_user_id uuid,
  p_points integer,
  p_reason text default 'manual grant'
)
returns table (
  transaction_id uuid,
  balance_points integer,
  frozen_points integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_points <= 0 then
    raise exception 'INVALID_CREDIT_POINTS';
  end if;

  insert into public.user_credit_accounts (user_id, balance_points, lifetime_granted_points)
  values (p_user_id, p_points, p_points)
  on conflict (user_id) do update
    set balance_points = user_credit_accounts.balance_points + excluded.balance_points,
        lifetime_granted_points = user_credit_accounts.lifetime_granted_points + excluded.lifetime_granted_points;

  insert into public.credit_transactions (user_id, type, status, points, reason, settled_at)
  values (p_user_id, 'grant', 'completed', p_points, p_reason, now())
  returning id into transaction_id;

  select a.balance_points, a.frozen_points
  into balance_points, frozen_points
  from public.user_credit_accounts a
  where a.user_id = p_user_id;

  return next;
end;
$$;

create or replace function public.reserve_user_credits(
  p_user_id uuid,
  p_points integer,
  p_feature text,
  p_model text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  transaction_id uuid,
  balance_points integer,
  frozen_points integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_points <= 0 then
    raise exception 'INVALID_CREDIT_POINTS';
  end if;

  insert into public.user_credit_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.user_credit_accounts a
  set frozen_points = a.frozen_points + p_points
  where a.user_id = p_user_id
    and a.balance_points - a.frozen_points >= p_points
  returning a.balance_points, a.frozen_points
  into balance_points, frozen_points;

  if not found then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.credit_transactions (user_id, type, status, points, feature, model, metadata)
  values (p_user_id, 'reserve', 'pending', p_points, p_feature, p_model, coalesce(p_metadata, '{}'::jsonb))
  returning id into transaction_id;

  return next;
end;
$$;

create or replace function public.settle_credit_reservation(
  p_transaction_id uuid
)
returns table (
  transaction_id uuid,
  balance_points integer,
  frozen_points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.credit_transactions%rowtype;
begin
  select *
  into tx
  from public.credit_transactions
  where id = p_transaction_id
    and type = 'reserve'
  for update;

  if not found then
    raise exception 'CREDIT_TRANSACTION_NOT_FOUND';
  end if;

  if tx.status = 'completed' then
    transaction_id := tx.id;
    select a.balance_points, a.frozen_points
    into balance_points, frozen_points
    from public.user_credit_accounts a
    where a.user_id = tx.user_id;
    return next;
    return;
  end if;

  if tx.status <> 'pending' then
    raise exception 'CREDIT_TRANSACTION_NOT_PENDING';
  end if;

  update public.user_credit_accounts a
  set balance_points = a.balance_points - tx.points,
      frozen_points = a.frozen_points - tx.points,
      lifetime_spent_points = a.lifetime_spent_points + tx.points
  where a.user_id = tx.user_id
  returning a.balance_points, a.frozen_points
  into balance_points, frozen_points;

  update public.credit_transactions
  set status = 'completed', settled_at = now()
  where id = tx.id;

  insert into public.credit_transactions (
    user_id, type, status, points, feature, model, reason, metadata, related_transaction_id, settled_at
  )
  values (
    tx.user_id, 'spend', 'completed', tx.points, tx.feature, tx.model, 'generation completed',
    tx.metadata, tx.id, now()
  );

  transaction_id := tx.id;
  return next;
end;
$$;

create or replace function public.refund_credit_reservation(
  p_transaction_id uuid,
  p_reason text default 'generation failed'
)
returns table (
  transaction_id uuid,
  balance_points integer,
  frozen_points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.credit_transactions%rowtype;
begin
  select *
  into tx
  from public.credit_transactions
  where id = p_transaction_id
    and type = 'reserve'
  for update;

  if not found then
    raise exception 'CREDIT_TRANSACTION_NOT_FOUND';
  end if;

  if tx.status = 'refunded' then
    transaction_id := tx.id;
    select a.balance_points, a.frozen_points
    into balance_points, frozen_points
    from public.user_credit_accounts a
    where a.user_id = tx.user_id;
    return next;
    return;
  end if;

  if tx.status <> 'pending' then
    raise exception 'CREDIT_TRANSACTION_NOT_PENDING';
  end if;

  update public.user_credit_accounts a
  set frozen_points = a.frozen_points - tx.points
  where a.user_id = tx.user_id
  returning a.balance_points, a.frozen_points
  into balance_points, frozen_points;

  update public.credit_transactions
  set status = 'refunded', reason = p_reason, settled_at = now()
  where id = tx.id;

  insert into public.credit_transactions (
    user_id, type, status, points, feature, model, reason, metadata, related_transaction_id, settled_at
  )
  values (
    tx.user_id, 'refund', 'completed', tx.points, tx.feature, tx.model, p_reason,
    tx.metadata, tx.id, now()
  );

  transaction_id := tx.id;
  return next;
end;
$$;

insert into public.credit_pricing_rules (feature, model, rule, points)
values
  ('text', 'default', '{}'::jsonb, 1),
  ('text', 'premium', '{}'::jsonb, 3),
  ('image', 'default', '{}'::jsonb, 5),
  ('image', 'premium', '{}'::jsonb, 10),
  ('video', 'default_5s', '{}'::jsonb, 30),
  ('video', 'premium_5s', '{}'::jsonb, 60),
  ('music', 'default', '{}'::jsonb, 20),
  ('audio_speech', 'default', '{}'::jsonb, 2),
  ('audio_transcribe', 'default', '{}'::jsonb, 2)
on conflict (feature, model, rule) do nothing;

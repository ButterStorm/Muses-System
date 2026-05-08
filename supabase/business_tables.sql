create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'zh-CN',
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  default_text_model text,
  default_image_model text,
  default_video_provider text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  credit_transaction_id uuid references public.credit_transactions(id) on delete set null,
  feature text not null,
  model text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  prompt text,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  credits_charged integer not null default 0 check (credits_charged >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  asset_type text not null check (asset_type in ('image', 'video', 'audio', 'music', 'text', 'file')),
  source text not null default 'generated' check (source in ('generated', 'uploaded', 'external')),
  url text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  title text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_assets_has_location check (url is not null or storage_path is not null or asset_type = 'text')
);

create table if not exists public.invite_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_code_id uuid not null references public.invite_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (invite_code_id, user_id)
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists generation_jobs_user_created_idx on public.generation_jobs (user_id, created_at desc);
create index if not exists generation_jobs_project_created_idx on public.generation_jobs (project_id, created_at desc);
create index if not exists project_assets_user_created_idx on public.project_assets (user_id, created_at desc);
create index if not exists project_assets_project_created_idx on public.project_assets (project_id, created_at desc);
create index if not exists invite_code_redemptions_user_idx on public.invite_code_redemptions (user_id, redeemed_at desc);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.project_assets enable row level security;
alter table public.invite_code_redemptions enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = user_id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can read own settings" on public.user_settings;
create policy "Users can read own settings" on public.user_settings for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings" on public.user_settings for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings" on public.user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can read own generation jobs" on public.generation_jobs;
create policy "Users can read own generation jobs" on public.generation_jobs for select using (auth.uid() = user_id);

drop policy if exists "Users can read own project assets" on public.project_assets;
create policy "Users can read own project assets" on public.project_assets for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own uploaded assets" on public.project_assets;
create policy "Users can insert own uploaded assets" on public.project_assets for insert with check (auth.uid() = user_id and source = 'uploaded');
drop policy if exists "Users can update own project assets" on public.project_assets;
create policy "Users can update own project assets" on public.project_assets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own project assets" on public.project_assets;
create policy "Users can delete own project assets" on public.project_assets for delete using (auth.uid() = user_id);

drop policy if exists "Users can read own invite redemptions" on public.invite_code_redemptions;
create policy "Users can read own invite redemptions" on public.invite_code_redemptions for select using (auth.uid() = user_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at before update on public.user_settings for each row execute function public.set_updated_at();
drop trigger if exists generation_jobs_set_updated_at on public.generation_jobs;
create trigger generation_jobs_set_updated_at before update on public.generation_jobs for each row execute function public.set_updated_at();
drop trigger if exists project_assets_set_updated_at on public.project_assets;
create trigger project_assets_set_updated_at before update on public.project_assets for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_credit_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

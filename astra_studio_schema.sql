-- =====================================================================
-- ASTRA STUDIO — Database Schema
-- Paste this into Supabase SQL Editor and run.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS).
-- =====================================================================

-- 1) ROLES ENUM ---------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('owner', 'admin', 'user');
exception when duplicate_object then null; end $$;

-- 2) PROFILES ----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  activation_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = auth.uid());

-- 3) USER ROLES --------------------------------------------------------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select_self" on public.user_roles;
create policy "user_roles_select_self" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- 4) ACTIVATION CODES --------------------------------------------------
create table if not exists public.activation_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'unused' check (status in ('unused','used','revoked')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists activation_codes_status_idx on public.activation_codes (status);
grant select on public.activation_codes to authenticated;
grant all on public.activation_codes to service_role;
alter table public.activation_codes enable row level security;
-- No anon/user policy — only service_role (server fns) touches this.

-- 5) PROJECTS ----------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  content_json jsonb not null default '{}'::jsonb,
  content_text text not null default '',
  word_count integer not null default 0,
  language text not null default 'mixed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects (user_id, updated_at desc);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update to authenticated using (user_id = auth.uid());
drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete to authenticated using (user_id = auth.uid());

-- 5b) updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.tg_set_updated_at();

-- 5c) Enforce per-user max 5 projects
create or replace function public.tg_enforce_project_limit()
returns trigger language plpgsql as $$
declare cnt int;
begin
  select count(*) into cnt from public.projects where user_id = new.user_id;
  if cnt >= 5 then
    raise exception 'Project limit reached (5)';
  end if;
  return new;
end $$;
drop trigger if exists projects_limit on public.projects;
create trigger projects_limit before insert on public.projects
  for each row execute function public.tg_enforce_project_limit();

-- 6) BOOKMARKS ---------------------------------------------------------
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bookmarks_project_idx on public.bookmarks (project_id);
grant select, insert, update, delete on public.bookmarks to authenticated;
grant all on public.bookmarks to service_role;
alter table public.bookmarks enable row level security;

drop policy if exists "bookmarks_own" on public.bookmarks;
create policy "bookmarks_own" on public.bookmarks
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 7) AI HISTORY --------------------------------------------------------
create table if not exists public.ai_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  response text not null,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists ai_history_project_idx on public.ai_history (project_id, created_at desc);
grant select, insert, delete on public.ai_history to authenticated;
grant all on public.ai_history to service_role;
alter table public.ai_history enable row level security;

drop policy if exists "ai_history_own" on public.ai_history;
create policy "ai_history_own" on public.ai_history
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 8) AUDIT LOGS --------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
-- Only server fns insert; owners read via server fns.

-- 9) SEED: first activation code (use once, then revoke)
insert into public.activation_codes (code, status, notes)
values ('OWNER-FIRST-001', 'unused', 'Initial owner activation code')
on conflict (code) do nothing;

-- =====================================================================
-- After your owner email registers via the app, run this to promote:
--   insert into public.user_roles (user_id, role)
--   select id, 'owner' from auth.users where email = 'gangxtheplayers@gmail.com'
--   on conflict do nothing;
-- =====================================================================

-- 10) USER MEMORY (per-user AI memory, applies to all projects) ----------
create table if not exists public.user_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.user_memory to authenticated;
grant all on public.user_memory to service_role;
alter table public.user_memory enable row level security;
drop policy if exists "user_memory_own" on public.user_memory;
create policy "user_memory_own" on public.user_memory
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

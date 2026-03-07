create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  default_company_id uuid references public.companies(id) on delete set null,
  display_name text,
  email text,
  avatar_url text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_memberships (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  primary key (company_id, user_id)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_name text not null,
  entity_id text,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_company_memberships_user on public.company_memberships (user_id);
create index if not exists idx_company_memberships_company_role on public.company_memberships (company_id, role);
create index if not exists idx_user_profiles_default_company on public.user_profiles (default_company_id);
create index if not exists idx_audit_logs_company_created on public.audit_logs (company_id, created_at desc);

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.user_profiles.display_name, excluded.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

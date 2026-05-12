begin;

alter table public.user_profiles
  add column if not exists role text not null default 'usuario',
  add column if not exists preferred_language text not null default 'es',
  add column if not exists preferred_theme text not null default 'saas_atlas_blue_v2',
  add column if not exists color_mode text not null default 'system',
  add column if not exists text_size text not null default 'medium';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_role_check') then
    alter table public.user_profiles
      add constraint user_profiles_role_check check (role in ('master', 'admin', 'usuario'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'user_profiles_preferred_language_check') then
    alter table public.user_profiles
      add constraint user_profiles_preferred_language_check check (preferred_language in ('es', 'en', 'ca'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'user_profiles_color_mode_check') then
    alter table public.user_profiles
      add constraint user_profiles_color_mode_check check (color_mode in ('light', 'dark', 'system'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'user_profiles_text_size_check') then
    alter table public.user_profiles
      add constraint user_profiles_text_size_check check (text_size in ('small', 'medium', 'large'));
  end if;
end $$;

create table if not exists public.app_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('master', 'admin', 'usuario')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index if not exists idx_app_user_roles_role on public.app_user_roles (role, user_id);

create or replace function public.has_app_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.app_user_roles aur
      where aur.user_id = auth.uid()
        and aur.role = any(required_roles)
    );
$$;

create or replace function public.is_master_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_app_role(array['master']);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_role text;
begin
  metadata_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'usuario');
  if metadata_role not in ('master', 'admin', 'usuario') then
    metadata_role := 'usuario';
  end if;

  insert into public.user_profiles (
    id,
    email,
    display_name,
    role,
    preferred_language,
    preferred_theme,
    color_mode,
    text_size
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    metadata_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'preferred_language', ''), 'es'),
    coalesce(nullif(new.raw_user_meta_data ->> 'preferred_theme', ''), 'saas_atlas_blue_v2'),
    coalesce(nullif(new.raw_user_meta_data ->> 'color_mode', ''), 'system'),
    coalesce(nullif(new.raw_user_meta_data ->> 'text_size', ''), 'medium')
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.user_profiles.display_name, excluded.display_name),
        role = case
          when public.user_profiles.role = 'usuario' and excluded.role in ('master', 'admin') then excluded.role
          else public.user_profiles.role
        end;

  insert into public.app_user_roles (user_id, role)
  values (new.id, metadata_role)
  on conflict do nothing;

  return new;
end;
$$;

insert into public.user_profiles (
  id,
  email,
  display_name,
  role,
  preferred_language,
  preferred_theme,
  color_mode,
  text_size
)
select
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  case
    when u.raw_user_meta_data ->> 'role' in ('master', 'admin', 'usuario') then u.raw_user_meta_data ->> 'role'
    when u.raw_user_meta_data ->> 'bootstrap_master' = 'true' then 'master'
    else 'usuario'
  end,
  case when u.raw_user_meta_data ->> 'preferred_language' in ('es', 'en', 'ca') then u.raw_user_meta_data ->> 'preferred_language' else 'es' end,
  coalesce(nullif(u.raw_user_meta_data ->> 'preferred_theme', ''), 'saas_atlas_blue_v2'),
  case when u.raw_user_meta_data ->> 'color_mode' in ('light', 'dark', 'system') then u.raw_user_meta_data ->> 'color_mode' else 'system' end,
  case when u.raw_user_meta_data ->> 'text_size' in ('small', 'medium', 'large') then u.raw_user_meta_data ->> 'text_size' else 'medium' end
from auth.users u
on conflict (id) do update
  set email = excluded.email,
      role = case
        when excluded.role in ('master', 'admin') then excluded.role
        else public.user_profiles.role
      end;

with auth_roles as (
  select u.id as user_id, u.raw_user_meta_data ->> 'role' as role
  from auth.users u
  where u.raw_user_meta_data ->> 'role' in ('master', 'admin', 'usuario')
  union
  select u.id as user_id, 'master' as role
  from auth.users u
  where u.raw_user_meta_data ->> 'bootstrap_master' = 'true'
  union
  select u.id as user_id, role_values.role
  from auth.users u
  cross join lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(u.raw_user_meta_data -> 'roles') = 'array' then u.raw_user_meta_data -> 'roles'
      else '[]'::jsonb
    end
  ) as role_values(role)
  where role_values.role in ('master', 'admin', 'usuario')
  union
  select up.id as user_id, up.role
  from public.user_profiles up
  where up.role in ('master', 'admin', 'usuario')
)
insert into public.app_user_roles (user_id, role)
select user_id, role
from auth_roles
where role in ('master', 'admin', 'usuario')
on conflict do nothing;

alter table public.app_user_roles enable row level security;

revoke all on public.app_user_roles from anon, authenticated;
grant select, insert, delete on public.app_user_roles to authenticated;
grant execute on function public.has_app_role(text[]) to authenticated;
grant execute on function public.is_master_user() to authenticated;

revoke update on public.user_profiles from authenticated;
grant update (
  display_name,
  avatar_url,
  preferred_language,
  preferred_theme,
  color_mode,
  text_size
) on public.user_profiles to authenticated;

drop policy if exists app_user_roles_select_self_or_master on public.app_user_roles;
create policy app_user_roles_select_self_or_master
on public.app_user_roles
for select
to authenticated
using (user_id = auth.uid() or public.is_master_user());

drop policy if exists app_user_roles_insert_master on public.app_user_roles;
create policy app_user_roles_insert_master
on public.app_user_roles
for insert
to authenticated
with check (public.is_master_user());

drop policy if exists app_user_roles_delete_master on public.app_user_roles;
create policy app_user_roles_delete_master
on public.app_user_roles
for delete
to authenticated
using (public.is_master_user());

commit;

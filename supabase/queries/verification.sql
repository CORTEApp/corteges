-- Fail-fast assertions para el scaffold base sin tenants.

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename in ('user_profiles', 'audit_logs')
      and rowsecurity is distinct from true
  ) then
    raise exception 'Missing RLS on one or more required public tables';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('companies', 'company_memberships')
  ) then
    raise exception 'Legacy tenant tables should not exist';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'bootstrap_first_company',
        'is_platform_admin',
        'is_member_of_company',
        'has_company_role',
        'current_company_role',
        'can_manage_membership'
      )
  ) then
    raise exception 'Legacy tenant functions should not exist';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'profiles_update_self_safe_fields'
  ) then
    raise exception 'Missing safe self-update policy for user_profiles';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_app_user'
  ) then
    raise exception 'Missing public.is_app_user()';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'app_user_roles'
      and rowsecurity is true
  ) then
    raise exception 'Missing RLS on public.app_user_roles';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name in ('role', 'preferred_language', 'preferred_theme', 'color_mode', 'text_size')
    group by table_schema, table_name
    having count(*) = 5
  ) then
    raise exception 'Missing profile preference columns';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_master_user'
  ) then
    raise exception 'Missing public.is_master_user()';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_user_roles'
      and policyname = 'app_user_roles_select_self_or_master'
  ) then
    raise exception 'Missing app_user_roles select policy';
  end if;
end $$;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by tablename, policyname;

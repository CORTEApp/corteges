-- Fail-fast assertions para el scaffold base.

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename in ('companies', 'user_profiles', 'company_memberships', 'audit_logs')
      and rowsecurity is distinct from true
  ) then
    raise exception 'Missing RLS on one or more required public tables';
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
  if exists (
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and grantee = 'authenticated'
      and privilege_type = 'UPDATE'
      and column_name = 'is_platform_admin'
  ) then
    raise exception 'authenticated can update user_profiles.is_platform_admin';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'bootstrap_first_company'
  ) then
    raise exception 'Missing public.bootstrap_first_company()';
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

-- Fail-fast checks for the operational suppliers module.

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'suppliers'
      and rowsecurity is distinct from true
  ) then
    raise exception 'Missing RLS on suppliers module table';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'suppliers'
      and column_name = 'company_id'
  ) then
    raise exception 'Suppliers module should not depend on company_id';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'suppliers'
      and con.contype = 'u'
      and (
        select count(*)
        from pg_attribute att
        where att.attrelid = con.conrelid
          and att.attnum = any(con.conkey)
          and att.attname = 'tax_id'
      ) = 1
  ) then
    raise exception 'Missing unique tax id on suppliers';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = 'suppliers'
      and grantee = 'anon'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'anon has direct access to suppliers module table';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'suppliers'
      and policyname = 'suppliers_authenticated_select'
  ) then
    raise exception 'Missing suppliers select policy';
  end if;
end $$;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'suppliers';

select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = 'suppliers'
order by policyname;

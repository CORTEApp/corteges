-- Fail-fast checks for the SharePoint import/model layer.

do $$
begin
  if not exists (
    select 1
    from pg_namespace
    where nspname = 'sharepoint_import'
  ) then
    raise exception 'Missing sharepoint_import schema';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'sharepoint_import'
      and column_name = 'company_id'
  ) then
    raise exception 'sharepoint_import should not depend on company_id';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'sharepoint_import'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'Client roles have direct access to sharepoint_import';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'sharepoint_import'
      and rowsecurity is distinct from true
  ) then
    raise exception 'Missing RLS on one or more sharepoint_import tables';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_tables t
    where t.schemaname = 'public'
      and t.tablename like 'sp\_%' escape '\'
      and t.rowsecurity is distinct from true
  ) then
    raise exception 'Missing RLS on one or more generated public SharePoint tables';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'sharepoint_import'
      and t.table_name like 'sp\_%' escape '\'
      and exists (
        select 1
        from information_schema.columns c
        where c.table_schema = t.table_schema
          and c.table_name = t.table_name
          and c.column_name = 'sharepoint_item_id'
      )
      and not exists (
        select 1
        from pg_constraint con
        join pg_class cls on cls.oid = con.conrelid
        join pg_namespace nsp on nsp.oid = cls.relnamespace
        where nsp.nspname = t.table_schema
          and cls.relname = t.table_name
          and con.contype = 'u'
          and array_length(con.conkey, 1) = 3
          and (
            select count(*)
            from pg_attribute att
            where att.attrelid = con.conrelid
              and att.attnum = any(con.conkey)
              and att.attname in (
                'sharepoint_site_id',
                'sharepoint_list_id',
                'sharepoint_item_id'
              )
          ) = 3
      )
  ) then
    raise exception 'Missing source uniqueness on one or more generated staging tables';
  end if;
end $$;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname in ('sharepoint_import', 'public')
  and (schemaname = 'sharepoint_import' or tablename like 'sp\_%' escape '\')
order by schemaname, tablename;

select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename like 'sp\_%' escape '\'
order by tablename, policyname;

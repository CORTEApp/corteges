-- Fail-fast checks for the operational clients module.

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename in ('clients', 'client_invoices', 'client_documents', 'client_history_entries')
      and rowsecurity is distinct from true
  ) then
    raise exception 'Missing RLS on one or more clients module tables';
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
      and cls.relname = 'client_history_entries'
      and con.contype = 'u'
      and (
        select count(*)
        from pg_attribute att
        where att.attrelid = con.conrelid
          and att.attnum = any(con.conkey)
          and att.attname in ('sharepoint_site_id', 'sharepoint_list_id', 'sharepoint_item_id')
      ) = 3
  ) then
    raise exception 'Missing unique SharePoint source key on client_history_entries';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'client-documents'
      and public = false
  ) then
    raise exception 'Missing private client-documents bucket';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('clients', 'client_invoices', 'client_documents', 'client_history_entries')
      and column_name = 'company_id'
  ) then
    raise exception 'Clients module should not depend on company_id';
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
      and cls.relname = 'clients'
      and con.contype = 'u'
      and (
        select count(*)
        from pg_attribute att
        where att.attrelid = con.conrelid
          and att.attnum = any(con.conkey)
          and att.attname = 'tax_id'
      ) = 1
  ) then
    raise exception 'Missing unique tax id on clients';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'client_documents_storage_select'
  ) then
    raise exception 'Missing storage select policy for client documents';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name in ('clients', 'client_invoices', 'client_documents', 'client_history_entries')
      and grantee = 'anon'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'anon has direct access to clients module tables';
  end if;
end $$;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('clients', 'client_invoices', 'client_documents', 'client_history_entries')
order by tablename;

select schemaname, tablename, policyname, cmd, roles
from pg_policies
where (schemaname = 'public' and tablename in ('clients', 'client_invoices', 'client_documents', 'client_history_entries'))
   or (schemaname = 'storage' and tablename = 'objects' and policyname like 'client_documents_storage_%')
order by schemaname, tablename, policyname;

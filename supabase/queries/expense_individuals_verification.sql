do $$
begin
  if to_regclass('public.expense_individuals') is null then
    raise exception 'Missing public.expense_individuals';
  end if;

  if to_regclass('public.expense_individual_documents') is null then
    raise exception 'Missing public.expense_individual_documents';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('expense_individuals', 'expense_individual_documents')
      and column_name = 'company_id'
  ) then
    raise exception 'Expense individuals must not use company_id';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('expense_individuals', 'expense_individual_documents')
      and grantee = 'anon'
  ) then
    raise exception 'anon must not have grants on expense individual tables';
  end if;

  if not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'expense_individuals'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
  ) then
    raise exception 'authenticated select grant missing on expense_individuals';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'expense_individuals'
      and c.relrowsecurity
  ) then
    raise exception 'RLS disabled on expense_individuals';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'expense_individual_documents'
      and c.relrowsecurity
  ) then
    raise exception 'RLS disabled on expense_individual_documents';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname in ('public', 'storage')
      and tablename in ('expense_individuals', 'expense_individual_documents', 'objects')
      and policyname like 'expense%'
      and 'anon' = any(roles)
  ) then
    raise exception 'Expense policies must not target anon';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'expense_individuals_sharepoint_source_unique'
      and contype = 'u'
  ) then
    raise exception 'Missing SharePoint uniqueness constraint';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expense_individuals'
      and column_name = 'supplier_id'
      and is_nullable = 'NO'
  ) then
    raise exception 'supplier_id must be required';
  end if;

  if not exists (
    select 1
    from information_schema.referential_constraints rc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = rc.constraint_schema
     and kcu.constraint_name = rc.constraint_name
    where kcu.table_schema = 'public'
      and kcu.table_name = 'expense_individuals'
      and kcu.column_name = 'supplier_id'
      and rc.delete_rule in ('RESTRICT', 'NO ACTION')
  ) then
    raise exception 'supplier_id must restrict supplier deletion';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'expense-documents'
      and public = false
  ) then
    raise exception 'Missing private expense-documents bucket';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'expense_documents_storage_select'
  ) then
    raise exception 'Missing expense documents storage select policy';
  end if;
end $$;

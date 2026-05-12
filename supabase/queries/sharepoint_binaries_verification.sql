do $$
begin
  if to_regclass('sharepoint_import.binary_files') is null then
    raise exception 'Missing sharepoint_import.binary_files';
  end if;

  if to_regclass('public.billing_document_files') is null then
    raise exception 'Missing public.billing_document_files';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expense_individual_documents'
      and column_name = 'source_sha256'
  ) then
    raise exception 'Missing expense_individual_documents.source_sha256';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_documents'
      and column_name = 'source_sha256'
  ) then
    raise exception 'Missing client_documents.source_sha256';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id in ('sharepoint-binaries', 'billing-documents')
      and public = false
    group by public
    having count(*) = 2
  ) then
    raise exception 'Missing private storage buckets for SharePoint binaries';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'anon'
      and (
        (table_schema = 'public' and table_name in ('billing_document_files', 'client_documents', 'expense_individual_documents'))
        or (table_schema = 'sharepoint_import' and table_name = 'binary_files')
      )
  ) then
    raise exception 'Anon grants detected on binary document tables';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'management'
      and (
        (table_schema = 'public' and table_name in ('billing_document_files', 'client_documents', 'expense_individual_documents'))
        or (table_schema = 'sharepoint_import' and table_name = 'binary_files')
      )
  ) then
    raise exception 'Unexpected management grants detected';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where column_name = 'company_id'
      and (
        (table_schema = 'public' and table_name in ('billing_document_files', 'client_documents', 'expense_individual_documents'))
        or (table_schema = 'sharepoint_import' and table_name = 'binary_files')
      )
  ) then
    raise exception 'Unexpected company_id column in binary document tables';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where (
      (n.nspname = 'public' and c.relname = 'billing_document_files')
      or (n.nspname = 'sharepoint_import' and c.relname = 'binary_files')
    )
      and c.relrowsecurity = false
  ) then
    raise exception 'RLS disabled on binary document tables';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'billing_documents_storage_select'
      and roles::text like '%authenticated%'
  ) then
    raise exception 'Missing billing document storage select policy';
  end if;
end $$;

select
  (select count(*) from sharepoint_import.binary_files) as binary_inventory_rows,
  (select count(*) from public.expense_individual_documents where source_kind = 'sharepoint') as expense_sharepoint_documents,
  (select count(*) from public.client_documents where source_kind = 'sharepoint') as client_sharepoint_documents,
  (select count(*) from public.billing_document_files where source_kind = 'sharepoint') as billing_sharepoint_documents,
  (select count(*) from storage.objects where bucket_id = 'sharepoint-binaries') as archived_sharepoint_objects,
  (select count(*) from storage.objects where bucket_id = 'billing-documents') as billing_storage_objects,
  (select count(*) from storage.objects where bucket_id = 'expense-documents') as expense_storage_objects,
  (select count(*) from storage.objects where bucket_id = 'client-documents') as client_storage_objects;

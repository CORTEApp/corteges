-- Fail-fast checks for the billing documents module.

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename in ('billing_documents', 'billing_document_lines', 'billing_payments', 'billing_number_sequences')
      and rowsecurity is distinct from true
  ) then
    raise exception 'Missing RLS on one or more billing document tables';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('billing_documents', 'billing_document_lines', 'billing_payments', 'billing_number_sequences')
      and column_name in ('tenant_id', 'company_id')
  ) then
    raise exception 'Billing documents module should not depend on tenant/company isolation';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'next_billing_document_number'
  ) then
    raise exception 'Missing next_billing_document_number RPC';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'issue_invoice_from_paid_proforma'
  ) then
    raise exception 'Missing issue_invoice_from_paid_proforma RPC';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'billing_documents'
      and indexname = 'idx_billing_documents_invoice_source_unique'
  ) then
    raise exception 'Missing unique invoice source-proforma guard';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name in ('billing_documents', 'billing_document_lines', 'billing_payments', 'billing_number_sequences')
      and grantee = 'anon'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'anon has direct access to billing document tables';
  end if;
end $$;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('billing_documents', 'billing_document_lines', 'billing_payments', 'billing_number_sequences')
order by tablename;

select schemaname, tablename, policyname, cmd, roles::text as roles
from pg_policies
where schemaname = 'public'
  and tablename in ('billing_documents', 'billing_document_lines', 'billing_payments', 'billing_number_sequences')
order by tablename, policyname;

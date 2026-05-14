-- Fail-fast checks for supplier invoice intake without AI/OCR.
do $$
begin
  if exists (
    select 1
    from unnest(array[
      'expense_invoice_intake_items',
      'expense_invoice_intake_documents',
      'expense_invoice_supplier_templates',
      'expense_invoice_intake_events'
    ]) as required_table(name)
    where not exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = required_table.name
    )
  ) then
    raise exception 'Missing expense invoice intake table';
  end if;

  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'expense_invoice_intake_items',
        'expense_invoice_intake_documents',
        'expense_invoice_supplier_templates',
        'expense_invoice_intake_events'
      )
      and rowsecurity is not true
  ) then
    raise exception 'Missing RLS on expense invoice intake tables';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'expense_invoice_intake_items'
      and qual like '%has_app_role%'
  ) then
    raise exception 'Expense invoice intake items must be restricted by app role';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'expense-invoice-intake'
      and public is false
  ) then
    raise exception 'Missing private expense-invoice-intake bucket';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_expense_invoice_intake_documents_sha256'
  ) then
    raise exception 'Missing sha256 dedupe index for intake documents';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_expense_invoice_intake_items_supplier_invoice_open'
      and indexdef like '%extraida%'
      and indexdef like '%aprobada%'
  ) then
    raise exception 'Missing review-safe supplier invoice uniqueness guard';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_expense_invoice_supplier_templates_supplier_active'
  ) then
    raise exception 'Missing active supplier template uniqueness guard';
  end if;
end $$;

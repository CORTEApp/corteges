-- Fail-fast checks for monthly billing approval candidates and direct invoice issuance.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'billing_subscriptions'
      and column_name = 'apply_vat'
  ) then
    raise exception 'Missing billing_subscriptions.apply_vat';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'billing_subscriptions'
      and column_name = 'vat_rate'
  ) then
    raise exception 'Missing billing_subscriptions.vat_rate';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'billing_invoice_approval_batches'
  ) then
    raise exception 'Missing billing_invoice_approval_batches table';
  end if;

  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'billing_invoice_approval_candidates'
  ) then
    raise exception 'Missing billing_invoice_approval_candidates table';
  end if;

  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'billing_invoice_approval_lines'
  ) then
    raise exception 'Missing billing_invoice_approval_lines table';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'approve_billing_invoice_candidate'
  ) then
    raise exception 'Missing transactional approve_billing_invoice_candidate RPC';
  end if;
end $$;

do $$
begin
  if exists (
    select period_start, client_group_key
    from public.billing_invoice_approval_candidates
    group by period_start, client_group_key
    having count(*) > 1
  ) then
    raise exception 'Duplicate approval candidates by period and client group';
  end if;
end $$;

do $$
begin
  if exists (
    select invoice_id
    from public.billing_invoice_approval_candidates
    where invoice_id is not null
    group by invoice_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate approved invoice reference across candidates';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.billing_invoice_approval_candidates c
    join public.billing_invoice_approval_lines l on l.candidate_id = c.id
    group by c.id, c.subtotal_amount, c.tax_amount, c.total_amount
    having round(coalesce(sum(l.subtotal_amount), 0), 2) <> c.subtotal_amount
      or round(coalesce(sum(l.tax_amount), 0), 2) <> c.tax_amount
      or round(coalesce(sum(l.total_amount), 0), 2) <> c.total_amount
  ) then
    raise exception 'Approval candidate totals do not match snapshot lines';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.billing_invoice_approval_candidates c
    join public.billing_invoice_approval_lines l on l.candidate_id = c.id
    join public.billing_subscriptions s on s.id = l.subscription_id
    where c.status in ('pending', 'failed')
      and round(l.total_amount, 2) <> round(s.recurring_total_amount, 2)
  ) then
    raise exception 'Pending approval line totals must match subscription recurring totals';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.billing_invoice_approval_candidates
    where status = 'sent'
      and (invoice_id is null or mail_job_id is null)
  ) then
    raise exception 'Sent approval candidates must reference invoice and mail job';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'billing_invoice_approval_batches',
        'billing_invoice_approval_candidates',
        'billing_invoice_approval_lines'
      )
      and rowsecurity is distinct from true
  ) then
    raise exception 'Missing RLS on invoice approval tables';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name in (
        'billing_invoice_approval_batches',
        'billing_invoice_approval_candidates',
        'billing_invoice_approval_lines'
      )
      and grantee = 'anon'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'anon has direct access to invoice approval tables';
  end if;
end $$;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'billing_invoice_approval_batches',
    'billing_invoice_approval_candidates',
    'billing_invoice_approval_lines'
  )
order by tablename;

select period_start, status, candidate_count, total_amount
from public.billing_invoice_approval_batches
order by period_start desc
limit 12;

select period_start, status, count(*) as candidate_count
from public.billing_invoice_approval_candidates
group by period_start, status
order by period_start desc, status;

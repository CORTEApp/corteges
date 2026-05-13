-- Fail-fast checks for Supabase-owned billing numbering and mail dispatch groundwork.

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_billing_proforma'
  ) then
    raise exception 'Missing transactional create_billing_proforma RPC';
  end if;
end $$;

do $$
begin
  if exists (
    select document_type, series, number_year, number_value
    from public.billing_documents
    group by document_type, series, number_year, number_value
    having count(*) > 1
  ) then
    raise exception 'Duplicate billing document sequence values detected';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.billing_documents d
    left join public.billing_number_sequences s
      on s.document_type = d.document_type
      and s.series = d.series
      and s.number_year = d.number_year
    where d.imported_at is null
      and (s.id is null or s.last_value < d.number_value)
  ) then
    raise exception 'billing_number_sequences is behind issued billing documents';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename in ('mail_outboxes', 'mail_dispatch_jobs')
      and rowsecurity is distinct from true
  ) then
    raise exception 'Missing RLS on mail dispatch tables';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'mail_dispatch_jobs'
      and indexname = 'idx_mail_dispatch_jobs_idempotency'
  ) then
    raise exception 'Missing mail dispatch idempotency guard';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.mail_dispatch_jobs j
    join public.mail_outboxes o on o.id = j.outbox_id
    where j.status in ('queued', 'sending')
      and not o.active
  ) then
    raise exception 'Queued or sending mail jobs cannot use inactive outboxes';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name in ('mail_outboxes', 'mail_dispatch_jobs')
      and grantee = 'anon'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'anon has direct access to mail dispatch tables';
  end if;
end $$;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('billing_documents', 'billing_number_sequences', 'mail_outboxes', 'mail_dispatch_jobs')
order by tablename;

select document_type, series, number_year, last_value
from public.billing_number_sequences
order by document_type, series, number_year;

select status, count(*) as job_count
from public.mail_dispatch_jobs
group by status
order by status;

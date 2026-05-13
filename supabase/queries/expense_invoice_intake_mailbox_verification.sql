-- Fail-fast checks for email ingestion mailbox configuration.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mail_outbox_module_settings_module_check'
      and pg_get_constraintdef(oid) like '%expense_invoice_intake%'
  ) then
    raise exception 'mail_outbox_module_settings does not allow expense invoice intake';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_mail_outbox_module_settings'
      and p.pronargs = 3
  ) then
    raise exception 'Missing 3-argument set_mail_outbox_module_settings RPC';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.mail_outbox_module_settings s
    join public.mail_outboxes o on o.id = s.outbox_id
    where s.module = 'expense_invoice_intake'
      and not o.active
  ) then
    raise exception 'Expense invoice intake mailbox points to an inactive outbox';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.mail_outboxes o
    where o.active
      and lower(o.email_address) = 'finanzas@corteapp.es'
  )
  and not exists (
    select 1
    from public.mail_outbox_module_settings s
    join public.mail_outboxes o on o.id = s.outbox_id
    where s.module = 'expense_invoice_intake'
      and o.active
      and lower(o.email_address) = 'finanzas@corteapp.es'
  ) then
    raise exception 'finanzas@corteapp.es is active but not assigned to expense invoice intake';
  end if;
end $$;

select s.module, o.email_address, o.display_name, o.mode, o.active
from public.mail_outbox_module_settings s
join public.mail_outboxes o on o.id = s.outbox_id
where s.module = 'expense_invoice_intake';

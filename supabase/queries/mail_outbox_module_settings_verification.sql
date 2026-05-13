-- Fail-fast checks for global Microsoft outbox settings by module.

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'mail_outbox_module_settings'
  ) then
    raise exception 'Missing mail_outbox_module_settings table';
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
  ) then
    raise exception 'Missing transactional set_mail_outbox_module_settings RPC';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.mail_outbox_module_settings
    where module not in ('billing', 'crm', 'expense_invoice_intake')
  ) then
    raise exception 'Unexpected module in mail_outbox_module_settings';
  end if;
end $$;

do $$
begin
  if exists (
    select module
    from public.mail_outbox_module_settings
    group by module
    having count(*) > 1
  ) then
    raise exception 'Duplicate module outbox setting detected';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.mail_outbox_module_settings s
    join public.mail_outboxes o on o.id = s.outbox_id
    where not o.active
  ) then
    raise exception 'Module settings cannot point to inactive outboxes';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'mail_outbox_module_settings'
      and rowsecurity is distinct from true
  ) then
    raise exception 'Missing RLS on mail_outbox_module_settings';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_mail_outbox_module_settings_active_outbox'
  ) then
    raise exception 'Missing active outbox trigger for module settings';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_mail_outboxes_prevent_deactivate_assigned'
  ) then
    raise exception 'Missing assigned outbox deactivation guard';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = 'mail_outbox_module_settings'
      and grantee = 'anon'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'anon has direct access to mail_outbox_module_settings';
  end if;
end $$;

select module, outbox_id, created_at, updated_at
from public.mail_outbox_module_settings
order by module;

select s.module, o.email_address, o.display_name, o.mode, o.active
from public.mail_outbox_module_settings s
join public.mail_outboxes o on o.id = s.outbox_id
order by s.module;

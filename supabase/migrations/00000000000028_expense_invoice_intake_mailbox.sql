begin;

alter table public.mail_outbox_module_settings
  drop constraint if exists mail_outbox_module_settings_module_check;

alter table public.mail_outbox_module_settings
  add constraint mail_outbox_module_settings_module_check
  check (module in ('billing', 'crm', 'expense_invoice_intake'));

drop function if exists public.set_mail_outbox_module_settings(uuid, uuid);

create or replace function public.set_mail_outbox_module_settings(
  p_billing_outbox_id uuid default null,
  p_crm_outbox_id uuid default null,
  p_expense_invoice_intake_outbox_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not public.is_app_user() then
    raise exception 'Not authorized';
  end if;

  if p_billing_outbox_id is null then
    delete from public.mail_outbox_module_settings
    where module = 'billing';
  else
    if not exists (
      select 1
      from public.mail_outboxes o
      where o.id = p_billing_outbox_id
        and o.active
    ) then
      raise exception 'Billing outbox must be active';
    end if;

    insert into public.mail_outbox_module_settings (
      module,
      outbox_id,
      created_by,
      updated_by
    )
    values (
      'billing',
      p_billing_outbox_id,
      v_user_id,
      v_user_id
    )
    on conflict (module) do update
    set outbox_id = excluded.outbox_id,
        updated_by = v_user_id,
        updated_at = now();
  end if;

  if p_crm_outbox_id is null then
    delete from public.mail_outbox_module_settings
    where module = 'crm';
  else
    if not exists (
      select 1
      from public.mail_outboxes o
      where o.id = p_crm_outbox_id
        and o.active
    ) then
      raise exception 'CRM outbox must be active';
    end if;

    insert into public.mail_outbox_module_settings (
      module,
      outbox_id,
      created_by,
      updated_by
    )
    values (
      'crm',
      p_crm_outbox_id,
      v_user_id,
      v_user_id
    )
    on conflict (module) do update
    set outbox_id = excluded.outbox_id,
        updated_by = v_user_id,
        updated_at = now();
  end if;

  if p_expense_invoice_intake_outbox_id is null then
    delete from public.mail_outbox_module_settings
    where module = 'expense_invoice_intake';
  else
    if not exists (
      select 1
      from public.mail_outboxes o
      where o.id = p_expense_invoice_intake_outbox_id
        and o.active
    ) then
      raise exception 'Expense invoice intake outbox must be active';
    end if;

    insert into public.mail_outbox_module_settings (
      module,
      outbox_id,
      created_by,
      updated_by
    )
    values (
      'expense_invoice_intake',
      p_expense_invoice_intake_outbox_id,
      v_user_id,
      v_user_id
    )
    on conflict (module) do update
    set outbox_id = excluded.outbox_id,
        updated_by = v_user_id,
        updated_at = now();
  end if;
end;
$$;

grant execute on function public.set_mail_outbox_module_settings(uuid, uuid, uuid) to authenticated;

insert into public.mail_outbox_module_settings (
  module,
  outbox_id,
  created_by,
  updated_by
)
select
  'expense_invoice_intake',
  o.id,
  o.updated_by,
  o.updated_by
from public.mail_outboxes o
where o.active
  and lower(o.email_address) = 'finanzas@corteapp.es'
order by o.updated_at desc
limit 1
on conflict (module) do update
set outbox_id = excluded.outbox_id,
    updated_by = excluded.updated_by,
    updated_at = now();

commit;

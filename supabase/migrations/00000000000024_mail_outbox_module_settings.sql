begin;

create table if not exists public.mail_outbox_module_settings (
  module text primary key,
  outbox_id uuid not null references public.mail_outboxes(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mail_outbox_module_settings_module_check check (module in ('billing', 'crm'))
);

create index if not exists idx_mail_outbox_module_settings_outbox
  on public.mail_outbox_module_settings (outbox_id);

drop trigger if exists trg_mail_outbox_module_settings_updated_at on public.mail_outbox_module_settings;
create trigger trg_mail_outbox_module_settings_updated_at
before update on public.mail_outbox_module_settings
for each row execute function public.set_updated_at();

create or replace function public.assert_mail_outbox_module_setting_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.mail_outboxes o
    where o.id = new.outbox_id
      and o.active
  ) then
    raise exception 'Cannot assign an inactive outbox to a module';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mail_outbox_module_settings_active_outbox on public.mail_outbox_module_settings;
create trigger trg_mail_outbox_module_settings_active_outbox
before insert or update of outbox_id on public.mail_outbox_module_settings
for each row execute function public.assert_mail_outbox_module_setting_active();

create or replace function public.prevent_deactivate_assigned_mail_outbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.active
    and not new.active
    and exists (
      select 1
      from public.mail_outbox_module_settings s
      where s.outbox_id = new.id
    )
  then
    raise exception 'Cannot deactivate an outbox assigned to a module';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mail_outboxes_prevent_deactivate_assigned on public.mail_outboxes;
create trigger trg_mail_outboxes_prevent_deactivate_assigned
before update of active on public.mail_outboxes
for each row execute function public.prevent_deactivate_assigned_mail_outbox();

create or replace function public.set_mail_outbox_module_settings(
  p_billing_outbox_id uuid default null,
  p_crm_outbox_id uuid default null
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
end;
$$;

alter table public.mail_outbox_module_settings enable row level security;
alter table public.mail_outbox_module_settings force row level security;

revoke all on public.mail_outbox_module_settings from anon, authenticated;
grant select, insert, update, delete on public.mail_outbox_module_settings to authenticated;
grant execute on function public.assert_mail_outbox_module_setting_active() to authenticated;
grant execute on function public.prevent_deactivate_assigned_mail_outbox() to authenticated;
grant execute on function public.set_mail_outbox_module_settings(uuid, uuid) to authenticated;

drop policy if exists mail_outbox_module_settings_authenticated_select on public.mail_outbox_module_settings;
create policy mail_outbox_module_settings_authenticated_select
on public.mail_outbox_module_settings
for select
to authenticated
using (public.is_app_user());

drop policy if exists mail_outbox_module_settings_authenticated_insert on public.mail_outbox_module_settings;
create policy mail_outbox_module_settings_authenticated_insert
on public.mail_outbox_module_settings
for insert
to authenticated
with check (
  public.is_app_user()
  and exists (
    select 1
    from public.mail_outboxes o
    where o.id = outbox_id
      and o.active
  )
);

drop policy if exists mail_outbox_module_settings_authenticated_update on public.mail_outbox_module_settings;
create policy mail_outbox_module_settings_authenticated_update
on public.mail_outbox_module_settings
for update
to authenticated
using (public.is_app_user())
with check (
  public.is_app_user()
  and exists (
    select 1
    from public.mail_outboxes o
    where o.id = outbox_id
      and o.active
  )
);

drop policy if exists mail_outbox_module_settings_authenticated_delete on public.mail_outbox_module_settings;
create policy mail_outbox_module_settings_authenticated_delete
on public.mail_outbox_module_settings
for delete
to authenticated
using (public.is_app_user());

insert into public.mail_outbox_module_settings (
  module,
  outbox_id,
  created_by,
  updated_by
)
select
  'billing',
  o.id,
  o.updated_by,
  o.updated_by
from public.mail_outboxes o
where o.active
  and o.is_default_for_billing
order by o.created_at asc
limit 1
on conflict (module) do nothing;

commit;

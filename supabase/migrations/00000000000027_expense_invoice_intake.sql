begin;

create table if not exists public.expense_invoice_supplier_templates (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  status text not null default 'active',
  version integer not null default 1,
  extraction_rules jsonb not null default '{}'::jsonb,
  field_map jsonb not null default '{}'::jsonb,
  sample_count integer not null default 0,
  success_count integer not null default 0,
  last_approved_item_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_invoice_supplier_templates_status_check check (status in ('active', 'disabled')),
  constraint expense_invoice_supplier_templates_version_check check (version > 0),
  constraint expense_invoice_supplier_templates_counts_check check (sample_count >= 0 and success_count >= 0)
);

create unique index if not exists idx_expense_invoice_supplier_templates_supplier_active
  on public.expense_invoice_supplier_templates (supplier_id)
  where status = 'active';

create table if not exists public.expense_invoice_intake_items (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pendiente',
  source_kind text not null default 'upload',
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_tax_id text,
  supplier_name text,
  invoice_number text,
  invoice_date date,
  net_amount numeric(14, 4),
  vat_rate numeric(6, 2),
  total_amount numeric(14, 4),
  currency text not null default 'EUR',
  title text,
  payment_method text not null default 'n26',
  template_id uuid references public.expense_invoice_supplier_templates(id) on delete set null,
  extraction_data jsonb not null default '{}'::jsonb,
  field_confidence jsonb not null default '{}'::jsonb,
  last_error text,
  review_notes text,
  approved_expense_id uuid unique references public.expense_individuals(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_invoice_intake_items_status_check check (status in ('pendiente', 'extraida', 'requiere_revision', 'aprobada', 'rechazada', 'fallida')),
  constraint expense_invoice_intake_items_source_kind_check check (source_kind in ('upload', 'email')),
  constraint expense_invoice_intake_items_currency_check check (char_length(currency) = 3),
  constraint expense_invoice_intake_items_payment_method_check check (payment_method in ('n26', 'caixa', 'other')),
  constraint expense_invoice_intake_items_vat_rate_check check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100)),
  constraint expense_invoice_intake_items_amounts_check check (
    (net_amount is null or net_amount >= 0)
    and (total_amount is null or total_amount >= 0)
  ),
  constraint expense_invoice_intake_items_approved_consistency_check check (
    (status = 'aprobada') = (approved_at is not null and approved_by is not null and approved_expense_id is not null)
  ),
  constraint expense_invoice_intake_items_rejected_consistency_check check (
    (status = 'rechazada') = (rejected_at is not null and rejected_by is not null)
  )
);

create index if not exists idx_expense_invoice_intake_items_status
  on public.expense_invoice_intake_items (status, created_at desc);

create index if not exists idx_expense_invoice_intake_items_supplier
  on public.expense_invoice_intake_items (supplier_id, created_at desc);

create index if not exists idx_expense_invoice_intake_items_invoice_date
  on public.expense_invoice_intake_items (invoice_date desc);

create unique index if not exists idx_expense_invoice_intake_items_supplier_invoice_open
  on public.expense_invoice_intake_items (supplier_id, upper(btrim(invoice_number)))
  where supplier_id is not null
    and invoice_number is not null
    and status <> 'rechazada';

create table if not exists public.expense_invoice_intake_documents (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.expense_invoice_intake_items(id) on delete cascade,
  file_name text not null,
  mime_type text,
  file_size bigint not null default 0,
  storage_bucket text not null default 'expense-invoice-intake',
  storage_path text not null unique,
  source_sha256 text not null,
  provider text,
  provider_mailbox text,
  provider_message_id text,
  provider_attachment_id text,
  provider_received_at timestamptz,
  sender_email text,
  sender_name text,
  subject text,
  extracted_text text,
  extracted_pages integer,
  extracted_at timestamptz,
  extraction_error text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint expense_invoice_intake_documents_file_size_check check (file_size >= 0),
  constraint expense_invoice_intake_documents_pages_check check (extracted_pages is null or extracted_pages >= 0)
);

create unique index if not exists idx_expense_invoice_intake_documents_sha256
  on public.expense_invoice_intake_documents (source_sha256);

create unique index if not exists idx_expense_invoice_intake_documents_provider_attachment
  on public.expense_invoice_intake_documents (provider, provider_mailbox, provider_message_id, provider_attachment_id)
  where provider is not null
    and provider_message_id is not null
    and provider_attachment_id is not null;

create index if not exists idx_expense_invoice_intake_documents_item
  on public.expense_invoice_intake_documents (item_id, created_at desc);

create table if not exists public.expense_invoice_intake_events (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.expense_invoice_intake_items(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint expense_invoice_intake_events_type_check check (btrim(event_type) <> '')
);

create index if not exists idx_expense_invoice_intake_events_item
  on public.expense_invoice_intake_events (item_id, created_at desc);

alter table public.expense_invoice_supplier_templates
  drop constraint if exists expense_invoice_supplier_templates_last_item_fk;

alter table public.expense_invoice_supplier_templates
  add constraint expense_invoice_supplier_templates_last_item_fk
  foreign key (last_approved_item_id)
  references public.expense_invoice_intake_items(id)
  on delete set null;

drop trigger if exists trg_expense_invoice_supplier_templates_updated_at on public.expense_invoice_supplier_templates;
create trigger trg_expense_invoice_supplier_templates_updated_at
before update on public.expense_invoice_supplier_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_expense_invoice_intake_items_updated_at on public.expense_invoice_intake_items;
create trigger trg_expense_invoice_intake_items_updated_at
before update on public.expense_invoice_intake_items
for each row execute function public.set_updated_at();

create or replace function public.storage_expense_invoice_intake_item_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  item_text text;
begin
  item_text := split_part(coalesce(object_name, ''), '/', 1);
  if item_text = '' then
    return null;
  end if;

  return item_text::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.can_access_expense_invoice_intake_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_app_role(array['master', 'admin'])
    and exists (
      select 1
      from public.expense_invoice_intake_items i
      where i.id = public.storage_expense_invoice_intake_item_id(object_name)
    );
$$;

alter table public.expense_invoice_supplier_templates enable row level security;
alter table public.expense_invoice_supplier_templates force row level security;
alter table public.expense_invoice_intake_items enable row level security;
alter table public.expense_invoice_intake_items force row level security;
alter table public.expense_invoice_intake_documents enable row level security;
alter table public.expense_invoice_intake_documents force row level security;
alter table public.expense_invoice_intake_events enable row level security;
alter table public.expense_invoice_intake_events force row level security;

revoke all on public.expense_invoice_supplier_templates from anon, authenticated;
revoke all on public.expense_invoice_intake_items from anon, authenticated;
revoke all on public.expense_invoice_intake_documents from anon, authenticated;
revoke all on public.expense_invoice_intake_events from anon, authenticated;

grant select, insert, update, delete on public.expense_invoice_supplier_templates to authenticated;
grant select, insert, update, delete on public.expense_invoice_intake_items to authenticated;
grant select, insert, update, delete on public.expense_invoice_intake_documents to authenticated;
grant select, insert, update, delete on public.expense_invoice_intake_events to authenticated;
grant execute on function public.storage_expense_invoice_intake_item_id(text) to authenticated;
grant execute on function public.can_access_expense_invoice_intake_object(text) to authenticated;

drop policy if exists expense_invoice_supplier_templates_admin_all on public.expense_invoice_supplier_templates;
create policy expense_invoice_supplier_templates_admin_all
on public.expense_invoice_supplier_templates
for all
to authenticated
using (public.has_app_role(array['master', 'admin']))
with check (public.has_app_role(array['master', 'admin']));

drop policy if exists expense_invoice_intake_items_admin_all on public.expense_invoice_intake_items;
create policy expense_invoice_intake_items_admin_all
on public.expense_invoice_intake_items
for all
to authenticated
using (public.has_app_role(array['master', 'admin']))
with check (public.has_app_role(array['master', 'admin']));

drop policy if exists expense_invoice_intake_documents_admin_all on public.expense_invoice_intake_documents;
create policy expense_invoice_intake_documents_admin_all
on public.expense_invoice_intake_documents
for all
to authenticated
using (public.has_app_role(array['master', 'admin']))
with check (public.has_app_role(array['master', 'admin']));

drop policy if exists expense_invoice_intake_events_admin_all on public.expense_invoice_intake_events;
create policy expense_invoice_intake_events_admin_all
on public.expense_invoice_intake_events
for all
to authenticated
using (public.has_app_role(array['master', 'admin']))
with check (public.has_app_role(array['master', 'admin']));

insert into storage.buckets (id, name, public)
values ('expense-invoice-intake', 'expense-invoice-intake', false)
on conflict (id) do update
set public = false;

drop policy if exists expense_invoice_intake_storage_select on storage.objects;
create policy expense_invoice_intake_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'expense-invoice-intake'
  and public.can_access_expense_invoice_intake_object(name)
);

drop policy if exists expense_invoice_intake_storage_insert on storage.objects;
create policy expense_invoice_intake_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'expense-invoice-intake'
  and public.can_access_expense_invoice_intake_object(name)
);

drop policy if exists expense_invoice_intake_storage_delete on storage.objects;
create policy expense_invoice_intake_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'expense-invoice-intake'
  and public.can_access_expense_invoice_intake_object(name)
);

commit;

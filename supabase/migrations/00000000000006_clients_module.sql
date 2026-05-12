create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  tax_id text not null unique,
  name text not null,
  address text,
  contact_name text,
  contact_phone text,
  contact_email text,
  billing_email text,
  start_date date,
  customer_rating smallint check (customer_rating is null or customer_rating between 0 and 10),
  active boolean not null default true,
  payment_method text not null default 'unknown' check (payment_method in ('unknown', 'stripe', 'sepa', 'transfer', 'other')),
  stripe_reference text,
  sepa_reference text,
  payment_notes text,
  comments text,
  sharepoint_site_id text,
  sharepoint_list_id text,
  sharepoint_item_id bigint,
  sharepoint_unique_id text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_number text not null unique,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'overdue', 'cancelled')),
  issue_date date,
  due_date date,
  paid_date date,
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(14, 2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  notes text,
  sharepoint_site_id text,
  sharepoint_list_id text,
  sharepoint_item_id bigint,
  sharepoint_unique_id text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  file_name text not null,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  storage_bucket text not null default 'client-documents',
  storage_path text not null unique,
  source_kind text not null default 'upload' check (source_kind in ('upload', 'sharepoint')),
  sharepoint_site_id text,
  sharepoint_list_id text,
  sharepoint_item_id bigint,
  sharepoint_unique_id text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_clients_name on public.clients (name);
create index if not exists idx_clients_active on public.clients (active);
create index if not exists idx_clients_payment on public.clients (payment_method);
create index if not exists idx_client_invoices_client_status on public.client_invoices (client_id, status);
create index if not exists idx_client_invoices_due on public.client_invoices (due_date);
create index if not exists idx_client_documents_client on public.client_documents (client_id, created_at desc);

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists set_client_invoices_updated_at on public.client_invoices;
create trigger set_client_invoices_updated_at
before update on public.client_invoices
for each row execute function public.set_updated_at();

create or replace function public.storage_client_document_client_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  client_text text;
begin
  client_text := split_part(coalesce(object_name, ''), '/', 1);
  if client_text = '' then
    return null;
  end if;

  return client_text::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.can_access_client_document_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.clients c
      where c.id = public.storage_client_document_client_id(object_name)
    );
$$;

alter table public.clients enable row level security;
alter table public.client_invoices enable row level security;
alter table public.client_documents enable row level security;

revoke all on public.clients from anon, authenticated;
revoke all on public.client_invoices from anon, authenticated;
revoke all on public.client_documents from anon, authenticated;

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.client_invoices to authenticated;
grant select, insert, update, delete on public.client_documents to authenticated;
grant execute on function public.can_access_client_document_object(text) to authenticated;

drop policy if exists clients_authenticated_select on public.clients;
create policy clients_authenticated_select
on public.clients
for select
to authenticated
using (public.is_app_user());

drop policy if exists clients_authenticated_insert on public.clients;
create policy clients_authenticated_insert
on public.clients
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists clients_authenticated_update on public.clients;
create policy clients_authenticated_update
on public.clients
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists clients_authenticated_delete on public.clients;
create policy clients_authenticated_delete
on public.clients
for delete
to authenticated
using (public.is_app_user());

drop policy if exists client_invoices_authenticated_select on public.client_invoices;
create policy client_invoices_authenticated_select
on public.client_invoices
for select
to authenticated
using (public.is_app_user());

drop policy if exists client_invoices_authenticated_insert on public.client_invoices;
create policy client_invoices_authenticated_insert
on public.client_invoices
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists client_invoices_authenticated_update on public.client_invoices;
create policy client_invoices_authenticated_update
on public.client_invoices
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists client_invoices_authenticated_delete on public.client_invoices;
create policy client_invoices_authenticated_delete
on public.client_invoices
for delete
to authenticated
using (public.is_app_user());

drop policy if exists client_documents_authenticated_select on public.client_documents;
create policy client_documents_authenticated_select
on public.client_documents
for select
to authenticated
using (public.is_app_user());

drop policy if exists client_documents_authenticated_insert on public.client_documents;
create policy client_documents_authenticated_insert
on public.client_documents
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists client_documents_authenticated_update on public.client_documents;
create policy client_documents_authenticated_update
on public.client_documents
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists client_documents_authenticated_delete on public.client_documents;
create policy client_documents_authenticated_delete
on public.client_documents
for delete
to authenticated
using (public.is_app_user());

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do update
set public = false;

drop policy if exists client_documents_storage_select on storage.objects;
create policy client_documents_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-documents'
  and public.can_access_client_document_object(name)
);

drop policy if exists client_documents_storage_insert on storage.objects;
create policy client_documents_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-documents'
  and public.can_access_client_document_object(name)
);

drop policy if exists client_documents_storage_update on storage.objects;
create policy client_documents_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'client-documents'
  and public.can_access_client_document_object(name)
)
with check (
  bucket_id = 'client-documents'
  and public.can_access_client_document_object(name)
);

drop policy if exists client_documents_storage_delete on storage.objects;
create policy client_documents_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-documents'
  and public.can_access_client_document_object(name)
);

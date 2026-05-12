begin;

create table if not exists public.expense_individuals (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  supplier_tax_id text not null,
  supplier_name text not null,
  title text not null,
  invoice_number text not null,
  expense_date date not null,
  payment_method text not null default 'n26' check (payment_method in ('n26', 'caixa', 'other')),
  net_amount numeric(14, 4),
  vat_rate numeric(6, 2) not null default 0,
  total_amount numeric(14, 4) not null default 0,
  currency text not null default 'EUR',
  notes text,
  legacy_has_attachment boolean not null default false,
  sharepoint_site_id text,
  sharepoint_list_id text,
  sharepoint_item_id bigint,
  sharepoint_unique_id text,
  sharepoint_etag text,
  source_raw jsonb,
  imported_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_individuals_sharepoint_source_unique
    unique (sharepoint_site_id, sharepoint_list_id, sharepoint_item_id)
);

create table if not exists public.expense_individual_documents (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expense_individuals(id) on delete cascade,
  file_name text not null,
  mime_type text,
  file_size bigint not null default 0,
  storage_bucket text not null default 'expense-documents',
  storage_path text not null unique,
  source_kind text not null default 'upload' check (source_kind in ('upload', 'sharepoint')),
  sharepoint_site_id text,
  sharepoint_list_id text,
  sharepoint_item_id bigint,
  sharepoint_unique_id text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_expense_individuals_supplier on public.expense_individuals (supplier_id);
create index if not exists idx_expense_individuals_date on public.expense_individuals (expense_date desc);
create index if not exists idx_expense_individuals_payment on public.expense_individuals (payment_method);
create index if not exists idx_expense_individuals_invoice on public.expense_individuals (invoice_number);
create index if not exists idx_expense_individuals_sharepoint_source on public.expense_individuals (
  sharepoint_list_id,
  sharepoint_item_id
);
create index if not exists idx_expense_individual_documents_expense on public.expense_individual_documents (
  expense_id,
  created_at desc
);

drop trigger if exists set_expense_individuals_updated_at on public.expense_individuals;
create trigger set_expense_individuals_updated_at
before update on public.expense_individuals
for each row execute function public.set_updated_at();

create or replace function public.storage_expense_document_expense_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  expense_text text;
begin
  expense_text := split_part(coalesce(object_name, ''), '/', 1);
  if expense_text = '' then
    return null;
  end if;

  return expense_text::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.can_access_expense_document_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.is_app_user()
    and exists (
      select 1
      from public.expense_individuals e
      where e.id = public.storage_expense_document_expense_id(object_name)
    );
$$;

alter table public.expense_individuals enable row level security;
alter table public.expense_individual_documents enable row level security;

revoke all on public.expense_individuals from anon, authenticated;
revoke all on public.expense_individual_documents from anon, authenticated;

grant select, insert, update, delete on public.expense_individuals to authenticated;
grant select, insert, update, delete on public.expense_individual_documents to authenticated;
grant execute on function public.can_access_expense_document_object(text) to authenticated;
grant execute on function public.storage_expense_document_expense_id(text) to authenticated;

drop policy if exists expense_individuals_authenticated_select on public.expense_individuals;
create policy expense_individuals_authenticated_select
on public.expense_individuals
for select
to authenticated
using (public.is_app_user());

drop policy if exists expense_individuals_authenticated_insert on public.expense_individuals;
create policy expense_individuals_authenticated_insert
on public.expense_individuals
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists expense_individuals_authenticated_update on public.expense_individuals;
create policy expense_individuals_authenticated_update
on public.expense_individuals
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists expense_individuals_authenticated_delete on public.expense_individuals;
create policy expense_individuals_authenticated_delete
on public.expense_individuals
for delete
to authenticated
using (public.is_app_user());

drop policy if exists expense_individual_documents_authenticated_select on public.expense_individual_documents;
create policy expense_individual_documents_authenticated_select
on public.expense_individual_documents
for select
to authenticated
using (public.is_app_user());

drop policy if exists expense_individual_documents_authenticated_insert on public.expense_individual_documents;
create policy expense_individual_documents_authenticated_insert
on public.expense_individual_documents
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists expense_individual_documents_authenticated_update on public.expense_individual_documents;
create policy expense_individual_documents_authenticated_update
on public.expense_individual_documents
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists expense_individual_documents_authenticated_delete on public.expense_individual_documents;
create policy expense_individual_documents_authenticated_delete
on public.expense_individual_documents
for delete
to authenticated
using (public.is_app_user());

insert into storage.buckets (id, name, public)
values ('expense-documents', 'expense-documents', false)
on conflict (id) do update
set public = false;

drop policy if exists expense_documents_storage_select on storage.objects;
create policy expense_documents_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'expense-documents'
  and public.can_access_expense_document_object(name)
);

drop policy if exists expense_documents_storage_insert on storage.objects;
create policy expense_documents_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'expense-documents'
  and public.can_access_expense_document_object(name)
);

drop policy if exists expense_documents_storage_update on storage.objects;
create policy expense_documents_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'expense-documents'
  and public.can_access_expense_document_object(name)
)
with check (
  bucket_id = 'expense-documents'
  and public.can_access_expense_document_object(name)
);

drop policy if exists expense_documents_storage_delete on storage.objects;
create policy expense_documents_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'expense-documents'
  and public.can_access_expense_document_object(name)
);

commit;

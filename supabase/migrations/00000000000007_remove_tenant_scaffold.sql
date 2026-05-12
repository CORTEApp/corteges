begin;

drop schema if exists sharepoint_import cascade;

drop table if exists public.client_documents cascade;
drop table if exists public.client_invoices cascade;
drop table if exists public.clients cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.company_memberships cascade;
drop table if exists public.companies cascade;
drop table if exists public.user_profiles cascade;

drop function if exists public.is_platform_admin() cascade;
drop function if exists public.is_member_of_company(uuid) cascade;
drop function if exists public.has_company_role(uuid, text[]) cascade;
drop function if exists public.current_company_role(uuid) cascade;
drop function if exists public.can_manage_membership(uuid, uuid, text) cascade;
drop function if exists public.bootstrap_first_company(text, text) cascade;
drop function if exists public.client_source_matches_company(uuid, uuid) cascade;
drop function if exists public.storage_client_document_company_id(text) cascade;
drop function if exists public.storage_client_document_client_id(text) cascade;
drop function if exists public.can_access_client_document_object(text) cascade;
drop function if exists public.can_manage_client_document_object(text) cascade;

drop policy if exists client_documents_storage_select on storage.objects;
drop policy if exists client_documents_storage_insert on storage.objects;
drop policy if exists client_documents_storage_update on storage.objects;
drop policy if exists client_documents_storage_delete on storage.objects;

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_name text not null,
  entity_id text,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_created on public.audit_logs (created_at desc);
create index idx_audit_logs_actor on public.audit_logs (actor_user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.user_profiles.display_name, excluded.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace function public.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

alter table public.user_profiles enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.user_profiles from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

grant usage on schema public to authenticated;
grant select on public.user_profiles to authenticated;
grant update (display_name, avatar_url) on public.user_profiles to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_app_user() to authenticated;

create policy profiles_select_self
on public.user_profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_update_self_safe_fields
on public.user_profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy audit_logs_select_authenticated
on public.audit_logs
for select
to authenticated
using (public.is_app_user());

create policy audit_logs_insert_authenticated
on public.audit_logs
for insert
to authenticated
with check (actor_user_id = auth.uid());

create schema sharepoint_import;

revoke all on schema sharepoint_import from anon, authenticated;
grant usage on schema sharepoint_import to service_role;

create table sharepoint_import.import_runs (
  id uuid primary key default gen_random_uuid(),
  site_url text not null,
  site_id text,
  export_dir text,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb
);

create table sharepoint_import.lists (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  list_id text not null,
  title text not null,
  slug text not null,
  kind text not null check (kind in ('list', 'document_library')),
  base_type text,
  raw jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (site_id, list_id)
);

create table sharepoint_import.fields (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  list_id text not null,
  internal_name text not null,
  title text not null,
  type_as_string text,
  pg_type text not null,
  staging_column text not null,
  public_column text not null,
  category text not null,
  lookup_list_id text,
  raw jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (site_id, list_id, internal_name)
);

create table sharepoint_import.attachments_inventory (
  id uuid primary key default gen_random_uuid(),
  sharepoint_site_id text not null,
  sharepoint_list_id text not null,
  sharepoint_item_id bigint not null,
  file_name text not null default '',
  server_relative_url text not null default '',
  raw jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (
    sharepoint_site_id,
    sharepoint_list_id,
    sharepoint_item_id,
    file_name,
    server_relative_url
  )
);

create table sharepoint_import.documents_inventory (
  id uuid primary key default gen_random_uuid(),
  sharepoint_site_id text not null,
  sharepoint_list_id text not null,
  sharepoint_item_id bigint not null,
  file_ref text not null default '',
  file_leaf_ref text,
  file_dir_ref text,
  file_size bigint,
  content_type text,
  raw jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (
    sharepoint_site_id,
    sharepoint_list_id,
    sharepoint_item_id,
    file_ref
  )
);

create index idx_sharepoint_import_runs_started
  on sharepoint_import.import_runs (started_at desc);
create index idx_sharepoint_import_lists_site
  on sharepoint_import.lists (site_id);
create index idx_sharepoint_import_fields_list
  on sharepoint_import.fields (site_id, list_id);
create index idx_sharepoint_import_attachments_item
  on sharepoint_import.attachments_inventory (sharepoint_site_id, sharepoint_list_id, sharepoint_item_id);
create index idx_sharepoint_import_documents_item
  on sharepoint_import.documents_inventory (sharepoint_site_id, sharepoint_list_id, sharepoint_item_id);

alter table sharepoint_import.import_runs enable row level security;
alter table sharepoint_import.lists enable row level security;
alter table sharepoint_import.fields enable row level security;
alter table sharepoint_import.attachments_inventory enable row level security;
alter table sharepoint_import.documents_inventory enable row level security;

revoke all on all tables in schema sharepoint_import from anon, authenticated;
revoke all on all sequences in schema sharepoint_import from anon, authenticated;
grant select, insert, update, delete on all tables in schema sharepoint_import to service_role;
grant usage, select on all sequences in schema sharepoint_import to service_role;

alter default privileges in schema sharepoint_import revoke all on tables from anon, authenticated;
alter default privileges in schema sharepoint_import grant select, insert, update, delete on tables to service_role;

create table public.clients (
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

create table public.client_invoices (
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

create table public.client_documents (
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

create index idx_clients_name on public.clients (name);
create index idx_clients_active on public.clients (active);
create index idx_clients_payment on public.clients (payment_method);
create index idx_client_invoices_client_status on public.client_invoices (client_id, status);
create index idx_client_invoices_due on public.client_invoices (due_date);
create index idx_client_documents_client on public.client_documents (client_id, created_at desc);

create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

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

create policy clients_authenticated_select on public.clients for select to authenticated using (public.is_app_user());
create policy clients_authenticated_insert on public.clients for insert to authenticated with check (public.is_app_user());
create policy clients_authenticated_update on public.clients for update to authenticated using (public.is_app_user()) with check (public.is_app_user());
create policy clients_authenticated_delete on public.clients for delete to authenticated using (public.is_app_user());

create policy client_invoices_authenticated_select on public.client_invoices for select to authenticated using (public.is_app_user());
create policy client_invoices_authenticated_insert on public.client_invoices for insert to authenticated with check (public.is_app_user());
create policy client_invoices_authenticated_update on public.client_invoices for update to authenticated using (public.is_app_user()) with check (public.is_app_user());
create policy client_invoices_authenticated_delete on public.client_invoices for delete to authenticated using (public.is_app_user());

create policy client_documents_authenticated_select on public.client_documents for select to authenticated using (public.is_app_user());
create policy client_documents_authenticated_insert on public.client_documents for insert to authenticated with check (public.is_app_user());
create policy client_documents_authenticated_update on public.client_documents for update to authenticated using (public.is_app_user()) with check (public.is_app_user());
create policy client_documents_authenticated_delete on public.client_documents for delete to authenticated using (public.is_app_user());

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do update
set public = false;

create policy client_documents_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-documents'
  and public.can_access_client_document_object(name)
);

create policy client_documents_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-documents'
  and public.can_access_client_document_object(name)
);

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

create policy client_documents_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-documents'
  and public.can_access_client_document_object(name)
);

commit;

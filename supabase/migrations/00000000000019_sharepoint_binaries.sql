begin;

create table if not exists sharepoint_import.binary_files (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('list_attachment', 'document_library', 'local_file')),
  sharepoint_site_id text,
  sharepoint_list_id text not null,
  sharepoint_list_title text,
  sharepoint_item_id bigint not null,
  sharepoint_unique_id text,
  sharepoint_etag text,
  file_name text not null,
  server_relative_url text,
  web_url text,
  content_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  sha256 text,
  local_path text,
  storage_bucket text,
  storage_path text,
  destination_table text,
  destination_record_id uuid,
  download_status text not null default 'pending' check (download_status in ('pending', 'downloaded', 'uploaded', 'failed', 'skipped')),
  error_message text,
  raw jsonb not null default '{}'::jsonb,
  downloaded_at timestamptz,
  uploaded_at timestamptz,
  imported_at timestamptz not null default now()
);

create unique index if not exists idx_sharepoint_binary_files_storage
  on sharepoint_import.binary_files (storage_bucket, storage_path)
  where storage_bucket is not null and storage_path is not null;

create unique index if not exists idx_sharepoint_binary_files_source_hash
  on sharepoint_import.binary_files (
    coalesce(sharepoint_site_id, ''),
    sharepoint_list_id,
    sharepoint_item_id,
    file_name,
    coalesce(sha256, '')
  );

create index if not exists idx_sharepoint_binary_files_source
  on sharepoint_import.binary_files (sharepoint_list_id, sharepoint_item_id);

create index if not exists idx_sharepoint_binary_files_destination
  on sharepoint_import.binary_files (destination_table, destination_record_id);

alter table public.client_documents
  add column if not exists source_sha256 text,
  add column if not exists source_url text,
  add column if not exists source_downloaded_at timestamptz,
  add column if not exists binary_file_id uuid references sharepoint_import.binary_files(id) on delete set null;

alter table public.expense_individual_documents
  add column if not exists source_sha256 text,
  add column if not exists source_url text,
  add column if not exists source_downloaded_at timestamptz,
  add column if not exists binary_file_id uuid references sharepoint_import.binary_files(id) on delete set null;

create index if not exists idx_client_documents_binary_file
  on public.client_documents (binary_file_id)
  where binary_file_id is not null;

create index if not exists idx_client_documents_source_sha256
  on public.client_documents (source_sha256)
  where source_sha256 is not null;

create index if not exists idx_expense_individual_documents_binary_file
  on public.expense_individual_documents (binary_file_id)
  where binary_file_id is not null;

create index if not exists idx_expense_individual_documents_source_sha256
  on public.expense_individual_documents (source_sha256)
  where source_sha256 is not null;

create table if not exists public.billing_document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.billing_documents(id) on delete cascade,
  file_name text not null,
  mime_type text,
  file_size bigint not null default 0 check (file_size >= 0),
  storage_bucket text not null default 'billing-documents',
  storage_path text not null unique,
  source_kind text not null default 'sharepoint' check (source_kind in ('upload', 'sharepoint')),
  source_sha256 text,
  source_url text,
  source_downloaded_at timestamptz,
  sharepoint_site_id text,
  sharepoint_list_id text,
  sharepoint_item_id bigint,
  sharepoint_unique_id text,
  binary_file_id uuid references sharepoint_import.binary_files(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_document_files_document
  on public.billing_document_files (document_id, created_at desc);

create index if not exists idx_billing_document_files_binary_file
  on public.billing_document_files (binary_file_id)
  where binary_file_id is not null;

create index if not exists idx_billing_document_files_source
  on public.billing_document_files (sharepoint_list_id, sharepoint_item_id);

create index if not exists idx_billing_document_files_source_sha256
  on public.billing_document_files (source_sha256)
  where source_sha256 is not null;

create or replace function public.storage_billing_document_file_document_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  document_text text;
begin
  document_text := split_part(coalesce(object_name, ''), '/', 1);
  if document_text = '' then
    return null;
  end if;

  return document_text::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.can_access_billing_document_file_object(object_name text)
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
      from public.billing_documents d
      where d.id = public.storage_billing_document_file_document_id(object_name)
    );
$$;

alter table sharepoint_import.binary_files enable row level security;
alter table public.billing_document_files enable row level security;
alter table public.billing_document_files force row level security;

revoke all on sharepoint_import.binary_files from anon, authenticated;
grant select, insert, update, delete on sharepoint_import.binary_files to service_role;

revoke all on public.billing_document_files from anon, authenticated;
grant select on public.billing_document_files to authenticated;
grant execute on function public.storage_billing_document_file_document_id(text) to authenticated;
grant execute on function public.can_access_billing_document_file_object(text) to authenticated;

drop policy if exists billing_document_files_authenticated_select on public.billing_document_files;
create policy billing_document_files_authenticated_select
on public.billing_document_files
for select
to authenticated
using (public.is_app_user());

insert into storage.buckets (id, name, public)
values
  ('billing-documents', 'billing-documents', false),
  ('sharepoint-binaries', 'sharepoint-binaries', false)
on conflict (id) do update
set public = false;

drop policy if exists billing_documents_storage_select on storage.objects;
create policy billing_documents_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'billing-documents'
  and public.can_access_billing_document_file_object(name)
);

commit;

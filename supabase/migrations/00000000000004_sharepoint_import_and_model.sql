create schema if not exists sharepoint_import;

revoke all on schema sharepoint_import from anon, authenticated;
grant usage on schema sharepoint_import to service_role;

create table if not exists sharepoint_import.import_runs (
  id uuid primary key default gen_random_uuid(),
  site_url text not null,
  site_id text,
  export_dir text,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb
);

create table if not exists sharepoint_import.lists (
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

create table if not exists sharepoint_import.fields (
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

create table if not exists sharepoint_import.attachments_inventory (
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

create table if not exists sharepoint_import.documents_inventory (
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

create index if not exists idx_sharepoint_import_runs_started
  on sharepoint_import.import_runs (started_at desc);
create index if not exists idx_sharepoint_import_lists_site
  on sharepoint_import.lists (site_id);
create index if not exists idx_sharepoint_import_fields_list
  on sharepoint_import.fields (site_id, list_id);
create index if not exists idx_sharepoint_import_attachments_item
  on sharepoint_import.attachments_inventory (sharepoint_site_id, sharepoint_list_id, sharepoint_item_id);
create index if not exists idx_sharepoint_import_documents_item
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

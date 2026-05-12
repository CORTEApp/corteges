create table if not exists public.client_history_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  tax_id text,
  name text,
  address text,
  contact_name text,
  contact_phone text,
  contact_email text,
  billing_email text,
  start_date date,
  customer_rating smallint check (customer_rating is null or customer_rating between 0 and 10),
  active boolean,
  active_label text,
  payment_method text not null default 'unknown' check (payment_method in ('unknown', 'stripe', 'sepa', 'transfer', 'other')),
  stripe_reference text,
  sepa_reference text,
  payment_notes text,
  comments text,
  current_line text,
  lead_id text,
  source_created_at timestamptz,
  source_modified_at timestamptz,
  sharepoint_site_id text not null,
  sharepoint_list_id text not null,
  sharepoint_item_id bigint not null,
  sharepoint_unique_id text,
  sharepoint_etag text,
  raw jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (sharepoint_site_id, sharepoint_list_id, sharepoint_item_id)
);

create index if not exists idx_client_history_entries_client
  on public.client_history_entries (client_id, source_modified_at desc, sharepoint_item_id desc);

create index if not exists idx_client_history_entries_tax_id
  on public.client_history_entries (tax_id);

create index if not exists idx_client_history_entries_sharepoint
  on public.client_history_entries (sharepoint_list_id, sharepoint_item_id);

alter table public.client_history_entries enable row level security;

revoke all on public.client_history_entries from anon, authenticated;
grant select, insert, update, delete on public.client_history_entries to authenticated;

drop policy if exists client_history_entries_authenticated_select on public.client_history_entries;
create policy client_history_entries_authenticated_select
on public.client_history_entries
for select
to authenticated
using (public.is_app_user());

drop policy if exists client_history_entries_authenticated_insert on public.client_history_entries;
create policy client_history_entries_authenticated_insert
on public.client_history_entries
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists client_history_entries_authenticated_update on public.client_history_entries;
create policy client_history_entries_authenticated_update
on public.client_history_entries
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists client_history_entries_authenticated_delete on public.client_history_entries;
create policy client_history_entries_authenticated_delete
on public.client_history_entries
for delete
to authenticated
using (public.is_app_user());

begin;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tax_id text not null unique,
  name text not null,
  contact_name text,
  contact_phone text,
  contact_email text,
  start_date date,
  active boolean not null default true,
  payment_method text not null default 'unknown' check (payment_method in ('unknown', 'stripe', 'sepa', 'transfer', 'other')),
  sepa_reference text,
  stripe_reference text,
  comments text,
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
  updated_at timestamptz not null default now()
);

create index if not exists idx_suppliers_name on public.suppliers (name);
create index if not exists idx_suppliers_active on public.suppliers (active);
create index if not exists idx_suppliers_payment on public.suppliers (payment_method);
create index if not exists idx_suppliers_sharepoint_source on public.suppliers (
  sharepoint_site_id,
  sharepoint_list_id,
  sharepoint_item_id
);

drop trigger if exists set_suppliers_updated_at on public.suppliers;
create trigger set_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

revoke all on public.suppliers from anon, authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;

drop policy if exists suppliers_authenticated_select on public.suppliers;
create policy suppliers_authenticated_select
on public.suppliers
for select
to authenticated
using (public.is_app_user());

drop policy if exists suppliers_authenticated_insert on public.suppliers;
create policy suppliers_authenticated_insert
on public.suppliers
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists suppliers_authenticated_update on public.suppliers;
create policy suppliers_authenticated_update
on public.suppliers
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists suppliers_authenticated_delete on public.suppliers;
create policy suppliers_authenticated_delete
on public.suppliers
for delete
to authenticated
using (public.is_app_user());

commit;

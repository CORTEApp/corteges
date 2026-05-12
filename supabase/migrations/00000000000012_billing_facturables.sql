create table if not exists public.billing_facturables (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text not null default '',
  type text not null default 'Otro',
  unit_price numeric(14,4) not null default 0,
  vat_rate numeric(5,2) not null default 21,
  total_amount numeric(14,4) generated always as (round(unit_price * (1 + vat_rate / 100), 4)) stored,
  unit_type text not null default 'Unidad',
  comments text,
  active boolean not null default true,
  is_current boolean not null default true,
  sharepoint_site_id text,
  sharepoint_list_id text,
  sharepoint_item_id bigint,
  sharepoint_unique_id text,
  sharepoint_etag text,
  source_raw jsonb not null default '{}'::jsonb,
  imported_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_facturables_code_not_blank check (btrim(code) <> ''),
  constraint billing_facturables_type_check check (type in ('Aplicación', 'Suscripción', 'Licencia', 'Programación', 'Descuento', 'Otro')),
  constraint billing_facturables_unit_type_check check (unit_type in ('Unidad', 'Hora')),
  constraint billing_facturables_vat_rate_check check (vat_rate >= 0 and vat_rate <= 100),
  constraint billing_facturables_code_key unique (code)
);

create index if not exists idx_billing_facturables_active_current
  on public.billing_facturables (active, is_current, code);

create index if not exists idx_billing_facturables_type
  on public.billing_facturables (type);

create index if not exists idx_billing_facturables_unit_type
  on public.billing_facturables (unit_type);

create index if not exists idx_billing_facturables_sharepoint
  on public.billing_facturables (sharepoint_list_id, sharepoint_item_id);

drop trigger if exists trg_billing_facturables_updated_at on public.billing_facturables;
create trigger trg_billing_facturables_updated_at
before update on public.billing_facturables
for each row execute function public.set_updated_at();

alter table public.billing_facturables enable row level security;
alter table public.billing_facturables force row level security;

revoke all on public.billing_facturables from anon, authenticated;
grant select, insert, update on public.billing_facturables to authenticated;

drop policy if exists billing_facturables_authenticated_select on public.billing_facturables;
create policy billing_facturables_authenticated_select
on public.billing_facturables
for select
to authenticated
using (public.is_app_user());

drop policy if exists billing_facturables_authenticated_insert on public.billing_facturables;
create policy billing_facturables_authenticated_insert
on public.billing_facturables
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists billing_facturables_authenticated_update on public.billing_facturables;
create policy billing_facturables_authenticated_update
on public.billing_facturables
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists billing_facturables_authenticated_delete on public.billing_facturables;

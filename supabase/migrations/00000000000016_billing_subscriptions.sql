create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  client_tax_id text,
  client_name text not null,
  billing_email text,
  facturable_id uuid references public.billing_facturables(id) on delete set null,
  subscription_code text not null,
  description text not null default '',
  start_date date not null default current_date,
  end_date date,
  quantity numeric(14, 4) not null default 1,
  recurring_total_amount numeric(14, 4) not null default 0,
  currency text not null default 'EUR',
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
  constraint billing_subscriptions_client_name_not_blank check (btrim(client_name) <> ''),
  constraint billing_subscriptions_code_not_blank check (btrim(subscription_code) <> ''),
  constraint billing_subscriptions_description_not_blank check (btrim(description) <> ''),
  constraint billing_subscriptions_quantity_check check (quantity > 0),
  constraint billing_subscriptions_total_check check (recurring_total_amount >= 0),
  constraint billing_subscriptions_currency_check check (char_length(currency) = 3),
  constraint billing_subscriptions_dates_check check (end_date is null or end_date >= start_date)
);

drop index if exists public.idx_billing_subscriptions_sharepoint_unique;
create unique index idx_billing_subscriptions_sharepoint_unique
  on public.billing_subscriptions (sharepoint_list_id, sharepoint_item_id);

create index if not exists idx_billing_subscriptions_active_window
  on public.billing_subscriptions (start_date, end_date);

create index if not exists idx_billing_subscriptions_client
  on public.billing_subscriptions (client_id, client_name);

create index if not exists idx_billing_subscriptions_code
  on public.billing_subscriptions (upper(btrim(subscription_code)));

drop trigger if exists trg_billing_subscriptions_updated_at on public.billing_subscriptions;
create trigger trg_billing_subscriptions_updated_at
before update on public.billing_subscriptions
for each row execute function public.set_updated_at();

alter table public.billing_subscriptions enable row level security;
alter table public.billing_subscriptions force row level security;

revoke all on public.billing_subscriptions from anon, authenticated;
grant select, insert, update on public.billing_subscriptions to authenticated;

drop policy if exists billing_subscriptions_authenticated_select on public.billing_subscriptions;
create policy billing_subscriptions_authenticated_select
on public.billing_subscriptions
for select
to authenticated
using (public.is_app_user());

drop policy if exists billing_subscriptions_authenticated_insert on public.billing_subscriptions;
create policy billing_subscriptions_authenticated_insert
on public.billing_subscriptions
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists billing_subscriptions_authenticated_update on public.billing_subscriptions;
create policy billing_subscriptions_authenticated_update
on public.billing_subscriptions
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists billing_subscriptions_authenticated_delete on public.billing_subscriptions;

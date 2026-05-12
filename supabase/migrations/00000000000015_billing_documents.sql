create table if not exists public.billing_number_sequences (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  series text not null,
  number_year integer not null,
  last_value integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_number_sequences_type_check check (document_type in ('proforma', 'invoice')),
  constraint billing_number_sequences_series_check check (btrim(series) <> ''),
  constraint billing_number_sequences_year_check check (number_year between 2000 and 2200),
  constraint billing_number_sequences_last_value_check check (last_value >= 0),
  constraint billing_number_sequences_unique unique (document_type, series, number_year)
);

create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  status text not null default 'issued',
  payment_status text not null default 'unpaid',
  series text not null,
  number_year integer not null,
  number_value integer not null,
  document_number text not null,
  source_proforma_id uuid references public.billing_documents(id) on delete set null,
  source_proforma_number text,
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  client_tax_id text,
  billing_email text,
  project text,
  issue_date date not null default current_date,
  due_date date,
  paid_date date,
  payment_method text,
  subtotal_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  currency text not null default 'EUR',
  observations text,
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
  constraint billing_documents_type_check check (document_type in ('proforma', 'invoice')),
  constraint billing_documents_status_check check (status in ('issued', 'paid', 'invoiced', 'discarded', 'cancelled')),
  constraint billing_documents_payment_status_check check (payment_status in ('unpaid', 'paid', 'legacy_partial')),
  constraint billing_documents_series_check check (btrim(series) <> ''),
  constraint billing_documents_number_year_check check (number_year between 2000 and 2200),
  constraint billing_documents_number_value_check check (number_value > 0),
  constraint billing_documents_number_not_blank check (btrim(document_number) <> ''),
  constraint billing_documents_client_name_not_blank check (btrim(client_name) <> ''),
  constraint billing_documents_currency_check check (char_length(currency) = 3)
);

create table if not exists public.billing_document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.billing_documents(id) on delete cascade,
  line_index integer not null default 1,
  facturable_id uuid references public.billing_facturables(id) on delete set null,
  code text,
  description text not null,
  quantity numeric(14, 4) not null default 1,
  unit_price numeric(14, 4) not null default 0,
  vat_rate numeric(5, 2) not null default 21,
  unit_type text not null default 'Unidad',
  subtotal_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  sharepoint_site_id text,
  sharepoint_list_id text,
  sharepoint_item_id bigint,
  sharepoint_unique_id text,
  sharepoint_etag text,
  source_raw jsonb not null default '{}'::jsonb,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  constraint billing_document_lines_index_check check (line_index > 0),
  constraint billing_document_lines_description_not_blank check (btrim(description) <> ''),
  constraint billing_document_lines_quantity_check check (quantity <> 0),
  constraint billing_document_lines_vat_rate_check check (vat_rate >= 0 and vat_rate <= 100),
  constraint billing_document_lines_total_not_zero_for_zero_price check (
    unit_price <> 0 or total_amount = 0
  )
);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  proforma_id uuid not null references public.billing_documents(id) on delete cascade,
  amount numeric(14, 2) not null,
  payment_date date not null default current_date,
  payment_method text not null default 'other',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint billing_payments_amount_check check (amount > 0),
  constraint billing_payments_method_check check (payment_method in ('stripe', 'sepa', 'transfer', 'other'))
);

create unique index if not exists idx_billing_documents_number_unique
  on public.billing_documents (document_number);

create unique index if not exists idx_billing_documents_series_value_unique
  on public.billing_documents (document_type, series, number_year, number_value);

create unique index if not exists idx_billing_documents_sharepoint_unique
  on public.billing_documents (sharepoint_list_id, sharepoint_item_id);

create unique index if not exists idx_billing_documents_invoice_source_unique
  on public.billing_documents (source_proforma_id)
  where document_type = 'invoice' and source_proforma_id is not null and imported_at is null;

create index if not exists idx_billing_documents_type_status
  on public.billing_documents (document_type, status, issue_date desc);

create index if not exists idx_billing_documents_client
  on public.billing_documents (client_id, issue_date desc);

create unique index if not exists idx_billing_document_lines_document_index
  on public.billing_document_lines (document_id, line_index);

create unique index if not exists idx_billing_document_lines_sharepoint_unique
  on public.billing_document_lines (sharepoint_list_id, sharepoint_item_id);

create index if not exists idx_billing_document_lines_document
  on public.billing_document_lines (document_id, line_index);

create unique index if not exists idx_billing_payments_one_per_proforma
  on public.billing_payments (proforma_id);

create index if not exists idx_billing_payments_date
  on public.billing_payments (payment_date desc);

drop trigger if exists trg_billing_number_sequences_updated_at on public.billing_number_sequences;
create trigger trg_billing_number_sequences_updated_at
before update on public.billing_number_sequences
for each row execute function public.set_updated_at();

drop trigger if exists trg_billing_documents_updated_at on public.billing_documents;
create trigger trg_billing_documents_updated_at
before update on public.billing_documents
for each row execute function public.set_updated_at();

create or replace function public.next_billing_document_number(
  p_document_type text,
  p_series text,
  p_number_year integer
)
returns table(number_value integer, document_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_type text := lower(btrim(p_document_type));
  v_series text := upper(btrim(p_series));
  v_next integer;
begin
  if not public.is_app_user() then
    raise exception 'Not authorized';
  end if;

  if v_document_type not in ('proforma', 'invoice') then
    raise exception 'Invalid billing document type: %', p_document_type;
  end if;

  if v_series = '' then
    raise exception 'Billing document series is required';
  end if;

  if p_number_year is null or p_number_year < 2000 or p_number_year > 2200 then
    raise exception 'Invalid billing document year: %', p_number_year;
  end if;

  loop
    update public.billing_number_sequences
    set last_value = last_value + 1
    where document_type = v_document_type
      and series = v_series
      and number_year = p_number_year
    returning last_value into v_next;

    if found then
      exit;
    end if;

    begin
      insert into public.billing_number_sequences (document_type, series, number_year, last_value)
      values (v_document_type, v_series, p_number_year, 1)
      returning last_value into v_next;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  number_value := v_next;
  document_number := format('%s-%s/%s', v_series, p_number_year, v_next);
  return next;
end;
$$;

create or replace function public.issue_invoice_from_paid_proforma(
  p_proforma_id uuid,
  p_issue_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proforma public.billing_documents%rowtype;
  v_existing_invoice_id uuid;
  v_number record;
  v_invoice_id uuid;
  v_issue_date date := coalesce(p_issue_date, current_date);
  v_user_id uuid := auth.uid();
begin
  if not public.is_app_user() then
    raise exception 'Not authorized';
  end if;

  select *
  into v_proforma
  from public.billing_documents
  where id = p_proforma_id
  for update;

  if not found then
    raise exception 'Proforma not found';
  end if;

  if v_proforma.document_type <> 'proforma' then
    raise exception 'Only proformas can issue invoices';
  end if;

  if v_proforma.status <> 'paid' or v_proforma.payment_status <> 'paid' then
    raise exception 'The proforma must be fully paid before invoice issuance';
  end if;

  select id
  into v_existing_invoice_id
  from public.billing_documents
  where document_type = 'invoice'
    and source_proforma_id = p_proforma_id
  limit 1;

  if found then
    raise exception 'The proforma already has an invoice';
  end if;

  select *
  into v_number
  from public.next_billing_document_number('invoice', 'F', extract(year from v_issue_date)::integer);

  insert into public.billing_documents (
    document_type,
    status,
    payment_status,
    series,
    number_year,
    number_value,
    document_number,
    source_proforma_id,
    source_proforma_number,
    client_id,
    client_name,
    client_tax_id,
    billing_email,
    project,
    issue_date,
    due_date,
    paid_date,
    payment_method,
    subtotal_amount,
    tax_amount,
    total_amount,
    currency,
    observations,
    created_by,
    updated_by
  )
  values (
    'invoice',
    'paid',
    'paid',
    'F',
    extract(year from v_issue_date)::integer,
    v_number.number_value,
    v_number.document_number,
    v_proforma.id,
    v_proforma.document_number,
    v_proforma.client_id,
    v_proforma.client_name,
    v_proforma.client_tax_id,
    v_proforma.billing_email,
    v_proforma.project,
    v_issue_date,
    coalesce(v_proforma.due_date, v_issue_date),
    coalesce(v_proforma.paid_date, v_issue_date),
    coalesce(v_proforma.payment_method, 'other'),
    v_proforma.subtotal_amount,
    v_proforma.tax_amount,
    v_proforma.total_amount,
    v_proforma.currency,
    v_proforma.observations,
    v_user_id,
    v_user_id
  )
  returning id into v_invoice_id;

  insert into public.billing_document_lines (
    document_id,
    line_index,
    facturable_id,
    code,
    description,
    quantity,
    unit_price,
    vat_rate,
    unit_type,
    subtotal_amount,
    tax_amount,
    total_amount,
    source_raw,
    imported_at
  )
  select
    v_invoice_id,
    line_index,
    facturable_id,
    code,
    description,
    quantity,
    unit_price,
    vat_rate,
    unit_type,
    subtotal_amount,
    tax_amount,
    total_amount,
    source_raw,
    imported_at
  from public.billing_document_lines
  where document_id = v_proforma.id
  order by line_index;

  update public.billing_documents
  set status = 'invoiced',
      updated_by = v_user_id
  where id = v_proforma.id;

  return v_invoice_id;
end;
$$;

alter table public.billing_number_sequences enable row level security;
alter table public.billing_number_sequences force row level security;
alter table public.billing_documents enable row level security;
alter table public.billing_documents force row level security;
alter table public.billing_document_lines enable row level security;
alter table public.billing_document_lines force row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_payments force row level security;

revoke all on public.billing_number_sequences from anon, authenticated;
revoke all on public.billing_documents from anon, authenticated;
revoke all on public.billing_document_lines from anon, authenticated;
revoke all on public.billing_payments from anon, authenticated;

grant select on public.billing_number_sequences to authenticated;
grant select, insert, update, delete on public.billing_documents to authenticated;
grant select, insert, update, delete on public.billing_document_lines to authenticated;
grant select, insert, update, delete on public.billing_payments to authenticated;
grant execute on function public.next_billing_document_number(text, text, integer) to authenticated;
grant execute on function public.issue_invoice_from_paid_proforma(uuid, date) to authenticated;

drop policy if exists billing_number_sequences_authenticated_select on public.billing_number_sequences;
create policy billing_number_sequences_authenticated_select
on public.billing_number_sequences
for select
to authenticated
using (public.is_app_user());

drop policy if exists billing_number_sequences_authenticated_insert on public.billing_number_sequences;
create policy billing_number_sequences_authenticated_insert
on public.billing_number_sequences
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists billing_number_sequences_authenticated_update on public.billing_number_sequences;
create policy billing_number_sequences_authenticated_update
on public.billing_number_sequences
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists billing_documents_authenticated_select on public.billing_documents;
create policy billing_documents_authenticated_select
on public.billing_documents
for select
to authenticated
using (public.is_app_user());

drop policy if exists billing_documents_authenticated_insert on public.billing_documents;
create policy billing_documents_authenticated_insert
on public.billing_documents
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists billing_documents_authenticated_update on public.billing_documents;
create policy billing_documents_authenticated_update
on public.billing_documents
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists billing_documents_authenticated_delete on public.billing_documents;
create policy billing_documents_authenticated_delete
on public.billing_documents
for delete
to authenticated
using (public.is_app_user());

drop policy if exists billing_document_lines_authenticated_select on public.billing_document_lines;
create policy billing_document_lines_authenticated_select
on public.billing_document_lines
for select
to authenticated
using (public.is_app_user());

drop policy if exists billing_document_lines_authenticated_insert on public.billing_document_lines;
create policy billing_document_lines_authenticated_insert
on public.billing_document_lines
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists billing_document_lines_authenticated_update on public.billing_document_lines;
create policy billing_document_lines_authenticated_update
on public.billing_document_lines
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists billing_document_lines_authenticated_delete on public.billing_document_lines;
create policy billing_document_lines_authenticated_delete
on public.billing_document_lines
for delete
to authenticated
using (public.is_app_user());

drop policy if exists billing_payments_authenticated_select on public.billing_payments;
create policy billing_payments_authenticated_select
on public.billing_payments
for select
to authenticated
using (public.is_app_user());

drop policy if exists billing_payments_authenticated_insert on public.billing_payments;
create policy billing_payments_authenticated_insert
on public.billing_payments
for insert
to authenticated
with check (
  public.is_app_user()
  and exists (
    select 1
    from public.billing_documents d
    where d.id = proforma_id
      and d.document_type = 'proforma'
  )
);

drop policy if exists billing_payments_authenticated_update on public.billing_payments;
create policy billing_payments_authenticated_update
on public.billing_payments
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists billing_payments_authenticated_delete on public.billing_payments;
create policy billing_payments_authenticated_delete
on public.billing_payments
for delete
to authenticated
using (public.is_app_user());

insert into public.billing_number_sequences (document_type, series, number_year, last_value)
values
  ('proforma', 'P', 2026, 56),
  ('invoice', 'F', 2026, 136)
on conflict (document_type, series, number_year)
do update set last_value = greatest(public.billing_number_sequences.last_value, excluded.last_value);

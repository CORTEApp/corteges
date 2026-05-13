begin;

alter table public.billing_subscriptions
  add column if not exists apply_vat boolean not null default true,
  add column if not exists vat_rate numeric(5, 2) not null default 21;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_subscriptions_vat_rate_check'
      and conrelid = 'public.billing_subscriptions'::regclass
  ) then
    alter table public.billing_subscriptions
      add constraint billing_subscriptions_vat_rate_check check (vat_rate >= 0 and vat_rate <= 100);
  end if;
end $$;

create table if not exists public.billing_invoice_approval_batches (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status text not null default 'open',
  source text not null default 'manual',
  candidate_count integer not null default 0,
  total_amount numeric(14, 2) not null default 0,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_invoice_approval_batches_period_start_month_check check (period_start = date_trunc('month', period_start)::date),
  constraint billing_invoice_approval_batches_period_end_check check (period_end >= period_start),
  constraint billing_invoice_approval_batches_status_check check (status in ('open', 'closed', 'failed')),
  constraint billing_invoice_approval_batches_source_check check (source in ('manual', 'cron')),
  constraint billing_invoice_approval_batches_candidate_count_check check (candidate_count >= 0),
  constraint billing_invoice_approval_batches_total_amount_check check (total_amount >= 0)
);

create table if not exists public.billing_invoice_approval_candidates (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.billing_invoice_approval_batches(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  client_group_key text not null,
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  client_tax_id text,
  billing_email text,
  currency text not null default 'EUR',
  subtotal_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  status text not null default 'pending',
  invoice_id uuid unique references public.billing_documents(id) on delete set null,
  mail_job_id uuid references public.mail_dispatch_jobs(id) on delete set null,
  last_error text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_invoice_approval_candidates_period_start_month_check check (period_start = date_trunc('month', period_start)::date),
  constraint billing_invoice_approval_candidates_period_end_check check (period_end >= period_start),
  constraint billing_invoice_approval_candidates_group_key_check check (btrim(client_group_key) <> ''),
  constraint billing_invoice_approval_candidates_client_name_check check (btrim(client_name) <> ''),
  constraint billing_invoice_approval_candidates_currency_check check (char_length(currency) = 3),
  constraint billing_invoice_approval_candidates_amounts_check check (
    subtotal_amount >= 0
    and tax_amount >= 0
    and total_amount >= 0
  ),
  constraint billing_invoice_approval_candidates_status_check check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  constraint billing_invoice_approval_candidates_cancelled_at_check check ((status = 'cancelled') = (cancelled_at is not null))
);

create table if not exists public.billing_invoice_approval_lines (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.billing_invoice_approval_candidates(id) on delete cascade,
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  line_index integer not null,
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
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  constraint billing_invoice_approval_lines_index_check check (line_index > 0),
  constraint billing_invoice_approval_lines_description_check check (btrim(description) <> ''),
  constraint billing_invoice_approval_lines_quantity_check check (quantity > 0),
  constraint billing_invoice_approval_lines_vat_rate_check check (vat_rate >= 0 and vat_rate <= 100),
  constraint billing_invoice_approval_lines_amounts_check check (
    subtotal_amount >= 0
    and tax_amount >= 0
    and total_amount >= 0
  ),
  constraint billing_invoice_approval_lines_currency_check check (char_length(currency) = 3)
);

create unique index if not exists idx_billing_invoice_approval_batches_period
  on public.billing_invoice_approval_batches (period_start);

create index if not exists idx_billing_invoice_approval_batches_status
  on public.billing_invoice_approval_batches (status, period_start desc);

create unique index if not exists idx_billing_invoice_approval_candidates_period_client
  on public.billing_invoice_approval_candidates (period_start, client_group_key);

create index if not exists idx_billing_invoice_approval_candidates_batch
  on public.billing_invoice_approval_candidates (batch_id, status, client_name);

create index if not exists idx_billing_invoice_approval_candidates_status
  on public.billing_invoice_approval_candidates (status, period_start desc);

create unique index if not exists idx_billing_invoice_approval_lines_candidate_index
  on public.billing_invoice_approval_lines (candidate_id, line_index);

create unique index if not exists idx_billing_invoice_approval_lines_candidate_subscription
  on public.billing_invoice_approval_lines (candidate_id, subscription_id)
  where subscription_id is not null;

create index if not exists idx_billing_invoice_approval_lines_candidate
  on public.billing_invoice_approval_lines (candidate_id, line_index);

create unique index if not exists idx_billing_documents_approval_candidate_unique
  on public.billing_documents ((source_raw ->> 'approval_candidate_id'))
  where document_type = 'invoice'
    and source_raw ? 'approval_candidate_id';

drop trigger if exists trg_billing_invoice_approval_batches_updated_at on public.billing_invoice_approval_batches;
create trigger trg_billing_invoice_approval_batches_updated_at
before update on public.billing_invoice_approval_batches
for each row execute function public.set_updated_at();

drop trigger if exists trg_billing_invoice_approval_candidates_updated_at on public.billing_invoice_approval_candidates;
create trigger trg_billing_invoice_approval_candidates_updated_at
before update on public.billing_invoice_approval_candidates
for each row execute function public.set_updated_at();

create or replace function public.approve_billing_invoice_candidate(
  p_candidate_id uuid,
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate public.billing_invoice_approval_candidates%rowtype;
  v_existing_invoice_id uuid;
  v_invoice_id uuid;
  v_line_count integer;
  v_issue_year integer;
  v_number_value integer;
  v_document_number text;
begin
  if p_candidate_id is null then
    raise exception 'Candidate is required';
  end if;

  select *
  into v_candidate
  from public.billing_invoice_approval_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'Approval candidate not found';
  end if;

  if v_candidate.status = 'cancelled' then
    raise exception 'Approval candidate is cancelled';
  end if;

  if v_candidate.invoice_id is not null then
    update public.billing_invoice_approval_candidates
    set status = 'processing',
        last_error = null,
        updated_by = p_actor_user_id
    where id = p_candidate_id;

    return v_candidate.invoice_id;
  end if;

  select id
  into v_existing_invoice_id
  from public.billing_documents
  where document_type = 'invoice'
    and source_raw ->> 'approval_candidate_id' = p_candidate_id::text
  limit 1;

  if found then
    update public.billing_invoice_approval_candidates
    set status = 'processing',
        invoice_id = v_existing_invoice_id,
        last_error = null,
        updated_by = p_actor_user_id
    where id = p_candidate_id;

    return v_existing_invoice_id;
  end if;

  if v_candidate.status not in ('pending', 'failed') then
    raise exception 'Approval candidate cannot be approved from status %', v_candidate.status;
  end if;

  if nullif(btrim(coalesce(v_candidate.billing_email, '')), '') is null then
    raise exception 'Approval candidate has no billing email';
  end if;

  select count(*)
  into v_line_count
  from public.billing_invoice_approval_lines
  where candidate_id = p_candidate_id;

  if v_line_count < 1 then
    raise exception 'Approval candidate has no billable lines';
  end if;

  v_issue_year := extract(year from v_candidate.period_start)::integer;

  loop
    update public.billing_number_sequences
    set last_value = last_value + 1
    where document_type = 'invoice'
      and series = 'F'
      and number_year = v_issue_year
    returning last_value into v_number_value;

    if found then
      exit;
    end if;

    begin
      insert into public.billing_number_sequences (document_type, series, number_year, last_value)
      values ('invoice', 'F', v_issue_year, 1)
      returning last_value into v_number_value;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  v_document_number := format('F-%s/%s', v_issue_year, v_number_value);

  insert into public.billing_documents (
    document_type,
    status,
    payment_status,
    series,
    number_year,
    number_value,
    document_number,
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
    source_raw,
    created_by,
    updated_by
  )
  values (
    'invoice',
    'issued',
    'unpaid',
    'F',
    v_issue_year,
    v_number_value,
    v_document_number,
    v_candidate.client_id,
    v_candidate.client_name,
    v_candidate.client_tax_id,
    v_candidate.billing_email,
    format('Facturacion mensual %s', to_char(v_candidate.period_start, 'YYYY-MM')),
    v_candidate.period_start,
    null,
    null,
    null,
    v_candidate.subtotal_amount,
    v_candidate.tax_amount,
    v_candidate.total_amount,
    v_candidate.currency,
    format('Factura mensual del periodo %s.', to_char(v_candidate.period_start, 'MM/YYYY')),
    jsonb_build_object(
      'approval_candidate_id', p_candidate_id,
      'approval_batch_id', v_candidate.batch_id,
      'period_start', v_candidate.period_start,
      'period_end', v_candidate.period_end
    ),
    p_actor_user_id,
    p_actor_user_id
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
    source_raw
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
    jsonb_build_object(
      'approval_line_id', id,
      'subscription_id', subscription_id
    )
  from public.billing_invoice_approval_lines
  where candidate_id = p_candidate_id
  order by line_index;

  update public.billing_invoice_approval_candidates
  set status = 'processing',
      invoice_id = v_invoice_id,
      approved_by = coalesce(approved_by, p_actor_user_id),
      approved_at = coalesce(approved_at, now()),
      last_error = null,
      updated_by = p_actor_user_id
  where id = p_candidate_id;

  return v_invoice_id;
end;
$$;

alter table public.billing_invoice_approval_batches enable row level security;
alter table public.billing_invoice_approval_batches force row level security;
alter table public.billing_invoice_approval_candidates enable row level security;
alter table public.billing_invoice_approval_candidates force row level security;
alter table public.billing_invoice_approval_lines enable row level security;
alter table public.billing_invoice_approval_lines force row level security;

revoke all on public.billing_invoice_approval_batches from anon, authenticated;
revoke all on public.billing_invoice_approval_candidates from anon, authenticated;
revoke all on public.billing_invoice_approval_lines from anon, authenticated;
revoke all on function public.approve_billing_invoice_candidate(uuid, uuid) from public, anon, authenticated;

grant select, insert, update, delete on public.billing_invoice_approval_batches to authenticated;
grant select, insert, update, delete on public.billing_invoice_approval_candidates to authenticated;
grant select, insert, update, delete on public.billing_invoice_approval_lines to authenticated;
grant execute on function public.approve_billing_invoice_candidate(uuid, uuid) to service_role;

drop policy if exists billing_invoice_approval_batches_authenticated_select on public.billing_invoice_approval_batches;
create policy billing_invoice_approval_batches_authenticated_select
on public.billing_invoice_approval_batches
for select
to authenticated
using (public.is_app_user());

drop policy if exists billing_invoice_approval_batches_authenticated_insert on public.billing_invoice_approval_batches;
create policy billing_invoice_approval_batches_authenticated_insert
on public.billing_invoice_approval_batches
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists billing_invoice_approval_batches_authenticated_update on public.billing_invoice_approval_batches;
create policy billing_invoice_approval_batches_authenticated_update
on public.billing_invoice_approval_batches
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists billing_invoice_approval_batches_authenticated_delete on public.billing_invoice_approval_batches;
create policy billing_invoice_approval_batches_authenticated_delete
on public.billing_invoice_approval_batches
for delete
to authenticated
using (public.is_app_user());

drop policy if exists billing_invoice_approval_candidates_authenticated_select on public.billing_invoice_approval_candidates;
create policy billing_invoice_approval_candidates_authenticated_select
on public.billing_invoice_approval_candidates
for select
to authenticated
using (public.is_app_user());

drop policy if exists billing_invoice_approval_candidates_authenticated_insert on public.billing_invoice_approval_candidates;
create policy billing_invoice_approval_candidates_authenticated_insert
on public.billing_invoice_approval_candidates
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists billing_invoice_approval_candidates_authenticated_update on public.billing_invoice_approval_candidates;
create policy billing_invoice_approval_candidates_authenticated_update
on public.billing_invoice_approval_candidates
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists billing_invoice_approval_candidates_authenticated_delete on public.billing_invoice_approval_candidates;
create policy billing_invoice_approval_candidates_authenticated_delete
on public.billing_invoice_approval_candidates
for delete
to authenticated
using (public.is_app_user());

drop policy if exists billing_invoice_approval_lines_authenticated_select on public.billing_invoice_approval_lines;
create policy billing_invoice_approval_lines_authenticated_select
on public.billing_invoice_approval_lines
for select
to authenticated
using (public.is_app_user());

drop policy if exists billing_invoice_approval_lines_authenticated_insert on public.billing_invoice_approval_lines;
create policy billing_invoice_approval_lines_authenticated_insert
on public.billing_invoice_approval_lines
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists billing_invoice_approval_lines_authenticated_update on public.billing_invoice_approval_lines;
create policy billing_invoice_approval_lines_authenticated_update
on public.billing_invoice_approval_lines
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists billing_invoice_approval_lines_authenticated_delete on public.billing_invoice_approval_lines;
create policy billing_invoice_approval_lines_authenticated_delete
on public.billing_invoice_approval_lines
for delete
to authenticated
using (public.is_app_user());

commit;

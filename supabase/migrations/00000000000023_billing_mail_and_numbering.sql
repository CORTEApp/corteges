begin;

create or replace function public.create_billing_proforma(
  p_client_id uuid,
  p_issue_date date default current_date,
  p_due_date date default null,
  p_project text default null,
  p_observations text default null,
  p_lines jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client public.clients%rowtype;
  v_issue_date date := coalesce(p_issue_date, current_date);
  v_issue_year integer := extract(year from coalesce(p_issue_date, current_date))::integer;
  v_line_count integer;
  v_invalid_line_count integer;
  v_matched_line_count integer;
  v_number record;
  v_document_id uuid;
  v_subtotal numeric(14, 2);
  v_tax numeric(14, 2);
  v_total numeric(14, 2);
  v_user_id uuid := auth.uid();
begin
  if not public.is_app_user() then
    raise exception 'Not authorized';
  end if;

  if p_client_id is null then
    raise exception 'Client is required';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Billing lines must be a JSON array';
  end if;

  select count(*)
  into v_line_count
  from jsonb_array_elements(p_lines);

  if v_line_count < 1 then
    raise exception 'At least one billing line is required';
  end if;

  if v_line_count > 20 then
    raise exception 'A proforma cannot contain more than 20 lines';
  end if;

  select *
  into v_client
  from public.clients
  where id = p_client_id;

  if not found then
    raise exception 'Client not found';
  end if;

  with raw_lines as (
    select
      ordinality::integer as line_index,
      (line_value ->> 'facturable_id')::uuid as facturable_id,
      coalesce(nullif(line_value ->> 'quantity', '')::numeric, 0) as quantity,
      coalesce(nullif(line_value ->> 'vat_rate', '')::numeric, 21) as vat_rate
    from jsonb_array_elements(p_lines) with ordinality as line(line_value, ordinality)
  )
  select count(*)
  into v_invalid_line_count
  from raw_lines
  where facturable_id is null
    or quantity <= 0
    or vat_rate < 0
    or vat_rate > 100;

  if v_invalid_line_count > 0 then
    raise exception 'Invalid billing line payload';
  end if;

  with raw_lines as (
    select
      ordinality::integer as line_index,
      (line_value ->> 'facturable_id')::uuid as facturable_id
    from jsonb_array_elements(p_lines) with ordinality as line(line_value, ordinality)
  )
  select count(*)
  into v_matched_line_count
  from raw_lines l
  join public.billing_facturables f on f.id = l.facturable_id;

  if v_matched_line_count <> v_line_count then
    raise exception 'One or more billing lines reference unavailable facturables';
  end if;

  with raw_lines as (
    select
      ordinality::integer as line_index,
      (line_value ->> 'facturable_id')::uuid as facturable_id,
      coalesce(nullif(line_value ->> 'quantity', '')::numeric, 0) as quantity,
      coalesce(nullif(line_value ->> 'vat_rate', '')::numeric, 21) as vat_rate
    from jsonb_array_elements(p_lines) with ordinality as line(line_value, ordinality)
  ),
  calculated_lines as (
    select
      round(f.unit_price * l.quantity, 2) as subtotal_amount,
      round(round(f.unit_price * l.quantity, 2) * (l.vat_rate / 100), 2) as tax_amount
    from raw_lines l
    join public.billing_facturables f on f.id = l.facturable_id
  )
  select
    coalesce(sum(subtotal_amount), 0),
    coalesce(sum(tax_amount), 0),
    coalesce(sum(subtotal_amount + tax_amount), 0)
  into v_subtotal, v_tax, v_total
  from calculated_lines;

  select *
  into v_number
  from public.next_billing_document_number('proforma', 'P', v_issue_year);

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
    subtotal_amount,
    tax_amount,
    total_amount,
    currency,
    observations,
    created_by,
    updated_by
  )
  values (
    'proforma',
    'issued',
    'unpaid',
    'P',
    v_issue_year,
    v_number.number_value,
    v_number.document_number,
    v_client.id,
    v_client.name,
    v_client.tax_id,
    v_client.billing_email,
    nullif(btrim(coalesce(p_project, '')), ''),
    v_issue_date,
    p_due_date,
    v_subtotal,
    v_tax,
    v_total,
    'EUR',
    nullif(btrim(coalesce(p_observations, '')), ''),
    v_user_id,
    v_user_id
  )
  returning id into v_document_id;

  with raw_lines as (
    select
      ordinality::integer as line_index,
      (line_value ->> 'facturable_id')::uuid as facturable_id,
      coalesce(nullif(line_value ->> 'quantity', '')::numeric, 0) as quantity,
      coalesce(nullif(line_value ->> 'vat_rate', '')::numeric, 21) as vat_rate
    from jsonb_array_elements(p_lines) with ordinality as line(line_value, ordinality)
  ),
  calculated_lines as (
    select
      l.line_index,
      f.id as facturable_id,
      f.code,
      f.description,
      l.quantity,
      f.unit_price,
      l.vat_rate,
      f.unit_type,
      round(f.unit_price * l.quantity, 2) as subtotal_amount,
      round(round(f.unit_price * l.quantity, 2) * (l.vat_rate / 100), 2) as tax_amount
    from raw_lines l
    join public.billing_facturables f on f.id = l.facturable_id
  )
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
    total_amount
  )
  select
    v_document_id,
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
    subtotal_amount + tax_amount
  from calculated_lines
  order by line_index;

  return v_document_id;
end;
$$;

grant execute on function public.create_billing_proforma(uuid, date, date, text, text, jsonb) to authenticated;

create table if not exists public.mail_outboxes (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'microsoft_graph',
  email_address text not null,
  display_name text,
  mode text not null default 'user_mailbox',
  connection_user_id uuid not null references auth.users(id) on delete restrict,
  active boolean not null default true,
  is_default_for_billing boolean not null default false,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mail_outboxes_provider_check check (provider in ('microsoft_graph')),
  constraint mail_outboxes_mode_check check (mode in ('user_mailbox', 'shared_mailbox')),
  constraint mail_outboxes_email_not_blank check (btrim(email_address) <> '')
);

create table if not exists public.mail_dispatch_jobs (
  id uuid primary key default gen_random_uuid(),
  billing_document_id uuid not null references public.billing_documents(id) on delete cascade,
  outbox_id uuid not null references public.mail_outboxes(id) on delete restrict,
  idempotency_key text not null,
  recipient_to text[] not null default '{}',
  recipient_cc text[] not null default '{}',
  recipient_bcc text[] not null default '{}',
  subject text not null,
  body_html text not null,
  attachment_file_ids uuid[] not null default '{}',
  status text not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mail_dispatch_jobs_idempotency_not_blank check (btrim(idempotency_key) <> ''),
  constraint mail_dispatch_jobs_to_required check (array_length(recipient_to, 1) is not null),
  constraint mail_dispatch_jobs_subject_not_blank check (btrim(subject) <> ''),
  constraint mail_dispatch_jobs_body_not_blank check (btrim(body_html) <> ''),
  constraint mail_dispatch_jobs_status_check check (status in ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  constraint mail_dispatch_jobs_attempts_check check (attempts >= 0),
  constraint mail_dispatch_jobs_sent_at_check check ((status = 'sent') = (sent_at is not null)),
  constraint mail_dispatch_jobs_cancelled_at_check check ((status = 'cancelled') = (cancelled_at is not null))
);

create unique index if not exists idx_mail_outboxes_provider_email
  on public.mail_outboxes (provider, lower(btrim(email_address)));

create unique index if not exists idx_mail_outboxes_default_billing
  on public.mail_outboxes (provider)
  where active and is_default_for_billing;

create index if not exists idx_mail_outboxes_connection
  on public.mail_outboxes (connection_user_id);

create unique index if not exists idx_mail_dispatch_jobs_idempotency
  on public.mail_dispatch_jobs (idempotency_key);

create index if not exists idx_mail_dispatch_jobs_status
  on public.mail_dispatch_jobs (status, created_at);

create index if not exists idx_mail_dispatch_jobs_document
  on public.mail_dispatch_jobs (billing_document_id, created_at desc);

drop trigger if exists trg_mail_outboxes_updated_at on public.mail_outboxes;
create trigger trg_mail_outboxes_updated_at
before update on public.mail_outboxes
for each row execute function public.set_updated_at();

drop trigger if exists trg_mail_dispatch_jobs_updated_at on public.mail_dispatch_jobs;
create trigger trg_mail_dispatch_jobs_updated_at
before update on public.mail_dispatch_jobs
for each row execute function public.set_updated_at();

create or replace function public.assert_mail_dispatch_job_outbox_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.mail_outboxes o
    where o.id = new.outbox_id
      and o.active
  ) then
    raise exception 'Cannot enqueue mail using an inactive outbox';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mail_dispatch_jobs_active_outbox on public.mail_dispatch_jobs;
create trigger trg_mail_dispatch_jobs_active_outbox
before insert or update of outbox_id on public.mail_dispatch_jobs
for each row execute function public.assert_mail_dispatch_job_outbox_active();

alter table public.mail_outboxes enable row level security;
alter table public.mail_outboxes force row level security;
alter table public.mail_dispatch_jobs enable row level security;
alter table public.mail_dispatch_jobs force row level security;

revoke all on public.mail_outboxes from anon, authenticated;
revoke all on public.mail_dispatch_jobs from anon, authenticated;

grant select, insert, update, delete on public.mail_outboxes to authenticated;
grant select, insert, update, delete on public.mail_dispatch_jobs to authenticated;
grant execute on function public.assert_mail_dispatch_job_outbox_active() to authenticated;

drop policy if exists mail_outboxes_authenticated_select on public.mail_outboxes;
create policy mail_outboxes_authenticated_select
on public.mail_outboxes
for select
to authenticated
using (public.is_app_user());

drop policy if exists mail_outboxes_authenticated_insert on public.mail_outboxes;
create policy mail_outboxes_authenticated_insert
on public.mail_outboxes
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists mail_outboxes_authenticated_update on public.mail_outboxes;
create policy mail_outboxes_authenticated_update
on public.mail_outboxes
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists mail_outboxes_authenticated_delete on public.mail_outboxes;
create policy mail_outboxes_authenticated_delete
on public.mail_outboxes
for delete
to authenticated
using (public.is_app_user());

drop policy if exists mail_dispatch_jobs_authenticated_select on public.mail_dispatch_jobs;
create policy mail_dispatch_jobs_authenticated_select
on public.mail_dispatch_jobs
for select
to authenticated
using (public.is_app_user());

drop policy if exists mail_dispatch_jobs_authenticated_insert on public.mail_dispatch_jobs;
create policy mail_dispatch_jobs_authenticated_insert
on public.mail_dispatch_jobs
for insert
to authenticated
with check (
  public.is_app_user()
  and exists (
    select 1
    from public.mail_outboxes o
    where o.id = outbox_id
      and o.active
  )
);

drop policy if exists mail_dispatch_jobs_authenticated_update on public.mail_dispatch_jobs;
create policy mail_dispatch_jobs_authenticated_update
on public.mail_dispatch_jobs
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists mail_dispatch_jobs_authenticated_delete on public.mail_dispatch_jobs;
create policy mail_dispatch_jobs_authenticated_delete
on public.mail_dispatch_jobs
for delete
to authenticated
using (public.is_app_user());

update public.microsoft_user_connections
set status = 'reconnect_required',
    last_error = 'Reconnect Microsoft to grant Mail.Send and Mail.Send.Shared for billing email dispatch.',
    updated_at = now()
where not coalesce(scopes, '{}'::text[]) @> array['Mail.Send', 'Mail.Send.Shared']::text[];

commit;

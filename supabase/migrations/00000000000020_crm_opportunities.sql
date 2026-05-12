begin;

create table if not exists public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id text,
  company_name text not null,
  contact_name text,
  contact_phone text,
  contact_email text,
  submitted_at timestamptz,
  first_contact_at timestamptz,
  first_contact_method text,
  temperature numeric(5, 2) check (temperature is null or (temperature >= 0 and temperature <= 10)),
  status text not null default 'new' check (
    status in (
      'new',
      'contacted',
      'qualified',
      'diagnosis_booked',
      'diagnosis_attended',
      'proposal_sent',
      'closed_won',
      'closed_lost',
      'disqualified'
    )
  ),
  legacy_status text,
  request text,
  comments text,
  url text,
  continue_label text,
  platform text,
  schedule text,
  company_size text,
  province text,
  budget text,
  has_crm text,
  gamma text,
  chat_database text,
  chat_screens text,
  chat_automations text,
  gamma_url text,
  initial_price numeric(14, 2),
  campaign text,
  ad text,
  owner text,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  cta_id text,
  narrative jsonb not null default '[]'::jsonb,
  landing_slug text,
  main_problem text,
  urgency text,
  decision_role text,
  qualification_status text,
  qualified_at timestamptz,
  disqualified_at timestamptz,
  disqualification_reason text,
  diagnosis_booked_at timestamptz,
  diagnosis_attended_at timestamptz,
  proposal_sent_at timestamptz,
  closed_at timestamptz,
  closed_outcome text check (closed_outcome is null or closed_outcome in ('won', 'lost')),
  closed_lost_reason text,
  closed_lost_note text,
  closed_lost_stage text,
  next_contact_at timestamptz,
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
  constraint crm_opportunities_company_name_not_blank check (btrim(company_name) <> ''),
  constraint crm_opportunities_sharepoint_source_unique
    unique (sharepoint_site_id, sharepoint_list_id, sharepoint_item_id)
);

drop index if exists public.idx_crm_opportunities_lead_id_unique;

create index if not exists idx_crm_opportunities_lead_id
  on public.crm_opportunities (lead_id)
  where lead_id is not null and btrim(lead_id) <> '';

create index if not exists idx_crm_opportunities_status
  on public.crm_opportunities (status, updated_at desc);

create index if not exists idx_crm_opportunities_owner
  on public.crm_opportunities (owner)
  where owner is not null;

create index if not exists idx_crm_opportunities_next_contact
  on public.crm_opportunities (next_contact_at)
  where next_contact_at is not null;

create index if not exists idx_crm_opportunities_sharepoint_source
  on public.crm_opportunities (sharepoint_list_id, sharepoint_item_id);

create table if not exists public.crm_opportunity_activities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  activity_type text not null default 'other' check (
    activity_type in ('whatsapp', 'telegram', 'linkedin', 'email', 'call', 'meeting_in_person', 'meeting_online', 'other')
  ),
  contact_at timestamptz not null default now(),
  next_contact_at timestamptz,
  temperature numeric(5, 2) check (temperature is null or (temperature >= 0 and temperature <= 10)),
  notes text,
  contact_person text,
  contact_role text,
  contact_value text,
  owner text,
  diagnosis_booked_at timestamptz,
  diagnosis_attended_at timestamptz,
  closed_outcome text,
  closed_lost_reason text,
  closed_lost_note text,
  closed_lost_stage text,
  source_kind text not null default 'manual' check (source_kind in ('manual', 'sharepoint')),
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
  constraint crm_opportunity_activities_sharepoint_source_unique
    unique (sharepoint_site_id, sharepoint_list_id, sharepoint_item_id)
);

create index if not exists idx_crm_opportunity_activities_opportunity
  on public.crm_opportunity_activities (opportunity_id, contact_at desc);

create index if not exists idx_crm_opportunity_activities_next_contact
  on public.crm_opportunity_activities (next_contact_at)
  where next_contact_at is not null;

create index if not exists idx_crm_opportunity_activities_sharepoint_source
  on public.crm_opportunity_activities (sharepoint_list_id, sharepoint_item_id);

drop trigger if exists set_crm_opportunities_updated_at on public.crm_opportunities;
create trigger set_crm_opportunities_updated_at
before update on public.crm_opportunities
for each row execute function public.set_updated_at();

drop trigger if exists set_crm_opportunity_activities_updated_at on public.crm_opportunity_activities;
create trigger set_crm_opportunity_activities_updated_at
before update on public.crm_opportunity_activities
for each row execute function public.set_updated_at();

alter table public.crm_opportunities enable row level security;
alter table public.crm_opportunities force row level security;
alter table public.crm_opportunity_activities enable row level security;
alter table public.crm_opportunity_activities force row level security;

revoke all on public.crm_opportunities from anon, authenticated;
revoke all on public.crm_opportunity_activities from anon, authenticated;

grant select, insert, update on public.crm_opportunities to authenticated;
grant select, insert, update on public.crm_opportunity_activities to authenticated;

drop policy if exists crm_opportunities_authenticated_select on public.crm_opportunities;
create policy crm_opportunities_authenticated_select
on public.crm_opportunities
for select
to authenticated
using (public.is_app_user());

drop policy if exists crm_opportunities_authenticated_insert on public.crm_opportunities;
create policy crm_opportunities_authenticated_insert
on public.crm_opportunities
for insert
to authenticated
with check (public.is_app_user());

drop policy if exists crm_opportunities_authenticated_update on public.crm_opportunities;
create policy crm_opportunities_authenticated_update
on public.crm_opportunities
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

drop policy if exists crm_opportunity_activities_authenticated_select on public.crm_opportunity_activities;
create policy crm_opportunity_activities_authenticated_select
on public.crm_opportunity_activities
for select
to authenticated
using (public.is_app_user());

drop policy if exists crm_opportunity_activities_authenticated_insert on public.crm_opportunity_activities;
create policy crm_opportunity_activities_authenticated_insert
on public.crm_opportunity_activities
for insert
to authenticated
with check (
  public.is_app_user()
  and exists (
    select 1
    from public.crm_opportunities o
    where o.id = opportunity_id
  )
);

drop policy if exists crm_opportunity_activities_authenticated_update on public.crm_opportunity_activities;
create policy crm_opportunity_activities_authenticated_update
on public.crm_opportunity_activities
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

commit;

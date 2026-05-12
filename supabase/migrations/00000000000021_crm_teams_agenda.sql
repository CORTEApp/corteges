begin;

create table if not exists public.microsoft_user_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  microsoft_user_id text,
  microsoft_email text,
  display_name text,
  tenant_id text,
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'reconnect_required')),
  refresh_token_encrypted text not null,
  last_error text,
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_opportunity_meetings (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  organizer_user_id uuid references auth.users(id) on delete set null,
  organizer_email text,
  subject text not null,
  meeting_kind text not null default 'general' check (meeting_kind in ('general', 'diagnosis', 'follow_up', 'proposal')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null default 'Romance Standard Time',
  attendees jsonb not null default '[]'::jsonb,
  notes text,
  graph_event_id text,
  graph_ical_uid text,
  teams_join_url text,
  web_link text,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  graph_raw jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_opportunity_meetings_subject_not_blank check (btrim(subject) <> ''),
  constraint crm_opportunity_meetings_valid_interval check (ends_at > starts_at)
);

create unique index if not exists idx_crm_opportunity_meetings_graph_event
  on public.crm_opportunity_meetings (organizer_user_id, graph_event_id)
  where graph_event_id is not null;

create index if not exists idx_crm_opportunity_meetings_opportunity
  on public.crm_opportunity_meetings (opportunity_id, starts_at desc);

create index if not exists idx_crm_opportunity_meetings_organizer
  on public.crm_opportunity_meetings (organizer_user_id, starts_at desc)
  where organizer_user_id is not null;

drop trigger if exists set_microsoft_user_connections_updated_at on public.microsoft_user_connections;
create trigger set_microsoft_user_connections_updated_at
before update on public.microsoft_user_connections
for each row execute function public.set_updated_at();

drop trigger if exists set_crm_opportunity_meetings_updated_at on public.crm_opportunity_meetings;
create trigger set_crm_opportunity_meetings_updated_at
before update on public.crm_opportunity_meetings
for each row execute function public.set_updated_at();

alter table public.microsoft_user_connections enable row level security;
alter table public.microsoft_user_connections force row level security;
alter table public.crm_opportunity_meetings enable row level security;
alter table public.crm_opportunity_meetings force row level security;

revoke all on public.microsoft_user_connections from anon, authenticated;
revoke all on public.crm_opportunity_meetings from anon, authenticated;

grant select, insert, update, delete on public.microsoft_user_connections to service_role;
grant select, insert, update on public.crm_opportunity_meetings to authenticated;

drop policy if exists crm_opportunity_meetings_authenticated_select on public.crm_opportunity_meetings;
create policy crm_opportunity_meetings_authenticated_select
on public.crm_opportunity_meetings
for select
to authenticated
using (public.is_app_user());

drop policy if exists crm_opportunity_meetings_authenticated_insert on public.crm_opportunity_meetings;
create policy crm_opportunity_meetings_authenticated_insert
on public.crm_opportunity_meetings
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

drop policy if exists crm_opportunity_meetings_authenticated_update on public.crm_opportunity_meetings;
create policy crm_opportunity_meetings_authenticated_update
on public.crm_opportunity_meetings
for update
to authenticated
using (public.is_app_user())
with check (public.is_app_user());

commit;

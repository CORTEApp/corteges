alter table public.client_history_entries
  add column if not exists source_kind text not null default 'sharepoint';

alter table public.client_history_entries
  drop constraint if exists client_history_entries_source_kind_check;

alter table public.client_history_entries
  add constraint client_history_entries_source_kind_check
  check (source_kind in ('sharepoint', 'manual'));

alter table public.client_history_entries
  add column if not exists source_key text;

alter table public.client_history_entries
  add column if not exists is_current boolean not null default false;

alter table public.client_history_entries
  add column if not exists created_by uuid references auth.users(id) on delete set null;

update public.client_history_entries
set source_kind = 'sharepoint'
where source_kind is null;

update public.client_history_entries
set source_key = concat_ws(':', 'sharepoint', sharepoint_site_id, sharepoint_list_id, sharepoint_item_id::text)
where source_key is null or source_key = '';

alter table public.client_history_entries
  alter column source_key set not null;

create unique index if not exists idx_client_history_entries_source_key
  on public.client_history_entries (source_kind, source_key);

alter table public.clients
  add column if not exists current_history_entry_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_current_history_entry_id_fkey'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_current_history_entry_id_fkey
      foreign key (current_history_entry_id)
      references public.client_history_entries(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_clients_current_history_entry_id
  on public.clients (current_history_entry_id);

with ranked_history as (
  select
    h.id,
    h.client_id,
    row_number() over (
      partition by h.client_id
      order by
        case
          when lower(regexp_replace(coalesce(h.current_line, ''), '[^a-zA-Z0-9]', '', 'g')) in
            ('si', 's', 'yes', 'y', 'true', '1', 'vigente', 'actual')
            then 0
          else 1
        end,
        h.source_modified_at desc nulls last,
        h.sharepoint_item_id desc
    ) as row_number
  from public.client_history_entries h
  where h.client_id is not null
)
update public.client_history_entries h
set is_current = ranked_history.row_number = 1
from ranked_history
where h.id = ranked_history.id;

update public.clients c
set current_history_entry_id = h.id
from public.client_history_entries h
where h.client_id = c.id
  and h.is_current = true
  and (c.current_history_entry_id is distinct from h.id);

create unique index if not exists idx_client_history_entries_one_current_per_client
  on public.client_history_entries (client_id)
  where is_current = true and client_id is not null;

create index if not exists idx_client_history_entries_current
  on public.client_history_entries (client_id, is_current, source_modified_at desc);

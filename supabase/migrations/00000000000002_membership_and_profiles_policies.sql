create or replace function public.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

alter table public.user_profiles enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.user_profiles from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

grant usage on schema public to authenticated;
grant select on public.user_profiles to authenticated;
grant update (display_name, avatar_url) on public.user_profiles to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_app_user() to authenticated;

drop policy if exists profiles_select_self on public.user_profiles;
create policy profiles_select_self
on public.user_profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_update_self_safe_fields on public.user_profiles;
create policy profiles_update_self_safe_fields
on public.user_profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists audit_logs_select_authenticated on public.audit_logs;
create policy audit_logs_select_authenticated
on public.audit_logs
for select
to authenticated
using (public.is_app_user());

drop policy if exists audit_logs_insert_authenticated on public.audit_logs;
create policy audit_logs_insert_authenticated
on public.audit_logs
for insert
to authenticated
with check (actor_user_id = auth.uid());

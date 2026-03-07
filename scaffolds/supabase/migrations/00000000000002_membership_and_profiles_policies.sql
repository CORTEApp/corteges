create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.is_platform_admin = true
  );
$$;

create or replace function public.is_member_of_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.user_id = auth.uid()
      and cm.company_id = target_company_id
  );
$$;

create or replace function public.has_company_role(target_company_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.user_id = auth.uid()
      and cm.company_id = target_company_id
      and cm.role = any(allowed_roles)
  );
$$;

create or replace function public.current_company_role(target_company_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cm.role
  from public.company_memberships cm
  where cm.user_id = auth.uid()
    and cm.company_id = target_company_id
  limit 1;
$$;

create or replace function public.can_manage_membership(
  target_company_id uuid,
  target_user_id uuid,
  target_role text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  if auth.uid() is null then
    return false;
  end if;

  if target_user_id = auth.uid() then
    return false;
  end if;

  select cm.role
  into actor_role
  from public.company_memberships cm
  where cm.user_id = auth.uid()
    and cm.company_id = target_company_id
  limit 1;

  if actor_role = 'owner' then
    return target_role in ('admin', 'member', 'viewer');
  end if;

  if actor_role = 'admin' then
    return target_role in ('member', 'viewer');
  end if;

  return false;
end;
$$;

create or replace function public.bootstrap_first_company(
  target_slug text,
  target_name text
)
returns table (
  company_id uuid,
  granted_platform_admin boolean,
  granted_owner_membership boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public.bootstrap_first_company', 0));

  if exists (select 1 from public.companies)
     or exists (select 1 from public.company_memberships)
     or exists (select 1 from public.user_profiles up where up.is_platform_admin = true) then
    raise exception 'Initial bootstrap has already been completed';
  end if;

  insert into public.user_profiles (id, email, display_name)
  select
    au.id,
    au.email,
    coalesce(
      au.raw_user_meta_data ->> 'full_name',
      au.raw_user_meta_data ->> 'name',
      split_part(coalesce(au.email, ''), '@', 1)
    )
  from auth.users au
  where au.id = auth.uid()
  on conflict (id) do nothing;

  insert into public.companies (slug, name)
  values (target_slug, target_name)
  returning id into new_company_id;

  update public.user_profiles
  set default_company_id = new_company_id,
      is_platform_admin = true
  where id = auth.uid();

  insert into public.company_memberships (company_id, user_id, role, created_by)
  values (new_company_id, auth.uid(), 'owner', auth.uid());

  insert into public.audit_logs (company_id, actor_user_id, entity_name, entity_id, action, payload)
  values (
    new_company_id,
    auth.uid(),
    'companies',
    new_company_id::text,
    'bootstrap_first_company',
    jsonb_build_object('role', 'owner', 'is_platform_admin', true, 'slug', target_slug, 'name', target_name)
  );

  return query
  select new_company_id, true, true;
end;
$$;

alter table public.companies enable row level security;
alter table public.user_profiles enable row level security;
alter table public.company_memberships enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.companies from anon, authenticated;
revoke all on public.user_profiles from anon, authenticated;
revoke all on public.company_memberships from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant select on public.user_profiles to authenticated;
grant update (display_name, avatar_url, default_company_id) on public.user_profiles to authenticated;
grant select, insert, update, delete on public.company_memberships to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.bootstrap_first_company(text, text) to authenticated;

drop policy if exists companies_select_member on public.companies;
create policy companies_select_member
on public.companies
for select
to authenticated
using (public.is_platform_admin() or public.is_member_of_company(id));

drop policy if exists companies_insert_platform_admin on public.companies;
create policy companies_insert_platform_admin
on public.companies
for insert
to authenticated
with check (public.is_platform_admin());

drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin
on public.companies
for update
to authenticated
using (public.is_platform_admin() or public.has_company_role(id, array['owner', 'admin']))
with check (public.is_platform_admin() or public.has_company_role(id, array['owner', 'admin']));

drop policy if exists companies_delete_owner on public.companies;
create policy companies_delete_owner
on public.companies
for delete
to authenticated
using (public.is_platform_admin() or public.has_company_role(id, array['owner']));

drop policy if exists profiles_select_self_or_admin on public.user_profiles;
create policy profiles_select_self_or_admin
on public.user_profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1
    from public.company_memberships me
    join public.company_memberships them
      on me.company_id = them.company_id
    where me.user_id = auth.uid()
      and them.user_id = user_profiles.id
      and me.role in ('owner', 'admin')
  )
);

drop policy if exists profiles_update_self_safe_fields on public.user_profiles;
create policy profiles_update_self_safe_fields
on public.user_profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profiles_update_platform_admin on public.user_profiles;
create policy profiles_update_platform_admin
on public.user_profiles
for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists memberships_select_self_or_admin on public.company_memberships;
create policy memberships_select_self_or_admin
on public.company_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin()
  or public.has_company_role(company_id, array['owner', 'admin'])
);

drop policy if exists memberships_insert_managed on public.company_memberships;
create policy memberships_insert_managed
on public.company_memberships
for insert
to authenticated
with check (
  public.is_platform_admin()
  or public.can_manage_membership(company_id, user_id, role)
);

drop policy if exists memberships_update_managed on public.company_memberships;
create policy memberships_update_managed
on public.company_memberships
for update
to authenticated
using (
  public.is_platform_admin()
  or public.can_manage_membership(company_id, user_id, role)
)
with check (
  public.is_platform_admin()
  or public.can_manage_membership(company_id, user_id, role)
);

drop policy if exists memberships_delete_managed on public.company_memberships;
create policy memberships_delete_managed
on public.company_memberships
for delete
to authenticated
using (
  public.is_platform_admin()
  or (
    user_id <> auth.uid()
    and public.has_company_role(company_id, array['owner', 'admin'])
    and current_company_role(company_id) = 'owner'
  )
);

drop policy if exists audit_logs_select_admins on public.audit_logs;
create policy audit_logs_select_admins
on public.audit_logs
for select
to authenticated
using (
  public.is_platform_admin()
  or public.has_company_role(company_id, array['owner', 'admin'])
);

drop policy if exists audit_logs_insert_members on public.audit_logs;
create policy audit_logs_insert_members
on public.audit_logs
for insert
to authenticated
with check (
  public.is_platform_admin()
  or public.is_member_of_company(company_id)
);

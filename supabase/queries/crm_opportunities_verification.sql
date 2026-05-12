do $$
begin
  if to_regclass('public.crm_opportunities') is null then
    raise exception 'Missing public.crm_opportunities';
  end if;

  if to_regclass('public.crm_opportunity_activities') is null then
    raise exception 'Missing public.crm_opportunity_activities';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name in ('crm_opportunities', 'crm_opportunity_activities')
  ) then
    raise exception 'Anon grants detected on CRM tables';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'management'
      and table_schema = 'public'
      and table_name in ('crm_opportunities', 'crm_opportunity_activities')
  ) then
    raise exception 'Unexpected management grants detected on CRM tables';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('crm_opportunities', 'crm_opportunity_activities')
      and column_name = 'company_id'
  ) then
    raise exception 'Unexpected company_id column in CRM tables';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name = 'crm_opportunities'
      and privilege_type = 'DELETE'
  ) then
    raise exception 'Authenticated DELETE grant detected on crm_opportunities';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('crm_opportunities', 'crm_opportunity_activities')
      and c.relrowsecurity = false
  ) then
    raise exception 'RLS disabled on CRM tables';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'crm_opportunities'
      and indexname = 'idx_crm_opportunities_lead_id'
  ) then
    raise exception 'Missing lead_id index';
  end if;
end $$;

select
  (select count(*) from public.crm_opportunities) as opportunities,
  (select count(*) from public.crm_opportunity_activities) as activities,
  (select count(*) from public.crm_opportunities where status = 'new') as new_count,
  (select count(*) from public.crm_opportunities where status in ('closed_won', 'closed_lost', 'disqualified')) as closed_count,
  (select count(*) from public.crm_opportunity_activities a where not exists (
    select 1 from public.crm_opportunities o where o.id = a.opportunity_id
  )) as orphan_activities;

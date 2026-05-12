with table_checks as (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('microsoft_user_connections', 'crm_opportunity_meetings')
),
anon_grants as (
  select grantee, table_name, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('microsoft_user_connections', 'crm_opportunity_meetings')
    and grantee = 'anon'
),
authenticated_token_grants as (
  select grantee, table_name, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'microsoft_user_connections'
    and grantee = 'authenticated'
),
service_token_grants as (
  select privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'microsoft_user_connections'
    and grantee = 'service_role'
),
meeting_grants as (
  select array_agg(privilege_type order by privilege_type) as privileges
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'crm_opportunity_meetings'
    and grantee = 'authenticated'
),
meeting_fk as (
  select count(*) as fk_count
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name
   and kcu.constraint_schema = tc.constraint_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
   and ccu.constraint_schema = tc.constraint_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'crm_opportunity_meetings'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'opportunity_id'
    and ccu.table_name = 'crm_opportunities'
    and ccu.column_name = 'id'
),
forbidden_columns as (
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('microsoft_user_connections', 'crm_opportunity_meetings')
    and column_name = 'company_id'
),
forbidden_roles as (
  select grantee, table_name, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('microsoft_user_connections', 'crm_opportunity_meetings')
    and grantee = 'management'
),
policies as (
  select tablename, policyname, roles, cmd
  from pg_policies
  where schemaname = 'public'
    and tablename in ('microsoft_user_connections', 'crm_opportunity_meetings')
)
select 'rls' as check_name, jsonb_agg(to_jsonb(table_checks) order by table_name) as result
from table_checks
union all
select 'anon_grants_absent', coalesce(jsonb_agg(to_jsonb(anon_grants)), '[]'::jsonb)
from anon_grants
union all
select 'authenticated_token_grants_absent', coalesce(jsonb_agg(to_jsonb(authenticated_token_grants)), '[]'::jsonb)
from authenticated_token_grants
union all
select 'service_role_token_grants_present', to_jsonb(array(select privilege_type from service_token_grants order by privilege_type))
union all
select 'meeting_authenticated_grants', to_jsonb(privileges)
from meeting_grants
union all
select 'meeting_fk_to_opportunities', to_jsonb(fk_count)
from meeting_fk
union all
select 'company_id_absent', coalesce(jsonb_agg(to_jsonb(forbidden_columns)), '[]'::jsonb)
from forbidden_columns
union all
select 'management_grants_absent', coalesce(jsonb_agg(to_jsonb(forbidden_roles)), '[]'::jsonb)
from forbidden_roles
union all
select 'policies', coalesce(jsonb_agg(to_jsonb(policies) order by tablename, policyname), '[]'::jsonb)
from policies;

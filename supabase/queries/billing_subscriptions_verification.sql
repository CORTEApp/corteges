-- Fail-fast checks for the billing subscriptions module.

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'billing_subscriptions'
      and rowsecurity is distinct from true
  ) then
    raise exception 'Missing RLS on billing_subscriptions';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'billing_subscriptions'
      and column_name in ('tenant_id', 'company_id')
  ) then
    raise exception 'Billing subscriptions should not depend on tenant/company isolation';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_class table_class
    join pg_index idx on idx.indrelid = table_class.oid
    join pg_class index_class on index_class.oid = idx.indexrelid
    join pg_namespace ns on ns.oid = table_class.relnamespace
    where ns.nspname = 'public'
      and table_class.relname = 'billing_subscriptions'
      and index_class.relname = 'idx_billing_subscriptions_sharepoint_unique'
      and idx.indisunique
      and idx.indpred is null
  ) then
    raise exception 'Missing non-partial SharePoint uniqueness guard for billing_subscriptions';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = 'billing_subscriptions'
      and grantee = 'anon'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'anon has direct access to billing_subscriptions';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = 'billing_subscriptions'
      and grantee = 'authenticated'
      and privilege_type = 'DELETE'
  ) then
    raise exception 'billing_subscriptions should not grant physical delete';
  end if;
end $$;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'billing_subscriptions';

select schemaname, tablename, policyname, cmd, roles::text as roles
from pg_policies
where schemaname = 'public'
  and tablename = 'billing_subscriptions'
order by policyname;

do $$
begin
  if to_regclass('public.fiscal_tax_settings') is null then
    raise exception 'Missing fiscal_tax_settings table';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'fiscal_tax_settings'
      and c.relrowsecurity
      and c.relforcerowsecurity
  ) then
    raise exception 'fiscal_tax_settings must have forced RLS';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'fiscal_tax_settings'
      and column_name in ('tenant_id', 'company_id', 'management_id')
  ) then
    raise exception 'fiscal_tax_settings must not introduce tenant/company columns';
  end if;

  if not has_table_privilege('authenticated', 'public.fiscal_tax_settings', 'select') then
    raise exception 'authenticated role cannot select fiscal_tax_settings';
  end if;

  if not has_table_privilege('authenticated', 'public.fiscal_tax_settings', 'insert') then
    raise exception 'authenticated role cannot insert fiscal_tax_settings';
  end if;

  if not has_table_privilege('authenticated', 'public.fiscal_tax_settings', 'update') then
    raise exception 'authenticated role cannot update fiscal_tax_settings';
  end if;

  if not exists (
    select 1
    from public.fiscal_tax_settings
    where tax_year = 2026
      and jsonb_typeof(irpf_brackets) = 'array'
      and jsonb_array_length(irpf_brackets) >= 1
  ) then
    raise exception 'Missing fiscal_tax_settings seed for 2026';
  end if;
end
$$;

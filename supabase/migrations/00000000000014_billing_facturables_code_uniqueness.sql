create unique index if not exists idx_billing_facturables_code_normalized_unique
  on public.billing_facturables (upper(btrim(code)));

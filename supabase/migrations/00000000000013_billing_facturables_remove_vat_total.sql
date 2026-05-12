alter table if exists public.billing_facturables
  drop column if exists total_amount,
  drop column if exists vat_rate;

begin;

alter table public.suppliers
  add column if not exists auto_approve_expense_invoices boolean;

update public.suppliers
set auto_approve_expense_invoices = false
where auto_approve_expense_invoices is null;

alter table public.suppliers
  alter column auto_approve_expense_invoices set default false,
  alter column auto_approve_expense_invoices set not null;

comment on column public.suppliers.auto_approve_expense_invoices is
  'When true, eligible expense invoice intake items for this supplier are approved automatically after extraction.';

commit;

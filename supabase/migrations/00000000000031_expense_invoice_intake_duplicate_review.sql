begin;

drop index if exists public.idx_expense_invoice_intake_items_supplier_invoice_open;

create unique index if not exists idx_expense_invoice_intake_items_supplier_invoice_open
  on public.expense_invoice_intake_items (supplier_id, upper(btrim(invoice_number)))
  where supplier_id is not null
    and invoice_number is not null
    and btrim(invoice_number) <> ''
    and status in ('extraida', 'aprobada');

commit;

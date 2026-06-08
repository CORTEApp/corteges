begin;

with line_summaries as (
  select
    document_id,
    round(sum(subtotal_amount), 2) as subtotal_amount,
    round(sum(tax_amount), 2) as tax_amount,
    round(sum(total_amount), 2) as total_amount
  from public.billing_document_lines
  group by document_id
)
update public.billing_documents documents
set
  subtotal_amount = line_summaries.subtotal_amount,
  tax_amount = line_summaries.tax_amount,
  total_amount = line_summaries.total_amount,
  updated_at = now()
from line_summaries
where documents.id = line_summaries.document_id
  and (
    documents.subtotal_amount is distinct from line_summaries.subtotal_amount
    or documents.tax_amount is distinct from line_summaries.tax_amount
    or documents.total_amount is distinct from line_summaries.total_amount
  );

commit;

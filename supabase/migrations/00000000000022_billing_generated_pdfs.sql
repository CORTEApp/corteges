begin;

alter table public.billing_document_files
  drop constraint if exists billing_document_files_source_kind_check;

alter table public.billing_document_files
  add constraint billing_document_files_source_kind_check
  check (source_kind in ('upload', 'sharepoint', 'generated'));

commit;

begin;

create table if not exists public.expense_individual_duplicate_archive (
  id uuid primary key default gen_random_uuid(),
  archived_expense_id uuid not null,
  canonical_expense_id uuid not null,
  supplier_id uuid not null,
  supplier_tax_id text not null,
  invoice_number text not null,
  invoice_key text not null,
  archived_reason text not null default 'duplicate_supplier_invoice',
  duplicate_snapshot jsonb not null,
  archived_at timestamptz not null default now()
);

create unique index if not exists idx_expense_individual_duplicate_archive_expense
  on public.expense_individual_duplicate_archive (archived_expense_id);

create index if not exists idx_expense_individual_duplicate_archive_key
  on public.expense_individual_duplicate_archive (supplier_id, invoice_key);

alter table public.expense_individual_duplicate_archive enable row level security;
alter table public.expense_individual_duplicate_archive force row level security;

revoke all on public.expense_individual_duplicate_archive from anon, authenticated;
grant select on public.expense_individual_duplicate_archive to authenticated;

drop policy if exists expense_individual_duplicate_archive_authenticated_select
  on public.expense_individual_duplicate_archive;
create policy expense_individual_duplicate_archive_authenticated_select
on public.expense_individual_duplicate_archive
for select
to authenticated
using (public.is_app_user());

do $$
begin
  if exists (
    with ranked as (
      select
        e.id,
        row_number() over (
          partition by e.supplier_id, upper(btrim(e.invoice_number))
          order by e.imported_at nulls last, e.created_at, e.id
        ) as rn
      from public.expense_individuals e
      where btrim(e.invoice_number) <> ''
    )
    select 1
    from ranked r
    join public.expense_individual_documents d on d.expense_id = r.id
    where r.rn > 1
    limit 1
  ) then
    raise exception 'Cannot deduplicate expense_individuals while duplicate rows have documents';
  end if;
end
$$;

with ranked as (
  select
    e.*,
    first_value(e.id) over (
      partition by e.supplier_id, upper(btrim(e.invoice_number))
      order by e.imported_at nulls last, e.created_at, e.id
    ) as canonical_expense_id,
    row_number() over (
      partition by e.supplier_id, upper(btrim(e.invoice_number))
      order by e.imported_at nulls last, e.created_at, e.id
    ) as rn,
    upper(btrim(e.invoice_number)) as invoice_key
  from public.expense_individuals e
  where btrim(e.invoice_number) <> ''
),
duplicates as (
  select *
  from ranked
  where rn > 1
)
insert into public.expense_individual_duplicate_archive (
  archived_expense_id,
  canonical_expense_id,
  supplier_id,
  supplier_tax_id,
  invoice_number,
  invoice_key,
  duplicate_snapshot
)
select
  d.id,
  d.canonical_expense_id,
  d.supplier_id,
  d.supplier_tax_id,
  d.invoice_number,
  d.invoice_key,
  to_jsonb(d) - 'rn' - 'canonical_expense_id' - 'invoice_key'
from duplicates d
on conflict (archived_expense_id) do nothing;

with ranked as (
  select
    e.id,
    row_number() over (
      partition by e.supplier_id, upper(btrim(e.invoice_number))
      order by e.imported_at nulls last, e.created_at, e.id
    ) as rn
  from public.expense_individuals e
  where btrim(e.invoice_number) <> ''
)
delete from public.expense_individuals e
using ranked r
where e.id = r.id
  and r.rn > 1;

create unique index if not exists idx_expense_individuals_supplier_invoice_unique
  on public.expense_individuals (supplier_id, upper(btrim(invoice_number)))
  where btrim(invoice_number) <> '';

commit;

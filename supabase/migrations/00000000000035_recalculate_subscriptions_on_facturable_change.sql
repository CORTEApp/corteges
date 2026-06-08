begin;

create or replace function public.recalculate_billing_subscriptions_for_facturable(
  p_facturable_id uuid,
  p_actor_user_id uuid default null
)
returns table (
  subscription_updates integer,
  approval_line_updates integer,
  approval_candidate_updates integer,
  approval_batch_updates integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription_updates integer := 0;
  v_approval_line_updates integer := 0;
  v_approval_candidate_updates integer := 0;
  v_approval_batch_updates integer := 0;
begin
  if p_facturable_id is null then
    raise exception 'Facturable id is required';
  end if;

  update public.billing_subscriptions subscriptions
  set
    recurring_total_amount = round(
      facturables.unit_price
        * subscriptions.quantity
        * case
            when subscriptions.apply_vat then 1 + (subscriptions.vat_rate / 100)
            else 1
          end,
      4
    ),
    updated_by = coalesce(p_actor_user_id, subscriptions.updated_by),
    updated_at = now()
  from public.billing_facturables facturables
  where subscriptions.facturable_id = facturables.id
    and facturables.id = p_facturable_id
    and subscriptions.quantity > 0
    and subscriptions.recurring_total_amount is distinct from round(
      facturables.unit_price
        * subscriptions.quantity
        * case
            when subscriptions.apply_vat then 1 + (subscriptions.vat_rate / 100)
            else 1
          end,
      4
    );

  get diagnostics v_subscription_updates = row_count;

  with line_amounts as (
    select
      lines.id,
      subscriptions.quantity,
      case
        when subscriptions.apply_vat then subscriptions.vat_rate
        else 0
      end as vat_rate,
      round(subscriptions.recurring_total_amount, 2) as total_amount,
      round(
        case
          when subscriptions.apply_vat and subscriptions.vat_rate > 0
            then subscriptions.recurring_total_amount / (1 + subscriptions.vat_rate / 100)
          else subscriptions.recurring_total_amount
        end,
        2
      ) as subtotal_amount
    from public.billing_invoice_approval_lines lines
    join public.billing_invoice_approval_candidates candidates
      on candidates.id = lines.candidate_id
    join public.billing_subscriptions subscriptions
      on subscriptions.id = lines.subscription_id
    where candidates.status in ('pending', 'failed')
      and subscriptions.facturable_id = p_facturable_id
  ),
  normalized_line_amounts as (
    select
      id,
      quantity,
      vat_rate,
      subtotal_amount,
      round(total_amount - subtotal_amount, 2) as tax_amount,
      total_amount,
      round(subtotal_amount / nullif(quantity, 0), 4) as unit_price
    from line_amounts
  )
  update public.billing_invoice_approval_lines lines
  set
    quantity = normalized_line_amounts.quantity,
    unit_price = normalized_line_amounts.unit_price,
    vat_rate = normalized_line_amounts.vat_rate,
    subtotal_amount = normalized_line_amounts.subtotal_amount,
    tax_amount = normalized_line_amounts.tax_amount,
    total_amount = normalized_line_amounts.total_amount
  from normalized_line_amounts
  where lines.id = normalized_line_amounts.id
    and (
      lines.quantity is distinct from normalized_line_amounts.quantity
      or lines.unit_price is distinct from normalized_line_amounts.unit_price
      or lines.vat_rate is distinct from normalized_line_amounts.vat_rate
      or lines.subtotal_amount is distinct from normalized_line_amounts.subtotal_amount
      or lines.tax_amount is distinct from normalized_line_amounts.tax_amount
      or lines.total_amount is distinct from normalized_line_amounts.total_amount
    );

  get diagnostics v_approval_line_updates = row_count;

  with touched_candidates as (
    select distinct lines.candidate_id
    from public.billing_invoice_approval_lines lines
    join public.billing_invoice_approval_candidates candidates
      on candidates.id = lines.candidate_id
    join public.billing_subscriptions subscriptions
      on subscriptions.id = lines.subscription_id
    where candidates.status in ('pending', 'failed')
      and subscriptions.facturable_id = p_facturable_id
  ),
  candidate_summaries as (
    select
      candidates.id,
      round(coalesce(sum(lines.subtotal_amount), 0), 2) as subtotal_amount,
      round(coalesce(sum(lines.tax_amount), 0), 2) as tax_amount,
      round(coalesce(sum(lines.total_amount), 0), 2) as total_amount
    from public.billing_invoice_approval_candidates candidates
    join touched_candidates touched
      on touched.candidate_id = candidates.id
    join public.billing_invoice_approval_lines lines
      on lines.candidate_id = candidates.id
    group by candidates.id
  )
  update public.billing_invoice_approval_candidates candidates
  set
    subtotal_amount = candidate_summaries.subtotal_amount,
    tax_amount = candidate_summaries.tax_amount,
    total_amount = candidate_summaries.total_amount,
    updated_by = coalesce(p_actor_user_id, candidates.updated_by),
    updated_at = now()
  from candidate_summaries
  where candidates.id = candidate_summaries.id
    and (
      candidates.subtotal_amount is distinct from candidate_summaries.subtotal_amount
      or candidates.tax_amount is distinct from candidate_summaries.tax_amount
      or candidates.total_amount is distinct from candidate_summaries.total_amount
    );

  get diagnostics v_approval_candidate_updates = row_count;

  with touched_batches as (
    select distinct candidates.batch_id
    from public.billing_invoice_approval_candidates candidates
    join public.billing_invoice_approval_lines lines
      on lines.candidate_id = candidates.id
    join public.billing_subscriptions subscriptions
      on subscriptions.id = lines.subscription_id
    where candidates.status in ('pending', 'failed')
      and subscriptions.facturable_id = p_facturable_id
  ),
  batch_summaries as (
    select
      batches.id,
      count(candidates.id)::integer as candidate_count,
      round(coalesce(sum(candidates.total_amount), 0), 2) as total_amount
    from public.billing_invoice_approval_batches batches
    join touched_batches touched
      on touched.batch_id = batches.id
    left join public.billing_invoice_approval_candidates candidates
      on candidates.batch_id = batches.id
      and candidates.status <> 'cancelled'
    group by batches.id
  )
  update public.billing_invoice_approval_batches batches
  set
    candidate_count = batch_summaries.candidate_count,
    total_amount = batch_summaries.total_amount,
    updated_by = coalesce(p_actor_user_id, batches.updated_by),
    updated_at = now()
  from batch_summaries
  where batches.id = batch_summaries.id
    and (
      batches.candidate_count is distinct from batch_summaries.candidate_count
      or batches.total_amount is distinct from batch_summaries.total_amount
    );

  get diagnostics v_approval_batch_updates = row_count;

  return query select
    v_subscription_updates,
    v_approval_line_updates,
    v_approval_candidate_updates,
    v_approval_batch_updates;
end;
$$;

grant execute on function public.recalculate_billing_subscriptions_for_facturable(uuid, uuid) to authenticated;

create or replace function public.sync_billing_subscriptions_after_facturable_amount_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.recalculate_billing_subscriptions_for_facturable(new.id, new.updated_by);

  return new;
end;
$$;

drop trigger if exists trg_sync_billing_subscriptions_after_facturable_amount_change
  on public.billing_facturables;

create trigger trg_sync_billing_subscriptions_after_facturable_amount_change
after update of unit_price on public.billing_facturables
for each row
when (old.unit_price is distinct from new.unit_price)
execute function public.sync_billing_subscriptions_after_facturable_amount_change();

commit;

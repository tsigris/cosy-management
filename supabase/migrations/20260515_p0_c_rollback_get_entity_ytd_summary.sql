-- ============================================================
-- ROLLBACK: 20260515_p0_c_fix_get_entity_ytd_summary.sql
-- ============================================================
-- Apply ONLY to undo 20260515_p0_c_fix_get_entity_ytd_summary.sql.
-- ⚠ Restores version without auth guards. Emergency only.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_entity_ytd_summary(
  p_store_id    uuid,
  p_entity_type text,
  p_entity_id   uuid,
  p_date_from   date,
  p_date_to     date
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
declare
  result jsonb;
begin
  if p_entity_type = 'revenue_source' then
    select jsonb_build_object(
      'turnover_income',
        coalesce(sum(case when type = 'income' then abs(amount) else 0 end), 0),
      'received_income',
        coalesce(sum(case when type in ('income_collection', 'debt_received') then abs(amount) else 0 end), 0),
      'credit_income',
        coalesce(sum(case when is_credit = true then abs(amount) else 0 end), 0),
      'open_income',
        coalesce(sum(case when is_credit = true then abs(amount) else 0 end), 0)
        -
        coalesce(sum(case when type in ('income_collection', 'debt_received') then abs(amount) else 0 end), 0),
      'total_expenses', 0,
      'payments', 0,
      'credit_expenses', 0,
      'open_expense', 0
    )
    into result
    from public.transactions
    where store_id        = p_store_id
      and revenue_source_id = p_entity_id
      and date >= p_date_from
      and date <= p_date_to;

  elsif p_entity_type = 'supplier' then
    select jsonb_build_object(
      'turnover_income', 0,
      'received_income', 0,
      'credit_income', 0,
      'open_income', 0,
      'total_expenses',
        coalesce(sum(case when type = 'expense' then abs(amount) else 0 end), 0),
      'payments',
        coalesce(sum(case when type = 'debt_payment' then abs(amount) else 0 end), 0),
      'credit_expenses',
        coalesce(sum(case when type = 'expense' and is_credit = true then abs(amount) else 0 end), 0),
      'open_expense',
        coalesce(sum(case when type = 'expense' and is_credit = true then abs(amount) else 0 end), 0)
        -
        coalesce(sum(case when type = 'debt_payment' then abs(amount) else 0 end), 0)
    )
    into result
    from public.transactions
    where store_id    = p_store_id
      and supplier_id = p_entity_id
      and date >= p_date_from
      and date <= p_date_to;

  elsif p_entity_type in ('fixed_asset', 'asset') then
    select jsonb_build_object(
      'turnover_income', 0,
      'received_income', 0,
      'credit_income', 0,
      'open_income', 0,
      'total_expenses',
        coalesce(sum(case when type = 'expense' then abs(amount) else 0 end), 0),
      'payments',
        coalesce(sum(case when type = 'debt_payment' then abs(amount) else 0 end), 0),
      'credit_expenses',
        coalesce(sum(case when type = 'expense' and is_credit = true then abs(amount) else 0 end), 0),
      'open_expense',
        coalesce(sum(case when type = 'expense' and is_credit = true then abs(amount) else 0 end), 0)
        -
        coalesce(sum(case when type = 'debt_payment' then abs(amount) else 0 end), 0)
    )
    into result
    from public.transactions
    where store_id       = p_store_id
      and fixed_asset_id = p_entity_id
      and date >= p_date_from
      and date <= p_date_to;

  else
    result := jsonb_build_object(
      'turnover_income', 0, 'received_income', 0,
      'credit_income', 0,   'open_income', 0,
      'total_expenses', 0,  'payments', 0,
      'credit_expenses', 0, 'open_expense', 0
    );
  end if;

  return result;
end;
$function$;

-- ⚠ Re-exposes to PUBLIC. Emergency only.
GRANT EXECUTE ON FUNCTION public.get_entity_ytd_summary(uuid, text, uuid, date, date) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_entity_ytd_summary(uuid, text, uuid, date, date) TO authenticated;

COMMIT;

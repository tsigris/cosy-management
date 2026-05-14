-- ============================================================
-- P0 SECURITY: Add auth guard to get_entity_ytd_summary
-- ============================================================
-- Problem: get_entity_ytd_summary had no auth.uid() check and no
-- store_access check.  Any authenticated user could retrieve full
-- YTD financial summaries (supplier debt, revenue source income,
-- employee costs) for any store by supplying any store UUID.
--
-- Fix:
--   1. Validate auth.uid() is not null.
--   2. Require caller membership in public.store_access for p_store_id.
--   3. REVOKE FROM PUBLIC + GRANT TO authenticated.
--
-- Security model: SECURITY INVOKER (default, unchanged).
-- Signature: unchanged — no frontend changes required.
-- Business logic: all three branches (revenue_source, supplier,
--   fixed_asset) unchanged.  Only the auth guard is new.
--
-- Prerequisite: 20260515_p0_a_revoke_public_grants.sql
-- Rollback: 20260515_p0_c_rollback_get_entity_ytd_summary.sql
-- Risk: LOW — read-only function.
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
-- SECURITY INVOKER (default) — runs as the calling user.
AS $function$
DECLARE
  v_caller_id uuid;
  result      jsonb;
BEGIN
  -- Guard 1: must be authenticated
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Απαιτείται σύνδεση.' USING ERRCODE = '42501';
  END IF;

  -- Guard 2: caller must be a member of the requested store
  IF NOT EXISTS (
    SELECT 1 FROM public.store_access
    WHERE user_id  = v_caller_id
      AND store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'Δεν έχετε πρόσβαση σε αυτό το κατάστημα.' USING ERRCODE = '42501';
  END IF;

  -- Original logic — unchanged below this line

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
      'turnover_income', 0,
      'received_income', 0,
      'credit_income',   0,
      'open_income',     0,
      'total_expenses',  0,
      'payments',        0,
      'credit_expenses', 0,
      'open_expense',    0
    );
  end if;

  return result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_entity_ytd_summary(uuid, text, uuid, date, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_entity_ytd_summary(uuid, text, uuid, date, date) TO authenticated;

COMMIT;

-- ============================================================
-- P0 SECURITY: Add auth guard to get_daily_totals
-- ============================================================
-- Problem: get_daily_totals(uuid, date) had no auth.uid() check and no
-- store_access check.  Any authenticated user could read any store's
-- daily financial totals by supplying any store UUID.
--
-- Fix:
--   1. Validate auth.uid() is not null (reject unauthenticated callers).
--   2. Require caller to exist in public.store_access for the given store.
--   3. REVOKE FROM PUBLIC + GRANT TO authenticated (redundant if p0_a
--      already ran, but idempotent).
--
-- Security model: SECURITY INVOKER (default, unchanged from original).
-- search_path: not set — not required for INVOKER functions.
-- Signature: unchanged — no frontend changes required.
-- Business logic: unchanged.
--
-- Prerequisite: 20260515_p0_a_revoke_public_grants.sql
-- Rollback: 20260515_p0_b_rollback_get_daily_totals.sql
-- Risk: LOW — read-only function; only change is rejecting unauthorized callers.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_daily_totals(
  p_store_id uuid,
  p_date     date
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

  -- Original query — unchanged
  SELECT jsonb_build_object(
    'income',
      COALESCE(SUM(CASE
        WHEN type IN ('income', 'income_collection', 'debt_received')
        THEN amount ELSE 0
      END), 0),
    'expense',
      COALESCE(SUM(CASE
        WHEN type IN ('expense', 'debt_payment', 'salary_advance')
        THEN ABS(amount) ELSE 0
      END), 0),
    'credits',
      COALESCE(SUM(CASE
        WHEN type = 'expense' AND is_credit = true
        THEN ABS(amount) ELSE 0
      END), 0),
    'savings_deposits',
      COALESCE(SUM(CASE
        WHEN type = 'savings_deposit'
        THEN ABS(amount) ELSE 0
      END), 0),
    'savings_withdrawals',
      COALESCE(SUM(CASE
        WHEN type = 'savings_withdrawal'
        THEN ABS(amount) ELSE 0
      END), 0)
  )
  INTO result
  FROM public.transactions
  WHERE store_id = p_store_id
    AND date      = p_date;

  RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_daily_totals(uuid, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_daily_totals(uuid, date) TO authenticated;

COMMIT;

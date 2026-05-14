-- ============================================================
-- P0 SECURITY: Add auth guard + FOR UPDATE to
--              professional_delete_goal_transaction
-- ============================================================
-- Problem: professional_delete_goal_transaction had no auth.uid() check
-- and no store_access check.  Any authenticated user could DELETE
-- financial transactions from any store and corrupt goal balances.
--
-- Fix:
--   1. Validate auth.uid() is not null.
--   2. Require caller membership in public.store_access for p_store_id
--      (any role with can_edit_transactions OR admin).
--   3. Add FOR UPDATE on the initial SELECT to prevent a race condition
--      between the amount read and the DELETE.
--   4. REVOKE FROM PUBLIC + GRANT TO authenticated.
--
-- Security model: SECURITY INVOKER (default, unchanged from original).
-- Signature: unchanged — returns numeric (new goal current_amount or 0).
-- Business logic: unchanged — the SELECT → DELETE → UPDATE savings_goals
--   flow is identical; only auth guard and row lock are new.
--
-- Prerequisite: 20260515_p0_a_revoke_public_grants.sql
-- Rollback: 20260515_p0_d_rollback_professional_delete_goal_transaction.sql
-- Risk: MEDIUM — mutates transactions and savings_goals.  Auth guard is
--       the only behaviour change visible to callers; legitimate callers
--       (with store_access) are unaffected.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.professional_delete_goal_transaction(
  p_transaction_id uuid,
  p_goal_id        uuid,
  p_store_id       uuid
)
RETURNS numeric
LANGUAGE plpgsql
-- SECURITY INVOKER (default) — runs as the calling user.
AS $function$
DECLARE
  v_caller_id  uuid;
  v_amount     numeric;
  v_new_total  numeric;
BEGIN
  -- Guard 1: must be authenticated
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Απαιτείται σύνδεση.' USING ERRCODE = '42501';
  END IF;

  -- Guard 2: caller must have edit access to the store
  IF NOT EXISTS (
    SELECT 1 FROM public.store_access
    WHERE user_id  = v_caller_id
      AND store_id = p_store_id
      AND (role = 'admin' OR can_edit_transactions = true)
  ) THEN
    RAISE EXCEPTION 'Δεν έχετε δικαιώματα επεξεργασίας για αυτό το κατάστημα.' USING ERRCODE = '42501';
  END IF;

  -- Lock the row before reading amount to prevent a TOCTOU race between
  -- the SELECT and the DELETE (matches pattern used in installment_payment_atomic).
  SELECT amount
  INTO   v_amount
  FROM   public.transactions
  WHERE  id       = p_transaction_id
    AND  store_id = p_store_id
  FOR UPDATE;

  DELETE FROM public.transactions
  WHERE  id       = p_transaction_id
    AND  store_id = p_store_id;

  IF FOUND THEN
    UPDATE public.savings_goals
    SET    current_amount = GREATEST(0, current_amount + v_amount)
    WHERE  id       = p_goal_id
      AND  store_id = p_store_id
    RETURNING current_amount INTO v_new_total;

    RETURN COALESCE(v_new_total, 0);
  ELSE
    RETURN 0;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.professional_delete_goal_transaction(uuid, uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.professional_delete_goal_transaction(uuid, uuid, uuid) TO authenticated;

COMMIT;

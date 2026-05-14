-- Migration: fix transfer_funds – enforce auth + correct sign on outgoing leg
-- Date: 2026-05-14
-- Phase 1 – Critical Security
--
-- Problems fixed:
--   1. SECURITY DEFINER with no auth check allowed any authenticated user to
--      move money between ANY two stores regardless of membership.
--   2. Outgoing leg was written as a positive expense (+amount), should be
--      negative so debits reduce the store balance correctly.
--
-- Strategy:
--   • Switch to SECURITY INVOKER (runs as the calling user, not the definer).
--   • Verify auth.uid() is not null (rejects unauthenticated callers).
--   • Check store_access for both stores: caller must have role = 'admin' or
--     can_edit_transactions = true for EACH store.
--   • Write outgoing leg as -ABS(p_amount) and incoming leg as +ABS(p_amount).

BEGIN;

CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_from_store_id uuid,
  p_to_store_id uuid,
  p_amount       numeric,
  p_description  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $function$
DECLARE
  v_caller_id  uuid;
  v_from_ok    boolean := false;
  v_to_ok      boolean := false;
BEGIN
  -- 1. Must be authenticated
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Απαιτείται σύνδεση.' USING ERRCODE = '42501';
  END IF;

  -- 2. Amount must be positive
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Το ποσό μεταφοράς πρέπει να είναι θετικό.' USING ERRCODE = '22003';
  END IF;

  -- 3. Caller must have access to the source store
  SELECT EXISTS (
    SELECT 1 FROM public.store_access
    WHERE user_id = v_caller_id
      AND store_id = p_from_store_id
      AND (role = 'admin' OR can_edit_transactions = true)
  ) INTO v_from_ok;

  IF NOT v_from_ok THEN
    RAISE EXCEPTION 'Δεν έχετε δικαιώματα για το κατάστημα προέλευσης.' USING ERRCODE = '42501';
  END IF;

  -- 4. Caller must have access to the destination store
  SELECT EXISTS (
    SELECT 1 FROM public.store_access
    WHERE user_id = v_caller_id
      AND store_id = p_to_store_id
      AND (role = 'admin' OR can_edit_transactions = true)
  ) INTO v_to_ok;

  IF NOT v_to_ok THEN
    RAISE EXCEPTION 'Δεν έχετε δικαιώματα για το κατάστημα προορισμού.' USING ERRCODE = '42501';
  END IF;

  -- 5. Insert outgoing leg: negative amount (debit)
  INSERT INTO public.transactions (store_id, type, amount, category, notes, user_id)
    VALUES (
      p_from_store_id,
      'expense',
      -ABS(p_amount),
      'Μεταφορά Κεφαλαίου',
      'Προς: ' || p_description,
      v_caller_id
    );

  -- 6. Insert incoming leg: positive amount (credit)
  INSERT INTO public.transactions (store_id, type, amount, category, notes, user_id)
    VALUES (
      p_to_store_id,
      'income',
      ABS(p_amount),
      'Μεταφορά Κεφαλαίου',
      'Από: ' || p_description,
      v_caller_id
    );
END;
$function$;

-- Keep the same grant; auth is now enforced inside the function body.
GRANT EXECUTE ON FUNCTION public.transfer_funds(uuid, uuid, numeric, text) TO authenticated;

COMMIT;

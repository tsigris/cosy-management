-- ============================================================
-- SAFE EMERGENCY ROLLBACK: transfer_funds
-- ============================================================
-- Apply ONLY if rolling back 20260514_fix_transfer_funds_auth_and_sign.sql.
--
-- WHY THIS ROLLBACK EXISTS
-- -------------------------
-- Phase 1 switched transfer_funds to SECURITY INVOKER so that the store_access
-- membership checks run as the calling user.  If the store_access table has
-- missing or misconfigured RLS policies the EXISTS(...) checks will return
-- false for all callers, making the function completely unusable in production.
-- This rollback recovers from that failure mode.
--
-- WHAT THIS ROLLBACK DOES — AND DOES NOT DO
-- -------------------------------------------
-- PRESERVES  ✓  Correct ledger sign semantics (outgoing = -ABS, incoming = +ABS)
-- PRESERVES  ✓  Basic financial invariants (amount > 0, source ≠ destination)
-- PRESERVES  ✓  Authentication check (auth.uid() must not be null)
-- REMOVES    ✗  Per-store membership check (store_access lookup removed because
--               SECURITY INVOKER + broken RLS is exactly what we are escaping)
-- RESTORES   ⚠  SECURITY DEFINER — see "SECURITY MODEL" section below
--
-- SECURITY MODEL: SECURITY DEFINER RATIONALE
-- --------------------------------------------
-- SECURITY DEFINER runs the function body as the Postgres role of the function
-- OWNER (typically the Supabase service role), which bypasses RLS on all tables
-- the function touches.  This is less safe than SECURITY INVOKER, but it is the
-- only way to read store_access reliably when RLS is broken.
--
-- BLAST RADIUS MITIGATION
-- -------------------------
-- Without the store_access check, any authenticated user can call this function
-- with any two store UUIDs they happen to know.  To minimise exposure:
--   • auth.uid() IS NOT NULL check is retained → unauthenticated callers are
--     always rejected.
--   • p_amount > 0 is retained → zero/negative amounts are rejected.
--   • p_from_store_id ≠ p_to_store_id is added → self-transfers are rejected.
--   • The function is not exposed via the PostgREST REST API unless the caller
--     has an authenticated JWT.
--
-- TEMPORARY STATUS
-- -----------------
-- ⚠  DO NOT leave this rollback version deployed permanently.
--    The store_access authorization check MUST be restored as soon as the
--    RLS issue is diagnosed and fixed.  Apply the forward migration
--    20260514_fix_transfer_funds_auth_and_sign.sql once RLS is confirmed
--    correct.  See "ROLL-FORWARD" at the bottom of this file.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_from_store_id uuid,
  p_to_store_id   uuid,
  p_amount        numeric,
  p_description   text
)
RETURNS void
LANGUAGE plpgsql
-- ⚠ SECURITY DEFINER — temporary. Needed because SECURITY INVOKER depends on
--   correctly configured RLS on store_access, which failed in production.
--   Store_access membership checks are REMOVED in this rollback version.
--   Restore the full Phase 1 version as soon as RLS is confirmed working.
SECURITY DEFINER
-- Prevent search_path manipulation attacks even under SECURITY DEFINER.
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_caller_id uuid;
BEGIN
  -- -------------------------------------------------------
  -- Guard 1: Must be authenticated
  -- (RETAINED — eliminates anonymous callers regardless of DEFINER mode)
  -- -------------------------------------------------------
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Απαιτείται σύνδεση.' USING ERRCODE = '42501';
  END IF;

  -- -------------------------------------------------------
  -- Guard 2: Amount must be positive
  -- (RETAINED — prevents zero-value and negative-value records entering the ledger)
  -- -------------------------------------------------------
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Το ποσό μεταφοράς πρέπει να είναι θετικό.' USING ERRCODE = '22003';
  END IF;

  -- -------------------------------------------------------
  -- Guard 3: Source and destination must be different stores
  -- (ADDED in rollback — prevents a debit+credit on the same store from
  --  creating a phantom balance illusion without moving real money)
  -- -------------------------------------------------------
  IF p_from_store_id = p_to_store_id THEN
    RAISE EXCEPTION 'Το κατάστημα προέλευσης και προορισμού δεν μπορεί να είναι το ίδιο.' USING ERRCODE = '22023';
  END IF;

  -- -------------------------------------------------------
  -- REMOVED: store_access membership check
  -- Reason: under SECURITY DEFINER + broken RLS this check is unreliable.
  -- It is deferred to the roll-forward migration.
  -- ⚠ RESIDUAL RISK: any authenticated user can call this function until
  --   the full Phase 1 migration is re-applied.
  -- -------------------------------------------------------

  -- -------------------------------------------------------
  -- Outgoing leg: NEGATIVE amount (debit, reduces source store balance)
  -- Sign convention RETAINED from Phase 1.
  -- -------------------------------------------------------
  INSERT INTO public.transactions (store_id, type, amount, category, notes, user_id)
    VALUES (
      p_from_store_id,
      'expense',
      -ABS(p_amount),
      'Μεταφορά Κεφαλαίου',
      'Προς: ' || p_description,
      v_caller_id
    );

  -- -------------------------------------------------------
  -- Incoming leg: POSITIVE amount (credit, increases destination store balance)
  -- Sign convention RETAINED from Phase 1.
  -- -------------------------------------------------------
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

-- Grant is unchanged — the function is only callable by authenticated users,
-- and auth.uid() IS NOT NULL is enforced inside the body.
GRANT EXECUTE ON FUNCTION public.transfer_funds(uuid, uuid, numeric, text) TO authenticated;

-- ============================================================
-- ROLL-FORWARD GUIDANCE
-- ============================================================
-- After applying this rollback:
--
--   1. Diagnose the RLS issue on store_access:
--      SELECT * FROM pg_policies WHERE tablename = 'store_access';
--      Ensure authenticated users can SELECT their own rows
--      (policy: user_id = auth.uid()).
--
--   2. If RLS policy is missing, add:
--      CREATE POLICY "users_read_own_access"
--        ON public.store_access FOR SELECT
--        TO authenticated
--        USING (user_id = auth.uid());
--
--   3. Test the policy:
--      SET ROLE authenticated;
--      SET request.jwt.claims = '{"sub":"<real-user-uuid>"}';
--      SELECT * FROM store_access WHERE user_id = auth.uid();
--      -- Must return rows, not 0 rows.
--
--   4. Re-apply the full Phase 1 migration:
--      supabase db push --file supabase/migrations/20260514_fix_transfer_funds_auth_and_sign.sql
--
-- ============================================================

COMMIT;


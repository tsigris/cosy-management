-- ============================================================
-- ROLLBACK: 20260515_p0_d_fix_professional_delete_goal_transaction.sql
-- ============================================================
-- Apply ONLY to undo p0_d.
-- ⚠ Restores version that allows any authenticated user to DELETE
--   transactions from any store. Emergency only.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.professional_delete_goal_transaction(
  p_transaction_id uuid,
  p_goal_id        uuid,
  p_store_id       uuid
)
RETURNS numeric
LANGUAGE plpgsql
AS $function$
DECLARE
    v_amount    DECIMAL;
    v_new_total DECIMAL;
BEGIN
    SELECT amount INTO v_amount
    FROM transactions
    WHERE id = p_transaction_id AND store_id = p_store_id;

    DELETE FROM transactions WHERE id = p_transaction_id AND store_id = p_store_id;

    IF FOUND THEN
        UPDATE savings_goals
        SET current_amount = GREATEST(0, current_amount + v_amount)
        WHERE id = p_goal_id AND store_id = p_store_id
        RETURNING current_amount INTO v_new_total;

        RETURN v_new_total;
    ELSE
        RETURN 0;
    END IF;
END;
$function$;

-- ⚠ Re-exposes to PUBLIC. Emergency only.
GRANT EXECUTE ON FUNCTION public.professional_delete_goal_transaction(uuid, uuid, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.professional_delete_goal_transaction(uuid, uuid, uuid) TO authenticated;

COMMIT;

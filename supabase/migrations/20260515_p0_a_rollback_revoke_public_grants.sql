-- ============================================================
-- ROLLBACK: 20260515_p0_a_revoke_public_grants.sql
-- ============================================================
-- Apply ONLY to undo 20260515_p0_a_revoke_public_grants.sql.
-- ⚠ Re-grants EXECUTE to PUBLIC on P0 functions.
--   This re-opens the attack surface. Apply only in a genuine
--   deployment emergency and re-apply the forward migration immediately.
-- ============================================================

BEGIN;

GRANT EXECUTE ON FUNCTION public.get_daily_totals(uuid, date)                        TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_entity_ytd_summary(uuid, text, uuid, date, date) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.professional_delete_goal_transaction(uuid, uuid, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_funds(uuid, uuid, numeric, text)            TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_performance_tracker(uuid, date)            TO PUBLIC;

COMMIT;

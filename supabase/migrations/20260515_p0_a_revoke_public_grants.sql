-- ============================================================
-- P0 SECURITY: Revoke default PUBLIC EXECUTE grants
-- ============================================================
-- Deploy FIRST — before any other P0 migration.
-- Immediately closes the "any role can call these functions" attack
-- surface while the per-function auth guard migrations are applied.
--
-- Background: PostgreSQL grants EXECUTE to PUBLIC by default on every
-- function.  The Supabase `authenticated` and `anon` roles both inherit
-- from PUBLIC.  Without an explicit REVOKE, an unauthenticated caller
-- (using the public anon key) can invoke these RPCs if PostgREST exposes
-- the schema.
--
-- The transfer_funds body was fixed in 20260514_fix_transfer_funds_auth_and_sign.sql
-- but that migration omitted the REVOKE.  This migration adds it.
--
-- Deployment order: this file → p0_b → p0_c → p0_d → p0_e → p0_f
-- Rollback: 20260515_p0_a_rollback_revoke_public_grants.sql
-- Risk: LOW — REVOKE + re-GRANT is atomic; existing authenticated callers
--        keep their access through the explicit GRANT TO authenticated.
-- ============================================================

BEGIN;

-- get_daily_totals
REVOKE EXECUTE ON FUNCTION public.get_daily_totals(uuid, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_daily_totals(uuid, date) TO authenticated;

-- get_entity_ytd_summary
REVOKE EXECUTE ON FUNCTION public.get_entity_ytd_summary(uuid, text, uuid, date, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_entity_ytd_summary(uuid, text, uuid, date, date) TO authenticated;

-- professional_delete_goal_transaction
REVOKE EXECUTE ON FUNCTION public.professional_delete_goal_transaction(uuid, uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.professional_delete_goal_transaction(uuid, uuid, uuid) TO authenticated;

-- transfer_funds (body fixed in Phase 1; REVOKE was missing)
REVOKE EXECUTE ON FUNCTION public.transfer_funds(uuid, uuid, numeric, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.transfer_funds(uuid, uuid, numeric, text) TO authenticated;

-- get_daily_performance_tracker (SECURITY DEFINER, no auth guard — body fixed in p0_e)
REVOKE EXECUTE ON FUNCTION public.get_daily_performance_tracker(uuid, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_daily_performance_tracker(uuid, date) TO authenticated;

COMMIT;

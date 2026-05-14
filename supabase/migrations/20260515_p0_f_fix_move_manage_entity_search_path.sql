-- ============================================================
-- P0 SECURITY: Add SET search_path to move_manage_entity
-- ============================================================
-- Problem: move_manage_entity is SECURITY DEFINER with proper auth
-- (auth.uid() + admin role check) and REVOKE FROM PUBLIC, but it
-- is missing SET search_path.
--
-- Under SECURITY DEFINER, PostgreSQL uses the search_path of the
-- function OWNER (service role) at call time.  If an attacker with
-- admin access to any store creates a schema-shadowing table named
-- 'transactions', 'suppliers', 'fixed_assets', or 'revenue_sources'
-- in a schema that appears before 'public' in the effective search_path,
-- the function body will resolve to the attacker's tables and execute
-- mutations against them under the owner's elevated privileges.
--
-- Fix: ALTER FUNCTION to pin search_path = public, pg_catalog.
-- This is the minimal safe change — no function body rewrite needed.
--
-- Security model: SECURITY DEFINER retained (required — the function
--   performs cross-table mutations that need consistent RLS bypass).
-- Auth guard: unchanged (auth.uid() + admin role check already present).
-- Grants: unchanged (REVOKE FROM PUBLIC + GRANT TO authenticated
--   already present from original migration).
-- Signature: unchanged.
--
-- Rollback: 20260515_p0_f_rollback_move_manage_entity_search_path.sql
-- Risk: VERY LOW — ALTER FUNCTION on a running function is transactional
--       and takes no table lock. The search_path change is invisible to
--       callers; it only restricts name resolution inside the function.
-- ============================================================

BEGIN;

ALTER FUNCTION public.move_manage_entity(uuid, text, uuid, text, text)
  SET search_path = public, pg_catalog;

COMMIT;

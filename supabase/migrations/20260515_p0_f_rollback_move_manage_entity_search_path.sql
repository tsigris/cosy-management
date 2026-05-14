-- ============================================================
-- ROLLBACK: 20260515_p0_f_fix_move_manage_entity_search_path.sql
-- ============================================================
-- Apply ONLY to undo p0_f.
-- Removes the pinned search_path from move_manage_entity, restoring
-- the default (owner search_path resolution).
-- ⚠ The function will again be vulnerable to search_path poisoning.
--   Emergency only. Re-apply the forward migration immediately.
-- ============================================================

BEGIN;

ALTER FUNCTION public.move_manage_entity(uuid, text, uuid, text, text)
  RESET search_path;

COMMIT;

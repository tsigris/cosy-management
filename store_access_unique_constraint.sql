-- Ensure store_access has a guaranteed uniqueness target for upsert(onConflict)
-- 1) Remove duplicate pairs, keeping one row per (user_id, store_id)
DELETE FROM public.store_access a
USING public.store_access b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.store_id = b.store_id;

-- 2) Add unique index used by upsert(onConflict: 'user_id,store_id')
CREATE UNIQUE INDEX IF NOT EXISTS store_access_user_id_store_id_uidx
  ON public.store_access (user_id, store_id);

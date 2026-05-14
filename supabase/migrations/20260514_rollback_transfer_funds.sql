-- Rollback: restore transfer_funds to pre-Phase-1 state
-- Apply this ONLY if rolling back 20260514_fix_transfer_funds_auth_and_sign.sql
-- WARNING: restores the unauthenticated / wrong-sign version. Deploy the fix
--          again as soon as the rollback reason is resolved.

BEGIN;

CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_from_store_id uuid,
  p_to_store_id   uuid,
  p_amount        numeric,
  p_description   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.transactions (store_id, type, amount, category, notes, user_id)
    VALUES (p_from_store_id, 'expense', p_amount, 'Μεταφορά Κεφαλαίου', 'Προς: ' || p_description, auth.uid());

  INSERT INTO public.transactions (store_id, type, amount, category, notes, user_id)
    VALUES (p_to_store_id, 'income', p_amount, 'Μεταφορά Κεφαλαίου', 'Από: ' || p_description, auth.uid());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_funds(uuid, uuid, numeric, text) TO authenticated;

COMMIT;

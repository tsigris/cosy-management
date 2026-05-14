-- ============================================================
-- ROLLBACK: 20260515_p0_b_fix_get_daily_totals.sql
-- ============================================================
-- Apply ONLY to undo 20260515_p0_b_fix_get_daily_totals.sql.
-- ⚠ Restores the insecure version without auth guards.
--   Any authenticated user will again be able to read any store's
--   daily totals. Re-apply the forward migration immediately.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_daily_totals(
  p_store_id uuid,
  p_date     date
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'income',
      coalesce(sum(case
        when type in ('income','income_collection','debt_received')
        then amount else 0
      end), 0),
    'expense',
      coalesce(sum(case
        when type in ('expense','debt_payment','salary_advance')
        then abs(amount) else 0
      end), 0),
    'credits',
      coalesce(sum(case
        when type = 'expense' and is_credit = true
        then abs(amount) else 0
      end), 0),
    'savings_deposits',
      coalesce(sum(case
        when type = 'savings_deposit'
        then abs(amount) else 0
      end), 0),
    'savings_withdrawals',
      coalesce(sum(case
        when type = 'savings_withdrawal'
        then abs(amount) else 0
      end), 0)
  )
  into result
  from public.transactions
  where store_id = p_store_id
    and date = p_date;

  return result;
end;
$function$;

-- ⚠ Re-exposes to PUBLIC. Emergency only.
GRANT EXECUTE ON FUNCTION public.get_daily_totals(uuid, date) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_totals(uuid, date) TO authenticated;

COMMIT;

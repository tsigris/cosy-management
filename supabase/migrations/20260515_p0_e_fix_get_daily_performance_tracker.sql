-- ============================================================
-- P0 SECURITY: Fix get_daily_performance_tracker
-- ============================================================
-- Problems:
--   1. SECURITY DEFINER with no SET search_path — vulnerable to
--      search_path poisoning (attacker shadows public.transactions).
--   2. No auth.uid() check — any authenticated user can call.
--   3. No store_access check — any authenticated user reads any
--      store's daily performance data.
--
-- Fix:
--   1. Switch to SECURITY INVOKER (removes privilege escalation vector).
--      SECURITY DEFINER is not needed here — the function only reads
--      public.transactions, which the calling user may access directly.
--   2. Add auth.uid() guard.
--   3. Add store_access membership guard.
--   4. Use explicit public. schema prefix on all table references.
--   5. REVOKE FROM PUBLIC + GRANT TO authenticated.
--
-- Note on search_path: SET search_path is only meaningful for SECURITY
-- DEFINER functions.  Under INVOKER, the caller's search_path applies,
-- so adding it here provides no additional isolation.  The real fix is
-- the switch to INVOKER.
--
-- Signature: unchanged — returns json (same as original).
-- Business logic: unchanged — all calculations, weekday labels, averages
--   are byte-for-byte identical.
--
-- Prerequisite: 20260515_p0_a_revoke_public_grants.sql
-- Rollback: 20260515_p0_e_rollback_get_daily_performance_tracker.sql
-- Risk: LOW — read-only function; no writes.  The SECURITY DEFINER →
--       INVOKER switch is safe because the function performs no privileged
--       operations.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_daily_performance_tracker(
  p_store_id uuid,
  p_date     date
)
RETURNS json
LANGUAGE plpgsql
-- SECURITY INVOKER: runs as the calling user.
-- Replaces the original SECURITY DEFINER which had no search_path and no auth guard.
AS $function$
DECLARE
  v_caller_id       uuid;
  v_dow             int;
  v_weekday_label   text;
  v_income_today    numeric := 0;
  v_expense_today   numeric := 0;
  v_income_avg      numeric := 0;
  v_expense_avg     numeric := 0;
  v_income_diff_pct numeric := 0;
  v_expense_diff_pct numeric := 0;
BEGIN
  -- Guard 1: must be authenticated
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Απαιτείται σύνδεση.' USING ERRCODE = '42501';
  END IF;

  -- Guard 2: caller must be a member of the requested store
  IF NOT EXISTS (
    SELECT 1 FROM public.store_access
    WHERE user_id  = v_caller_id
      AND store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'Δεν έχετε πρόσβαση σε αυτό το κατάστημα.' USING ERRCODE = '42501';
  END IF;

  -- Original logic — unchanged below this line

  -- day of week for selected date
  v_dow := extract(dow from p_date);

  -- Greek weekday label
  v_weekday_label := case v_dow
    when 0 then 'Κυριακής'
    when 1 then 'Δευτέρας'
    when 2 then 'Τρίτης'
    when 3 then 'Τετάρτης'
    when 4 then 'Πέμπτης'
    when 5 then 'Παρασκευής'
    when 6 then 'Σαββάτου'
    else 'Ημέρας'
  end;

  -- TODAY INCOME
  select coalesce(sum(abs(amount)), 0)
  into v_income_today
  from public.transactions
  where store_id = p_store_id
    and date = p_date
    and type in ('income', 'income_collection', 'debt_received', 'savings_withdrawal')
    and coalesce(is_credit, false) = false;

  -- TODAY EXPENSE
  select coalesce(sum(abs(amount)), 0)
  into v_expense_today
  from public.transactions
  where store_id = p_store_id
    and date = p_date
    and type not in ('income', 'income_collection', 'debt_received', 'savings_withdrawal')
    and coalesce(is_credit, false) = false;

  -- AVERAGE INCOME OF SAME WEEKDAY (last 8 matching weekdays before selected date)
  with same_days as (
    select date
    from public.transactions
    where store_id = p_store_id
      and date < p_date
      and extract(dow from date) = v_dow
    group by date
    order by date desc
    limit 8
  ),
  income_per_day as (
    select
      t.date,
      coalesce(sum(abs(t.amount)), 0) as total_income
    from public.transactions t
    inner join same_days d on d.date = t.date
    where t.store_id = p_store_id
      and t.type in ('income', 'income_collection', 'debt_received', 'savings_withdrawal')
      and coalesce(t.is_credit, false) = false
    group by t.date
  )
  select coalesce(avg(total_income), 0)
  into v_income_avg
  from income_per_day;

  -- AVERAGE EXPENSE OF SAME WEEKDAY (last 8 matching weekdays before selected date)
  with same_days as (
    select date
    from public.transactions
    where store_id = p_store_id
      and date < p_date
      and extract(dow from date) = v_dow
    group by date
    order by date desc
    limit 8
  ),
  expense_per_day as (
    select
      t.date,
      coalesce(sum(abs(t.amount)), 0) as total_expense
    from public.transactions t
    inner join same_days d on d.date = t.date
    where t.store_id = p_store_id
      and t.type not in ('income', 'income_collection', 'debt_received', 'savings_withdrawal')
      and coalesce(t.is_credit, false) = false
    group by t.date
  )
  select coalesce(avg(total_expense), 0)
  into v_expense_avg
  from expense_per_day;

  -- DIFF %
  if v_income_avg > 0 then
    v_income_diff_pct := round(((v_income_today - v_income_avg) / v_income_avg) * 100, 1);
  else
    v_income_diff_pct := 0;
  end if;

  if v_expense_avg > 0 then
    v_expense_diff_pct := round(((v_expense_today - v_expense_avg) / v_expense_avg) * 100, 1);
  else
    v_expense_diff_pct := 0;
  end if;

  return json_build_object(
    'income_today',      v_income_today,
    'income_avg',        v_income_avg,
    'expense_today',     v_expense_today,
    'expense_avg',       v_expense_avg,
    'weekday_label',     v_weekday_label,
    'income_diff_pct',   v_income_diff_pct,
    'expense_diff_pct',  v_expense_diff_pct
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_daily_performance_tracker(uuid, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_daily_performance_tracker(uuid, date) TO authenticated;

COMMIT;

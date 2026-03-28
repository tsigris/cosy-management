create or replace function public.get_daily_performance_tracker(
  p_store_id uuid,
  p_date date
)
returns json
language plpgsql
security definer
as $$
declare
  v_dow int;
  v_weekday_label text;
  v_income_today numeric := 0;
  v_expense_today numeric := 0;
  v_income_avg numeric := 0;
  v_expense_avg numeric := 0;
  v_income_diff_pct numeric := 0;
  v_expense_diff_pct numeric := 0;
begin
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
  from transactions
  where store_id = p_store_id
    and date = p_date
    and type in ('income', 'income_collection', 'debt_received', 'savings_withdrawal')
    and coalesce(is_credit, false) = false;

  -- TODAY EXPENSE
  select coalesce(sum(abs(amount)), 0)
  into v_expense_today
  from transactions
  where store_id = p_store_id
    and date = p_date
    and type not in ('income', 'income_collection', 'debt_received', 'savings_withdrawal')
    and coalesce(is_credit, false) = false;

  -- AVERAGE INCOME OF SAME WEEKDAY (last 8 matching weekdays before selected date)
  with same_days as (
    select date
    from transactions
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
    from transactions t
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
    from transactions
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
    from transactions t
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
    'income_today', v_income_today,
    'income_avg', v_income_avg,
    'expense_today', v_expense_today,
    'expense_avg', v_expense_avg,
    'weekday_label', v_weekday_label,
    'income_diff_pct', v_income_diff_pct,
    'expense_diff_pct', v_expense_diff_pct
  );
end;
$$;
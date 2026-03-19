-- Payroll pressure period summary RPC
-- Scope: economics payroll-percent page only

DROP FUNCTION IF EXISTS public.get_staff_payroll_pressure_period_summary(uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_staff_payroll_pressure_period_summary(
  p_store_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  start_date date,
  end_date date,
  days_in_period integer,
  period_turnover numeric,
  total_period_payroll numeric,
  payroll_pct numeric,
  status text,
  rows jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  with period_bounds as (
    select
      least(p_start_date, p_end_date)::date as start_date,
      greatest(p_start_date, p_end_date)::date as end_date
  ),
  period_meta as (
    select
      pb.start_date,
      pb.end_date,
      ((pb.end_date - pb.start_date) + 1)::int as days_in_period
    from period_bounds pb
  ),
  turnover as (
    select
      coalesce(sum(t.amount), 0)::numeric as period_turnover
    from public.transactions t
    cross join period_meta pm
    where t.store_id = p_store_id
      and t.date >= pm.start_date
      and t.date <= pm.end_date
      and t.type = 'income'
      and coalesce(t.is_credit, false) = false
      and lower(coalesce(t.category, '')) not in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
  ),
  staff as (
    select
      fa.id as employee_id,
      coalesce(nullif(trim(fa.name), ''), 'Άγνωστος') as name,
      coalesce(fa.monthly_salary, 0)::numeric as monthly_salary
    from public.fixed_assets fa
    where fa.store_id = p_store_id
      and lower(coalesce(fa.sub_category, '')) = 'staff'
      and coalesce(fa.is_active, true) = true
  ),
  employee_rows as (
    select
      s.employee_id,
      s.name,
      s.monthly_salary,
      25::numeric as insurance_pct,
      coalesce((s.monthly_salary * 0.25), 0)::numeric as insurance_amount,
      coalesce((s.monthly_salary * 1.25), 0)::numeric as total_monthly_cost,
      coalesce(((s.monthly_salary * 1.25) / 30.0), 0)::numeric as daily_cost,
      coalesce((((s.monthly_salary * 1.25) / 30.0) * pm.days_in_period), 0)::numeric as period_cost,
      case
        when tr.period_turnover > 0 then (((((s.monthly_salary * 1.25) / 30.0) * pm.days_in_period) / tr.period_turnover) * 100)::numeric
        else 0::numeric
      end as payroll_pct_of_turnover
    from staff s
    cross join period_meta pm
    cross join turnover tr
  ),
  totals as (
    select
      pm.start_date,
      pm.end_date,
      pm.days_in_period,
      tr.period_turnover,
      coalesce(sum(er.period_cost), 0)::numeric as total_period_payroll
    from period_meta pm
    cross join turnover tr
    left join employee_rows er on true
    group by pm.start_date, pm.end_date, pm.days_in_period, tr.period_turnover
  ),
  rows_json as (
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'employee_id', er.employee_id,
            'name', er.name,
            'monthly_salary', er.monthly_salary,
            'insurance_pct', er.insurance_pct,
            'insurance_amount', er.insurance_amount,
            'total_monthly_cost', er.total_monthly_cost,
            'daily_cost', er.daily_cost,
            'period_cost', er.period_cost,
            'payroll_pct_of_turnover', er.payroll_pct_of_turnover
          )
          order by er.name asc
        ),
        '[]'::jsonb
      ) as rows
    from employee_rows er
  )
  select
    t.start_date,
    t.end_date,
    t.days_in_period,
    t.period_turnover,
    t.total_period_payroll,
    case
      when t.period_turnover > 0 then coalesce((t.total_period_payroll / t.period_turnover) * 100, 0)::numeric
      else 0::numeric
    end as payroll_pct,
    case
      when t.period_turnover = 0 then 'no_turnover'
      when ((t.total_period_payroll / nullif(t.period_turnover, 0)) * 100) <= 25 then 'perfect'
      when ((t.total_period_payroll / nullif(t.period_turnover, 0)) * 100) <= 35 then 'warning'
      else 'danger'
    end as status,
    r.rows
  from totals t
  cross join rows_json r;
$function$;

grant execute on function public.get_staff_payroll_pressure_period_summary(uuid, date, date) to authenticated;

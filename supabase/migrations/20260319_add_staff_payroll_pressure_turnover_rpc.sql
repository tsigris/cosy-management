-- Payroll pressure RPCs with daily_turnover (not Z-only)
-- Scope: only payroll-pressure feature

DROP FUNCTION IF EXISTS public.get_staff_payroll_pressure(uuid, date);
DROP FUNCTION IF EXISTS public.get_staff_payroll_pressure_summary(uuid, date);

CREATE OR REPLACE FUNCTION public.get_staff_payroll_pressure(
  p_store_id uuid,
  p_date date
)
RETURNS TABLE(
  employee_id uuid,
  name text,
  monthly_salary numeric,
  insurance_pct numeric,
  insurance_amount numeric,
  total_monthly_cost numeric,
  daily_cost numeric,
  daily_turnover numeric,
  payroll_pct_of_turnover numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  with turnover as (
    select
      coalesce(sum(t.amount), 0)::numeric as daily_turnover
    from public.transactions t
    where t.store_id = p_store_id
      and t.date = p_date
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
  )
  select
    s.employee_id,
    s.name,
    s.monthly_salary,
    25::numeric as insurance_pct,
    coalesce((s.monthly_salary * 0.25), 0)::numeric as insurance_amount,
    coalesce((s.monthly_salary * 1.25), 0)::numeric as total_monthly_cost,
    coalesce(((s.monthly_salary * 1.25) / 30.0), 0)::numeric as daily_cost,
    coalesce(tr.daily_turnover, 0)::numeric as daily_turnover,
    case
      when tr.daily_turnover > 0 then ((((s.monthly_salary * 1.25) / 30.0) / tr.daily_turnover) * 100)::numeric
      else 0::numeric
    end as payroll_pct_of_turnover
  from staff s
  cross join turnover tr
  order by s.name asc;
$function$;

CREATE OR REPLACE FUNCTION public.get_staff_payroll_pressure_summary(
  p_store_id uuid,
  p_date date
)
RETURNS TABLE(
  date date,
  days_in_month integer,
  daily_turnover numeric,
  total_daily_payroll numeric,
  payroll_pct numeric,
  status text,
  rows jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  with payroll_rows as (
    select *
    from public.get_staff_payroll_pressure(p_store_id, p_date)
  ),
  totals as (
    select
      coalesce(max(pr.daily_turnover), 0)::numeric as daily_turnover,
      coalesce(sum(pr.daily_cost), 0)::numeric as total_daily_payroll
    from payroll_rows pr
  ),
  normalized as (
    select
      p_date as date,
      extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day'))::int as days_in_month,
      t.daily_turnover,
      t.total_daily_payroll,
      case
        when t.daily_turnover > 0 then coalesce((t.total_daily_payroll / t.daily_turnover) * 100, 0)::numeric
        else 0::numeric
      end as payroll_pct,
      case
        when t.daily_turnover = 0 then 'no_turnover'
        when ((t.total_daily_payroll / nullif(t.daily_turnover, 0)) * 100) <= 25 then 'perfect'
        when ((t.total_daily_payroll / nullif(t.daily_turnover, 0)) * 100) <= 35 then 'warning'
        else 'danger'
      end as status
    from totals t
  ),
  rows_json as (
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'employee_id', pr.employee_id,
            'name', pr.name,
            'monthly_salary', pr.monthly_salary,
            'insurance_pct', pr.insurance_pct,
            'insurance_amount', pr.insurance_amount,
            'total_monthly_cost', pr.total_monthly_cost,
            'daily_cost', pr.daily_cost,
            'payroll_pct_of_turnover', pr.payroll_pct_of_turnover
          )
          order by pr.name asc
        ),
        '[]'::jsonb
      ) as rows
    from payroll_rows pr
  )
  select
    n.date,
    n.days_in_month,
    n.daily_turnover,
    n.total_daily_payroll,
    n.payroll_pct,
    n.status,
    r.rows
  from normalized n
  cross join rows_json r;
$function$;

grant execute on function public.get_staff_payroll_pressure(uuid, date) to authenticated;
grant execute on function public.get_staff_payroll_pressure_summary(uuid, date) to authenticated;

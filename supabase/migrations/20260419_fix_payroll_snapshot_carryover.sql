begin;

create or replace function public.get_employee_payroll_snapshot(
  p_store_id uuid,
  p_employee_id uuid,
  p_as_of_date date default current_date
)
returns table (
  employee_id uuid,
  pay_basis text,
  start_date date,

  cycle_start date,
  cycle_end date,

  monthly_salary numeric,
  monthly_days integer,
  agreed_extra_salary numeric,

  daily_cost numeric,
  hourly_cost numeric,

  included_days_off integer,
  actual_days_off integer,
  extra_days_off integer,
  days_off_deduction numeric,

  pending_overtime_hours numeric,
  pending_overtime_amount numeric,

  current_cycle_advances numeric,
  carryover_advances numeric,

  current_cycle_payable numeric,
  carryover_payable numeric,
  total_payable numeric,

  has_current_cycle_payable boolean,
  has_carryover boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_off_date boolean;

  v_employee_id uuid;
  v_pay_basis text;
  v_start_date date;

  v_monthly_salary numeric;
  v_monthly_days integer;
  v_agreed_extra_salary numeric;

  v_cycle_start date;
  v_cycle_end date;

  v_included_days_off integer;
  v_actual_days_off integer;
  v_extra_days_off integer;

  v_daily_cost numeric;
  v_hourly_cost numeric;
  v_days_off_deduction numeric;

  v_pending_overtime_hours numeric;
  v_pending_overtime_amount numeric;

  v_current_cycle_advances numeric;
  v_carryover_advances numeric;

  v_current_cycle_payable numeric;
  v_carryover_payable numeric;
  v_total_payable numeric;
  v_previous_cycles_unpaid numeric;
  v_carryover_payments numeric;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: missing authenticated user';
  end if;

  if not exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = p_store_id
  ) then
    raise exception 'Forbidden: store access required for store %', p_store_id;
  end if;

  select
    fa.id,
    coalesce(fa.pay_basis, 'monthly')::text,
    coalesce(fa.start_date, p_as_of_date)::date,
    coalesce(fa.monthly_salary, 0)::numeric,
    coalesce(fa.monthly_days, 26)::integer,
    coalesce(fa.agreed_extra_salary, 0)::numeric
  into
    v_employee_id,
    v_pay_basis,
    v_start_date,
    v_monthly_salary,
    v_monthly_days,
    v_agreed_extra_salary
  from public.fixed_assets fa
  where fa.sub_category = 'staff'
    and fa.id = p_employee_id
    and (fa.store_id = p_store_id or fa.store_id is null)
  limit 1;

  if v_employee_id is null then
    raise exception 'Employee % not found in store %', p_employee_id, p_store_id;
  end if;

  if v_pay_basis <> 'monthly' then
    raise exception 'Payroll snapshot supports monthly employees only';
  end if;

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'employee_days_off'
      and c.column_name = 'off_date'
  ) into v_has_off_date;

  v_cycle_start := greatest(
    case
      when (
        make_date(extract(year from p_as_of_date)::int, extract(month from p_as_of_date)::int, 1)
        + (
          least(
            extract(day from v_start_date)::int,
            extract(day from ((date_trunc('month', p_as_of_date) + interval '1 month - 1 day')::date))::int
          ) - 1
        ) * interval '1 day'
      )::date <= p_as_of_date
      then (
        make_date(extract(year from p_as_of_date)::int, extract(month from p_as_of_date)::int, 1)
        + (
          least(
            extract(day from v_start_date)::int,
            extract(day from ((date_trunc('month', p_as_of_date) + interval '1 month - 1 day')::date))::int
          ) - 1
        ) * interval '1 day'
      )::date
      else (
        make_date(
          extract(year from (p_as_of_date - interval '1 month'))::int,
          extract(month from (p_as_of_date - interval '1 month'))::int,
          1
        )
        + (
          least(
            extract(day from v_start_date)::int,
            extract(day from ((date_trunc('month', p_as_of_date - interval '1 month') + interval '1 month - 1 day')::date))::int
          ) - 1
        ) * interval '1 day'
      )::date
    end,
    v_start_date
  )::date;

  v_cycle_end := (
    date_trunc('month', v_cycle_start + interval '1 month')
    + (
      least(
        extract(day from v_start_date)::int,
        extract(day from ((date_trunc('month', v_cycle_start + interval '2 month') - interval '1 day')::date))::int
      ) - 1
    ) * interval '1 day'
  )::date - interval '1 day';

  v_included_days_off := case
    when v_monthly_days = 30 then 0
    when v_monthly_days = 26 then 4
    when v_monthly_days = 22 then 8
    else 0
  end;

  v_daily_cost := case
    when v_monthly_days > 0 then ((v_monthly_salary + v_agreed_extra_salary) / v_monthly_days)
    else 0
  end;

  v_hourly_cost := case
    when v_monthly_days > 0 then (v_daily_cost / 8)
    else 0
  end;

  with cycle_months as (
    select
      gs.month_start,
      (
        make_date(extract(year from gs.month_start)::int, extract(month from gs.month_start)::int, 1)
        + (
          least(
            extract(day from v_start_date)::int,
            extract(day from ((date_trunc('month', gs.month_start) + interval '1 month - 1 day')::date))::int
          ) - 1
        ) * interval '1 day'
      )::date as anchor_date
    from generate_series(
      date_trunc('month', v_start_date)::date,
      date_trunc('month', v_cycle_start)::date,
      interval '1 month'
    ) gs(month_start)
  ),
  cycle_windows as (
    select
      greatest(cm.anchor_date, v_start_date)::date as cycle_start,
      (
        date_trunc('month', cm.anchor_date + interval '1 month')
        + (
          least(
            extract(day from v_start_date)::int,
            extract(day from ((date_trunc('month', cm.anchor_date + interval '1 month') + interval '1 month - 1 day')::date))::int
          ) - 1
        ) * interval '1 day'
      )::date - interval '1 day' as cycle_end
    from cycle_months cm
    where cm.anchor_date <= v_cycle_start
  ),
  cycle_stats as (
    select
      cw.cycle_start,
      cw.cycle_end,
      (
        select coalesce(count(*), 0)::integer
        from public.employee_days_off edo
        where edo.store_id = p_store_id
          and edo.employee_id = p_employee_id
          and (
            (v_has_off_date and edo.off_date between cw.cycle_start and cw.cycle_end)
            or (not v_has_off_date and edo.date between cw.cycle_start and cw.cycle_end)
          )
      ) as actual_days_off,
      (
        select coalesce(sum(coalesce(ot.hours, 0)), 0)::numeric
        from public.employee_overtimes ot
        where ot.store_id = p_store_id
          and ot.employee_id = p_employee_id
          and coalesce(ot.is_paid, false) = false
          and ot.voided_at is null
          and ot.date between cw.cycle_start and cw.cycle_end
      ) as pending_overtime_hours,
      (
        select coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric
        from public.transactions t
        where t.store_id = p_store_id
          and coalesce(t.employee_id, t.fixed_asset_id) = p_employee_id
          and t.type = 'salary_advance'
          and t.voided_at is null
          and t.date between cw.cycle_start and cw.cycle_end
      ) as cycle_advances,
      (
        select coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric
        from public.transactions t
        where t.store_id = p_store_id
          and coalesce(t.employee_id, t.fixed_asset_id) = p_employee_id
          and t.type = 'expense'
          and t.category = 'Staff'
          and t.source_context = 'payroll_settlement'
          and t.voided_at is null
          and t.payroll_cycle_start = cw.cycle_start
          and t.payroll_cycle_end = cw.cycle_end
      ) as cycle_payments
    from cycle_windows cw
  ),
  cycle_payables as (
    select
      cs.cycle_start,
      cs.cycle_end,
      cs.actual_days_off,
      cs.pending_overtime_hours,
      cs.cycle_advances,
      cs.cycle_payments,
      (cs.pending_overtime_hours * v_hourly_cost) as pending_overtime_amount,
      (greatest(cs.actual_days_off - v_included_days_off, 0) * v_daily_cost) as days_off_deduction,
      (
        v_monthly_salary
        + v_agreed_extra_salary
        + (cs.pending_overtime_hours * v_hourly_cost)
        - (greatest(cs.actual_days_off - v_included_days_off, 0) * v_daily_cost)
      ) as expected_amount,
      greatest(
        (
          v_monthly_salary
          + v_agreed_extra_salary
          + (cs.pending_overtime_hours * v_hourly_cost)
          - (greatest(cs.actual_days_off - v_included_days_off, 0) * v_daily_cost)
        )
        - cs.cycle_advances
        - cs.cycle_payments,
        0
      ) as unpaid_amount
    from cycle_stats cs
  )
  select
    coalesce(max(case when cp.cycle_start = v_cycle_start then cp.actual_days_off end), 0),
    coalesce(max(case when cp.cycle_start = v_cycle_start then cp.pending_overtime_hours end), 0),
    coalesce(max(case when cp.cycle_start = v_cycle_start then (cp.pending_overtime_hours * v_hourly_cost) end), 0),
    coalesce(max(case when cp.cycle_start = v_cycle_start then cp.cycle_advances end), 0),
    coalesce(max(case when cp.cycle_start = v_cycle_start then cp.unpaid_amount end), 0),
    coalesce(sum(case when cp.cycle_end < v_cycle_start then cp.unpaid_amount end), 0)
  into
    v_actual_days_off,
    v_pending_overtime_hours,
    v_pending_overtime_amount,
    v_current_cycle_advances,
    v_current_cycle_payable,
    v_previous_cycles_unpaid
  from cycle_payables cp;

  select coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric
  into v_carryover_payments
  from public.transactions t
  where t.store_id = p_store_id
    and coalesce(t.employee_id, t.fixed_asset_id) = p_employee_id
    and t.type = 'expense'
    and t.category = 'Staff'
    and t.source_context = 'payroll_carryover'
    and t.voided_at is null;

  v_carryover_payable := greatest(
    coalesce(v_previous_cycles_unpaid, 0) - coalesce(v_carryover_payments, 0),
    0
  );

  v_extra_days_off := greatest(coalesce(v_actual_days_off, 0) - v_included_days_off, 0);
  v_days_off_deduction := v_extra_days_off * v_daily_cost;

  select coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric
  into v_carryover_advances
  from public.transactions t
  where t.store_id = p_store_id
    and coalesce(t.employee_id, t.fixed_asset_id) = p_employee_id
    and t.type = 'salary_advance'
    and t.voided_at is null
    and t.date < v_cycle_start;

  v_total_payable := coalesce(v_current_cycle_payable, 0) + coalesce(v_carryover_payable, 0);

  return query
  select
    v_employee_id,
    v_pay_basis,
    v_start_date,

    v_cycle_start,
    v_cycle_end,

    v_monthly_salary,
    v_monthly_days,
    v_agreed_extra_salary,

    v_daily_cost,
    v_hourly_cost,

    v_included_days_off,
    v_actual_days_off,
    v_extra_days_off,
    v_days_off_deduction,

    v_pending_overtime_hours,
    v_pending_overtime_amount,

    v_current_cycle_advances,
    v_carryover_advances,

    v_current_cycle_payable,
    v_carryover_payable,
    v_total_payable,

    (coalesce(v_current_cycle_payable, 0) > 0) as has_current_cycle_payable,
    (coalesce(v_carryover_payable, 0) > 0) as has_carryover;
end;
$$;

grant execute on function public.get_employee_payroll_snapshot(uuid, uuid, date) to authenticated;

with target as (
  select
    t.id,
    t.date as tx_date,
    fa.start_date
  from public.transactions t
  join public.fixed_assets fa
    on fa.id = coalesce(t.employee_id, t.fixed_asset_id)
  where t.type = 'expense'
    and t.category = 'Staff'
    and t.source_context in ('payroll_settlement', 'payroll_carryover')
    and t.voided_at is null
    and (t.payroll_cycle_start is null or t.payroll_cycle_end is null)
    and coalesce(fa.pay_basis, 'monthly') = 'monthly'
),
calc as (
  select
    id,
    greatest(
      case
        when anchor_date <= tx_date then anchor_date
        else prev_anchor_date
      end,
      start_date
    )::date as cycle_start,
    (
      date_trunc('month', greatest(
        case
          when anchor_date <= tx_date then anchor_date
          else prev_anchor_date
        end,
        start_date
      ) + interval '1 month')
      + (
        least(
          extract(day from start_date)::int,
          extract(day from ((date_trunc('month', greatest(
            case
              when anchor_date <= tx_date then anchor_date
              else prev_anchor_date
            end,
            start_date
          ) + interval '2 month') - interval '1 day')::date))::int
        ) - 1
      ) * interval '1 day'
    )::date - interval '1 day' as cycle_end
  from (
    select
      id,
      tx_date,
      start_date,
      (
        make_date(extract(year from tx_date)::int, extract(month from tx_date)::int, 1)
        + (
          least(
            extract(day from start_date)::int,
            extract(day from ((date_trunc('month', tx_date) + interval '1 month - 1 day')::date))::int
          ) - 1
        ) * interval '1 day'
      )::date as anchor_date,
      (
        make_date(
          extract(year from (tx_date - interval '1 month'))::int,
          extract(month from (tx_date - interval '1 month'))::int,
          1
        )
        + (
          least(
            extract(day from start_date)::int,
            extract(day from ((date_trunc('month', tx_date - interval '1 month') + interval '1 month - 1 day')::date))::int
          ) - 1
        ) * interval '1 day'
      )::date as prev_anchor_date
    from target
  ) s
)
update public.transactions t
set
  payroll_cycle_start = calc.cycle_start,
  payroll_cycle_end = calc.cycle_end
from calc
where t.id = calc.id;

commit;
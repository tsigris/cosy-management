begin;

drop function if exists public.settle_employee_payroll_period_atomic(uuid, uuid, date, text, text);

create or replace function public.settle_employee_payroll_period_atomic(
  p_store_id uuid,
  p_employee_id uuid,
  p_settlement_date date default current_date,
  p_method text default 'Μετρητά',
  p_notes text default null
)
returns table (
  settlement_id uuid,
  period_start date,
  period_end date,
  final_payable numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_off_date boolean;
  v_pay_basis text;
  v_monthly_salary numeric;
  v_agreed_extra_salary numeric;
  v_monthly_days integer;
  v_daily_rate numeric;
  v_start_date date;
  v_last_settlement date;
  v_anchor_day integer;

  v_period_start date;
  v_period_end date;

  v_days_in_period integer;
  v_actual_days_off integer;
  v_included_days_off integer;
  v_included_days_off_for_period integer;
  v_extra_days_off integer;

  v_daily_cost numeric;
  v_hourly_cost numeric;
  v_base_period_amount numeric;
  v_days_off_deduction numeric;

  v_total_advances numeric;
  v_pending_overtime_hours numeric;
  v_pending_overtime_amount numeric;

  v_final_payable numeric;
  v_settlement_id uuid;
  v_notes text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: missing authenticated user';
  end if;

  if not exists (
    select 1
    from public.store_access sa
    where sa.store_id = p_store_id
      and sa.user_id = auth.uid()
      and sa.role = 'admin'
  ) then
    raise exception 'Forbidden: admin role required for payroll settlement';
  end if;

  select
    coalesce(fa.pay_basis, 'monthly'),
    coalesce(fa.monthly_salary, 0),
    coalesce(fa.agreed_extra_salary, 0),
    coalesce(fa.monthly_days, 0),
    coalesce(fa.daily_rate, 0),
    coalesce(fa.start_date, p_settlement_date),
    fa.last_payroll_settlement_date,
    coalesce(fa.payroll_anchor_day, 1)
  into
    v_pay_basis,
    v_monthly_salary,
    v_agreed_extra_salary,
    v_monthly_days,
    v_daily_rate,
    v_start_date,
    v_last_settlement,
    v_anchor_day
  from public.fixed_assets fa
  where fa.id = p_employee_id
    and fa.sub_category = 'staff'
    and (fa.store_id = p_store_id or fa.store_id is null)
  for update;

  if not found then
    raise exception 'Employee % not found in store %', p_employee_id, p_store_id;
  end if;

  if v_last_settlement is not null then
    v_period_start := (v_last_settlement + interval '1 day')::date;
  else
    v_period_start := v_start_date;
  end if;

  v_period_end := p_settlement_date;

  if v_period_end < v_period_start then
    raise exception 'Invalid settlement period: end date % is before start date %', v_period_end, v_period_start;
  end if;

  v_days_in_period := greatest((v_period_end - v_period_start + 1), 0);

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'employee_days_off'
      and c.column_name = 'off_date'
  ) into v_has_off_date;

  if v_has_off_date then
    select coalesce(count(*), 0)::integer
    into v_actual_days_off
    from public.employee_days_off edo
    where edo.store_id = p_store_id
      and edo.employee_id = p_employee_id
      and edo.off_date >= v_period_start
      and edo.off_date <= v_period_end;
  else
    select coalesce(count(*), 0)::integer
    into v_actual_days_off
    from public.employee_days_off edo
    where edo.store_id = p_store_id
      and edo.employee_id = p_employee_id
      and edo.date >= v_period_start
      and edo.date <= v_period_end;
  end if;

  if v_pay_basis = 'monthly' then
    v_included_days_off := case
      when v_monthly_days = 30 then 0
      when v_monthly_days = 26 then 4
      when v_monthly_days = 22 then 8
      else 0
    end;

    if v_monthly_days > 0 then
      v_included_days_off_for_period := floor((v_included_days_off::numeric * least(v_days_in_period, v_monthly_days)::numeric) / v_monthly_days::numeric);
      v_daily_cost := (v_monthly_salary + v_agreed_extra_salary) / v_monthly_days;
      v_hourly_cost := v_daily_cost / 8;
      v_base_period_amount := v_daily_cost * v_days_in_period;
    else
      v_included_days_off_for_period := 0;
      v_daily_cost := 0;
      v_hourly_cost := 0;
      v_base_period_amount := 0;
    end if;

    v_extra_days_off := greatest(v_actual_days_off - v_included_days_off_for_period, 0);
    v_days_off_deduction := v_extra_days_off * v_daily_cost;
  else
    v_included_days_off := 0;
    v_included_days_off_for_period := 0;
    v_extra_days_off := 0;
    v_daily_cost := greatest(v_daily_rate, 0);
    v_hourly_cost := v_daily_cost / 8;
    v_base_period_amount := v_daily_cost * greatest(v_days_in_period - v_actual_days_off, 0);
    v_days_off_deduction := 0;
  end if;

  select coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric
  into v_total_advances
  from public.transactions t
  where t.store_id = p_store_id
    and coalesce(t.employee_id, t.fixed_asset_id) = p_employee_id
    and t.type = 'salary_advance'
    and coalesce(t.is_settled, false) = false
    and t.date >= v_period_start
    and t.date <= v_period_end;

  select coalesce(sum(coalesce(ot.hours, 0)), 0)::numeric
  into v_pending_overtime_hours
  from public.employee_overtimes ot
  where ot.store_id = p_store_id
    and ot.employee_id = p_employee_id
    and coalesce(ot.is_paid, false) = false
    and ot.date >= v_period_start
    and ot.date <= v_period_end;

  v_pending_overtime_amount := coalesce(v_pending_overtime_hours, 0) * coalesce(v_hourly_cost, 0);

  v_final_payable := greatest(
    coalesce(v_base_period_amount, 0)
    - coalesce(v_total_advances, 0)
    + coalesce(v_pending_overtime_amount, 0)
    - coalesce(v_days_off_deduction, 0),
    0
  );

  v_notes := coalesce(
    nullif(trim(coalesce(p_notes, '')), ''),
    format(
      'ΕΞΟΦΛΗΣΗ ΜΙΣΘΟΔΟΣΙΑΣ [%s - %s] | Βασικός: %s | Extra: %s | Προκαταβολές: %s | Υπερωρίες: %s | Ρεπό: -%s',
      to_char(v_period_start, 'DD/MM/YYYY'),
      to_char(v_period_end, 'DD/MM/YYYY'),
      to_char(v_monthly_salary, 'FM999999990.00'),
      to_char(v_agreed_extra_salary, 'FM999999990.00'),
      to_char(v_total_advances, 'FM999999990.00'),
      to_char(v_pending_overtime_amount, 'FM999999990.00'),
      to_char(v_days_off_deduction, 'FM999999990.00')
    )
  );

  insert into public.employee_payroll_settlements (
    store_id,
    employee_id,
    period_start,
    period_end,
    settlement_date,
    amount,
    notes
  ) values (
    p_store_id,
    p_employee_id,
    v_period_start,
    v_period_end,
    p_settlement_date,
    v_final_payable,
    v_notes
  )
  returning id into v_settlement_id;

  if v_final_payable > 0 then
    insert into public.transactions (
      store_id,
      employee_id,
      fixed_asset_id,
      amount,
      type,
      category,
      method,
      date,
      notes
    ) values (
      p_store_id,
      p_employee_id,
      p_employee_id,
      -abs(v_final_payable),
      'expense',
      'Staff',
      coalesce(nullif(trim(coalesce(p_method, '')), ''), 'Μετρητά'),
      p_settlement_date,
      v_notes
    );
  end if;

  update public.transactions t
  set is_settled = true
  where t.store_id = p_store_id
    and coalesce(t.employee_id, t.fixed_asset_id) = p_employee_id
    and t.type = 'salary_advance'
    and coalesce(t.is_settled, false) = false
    and t.date >= v_period_start
    and t.date <= v_period_end;

  update public.employee_overtimes ot
  set is_paid = true
  where ot.store_id = p_store_id
    and ot.employee_id = p_employee_id
    and coalesce(ot.is_paid, false) = false
    and ot.date >= v_period_start
    and ot.date <= v_period_end;

  update public.fixed_assets fa
  set
    last_payroll_settlement_date = v_period_end,
    payroll_anchor_day = coalesce(fa.payroll_anchor_day, greatest(least(v_anchor_day, 31), 1))
  where fa.id = p_employee_id;

  return query
  select
    v_settlement_id,
    v_period_start,
    v_period_end,
    v_final_payable;
end;
$$;

grant execute on function public.settle_employee_payroll_period_atomic(uuid, uuid, date, text, text) to authenticated;

commit;

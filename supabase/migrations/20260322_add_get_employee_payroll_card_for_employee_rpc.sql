begin;

create or replace function public.get_employee_payroll_card_for_employee(
  p_store_id uuid,
  p_employee_id uuid,
  p_as_of_date date default current_date
)
returns table (
  employee_id uuid,
  monthly_salary numeric,
  monthly_days integer,
  included_days_off integer,
  actual_days_off_current_month integer,
  extra_days_off_current_month integer,
  daily_cost numeric,
  hourly_cost numeric,
  total_advances numeric,
  pending_overtime_hours numeric,
  pending_overtime_amount numeric,
  days_off_deduction numeric,
  remaining_pay numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date;
  v_month_end date;
  v_has_off_date boolean;
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

  v_month_start := date_trunc('month', p_as_of_date)::date;
  v_month_end := (v_month_start + interval '1 month')::date;

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'employee_days_off'
      and c.column_name = 'off_date'
  ) into v_has_off_date;

  if v_has_off_date then
    return query
    with base_employee as (
      select
        fa.id as employee_id,
        coalesce(fa.monthly_salary, fa.salary, 0)::numeric as monthly_salary,
        coalesce(fa.work_days_per_month, fa.monthly_days, 0)::integer as monthly_days
      from public.fixed_assets fa
      where fa.sub_category = 'staff'
        and fa.id = p_employee_id
        and (fa.store_id = p_store_id or fa.store_id is null)
        and coalesce(fa.pay_basis, 'monthly') = 'monthly'
      limit 1
    ),
    days_off_counts as (
      select
        edo.employee_id,
        count(*)::integer as actual_days_off_current_month
      from public.employee_days_off edo
      where edo.store_id = p_store_id
        and edo.employee_id = p_employee_id
        and edo.off_date >= v_month_start
        and edo.off_date < v_month_end
      group by edo.employee_id
    ),
    advances as (
      select
        coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric as total_advances
      from public.transactions t
      where t.store_id = p_store_id
        and t.type = 'salary_advance'
        and coalesce(t.employee_id, t.fixed_asset_id) = p_employee_id
    ),
    overtime_pending as (
      select
        coalesce(sum(coalesce(ot.hours, 0)), 0)::numeric as pending_overtime_hours
      from public.employee_overtimes ot
      where ot.store_id = p_store_id
        and ot.employee_id = p_employee_id
        and coalesce(ot.is_paid, false) = false
    )
    select
      b.employee_id,
      b.monthly_salary,
      b.monthly_days,
      case
        when b.monthly_days = 30 then 0
        when b.monthly_days = 26 then 4
        when b.monthly_days = 22 then 8
        else 0
      end::integer as included_days_off,
      coalesce(d.actual_days_off_current_month, 0)::integer as actual_days_off_current_month,
      greatest(
        coalesce(d.actual_days_off_current_month, 0) -
        case
          when b.monthly_days = 30 then 0
          when b.monthly_days = 26 then 4
          when b.monthly_days = 22 then 8
          else 0
        end,
        0
      )::integer as extra_days_off_current_month,
      case when b.monthly_days > 0 then (b.monthly_salary / b.monthly_days) else 0 end::numeric as daily_cost,
      case when b.monthly_days > 0 then (b.monthly_salary / b.monthly_days) / 8 else 0 end::numeric as hourly_cost,
      coalesce(a.total_advances, 0)::numeric as total_advances,
      coalesce(o.pending_overtime_hours, 0)::numeric as pending_overtime_hours,
      (
        coalesce(o.pending_overtime_hours, 0)
        * (case when b.monthly_days > 0 then (b.monthly_salary / b.monthly_days) / 8 else 0 end)
      )::numeric as pending_overtime_amount,
      (
        greatest(
          coalesce(d.actual_days_off_current_month, 0) -
          case
            when b.monthly_days = 30 then 0
            when b.monthly_days = 26 then 4
            when b.monthly_days = 22 then 8
            else 0
          end,
          0
        )
        * (case when b.monthly_days > 0 then (b.monthly_salary / b.monthly_days) else 0 end)
      )::numeric as days_off_deduction,
      (
        b.monthly_salary
        - coalesce(a.total_advances, 0)
        + (
            coalesce(o.pending_overtime_hours, 0)
            * (case when b.monthly_days > 0 then (b.monthly_salary / b.monthly_days) / 8 else 0 end)
          )
        - (
            greatest(
              coalesce(d.actual_days_off_current_month, 0) -
              case
                when b.monthly_days = 30 then 0
                when b.monthly_days = 26 then 4
                when b.monthly_days = 22 then 8
                else 0
              end,
              0
            )
            * (case when b.monthly_days > 0 then (b.monthly_salary / b.monthly_days) else 0 end)
          )
      )::numeric as remaining_pay
    from base_employee b
    left join days_off_counts d
      on d.employee_id = b.employee_id
    cross join advances a
    cross join overtime_pending o;
  else
    return query
    with base_employee as (
      select
        fa.id as employee_id,
        coalesce(fa.monthly_salary, fa.salary, 0)::numeric as monthly_salary,
        coalesce(fa.work_days_per_month, fa.monthly_days, 0)::integer as monthly_days
      from public.fixed_assets fa
      where fa.sub_category = 'staff'
        and fa.id = p_employee_id
        and (fa.store_id = p_store_id or fa.store_id is null)
        and coalesce(fa.pay_basis, 'monthly') = 'monthly'
      limit 1
    ),
    days_off_counts as (
      select
        edo.employee_id,
        count(*)::integer as actual_days_off_current_month
      from public.employee_days_off edo
      where edo.store_id = p_store_id
        and edo.employee_id = p_employee_id
        and edo.date >= v_month_start
        and edo.date < v_month_end
      group by edo.employee_id
    ),
    advances as (
      select
        coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric as total_advances
      from public.transactions t
      where t.store_id = p_store_id
        and t.type = 'salary_advance'
        and coalesce(t.employee_id, t.fixed_asset_id) = p_employee_id
    ),
    overtime_pending as (
      select
        coalesce(sum(coalesce(ot.hours, 0)), 0)::numeric as pending_overtime_hours
      from public.employee_overtimes ot
      where ot.store_id = p_store_id
        and ot.employee_id = p_employee_id
        and coalesce(ot.is_paid, false) = false
    )
    select
      b.employee_id,
      b.monthly_salary,
      b.monthly_days,
      case
        when b.monthly_days = 30 then 0
        when b.monthly_days = 26 then 4
        when b.monthly_days = 22 then 8
        else 0
      end::integer as included_days_off,
      coalesce(d.actual_days_off_current_month, 0)::integer as actual_days_off_current_month,
      greatest(
        coalesce(d.actual_days_off_current_month, 0) -
        case
          when b.monthly_days = 30 then 0
          when b.monthly_days = 26 then 4
          when b.monthly_days = 22 then 8
          else 0
        end,
        0
      )::integer as extra_days_off_current_month,
      case when b.monthly_days > 0 then (b.monthly_salary / b.monthly_days) else 0 end::numeric as daily_cost,
      case when b.monthly_days > 0 then (b.monthly_salary / b.monthly_days) / 8 else 0 end::numeric as hourly_cost,
      coalesce(a.total_advances, 0)::numeric as total_advances,
      coalesce(o.pending_overtime_hours, 0)::numeric as pending_overtime_hours,
      (
        coalesce(o.pending_overtime_hours, 0)
        * (case when b.monthly_days > 0 then (b.monthly_salary / b.monthly_days) / 8 else 0 end)
      )::numeric as pending_overtime_amount,
      (
        greatest(
          coalesce(d.actual_days_off_current_month, 0) -
          case
            when b.monthly_days = 30 then 0
            when b.monthly_days = 26 then 4
            when b.monthly_days = 22 then 8
            else 0
          end,
          0
        )
        * (case when b.monthly_days > 0 then (b.monthly_salary / b.monthly_days) else 0 end)
      )::numeric as days_off_deduction,
      (
        b.monthly_salary
        - coalesce(a.total_advances, 0)
        + (
            coalesce(o.pending_overtime_hours, 0)
            * (case when b.monthly_days > 0 then (b.monthly_salary / b.monthly_days) / 8 else 0 end)
          )
        - (
            greatest(
              coalesce(d.actual_days_off_current_month, 0) -
              case
                when b.monthly_days = 30 then 0
                when b.monthly_days = 26 then 4
                when b.monthly_days = 22 then 8
                else 0
              end,
              0
            )
            * (case when b.monthly_days > 0 then (b.monthly_salary / b.monthly_days) else 0 end)
          )
      )::numeric as remaining_pay
    from base_employee b
    left join days_off_counts d
      on d.employee_id = b.employee_id
    cross join advances a
    cross join overtime_pending o;
  end if;
end;
$$;

grant execute on function public.get_employee_payroll_card_for_employee(uuid, uuid, date) to authenticated;

commit;

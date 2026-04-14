begin;

drop function if exists public.get_employee_payroll_cards_summary(uuid, date);

drop function if exists public.get_employee_payroll_card_for_employee(uuid, uuid, date);

drop function if exists public.settle_employee_payroll_carryover_atomic(uuid, uuid, date, text, text);

create or replace function public.get_employee_payroll_cards_summary(
  p_store_id uuid,
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
  carryover_advances numeric,
  pending_overtime_hours numeric,
  pending_overtime_amount numeric,
  days_off_deduction numeric,
  agreed_extra_salary numeric,
  remaining_payroll_only numeric,
  final_payable numeric,
  remaining_pay numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
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

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'employee_days_off'
      and c.column_name = 'off_date'
  ) into v_has_off_date;

  if v_has_off_date then
    return query
    with base_employees as (
      select
        fa.id as employee_id,
        coalesce(fa.monthly_salary, 0)::numeric as monthly_salary,
        coalesce(fa.monthly_days, 0)::integer as monthly_days,
        coalesce(fa.agreed_extra_salary, 0)::numeric as agreed_extra_salary,
        coalesce(fa.start_date, p_as_of_date)::date as start_date
      from public.fixed_assets fa
      where fa.sub_category = 'staff'
        and (fa.store_id = p_store_id or fa.store_id is null)
        and coalesce(fa.pay_basis, 'monthly') = 'monthly'
    ),
    employee_cycles as (
      select
        b.*,
        greatest(
          case
            when as_of_anchor <= p_as_of_date then as_of_anchor
            else prev_anchor
          end,
          b.start_date
        )::date as cycle_start,
        (
          date_trunc(
            'month',
            greatest(
              case
                when as_of_anchor <= p_as_of_date then as_of_anchor
                else prev_anchor
              end,
              b.start_date
            ) + interval '1 month'
          )
          +
          (
            least(
              extract(day from b.start_date)::int,
              extract(day from (
                date_trunc(
                  'month',
                  greatest(
                    case
                      when as_of_anchor <= p_as_of_date then as_of_anchor
                      else prev_anchor
                    end,
                    b.start_date
                  ) + interval '2 month'
                ) - interval '1 day'
              ))::int
            ) - 1
          ) * interval '1 day'
        )::date as cycle_next_start
      from (
        select
          b.*,
          (
            make_date(extract(year from p_as_of_date)::int, extract(month from p_as_of_date)::int, 1)
            + (
              least(
                extract(day from b.start_date)::int,
                extract(day from ((date_trunc('month', p_as_of_date) + interval '1 month - 1 day')::date))::int
              ) - 1
            ) * interval '1 day'
          )::date as as_of_anchor,
          (
            make_date(
              extract(year from (p_as_of_date - interval '1 month'))::int,
              extract(month from (p_as_of_date - interval '1 month'))::int,
              1
            )
            + (
              least(
                extract(day from b.start_date)::int,
                extract(day from ((date_trunc('month', p_as_of_date - interval '1 month') + interval '1 month - 1 day')::date))::int
              ) - 1
            ) * interval '1 day'
          )::date as prev_anchor
        from base_employees b
      ) b
    ),
    cycle_windows as (
      select
        c.employee_id,
        c.monthly_salary,
        c.monthly_days,
        c.agreed_extra_salary,
        c.cycle_start,
        (c.cycle_next_start - interval '1 day')::date as cycle_end
      from employee_cycles c
    ),
    days_off_counts as (
      select
        edo.employee_id,
        count(*)::integer as actual_days_off_in_cycle
      from public.employee_days_off edo
      join cycle_windows cw on cw.employee_id = edo.employee_id
      where edo.store_id = p_store_id
        and edo.off_date >= cw.cycle_start
        and edo.off_date <= cw.cycle_end
      group by edo.employee_id
    ),
    advances as (
      select
        coalesce(t.employee_id, t.fixed_asset_id) as employee_id,
        coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric as total_advances
      from public.transactions t
      join cycle_windows cw on cw.employee_id = coalesce(t.employee_id, t.fixed_asset_id)
      where t.store_id = p_store_id
        and t.type = 'salary_advance'
        and coalesce(t.is_settled, false) = false
        and t.date >= cw.cycle_start
        and t.date <= cw.cycle_end
      group by coalesce(t.employee_id, t.fixed_asset_id)
    ),
    carryover_advances as (
      select
        coalesce(t.employee_id, t.fixed_asset_id) as employee_id,
        coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric as carryover_advances
      from public.transactions t
      join cycle_windows cw on cw.employee_id = coalesce(t.employee_id, t.fixed_asset_id)
      where t.store_id = p_store_id
        and t.type = 'salary_advance'
        and coalesce(t.is_settled, false) = false
        and t.date < cw.cycle_start
      group by coalesce(t.employee_id, t.fixed_asset_id)
    ),
    overtime_pending as (
      select
        ot.employee_id,
        coalesce(sum(coalesce(ot.hours, 0)), 0)::numeric as pending_overtime_hours
      from public.employee_overtimes ot
      where ot.store_id = p_store_id
        and coalesce(ot.is_paid, false) = false
      group by ot.employee_id
    )
    select
      cw.employee_id,
      cw.monthly_salary,
      cw.monthly_days,
      case
        when cw.monthly_days = 30 then 0
        when cw.monthly_days = 26 then 4
        when cw.monthly_days = 22 then 8
        else 0
      end::integer as included_days_off,
      coalesce(d.actual_days_off_in_cycle, 0)::integer as actual_days_off_current_month,
      greatest(
        coalesce(d.actual_days_off_in_cycle, 0) -
        case
          when cw.monthly_days = 30 then 0
          when cw.monthly_days = 26 then 4
          when cw.monthly_days = 22 then 8
          else 0
        end,
        0
      )::integer as extra_days_off_current_month,
      case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end::numeric as daily_cost,
      case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end::numeric as hourly_cost,
      coalesce(a.total_advances, 0)::numeric as total_advances,
      coalesce(ca.carryover_advances, 0)::numeric as carryover_advances,
      coalesce(o.pending_overtime_hours, 0)::numeric as pending_overtime_hours,
      (
        coalesce(o.pending_overtime_hours, 0)
        * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
      )::numeric as pending_overtime_amount,
      (
        greatest(
          coalesce(d.actual_days_off_in_cycle, 0) -
          case
            when cw.monthly_days = 30 then 0
            when cw.monthly_days = 26 then 4
            when cw.monthly_days = 22 then 8
            else 0
          end,
          0
        )
        * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
      )::numeric as days_off_deduction,
      cw.agreed_extra_salary,
      (
        cw.monthly_salary
        - coalesce(a.total_advances, 0)
        + (
            coalesce(o.pending_overtime_hours, 0)
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
          )
        - (
            greatest(
              coalesce(d.actual_days_off_in_cycle, 0) -
              case
                when cw.monthly_days = 30 then 0
                when cw.monthly_days = 26 then 4
                when cw.monthly_days = 22 then 8
                else 0
              end,
              0
            )
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
          )
      )::numeric as remaining_payroll_only,
      (
        (
          cw.monthly_salary
          - coalesce(a.total_advances, 0)
          + (
              coalesce(o.pending_overtime_hours, 0)
              * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
            )
          - (
              greatest(
                coalesce(d.actual_days_off_in_cycle, 0) -
                case
                  when cw.monthly_days = 30 then 0
                  when cw.monthly_days = 26 then 4
                  when cw.monthly_days = 22 then 8
                  else 0
                end,
                0
              )
              * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
            )
        )
        + cw.agreed_extra_salary
      )::numeric as final_payable,
      (
        cw.monthly_salary
        - coalesce(a.total_advances, 0)
        + (
            coalesce(o.pending_overtime_hours, 0)
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
          )
        - (
            greatest(
              coalesce(d.actual_days_off_in_cycle, 0) -
              case
                when cw.monthly_days = 30 then 0
                when cw.monthly_days = 26 then 4
                when cw.monthly_days = 22 then 8
                else 0
              end,
              0
            )
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
          )
      )::numeric as remaining_pay
    from cycle_windows cw
    left join days_off_counts d on d.employee_id = cw.employee_id
    left join advances a on a.employee_id = cw.employee_id
    left join carryover_advances ca on ca.employee_id = cw.employee_id
    left join overtime_pending o on o.employee_id = cw.employee_id
    order by cw.employee_id;
  else
    return query
    with base_employees as (
      select
        fa.id as employee_id,
        coalesce(fa.monthly_salary, 0)::numeric as monthly_salary,
        coalesce(fa.monthly_days, 0)::integer as monthly_days,
        coalesce(fa.agreed_extra_salary, 0)::numeric as agreed_extra_salary,
        coalesce(fa.start_date, p_as_of_date)::date as start_date
      from public.fixed_assets fa
      where fa.sub_category = 'staff'
        and (fa.store_id = p_store_id or fa.store_id is null)
        and coalesce(fa.pay_basis, 'monthly') = 'monthly'
    ),
    employee_cycles as (
      select
        b.*,
        greatest(
          case
            when as_of_anchor <= p_as_of_date then as_of_anchor
            else prev_anchor
          end,
          b.start_date
        )::date as cycle_start,
        (
          date_trunc(
            'month',
            greatest(
              case
                when as_of_anchor <= p_as_of_date then as_of_anchor
                else prev_anchor
              end,
              b.start_date
            ) + interval '1 month'
          )
          +
          (
            least(
              extract(day from b.start_date)::int,
              extract(day from (
                date_trunc(
                  'month',
                  greatest(
                    case
                      when as_of_anchor <= p_as_of_date then as_of_anchor
                      else prev_anchor
                    end,
                    b.start_date
                  ) + interval '2 month'
                ) - interval '1 day'
              ))::int
            ) - 1
          ) * interval '1 day'
        )::date as cycle_next_start
      from (
        select
          b.*,
          (
            make_date(extract(year from p_as_of_date)::int, extract(month from p_as_of_date)::int, 1)
            + (
              least(
                extract(day from b.start_date)::int,
                extract(day from ((date_trunc('month', p_as_of_date) + interval '1 month - 1 day')::date))::int
              ) - 1
            ) * interval '1 day'
          )::date as as_of_anchor,
          (
            make_date(
              extract(year from (p_as_of_date - interval '1 month'))::int,
              extract(month from (p_as_of_date - interval '1 month'))::int,
              1
            )
            + (
              least(
                extract(day from b.start_date)::int,
                extract(day from ((date_trunc('month', p_as_of_date - interval '1 month') + interval '1 month - 1 day')::date))::int
              ) - 1
            ) * interval '1 day'
          )::date as prev_anchor
        from base_employees b
      ) b
    ),
    cycle_windows as (
      select
        c.employee_id,
        c.monthly_salary,
        c.monthly_days,
        c.agreed_extra_salary,
        c.cycle_start,
        (c.cycle_next_start - interval '1 day')::date as cycle_end
      from employee_cycles c
    ),
    days_off_counts as (
      select
        edo.employee_id,
        count(*)::integer as actual_days_off_in_cycle
      from public.employee_days_off edo
      join cycle_windows cw on cw.employee_id = edo.employee_id
      where edo.store_id = p_store_id
        and edo.date >= cw.cycle_start
        and edo.date <= cw.cycle_end
      group by edo.employee_id
    ),
    advances as (
      select
        coalesce(t.employee_id, t.fixed_asset_id) as employee_id,
        coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric as total_advances
      from public.transactions t
      join cycle_windows cw on cw.employee_id = coalesce(t.employee_id, t.fixed_asset_id)
      where t.store_id = p_store_id
        and t.type = 'salary_advance'
        and coalesce(t.is_settled, false) = false
        and t.date >= cw.cycle_start
        and t.date <= cw.cycle_end
      group by coalesce(t.employee_id, t.fixed_asset_id)
    ),
    carryover_advances as (
      select
        coalesce(t.employee_id, t.fixed_asset_id) as employee_id,
        coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric as carryover_advances
      from public.transactions t
      join cycle_windows cw on cw.employee_id = coalesce(t.employee_id, t.fixed_asset_id)
      where t.store_id = p_store_id
        and t.type = 'salary_advance'
        and coalesce(t.is_settled, false) = false
        and t.date < cw.cycle_start
      group by coalesce(t.employee_id, t.fixed_asset_id)
    ),
    overtime_pending as (
      select
        ot.employee_id,
        coalesce(sum(coalesce(ot.hours, 0)), 0)::numeric as pending_overtime_hours
      from public.employee_overtimes ot
      where ot.store_id = p_store_id
        and coalesce(ot.is_paid, false) = false
      group by ot.employee_id
    )
    select
      cw.employee_id,
      cw.monthly_salary,
      cw.monthly_days,
      case
        when cw.monthly_days = 30 then 0
        when cw.monthly_days = 26 then 4
        when cw.monthly_days = 22 then 8
        else 0
      end::integer as included_days_off,
      coalesce(d.actual_days_off_in_cycle, 0)::integer as actual_days_off_current_month,
      greatest(
        coalesce(d.actual_days_off_in_cycle, 0) -
        case
          when cw.monthly_days = 30 then 0
          when cw.monthly_days = 26 then 4
          when cw.monthly_days = 22 then 8
          else 0
        end,
        0
      )::integer as extra_days_off_current_month,
      case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end::numeric as daily_cost,
      case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end::numeric as hourly_cost,
      coalesce(a.total_advances, 0)::numeric as total_advances,
      coalesce(ca.carryover_advances, 0)::numeric as carryover_advances,
      coalesce(o.pending_overtime_hours, 0)::numeric as pending_overtime_hours,
      (
        coalesce(o.pending_overtime_hours, 0)
        * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
      )::numeric as pending_overtime_amount,
      (
        greatest(
          coalesce(d.actual_days_off_in_cycle, 0) -
          case
            when cw.monthly_days = 30 then 0
            when cw.monthly_days = 26 then 4
            when cw.monthly_days = 22 then 8
            else 0
          end,
          0
        )
        * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
      )::numeric as days_off_deduction,
      cw.agreed_extra_salary,
      (
        cw.monthly_salary
        - coalesce(a.total_advances, 0)
        + (
            coalesce(o.pending_overtime_hours, 0)
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
          )
        - (
            greatest(
              coalesce(d.actual_days_off_in_cycle, 0) -
              case
                when cw.monthly_days = 30 then 0
                when cw.monthly_days = 26 then 4
                when cw.monthly_days = 22 then 8
                else 0
              end,
              0
            )
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
          )
      )::numeric as remaining_payroll_only,
      (
        (
          cw.monthly_salary
          - coalesce(a.total_advances, 0)
          + (
              coalesce(o.pending_overtime_hours, 0)
              * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
            )
          - (
              greatest(
                coalesce(d.actual_days_off_in_cycle, 0) -
                case
                  when cw.monthly_days = 30 then 0
                  when cw.monthly_days = 26 then 4
                  when cw.monthly_days = 22 then 8
                  else 0
                end,
                0
              )
              * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
            )
        )
        + cw.agreed_extra_salary
      )::numeric as final_payable,
      (
        cw.monthly_salary
        - coalesce(a.total_advances, 0)
        + (
            coalesce(o.pending_overtime_hours, 0)
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
          )
        - (
            greatest(
              coalesce(d.actual_days_off_in_cycle, 0) -
              case
                when cw.monthly_days = 30 then 0
                when cw.monthly_days = 26 then 4
                when cw.monthly_days = 22 then 8
                else 0
              end,
              0
            )
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
          )
      )::numeric as remaining_pay
    from cycle_windows cw
    left join days_off_counts d on d.employee_id = cw.employee_id
    left join advances a on a.employee_id = cw.employee_id
    left join carryover_advances ca on ca.employee_id = cw.employee_id
    left join overtime_pending o on o.employee_id = cw.employee_id
    order by cw.employee_id;
  end if;
end;
$$;

grant execute on function public.get_employee_payroll_cards_summary(uuid, date) to authenticated;

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
  carryover_advances numeric,
  pending_overtime_hours numeric,
  pending_overtime_amount numeric,
  days_off_deduction numeric,
  agreed_extra_salary numeric,
  remaining_payroll_only numeric,
  final_payable numeric,
  remaining_pay numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
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
        coalesce(fa.monthly_salary, 0)::numeric as monthly_salary,
        coalesce(fa.monthly_days, 0)::integer as monthly_days,
        coalesce(fa.agreed_extra_salary, 0)::numeric as agreed_extra_salary,
        coalesce(fa.start_date, p_as_of_date)::date as start_date
      from public.fixed_assets fa
      where fa.sub_category = 'staff'
        and fa.id = p_employee_id
        and (fa.store_id = p_store_id or fa.store_id is null)
        and coalesce(fa.pay_basis, 'monthly') = 'monthly'
      limit 1
    ),
    employee_cycle as (
      select
        b.*,
        greatest(
          case
            when as_of_anchor <= p_as_of_date then as_of_anchor
            else prev_anchor
          end,
          b.start_date
        )::date as cycle_start,
        (
          date_trunc(
            'month',
            greatest(
              case
                when as_of_anchor <= p_as_of_date then as_of_anchor
                else prev_anchor
              end,
              b.start_date
            ) + interval '1 month'
          )
          +
          (
            least(
              extract(day from b.start_date)::int,
              extract(day from (
                date_trunc(
                  'month',
                  greatest(
                    case
                      when as_of_anchor <= p_as_of_date then as_of_anchor
                      else prev_anchor
                    end,
                    b.start_date
                  ) + interval '2 month'
                ) - interval '1 day'
              ))::int
            ) - 1
          ) * interval '1 day'
        )::date as cycle_next_start
      from (
        select
          b.*,
          (
            make_date(extract(year from p_as_of_date)::int, extract(month from p_as_of_date)::int, 1)
            + (
              least(
                extract(day from b.start_date)::int,
                extract(day from ((date_trunc('month', p_as_of_date) + interval '1 month - 1 day')::date))::int
              ) - 1
            ) * interval '1 day'
          )::date as as_of_anchor,
          (
            make_date(
              extract(year from (p_as_of_date - interval '1 month'))::int,
              extract(month from (p_as_of_date - interval '1 month'))::int,
              1
            )
            + (
              least(
                extract(day from b.start_date)::int,
                extract(day from ((date_trunc('month', p_as_of_date - interval '1 month') + interval '1 month - 1 day')::date))::int
              ) - 1
            ) * interval '1 day'
          )::date as prev_anchor
        from base_employee b
      ) b
    ),
    cycle_window as (
      select
        c.employee_id,
        c.monthly_salary,
        c.monthly_days,
        c.agreed_extra_salary,
        c.cycle_start,
        (c.cycle_next_start - interval '1 day')::date as cycle_end
      from employee_cycle c
    ),
    days_off_counts as (
      select
        edo.employee_id,
        count(*)::integer as actual_days_off_in_cycle
      from public.employee_days_off edo
      join cycle_window cw on cw.employee_id = edo.employee_id
      where edo.store_id = p_store_id
        and edo.off_date >= cw.cycle_start
        and edo.off_date <= cw.cycle_end
      group by edo.employee_id
    ),
    advances as (
      select
        coalesce(t.employee_id, t.fixed_asset_id) as employee_id,
        coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric as total_advances
      from public.transactions t
      join cycle_window cw on cw.employee_id = coalesce(t.employee_id, t.fixed_asset_id)
      where t.store_id = p_store_id
        and t.type = 'salary_advance'
        and coalesce(t.is_settled, false) = false
        and t.date >= cw.cycle_start
        and t.date <= cw.cycle_end
      group by coalesce(t.employee_id, t.fixed_asset_id)
    ),
    carryover_advances as (
      select
        coalesce(t.employee_id, t.fixed_asset_id) as employee_id,
        coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric as carryover_advances
      from public.transactions t
      join cycle_window cw on cw.employee_id = coalesce(t.employee_id, t.fixed_asset_id)
      where t.store_id = p_store_id
        and t.type = 'salary_advance'
        and coalesce(t.is_settled, false) = false
        and t.date < cw.cycle_start
      group by coalesce(t.employee_id, t.fixed_asset_id)
    ),
    overtime_pending as (
      select
        p_employee_id as employee_id,
        coalesce(sum(coalesce(ot.hours, 0)), 0)::numeric as pending_overtime_hours
      from public.employee_overtimes ot
      where ot.store_id = p_store_id
        and ot.employee_id = p_employee_id
        and coalesce(ot.is_paid, false) = false
    )
    select
      cw.employee_id,
      cw.monthly_salary,
      cw.monthly_days,
      case
        when cw.monthly_days = 30 then 0
        when cw.monthly_days = 26 then 4
        when cw.monthly_days = 22 then 8
        else 0
      end::integer as included_days_off,
      coalesce(d.actual_days_off_in_cycle, 0)::integer as actual_days_off_current_month,
      greatest(
        coalesce(d.actual_days_off_in_cycle, 0) -
        case
          when cw.monthly_days = 30 then 0
          when cw.monthly_days = 26 then 4
          when cw.monthly_days = 22 then 8
          else 0
        end,
        0
      )::integer as extra_days_off_current_month,
      case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end::numeric as daily_cost,
      case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end::numeric as hourly_cost,
      coalesce(a.total_advances, 0)::numeric as total_advances,
      coalesce(ca.carryover_advances, 0)::numeric as carryover_advances,
      coalesce(o.pending_overtime_hours, 0)::numeric as pending_overtime_hours,
      (
        coalesce(o.pending_overtime_hours, 0)
        * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
      )::numeric as pending_overtime_amount,
      (
        greatest(
          coalesce(d.actual_days_off_in_cycle, 0) -
          case
            when cw.monthly_days = 30 then 0
            when cw.monthly_days = 26 then 4
            when cw.monthly_days = 22 then 8
            else 0
          end,
          0
        )
        * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
      )::numeric as days_off_deduction,
      cw.agreed_extra_salary,
      (
        cw.monthly_salary
        - coalesce(a.total_advances, 0)
        + (
            coalesce(o.pending_overtime_hours, 0)
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
          )
        - (
            greatest(
              coalesce(d.actual_days_off_in_cycle, 0) -
              case
                when cw.monthly_days = 30 then 0
                when cw.monthly_days = 26 then 4
                when cw.monthly_days = 22 then 8
                else 0
              end,
              0
            )
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
          )
      )::numeric as remaining_payroll_only,
      (
        (
          cw.monthly_salary
          - coalesce(a.total_advances, 0)
          + (
              coalesce(o.pending_overtime_hours, 0)
              * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
            )
          - (
              greatest(
                coalesce(d.actual_days_off_in_cycle, 0) -
                case
                  when cw.monthly_days = 30 then 0
                  when cw.monthly_days = 26 then 4
                  when cw.monthly_days = 22 then 8
                  else 0
                end,
                0
              )
              * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
            )
        )
        + cw.agreed_extra_salary
      )::numeric as final_payable,
      (
        cw.monthly_salary
        - coalesce(a.total_advances, 0)
        + (
            coalesce(o.pending_overtime_hours, 0)
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
          )
        - (
            greatest(
              coalesce(d.actual_days_off_in_cycle, 0) -
              case
                when cw.monthly_days = 30 then 0
                when cw.monthly_days = 26 then 4
                when cw.monthly_days = 22 then 8
                else 0
              end,
              0
            )
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
          )
      )::numeric as remaining_pay
    from cycle_window cw
    left join days_off_counts d on d.employee_id = cw.employee_id
    left join advances a on a.employee_id = cw.employee_id
    left join carryover_advances ca on ca.employee_id = cw.employee_id
    left join overtime_pending o on o.employee_id = cw.employee_id;
  else
    return query
    with base_employee as (
      select
        fa.id as employee_id,
        coalesce(fa.monthly_salary, 0)::numeric as monthly_salary,
        coalesce(fa.monthly_days, 0)::integer as monthly_days,
        coalesce(fa.agreed_extra_salary, 0)::numeric as agreed_extra_salary,
        coalesce(fa.start_date, p_as_of_date)::date as start_date
      from public.fixed_assets fa
      where fa.sub_category = 'staff'
        and fa.id = p_employee_id
        and (fa.store_id = p_store_id or fa.store_id is null)
        and coalesce(fa.pay_basis, 'monthly') = 'monthly'
      limit 1
    ),
    employee_cycle as (
      select
        b.*,
        greatest(
          case
            when as_of_anchor <= p_as_of_date then as_of_anchor
            else prev_anchor
          end,
          b.start_date
        )::date as cycle_start,
        (
          date_trunc(
            'month',
            greatest(
              case
                when as_of_anchor <= p_as_of_date then as_of_anchor
                else prev_anchor
              end,
              b.start_date
            ) + interval '1 month'
          )
          +
          (
            least(
              extract(day from b.start_date)::int,
              extract(day from (
                date_trunc(
                  'month',
                  greatest(
                    case
                      when as_of_anchor <= p_as_of_date then as_of_anchor
                      else prev_anchor
                    end,
                    b.start_date
                  ) + interval '2 month'
                ) - interval '1 day'
              ))::int
            ) - 1
          ) * interval '1 day'
        )::date as cycle_next_start
      from (
        select
          b.*,
          (
            make_date(extract(year from p_as_of_date)::int, extract(month from p_as_of_date)::int, 1)
            + (
              least(
                extract(day from b.start_date)::int,
                extract(day from ((date_trunc('month', p_as_of_date) + interval '1 month - 1 day')::date))::int
              ) - 1
            ) * interval '1 day'
          )::date as as_of_anchor,
          (
            make_date(
              extract(year from (p_as_of_date - interval '1 month'))::int,
              extract(month from (p_as_of_date - interval '1 month'))::int,
              1
            )
            + (
              least(
                extract(day from b.start_date)::int,
                extract(day from ((date_trunc('month', p_as_of_date - interval '1 month') + interval '1 month - 1 day')::date))::int
              ) - 1
            ) * interval '1 day'
          )::date as prev_anchor
        from base_employee b
      ) b
    ),
    cycle_window as (
      select
        c.employee_id,
        c.monthly_salary,
        c.monthly_days,
        c.agreed_extra_salary,
        c.cycle_start,
        (c.cycle_next_start - interval '1 day')::date as cycle_end
      from employee_cycle c
    ),
    days_off_counts as (
      select
        edo.employee_id,
        count(*)::integer as actual_days_off_in_cycle
      from public.employee_days_off edo
      join cycle_window cw on cw.employee_id = edo.employee_id
      where edo.store_id = p_store_id
        and edo.date >= cw.cycle_start
        and edo.date <= cw.cycle_end
      group by edo.employee_id
    ),
    advances as (
      select
        coalesce(t.employee_id, t.fixed_asset_id) as employee_id,
        coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric as total_advances
      from public.transactions t
      join cycle_window cw on cw.employee_id = coalesce(t.employee_id, t.fixed_asset_id)
      where t.store_id = p_store_id
        and t.type = 'salary_advance'
        and coalesce(t.is_settled, false) = false
        and t.date >= cw.cycle_start
        and t.date <= cw.cycle_end
      group by coalesce(t.employee_id, t.fixed_asset_id)
    ),
    carryover_advances as (
      select
        coalesce(t.employee_id, t.fixed_asset_id) as employee_id,
        coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric as carryover_advances
      from public.transactions t
      join cycle_window cw on cw.employee_id = coalesce(t.employee_id, t.fixed_asset_id)
      where t.store_id = p_store_id
        and t.type = 'salary_advance'
        and coalesce(t.is_settled, false) = false
        and t.date < cw.cycle_start
      group by coalesce(t.employee_id, t.fixed_asset_id)
    ),
    overtime_pending as (
      select
        p_employee_id as employee_id,
        coalesce(sum(coalesce(ot.hours, 0)), 0)::numeric as pending_overtime_hours
      from public.employee_overtimes ot
      where ot.store_id = p_store_id
        and ot.employee_id = p_employee_id
        and coalesce(ot.is_paid, false) = false
    )
    select
      cw.employee_id,
      cw.monthly_salary,
      cw.monthly_days,
      case
        when cw.monthly_days = 30 then 0
        when cw.monthly_days = 26 then 4
        when cw.monthly_days = 22 then 8
        else 0
      end::integer as included_days_off,
      coalesce(d.actual_days_off_in_cycle, 0)::integer as actual_days_off_current_month,
      greatest(
        coalesce(d.actual_days_off_in_cycle, 0) -
        case
          when cw.monthly_days = 30 then 0
          when cw.monthly_days = 26 then 4
          when cw.monthly_days = 22 then 8
          else 0
        end,
        0
      )::integer as extra_days_off_current_month,
      case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end::numeric as daily_cost,
      case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end::numeric as hourly_cost,
      coalesce(a.total_advances, 0)::numeric as total_advances,
      coalesce(ca.carryover_advances, 0)::numeric as carryover_advances,
      coalesce(o.pending_overtime_hours, 0)::numeric as pending_overtime_hours,
      (
        coalesce(o.pending_overtime_hours, 0)
        * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
      )::numeric as pending_overtime_amount,
      (
        greatest(
          coalesce(d.actual_days_off_in_cycle, 0) -
          case
            when cw.monthly_days = 30 then 0
            when cw.monthly_days = 26 then 4
            when cw.monthly_days = 22 then 8
            else 0
          end,
          0
        )
        * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
      )::numeric as days_off_deduction,
      cw.agreed_extra_salary,
      (
        cw.monthly_salary
        - coalesce(a.total_advances, 0)
        + (
            coalesce(o.pending_overtime_hours, 0)
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
          )
        - (
            greatest(
              coalesce(d.actual_days_off_in_cycle, 0) -
              case
                when cw.monthly_days = 30 then 0
                when cw.monthly_days = 26 then 4
                when cw.monthly_days = 22 then 8
                else 0
              end,
              0
            )
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
          )
      )::numeric as remaining_payroll_only,
      (
        (
          cw.monthly_salary
          - coalesce(a.total_advances, 0)
          + (
              coalesce(o.pending_overtime_hours, 0)
              * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
            )
          - (
              greatest(
                coalesce(d.actual_days_off_in_cycle, 0) -
                case
                  when cw.monthly_days = 30 then 0
                  when cw.monthly_days = 26 then 4
                  when cw.monthly_days = 22 then 8
                  else 0
                end,
                0
              )
              * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
            )
        )
        + cw.agreed_extra_salary
      )::numeric as final_payable,
      (
        cw.monthly_salary
        - coalesce(a.total_advances, 0)
        + (
            coalesce(o.pending_overtime_hours, 0)
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) / 8 else 0 end)
          )
        - (
            greatest(
              coalesce(d.actual_days_off_in_cycle, 0) -
              case
                when cw.monthly_days = 30 then 0
                when cw.monthly_days = 26 then 4
                when cw.monthly_days = 22 then 8
                else 0
              end,
              0
            )
            * (case when cw.monthly_days > 0 then ((cw.monthly_salary + cw.agreed_extra_salary) / cw.monthly_days) else 0 end)
          )
      )::numeric as remaining_pay
    from cycle_window cw
    left join days_off_counts d on d.employee_id = cw.employee_id
    left join advances a on a.employee_id = cw.employee_id
    left join carryover_advances ca on ca.employee_id = cw.employee_id
    left join overtime_pending o on o.employee_id = cw.employee_id;
  end if;
end;
$$;

grant execute on function public.get_employee_payroll_card_for_employee(uuid, uuid, date) to authenticated;

create or replace function public.settle_employee_payroll_carryover_atomic(
  p_store_id uuid,
  p_employee_id uuid,
  p_settlement_date date default current_date,
  p_method text default 'Μετρητά',
  p_notes text default null
)
returns table (
  carryover_paid numeric,
  cycle_start date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_date date;
  v_cycle_start date;
  v_as_of_anchor date;
  v_prev_anchor date;
  v_carryover_paid numeric;
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
    raise exception 'Forbidden: admin role required for carryover settlement';
  end if;

  select coalesce(fa.start_date, p_settlement_date)
  into v_start_date
  from public.fixed_assets fa
  where fa.id = p_employee_id
    and fa.sub_category = 'staff'
    and (fa.store_id = p_store_id or fa.store_id is null)
  limit 1;

  if v_start_date is null then
    raise exception 'Employee % not found in store %', p_employee_id, p_store_id;
  end if;

  v_as_of_anchor := (
    make_date(extract(year from p_settlement_date)::int, extract(month from p_settlement_date)::int, 1)
    + (
      least(
        extract(day from v_start_date)::int,
        extract(day from ((date_trunc('month', p_settlement_date) + interval '1 month - 1 day')::date))::int
      ) - 1
    ) * interval '1 day'
  )::date;

  v_prev_anchor := (
    make_date(
      extract(year from (p_settlement_date - interval '1 month'))::int,
      extract(month from (p_settlement_date - interval '1 month'))::int,
      1
    )
    + (
      least(
        extract(day from v_start_date)::int,
        extract(day from ((date_trunc('month', p_settlement_date - interval '1 month') + interval '1 month - 1 day')::date))::int
      ) - 1
    ) * interval '1 day'
  )::date;

  v_cycle_start := greatest(
    case
      when v_as_of_anchor <= p_settlement_date then v_as_of_anchor
      else v_prev_anchor
    end,
    v_start_date
  )::date;

  select coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric
  into v_carryover_paid
  from public.transactions t
  where t.store_id = p_store_id
    and coalesce(t.employee_id, t.fixed_asset_id) = p_employee_id
    and t.type = 'salary_advance'
    and coalesce(t.is_settled, false) = false
    and t.date < v_cycle_start;

  if coalesce(v_carryover_paid, 0) <= 0 then
    raise exception 'No carryover advances to settle';
  end if;

  v_notes := coalesce(
    nullif(trim(coalesce(p_notes, '')), ''),
    format('CARRYOVER SETTLEMENT BEFORE %s', to_char(v_cycle_start, 'DD/MM/YYYY'))
  );

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
    -abs(v_carryover_paid),
    'expense',
    'Staff',
    coalesce(nullif(trim(coalesce(p_method, '')), ''), 'Μετρητά'),
    p_settlement_date,
    v_notes
  );

  update public.transactions t
  set is_settled = true
  where t.store_id = p_store_id
    and coalesce(t.employee_id, t.fixed_asset_id) = p_employee_id
    and t.type = 'salary_advance'
    and coalesce(t.is_settled, false) = false
    and t.date < v_cycle_start;

  return query
  select v_carryover_paid, v_cycle_start;
end;
$$;

grant execute on function public.settle_employee_payroll_carryover_atomic(uuid, uuid, date, text, text) to authenticated;

commit;

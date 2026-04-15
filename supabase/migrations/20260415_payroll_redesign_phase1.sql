begin;

-- ============================================================
-- Payroll Redesign Phase 1
-- Schema changes + snapshot RPC (monthly employees only)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Void fields on transactions (soft delete)
-- ------------------------------------------------------------
alter table public.transactions
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid,
  add column if not exists void_reason text;

-- Optional context tag for audit/debug
alter table public.transactions
  add column if not exists source_context text;

-- Optional cycle bounds for audit/debug
alter table public.transactions
  add column if not exists payroll_cycle_start date,
  add column if not exists payroll_cycle_end date;

-- ------------------------------------------------------------
-- 2) Void fields on employee_overtimes (soft delete)
-- ------------------------------------------------------------
alter table public.employee_overtimes
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid,
  add column if not exists void_reason text;

-- ------------------------------------------------------------
-- 3) Check constraint: employee_id OR fixed_asset_id must exist
-- ------------------------------------------------------------
-- Keep NOT VALID for safe migration on existing data.
alter table public.transactions
  drop constraint if exists transactions_employee_or_asset_ck;

alter table public.transactions
  add constraint transactions_employee_or_asset_ck
  check (
    employee_id is not null
    or fixed_asset_id is not null
  )
  not valid;

-- ------------------------------------------------------------
-- 4) Indexes for snapshot RPC (voided-aware)
-- ------------------------------------------------------------

-- Quick filter by voided_at
create index if not exists idx_transactions_voided_at
  on public.transactions (voided_at);

-- Partial index for active rows
create index if not exists idx_transactions_active_by_store_date
  on public.transactions (store_id, date)
  where voided_at is null;

-- Functional index for active salary advances by employee or asset
create index if not exists idx_tx_advances_active_by_emp_or_asset_date
  on public.transactions (
    store_id,
    (coalesce(employee_id, fixed_asset_id)),
    date
  )
  where type = 'salary_advance' and voided_at is null;

-- Optional explicit indexes (keep for planner flexibility)
create index if not exists idx_tx_advances_active_by_emp_date
  on public.transactions (store_id, employee_id, date)
  where type = 'salary_advance' and voided_at is null;

create index if not exists idx_tx_advances_active_by_asset_date
  on public.transactions (store_id, fixed_asset_id, date)
  where type = 'salary_advance' and voided_at is null;

-- Overtimes: active (unpaid) by employee and date
create index if not exists idx_overtime_active_by_emp_date
  on public.employee_overtimes (store_id, employee_id, date)
  where voided_at is null and coalesce(is_paid, false) = false;

-- Days-off combined index (off_date vs date)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employee_days_off'
      and column_name = 'off_date'
  ) then
    create index if not exists idx_days_off_store_emp_off_date
      on public.employee_days_off (store_id, employee_id, off_date);
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employee_days_off'
      and column_name = 'date'
  ) then
    create index if not exists idx_days_off_store_emp_date
      on public.employee_days_off (store_id, employee_id, date);
  end if;
end $$;

-- ------------------------------------------------------------
-- 5) payroll_periods table (optional, recommended)
-- ------------------------------------------------------------
create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  employee_id uuid not null,
  cycle_start date not null,
  cycle_end date not null,
  settled_at timestamptz,
  settlement_tx_id uuid,
  notes text,
  created_at timestamptz default now()
);

alter table public.payroll_periods
  drop constraint if exists payroll_periods_employee_id_fkey;

alter table public.payroll_periods
  add constraint payroll_periods_employee_id_fkey
  foreign key (employee_id)
  references public.fixed_assets(id)
  on delete cascade
  not valid;

alter table public.payroll_periods
  drop constraint if exists payroll_periods_store_id_fkey;

alter table public.payroll_periods
  add constraint payroll_periods_store_id_fkey
  foreign key (store_id)
  references public.stores(id)
  on delete cascade
  not valid;

create index if not exists idx_payroll_periods_employee
  on public.payroll_periods (employee_id, cycle_start desc);

create index if not exists idx_payroll_periods_store
  on public.payroll_periods (store_id, cycle_start desc);

create unique index if not exists uq_payroll_periods_employee_cycle
  on public.payroll_periods (employee_id, cycle_start, cycle_end);

alter table public.payroll_periods enable row level security;

drop policy if exists payroll_periods_select on public.payroll_periods;
create policy payroll_periods_select
on public.payroll_periods
for select
using (
  exists (
    select 1 from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = payroll_periods.store_id
  )
);

drop policy if exists payroll_periods_insert on public.payroll_periods;
create policy payroll_periods_insert
on public.payroll_periods
for insert
with check (
  exists (
    select 1 from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = payroll_periods.store_id
      and sa.role = 'admin'
  )
);

drop policy if exists payroll_periods_update on public.payroll_periods;
create policy payroll_periods_update
on public.payroll_periods
for update
using (
  exists (
    select 1 from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = payroll_periods.store_id
      and sa.role = 'admin'
  )
);

drop policy if exists payroll_periods_delete on public.payroll_periods;
create policy payroll_periods_delete
on public.payroll_periods
for delete
using (
  exists (
    select 1 from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = payroll_periods.store_id
      and sa.role = 'admin'
  )
);

-- ------------------------------------------------------------
-- 6) Snapshot RPC (monthly employees only)
-- ------------------------------------------------------------

-- FINAL Draft: get_employee_payroll_snapshot (monthly employees only)
-- Performance-oriented: single-row output, minimal joins, scalar aggregates.
-- NOTE on salary advances:
--   salary_advance rows are stored as negative amounts (cash outflow).
--   For totals we always sum abs(amount) so the sign convention is irrelevant.

-- Carryover note:
--   carryover_payable currently means only old unpaid salary advances before cycle_start.
--   It does NOT yet represent full previous-cycle unpaid payroll debt.

drop function if exists public.get_employee_payroll_snapshot(uuid, uuid, date);

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
  v_total_payable numeric;
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

  if v_has_off_date then
    select coalesce(count(*), 0)::integer
    into v_actual_days_off
    from public.employee_days_off edo
    where edo.store_id = p_store_id
      and edo.employee_id = v_employee_id
      and edo.off_date >= v_cycle_start
      and edo.off_date <= v_cycle_end;
  else
    select coalesce(count(*), 0)::integer
    into v_actual_days_off
    from public.employee_days_off edo
    where edo.store_id = p_store_id
      and edo.employee_id = v_employee_id
      and edo.date >= v_cycle_start
      and edo.date <= v_cycle_end;
  end if;

  v_extra_days_off := greatest(v_actual_days_off - v_included_days_off, 0);

  v_daily_cost := case when v_monthly_days > 0 then (v_monthly_salary / v_monthly_days) else 0 end;
  v_hourly_cost := case when v_monthly_days > 0 then (v_daily_cost / 8) else 0 end;

  v_days_off_deduction := v_extra_days_off * v_daily_cost;

  select coalesce(sum(coalesce(ot.hours, 0)), 0)::numeric
  into v_pending_overtime_hours
  from public.employee_overtimes ot
  where ot.store_id = p_store_id
    and ot.employee_id = v_employee_id
    and coalesce(ot.is_paid, false) = false
    and ot.voided_at is null
    and ot.date >= v_cycle_start
    and ot.date <= v_cycle_end;

  v_pending_overtime_amount := coalesce(v_pending_overtime_hours, 0) * coalesce(v_hourly_cost, 0);

  -- salary_advance sign convention:
  -- salary_advance amounts are stored negative; we sum abs(amount).
  select coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric
  into v_current_cycle_advances
  from public.transactions t
  where t.store_id = p_store_id
    and coalesce(t.employee_id, t.fixed_asset_id) = v_employee_id
    and t.type = 'salary_advance'
    and t.voided_at is null
    and t.date >= v_cycle_start
    and t.date <= v_cycle_end;

  select coalesce(sum(abs(coalesce(t.amount, 0))), 0)::numeric
  into v_carryover_advances
  from public.transactions t
  where t.store_id = p_store_id
    and coalesce(t.employee_id, t.fixed_asset_id) = v_employee_id
    and t.type = 'salary_advance'
    and t.voided_at is null
    and t.date < v_cycle_start;

  v_current_cycle_payable := greatest(
    v_monthly_salary
    - coalesce(v_current_cycle_advances, 0)
    + coalesce(v_pending_overtime_amount, 0)
    - coalesce(v_days_off_deduction, 0)
    + coalesce(v_agreed_extra_salary, 0),
    0
  );

  v_total_payable := v_current_cycle_payable + coalesce(v_carryover_advances, 0);

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
    v_carryover_advances as carryover_payable,
    v_total_payable,

    (v_current_cycle_payable > 0) as has_current_cycle_payable,
    (coalesce(v_carryover_advances, 0) > 0) as has_carryover;
end;
$$;

grant execute on function public.get_employee_payroll_snapshot(uuid, uuid, date) to authenticated;

commit;

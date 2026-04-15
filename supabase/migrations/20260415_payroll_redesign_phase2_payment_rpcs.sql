begin;

-- ============================================================
-- Payroll Redesign Phase 2
-- Payment RPCs using get_employee_payroll_snapshot
-- ============================================================

-- ------------------------------------------------------------
-- 1) payroll_pay_current_cycle_atomic
-- ------------------------------------------------------------
drop function if exists public.payroll_pay_current_cycle_atomic(uuid, uuid, text, text);

create or replace function public.payroll_pay_current_cycle_atomic(
  p_store_id uuid,
  p_employee_id uuid,
  p_method text default 'Μετρητά',
  p_notes text default null
)
returns table (
  paid_amount numeric,
  cycle_start date,
  cycle_end date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_cycle_start date;
  v_cycle_end date;
  v_current_cycle_payable numeric;
  v_tx_id uuid;
  v_effective_notes text;
  v_method text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized: missing authenticated user';
  end if;

  if not exists (
    select 1
    from public.store_access sa
    where sa.user_id = v_user_id
      and sa.store_id = p_store_id
      and sa.role = 'admin'
  ) then
    raise exception 'Forbidden: admin role required for payroll payment';
  end if;

  select
    s.cycle_start,
    s.cycle_end,
    s.current_cycle_payable
  into
    v_cycle_start,
    v_cycle_end,
    v_current_cycle_payable
  from public.get_employee_payroll_snapshot(p_store_id, p_employee_id, current_date) s;

  if coalesce(v_current_cycle_payable, 0) <= 0 then
    raise exception 'No current cycle payable amount';
  end if;

  -- Prevent duplicate payment for the same cycle
  if exists (
    select 1
    from public.transactions t
    where t.store_id = p_store_id
      and coalesce(t.employee_id, t.fixed_asset_id) = p_employee_id
      and t.type = 'expense'
      and t.category = 'Staff'
      and t.source_context = 'payroll_settlement'
      and t.voided_at is null
      and t.payroll_cycle_start = v_cycle_start
      and t.payroll_cycle_end = v_cycle_end
  ) then
    raise exception 'Current cycle already paid';
  end if;

  v_effective_notes := nullif(trim(coalesce(p_notes, '')), '');
  if v_effective_notes is null then
    v_effective_notes := format('Εξοφληση μισθοδοσιας [%s - %s]', v_cycle_start, v_cycle_end);
  end if;

  v_method := coalesce(nullif(trim(coalesce(p_method, '')), ''), 'Μετρητά');

  insert into public.transactions (
    store_id,
    employee_id,
    fixed_asset_id,
    amount,
    type,
    category,
    method,
    date,
    notes,
    source_context,
    payroll_cycle_start,
    payroll_cycle_end
  ) values (
    p_store_id,
    p_employee_id,
    p_employee_id,
    -abs(v_current_cycle_payable),
    'expense',
    'Staff',
    v_method,
    current_date,
    v_effective_notes,
    'payroll_settlement',
    v_cycle_start,
    v_cycle_end
  )
  returning id into v_tx_id;

  return query
  select v_current_cycle_payable, v_cycle_start, v_cycle_end;
end;
$$;

grant execute on function public.payroll_pay_current_cycle_atomic(uuid, uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- 2) payroll_pay_carryover_atomic
-- ------------------------------------------------------------
drop function if exists public.payroll_pay_carryover_atomic(uuid, uuid, text, text);

create or replace function public.payroll_pay_carryover_atomic(
  p_store_id uuid,
  p_employee_id uuid,
  p_method text default 'Μετρητά',
  p_notes text default null
)
returns table (
  paid_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_carryover_payable numeric;
  v_tx_id uuid;
  v_effective_notes text;
  v_method text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized: missing authenticated user';
  end if;

  if not exists (
    select 1
    from public.store_access sa
    where sa.user_id = v_user_id
      and sa.store_id = p_store_id
      and sa.role = 'admin'
  ) then
    raise exception 'Forbidden: admin role required for payroll payment';
  end if;

  select
    s.carryover_payable
  into
    v_carryover_payable
  from public.get_employee_payroll_snapshot(p_store_id, p_employee_id, current_date) s;

  if coalesce(v_carryover_payable, 0) <= 0 then
    raise exception 'No carryover payable amount';
  end if;

  v_effective_notes := nullif(trim(coalesce(p_notes, '')), '');
  if v_effective_notes is null then
    v_effective_notes := 'Εξοφληση υπολοιπου προηγ. κυκλου';
  end if;

  v_method := coalesce(nullif(trim(coalesce(p_method, '')), ''), 'Μετρητά');

  insert into public.transactions (
    store_id,
    employee_id,
    fixed_asset_id,
    amount,
    type,
    category,
    method,
    date,
    notes,
    source_context
  ) values (
    p_store_id,
    p_employee_id,
    p_employee_id,
    -abs(v_carryover_payable),
    'expense',
    'Staff',
    v_method,
    current_date,
    v_effective_notes,
    'payroll_carryover'
  )
  returning id into v_tx_id;

  return query
  select v_carryover_payable;
end;
$$;

grant execute on function public.payroll_pay_carryover_atomic(uuid, uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- 3) payroll_pay_full_atomic
-- ------------------------------------------------------------
drop function if exists public.payroll_pay_full_atomic(uuid, uuid, text, text);

create or replace function public.payroll_pay_full_atomic(
  p_store_id uuid,
  p_employee_id uuid,
  p_method text default 'Μετρητά',
  p_notes text default null
)
returns table (
  total_paid numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_cycle_start date;
  v_cycle_end date;
  v_current_cycle_payable numeric;
  v_carryover_payable numeric;
  v_effective_notes text;
  v_method text;
  v_total_paid numeric;
  v_tx_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized: missing authenticated user';
  end if;

  if not exists (
    select 1
    from public.store_access sa
    where sa.user_id = v_user_id
      and sa.store_id = p_store_id
      and sa.role = 'admin'
  ) then
    raise exception 'Forbidden: admin role required for payroll payment';
  end if;

  select
    s.cycle_start,
    s.cycle_end,
    s.current_cycle_payable,
    s.carryover_payable
  into
    v_cycle_start,
    v_cycle_end,
    v_current_cycle_payable,
    v_carryover_payable
  from public.get_employee_payroll_snapshot(p_store_id, p_employee_id, current_date) s;

  if coalesce(v_current_cycle_payable, 0) <= 0 and coalesce(v_carryover_payable, 0) <= 0 then
    raise exception 'No payable amount';
  end if;

  -- Prevent duplicate payment for the same cycle
  if coalesce(v_current_cycle_payable, 0) > 0 then
    if exists (
      select 1
      from public.transactions t
      where t.store_id = p_store_id
        and coalesce(t.employee_id, t.fixed_asset_id) = p_employee_id
        and t.type = 'expense'
        and t.category = 'Staff'
        and t.source_context = 'payroll_settlement'
        and t.voided_at is null
        and t.payroll_cycle_start = v_cycle_start
        and t.payroll_cycle_end = v_cycle_end
    ) then
      raise exception 'Current cycle already paid';
    end if;
  end if;

  v_effective_notes := nullif(trim(coalesce(p_notes, '')), '');
  if v_effective_notes is null then
    v_effective_notes := 'Πληρωμη πληρους ποσου μισθοδοσιας';
  end if;

  v_method := coalesce(nullif(trim(coalesce(p_method, '')), ''), 'Μετρητά');

  v_total_paid := 0;

  if coalesce(v_current_cycle_payable, 0) > 0 then
    insert into public.transactions (
      store_id,
      employee_id,
      fixed_asset_id,
      amount,
      type,
      category,
      method,
      date,
      notes,
      source_context,
      payroll_cycle_start,
      payroll_cycle_end
    ) values (
      p_store_id,
      p_employee_id,
      p_employee_id,
      -abs(v_current_cycle_payable),
      'expense',
      'Staff',
      v_method,
      current_date,
      v_effective_notes,
      'payroll_settlement',
      v_cycle_start,
      v_cycle_end
    )
    returning id into v_tx_id;

    v_total_paid := v_total_paid + v_current_cycle_payable;
  end if;

  if coalesce(v_carryover_payable, 0) > 0 then
    insert into public.transactions (
      store_id,
      employee_id,
      fixed_asset_id,
      amount,
      type,
      category,
      method,
      date,
      notes,
      source_context
    ) values (
      p_store_id,
      p_employee_id,
      p_employee_id,
      -abs(v_carryover_payable),
      'expense',
      'Staff',
      v_method,
      current_date,
      v_effective_notes,
      'payroll_carryover'
    )
    returning id into v_tx_id;

    v_total_paid := v_total_paid + v_carryover_payable;
  end if;

  return query
  select v_total_paid;
end;
$$;

grant execute on function public.payroll_pay_full_atomic(uuid, uuid, text, text) to authenticated;

commit;

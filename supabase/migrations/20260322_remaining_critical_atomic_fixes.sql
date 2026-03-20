begin;

-- =====================================================
-- REMAINING CRITICAL FIXES
-- 1) Atomic installment unpay RPC
-- 2) Atomic overtime pay-now RPC
-- 3) Atomic goal transaction RPC
-- 4) Daily-Z race protection (safe unique guard)
-- =====================================================

-- -----------------------------------------------------
-- Daily-Z race protection (method-level uniqueness per store/date)
-- -----------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'transactions'
      and indexname = 'uq_transactions_z_close_store_date_method'
  ) then
    create unique index uq_transactions_z_close_store_date_method
      on public.transactions (store_id, date, method)
      where type = 'income' and category = 'Εσοδα Ζ';
  end if;
end
$$;

-- -----------------------------------------------------
-- Atomic installment unpay (revert paid installment + delete tx)
-- -----------------------------------------------------
drop function if exists public.installment_unpay_atomic(uuid, uuid);

create or replace function public.installment_unpay_atomic(
  p_store_id uuid,
  p_transaction_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_installment_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized: missing authenticated user';
  end if;

  if p_store_id is null or p_transaction_id is null then
    raise exception 'Missing required identifiers (store_id, transaction_id)';
  end if;

  if not exists (
    select 1
    from public.store_access sa
    where sa.user_id = v_user_id
      and sa.store_id = p_store_id
      and (
        sa.role = 'admin'
        or coalesce(sa.can_edit_transactions, false) = true
      )
  ) then
    raise exception 'Forbidden: insufficient store permissions for installment unpay';
  end if;

  select i.id
  into v_installment_id
  from public.installments i
  where i.store_id = p_store_id
    and i.transaction_id = p_transaction_id
  for update;

  if not found then
    raise exception 'Installment payment link not found for transaction';
  end if;

  update public.installments
  set status = 'pending',
      transaction_id = null
  where id = v_installment_id
    and store_id = p_store_id;

  delete from public.transactions
  where id = p_transaction_id
    and store_id = p_store_id;

  return v_installment_id;
end;
$$;

grant execute on function public.installment_unpay_atomic(uuid, uuid) to authenticated;

-- -----------------------------------------------------
-- Atomic overtime pay-now
-- -----------------------------------------------------
drop function if exists public.overtime_pay_now_atomic(uuid, uuid, numeric, numeric, text, date, text, text);

create or replace function public.overtime_pay_now_atomic(
  p_store_id uuid,
  p_employee_id uuid,
  p_hours numeric,
  p_payment_amount numeric,
  p_method text default 'Μετρητά',
  p_date date default current_date,
  p_notes text default null,
  p_category text default 'Staff'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_tx_id uuid;
  v_created_by_name text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized: missing authenticated user';
  end if;

  if p_store_id is null or p_employee_id is null then
    raise exception 'Missing required identifiers (store_id, employee_id)';
  end if;

  if p_hours is null or p_hours <= 0 then
    raise exception 'Overtime hours must be > 0';
  end if;

  if p_payment_amount is null or p_payment_amount <= 0 then
    raise exception 'Payment amount must be > 0';
  end if;

  if not exists (
    select 1
    from public.store_access sa
    where sa.user_id = v_user_id
      and sa.store_id = p_store_id
      and (
        sa.role = 'admin'
        or coalesce(sa.can_edit_transactions, false) = true
      )
  ) then
    raise exception 'Forbidden: insufficient store permissions for overtime payment';
  end if;

  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    'Χρήστης'
  )
  into v_created_by_name;

  if strpos(v_created_by_name, '@') > 0 then
    v_created_by_name := split_part(v_created_by_name, '@', 1);
  end if;

  insert into public.transactions (
    store_id,
    user_id,
    created_by_name,
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
    v_user_id,
    v_created_by_name,
    p_employee_id,
    p_employee_id,
    -abs(p_payment_amount),
    'expense',
    coalesce(nullif(trim(p_category), ''), 'Staff'),
    coalesce(nullif(trim(p_method), ''), 'Μετρητά'),
    coalesce(p_date, current_date),
    coalesce(nullif(trim(p_notes), ''), format('Άμεση πληρωμή υπερωρίας: %s ώρες', p_hours::text))
  )
  returning id into v_tx_id;

  insert into public.employee_overtimes (
    employee_id,
    store_id,
    hours,
    date,
    is_paid,
    payment_date,
    transaction_id
  ) values (
    p_employee_id,
    p_store_id,
    p_hours,
    coalesce(p_date, current_date),
    true,
    coalesce(p_date, current_date),
    v_tx_id
  );

  return v_tx_id;
end;
$$;

grant execute on function public.overtime_pay_now_atomic(uuid, uuid, numeric, numeric, text, date, text, text) to authenticated;

-- -----------------------------------------------------
-- Atomic goal transaction
-- -----------------------------------------------------
drop function if exists public.goal_transaction_atomic(uuid, uuid, text, numeric, text, date, text, text);

create or replace function public.goal_transaction_atomic(
  p_store_id uuid,
  p_goal_id uuid,
  p_action text,
  p_amount numeric,
  p_method text default 'Μετρητά',
  p_date date default current_date,
  p_notes text default null,
  p_category text default 'Αποταμίευση'
)
returns table(new_amount numeric, transaction_id uuid, new_status text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_created_by_name text;
  v_current_amount numeric;
  v_target_amount numeric;
  v_prev_status text;
  v_delta numeric;
  v_tx_amount numeric;
  v_tx_type text;
  v_tx_id uuid;
  v_goal_name text;
  v_next_amount numeric;
  v_next_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized: missing authenticated user';
  end if;

  if p_store_id is null or p_goal_id is null then
    raise exception 'Missing required identifiers (store_id, goal_id)';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Goal transaction amount must be > 0';
  end if;

  if p_action not in ('deposit', 'withdraw') then
    raise exception 'Invalid goal action. Expected deposit or withdraw';
  end if;

  if not exists (
    select 1
    from public.store_access sa
    where sa.user_id = v_user_id
      and sa.store_id = p_store_id
      and (
        sa.role = 'admin'
        or coalesce(sa.can_edit_transactions, false) = true
      )
  ) then
    raise exception 'Forbidden: insufficient store permissions for goal transaction';
  end if;

  select
    coalesce(g.current_amount, 0),
    coalesce(g.target_amount, 0),
    coalesce(g.status, 'active'),
    coalesce(g.name, 'Κουμπαράς')
  into
    v_current_amount,
    v_target_amount,
    v_prev_status,
    v_goal_name
  from public.savings_goals g
  where g.id = p_goal_id
    and g.store_id = p_store_id
  for update;

  if not found then
    raise exception 'Goal not found for store';
  end if;

  if p_action = 'deposit' then
    v_delta := abs(p_amount);
    v_tx_amount := -abs(p_amount);
    v_tx_type := 'savings_deposit';
  else
    if v_current_amount < abs(p_amount) then
      raise exception 'Insufficient goal balance for withdrawal';
    end if;
    v_delta := -abs(p_amount);
    v_tx_amount := abs(p_amount);
    v_tx_type := 'savings_withdrawal';
  end if;

  v_next_amount := v_current_amount + v_delta;

  if lower(v_prev_status) = 'completed' then
    v_next_status := 'completed';
  elsif v_next_amount >= v_target_amount and v_target_amount > 0 then
    v_next_status := 'completed';
  else
    v_next_status := 'active';
  end if;

  update public.savings_goals
  set
    current_amount = v_next_amount,
    status = v_next_status
  where id = p_goal_id
    and store_id = p_store_id;

  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    'Χρήστης'
  )
  into v_created_by_name;

  if strpos(v_created_by_name, '@') > 0 then
    v_created_by_name := split_part(v_created_by_name, '@', 1);
  end if;

  insert into public.transactions (
    store_id,
    goal_id,
    user_id,
    created_by_name,
    type,
    amount,
    method,
    category,
    notes,
    date
  ) values (
    p_store_id,
    p_goal_id,
    v_user_id,
    v_created_by_name,
    v_tx_type,
    v_tx_amount,
    coalesce(nullif(trim(p_method), ''), 'Μετρητά'),
    coalesce(nullif(trim(p_category), ''), 'Αποταμίευση'),
    coalesce(
      nullif(trim(p_notes), ''),
      case
        when p_action = 'deposit' then format('Κατάθεση στον Κουμπαρά: %s', v_goal_name)
        else format('Ανάληψη από Κουμπαρά: %s', v_goal_name)
      end
    ),
    coalesce(p_date, current_date)
  )
  returning id into v_tx_id;

  return query
  select v_next_amount, v_tx_id, v_next_status;
end;
$$;

grant execute on function public.goal_transaction_atomic(uuid, uuid, text, numeric, text, date, text, text) to authenticated;

commit;

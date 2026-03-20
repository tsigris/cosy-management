begin;

-- =====================================================
-- PRODUCTION-SAFE MIGRATION PACK
-- Scope:
-- 1) Critical indexes (deduplicated)
-- 2) Atomic RPC: payroll payment
-- 3) Atomic RPC: installment payment
-- 4) Safe unique partial index
-- 5) RLS verification SQL (read-only checks)
-- =====================================================

-- -----------------------------------------------------
-- 1) INDEXES (CRITICAL)
-- Add only if equivalent index is missing.
-- -----------------------------------------------------

do $$
begin
  -- transactions (store_id, date, type)
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'transactions'
      and indexdef ilike '%(store_id, date, type)%'
  ) then
    create index if not exists idx_transactions_store_date_type
      on public.transactions (store_id, date, type);
  end if;

  -- transactions (store_id, employee_id, type)
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'transactions'
      and indexdef ilike '%(store_id, employee_id, type)%'
  ) then
    create index if not exists idx_transactions_store_employee_type
      on public.transactions (store_id, employee_id, type);
  end if;

  -- employee_days_off (store_id, employee_id, off_date)
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employee_days_off'
      and column_name = 'off_date'
  ) then
    if not exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'employee_days_off'
        and indexdef ilike '%(store_id, employee_id, off_date)%'
    ) then
      create index if not exists idx_employee_days_off_store_employee_off_date
        on public.employee_days_off (store_id, employee_id, off_date);
    end if;
  end if;

  -- store_members (user_id, store_id)
  if to_regclass('public.store_members') is not null then
    if not exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'store_members'
        and indexdef ilike '%(user_id, store_id)%'
    ) then
      create index if not exists idx_store_members_user_store
        on public.store_members (user_id, store_id);
    end if;
  end if;
end
$$;

-- -----------------------------------------------------
-- 4) SAFE CONSTRAINTS ONLY
-- unique index on installments(transaction_id) WHERE transaction_id IS NOT NULL
-- -----------------------------------------------------

do $$
begin
  if to_regclass('public.installments') is not null then
    if not exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'installments'
        and indexdef ilike 'create unique index%on public.installments%((transaction_id))%where (transaction_id is not null)%'
    ) then
      create unique index if not exists uq_installments_transaction_id_not_null
        on public.installments (transaction_id)
        where transaction_id is not null;
    end if;
  end if;
end
$$;

-- -----------------------------------------------------
-- 2) ATOMIC RPC - PAYROLL PAYMENT
-- One transaction:
--  - insert payment transaction
--  - settle advances (optional)
--  - settle overtimes (optional)
--  - settle tips table rows if a compatible table exists (optional)
-- Returns: transaction_id
-- -----------------------------------------------------

drop function if exists public.payroll_payment_atomic(
  uuid,
  uuid,
  numeric,
  text,
  text,
  date,
  text,
  boolean,
  boolean,
  boolean
);

create or replace function public.payroll_payment_atomic(
  p_store_id uuid,
  p_employee_id uuid,
  p_amount numeric,
  p_method text,
  p_category text default 'Staff',
  p_date date default current_date,
  p_notes text default null,
  p_settle_advances boolean default true,
  p_settle_overtimes boolean default true,
  p_settle_tips boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tx_id uuid;
  v_user_id uuid;
  v_created_by_name text;
  v_effective_notes text;
  v_has_tips_table boolean := false;
  v_has_tips_cols boolean := false;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized: missing authenticated user';
  end if;

  if p_store_id is null or p_employee_id is null then
    raise exception 'Missing required identifiers (store_id, employee_id)';
  end if;

  if p_amount is null or p_amount <= 0 then
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
    raise exception 'Forbidden: insufficient store permissions for payroll payment';
  end if;

  -- Lock related unsettled advances for this employee/store.
  if p_settle_advances then
    perform 1
    from public.transactions t
    where t.store_id = p_store_id
      and t.employee_id = p_employee_id
      and t.type = 'salary_advance'
      and coalesce(t.is_settled, false) = false
    for update;
  end if;

  -- Lock related unpaid overtimes for this employee/store.
  if p_settle_overtimes then
    perform 1
    from public.employee_overtimes ot
    where ot.store_id = p_store_id
      and ot.employee_id = p_employee_id
      and coalesce(ot.is_paid, false) = false
    for update;
  end if;

  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    'Χρήστης'
  )
  into v_created_by_name;

  if strpos(v_created_by_name, '@') > 0 then
    v_created_by_name := split_part(v_created_by_name, '@', 1);
  end if;

  v_effective_notes := coalesce(
    nullif(trim(p_notes), ''),
    format('Εκκαθάριση μισθοδοσίας υπαλλήλου: %s', p_employee_id::text)
  );

  insert into public.transactions (
    store_id,
    user_id,
    created_by_name,
    type,
    amount,
    method,
    category,
    notes,
    date,
    employee_id
  ) values (
    p_store_id,
    v_user_id,
    v_created_by_name,
    'expense',
    -abs(p_amount),
    coalesce(nullif(trim(p_method), ''), 'Μετρητά'),
    coalesce(nullif(trim(p_category), ''), 'Staff'),
    v_effective_notes,
    coalesce(p_date, current_date),
    p_employee_id
  )
  returning id into v_tx_id;

  if p_settle_advances then
    update public.transactions
    set is_settled = true
    where store_id = p_store_id
      and employee_id = p_employee_id
      and type = 'salary_advance'
      and coalesce(is_settled, false) = false;
  end if;

  if p_settle_overtimes then
    update public.employee_overtimes
    set is_paid = true
    where store_id = p_store_id
      and employee_id = p_employee_id
      and coalesce(is_paid, false) = false;
  end if;

  -- Optional tips settlement only if a compatible tips table exists.
  if p_settle_tips then
    select to_regclass('public.tips') is not null into v_has_tips_table;

    if v_has_tips_table then
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'tips'
          and column_name in ('store_id', 'employee_id', 'is_paid')
        group by table_schema, table_name
        having count(*) = 3
      ) into v_has_tips_cols;

      if v_has_tips_cols then
        execute $sql$
          update public.tips
          set is_paid = true
          where store_id = $1
            and employee_id = $2
            and coalesce(is_paid, false) = false
        $sql$
        using p_store_id, p_employee_id;
      end if;
    end if;
  end if;

  return v_tx_id;
end;
$$;

grant execute on function public.payroll_payment_atomic(
  uuid,
  uuid,
  numeric,
  text,
  text,
  date,
  text,
  boolean,
  boolean,
  boolean
) to authenticated;

-- -----------------------------------------------------
-- 3) ATOMIC RPC - INSTALLMENT PAYMENT
-- One transaction:
--  - lock installment row
--  - insert expense transaction
--  - update installment as paid + link transaction_id
-- Returns: transaction_id
-- -----------------------------------------------------

drop function if exists public.installment_payment_atomic(
  uuid,
  uuid,
  numeric,
  text,
  text,
  date,
  text,
  text
);

create or replace function public.installment_payment_atomic(
  p_store_id uuid,
  p_installment_id uuid,
  p_amount numeric default null,
  p_method text default 'Μετρητά',
  p_category text default 'Δάνεια',
  p_date date default current_date,
  p_notes text default null,
  p_type text default 'expense'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tx_id uuid;
  v_user_id uuid;
  v_created_by_name text;
  v_effective_amount numeric;
  v_current_amount numeric;
  v_current_status text;
  v_existing_tx uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized: missing authenticated user';
  end if;

  if p_store_id is null or p_installment_id is null then
    raise exception 'Missing required identifiers (store_id, installment_id)';
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
    raise exception 'Forbidden: insufficient store permissions for installment payment';
  end if;

  -- Lock target installment row to prevent double-pay races.
  select
    i.amount,
    coalesce(i.status, 'pending'),
    i.transaction_id
  into
    v_current_amount,
    v_current_status,
    v_existing_tx
  from public.installments i
  where i.id = p_installment_id
    and i.store_id = p_store_id
  for update;

  if not found then
    raise exception 'Installment not found for store';
  end if;

  if v_existing_tx is not null or lower(v_current_status) = 'paid' then
    raise exception 'Installment already paid';
  end if;

  v_effective_amount := abs(coalesce(p_amount, v_current_amount));

  if v_effective_amount is null or v_effective_amount <= 0 then
    raise exception 'Installment amount must be > 0';
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
    type,
    amount,
    method,
    category,
    notes,
    date
  ) values (
    p_store_id,
    v_user_id,
    v_created_by_name,
    coalesce(nullif(trim(p_type), ''), 'expense'),
    -abs(v_effective_amount),
    coalesce(nullif(trim(p_method), ''), 'Μετρητά'),
    coalesce(nullif(trim(p_category), ''), 'Δάνεια'),
    coalesce(nullif(trim(p_notes), ''), format('Πληρωμή δόσης %s', p_installment_id::text)),
    coalesce(p_date, current_date)
  )
  returning id into v_tx_id;

  update public.installments
  set
    status = 'paid',
    transaction_id = v_tx_id,
    amount = abs(v_effective_amount)
  where id = p_installment_id
    and store_id = p_store_id;

  return v_tx_id;
end;
$$;

grant execute on function public.installment_payment_atomic(
  uuid,
  uuid,
  numeric,
  text,
  text,
  date,
  text,
  text
) to authenticated;

commit;

-- -----------------------------------------------------
-- 5) RLS VERIFICATION SCRIPT (READ-ONLY)
-- Run these SELECTs after migration.
-- -----------------------------------------------------

-- A) RLS status for target tables
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'transactions',
    'fixed_assets',
    'suppliers',
    'revenue_sources',
    'settlements',
    'installments',
    'employee_overtimes',
    'employee_days_off',
    'store_members',
    'store_access',
    'savings_goals',
    'notifications'
  )
order by c.relname;

-- B) Missing RLS tables (should return zero rows)
with target_tables as (
  select unnest(array[
    'transactions',
    'fixed_assets',
    'suppliers',
    'revenue_sources',
    'settlements',
    'installments',
    'employee_overtimes',
    'employee_days_off',
    'store_members',
    'store_access',
    'savings_goals',
    'notifications'
  ]) as table_name
)
select
  t.table_name
from target_tables t
left join pg_class c
  on c.relname = t.table_name
left join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and coalesce(c.relrowsecurity, false) = false
order by t.table_name;

-- C) Policies for the same target tables
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'transactions',
    'fixed_assets',
    'suppliers',
    'revenue_sources',
    'settlements',
    'installments',
    'employee_overtimes',
    'employee_days_off',
    'store_members',
    'store_access',
    'savings_goals',
    'notifications'
  )
order by tablename, policyname;

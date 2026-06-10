begin;

-- ============================================================
-- Employee Wallet / Ledger Phase 2 Activation
-- Additive only: extends dormant employee_ledger_* foundation.
-- No changes to legacy payroll calculations or legacy transactions flows.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Extend enum coverage
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'employee_ledger_entry_subtype'
      and n.nspname = 'public'
  ) then
    begin
      alter type public.employee_ledger_entry_subtype add value if not exists 'gift';
    exception when duplicate_object then null;
    end;
  end if;
end
$$;

-- ------------------------------------------------------------
-- 2) Extend ledger entries for wallet behavior
-- ------------------------------------------------------------
alter table public.employee_ledger_entries
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists payment_method text,
  add column if not exists notes text;

alter table public.employee_ledger_entries
  drop constraint if exists employee_ledger_entries_period_window_ck;

alter table public.employee_ledger_entries
  add constraint employee_ledger_entries_period_window_ck
  check (period_end is null or period_start is null or period_end >= period_start);

create index if not exists idx_employee_ledger_entries_scope_employee_period
  on public.employee_ledger_entries (organization_id, store_id, employee_id, period_start desc, period_end desc);

create index if not exists idx_employee_ledger_entries_scope_employee_created
  on public.employee_ledger_entries (organization_id, store_id, employee_id, created_at desc);

-- ------------------------------------------------------------
-- 3) Agreement seed helper (idempotent)
-- ------------------------------------------------------------
drop function if exists public.employee_wallet_seed_agreement_from_fixed_asset(uuid, uuid);

create or replace function public.employee_wallet_seed_agreement_from_fixed_asset(
  p_store_id uuid,
  p_employee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_agreement_id uuid;
  v_employee record;
  v_effective_from date;
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
    raise exception 'Forbidden: admin role required';
  end if;

  select s.organization_id
  into v_org_id
  from public.stores s
  where s.id = p_store_id;

  if v_org_id is null then
    raise exception 'Store % not found', p_store_id;
  end if;

  select
    fa.id,
    fa.store_id,
    coalesce(fa.pay_basis, 'monthly') as pay_basis,
    coalesce(fa.start_date, current_date) as start_date,
    coalesce(fa.monthly_salary, 0) as monthly_salary,
    coalesce(fa.daily_rate, 0) as daily_rate
  into v_employee
  from public.fixed_assets fa
  where fa.id = p_employee_id
    and fa.sub_category = 'staff'
    and (fa.store_id = p_store_id or fa.store_id is null)
  limit 1;

  if v_employee.id is null then
    raise exception 'Employee % not found in store %', p_employee_id, p_store_id;
  end if;

  v_effective_from := greatest(coalesce(v_employee.start_date, current_date), current_date - interval '20 years')::date;

  select ea.id
  into v_agreement_id
  from public.employee_agreements ea
  where ea.store_id = p_store_id
    and ea.employee_id = p_employee_id
    and ea.agreement_status = 'active'
    and ea.voided_at is null
  order by ea.effective_from desc, ea.created_at desc
  limit 1;

  if v_agreement_id is not null then
    return v_agreement_id;
  end if;

  insert into public.employee_agreements (
    organization_id,
    store_id,
    employee_id,
    agreement_type,
    agreement_status,
    effective_from,
    currency,
    monthly_amount,
    daily_rate,
    source_system,
    source_ref_id,
    created_by,
    updated_by
  ) values (
    v_org_id,
    p_store_id,
    p_employee_id,
    (case when v_employee.pay_basis = 'daily' then 'daily' else 'monthly' end)::public.employee_agreement_type,
    'active',
    v_effective_from,
    'EUR',
    case when v_employee.pay_basis = 'monthly' then nullif(v_employee.monthly_salary, 0) else null end,
    case when v_employee.pay_basis = 'daily' then nullif(v_employee.daily_rate, 0) else null end,
    'fixed_assets_seed',
    p_employee_id::text,
    v_user_id,
    v_user_id
  )
  returning id into v_agreement_id;

  return v_agreement_id;
end;
$$;

grant execute on function public.employee_wallet_seed_agreement_from_fixed_asset(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 4) Atomic manual wallet entry writer
-- ------------------------------------------------------------
drop function if exists public.employee_wallet_record_entry_atomic(uuid, uuid, text, text, numeric, date, date, date, text, text, text);

create or replace function public.employee_wallet_record_entry_atomic(
  p_store_id uuid,
  p_employee_id uuid,
  p_entry_kind text,
  p_entry_subtype text,
  p_amount numeric,
  p_occurred_on date,
  p_period_start date default null,
  p_period_end date default null,
  p_payment_method text default null,
  p_notes text default null,
  p_direction text default null
)
returns table (
  event_id uuid,
  entry_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_event_id uuid;
  v_entry_id uuid;
  v_direction public.employee_ledger_direction;
  v_kind public.employee_ledger_entry_kind;
  v_subtype public.employee_ledger_entry_subtype;
  v_payload_hash text;
  v_event_type public.employee_ledger_event_type;
  v_source_event_id text;
  v_correlation_id text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized: missing authenticated user';
  end if;

  if p_store_id is null or p_employee_id is null then
    raise exception 'Missing required identifiers';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be > 0';
  end if;

  if p_occurred_on is null then
    raise exception 'occurred_on is required';
  end if;

  if p_period_end is not null and p_period_start is not null and p_period_end < p_period_start then
    raise exception 'Invalid period window';
  end if;

  if not exists (
    select 1
    from public.store_access sa
    where sa.user_id = v_user_id
      and sa.store_id = p_store_id
      and (sa.role = 'admin' or coalesce(sa.can_edit_transactions, false) = true)
  ) then
    raise exception 'Forbidden: insufficient store permissions';
  end if;

  select s.organization_id
  into v_org_id
  from public.stores s
  where s.id = p_store_id;

  if v_org_id is null then
    raise exception 'Store % not found', p_store_id;
  end if;

  v_kind := p_entry_kind::public.employee_ledger_entry_kind;
  v_subtype := p_entry_subtype::public.employee_ledger_entry_subtype;

  if v_kind = 'earning' then
    v_direction := 'increase_balance';
  elsif v_kind in ('payment', 'deduction') then
    v_direction := 'decrease_balance';
  else
    if p_direction is null then
      raise exception 'Adjustment entries require explicit direction';
    end if;
    v_direction := p_direction::public.employee_ledger_direction;
  end if;

  if v_subtype in ('salary', 'salary_payment', 'partial_payment', 'settlement_payment') and (p_period_start is null or p_period_end is null) then
    raise exception 'Salary-related entries require period_start and period_end';
  end if;

  perform public.employee_wallet_seed_agreement_from_fixed_asset(p_store_id, p_employee_id);

  v_source_event_id := gen_random_uuid()::text;
  v_correlation_id := gen_random_uuid()::text;
  v_payload_hash := md5(concat_ws('|', p_store_id::text, p_employee_id::text, p_entry_kind, p_entry_subtype, p_amount::text, p_occurred_on::text, coalesce(p_period_start::text, ''), coalesce(p_period_end::text, ''), coalesce(p_notes, ''), coalesce(p_direction, '')));

  if v_kind = 'earning' then
    v_event_type := 'earning_recorded';
  elsif v_kind = 'payment' then
    v_event_type := 'payment_recorded';
  elsif v_kind = 'deduction' then
    v_event_type := 'deduction_recorded';
  else
    v_event_type := 'adjustment_recorded';
  end if;

  insert into public.employee_ledger_events (
    organization_id,
    store_id,
    employee_id,
    event_type,
    event_status,
    source_system,
    source_event_id,
    idempotency_key,
    correlation_id,
    payload_hash,
    occurred_at,
    metadata_json,
    created_by,
    updated_by
  ) values (
    v_org_id,
    p_store_id,
    p_employee_id,
    v_event_type,
    'recorded',
    'employee_wallet_ui',
    v_source_event_id,
    v_source_event_id,
    v_correlation_id,
    v_payload_hash,
    p_occurred_on::timestamptz,
    jsonb_build_object(
      'payment_method', p_payment_method,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'notes', p_notes
    ),
    v_user_id,
    v_user_id
  )
  returning id into v_event_id;

  insert into public.employee_ledger_entries (
    organization_id,
    store_id,
    employee_id,
    event_id,
    entry_kind,
    entry_subtype,
    direction,
    amount,
    currency,
    occurred_on,
    description,
    notes,
    payment_method,
    period_start,
    period_end,
    posting_status,
    source_table,
    created_by,
    updated_by
  ) values (
    v_org_id,
    p_store_id,
    p_employee_id,
    v_event_id,
    v_kind,
    v_subtype,
    v_direction,
    abs(p_amount),
    'EUR',
    p_occurred_on,
    coalesce(nullif(trim(coalesce(p_notes, '')), ''), initcap(replace(p_entry_subtype, '_', ' '))),
    nullif(trim(coalesce(p_notes, '')), ''),
    nullif(trim(coalesce(p_payment_method, '')), ''),
    p_period_start,
    p_period_end,
    'posted',
    'employee_wallet_ui',
    v_user_id,
    v_user_id
  )
  returning id into v_entry_id;

  update public.employee_ledger_events
  set event_status = 'succeeded',
      processed_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where id = v_event_id;

  return query
  select v_event_id, v_entry_id;
end;
$$;

grant execute on function public.employee_wallet_record_entry_atomic(uuid, uuid, text, text, numeric, date, date, date, text, text, text) to authenticated;

commit;

begin;

-- Defensive schema guards for relation columns used by registry matching.
alter table public.settlements
  add column if not exists supplier_id uuid,
  add column if not exists fixed_asset_id uuid,
  add column if not exists revenue_source_id uuid,
  add column if not exists employee_id uuid;

alter table public.transactions
  add column if not exists supplier_id uuid,
  add column if not exists fixed_asset_id uuid,
  add column if not exists revenue_source_id uuid,
  add column if not exists employee_id uuid;

create index if not exists idx_transactions_supplier_id on public.transactions (supplier_id);
create index if not exists idx_transactions_fixed_asset_id on public.transactions (fixed_asset_id);
create index if not exists idx_transactions_revenue_source_id on public.transactions (revenue_source_id);
create index if not exists idx_transactions_employee_id on public.transactions (employee_id);
create index if not exists idx_transactions_type on public.transactions (type);
create index if not exists idx_installments_settlement_id on public.installments (settlement_id);
create index if not exists idx_installments_transaction_id on public.installments (transaction_id);

-- Keep payment RPC aligned with linked-settlement propagation.
-- If an older function body is currently active in production, this guarantees linked ids are copied.
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
  p_type text default 'debt_payment'
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
  v_supplier_id uuid;
  v_fixed_asset_id uuid;
  v_revenue_source_id uuid;
  v_employee_id uuid;
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

  select
    i.amount,
    coalesce(i.status, 'pending'),
    i.transaction_id,
    s.supplier_id,
    s.fixed_asset_id,
    s.revenue_source_id,
    s.employee_id
  into
    v_current_amount,
    v_current_status,
    v_existing_tx,
    v_supplier_id,
    v_fixed_asset_id,
    v_revenue_source_id,
    v_employee_id
  from public.installments i
  left join public.settlements s
    on s.id = i.settlement_id
   and s.store_id = p_store_id
  where i.id = p_installment_id
    and i.store_id = p_store_id
  for update of i;

  if not found then
    raise exception 'Installment not found for store';
  end if;

  if lower(v_current_status) = 'paid' then
    raise exception 'Installment already paid';
  end if;

  if v_existing_tx is not null then
    raise exception 'Installment already linked to transaction';
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
    date,
    supplier_id,
    fixed_asset_id,
    revenue_source_id,
    employee_id
  ) values (
    p_store_id,
    v_user_id,
    v_created_by_name,
    coalesce(nullif(trim(p_type), ''), 'debt_payment'),
    -abs(v_effective_amount),
    coalesce(nullif(trim(p_method), ''), 'Μετρητά'),
    coalesce(nullif(trim(p_category), ''), 'Δάνεια'),
    coalesce(
      nullif(trim(p_notes), ''),
      format('Πληρωμή δόσης %s', p_installment_id::text)
    ),
    coalesce(p_date, current_date),
    v_supplier_id,
    v_fixed_asset_id,
    v_revenue_source_id,
    v_employee_id
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

-- Normalize installment-created payment type for deterministic downstream reporting.
update public.transactions t
set type = 'debt_payment'
from public.installments i
where i.transaction_id = t.id
  and coalesce(t.type, '') <> 'debt_payment';

-- Deterministic backfill: propagate linked entity ids from settlement to its installment payment transactions.
update public.transactions t
set
  supplier_id = coalesce(t.supplier_id, s.supplier_id),
  fixed_asset_id = coalesce(t.fixed_asset_id, s.fixed_asset_id),
  revenue_source_id = coalesce(t.revenue_source_id, s.revenue_source_id),
  employee_id = coalesce(t.employee_id, s.employee_id)
from public.installments i
join public.settlements s
  on s.id = i.settlement_id
 and s.store_id = i.store_id
where i.transaction_id = t.id
  and t.type = 'debt_payment'
  and (
    (t.supplier_id is null and s.supplier_id is not null)
    or (t.fixed_asset_id is null and s.fixed_asset_id is not null)
    or (t.revenue_source_id is null and s.revenue_source_id is not null)
    or (t.employee_id is null and s.employee_id is not null)
  );

commit;

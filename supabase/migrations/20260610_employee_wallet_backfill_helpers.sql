begin;

-- ============================================================
-- Employee Wallet Backfill Helpers
-- Additive, idempotent, not executed automatically.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Seed active agreements from fixed_assets
-- ------------------------------------------------------------
drop function if exists public.employee_wallet_backfill_seed_agreements(uuid, uuid);

create or replace function public.employee_wallet_backfill_seed_agreements(
  p_store_id uuid,
  p_employee_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_seeded_count integer := 0;
  v_row record;
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

  for v_row in
    select fa.id as employee_id
    from public.fixed_assets fa
    where fa.sub_category = 'staff'
      and (fa.store_id = p_store_id or fa.store_id is null)
      and (p_employee_id is null or fa.id = p_employee_id)
  loop
    perform public.employee_wallet_seed_agreement_from_fixed_asset(p_store_id, v_row.employee_id);
    v_seeded_count := v_seeded_count + 1;
  end loop;

  return v_seeded_count;
end;
$$;

grant execute on function public.employee_wallet_backfill_seed_agreements(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 2) Backfill safe legacy transaction types into wallet ledger
-- Reliable mappings only:
--   tip_entry        -> earning / tip
--   salary_advance   -> payment / advance
--   payroll_settlement/payroll_carryover source_context -> payment / salary_payment
-- Uses source_event_id uniqueness for idempotency.
-- ------------------------------------------------------------
drop function if exists public.employee_wallet_backfill_legacy_transactions(uuid, uuid);

create or replace function public.employee_wallet_backfill_legacy_transactions(
  p_store_id uuid,
  p_employee_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_inserted_count integer := 0;
  v_row record;
  v_event_type public.employee_ledger_event_type;
  v_entry_kind public.employee_ledger_entry_kind;
  v_entry_subtype public.employee_ledger_entry_subtype;
  v_direction public.employee_ledger_direction;
  v_event_id uuid;
  v_entry_id uuid;
  v_source_event_id text;
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

  for v_row in
    select
      t.id,
      t.store_id,
      coalesce(t.employee_id, t.fixed_asset_id) as employee_id,
      t.type,
      t.amount,
      t.date,
      t.notes,
      t.method,
      t.created_at,
      t.payroll_cycle_start,
      t.payroll_cycle_end,
      t.source_context
    from public.transactions t
    where t.store_id = p_store_id
      and coalesce(t.employee_id, t.fixed_asset_id) is not null
      and t.voided_at is null
      and (p_employee_id is null or coalesce(t.employee_id, t.fixed_asset_id) = p_employee_id)
      and (
        t.type = 'tip_entry'
        or t.type = 'salary_advance'
        or coalesce(t.source_context, '') in ('payroll_settlement', 'payroll_carryover')
      )
    order by t.date asc, t.created_at asc
  loop
    v_source_event_id := format('legacy_tx:%s', v_row.id);

    if exists (
      select 1
      from public.employee_ledger_events e
      where e.organization_id = v_org_id
        and e.store_id = p_store_id
        and e.source_system = 'employee_wallet_backfill_v1'
        and e.source_event_id = v_source_event_id
    ) then
      continue;
    end if;

    if v_row.type = 'tip_entry' then
      v_event_type := 'earning_recorded';
      v_entry_kind := 'earning';
      v_entry_subtype := 'tip';
      v_direction := 'increase_balance';
    elsif v_row.type = 'salary_advance' then
      v_event_type := 'payment_recorded';
      v_entry_kind := 'payment';
      v_entry_subtype := 'advance';
      v_direction := 'decrease_balance';
    else
      v_event_type := 'payment_recorded';
      v_entry_kind := 'payment';
      v_entry_subtype := 'salary_payment';
      v_direction := 'decrease_balance';
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
      v_row.employee_id,
      v_event_type,
      'succeeded',
      'employee_wallet_backfill_v1',
      v_source_event_id,
      v_source_event_id,
      v_source_event_id,
      md5(v_source_event_id),
      coalesce(v_row.created_at, v_row.date::timestamptz),
      jsonb_build_object(
        'legacy_transaction_id', v_row.id,
        'source_context', v_row.source_context
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
      source_row_id,
      created_by,
      updated_by
    ) values (
      v_org_id,
      p_store_id,
      v_row.employee_id,
      v_event_id,
      v_entry_kind,
      v_entry_subtype,
      v_direction,
      abs(coalesce(v_row.amount, 0)),
      'EUR',
      v_row.date,
      coalesce(nullif(trim(coalesce(v_row.notes, '')), ''), initcap(replace(v_entry_subtype::text, '_', ' '))),
      nullif(trim(coalesce(v_row.notes, '')), ''),
      nullif(trim(coalesce(v_row.method, '')), ''),
      v_row.payroll_cycle_start,
      v_row.payroll_cycle_end,
      'posted',
      'transactions',
      v_row.id,
      v_user_id,
      v_user_id
    )
    returning id into v_entry_id;

    insert into public.employee_ledger_transaction_links (
      organization_id,
      store_id,
      ledger_entry_id,
      transaction_id,
      allocated_amount,
      allocation_currency,
      posting_role,
      reconciliation_status,
      created_by,
      updated_by
    ) values (
      v_org_id,
      p_store_id,
      v_entry_id,
      v_row.id,
      abs(coalesce(v_row.amount, 0)),
      'EUR',
      'primary',
      'reconciled',
      v_user_id,
      v_user_id
    );

    v_inserted_count := v_inserted_count + 1;
  end loop;

  return v_inserted_count;
end;
$$;

grant execute on function public.employee_wallet_backfill_legacy_transactions(uuid, uuid) to authenticated;

commit;

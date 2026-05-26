begin;

-- ============================================================
-- SAFE MINIMAL EXTENSION: supplier_credit_note in reporting RPCs
-- ============================================================
-- Keeps existing response shape backward compatible and adds:
-- - supplier_credit_notes in JSON payloads
-- - open_expense formula update for supplier branch
-- - voided rows excluded from totals

create or replace function public.get_entity_ytd_summary(
  p_store_id    uuid,
  p_entity_type text,
  p_entity_id   uuid,
  p_date_from   date,
  p_date_to     date
)
returns jsonb
language plpgsql
as $function$
declare
  v_caller_id uuid;
  result      jsonb;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Απαιτείται σύνδεση.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.store_access
    where user_id  = v_caller_id
      and store_id = p_store_id
  ) then
    raise exception 'Δεν έχετε πρόσβαση σε αυτό το κατάστημα.' using errcode = '42501';
  end if;

  if p_entity_type = 'revenue_source' then
    select jsonb_build_object(
      'turnover_income',
        coalesce(sum(case when type = 'income' then abs(amount) else 0 end), 0),
      'received_income',
        coalesce(sum(case when type in ('income_collection', 'debt_received') then abs(amount) else 0 end), 0),
      'credit_income',
        coalesce(sum(case when is_credit = true then abs(amount) else 0 end), 0),
      'open_income',
        coalesce(sum(case when is_credit = true then abs(amount) else 0 end), 0)
        -
        coalesce(sum(case when type in ('income_collection', 'debt_received') then abs(amount) else 0 end), 0),
      'total_expenses', 0,
      'payments', 0,
      'credit_expenses', 0,
      'supplier_credit_notes', 0,
      'open_expense', 0
    )
    into result
    from public.transactions
    where store_id = p_store_id
      and revenue_source_id = p_entity_id
      and date >= p_date_from
      and date <= p_date_to
      and voided_at is null;

  elsif p_entity_type = 'supplier' then
    select jsonb_build_object(
      'turnover_income', 0,
      'received_income', 0,
      'credit_income', 0,
      'open_income', 0,
      'total_expenses',
        coalesce(sum(case when type = 'expense' then abs(amount) else 0 end), 0),
      'payments',
        coalesce(sum(case when type = 'debt_payment' then abs(amount) else 0 end), 0),
      'credit_expenses',
        coalesce(sum(case when type = 'expense' and is_credit = true then abs(amount) else 0 end), 0),
      'supplier_credit_notes',
        coalesce(sum(case when type = 'supplier_credit_note' then abs(amount) else 0 end), 0),
      'open_expense',
        coalesce(sum(case when type = 'expense' and is_credit = true then abs(amount) else 0 end), 0)
        -
        coalesce(sum(case when type = 'debt_payment' then abs(amount) else 0 end), 0)
        -
        coalesce(sum(case when type = 'supplier_credit_note' then abs(amount) else 0 end), 0)
    )
    into result
    from public.transactions
    where store_id = p_store_id
      and supplier_id = p_entity_id
      and date >= p_date_from
      and date <= p_date_to
      and voided_at is null;

  elsif p_entity_type in ('fixed_asset', 'asset') then
    select jsonb_build_object(
      'turnover_income', 0,
      'received_income', 0,
      'credit_income', 0,
      'open_income', 0,
      'total_expenses',
        coalesce(sum(case when type = 'expense' then abs(amount) else 0 end), 0),
      'payments',
        coalesce(sum(case when type = 'debt_payment' then abs(amount) else 0 end), 0),
      'credit_expenses',
        coalesce(sum(case when type = 'expense' and is_credit = true then abs(amount) else 0 end), 0),
      'supplier_credit_notes', 0,
      'open_expense',
        coalesce(sum(case when type = 'expense' and is_credit = true then abs(amount) else 0 end), 0)
        -
        coalesce(sum(case when type = 'debt_payment' then abs(amount) else 0 end), 0)
    )
    into result
    from public.transactions
    where store_id = p_store_id
      and fixed_asset_id = p_entity_id
      and date >= p_date_from
      and date <= p_date_to
      and voided_at is null;

  else
    result := jsonb_build_object(
      'turnover_income', 0,
      'received_income', 0,
      'credit_income', 0,
      'open_income', 0,
      'total_expenses', 0,
      'payments', 0,
      'credit_expenses', 0,
      'supplier_credit_notes', 0,
      'open_expense', 0
    );
  end if;

  return result;
end;
$function$;

revoke execute on function public.get_entity_ytd_summary(uuid, text, uuid, date, date) from public;
grant execute on function public.get_entity_ytd_summary(uuid, text, uuid, date, date) to authenticated;

create or replace function public.get_daily_totals(
  p_store_id uuid,
  p_date     date
)
returns jsonb
language plpgsql
as $function$
declare
  v_caller_id uuid;
  result      jsonb;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Απαιτείται σύνδεση.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.store_access
    where user_id  = v_caller_id
      and store_id = p_store_id
  ) then
    raise exception 'Δεν έχετε πρόσβαση σε αυτό το κατάστημα.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'income',
      coalesce(sum(case when type in ('income', 'income_collection', 'debt_received') then amount else 0 end), 0),
    'expense',
      coalesce(sum(case when type in ('expense', 'debt_payment', 'salary_advance') then abs(amount) else 0 end), 0),
    'credits',
      coalesce(sum(case when type = 'expense' and is_credit = true then abs(amount) else 0 end), 0),
    'supplier_credit_notes',
      coalesce(sum(case when type = 'supplier_credit_note' then abs(amount) else 0 end), 0),
    'savings_deposits',
      coalesce(sum(case when type = 'savings_deposit' then abs(amount) else 0 end), 0),
    'savings_withdrawals',
      coalesce(sum(case when type = 'savings_withdrawal' then abs(amount) else 0 end), 0)
  )
  into result
  from public.transactions
  where store_id = p_store_id
    and date = p_date
    and voided_at is null;

  return result;
end;
$function$;

revoke execute on function public.get_daily_totals(uuid, date) from public;
grant execute on function public.get_daily_totals(uuid, date) to authenticated;

commit;

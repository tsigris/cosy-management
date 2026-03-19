begin;

-- =========================================
-- 1) Recreate views with security_invoker
--    instead of SECURITY DEFINER
-- =========================================
do $$
declare
  v_name text;
  v_def text;
  v_views text[] := array[
    'v_financial_balance',
    'v_cash_bank_balances_day',
    'v_financial_balances',
    'v_daily_split',
    'v_z_breakdown_day',
    'v_cash_bank_balances',
    'v_cash_drawer_today',
    'financial_summary'
  ];
begin
  foreach v_name in array v_views loop
    if to_regclass(format('public.%I', v_name)) is null then
      raise notice 'Skipping view public.% (not found)', v_name;
      continue;
    end if;

    select pg_get_viewdef(to_regclass(format('public.%I', v_name)), true)
    into v_def;

    if v_def is null or length(trim(v_def)) = 0 then
      raise notice 'Skipping view public.% (no definition found)', v_name;
      continue;
    end if;

    execute format(
      'create or replace view public.%I with (security_invoker=true) as %s',
      v_name,
      v_def
    );
  end loop;
end
$$;

-- =========================================
-- 2) ENABLE RLS ON store_members
-- =========================================
alter table public.store_members enable row level security;

drop policy if exists store_members_select_own on public.store_members;
create policy store_members_select_own
on public.store_members
for select
to authenticated
using (
  public.store_members.user_id = auth.uid()
);

drop policy if exists store_members_insert_owner on public.store_members;
create policy store_members_insert_owner
on public.store_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_members sm
    where sm.user_id = auth.uid()
      and sm.store_id = public.store_members.store_id
      and sm.role = 'owner'
  )
);

drop policy if exists store_members_update_owner on public.store_members;
create policy store_members_update_owner
on public.store_members
for update
to authenticated
using (
  exists (
    select 1
    from public.store_members sm
    where sm.user_id = auth.uid()
      and sm.store_id = public.store_members.store_id
      and sm.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.store_members sm
    where sm.user_id = auth.uid()
      and sm.store_id = public.store_members.store_id
      and sm.role = 'owner'
  )
);

drop policy if exists store_members_delete_owner on public.store_members;
create policy store_members_delete_owner
on public.store_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.store_members sm
    where sm.user_id = auth.uid()
      and sm.store_id = public.store_members.store_id
      and sm.role = 'owner'
  )
);

-- =========================================
-- 3) ENABLE RLS ON employee_days_off
-- =========================================
alter table public.employee_days_off enable row level security;

drop policy if exists employee_days_off_select_store_member on public.employee_days_off;
create policy employee_days_off_select_store_member
on public.employee_days_off
for select
to authenticated
using (
  exists (
    select 1
    from public.store_members sm
    where sm.user_id = auth.uid()
      and sm.store_id = public.employee_days_off.store_id
  )
);

drop policy if exists employee_days_off_insert_store_member on public.employee_days_off;
create policy employee_days_off_insert_store_member
on public.employee_days_off
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_members sm
    where sm.user_id = auth.uid()
      and sm.store_id = public.employee_days_off.store_id
  )
);

drop policy if exists employee_days_off_update_store_member on public.employee_days_off;
create policy employee_days_off_update_store_member
on public.employee_days_off
for update
to authenticated
using (
  exists (
    select 1
    from public.store_members sm
    where sm.user_id = auth.uid()
      and sm.store_id = public.employee_days_off.store_id
  )
)
with check (
  exists (
    select 1
    from public.store_members sm
    where sm.user_id = auth.uid()
      and sm.store_id = public.employee_days_off.store_id
  )
);

drop policy if exists employee_days_off_delete_store_member on public.employee_days_off;
create policy employee_days_off_delete_store_member
on public.employee_days_off
for delete
to authenticated
using (
  exists (
    select 1
    from public.store_members sm
    where sm.user_id = auth.uid()
      and sm.store_id = public.employee_days_off.store_id
  )
);

commit;
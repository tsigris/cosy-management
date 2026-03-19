begin;

-- Recreate target views with invoker security while preserving existing SELECT definitions.
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
      raise notice 'Skipping view %.% (not found)', 'public', v_name;
      continue;
    end if;

    select pg_get_viewdef(to_regclass(format('public.%I', v_name)), true)
      into v_def;

    if v_def is null or length(trim(v_def)) = 0 then
      raise notice 'Skipping view %.% (no definition found)', 'public', v_name;
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

-- Enable RLS and add store-scoped policies on store_members.
do $$
begin
  if to_regclass('public.store_members') is not null then
    alter table public.store_members enable row level security;

    drop policy if exists store_members_store_scope_select on public.store_members;
    create policy store_members_store_scope_select
    on public.store_members
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.store_access sa
        where sa.user_id = auth.uid()
          and sa.store_id = store_id
      )
    );

    drop policy if exists store_members_store_scope_insert on public.store_members;
    create policy store_members_store_scope_insert
    on public.store_members
    for insert
    to authenticated
    with check (
      exists (
        select 1
        from public.store_access sa
        where sa.user_id = auth.uid()
          and sa.store_id = store_id
      )
    );

    drop policy if exists store_members_store_scope_update on public.store_members;
    create policy store_members_store_scope_update
    on public.store_members
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.store_access sa
        where sa.user_id = auth.uid()
          and sa.store_id = store_id
      )
    )
    with check (
      exists (
        select 1
        from public.store_access sa
        where sa.user_id = auth.uid()
          and sa.store_id = store_id
      )
    );

    drop policy if exists store_members_store_scope_delete on public.store_members;
    create policy store_members_store_scope_delete
    on public.store_members
    for delete
    to authenticated
    using (
      exists (
        select 1
        from public.store_access sa
        where sa.user_id = auth.uid()
          and sa.store_id = store_id
      )
    );
  else
    raise notice 'Skipping table public.store_members (not found)';
  end if;
end
$$;

-- Enable RLS and add store-scoped policies on employee_days_off.
do $$
begin
  if to_regclass('public.employee_days_off') is not null then
    alter table public.employee_days_off enable row level security;

    drop policy if exists employee_days_off_store_scope_select on public.employee_days_off;
    create policy employee_days_off_store_scope_select
    on public.employee_days_off
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.store_access sa
        where sa.user_id = auth.uid()
          and sa.store_id = store_id
      )
    );

    drop policy if exists employee_days_off_store_scope_insert on public.employee_days_off;
    create policy employee_days_off_store_scope_insert
    on public.employee_days_off
    for insert
    to authenticated
    with check (
      exists (
        select 1
        from public.store_access sa
        where sa.user_id = auth.uid()
          and sa.store_id = store_id
      )
    );

    drop policy if exists employee_days_off_store_scope_update on public.employee_days_off;
    create policy employee_days_off_store_scope_update
    on public.employee_days_off
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.store_access sa
        where sa.user_id = auth.uid()
          and sa.store_id = store_id
      )
    )
    with check (
      exists (
        select 1
        from public.store_access sa
        where sa.user_id = auth.uid()
          and sa.store_id = store_id
      )
    );

    drop policy if exists employee_days_off_store_scope_delete on public.employee_days_off;
    create policy employee_days_off_store_scope_delete
    on public.employee_days_off
    for delete
    to authenticated
    using (
      exists (
        select 1
        from public.store_access sa
        where sa.user_id = auth.uid()
          and sa.store_id = store_id
      )
    );
  else
    raise notice 'Skipping table public.employee_days_off (not found)';
  end if;
end
$$;

commit;

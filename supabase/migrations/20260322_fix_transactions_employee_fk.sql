begin;

-- Ensure employee_id remains UUID before changing FK wiring.
do $$
declare
  v_employee_id_type text;
  v_fixed_assets_id_type text;
begin
  select c.data_type
    into v_employee_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'transactions'
    and c.column_name = 'employee_id';

  select c.data_type
    into v_fixed_assets_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'fixed_assets'
    and c.column_name = 'id';

  if v_employee_id_type is distinct from 'uuid' then
    raise exception 'Expected public.transactions.employee_id to be uuid, got %', coalesce(v_employee_id_type, 'null');
  end if;

  if v_fixed_assets_id_type is distinct from 'uuid' then
    raise exception 'Expected public.fixed_assets.id to be uuid, got %', coalesce(v_fixed_assets_id_type, 'null');
  end if;
end
$$;

-- Drop legacy FK that incorrectly points to public.employees.
alter table public.transactions
  drop constraint if exists transactions_employee_id_fkey;

-- Add compatibility FK to public.fixed_assets(id).
-- NOT VALID keeps migration safe on existing data while enforcing new writes.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'transactions'
      and c.conname = 'transactions_employee_id_fixed_assets_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_employee_id_fixed_assets_fkey
      foreign key (employee_id)
      references public.fixed_assets(id)
      on update cascade
      on delete set null
      not valid;
  end if;
end
$$;

commit;

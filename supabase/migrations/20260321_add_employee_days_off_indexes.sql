-- Safe index alignment for public.employee_days_off date column variants.
-- Creates indexes only for the real existing date column (off_date preferred, otherwise date).

create index if not exists idx_employee_days_off_store_employee
  on public.employee_days_off (store_id, employee_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employee_days_off'
      and column_name = 'off_date'
  ) then
    create index if not exists idx_employee_days_off_store_off_date
      on public.employee_days_off (store_id, off_date);

    create index if not exists idx_employee_days_off_employee_off_date
      on public.employee_days_off (employee_id, off_date);

  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employee_days_off'
      and column_name = 'date'
  ) then
    create index if not exists idx_employee_days_off_store_date
      on public.employee_days_off (store_id, date);

    create index if not exists idx_employee_days_off_employee_date
      on public.employee_days_off (employee_id, date);
  end if;
end
$$;
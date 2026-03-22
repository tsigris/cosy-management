begin;

alter table public.employee_days_off enable row level security;

drop policy if exists employee_days_off_select_store_member on public.employee_days_off;
drop policy if exists employee_days_off_insert_store_member on public.employee_days_off;
drop policy if exists employee_days_off_update_store_member on public.employee_days_off;
drop policy if exists employee_days_off_delete_store_member on public.employee_days_off;

drop policy if exists employee_days_off_select_store_access on public.employee_days_off;
drop policy if exists employee_days_off_insert_store_access on public.employee_days_off;
drop policy if exists employee_days_off_update_store_access on public.employee_days_off;
drop policy if exists employee_days_off_delete_store_access on public.employee_days_off;

create policy employee_days_off_select_store_access
on public.employee_days_off
for select
to authenticated
using (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = public.employee_days_off.store_id
  )
);

create policy employee_days_off_insert_store_access
on public.employee_days_off
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = public.employee_days_off.store_id
  )
);

create policy employee_days_off_update_store_access
on public.employee_days_off
for update
to authenticated
using (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = public.employee_days_off.store_id
  )
)
with check (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = public.employee_days_off.store_id
  )
);

create policy employee_days_off_delete_store_access
on public.employee_days_off
for delete
to authenticated
using (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = public.employee_days_off.store_id
  )
);

commit;

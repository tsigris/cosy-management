begin;

with ranked as (
  select
    ctid,
    row_number() over (partition by user_id, store_id order by ctid) as rn
  from public.store_access
)
delete from public.store_access sa
using ranked r
where sa.ctid = r.ctid
  and r.rn > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_access_user_id_store_id_key'
      and conrelid = 'public.store_access'::regclass
  ) then
    alter table public.store_access
      add constraint store_access_user_id_store_id_key
      unique (user_id, store_id);
  end if;
end
$$;

commit;

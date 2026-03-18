create or replace function public.get_analysis_expected_outflows(
  p_store_id  uuid,
  p_start_date date,
  p_end_date  date
) returns table (
  id     uuid,
  date   date,
  amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: missing authenticated user';
  end if;

  if not exists (
    select 1
    from public.store_access sa
    where sa.user_id  = auth.uid()
      and sa.store_id = p_store_id
      and (sa.role = 'admin' or sa.can_view_analysis = true)
  ) then
    raise exception 'Forbidden: analysis access required for store %', p_store_id;
  end if;

  return query
  select
    t.id,
    t.date,
    t.amount
  from public.transactions t
  where t.store_id = p_store_id
    and t.type    in ('expense', 'debt_payment', 'salary_advance')
    and t.date     > p_end_date
    and t.date    <= p_end_date + interval '30 days'
    and coalesce(t.is_credit, false) = false
    and coalesce(t.method, '')      != 'Πίστωση'
  order by t.date asc;
end;
$$;

revoke execute on function public.get_analysis_expected_outflows(uuid, date, date) from public;
grant  execute on function public.get_analysis_expected_outflows(uuid, date, date) to authenticated;

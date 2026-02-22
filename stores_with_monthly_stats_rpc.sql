-- Optional RPC for single-call store list + monthly stats.
-- Run in Supabase SQL editor after adapting table/column names if needed.

create or replace function public.get_user_stores_with_monthly_stats()
returns table (
  store_id uuid,
  store_name text,
  income numeric,
  expenses numeric,
  profit numeric,
  last_updated date
)
language sql
security invoker
set search_path = public
as $$
  with my_stores as (
    select s.id, s.name
    from public.store_access sa
    join public.stores s on s.id = sa.store_id
    where sa.user_id = auth.uid()
  ),
  monthly_tx as (
    select
      t.store_id,
      sum(case when t.type = 'income' then coalesce(t.amount, 0) else 0 end) as income,
      sum(case when t.type in ('expense', 'debt_payment') then abs(coalesce(t.amount, 0)) else 0 end) as expenses,
      max(t.date) as last_updated
    from public.transactions t
    where t.store_id in (select id from my_stores)
      and t.date >= date_trunc('month', now())::date
    group by t.store_id
  )
  select
    ms.id as store_id,
    ms.name as store_name,
    coalesce(mt.income, 0) as income,
    coalesce(mt.expenses, 0) as expenses,
    coalesce(mt.income, 0) - coalesce(mt.expenses, 0) as profit,
    mt.last_updated
  from my_stores ms
  left join monthly_tx mt on mt.store_id = ms.id
  order by ms.name;
$$;

grant execute on function public.get_user_stores_with_monthly_stats() to authenticated;

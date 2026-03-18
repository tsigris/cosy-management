create or replace function public.get_analysis_period_movements(
  p_store_id uuid,
  p_start_date date,
  p_end_date date
) returns table (
  id uuid,
  date date,
  amount numeric,
  type text,
  method text,
  category text,
  notes text,
  party_name text,
  is_credit boolean,
  is_verified boolean,
  created_at timestamptz
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
    where sa.user_id = auth.uid()
      and sa.store_id = p_store_id
      and (sa.role = 'admin' or sa.can_view_analysis = true)
  ) then
    raise exception 'Forbidden: analysis access required for store %', p_store_id;
  end if;

  return query
  select
    t.id,
    t.date,
    t.amount,
    t.type,
    coalesce(nullif(trim(t.payment_method), ''), nullif(trim(t.method), ''), '') as method,
    t.category,
    t.notes,
    case
      when t.type = 'savings_deposit' then 'ΚΑΤΑΘΕΣΗ ΣΕ ΚΟΥΜΠΑΡΑ'
      when t.type = 'savings_withdrawal' then 'ΑΝΑΛΗΨΗ ΑΠΟ ΚΟΥΜΠΑΡΑ'
      when t.revenue_source_id is not null then coalesce(rs.name, 'Πηγή Εσόδων')
      when lower(coalesce(fa.sub_category, '')) = 'staff' then coalesce(fa.name, 'Υπάλληλος')
      when t.supplier_id is not null then coalesce(s.name, 'Προμηθευτής')
      when t.fixed_asset_id is not null then coalesce(fa.name, '-')
      when t.type = 'tip_entry' then coalesce(fa.name, 'Tips')
      else coalesce(nullif(trim(t.category), ''), '-')
    end as party_name,
    coalesce(t.is_credit, false) as is_credit,
    t.is_verified,
    t.created_at
  from public.transactions t
  left join public.suppliers s
    on s.id = t.supplier_id
   and s.store_id = p_store_id
  left join public.fixed_assets fa
    on fa.id = t.fixed_asset_id
   and fa.store_id = p_store_id
  left join public.revenue_sources rs
    on rs.id = t.revenue_source_id
   and rs.store_id = p_store_id
  where t.store_id = p_store_id
    and t.date between p_start_date and p_end_date
    and not (t.type = 'income' and t.category = 'Εσοδα Ζ')
  order by t.date desc, t.created_at desc;
end;
$$;

revoke execute on function public.get_analysis_period_movements(uuid, date, date) from public;
grant execute on function public.get_analysis_period_movements(uuid, date, date) to authenticated;
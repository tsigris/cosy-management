-- Fix supplier turnover: exclude debt_payment from total in entity summary

CREATE OR REPLACE FUNCTION public.get_analysis_entity_summary(
  p_store_id uuid,
  p_start_date date,
  p_end_date date,
  p_filter_a text
)
RETURNS TABLE(entity_id text, entity_name text, total numeric, paid numeric, credit numeric)
LANGUAGE plpgsql
AS $function$
begin
  return query
  with base as (
    select
      t.amount,
      t.type,
      t.is_credit,
      t.supplier_id,
      t.employee_id,
      t.fixed_asset_id,
      t.category,
      s.name as supplier_name,
      fa.name as fixed_asset_name,
      fa.sub_category as fixed_asset_sub_category
    from public.transactions t
    left join public.suppliers s
      on s.id = t.supplier_id
    left join public.fixed_assets fa
        on (fa.id = t.employee_id or fa.id = t.fixed_asset_id)
    where t.store_id = p_store_id
      and t.date >= p_start_date
      and t.date <= p_end_date
      and t.type in ('expense', 'debt_payment', 'salary_advance')
  ),
  normalized as (
    select
      *,
      case
        when lower(coalesce(fixed_asset_sub_category, '')) = 'staff' then coalesce(employee_id, fixed_asset_id)
        else fixed_asset_id
      end as resolved_asset_id,
      case
        when supplier_id is not null then 'Εμπορεύματα'
        when lower(coalesce(fixed_asset_sub_category, '')) = 'staff' then 'Staff'
        when lower(coalesce(fixed_asset_sub_category, '')) in ('utility', 'utilities') then 'Utilities'
        when lower(coalesce(fixed_asset_sub_category, '')) in ('worker', 'maintenance') then 'Maintenance'
        else 'Other'
      end as normalized_category
    from base
  ),
  filtered as (
    select *
    from normalized
    where
      case
        when p_filter_a = 'Εμπορεύματα' then normalized_category = 'Εμπορεύματα'
        when p_filter_a = 'Προσωπικό' then normalized_category = 'Staff'
        when p_filter_a = 'Λογαριασμοί' then normalized_category = 'Utilities'
        when p_filter_a = 'Συντήρηση' then normalized_category = 'Maintenance'
        when p_filter_a = 'Λοιπά' then normalized_category = 'Other'
        when p_filter_a = 'Όλες' then true
        else true
      end
  )
  select
    case
      when p_filter_a = 'Εμπορεύματα' then coalesce(supplier_id::text, '')
      when p_filter_a = 'Προσωπικό' then coalesce(resolved_asset_id::text, '')
      when p_filter_a = 'Συντήρηση' then coalesce(fixed_asset_id::text, '')
      else normalized_category
    end as entity_id,

    case
      when p_filter_a = 'Εμπορεύματα' then coalesce(supplier_name, 'Προμηθευτής')
      when p_filter_a = 'Προσωπικό' then coalesce(fixed_asset_name, 'Υπάλληλος')
      when p_filter_a = 'Συντήρηση' then coalesce(fixed_asset_name, 'Μάστορας')
      else
        case normalized_category
          when 'Εμπορεύματα' then 'Εμπορεύματα'
          when 'Staff' then 'Προσωπικό'
          when 'Utilities' then 'Λογαριασμοί'
          when 'Maintenance' then 'Συντήρηση'
          else 'Λοιπά'
        end
    end as entity_name,

    coalesce(sum(case when type in ('expense', 'salary_advance') then abs(amount) else 0 end), 0) as total,
    coalesce(sum(case when coalesce(is_credit, false) = false then abs(amount) else 0 end), 0) as paid,
    coalesce(sum(case when coalesce(is_credit, false) = true then abs(amount) else 0 end), 0) as credit
  from filtered
  where
    case
      when p_filter_a in ('Εμπορεύματα', 'Προσωπικό', 'Συντήρηση')
        then coalesce(
          case
            when p_filter_a = 'Εμπορεύματα' then supplier_id::text
            when p_filter_a = 'Προσωπικό' then resolved_asset_id::text
            else fixed_asset_id::text
          end,
          ''
        ) <> ''
      else true
    end
  group by 1, 2
  order by total desc;
end;
$function$;

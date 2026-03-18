-- =========================================
-- RESTORE ANALYSIS FUNCTIONS
-- Using live Supabase DDL provided
-- Plus canonical fix for expected_outflows
-- =========================================

-- Needed because return type changes from rows -> total
DROP FUNCTION IF EXISTS public.get_analysis_expected_outflows(uuid, date, date);

-- =========================================
-- get_analysis_expected_outflows (FIXED)
-- canonical credit rule = is_credit only
-- =========================================

CREATE OR REPLACE FUNCTION public.get_analysis_expected_outflows(
  p_store_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(total numeric)
LANGUAGE sql
STABLE
AS $function$
  select coalesce(sum(abs(t.amount)), 0)::numeric as total
  from public.transactions t
  where t.store_id = p_store_id
    and t.date > p_end_date
    and t.date <= (p_end_date + interval '30 day')::date
    and t.type in ('expense', 'debt_payment', 'salary_advance')
    and coalesce(t.is_credit, false) = false;
$function$;

-- =========================================
-- get_analysis_category_breakdown
-- =========================================

CREATE OR REPLACE FUNCTION public.get_analysis_category_breakdown(
  p_store_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(category_key text, total numeric)
LANGUAGE plpgsql
AS $function$
begin
  return query
  with filtered as (
    select
      t.amount,
      t.type,
      t.is_credit,
      t.category,
      t.supplier_id,
      fa.sub_category
    from public.transactions t
    left join public.fixed_assets fa
      on fa.id = t.fixed_asset_id
    where t.store_id = p_store_id
      and t.date >= p_start_date
      and t.date <= p_end_date
      and coalesce(lower(t.category), '') not in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
      and t.type in ('expense', 'debt_payment', 'salary_advance')
      and coalesce(t.is_credit, false) = false
  )
  select
    case
      when supplier_id is not null then 'Εμπορεύματα'
      when lower(coalesce(sub_category, '')) = 'staff' then 'Staff'
      when lower(coalesce(sub_category, '')) in ('utility', 'utilities') then 'Utilities'
      when lower(coalesce(sub_category, '')) in ('worker', 'maintenance') then 'Maintenance'
      else 'Other'
    end as category_key,
    coalesce(sum(abs(amount)), 0) as total
  from filtered
  group by 1
  order by 2 desc;
end;
$function$;

-- =========================================
-- get_analysis_collapsed_period
-- =========================================

CREATE OR REPLACE FUNCTION public.get_analysis_collapsed_period(
  p_store_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(date date, cash_z numeric, card_z numeric, total_z numeric)
LANGUAGE sql
STABLE
AS $function$
  select
    t.date,
    coalesce(sum(case when t.method = 'Μετρητά (Z)' then t.amount else 0 end), 0) as cash_z,
    coalesce(sum(case when t.method = 'Κάρτα' then t.amount else 0 end), 0) as card_z,
    coalesce(sum(t.amount), 0) as total_z
  from transactions t
  where t.store_id = p_store_id
    and t.type = 'income'
    and t.category = 'Εσοδα Ζ'
    and t.date between p_start_date and p_end_date
  group by t.date
  order by t.date desc;
$function$;

-- =========================================
-- get_analysis_detail_summary
-- =========================================

CREATE OR REPLACE FUNCTION public.get_analysis_detail_summary(
  p_store_id uuid,
  p_start_date date,
  p_end_date date,
  p_entity_type text,
  p_entity_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
with rows_base as (
  select
    t.*
  from public.transactions t
  where t.store_id = p_store_id
    and t.date >= p_start_date
    and t.date <= p_end_date
    and (
      (p_entity_type = 'staff' and t.fixed_asset_id = p_entity_id)
      or
      (p_entity_type = 'maintenance' and t.fixed_asset_id = p_entity_id)
      or
      (p_entity_type = 'supplier' and t.supplier_id = p_entity_id)
      or
      (p_entity_type = 'revenue_source' and t.revenue_source_id = p_entity_id)
    )
),
expense_rows as (
  select *
  from rows_base
  where type in ('expense', 'debt_payment')
),
paid_rows as (
  select *
  from expense_rows
  where coalesce(is_credit, false) = false
),
credit_rows as (
  select *
  from expense_rows
  where coalesce(is_credit, false) = true
),
paid_summary as (
  select
    coalesce(sum(
      case
        when lower(coalesce(method, '')) in ('μετρητά', 'μετρητά (z)', 'χωρίς απόδειξη')
        then abs(amount) else 0 end
    ), 0) as paid_cash,
    coalesce(sum(
      case
        when lower(coalesce(method, '')) in ('κάρτα', 'τράπεζα')
        then abs(amount) else 0 end
    ), 0) as paid_bank,
    coalesce(sum(abs(amount)), 0) as paid_total,
    count(*)::int as count_paid
  from paid_rows
),
credit_summary as (
  select
    coalesce(sum(abs(amount)), 0) as credit_total,
    count(*)::int as count_credit
  from credit_rows
),
credit_rows_json as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'date', date,
      'amount', amount,
      'notes', notes,
      'category', category,
      'method', method,
      'is_credit', is_credit
    )
    order by date desc, created_at desc
  ), '[]'::jsonb) as rows_json
  from (
    select *
    from credit_rows
    order by date desc, created_at desc
    limit 10
  ) x
)
select jsonb_build_object(
  'paidCash', ps.paid_cash,
  'paidBank', ps.paid_bank,
  'paidTotal', ps.paid_total,
  'creditTotal', cs.credit_total,
  'countPaid', ps.count_paid,
  'countCredit', cs.count_credit,
  'totalAll', ps.paid_total + cs.credit_total,
  'creditRows', crj.rows_json
)
from paid_summary ps
cross join credit_summary cs
cross join credit_rows_json crj;
$function$;

-- =========================================
-- get_analysis_entity_summary
-- =========================================

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
      t.fixed_asset_id,
      t.category,
      s.name as supplier_name,
      fa.name as fixed_asset_name,
      fa.sub_category as fixed_asset_sub_category
    from public.transactions t
    left join public.suppliers s
      on s.id = t.supplier_id
    left join public.fixed_assets fa
      on fa.id = t.fixed_asset_id
    where t.store_id = p_store_id
      and t.date >= p_start_date
      and t.date <= p_end_date
      and t.type in ('expense', 'debt_payment', 'salary_advance')
  ),
  normalized as (
    select
      *,
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
      when p_filter_a = 'Προσωπικό' then coalesce(fixed_asset_id::text, '')
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

    coalesce(sum(abs(amount)), 0) as total,
    coalesce(sum(case when coalesce(is_credit, false) = false then abs(amount) else 0 end), 0) as paid,
    coalesce(sum(case when coalesce(is_credit, false) = true then abs(amount) else 0 end), 0) as credit
  from filtered
  where
    case
      when p_filter_a in ('Εμπορεύματα', 'Προσωπικό', 'Συντήρηση')
        then coalesce(
          case
            when p_filter_a = 'Εμπορεύματα' then supplier_id::text
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

-- =========================================
-- get_analysis_pro_stats
-- =========================================

CREATE OR REPLACE FUNCTION public.get_analysis_pro_stats(
  p_store_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
with base as (
  select *
  from public.transactions t
  where t.store_id = p_store_id
    and t.date >= p_start_date
    and t.date <= p_end_date
    and coalesce(t.is_credit, false) = false
),
expense_docs as (
  select
    coalesce(sum(
      case
        when t.type in ('expense', 'debt_payment', 'salary_advance')
         and lower(coalesce(t.category, '')) not in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
         and lower(coalesce(t.notes, '')) like 'απόδειξη λιανικής%'
        then abs(t.amount) else 0 end
    ), 0) as retail_amount,
    coalesce(sum(
      case
        when t.type in ('expense', 'debt_payment', 'salary_advance')
         and lower(coalesce(t.category, '')) not in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
         and lower(coalesce(t.notes, '')) like 'τιμολόγιο%'
        then abs(t.amount) else 0 end
    ), 0) as invoice_amount,
    coalesce(sum(
      case
        when t.type in ('expense', 'debt_payment', 'salary_advance')
         and lower(coalesce(t.category, '')) not in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
         and lower(coalesce(t.notes, '')) like 'χωρίς τιμολόγιο%'
        then abs(t.amount) else 0 end
    ), 0) as no_invoice_amount,
    coalesce(sum(
      case
        when t.type in ('expense', 'debt_payment', 'salary_advance')
         and lower(coalesce(t.category, '')) not in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
         and lower(coalesce(t.notes, '')) not like 'απόδειξη λιανικής%'
         and lower(coalesce(t.notes, '')) not like 'τιμολόγιο%'
         and lower(coalesce(t.notes, '')) not like 'χωρίς τιμολόγιο%'
        then abs(t.amount) else 0 end
    ), 0) as unknown_amount,

    coalesce(sum(
      case
        when t.type in ('expense', 'debt_payment', 'salary_advance')
         and lower(coalesce(t.category, '')) not in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
         and lower(coalesce(t.notes, '')) like 'απόδειξη λιανικής%'
        then 1 else 0 end
    ), 0) as retail_count,
    coalesce(sum(
      case
        when t.type in ('expense', 'debt_payment', 'salary_advance')
         and lower(coalesce(t.category, '')) not in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
         and lower(coalesce(t.notes, '')) like 'τιμολόγιο%'
        then 1 else 0 end
    ), 0) as invoice_count,
    coalesce(sum(
      case
        when t.type in ('expense', 'debt_payment', 'salary_advance')
         and lower(coalesce(t.category, '')) not in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
         and lower(coalesce(t.notes, '')) like 'χωρίς τιμολόγιο%'
        then 1 else 0 end
    ), 0) as no_invoice_count,
    coalesce(sum(
      case
        when t.type in ('expense', 'debt_payment', 'salary_advance')
         and lower(coalesce(t.category, '')) not in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
         and lower(coalesce(t.notes, '')) not like 'απόδειξη λιανικής%'
         and lower(coalesce(t.notes, '')) not like 'τιμολόγιο%'
         and lower(coalesce(t.notes, '')) not like 'χωρίς τιμολόγιο%'
        then 1 else 0 end
    ), 0) as unknown_count
  from base t
),
capital_transfers as (
  select
    coalesce(sum(
      case
        when lower(coalesce(category, '')) in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
         and type in ('expense', 'debt_payment', 'salary_advance')
        then abs(amount) else 0 end
    ), 0) as out_amount,
    coalesce(sum(
      case
        when lower(coalesce(category, '')) in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
         and type in ('income', 'income_collection', 'debt_received')
        then abs(amount) else 0 end
    ), 0) as in_amount,
    coalesce(sum(
      case
        when lower(coalesce(category, '')) in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
         and type in ('expense', 'debt_payment', 'salary_advance')
        then 1 else 0 end
    ), 0) as out_count,
    coalesce(sum(
      case
        when lower(coalesce(category, '')) in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
         and type in ('income', 'income_collection', 'debt_received')
        then 1 else 0 end
    ), 0) as in_count
  from base
),
finance_checks as (
  select
    coalesce(sum(
      case
        when type in ('expense', 'debt_payment', 'salary_advance')
         and (
           lower(coalesce(category, '')) like '%δάνει%'
           or lower(coalesce(category, '')) like '%loan%'
           or lower(coalesce(notes, '')) like '%δάνει%'
           or lower(coalesce(notes, '')) like '%loan%'
         )
        then abs(amount) else 0 end
    ), 0) as loan_out,
    coalesce(sum(
      case
        when type in ('income', 'income_collection', 'debt_received')
         and (
           lower(coalesce(category, '')) like '%δάνει%'
           or lower(coalesce(category, '')) like '%loan%'
           or lower(coalesce(notes, '')) like '%δάνει%'
           or lower(coalesce(notes, '')) like '%loan%'
         )
        then abs(amount) else 0 end
    ), 0) as loan_in,
    coalesce(sum(
      case
        when type in ('expense', 'debt_payment', 'salary_advance')
         and (
           lower(coalesce(category, '')) like '%ρύθμι%'
           or lower(coalesce(category, '')) like '%εφορία%'
           or lower(coalesce(category, '')) like '%tax%'
           or lower(coalesce(notes, '')) like '%ρύθμι%'
           or lower(coalesce(notes, '')) like '%εφορία%'
         )
        then abs(amount) else 0 end
    ), 0) as settlement_out
  from base
)
select jsonb_build_object(
  'expense_docs', jsonb_build_object(
    'retail', jsonb_build_object(
      'amount', ed.retail_amount,
      'count', ed.retail_count
    ),
    'invoice', jsonb_build_object(
      'amount', ed.invoice_amount,
      'count', ed.invoice_count
    ),
    'no_invoice', jsonb_build_object(
      'amount', ed.no_invoice_amount,
      'count', ed.no_invoice_count
    ),
    'unknown', jsonb_build_object(
      'amount', ed.unknown_amount,
      'count', ed.unknown_count
    ),
    'total', ed.retail_amount + ed.invoice_amount + ed.no_invoice_amount + ed.unknown_amount
  ),
  'capital_transfers', jsonb_build_object(
    'out', ct.out_amount,
    'in', ct.in_amount,
    'net', ct.in_amount - ct.out_amount,
    'countOut', ct.out_count,
    'countIn', ct.in_count
  ),
  'finance', jsonb_build_object(
    'loanOut', fc.loan_out,
    'loanIn', fc.loan_in,
    'settlementOut', fc.settlement_out
  )
)
from expense_docs ed
cross join capital_transfers ct
cross join finance_checks fc;
$function$;

-- =========================================
-- get_analysis_staff_payroll (range)
-- =========================================

CREATE OR REPLACE FUNCTION public.get_analysis_staff_payroll(
  p_store_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(name text, amount numeric)
LANGUAGE sql
STABLE
AS $function$
  select
    coalesce(fa.name, 'Άγνωστος')::text as name,
    coalesce(sum(abs(t.amount)), 0)::numeric as amount
  from public.transactions t
  left join public.fixed_assets fa
    on fa.id = t.fixed_asset_id
  where t.store_id = p_store_id
    and t.date >= p_start_date
    and t.date <= p_end_date
    and t.type in ('expense', 'debt_payment', 'salary_advance')
    and coalesce(t.is_credit, false) = false
    and lower(coalesce(fa.sub_category, '')) = 'staff'
    and lower(coalesce(t.category, '')) not in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου')
  group by fa.name
  order by amount desc, name asc;
$function$;

-- =========================================
-- get_analysis_staff_payroll (month overload)
-- =========================================

CREATE OR REPLACE FUNCTION public.get_analysis_staff_payroll(
  p_store_id uuid,
  p_year integer,
  p_month integer
)
RETURNS TABLE(name text, amount numeric)
LANGUAGE sql
STABLE
AS $function$
  select
    coalesce(fa.name, 'Άγνωστος')::text as name,
    coalesce(sum(abs(t.amount)), 0)::numeric as amount
  from public.transactions t
  left join public.fixed_assets fa
    on fa.id = t.fixed_asset_id
  where t.store_id = p_store_id
    and extract(year from t.date) = p_year
    and extract(month from t.date) = p_month
    and t.type in ('expense', 'debt_payment', 'salary_advance')
    and coalesce(t.is_credit, false) = false
    and lower(coalesce(fa.sub_category, '')) = 'staff'
  group by fa.name
  order by amount desc, name asc;
$function$;

-- =========================================
-- get_analysis_summary
-- =========================================

CREATE OR REPLACE FUNCTION public.get_analysis_summary(
  p_store_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
declare
  v_income numeric := 0;
  v_expenses numeric := 0;
  v_tips numeric := 0;
  v_savings_deposits numeric := 0;
  v_savings_withdrawals numeric := 0;
  v_cash_balance numeric := 0;
  v_bank_balance numeric := 0;
  v_credit_outstanding numeric := 0;
  v_credit_incoming numeric := 0;
begin
  select
    coalesce(sum(
      case
        when type = 'income'
         and coalesce(is_credit, false) = false
        then amount
        else 0
      end
    ), 0),

    coalesce(sum(
      case
        when type in ('expense', 'debt_payment', 'salary_advance')
         and coalesce(is_credit, false) = false
        then abs(amount)
        else 0
      end
    ), 0),

    coalesce(sum(
      case
        when type = 'savings_deposit'
         and coalesce(is_credit, false) = false
        then abs(amount)
        else 0
      end
    ), 0),

    coalesce(sum(
      case
        when type = 'savings_withdrawal'
         and coalesce(is_credit, false) = false
        then abs(amount)
        else 0
      end
    ), 0),

    coalesce(sum(
      case
        when coalesce(is_credit, false) = false
         and method in ('Μετρητά', 'Μετρητά (Z)')
        then
          case
            when type in ('expense', 'debt_payment', 'salary_advance', 'savings_deposit')
              then -abs(amount)
            else abs(amount)
          end
        else 0
      end
    ), 0),

    coalesce(sum(
      case
        when coalesce(is_credit, false) = false
         and method in ('Κάρτα', 'Τράπεζα')
        then
          case
            when type in ('expense', 'debt_payment', 'salary_advance', 'savings_deposit')
              then -abs(amount)
            else abs(amount)
          end
        else 0
      end
    ), 0),

    coalesce(sum(
      case
        when coalesce(is_credit, false) = true
         and type in ('expense', 'debt_payment', 'salary_advance')
        then abs(amount)
        else 0
      end
    ), 0),

    coalesce(sum(
      case
        when coalesce(is_credit, false) = true
         and type = 'income'
        then abs(amount)
        else 0
      end
    ), 0)

  into
    v_income,
    v_expenses,
    v_savings_deposits,
    v_savings_withdrawals,
    v_cash_balance,
    v_bank_balance,
    v_credit_outstanding,
    v_credit_incoming
  from public.transactions
  where store_id = p_store_id
    and date >= p_start_date
    and date <= p_end_date
    and lower(coalesce(category, '')) not in ('μεταφορά κεφαλαίων', 'μεταφορά κεφαλαίου');

  return jsonb_build_object(
    'income', v_income,
    'expenses', v_expenses,
    'tips', v_tips,
    'net_profit', v_income - v_expenses,
    'savings_deposits', v_savings_deposits,
    'savings_withdrawals', v_savings_withdrawals,
    'cash_balance', v_cash_balance,
    'bank_balance', v_bank_balance,
    'total_balance', v_cash_balance + v_bank_balance,
    'credit_outstanding', v_credit_outstanding,
    'credit_incoming', v_credit_incoming
  );
end;
$function$;

-- =========================================
-- get_analysis_z_bank
-- =========================================

CREATE OR REPLACE FUNCTION public.get_analysis_z_bank(
  p_store_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(total numeric)
LANGUAGE sql
STABLE
AS $function$
  select coalesce(sum(amount), 0)::numeric as total
  from public.transactions
  where store_id = p_store_id
    and date >= p_start_date
    and date <= p_end_date
    and type = 'income'
    and coalesce(is_credit, false) = false
    and lower(coalesce(category, '')) = lower('Εσοδα Ζ')
    and lower(coalesce(method, '')) in ('κάρτα', 'τράπεζα');
$function$;
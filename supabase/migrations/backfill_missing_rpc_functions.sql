BEGIN;

-- get_daily_totals
CREATE OR REPLACE FUNCTION public.get_daily_totals(
  p_store_id uuid,
  p_date date
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'income',
      coalesce(sum(case
        when type in ('income','income_collection','debt_received')
        then amount
        else 0
      end), 0),

    'expense',
      coalesce(sum(case
        when type in ('expense','debt_payment','salary_advance')
        then abs(amount)
        else 0
      end), 0),

    'credits',
      coalesce(sum(case
        when type = 'expense' and is_credit = true
        then abs(amount)
        else 0
      end), 0),

    'savings_deposits',
      coalesce(sum(case
        when type = 'savings_deposit'
        then abs(amount)
        else 0
      end), 0),

    'savings_withdrawals',
      coalesce(sum(case
        when type = 'savings_withdrawal'
        then abs(amount)
        else 0
      end), 0)
  )
  into result
  from public.transactions
  where store_id = p_store_id
    and date = p_date;

  return result;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.get_daily_totals(uuid, date) TO authenticated;


-- get_entity_ytd_summary
CREATE OR REPLACE FUNCTION public.get_entity_ytd_summary(
  p_store_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_date_from date,
  p_date_to date
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
declare
  result jsonb;
begin
  if p_entity_type = 'revenue_source' then
    select jsonb_build_object(
      'turnover_income',
        coalesce(sum(case
          when type = 'income' then abs(amount)
          else 0
        end), 0),

      'received_income',
        coalesce(sum(case
          when type in ('income_collection', 'debt_received') then abs(amount)
          else 0
        end), 0),

      'credit_income',
        coalesce(sum(case
          when is_credit = true then abs(amount)
          else 0
        end), 0),

      'open_income',
        coalesce(sum(case
          when is_credit = true then abs(amount)
          else 0
        end), 0)
        -
        coalesce(sum(case
          when type in ('income_collection', 'debt_received') then abs(amount)
          else 0
        end), 0),

      'total_expenses', 0,
      'payments', 0,
      'credit_expenses', 0,
      'open_expense', 0
    )
    into result
    from public.transactions
    where store_id = p_store_id
      and revenue_source_id = p_entity_id
      and date >= p_date_from
      and date <= p_date_to;

  elsif p_entity_type = 'supplier' then
    select jsonb_build_object(
      'turnover_income', 0,
      'received_income', 0,
      'credit_income', 0,
      'open_income', 0,

      'total_expenses',
        coalesce(sum(case
          when type = 'expense' then abs(amount)
          else 0
        end), 0),

      'payments',
        coalesce(sum(case
          when type = 'debt_payment' then abs(amount)
          else 0
        end), 0),

      'credit_expenses',
        coalesce(sum(case
          when type = 'expense' and is_credit = true then abs(amount)
          else 0
        end), 0),

      'open_expense',
        coalesce(sum(case
          when type = 'expense' and is_credit = true then abs(amount)
          else 0
        end), 0)
        -
        coalesce(sum(case
          when type = 'debt_payment' then abs(amount)
          else 0
        end), 0)
    )
    into result
    from public.transactions
    where store_id = p_store_id
      and supplier_id = p_entity_id
      and date >= p_date_from
      and date <= p_date_to;

  elsif p_entity_type in ('fixed_asset', 'asset') then
    select jsonb_build_object(
      'turnover_income', 0,
      'received_income', 0,
      'credit_income', 0,
      'open_income', 0,

      'total_expenses',
        coalesce(sum(case
          when type = 'expense' then abs(amount)
          else 0
        end), 0),

      'payments',
        coalesce(sum(case
          when type = 'debt_payment' then abs(amount)
          else 0
        end), 0),

      'credit_expenses',
        coalesce(sum(case
          when type = 'expense' and is_credit = true then abs(amount)
          else 0
        end), 0),

      'open_expense',
        coalesce(sum(case
          when type = 'expense' and is_credit = true then abs(amount)
          else 0
        end), 0)
        -
        coalesce(sum(case
          when type = 'debt_payment' then abs(amount)
          else 0
        end), 0)
    )
    into result
    from public.transactions
    where store_id = p_store_id
      and fixed_asset_id = p_entity_id
      and date >= p_date_from
      and date <= p_date_to;

  else
    result := jsonb_build_object(
      'turnover_income', 0,
      'received_income', 0,
      'credit_income', 0,
      'open_income', 0,
      'total_expenses', 0,
      'payments', 0,
      'credit_expenses', 0,
      'open_expense', 0
    );
  end if;

  return result;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.get_entity_ytd_summary(uuid, text, uuid, date, date) TO authenticated;


-- professional_delete_goal_transaction
CREATE OR REPLACE FUNCTION public.professional_delete_goal_transaction(
  p_transaction_id uuid,
  p_goal_id uuid,
  p_store_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
AS $function$
DECLARE
    v_amount DECIMAL;
    v_new_total DECIMAL;
BEGIN
    SELECT amount INTO v_amount 
    FROM transactions 
    WHERE id = p_transaction_id AND store_id = p_store_id;

    DELETE FROM transactions WHERE id = p_transaction_id AND store_id = p_store_id;

    IF FOUND THEN
        UPDATE savings_goals 
        SET current_amount = GREATEST(0, current_amount + v_amount)
        WHERE id = p_goal_id AND store_id = p_store_id
        RETURNING current_amount INTO v_new_total;
        
        RETURN v_new_total;
    ELSE
        RETURN 0;
    END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.professional_delete_goal_transaction(uuid, uuid, uuid) TO authenticated;


-- transfer_funds
CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_from_store_id uuid,
  p_to_store_id uuid,
  p_amount numeric,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.transactions (store_id, type, amount, category, description, user_id)
    VALUES (p_from_store_id, 'expense', p_amount, 'Μεταφορά Κεφαλαίου', 'Προς: ' || p_description, auth.uid());

    INSERT INTO public.transactions (store_id, type, amount, category, description, user_id)
    VALUES (p_to_store_id, 'income', p_amount, 'Μεταφορά Κεφαλαίου', 'Από: ' || p_description, auth.uid());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_funds(uuid, uuid, numeric, text) TO authenticated;

COMMIT;

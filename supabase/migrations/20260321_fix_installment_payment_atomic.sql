[BEGIN;

DROP FUNCTION IF EXISTS public.installment_payment_atomic(
  numeric,
  text,
  date,
  uuid,
  text,
  text,
  uuid,
  text
);

DROP FUNCTION IF EXISTS public.installment_payment_atomic(
  uuid,
  uuid,
  numeric,
  text,
  text,
  date,
  text,
  text
);

CREATE OR REPLACE FUNCTION public.installment_payment_atomic(
  p_store_id uuid,
  p_installment_id uuid,
  p_amount numeric DEFAULT NULL,
  p_method text DEFAULT 'Μετρητά',
  p_category text DEFAULT 'Δάνεια',
  p_date date DEFAULT current_date,
  p_notes text DEFAULT NULL,
  p_type text DEFAULT 'expense'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tx_id uuid;
  v_user_id uuid;
  v_created_by_name text;
  v_effective_amount numeric;
  v_current_amount numeric;
  v_current_status text;
  v_existing_tx uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: missing authenticated user';
  END IF;

  IF p_store_id IS NULL OR p_installment_id IS NULL THEN
    RAISE EXCEPTION 'Missing required identifiers (store_id, installment_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.store_access sa
    WHERE sa.user_id = v_user_id
      AND sa.store_id = p_store_id
      AND (
        sa.role = 'admin'
        OR COALESCE(sa.can_edit_transactions, false) = true
      )
  ) THEN
    RAISE EXCEPTION 'Forbidden: insufficient store permissions for installment payment';
  END IF;

  SELECT
    i.amount,
    COALESCE(i.status, 'pending'),
    i.transaction_id
  INTO
    v_current_amount,
    v_current_status,
    v_existing_tx
  FROM public.installments i
  WHERE i.id = p_installment_id
    AND i.store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found for store';
  END IF;

  IF LOWER(v_current_status) = 'paid' THEN
    RAISE EXCEPTION 'Installment already paid';
  END IF;

  IF v_existing_tx IS NOT NULL THEN
    RAISE EXCEPTION 'Installment already linked to transaction';
  END IF;

  v_effective_amount := ABS(COALESCE(p_amount, v_current_amount));

  IF v_effective_amount IS NULL OR v_effective_amount <= 0 THEN
    RAISE EXCEPTION 'Installment amount must be > 0';
  END IF;

  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    'Χρήστης'
  )
  INTO v_created_by_name;

  IF STRPOS(v_created_by_name, '@') > 0 THEN
    v_created_by_name := SPLIT_PART(v_created_by_name, '@', 1);
  END IF;

  INSERT INTO public.transactions (
    store_id,
    user_id,
    created_by_name,
    type,
    amount,
    method,
    category,
    notes,
    date
  ) VALUES (
    p_store_id,
    v_user_id,
    v_created_by_name,
    COALESCE(NULLIF(TRIM(p_type), ''), 'expense'),
    -ABS(v_effective_amount),
    COALESCE(NULLIF(TRIM(p_method), ''), 'Μετρητά'),
    COALESCE(NULLIF(TRIM(p_category), ''), 'Δάνεια'),
    COALESCE(
      NULLIF(TRIM(p_notes), ''),
      FORMAT('Πληρωμή δόσης %s', p_installment_id::text)
    ),
    COALESCE(p_date, current_date)
  )
  RETURNING id INTO v_tx_id;

  UPDATE public.installments
  SET
    status = 'paid',
    transaction_id = v_tx_id,
    amount = ABS(v_effective_amount)
  WHERE id = p_installment_id
    AND store_id = p_store_id;

  RETURN v_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.installment_payment_atomic(
  uuid,
  uuid,
  numeric,
  text,
  text,
  date,
  text,
  text
) TO authenticated;

COMMIT;]
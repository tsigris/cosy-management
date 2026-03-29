BEGIN;

-- =========================
-- 1. FIXED ASSETS FIELDS
-- =========================
ALTER TABLE fixed_assets
ADD COLUMN IF NOT EXISTS payroll_anchor_day INTEGER DEFAULT 1;

ALTER TABLE fixed_assets
ADD COLUMN IF NOT EXISTS last_payroll_settlement_date DATE;

ALTER TABLE fixed_assets
DROP CONSTRAINT IF EXISTS fixed_assets_payroll_anchor_day_check;

ALTER TABLE fixed_assets
ADD CONSTRAINT fixed_assets_payroll_anchor_day_check
CHECK (payroll_anchor_day BETWEEN 1 AND 31);

UPDATE fixed_assets
SET payroll_anchor_day = 1
WHERE sub_category = 'staff'
  AND (payroll_anchor_day IS NULL OR payroll_anchor_day < 1 OR payroll_anchor_day > 31);

-- =========================
-- 2. PAYROLL TABLE
-- =========================
CREATE TABLE IF NOT EXISTS employee_payroll_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  store_id UUID NOT NULL,
  employee_id UUID NOT NULL,

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  settlement_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- 3. FOREIGN KEYS
-- =========================
ALTER TABLE employee_payroll_settlements
DROP CONSTRAINT IF EXISTS employee_payroll_settlements_employee_id_fkey;

ALTER TABLE employee_payroll_settlements
ADD CONSTRAINT employee_payroll_settlements_employee_id_fkey
FOREIGN KEY (employee_id)
REFERENCES fixed_assets(id)
ON DELETE CASCADE;

ALTER TABLE employee_payroll_settlements
DROP CONSTRAINT IF EXISTS employee_payroll_settlements_store_id_fkey;

ALTER TABLE employee_payroll_settlements
ADD CONSTRAINT employee_payroll_settlements_store_id_fkey
FOREIGN KEY (store_id)
REFERENCES stores(id)
ON DELETE CASCADE;

-- =========================
-- 4. INDEXES
-- =========================
CREATE INDEX IF NOT EXISTS idx_payroll_emp ON employee_payroll_settlements(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_store ON employee_payroll_settlements(store_id);
CREATE INDEX IF NOT EXISTS idx_payroll_period ON employee_payroll_settlements(period_end DESC);

-- =========================
-- 5. RLS
-- =========================
ALTER TABLE employee_payroll_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_select ON employee_payroll_settlements;
CREATE POLICY payroll_select
ON employee_payroll_settlements
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM store_access sa
    WHERE sa.store_id = employee_payroll_settlements.store_id
    AND sa.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS payroll_insert ON employee_payroll_settlements;
CREATE POLICY payroll_insert
ON employee_payroll_settlements
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM store_access sa
    WHERE sa.store_id = employee_payroll_settlements.store_id
    AND sa.user_id = auth.uid()
    AND sa.role = 'admin'
  )
);

DROP POLICY IF EXISTS payroll_update ON employee_payroll_settlements;
CREATE POLICY payroll_update
ON employee_payroll_settlements
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM store_access sa
    WHERE sa.store_id = employee_payroll_settlements.store_id
    AND sa.user_id = auth.uid()
    AND sa.role = 'admin'
  )
);

DROP POLICY IF EXISTS payroll_delete ON employee_payroll_settlements;
CREATE POLICY payroll_delete
ON employee_payroll_settlements
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM store_access sa
    WHERE sa.store_id = employee_payroll_settlements.store_id
    AND sa.user_id = auth.uid()
    AND sa.role = 'admin'
  )
);

COMMIT;

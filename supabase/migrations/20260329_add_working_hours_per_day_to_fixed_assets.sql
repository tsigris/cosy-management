-- 20260329_add_working_hours_per_day_to_fixed_assets.sql
-- Προσθήκη πεδίου working_hours_per_day στον πίνακα fixed_assets

ALTER TABLE fixed_assets
ADD COLUMN working_hours_per_day integer NOT NULL DEFAULT 8;

-- Normalize existing values (null ή invalid -> 8)
UPDATE fixed_assets
SET working_hours_per_day = 8
WHERE working_hours_per_day IS NULL OR working_hours_per_day NOT IN (4,8);

-- Προσθήκη check constraint για αποδεκτές τιμές
ALTER TABLE fixed_assets
ADD CONSTRAINT fixed_assets_working_hours_per_day_check
CHECK (working_hours_per_day IN (4,8));

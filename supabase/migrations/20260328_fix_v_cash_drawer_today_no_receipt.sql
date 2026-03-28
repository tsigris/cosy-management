CREATE OR REPLACE VIEW public.v_cash_drawer_today AS
SELECT
  store_id,
  date,
  SUM(
    CASE
      WHEN method = 'Μετρητά (Z)' THEN amount
      ELSE 0
    END
  ) AS z_cash,
  SUM(
    CASE
      WHEN method = 'Χωρίς Απόδειξη'
        OR (method = 'Μετρητά' AND notes = 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ')
      THEN amount
      ELSE 0
    END
  ) AS extra_cash,
  SUM(
    CASE
      WHEN method = 'Μετρητά (Z)'
        OR method = 'Χωρίς Απόδειξη'
        OR (method = 'Μετρητά' AND notes = 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ')
      THEN amount
      ELSE 0
    END
  ) AS total_cash_drawer
FROM public.transactions
WHERE category = 'Εσοδα Ζ'
GROUP BY store_id, date;

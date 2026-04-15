begin;

-- Replace employee/asset-only constraint with a generalized owner/reference rule.
alter table public.transactions
  drop constraint if exists transactions_employee_or_asset_ck;

alter table public.transactions
  add constraint transactions_owner_reference_ck
  check (
    supplier_id is not null
    or employee_id is not null
    or fixed_asset_id is not null
    or revenue_source_id is not null
    or category in ('Εσοδα Ζ', 'Μεταφορά Κεφαλαίου', 'Δάνεια')
  )
  not valid;

commit;

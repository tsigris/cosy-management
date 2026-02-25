-- RPC: move_manage_entity
-- Safely move an entity between categories, updating transactions and deactivating old records if needed
-- Params:
--   store_id uuid, from_type text, from_id uuid, to_type text, to_sub_category text default null
-- Returns: new_id uuid

create or replace function move_manage_entity(
  store_id uuid,
  from_type text,
  from_id uuid,
  to_type text,
  to_sub_category text default null
) returns uuid as $$
declare
  new_id uuid;
begin
  -- suppliers -> fixed_assets (maintenance/other/staff/utility)
  if from_type = 'suppliers' and to_type in ('maintenance','other','staff','utility') then
    insert into fixed_assets (name, phone, vat_number, bank_name, iban, store_id, sub_category, is_active)
      select name, phone, vat_number, bank_name, iban, store_id, to_sub_category, true from suppliers where id = from_id
      returning id into new_id;
    update transactions set fixed_asset_id = new_id, supplier_id = null where supplier_id = from_id;
    update suppliers set is_active = false where id = from_id and exists (select 1 from transactions where supplier_id = from_id);
    return new_id;
  end if;

  -- fixed_assets -> suppliers
  if from_type in ('maintenance','other','staff','utility') and to_type = 'suppliers' then
    insert into suppliers (name, phone, vat_number, bank_name, iban, store_id, is_active)
      select name, phone, vat_number, bank_name, iban, store_id, true from fixed_assets where id = from_id
      returning id into new_id;
    update transactions set supplier_id = new_id, fixed_asset_id = null where fixed_asset_id = from_id;
    update fixed_assets set is_active = false where id = from_id and exists (select 1 from transactions where fixed_asset_id = from_id);
    return new_id;
  end if;

  -- suppliers <-> revenue_sources
  if from_type = 'suppliers' and to_type = 'revenue' then
    insert into revenue_sources (name, phone, vat_number, bank_name, iban, store_id, is_active)
      select name, phone, vat_number, bank_name, iban, store_id, true from suppliers where id = from_id
      returning id into new_id;
    update transactions set revenue_source_id = new_id, supplier_id = null where supplier_id = from_id;
    update suppliers set is_active = false where id = from_id and exists (select 1 from transactions where supplier_id = from_id);
    return new_id;
  end if;
  if from_type = 'revenue' and to_type = 'suppliers' then
    insert into suppliers (name, phone, vat_number, bank_name, iban, store_id, is_active)
      select name, phone, vat_number, bank_name, iban, store_id, true from revenue_sources where id = from_id
      returning id into new_id;
    update transactions set supplier_id = new_id, revenue_source_id = null where revenue_source_id = from_id;
    update revenue_sources set is_active = false where id = from_id and exists (select 1 from transactions where revenue_source_id = from_id);
    return new_id;
  end if;

  -- revenue_sources -> fixed_assets (maintenance/other/staff/utility)
  if from_type = 'revenue' and to_type in ('maintenance','other','staff','utility') then
    insert into fixed_assets (name, phone, vat_number, bank_name, iban, store_id, sub_category, is_active)
      select name, phone, vat_number, bank_name, iban, store_id, to_sub_category, true from revenue_sources where id = from_id
      returning id into new_id;
    update transactions set fixed_asset_id = new_id, revenue_source_id = null where revenue_source_id = from_id;
    update revenue_sources set is_active = false where id = from_id and exists (select 1 from transactions where revenue_source_id = from_id);
    return new_id;
  end if;

  -- fixed_assets (maintenance/other/staff/utility) -> revenue_sources
  if from_type in ('maintenance','other','staff','utility') and to_type = 'revenue' then
    insert into revenue_sources (name, phone, vat_number, bank_name, iban, store_id, is_active)
      select name, phone, vat_number, bank_name, iban, store_id, true from fixed_assets where id = from_id
      returning id into new_id;
    update transactions set revenue_source_id = new_id, fixed_asset_id = null where fixed_asset_id = from_id;
    update fixed_assets set is_active = false where id = from_id and exists (select 1 from transactions where fixed_asset_id = from_id);
    return new_id;
  end if;

  raise exception 'Not supported move: % -> %', from_type, to_type;
end;
$$ language plpgsql security definer;

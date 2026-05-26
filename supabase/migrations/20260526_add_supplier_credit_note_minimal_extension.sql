begin;

-- ============================================================
-- SAFE MINIMAL EXTENSION: supplier_credit_note on transactions
-- ============================================================
-- Goals:
-- - Additive schema changes only.
-- - Keep existing expense/debt_payment architecture intact.
-- - Enforce safe posting rules for supplier credit notes.

-- 1) Optional linkage and duplicate-protection metadata.
alter table public.transactions
  add column if not exists linked_invoice_tx_id uuid,
  add column if not exists supplier_credit_note_number text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid,
  add column if not exists void_reason text;

-- Linked invoice reference is optional and constrained only when used.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_linked_invoice_tx_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_linked_invoice_tx_fkey
      foreign key (linked_invoice_tx_id)
      references public.transactions(id)
      on delete set null;
  end if;
end
$$;

-- 2) Validation check for supplier credit notes.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_supplier_credit_note_ck'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_supplier_credit_note_ck
      check (
        type <> 'supplier_credit_note'
        or (
          amount > 0
          and supplier_id is not null
        )
      )
      not valid;
  end if;
end
$$;

alter table public.transactions validate constraint transactions_supplier_credit_note_ck;

-- 3) Indexes for active supplier credit notes and duplicate protection.
create index if not exists idx_tx_supplier_credit_note_active
  on public.transactions (store_id, supplier_id, date desc)
  where type = 'supplier_credit_note' and voided_at is null;

create unique index if not exists ux_tx_supplier_credit_note_number_active
  on public.transactions (
    store_id,
    supplier_id,
    lower(trim(supplier_credit_note_number))
  )
  where type = 'supplier_credit_note'
    and supplier_credit_note_number is not null
    and trim(supplier_credit_note_number) <> ''
    and voided_at is null;

-- 4) Trigger validations specific to supplier credit notes.
create or replace function public.trg_validate_supplier_credit_note_tx()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_linked record;
begin
  if new.type = 'supplier_credit_note' then
    -- Normalize document number for consistent uniqueness behavior.
    if new.supplier_credit_note_number is not null then
      new.supplier_credit_note_number := nullif(trim(new.supplier_credit_note_number), '');
    end if;

    if new.amount is null or new.amount <= 0 then
      raise exception 'supplier_credit_note amount must be positive';
    end if;

    if new.supplier_id is null then
      raise exception 'supplier_credit_note requires supplier_id';
    end if;

    if new.voided_at is not null then
      if coalesce(trim(new.void_reason), '') = '' then
        raise exception 'Void reason is required for supplier_credit_note';
      end if;
      if new.voided_by is null then
        raise exception 'voided_by is required when voiding supplier_credit_note';
      end if;
    end if;

    -- Optional linked invoice must belong to the same store/supplier and be a credit expense invoice row.
    if new.linked_invoice_tx_id is not null then
      select
        t.id,
        t.store_id,
        t.supplier_id,
        t.type,
        coalesce(t.is_credit, false) as is_credit
      into v_linked
      from public.transactions t
      where t.id = new.linked_invoice_tx_id;

      if not found then
        raise exception 'linked_invoice_tx_id does not exist';
      end if;

      if v_linked.store_id is distinct from new.store_id then
        raise exception 'linked invoice must belong to the same store';
      end if;

      if v_linked.supplier_id is distinct from new.supplier_id then
        raise exception 'linked invoice must belong to the same supplier';
      end if;

      if not (v_linked.type = 'expense' and v_linked.is_credit = true) then
        raise exception 'linked invoice must reference expense with is_credit=true';
      end if;
    end if;
  end if;

  -- Enforce immutable posting semantics for supplier credit notes.
  if tg_op = 'UPDATE' and old.type = 'supplier_credit_note' then
    -- No hard edits on already voided rows.
    if old.voided_at is not null then
      raise exception 'Voided supplier_credit_note rows are immutable';
    end if;

    -- Disallow economic-field edits; only void metadata and notes/category/method adjustments are tolerated.
    if new.amount is distinct from old.amount
      or new.store_id is distinct from old.store_id
      or new.supplier_id is distinct from old.supplier_id
      or new.type is distinct from old.type
      or new.date is distinct from old.date
      or new.linked_invoice_tx_id is distinct from old.linked_invoice_tx_id
      or new.supplier_credit_note_number is distinct from old.supplier_credit_note_number then
      raise exception 'supplier_credit_note core posting fields are immutable; use void';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_supplier_credit_note_tx on public.transactions;
create trigger trg_validate_supplier_credit_note_tx
before insert or update on public.transactions
for each row
execute function public.trg_validate_supplier_credit_note_tx();

-- 5) No hard delete for supplier credit notes (void-only policy).
create or replace function public.trg_prevent_supplier_credit_note_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.type = 'supplier_credit_note' then
    raise exception 'Hard delete is not allowed for supplier_credit_note. Use void fields.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_supplier_credit_note_delete on public.transactions;
create trigger trg_prevent_supplier_credit_note_delete
before delete on public.transactions
for each row
execute function public.trg_prevent_supplier_credit_note_delete();

commit;

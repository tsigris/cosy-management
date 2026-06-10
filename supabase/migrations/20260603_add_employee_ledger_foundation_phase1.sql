begin;

-- =====================================================================
-- Phase 1C: Employee Ledger Foundation (Dormant, Additive Schema Only)
-- Governance:
-- - No changes to existing legacy payroll/accounting tables or functions
-- - No backfill
-- - No runtime wiring
-- - No balance/report/UI cutover
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ENUMS
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'employee_agreement_type' and n.nspname = 'public'
  ) then
    create type public.employee_agreement_type as enum (
      'monthly',
      'daily',
      'hourly',
      'seasonal',
      'flexible'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'employee_agreement_status' and n.nspname = 'public'
  ) then
    create type public.employee_agreement_status as enum (
      'draft',
      'active',
      'superseded',
      'ended',
      'voided'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'employee_ledger_event_type' and n.nspname = 'public'
  ) then
    create type public.employee_ledger_event_type as enum (
      'earning_recorded',
      'payment_recorded',
      'deduction_recorded',
      'adjustment_recorded',
      'reversal_recorded',
      'reconciliation_recorded'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'employee_ledger_event_status' and n.nspname = 'public'
  ) then
    create type public.employee_ledger_event_status as enum (
      'recorded',
      'processing',
      'succeeded',
      'failed',
      'reversed',
      'voided'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'employee_ledger_entry_kind' and n.nspname = 'public'
  ) then
    create type public.employee_ledger_entry_kind as enum (
      'earning',
      'payment',
      'deduction',
      'adjustment'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'employee_ledger_entry_subtype' and n.nspname = 'public'
  ) then
    create type public.employee_ledger_entry_subtype as enum (
      'salary',
      'daily_wage',
      'hourly_wage',
      'overtime',
      'bonus',
      'tip',
      'commission',
      'manual_earning',
      'advance',
      'partial_payment',
      'salary_payment',
      'settlement_payment',
      'damage',
      'unpaid_leave',
      'correction',
      'manual_deduction',
      'balance_adjustment',
      'opening_balance',
      'closing_adjustment'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'employee_ledger_direction' and n.nspname = 'public'
  ) then
    create type public.employee_ledger_direction as enum (
      'increase_balance',
      'decrease_balance'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'employee_ledger_posting_status' and n.nspname = 'public'
  ) then
    create type public.employee_ledger_posting_status as enum (
      'pending',
      'posted',
      'reversed',
      'voided'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'employee_ledger_posting_role' and n.nspname = 'public'
  ) then
    create type public.employee_ledger_posting_role as enum (
      'primary',
      'allocation',
      'reversal',
      'adjustment'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'employee_ledger_reconciliation_status' and n.nspname = 'public'
  ) then
    create type public.employee_ledger_reconciliation_status as enum (
      'pending',
      'matched',
      'reconciled',
      'mismatch',
      'reversed',
      'revoked'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 2) TABLES
-- ---------------------------------------------------------------------

create table if not exists public.employee_agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  store_id uuid not null,
  employee_id uuid not null,

  agreement_type public.employee_agreement_type not null,
  agreement_status public.employee_agreement_status not null default 'draft',

  effective_from date not null,
  effective_to date,

  currency text not null default 'EUR',
  monthly_amount numeric,
  daily_rate numeric,
  hourly_rate numeric,
  terms_json jsonb,

  source_system text,
  source_ref_id text,

  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,

  voided_at timestamptz,
  voided_by uuid,
  void_reason text,

  constraint employee_agreements_store_id_fkey
    foreign key (store_id)
    references public.stores(id)
    on delete restrict,
  constraint employee_agreements_employee_id_fkey
    foreign key (employee_id)
    references public.fixed_assets(id)
    on delete restrict,

  constraint employee_agreements_date_window_ck
    check (effective_to is null or effective_to >= effective_from),
  constraint employee_agreements_currency_ck
    check (currency ~ '^[A-Z]{3}$'),
  constraint employee_agreements_amounts_ck
    check (
      (monthly_amount is null or monthly_amount >= 0)
      and (daily_rate is null or daily_rate >= 0)
      and (hourly_rate is null or hourly_rate >= 0)
    ),
  constraint employee_agreements_void_consistency_ck
    check (voided_at is null or voided_by is not null),
  constraint employee_agreements_type_fields_ck
    check (
      (agreement_type <> 'monthly' or monthly_amount is not null)
      and (agreement_type <> 'daily' or daily_rate is not null)
      and (agreement_type <> 'hourly' or hourly_rate is not null)
      and (agreement_type in ('seasonal', 'flexible') or terms_json is null)
    ),
  constraint employee_agreements_scope_uid_uk
    unique (id, organization_id, store_id)
);

create table if not exists public.employee_ledger_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  store_id uuid not null,
  employee_id uuid not null,

  event_type public.employee_ledger_event_type not null,
  event_status public.employee_ledger_event_status not null default 'recorded',

  source_system text not null,
  source_event_id text not null,
  idempotency_key text not null,
  correlation_id text not null,
  payload_hash text not null,

  occurred_at timestamptz not null,
  processed_at timestamptz,

  error_code text,
  error_message text,
  metadata_json jsonb,

  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,

  voided_at timestamptz,
  voided_by uuid,
  void_reason text,

  constraint employee_ledger_events_store_id_fkey
    foreign key (store_id)
    references public.stores(id)
    on delete restrict,
  constraint employee_ledger_events_employee_id_fkey
    foreign key (employee_id)
    references public.fixed_assets(id)
    on delete restrict,

  constraint employee_ledger_events_source_event_uk
    unique (organization_id, store_id, source_system, source_event_id),
  constraint employee_ledger_events_idempotency_uk
    unique (organization_id, store_id, idempotency_key),
  constraint employee_ledger_events_void_consistency_ck
    check (voided_at is null or voided_by is not null),
  constraint employee_ledger_events_failed_error_ck
    check (event_status <> 'failed' or error_code is not null),
  constraint employee_ledger_events_scope_uid_uk
    unique (id, organization_id, store_id)
);

create table if not exists public.employee_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  store_id uuid not null,
  employee_id uuid not null,
  event_id uuid not null,

  entry_kind public.employee_ledger_entry_kind not null,
  entry_subtype public.employee_ledger_entry_subtype not null,
  direction public.employee_ledger_direction not null,

  amount numeric not null,
  currency text not null default 'EUR',
  quantity numeric,
  unit_rate numeric,

  occurred_on date not null,
  description text,

  source_table text,
  source_row_id uuid,
  external_ref text,

  posting_status public.employee_ledger_posting_status not null default 'pending',
  reversal_of_entry_id uuid,
  metadata_json jsonb,

  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,

  voided_at timestamptz,
  voided_by uuid,
  void_reason text,

  constraint employee_ledger_entries_store_id_fkey
    foreign key (store_id)
    references public.stores(id)
    on delete restrict,
  constraint employee_ledger_entries_employee_id_fkey
    foreign key (employee_id)
    references public.fixed_assets(id)
    on delete restrict,
  constraint employee_ledger_entries_event_id_fkey
    foreign key (event_id)
    references public.employee_ledger_events(id)
    on delete restrict,
  constraint employee_ledger_entries_reversal_id_fkey
    foreign key (reversal_of_entry_id)
    references public.employee_ledger_entries(id)
    on delete restrict,

  constraint employee_ledger_entries_amount_ck
    check (amount > 0),
  constraint employee_ledger_entries_currency_ck
    check (currency ~ '^[A-Z]{3}$'),
  constraint employee_ledger_entries_void_consistency_ck
    check (voided_at is null or voided_by is not null),
  constraint employee_ledger_entries_reversal_self_ck
    check (reversal_of_entry_id is null or reversal_of_entry_id <> id),
  constraint employee_ledger_entries_direction_kind_ck
    check (
      (entry_kind = 'earning' and direction = 'increase_balance')
      or (entry_kind in ('payment', 'deduction') and direction = 'decrease_balance')
      or (entry_kind = 'adjustment' and direction in ('increase_balance', 'decrease_balance'))
    ),
  constraint employee_ledger_entries_scope_uid_uk
    unique (id, organization_id, store_id)
);

create table if not exists public.employee_ledger_transaction_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  store_id uuid not null,

  ledger_entry_id uuid not null,
  transaction_id uuid not null,

  allocated_amount numeric not null,
  allocation_currency text not null default 'EUR',
  posting_role public.employee_ledger_posting_role not null,
  reconciliation_status public.employee_ledger_reconciliation_status not null default 'pending',

  linked_at timestamptz not null default now(),
  reversed_link_id uuid,
  reconciliation_note text,
  metadata_json jsonb,

  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,

  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,

  constraint employee_ledger_tx_links_ledger_entry_id_fkey
    foreign key (ledger_entry_id)
    references public.employee_ledger_entries(id)
    on delete restrict,
  constraint employee_ledger_tx_links_transaction_id_fkey
    foreign key (transaction_id)
    references public.transactions(id)
    on delete restrict,
  constraint employee_ledger_tx_links_reversed_link_id_fkey
    foreign key (reversed_link_id)
    references public.employee_ledger_transaction_links(id)
    on delete restrict,

  constraint employee_ledger_tx_links_alloc_amount_ck
    check (allocated_amount > 0),
  constraint employee_ledger_tx_links_currency_ck
    check (allocation_currency ~ '^[A-Z]{3}$'),
  constraint employee_ledger_tx_links_revoked_consistency_ck
    check (revoked_at is null or revoked_by is not null),
  constraint employee_ledger_tx_links_reversal_self_ck
    check (reversed_link_id is null or reversed_link_id <> id),
  constraint employee_ledger_tx_links_scope_uid_uk
    unique (id, organization_id, store_id),
  constraint employee_ledger_tx_links_active_role_uk
    unique (ledger_entry_id, transaction_id, posting_role)
);

-- ---------------------------------------------------------------------
-- 2.1) HARDENING TRIGGER FUNCTIONS
-- ---------------------------------------------------------------------

create or replace function public.employee_ledger_validate_scope_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_store_org_id uuid;
  v_employee_store_id uuid;
  v_event_store_id uuid;
  v_event_org_id uuid;
  v_event_employee_id uuid;
  v_entry_store_id uuid;
  v_entry_org_id uuid;
  v_tx_store_id uuid;
begin
  -- Store must exist and match organization scope on every ledger table row.
  select s.organization_id
  into v_store_org_id
  from public.stores s
  where s.id = new.store_id;

  if v_store_org_id is null then
    raise exception 'Invalid store_id for ledger scope: %', new.store_id;
  end if;

  if new.organization_id is distinct from v_store_org_id then
    raise exception 'organization_id/store_id mismatch in % (org %, store %, store_org %)',
      tg_table_name, new.organization_id, new.store_id, v_store_org_id;
  end if;

  if tg_table_name in ('employee_agreements', 'employee_ledger_events', 'employee_ledger_entries') then
    select fa.store_id
    into v_employee_store_id
    from public.fixed_assets fa
    where fa.id = new.employee_id;

    if not found then
      raise exception 'Invalid employee_id for ledger scope: %', new.employee_id;
    end if;

    if v_employee_store_id is not null and v_employee_store_id is distinct from new.store_id then
      raise exception 'employee/store mismatch in % (employee %, employee_store %, row_store %)',
        tg_table_name, new.employee_id, v_employee_store_id, new.store_id;
    end if;
  end if;

  if tg_table_name = 'employee_ledger_entries' then
    select e.store_id, e.organization_id, e.employee_id
    into v_event_store_id, v_event_org_id, v_event_employee_id
    from public.employee_ledger_events e
    where e.id = new.event_id;

    if not found then
      raise exception 'Invalid event_id for ledger entry: %', new.event_id;
    end if;

    if v_event_store_id is distinct from new.store_id
       or v_event_org_id is distinct from new.organization_id
       or v_event_employee_id is distinct from new.employee_id then
      raise exception 'entry/event scope mismatch (entry %, event %)', new.id, new.event_id;
    end if;
  end if;

  if tg_table_name = 'employee_ledger_transaction_links' then
    select le.store_id, le.organization_id
    into v_entry_store_id, v_entry_org_id
    from public.employee_ledger_entries le
    where le.id = new.ledger_entry_id;

    if not found then
      raise exception 'Invalid ledger_entry_id in transaction link: %', new.ledger_entry_id;
    end if;

    if v_entry_store_id is distinct from new.store_id
       or v_entry_org_id is distinct from new.organization_id then
      raise exception 'link/entry scope mismatch (link %, entry %)', new.id, new.ledger_entry_id;
    end if;

    select t.store_id
    into v_tx_store_id
    from public.transactions t
    where t.id = new.transaction_id;

    if not found then
      raise exception 'Invalid transaction_id in ledger link: %', new.transaction_id;
    end if;

    if v_tx_store_id is distinct from new.store_id then
      raise exception 'transaction/store mismatch in link (tx %, tx_store %, row_store %)',
        new.transaction_id, v_tx_store_id, new.store_id;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.employee_ledger_events_enforce_immutable_idempotency()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_system is distinct from old.source_system then
    raise exception 'source_system is immutable once inserted';
  end if;

  if new.source_event_id is distinct from old.source_event_id then
    raise exception 'source_event_id is immutable once inserted';
  end if;

  if new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'idempotency_key is immutable once inserted';
  end if;

  if new.payload_hash is distinct from old.payload_hash then
    raise exception 'payload_hash is immutable once inserted';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2.2) HARDENING TRIGGERS
-- ---------------------------------------------------------------------

drop trigger if exists trg_employee_agreements_scope_consistency on public.employee_agreements;
create trigger trg_employee_agreements_scope_consistency
before insert or update on public.employee_agreements
for each row
execute function public.employee_ledger_validate_scope_consistency();

drop trigger if exists trg_employee_ledger_events_scope_consistency on public.employee_ledger_events;
create trigger trg_employee_ledger_events_scope_consistency
before insert or update on public.employee_ledger_events
for each row
execute function public.employee_ledger_validate_scope_consistency();

drop trigger if exists trg_employee_ledger_entries_scope_consistency on public.employee_ledger_entries;
create trigger trg_employee_ledger_entries_scope_consistency
before insert or update on public.employee_ledger_entries
for each row
execute function public.employee_ledger_validate_scope_consistency();

drop trigger if exists trg_employee_ledger_tx_links_scope_consistency on public.employee_ledger_transaction_links;
create trigger trg_employee_ledger_tx_links_scope_consistency
before insert or update on public.employee_ledger_transaction_links
for each row
execute function public.employee_ledger_validate_scope_consistency();

drop trigger if exists trg_employee_ledger_events_immutable_idempotency on public.employee_ledger_events;
create trigger trg_employee_ledger_events_immutable_idempotency
before update on public.employee_ledger_events
for each row
execute function public.employee_ledger_events_enforce_immutable_idempotency();

-- ---------------------------------------------------------------------
-- 3) INDEXES
-- ---------------------------------------------------------------------

-- Agreements
create index if not exists idx_employee_agreements_scope_employee_effective
  on public.employee_agreements (organization_id, store_id, employee_id, effective_from desc);

create index if not exists idx_employee_agreements_scope_status
  on public.employee_agreements (organization_id, store_id, agreement_status);

create index if not exists idx_employee_agreements_employee_status_effective
  on public.employee_agreements (employee_id, agreement_status, effective_from desc);

create index if not exists idx_employee_agreements_source_ref
  on public.employee_agreements (source_system, source_ref_id)
  where source_ref_id is not null;

-- Events
create index if not exists idx_employee_ledger_events_scope_employee_occurred
  on public.employee_ledger_events (organization_id, store_id, employee_id, occurred_at desc);

create index if not exists idx_employee_ledger_events_correlation
  on public.employee_ledger_events (correlation_id);

create index if not exists idx_employee_ledger_events_status_occurred
  on public.employee_ledger_events (event_status, occurred_at desc);

create index if not exists idx_employee_ledger_events_source
  on public.employee_ledger_events (source_system, source_event_id);

create index if not exists idx_employee_ledger_events_idempotency
  on public.employee_ledger_events (idempotency_key);

-- Entries
create index if not exists idx_employee_ledger_entries_scope_employee_date
  on public.employee_ledger_entries (organization_id, store_id, employee_id, occurred_on desc);

create index if not exists idx_employee_ledger_entries_event
  on public.employee_ledger_entries (event_id);

create index if not exists idx_employee_ledger_entries_status_date
  on public.employee_ledger_entries (posting_status, occurred_on desc);

create index if not exists idx_employee_ledger_entries_source_ref
  on public.employee_ledger_entries (source_table, source_row_id)
  where source_row_id is not null;

create index if not exists idx_employee_ledger_entries_reversal
  on public.employee_ledger_entries (reversal_of_entry_id)
  where reversal_of_entry_id is not null;

create index if not exists idx_employee_ledger_entries_kind_subtype
  on public.employee_ledger_entries (entry_kind, entry_subtype);

-- Links
create index if not exists idx_employee_ledger_tx_links_scope_tx
  on public.employee_ledger_transaction_links (organization_id, store_id, transaction_id);

create index if not exists idx_employee_ledger_tx_links_scope_entry
  on public.employee_ledger_transaction_links (organization_id, store_id, ledger_entry_id);

create index if not exists idx_employee_ledger_tx_links_recon_status_linked
  on public.employee_ledger_transaction_links (reconciliation_status, linked_at desc);

create index if not exists idx_employee_ledger_tx_links_role
  on public.employee_ledger_transaction_links (posting_role);

create index if not exists idx_employee_ledger_tx_links_reversed
  on public.employee_ledger_transaction_links (reversed_link_id)
  where reversed_link_id is not null;

-- ---------------------------------------------------------------------
-- 4) RLS ENABLE + POLICIES
-- ---------------------------------------------------------------------

alter table public.employee_agreements enable row level security;
alter table public.employee_ledger_events enable row level security;
alter table public.employee_ledger_entries enable row level security;
alter table public.employee_ledger_transaction_links enable row level security;

-- Agreements policies

drop policy if exists employee_agreements_select on public.employee_agreements;
create policy employee_agreements_select
on public.employee_agreements
for select
to authenticated
using (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_agreements.store_id
  )
);

drop policy if exists employee_agreements_insert on public.employee_agreements;
create policy employee_agreements_insert
on public.employee_agreements
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_agreements.store_id
      and sa.role = 'admin'
  )
);

drop policy if exists employee_agreements_update on public.employee_agreements;
create policy employee_agreements_update
on public.employee_agreements
for update
to authenticated
using (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_agreements.store_id
      and sa.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_agreements.store_id
      and sa.role = 'admin'
  )
);

drop policy if exists employee_agreements_delete_denied on public.employee_agreements;
create policy employee_agreements_delete_denied
on public.employee_agreements
for delete
to authenticated
using (false);

-- Events policies

drop policy if exists employee_ledger_events_select on public.employee_ledger_events;
create policy employee_ledger_events_select
on public.employee_ledger_events
for select
to authenticated
using (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_ledger_events.store_id
  )
);

drop policy if exists employee_ledger_events_insert on public.employee_ledger_events;
create policy employee_ledger_events_insert
on public.employee_ledger_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_ledger_events.store_id
      and sa.role = 'admin'
  )
);

drop policy if exists employee_ledger_events_update on public.employee_ledger_events;
create policy employee_ledger_events_update
on public.employee_ledger_events
for update
to authenticated
using (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_ledger_events.store_id
      and sa.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_ledger_events.store_id
      and sa.role = 'admin'
  )
);

drop policy if exists employee_ledger_events_delete_denied on public.employee_ledger_events;
create policy employee_ledger_events_delete_denied
on public.employee_ledger_events
for delete
to authenticated
using (false);

-- Entries policies

drop policy if exists employee_ledger_entries_select on public.employee_ledger_entries;
create policy employee_ledger_entries_select
on public.employee_ledger_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_ledger_entries.store_id
  )
);

drop policy if exists employee_ledger_entries_insert on public.employee_ledger_entries;
create policy employee_ledger_entries_insert
on public.employee_ledger_entries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_ledger_entries.store_id
      and sa.role = 'admin'
  )
);

drop policy if exists employee_ledger_entries_update on public.employee_ledger_entries;
create policy employee_ledger_entries_update
on public.employee_ledger_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_ledger_entries.store_id
      and sa.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_ledger_entries.store_id
      and sa.role = 'admin'
  )
);

drop policy if exists employee_ledger_entries_delete_denied on public.employee_ledger_entries;
create policy employee_ledger_entries_delete_denied
on public.employee_ledger_entries
for delete
to authenticated
using (false);

-- Links policies

drop policy if exists employee_ledger_tx_links_select on public.employee_ledger_transaction_links;
create policy employee_ledger_tx_links_select
on public.employee_ledger_transaction_links
for select
to authenticated
using (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_ledger_transaction_links.store_id
  )
);

drop policy if exists employee_ledger_tx_links_insert on public.employee_ledger_transaction_links;
create policy employee_ledger_tx_links_insert
on public.employee_ledger_transaction_links
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_ledger_transaction_links.store_id
      and sa.role = 'admin'
  )
);

drop policy if exists employee_ledger_tx_links_update on public.employee_ledger_transaction_links;
create policy employee_ledger_tx_links_update
on public.employee_ledger_transaction_links
for update
to authenticated
using (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_ledger_transaction_links.store_id
      and sa.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.store_access sa
    where sa.user_id = auth.uid()
      and sa.store_id = employee_ledger_transaction_links.store_id
      and sa.role = 'admin'
  )
);

drop policy if exists employee_ledger_tx_links_delete_denied on public.employee_ledger_transaction_links;
create policy employee_ledger_tx_links_delete_denied
on public.employee_ledger_transaction_links
for delete
to authenticated
using (false);

-- ---------------------------------------------------------------------
-- 5) VALIDATION NOTES (comments only, no runtime wiring)
-- ---------------------------------------------------------------------
-- Validate objects exist:
--   select to_regclass('public.employee_agreements');
--   select to_regclass('public.employee_ledger_events');
--   select to_regclass('public.employee_ledger_entries');
--   select to_regclass('public.employee_ledger_transaction_links');
--
-- Validate idempotency keys:
--   \d public.employee_ledger_events
--
-- Validate delete denied under RLS for authenticated role.
--
-- Legacy safety statement:
--   This migration creates only new enums/tables/indexes/policies.
--   It does not alter or drop existing legacy payroll/accounting objects.

commit;

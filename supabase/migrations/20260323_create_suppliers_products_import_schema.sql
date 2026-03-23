begin;

-- =========================
-- SUPPLIERS
-- =========================
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  supplier_code text,
  barcode_prefix text,
  is_active boolean not null default true
);

create index if not exists suppliers_store_id_idx on public.suppliers(store_id);
create unique index if not exists suppliers_store_name_unique on public.suppliers(store_id, name);

-- =========================
-- PRODUCTS
-- =========================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  category text,
  brand text,
  unit text,
  base_barcode text,
  is_active boolean not null default true,
  notes text
);

create index if not exists products_store_id_idx on public.products(store_id);
create index if not exists products_name_idx on public.products(store_id, name);
create index if not exists products_barcode_idx on public.products(store_id, base_barcode);

-- =========================
-- SUPPLIER PRODUCTS
-- =========================
create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,

  supplier_product_name text,
  supplier_barcode_key text,
  barcode_raw text,
  supplier_sku text,

  last_price numeric(12,4),
  last_price_date date,
  is_active boolean not null default true
);

create index if not exists supplier_products_store_idx on public.supplier_products(store_id);
create index if not exists supplier_products_supplier_idx on public.supplier_products(supplier_id);
create index if not exists supplier_products_product_idx on public.supplier_products(product_id);
create index if not exists supplier_products_barcode_key_idx on public.supplier_products(store_id, supplier_barcode_key);

create unique index if not exists supplier_products_unique_map
on public.supplier_products(store_id, supplier_id, product_id);

-- =========================
-- PRICE HISTORY
-- =========================
create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_product_id uuid references public.supplier_products(id) on delete set null,

  invoice_date date not null,
  price numeric(12,4) not null,
  previous_price numeric(12,4),
  price_diff numeric(12,4),

  quantity numeric(12,3),
  source text not null default 'manual',
  source_file_name text,
  notes text
);

create index if not exists product_price_history_store_idx on public.product_price_history(store_id);
create index if not exists product_price_history_product_idx on public.product_price_history(product_id);
create index if not exists product_price_history_supplier_idx on public.product_price_history(supplier_id);
create index if not exists product_price_history_date_idx on public.product_price_history(store_id, invoice_date desc);

-- =========================
-- MATCH MEMORY (AI)
-- =========================
create table if not exists public.product_match_memory (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  raw_text text not null,
  raw_barcode text,
  matched_product_id uuid not null references public.products(id) on delete cascade,
  usage_count integer not null default 1,
  last_used_at timestamptz default now(),
  confidence numeric(5,2),
  is_confirmed boolean not null default true
);

create index if not exists product_match_memory_store_idx on public.product_match_memory(store_id);
create index if not exists product_match_memory_supplier_idx on public.product_match_memory(supplier_id);
create index if not exists product_match_memory_raw_idx on public.product_match_memory(store_id, raw_text);

-- =========================
-- IMPORT BATCHES
-- =========================
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,

  import_type text not null,
  file_name text,
  status text not null default 'pending',
  total_rows integer default 0,
  inserted_rows integer default 0,
  updated_rows integer default 0,
  failed_rows integer default 0,
  notes text
);

create index if not exists import_batches_store_idx on public.import_batches(store_id);
create index if not exists import_batches_created_idx on public.import_batches(store_id, created_at desc);

-- =========================
-- IMPORT ROWS
-- =========================
create table if not exists public.import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,

  raw_data jsonb not null,
  parsed_name text,
  parsed_barcode text,
  parsed_price numeric(12,4),

  matched_product_id uuid references public.products(id) on delete set null,
  action text,
  message text
);

create index if not exists import_batch_rows_batch_idx on public.import_batch_rows(batch_id);
create index if not exists import_batch_rows_store_idx on public.import_batch_rows(store_id);

commit;

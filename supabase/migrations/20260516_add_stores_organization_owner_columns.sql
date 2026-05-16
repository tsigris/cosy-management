begin;

-- =============================================================
-- Add missing columns to stores table for canonical organization ownership
-- =============================================================

-- Add organization_id column if missing
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stores'
      and column_name = 'organization_id'
  ) then
    alter table public.stores
      add column organization_id uuid;
  end if;
end
$$;

-- Add owner_id column if missing
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stores'
      and column_name = 'owner_id'
  ) then
    alter table public.stores
      add column owner_id uuid;
  end if;
end
$$;

-- =============================================================
-- Create indexes for new columns
-- =============================================================

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'stores'
      and indexname = 'idx_stores_organization_id'
  ) then
    create index idx_stores_organization_id
      on public.stores (organization_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'stores'
      and indexname = 'idx_stores_owner_id'
  ) then
    create index idx_stores_owner_id
      on public.stores (owner_id);
  end if;
end
$$;

-- =============================================================
-- Backfill stores.organization_id from admin user metadata
--
-- Strategy:
--   1. For each store with NULL organization_id
--   2. Find the first admin user via store_access table
--   3. Extract their organization_id from auth.users table
--      (try raw_user_meta_data first, then raw_app_meta_data)
--   4. Update stores table with that organization_id
--   5. Also backfill owner_id from the admin user
-- =============================================================

do $$
declare
  v_org_id_count int := 0;
  v_org_fallback_count int := 0;
  v_owner_id_count int := 0;
  v_owner_fallback_count int := 0;
  v_null_count int := 0;
  v_conflict_store_count int := 0;
begin

  -- STEP 1: Backfill organization_id from admin user metadata
  -- Create temp table to hold the mapping
  create temp table temp_store_org_backfill as
  select
    s.id as store_id,
    (
      coalesce(
        (au.raw_user_meta_data->>'organization_id'),
        (au.raw_app_meta_data->>'organization_id')
      )
    )::uuid as org_id,
    sa.user_id as admin_user_id
  from public.stores s
  join public.store_access sa on sa.store_id = s.id
  join auth.users au on au.id = sa.user_id
  where s.organization_id is null
    and sa.role = 'admin'
  group by
    s.id,
    sa.user_id,
    coalesce(
      (au.raw_user_meta_data->>'organization_id'),
      (au.raw_app_meta_data->>'organization_id')
    )
  having
    coalesce(
      (au.raw_user_meta_data->>'organization_id'),
      (au.raw_app_meta_data->>'organization_id')
    ) is not null
    and coalesce(
      (au.raw_user_meta_data->>'organization_id'),
      (au.raw_app_meta_data->>'organization_id')
    ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

  -- Update stores with organization_id from backfill table
  update public.stores s
  set organization_id = t.org_id
  from temp_store_org_backfill t
  where s.id = t.store_id
    and s.organization_id is null;

  get diagnostics v_org_id_count = row_count;
  raise notice 'Backfilled % stores with organization_id from admin user metadata', v_org_id_count;

  -- STEP 1b: Ensure canonical one-store-one-organization when metadata is unavailable.
  -- Assign a unique organization_id per store still missing org ownership.
  update public.stores
  set organization_id = gen_random_uuid()
  where organization_id is null;

  get diagnostics v_org_fallback_count = row_count;
  raise warning 'Assigned generated organization_id for % stores without metadata source', v_org_fallback_count;

  -- STEP 2: Backfill owner_id from store_access admin user
  create temp table temp_store_owner_backfill as
  select distinct
    s.id as store_id,
    sa.user_id as owner_user_id
  from public.stores s
  join public.store_access sa on sa.store_id = s.id
  where s.owner_id is null
    and sa.role = 'admin';

  -- Update stores with owner_id from backfill table
  update public.stores s
  set owner_id = t.owner_user_id
  from temp_store_owner_backfill t
  where s.id = t.store_id
    and s.owner_id is null;

  get diagnostics v_owner_id_count = row_count;
  raise notice 'Backfilled % stores with owner_id from admin user', v_owner_id_count;

  -- STEP 2b: Fallback owner assignment when no admin role exists.
  with fallback_owner as (
    select distinct on (sa.store_id)
      sa.store_id,
      sa.user_id as owner_user_id
    from public.store_access sa
    where sa.user_id is not null
    order by
      sa.store_id,
      case when sa.role in ('owner', 'admin') then 0 else 1 end,
      sa.id
  )
  update public.stores s
  set owner_id = f.owner_user_id
  from fallback_owner f
  where s.id = f.store_id
    and s.owner_id is null;

  get diagnostics v_owner_fallback_count = row_count;
  raise warning 'Assigned fallback owner_id from store_access for % stores without admin owner', v_owner_fallback_count;

  -- STEP 3: Report on remaining NULL values
  select count(*) into v_null_count
  from public.stores
  where organization_id is null;

  if v_null_count > 0 then
    raise warning 'WARNING: % stores still have NULL organization_id after backfill. These stores will fall back to auth user metadata at request time.', v_null_count;
  end if;

  -- STEP 4: Enforce canonical ownership invariant
  -- One store must belong to exactly one organization domain.
  -- Block deploy if users attached to a store resolve to multiple org IDs.
  select count(*)
  into v_conflict_store_count
  from (
    select
      s.id,
      count(distinct au.raw_user_meta_data->>'organization_id') as distinct_orgs
    from public.stores s
    left join public.store_access sa
      on sa.store_id = s.id
    left join auth.users au
      on au.id = sa.user_id
    group by s.id
    having count(distinct au.raw_user_meta_data->>'organization_id') > 1
  ) conflicts;

  if v_conflict_store_count > 0 then
    raise exception
      using message = format(
        'Deployment blocked: %s store(s) have multiple user organization_ids (distinct_orgs > 1). Canonical ownership invariant violated.',
        v_conflict_store_count
      );
  end if;

  -- Clean up temp tables
  drop table if exists temp_store_org_backfill;
  drop table if exists temp_store_owner_backfill;

end
$$;

commit;

-- =============================================================
-- VERIFICATION QUERIES (run after migration to verify backfill)
-- =============================================================
-- SELECT 'stores with organization_id backfilled' as status,
--        COUNT(*) as count
-- FROM public.stores
-- WHERE organization_id IS NOT NULL;
--
-- SELECT 'stores with NULL organization_id (will use runtime fallback)' as status,
--        COUNT(*) as count
-- FROM public.stores
-- WHERE organization_id IS NULL;
--
-- SELECT id, organization_id, owner_id, name
-- FROM public.stores
-- ORDER BY id;
--
-- Required ownership consistency verification:
-- SELECT
-- s.id,
-- s.name,
-- s.organization_id,
-- COUNT(DISTINCT sa.user_id) AS access_users,
-- COUNT(DISTINCT au.raw_user_meta_data->>'organization_id') AS distinct_orgs
-- FROM public.stores s
-- LEFT JOIN public.store_access sa
-- ON sa.store_id = s.id
-- LEFT JOIN auth.users au
-- ON au.id = sa.user_id
-- GROUP BY s.id, s.name, s.organization_id;

================================================================================
COSY MANAGEMENT — P0 SECURITY ROLLOUT PLAYBOOK
Deployment Date: 2026-05-15 (or date of execution)
Status: PRODUCTION CRITICAL
================================================================================

EXECUTIVE SUMMARY
-----------------
This playbook deploys 6 security migrations fixing critical cross-tenant
data access vulnerabilities in 5 financial RPCs. Deployment is atomic,
reversible, and uses rolling validation. Expected downtime: 0 minutes.
Expected user impact: None (for legitimate users). Unauthorized users will
receive 42501 (permission denied) errors on 5 RPCs.

TEAM ROLES
----------
• Deployment Lead: Executes migrations, monitors alerts
• Database Admin: Verifies pre-flight conditions, handles rollback
• QA: Runs smoke tests in staging and production
• On-call Support: Monitors production logs, fields user reports

================================================================================
SECTION 1: PRE-DEPLOYMENT CHECKLIST (Do 1 hour before deployment)
================================================================================

[ ] 1.1 Verify Supabase CLI is installed and configured
    $ supabase --version
    Expected output: supabase version X.Y.Z
    
    $ supabase projects list
    Expected output: At least one project in the list

[ ] 1.2 Verify connectivity to production database
    $ supabase db shell
    -- Run inside the shell:
    SELECT version();
    \q
    Expected output: PostgreSQL version >= 12, exits cleanly

[ ] 1.3 Verify all 6 migration files exist
    $ ls -la supabase/migrations/20260515_p0_*.sql
    Expected output:
      -rw-r--r-- 20260515_p0_a_revoke_public_grants.sql
      -rw-r--r-- 20260515_p0_a_rollback_revoke_public_grants.sql
      -rw-r--r-- 20260515_p0_b_fix_get_daily_totals.sql
      -rw-r--r-- 20260515_p0_b_rollback_get_daily_totals.sql
      -rw-r--r-- 20260515_p0_c_fix_get_entity_ytd_summary.sql
      -rw-r--r-- 20260515_p0_c_rollback_get_entity_ytd_summary.sql
      -rw-r--r-- 20260515_p0_d_fix_professional_delete_goal_transaction.sql
      -rw-r--r-- 20260515_p0_d_rollback_professional_delete_goal_transaction.sql
      -rw-r--r-- 20260515_p0_e_fix_get_daily_performance_tracker.sql
      -rw-r--r-- 20260515_p0_e_rollback_get_daily_performance_tracker.sql
      -rw-r--r-- 20260515_p0_f_fix_move_manage_entity_search_path.sql
      -rw-r--r-- 20260515_p0_f_rollback_move_manage_entity_search_path.sql

[ ] 1.4 Verify store_access table structure (critical dependency)
    Command:
    supabase db shell
    
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_access'
    ORDER BY ordinal_position;
    
    Expected columns:
      id             | uuid      | NO
      user_id        | uuid      | NO
      store_id       | uuid      | NO
      role           | text      | NO
      can_edit_transactions | boolean | YES
      [other columns optional]
    
    If missing: STOP. Deploy the table/columns first via separate migration.

[ ] 1.5 Verify Phase 1 migration is deployed
    Command:
    supabase db shell
    
    SELECT proname, prosecdef
    FROM pg_proc
    WHERE proname = 'transfer_funds'
    LIMIT 1;
    
    Expected output: transfer_funds exists
    
    If not found: STOP. Deploy 20260514_fix_transfer_funds_auth_and_sign.sql first.

[ ] 1.6 Verify no active long-running transactions on target functions
    Command:
    supabase db shell
    
    SELECT pid, usename, query, query_start, state_change
    FROM pg_stat_activity
    WHERE state = 'active'
      AND (query ILIKE '%get_daily_totals%'
           OR query ILIKE '%get_entity_ytd_summary%'
           OR query ILIKE '%professional_delete%'
           OR query ILIKE '%get_daily_performance%'
           OR query ILIKE '%transfer_funds%'
           OR query ILIKE '%move_manage_entity%')
    ORDER BY query_start;
    
    Expected output: 0 rows
    
    If found: Wait for queries to complete or disconnect idle sessions:
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE usename = 'postgres' AND state = 'idle' AND query_start < now() - interval '30 minutes';

[ ] 1.7 Verify staging environment is ready (if applicable)
    Command:
    supabase projects list
    
    Expected: A separate "staging" project exists for dry-run testing
    
    If not available: Deploy to production directly (no staging available).
      Mark this decision in the deployment log.

[ ] 1.8 Verify current time is within deployment window
    Command:
    date
    
    Expected: Current time is during LOW-TRAFFIC hours (e.g., 02:00–04:00 UTC)
    
    If not: Reschedule deployment to low-traffic window.
    Production time: Usually 02:00–04:00 UTC, 14:00–16:00 UTC for Asia
    
    Business hours (avoid): 08:00–18:00 (any timezone)

[ ] 1.9 Create backup snapshot (if using managed service like Supabase)
    Command:
    # Supabase managed backups — automatic, no action required
    # Verify backup is in progress via Supabase dashboard:
    # https://app.supabase.com/project/<project-id>/settings/database
    
    Expected: Last backup timestamp is within 24 hours
    
    If backup is stale: Request manual backup via support or Supabase UI.

[ ] 1.10 Notify stakeholders
    Send message to team Slack/email:
    ────────────────────────────────────────────────────────────
    🔒 P0 Security Deployment: 2026-05-15 02:00 UTC
    
    Scope: 5 financial RPCs (get_daily_totals, get_entity_ytd_summary, etc.)
    Change: Add cross-tenant isolation auth guards
    Expected Impact: None for authorized users; 42501 errors for unauthorized
    Duration: ~5 minutes (migrations are fast)
    Rollback: Available if critical issue occurs
    
    Watch for: Dashboard loading errors, 42501 patterns in logs
    Contact: [deployment-lead@company.com]
    ────────────────────────────────────────────────────────────

✅ PASS ALL CHECKS BEFORE PROCEEDING TO SECTION 2

================================================================================
SECTION 2: STAGING DEPLOYMENT & VALIDATION (Optional but recommended)
================================================================================

SKIP THIS SECTION IF: No staging environment is available.
INCLUDE THIS SECTION IF: A separate staging Supabase project exists.

STAGING DEPLOYMENT
------------------

[ ] 2.1 Deploy to staging database
    
    Command:
    export SUPABASE_DB_PASSWORD="<staging-db-password>"
    supabase db push --file supabase/migrations/20260515_p0_a_revoke_public_grants.sql
    supabase db push --file supabase/migrations/20260515_p0_b_fix_get_daily_totals.sql
    supabase db push --file supabase/migrations/20260515_p0_c_fix_get_entity_ytd_summary.sql
    supabase db push --file supabase/migrations/20260515_p0_d_fix_professional_delete_goal_transaction.sql
    supabase db push --file supabase/migrations/20260515_p0_e_fix_get_daily_performance_tracker.sql
    supabase db push --file supabase/migrations/20260515_p0_f_fix_move_manage_entity_search_path.sql
    
    Expected output (for each):
    ✓ Migrated [...].sql
    ✓ Database updated
    
    Timing: Each migration should complete in < 1 second
    
    If error: Examine the error message (see SECTION 9: TROUBLESHOOTING)

[ ] 2.2 Verify migrations applied
    Command:
    supabase db shell
    
    SELECT name, executed_at
    FROM schema_migrations
    WHERE name LIKE '20260515_p0_%'
    ORDER BY executed_at DESC;
    
    Expected output: 6 rows (one for each migration), all with recent executed_at times

STAGING VALIDATION
------------------

[ ] 2.3 Test auth guard on get_daily_totals (unauthorized user)
    Command:
    supabase db shell
    
    -- Simulate an unauthorized user (NULL auth context)
    SET request.jwt.claims = '{}';  -- Empty JWT → auth.uid() = NULL
    
    SELECT get_daily_totals('<any-valid-store-uuid>'::uuid, '2026-05-01');
    
    Expected output:
    ERROR: Απαιτείται σύνδεση. (ERROR 42501)
    
    If success: BLOCKER — auth guard is not working. STOP and debug.

[ ] 2.4 Test auth guard on get_daily_totals (authorized user)
    Command:
    supabase db shell
    
    -- Simulate an authorized user (valid JWT with known store_access)
    SET request.jwt.claims = '{"sub":"<real-user-uuid>"}';
    
    -- Insert a test store_access row if one doesn't exist:
    INSERT INTO public.store_access (user_id, store_id, role)
    VALUES ('<real-user-uuid>'::uuid, '<test-store-uuid>'::uuid, 'admin')
    ON CONFLICT DO NOTHING;
    
    -- Call the function with the store they have access to:
    SELECT get_daily_totals('<test-store-uuid>'::uuid, '2026-05-01');
    
    Expected output:
    {
      "income": <number>,
      "expense": <number>,
      "credits": <number>,
      "savings_deposits": <number>,
      "savings_withdrawals": <number>
    }
    
    If error: Debug — check store_access row exists and store_id is correct.

[ ] 2.5 Test FOR UPDATE lock in professional_delete_goal_transaction
    Command (Session 1):
    supabase db shell
    
    BEGIN;
    SET request.jwt.claims = '{"sub":"<real-user-uuid>"}';
    
    -- Insert a test transaction if needed
    INSERT INTO public.transactions (store_id, type, amount, category)
    VALUES ('<test-store-uuid>'::uuid, 'income', 100, 'Test')
    RETURNING id;  -- Note the returned transaction ID
    
    INSERT INTO public.savings_goals (store_id, name, target_amount, current_amount)
    VALUES ('<test-store-uuid>'::uuid, 'Test Goal', 500, 100)
    RETURNING id;  -- Note the returned goal ID
    
    SELECT professional_delete_goal_transaction(
      '<tx-id-from-above>'::uuid,
      '<goal-id-from-above>'::uuid,
      '<test-store-uuid>'::uuid
    );
    
    -- DO NOT COMMIT YET — hold the transaction for 30 seconds
    
    Command (Session 2, open in parallel while Session 1 is still in transaction):
    supabase db shell
    
    SET request.jwt.claims = '{"sub":"<real-user-uuid>"}';
    
    -- Try to delete the same transaction (should block until Session 1 commits)
    SELECT professional_delete_goal_transaction(
      '<same-tx-id>'::uuid,
      '<same-goal-id>'::uuid,
      '<test-store-uuid>'::uuid
    );
    
    Expected behavior:
    - Session 2 blocks for ~30 seconds (waiting for Session 1's lock)
    - Session 1 COMMIT succeeds
    - Session 2 resumes and returns 0 (transaction already deleted)
    
    If Session 2 proceeds immediately: BLOCKER — FOR UPDATE lock not working.

[ ] 2.6 Test SECURITY INVOKER on get_daily_performance_tracker
    Command:
    supabase db shell
    
    SET request.jwt.claims = '{"sub":"<real-user-uuid>"}';
    
    SELECT get_daily_performance_tracker('<test-store-uuid>'::uuid, '2026-05-01');
    
    Expected output:
    {
      "income_today": <number>,
      "expense_today": <number>,
      "income_avg": <number>,
      "expense_avg": <number>,
      "weekday_label": "<Greek day name>",
      "income_diff_pct": <number>,
      "expense_diff_pct": <number>
    }
    
    If error: Debug — check auth context and store_access.

[ ] 2.7 Verify search_path on move_manage_entity
    Command:
    supabase db shell
    
    SELECT proname, proconfig
    FROM pg_proc
    WHERE proname = 'move_manage_entity';
    
    Expected output:
    proconfig = '{"search_path=public, pg_catalog"}'
    
    If NULL or different: BLOCKER — search_path not set. Rerun migration p0_f.

✅ STAGING VALIDATION COMPLETE

If any checks fail, investigate using SECTION 9, fix the issue, and restart
staging validation before proceeding to production.

================================================================================
SECTION 3: PRODUCTION DEPLOYMENT
================================================================================

CRITICAL: Do this during low-traffic hours (02:00–04:00 UTC recommended)

DEPLOYMENT COMMANDS
-------------------

[ ] 3.1 Deploy migration p0_a (REVOKE PUBLIC grants) — DEPLOY FIRST
    
    Command:
    supabase db push --file supabase/migrations/20260515_p0_a_revoke_public_grants.sql
    
    Expected output:
    ✓ Migrated 20260515_p0_a_revoke_public_grants.sql
    ✓ Database updated
    
    Timing: < 1 second
    
    Impact: Anon-key callers can no longer invoke the 5 RPCs; authenticated
            users are unaffected (they have explicit GRANT).
    
    Log this: "p0_a deployed successfully at [timestamp]"

[ ] 3.2 Wait 30 seconds, then deploy migration p0_b (get_daily_totals auth)
    
    Command:
    sleep 30
    supabase db push --file supabase/migrations/20260515_p0_b_fix_get_daily_totals.sql
    
    Expected output:
    ✓ Migrated 20260515_p0_b_fix_get_daily_totals.sql
    ✓ Database updated
    
    Timing: < 1 second
    
    Impact: Authenticated users without store_access now get 42501 on
            get_daily_totals. Legitimate users (with store_access) unaffected.
    
    Log this: "p0_b deployed successfully at [timestamp]"

[ ] 3.3 Deploy migration p0_c (get_entity_ytd_summary auth)
    
    Command:
    supabase db push --file supabase/migrations/20260515_p0_c_fix_get_entity_ytd_summary.sql
    
    Expected output:
    ✓ Migrated 20260515_p0_c_fix_get_entity_ytd_summary.sql
    ✓ Database updated
    
    Timing: < 1 second
    
    Log this: "p0_c deployed successfully at [timestamp]"

[ ] 3.4 Deploy migration p0_d (professional_delete_goal_transaction auth + FOR UPDATE)
    
    Command:
    supabase db push --file supabase/migrations/20260515_p0_d_fix_professional_delete_goal_transaction.sql
    
    Expected output:
    ✓ Migrated 20260515_p0_d_fix_professional_delete_goal_transaction.sql
    ✓ Database updated
    
    Timing: < 1 second
    
    Impact: Only users with admin role or can_edit_transactions=true can
            call professional_delete_goal_transaction. FOR UPDATE lock
            prevents concurrent delete race conditions.
    
    Log this: "p0_d deployed successfully at [timestamp]"

[ ] 3.5 Deploy migration p0_e (get_daily_performance_tracker: DEFINER → INVOKER + auth)
    
    Command:
    supabase db push --file supabase/migrations/20260515_p0_e_fix_get_daily_performance_tracker.sql
    
    Expected output:
    ✓ Migrated 20260515_p0_e_fix_get_daily_performance_tracker.sql
    ✓ Database updated
    
    Timing: < 1 second
    
    Impact: get_daily_performance_tracker switches from SECURITY DEFINER
            (privilege escalation) to SECURITY INVOKER (caller context).
            Now requires store_access. Eliminates search_path poisoning vector.
    
    Log this: "p0_e deployed successfully at [timestamp]"

[ ] 3.6 Deploy migration p0_f (move_manage_entity search_path)
    
    Command:
    supabase db push --file supabase/migrations/20260515_p0_f_fix_move_manage_entity_search_path.sql
    
    Expected output:
    ✓ Migrated 20260515_p0_f_fix_move_manage_entity_search_path.sql
    ✓ Database updated
    
    Timing: < 1 second
    
    Impact: move_manage_entity is now immune to search_path poisoning.
            Invisible to callers; no behavior change.
    
    Log this: "p0_f deployed successfully at [timestamp]"

✅ ALL 6 MIGRATIONS DEPLOYED

Total deployment time: ~6 seconds (+ 30-second wait between p0_a and p0_b)
Expected total duration: ~45 seconds

================================================================================
SECTION 4: PRODUCTION VALIDATION (Immediate Post-Deployment)
================================================================================

VALIDATION WINDOW: Execute within 5 minutes of completing Section 3

[ ] 4.1 Verify all 6 migrations are in schema_migrations
    
    Command:
    supabase db shell
    
    SELECT name, executed_at
    FROM schema_migrations
    WHERE name LIKE '20260515_p0_%'
    ORDER BY executed_at DESC;
    
    Expected output: 6 rows, all with executed_at times from the last few minutes
    
    If fewer than 6 rows: CRITICAL — some migrations failed. Check logs.

[ ] 4.2 Verify no deployment errors in Supabase logs
    
    Command:
    # Check Supabase project logs via dashboard:
    # https://app.supabase.com/project/<project-id>/logs
    # Filter: "error" or "ERROR"
    
    Expected: No ERROR messages related to p0 migrations
    
    If errors found: Read error message; reference SECTION 9 for troubleshooting.

[ ] 4.3 Verify functions are callable (basic connectivity)
    
    Command:
    supabase db shell
    
    -- Test each of the 5 fixed functions:
    SELECT get_daily_totals('<any-store-uuid>'::uuid, current_date) IS NOT NULL;
    SELECT get_entity_ytd_summary('<any-store-uuid>'::uuid, 'revenue_source', '<any-uuid>'::uuid, '2026-01-01'::date, '2026-05-15'::date) IS NOT NULL;
    SELECT professional_delete_goal_transaction('<any-uuid>'::uuid, '<any-uuid>'::uuid, '<any-store-uuid>'::uuid) IS NOT NULL;
    SELECT get_daily_performance_tracker('<any-store-uuid>'::uuid, current_date) IS NOT NULL;
    SELECT transfer_funds('<any-uuid>'::uuid, '<any-uuid>'::uuid, 1.0, 'test') IS NOT NULL;
    
    Expected output: All return true (or NULL if no data exists, which is fine)
    
    If any return ERROR: BLOCKER — function is broken. Reference SECTION 9.

[ ] 4.4 Verify cross-tenant isolation is now enforced
    
    Command (test as unauthenticated user):
    # Using curl to simulate an unauthenticated REST API call:
    
    curl -X POST https://<project>.supabase.co/rest/v1/rpc/get_daily_totals \
      -H "Content-Type: application/json" \
      -H "apikey: <supabase-anon-key>" \
      -d '{"p_store_id":"<any-store-uuid>","p_date":"2026-05-01"}'
    
    Expected output (HTTP 401 or 403):
    {
      "code": "PGRST000",
      "message": "Απαιτείται σύνδεση. (42501)",
      "details": "..."
    }
    
    If call succeeds: CRITICAL — auth guard is not working. ROLL BACK immediately.

[ ] 4.5 Verify legitimate authenticated users can still call functions
    
    Command (test as authenticated user with store_access):
    # Using curl to simulate an authenticated REST API call:
    
    export JWT_TOKEN="<valid-jwt-token-for-test-user>"
    export TEST_STORE_UUID="<store-uuid-user-has-access-to>"
    
    curl -X POST https://<project>.supabase.co/rest/v1/rpc/get_daily_totals \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "apikey: <supabase-anon-key>" \
      -d "{\"p_store_id\":\"$TEST_STORE_UUID\",\"p_date\":\"2026-05-01\"}"
    
    Expected output (HTTP 200):
    {
      "income": <number>,
      "expense": <number>,
      ...
    }
    
    If call returns 42501: BLOCKER — legitimate users are rejected. Investigate store_access.

✅ VALIDATION COMPLETE — ALL CHECKS PASSED

If any check fails, follow SECTION 9: TROUBLESHOOTING and SECTION 10: INCIDENT RESPONSE

================================================================================
SECTION 5: UNAUTHORIZED ACCESS TEST MATRIX
================================================================================

OBJECTIVE: Verify that cross-tenant unauthorized access is now blocked

Perform these tests within 30 minutes of deployment. Use staging first if possible.

TEST 1: Anon-key caller cannot read any store's daily totals
────────────────────────────────────────────────────────────

Setup:
  - Store A: user@company.com is admin
  - Store B: different-user@company.com is admin
  - Attacker: has Supabase anon key, no JWT

Attack attempt (as attacker with anon key):
  
  curl -X POST https://<project>.supabase.co/rest/v1/rpc/get_daily_totals \
    -H "Content-Type: application/json" \
    -H "apikey: <supabase-anon-key>" \
    -d '{"p_store_id":"<store-B-uuid>","p_date":"2026-05-01"}'

Expected result: ✅ BLOCKED
  HTTP 401 or 403
  Error message includes "42501" or "Απαιτείται σύνδεση"

If successful: ❌ FAIL — CRITICAL VULNERABILITY
  ROLL BACK immediately. Contact security team.

---

TEST 2: Authenticated user cannot read a store they don't have access to
─────────────────────────────────────────────────────────────────────────

Setup:
  - Store A: user@company.com is admin
  - Store B: different-user@company.com is admin
  - Attacker: user@company.com has valid JWT but NO access to Store B

Attack attempt (as user@company.com, targeting Store B):
  
  export JWT_TOKEN="<jwt-for-user@company.com>"
  
  curl -X POST https://<project>.supabase.co/rest/v1/rpc/get_daily_totals \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d '{"p_store_id":"<store-B-uuid>","p_date":"2026-05-01"}'

Expected result: ✅ BLOCKED
  HTTP 403
  Error message includes "42501" or "Δεν έχετε πρόσβαση"

If successful: ❌ FAIL — CRITICAL VULNERABILITY
  ROLL BACK immediately.

---

TEST 3: User with admin role CAN read their own store
──────────────────────────────────────────────────────

Setup:
  - Store A: user@company.com is admin
  - store_access row: user_id=<user@company.com UUID>, store_id=<Store A UUID>, role='admin'

Legitimate request (as user@company.com, targeting their own Store A):
  
  export JWT_TOKEN="<jwt-for-user@company.com>"
  
  curl -X POST https://<project>.supabase.co/rest/v1/rpc/get_daily_totals \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d '{"p_store_id":"<store-A-uuid>","p_date":"2026-05-01"}'

Expected result: ✅ SUCCESS
  HTTP 200
  Response body contains JSON with income, expense, etc.

If error: ❌ FAIL — Legitimate users are blocked
  Investigate store_access table; likely missing a row.

---

TEST 4: Delete operation requires edit permission
────────────────────────────────────────────────────

Setup:
  - Store A has two users:
    • admin_user: role='admin'
    • read_only_user: role='viewer', can_edit_transactions=false
  - A transaction and goal exist in Store A

Attack attempt (as read_only_user, trying to delete a transaction):
  
  export JWT_TOKEN="<jwt-for-read_only_user>"
  
  curl -X POST https://<project>.supabase.co/rest/v1/rpc/professional_delete_goal_transaction \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d '{"p_transaction_id":"<tx-uuid>","p_goal_id":"<goal-uuid>","p_store_id":"<store-A-uuid>"}'

Expected result: ✅ BLOCKED
  HTTP 403
  Error message: "Δεν έχετε δικαιώματα επεξεργασίας..."

If successful: ❌ FAIL — Permission check not working
  Investigate store_access.can_edit_transactions column.

---

TEST 5: Entity ID from different store cannot be read
──────────────────────────────────────────────────────

Setup:
  - Store A: user@company.com is admin
  - Store B: different-user@company.com is admin
  - Store B has a supplier with ID <supplier-B-uuid>
  - Attacker: user@company.com (has access to Store A, not Store B)

Attack attempt (as user@company.com, trying to enumerate Store B's suppliers):
  
  export JWT_TOKEN="<jwt-for-user@company.com>"
  
  curl -X POST https://<project>.supabase.co/rest/v1/rpc/get_entity_ytd_summary \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d '{
      "p_store_id":"<store-B-uuid>",
      "p_entity_type":"supplier",
      "p_entity_id":"<supplier-B-uuid>",
      "p_date_from":"2026-01-01",
      "p_date_to":"2026-05-15"
    }'

Expected result: ✅ BLOCKED
  HTTP 403
  Error message: "Δεν έχετε πρόσβαση..."

If successful: ❌ FAIL — Store membership check not working
  CRITICAL VULNERABILITY. Roll back.

---

✅ ALL 5 TESTS PASSED

Document results in deployment log:
────────────────────────────────────
P0 Unauthorized Access Tests: PASS (all 5 tests blocked cross-tenant attacks)
Timestamp: [ISO 8601 timestamp]
Tester: [name]

================================================================================
SECTION 6: MONITORING QUERIES
================================================================================

Execute these queries in the first 24 hours post-deployment to verify system health.

QUERY 1: Verify no P0 functions are callable by PUBLIC role
──────────────────────────────────────────────────────────

supabase db shell

SELECT p.proname, a.grantee, a.privilege_type
FROM pg_proc p
JOIN information_schema.routine_privileges a
  ON (a.routine_name = p.proname OR a.routine_schema = 'public')
WHERE p.proname IN (
  'get_daily_totals',
  'get_entity_ytd_summary',
  'professional_delete_goal_transaction',
  'get_daily_performance_tracker',
  'transfer_funds'
)
AND a.grantee = 'PUBLIC';

Expected: 0 rows (no PUBLIC access)

If rows found: PUBLIC still has EXECUTE — CRITICAL
  Re-run migration p0_a immediately.

---

QUERY 2: Count authorization failures (42501 errors) in last 1 hour
──────────────────────────────────────────────────────────────────

supabase db shell

SELECT COUNT(*) as blocked_auth_failures
FROM pg_stat_statements
WHERE query LIKE '%42501%'
  AND query_start > now() - interval '1 hour';

Expected: Small positive number (a few unauthorized users trying)

If zero: Possible, but unusual — likely few unauthorized attempts
If very high (>100): Possible legitimate misconfiguration — investigate

---

QUERY 3: Verify get_daily_performance_tracker is SECURITY INVOKER (not DEFINER)
─────────────────────────────────────────────────────────────────────────────────

supabase db shell

SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'get_daily_performance_tracker';

Expected: prosecdef = false (INVOKER)

If true (DEFINER): BLOCKER — migration p0_e did not apply correctly
  Re-run migration p0_e.

---

QUERY 4: Verify move_manage_entity has search_path set
──────────────────────────────────────────────────────

supabase db shell

SELECT proname, proconfig
FROM pg_proc
WHERE proname = 'move_manage_entity';

Expected: proconfig includes 'search_path=public, pg_catalog'

If NULL or missing: BLOCKER — migration p0_f did not apply
  Re-run migration p0_f.

---

QUERY 5: Monitor function execution performance (no new slow queries)
─────────────────────────────────────────────────────────────────────

supabase db shell

SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%get_daily_totals%'
   OR query LIKE '%get_entity_ytd_summary%'
   OR query LIKE '%get_daily_performance_tracker%'
ORDER BY mean_exec_time DESC;

Expected:
  - mean_exec_time < 100 ms for each function
  - No calls show max_exec_time > 1000 ms (no timeout issues)

If slow: The auth guard WHERE clauses should not cause slowdown
  Likely cause: missing indexes on store_access. File as P2 concern.

---

QUERY 6: Check for any deadlocks from FOR UPDATE lock (p0_d)
─────────────────────────────────────────────────────────────

supabase db shell

SELECT xact_start, query, wait_event
FROM pg_stat_activity
WHERE wait_event LIKE '%Lock%'
  AND query LIKE '%professional_delete_goal_transaction%';

Expected: 0 rows (no locks held longer than expected)

If found: Locks are normal but should release quickly (<1 second)
  If locks persist for >10 seconds: Check application logic; may be
  holding transactions open unnecessarily.

---

QUERY 7: Verify store_access is still accessible (not corrupted)
────────────────────────────────────────────────────────────────

supabase db shell

SELECT COUNT(*) as total_store_access_rows
FROM public.store_access;

Expected: Positive number (>100 rows typically)

If zero or error: BLOCKER — table is missing or corrupted
  Contact database admin.

================================================================================
SECTION 7: EXPECTED ERRORS (Normal Post-Deployment)
================================================================================

LOG PATTERN 1: Authorized users still see 42501 if store_access row is missing
──────────────────────────────────────────────────────────────────────────────

User reports: "Dashboard shows 'Permission denied' error after deployment"

Root cause: The user's store_access row may not exist, or was deleted, or
            belongs to a different store than they're trying to access.

Expected log message:
  ERROR at 2026-05-15 02:30:45.123Z in get_daily_totals:
  Δεν έχετε πρόσβαση σε αυτό το κατάστημα. (42501)

Action: Check if user has a store_access row for the store they're accessing
  supabase db shell
  SELECT * FROM public.store_access
  WHERE user_id = '<user-uuid>'
  AND store_id = '<store-uuid>';
  
  If no row: Insert one (likely via UI or sync from another system)
  If row exists: Check if role is correct (should not be 'none' or NULL)

---

LOG PATTERN 2: Multiple 42501 errors if a client library is not sending JWT
─────────────────────────────────────────────────────────────────────────────

User reports: "All API calls are failing with permission denied"

Root cause: Client app (mobile, web) is not including Authorization header
            with the JWT token.

Expected log messages (many of these in short time):
  ERROR 2026-05-15 02:31:10.456Z: Απαιτείται σύνδεση. (42501)
  ERROR 2026-05-15 02:31:11.200Z: Απαιτείται σύνδεση. (42501)
  ERROR 2026-05-15 02:31:12.010Z: Απαιτείται σύνδεση. (42501)

Action: Verify client app includes Authorization header:
  Authorization: Bearer <jwt-token>
  
  Check Supabase client library version and JWT refresh logic.

---

LOG PATTERN 3: 42501 from read-only users trying to DELETE
────────────────────────────────────────────────────────────

User reports: "Goal transaction deletion is now blocked"

Root cause: User has role='viewer' or similar, and deployment added
            permission check for delete operations.

Expected log message:
  ERROR at 2026-05-15 02:35:22.789Z in professional_delete_goal_transaction:
  Δεν έχετε δικαιώματα επεξεργασίας για αυτό το κατάστημα. (42501)

Action: Verify user's store_access.role and can_edit_transactions settings
  supabase db shell
  SELECT user_id, role, can_edit_transactions
  FROM public.store_access
  WHERE user_id = '<user-uuid>'
  AND store_id = '<store-uuid>';
  
  If role != 'admin' AND can_edit_transactions != true: This is correct
  behavior. Only admins or users with explicit can_edit permission can delete.

---

LOG PATTERN 4: Slow queries on get_entity_ytd_summary or get_daily_performance_tracker
────────────────────────────────────────────────────────────────────────────────────────

Monitoring alert: "Slow query detected: get_entity_ytd_summary took 2.5 seconds"

Root cause: User queried a very large date range; aggregation over many rows
            takes time. This is NOT a regression from the migration.

Expected log message:
  SLOW QUERY 2026-05-15 02:40:01.234Z: get_entity_ytd_summary(...)
  Duration: 2456 ms (> 1000 ms threshold)

Action: Check the query parameters in the slow query log
  supabase db shell
  SELECT query, calls, mean_exec_time
  FROM pg_stat_statements
  WHERE query LIKE '%get_entity_ytd_summary%';
  
  If mean_exec_time is high (>200 ms) even for small date ranges, then
  investigate missing indexes. Otherwise, this is normal for large ranges.

---

LOG PATTERN 5: Repeated lock timeouts on professional_delete_goal_transaction
───────────────────────────────────────────────────────────────────────────────

Monitoring alert: "Lock timeout on transactions table"

Root cause: Concurrent deletes are queuing behind the FOR UPDATE lock (expected)
            but one is timing out after waiting too long.

Expected log message:
  ERROR 2026-05-15 02:45:33.567Z: Lock timeout after 30000ms
  In professional_delete_goal_transaction(...)

Action: This is a concurrency issue, not a security issue. Monitor the
  application:
  - Are many users trying to delete the same transaction simultaneously?
    (Unlikely, but possible in multi-user save races)
  - Is the initial SELECT taking too long?
    Investigate indexes on (store_id, id) on transactions table.

---

✅ ALL EXPECTED ERRORS ARE NON-BLOCKING

If you see any ERROR patterns NOT listed above, file them as unexpected
and reference SECTION 9: TROUBLESHOOTING.

================================================================================
SECTION 8: MONITORING DASHBOARD (24-hour post-deployment check)
================================================================================

Set up alerts for these metrics in your monitoring system (DataDog, New Relic, etc.)

METRIC 1: 42501 Error Rate
──────────────────────────

Query:
  SELECT rate(errors{status_code=42501}[5m]) / rate(requests[5m])

Expected: 1–3% error rate (a few unauthorized attempts per hour)

Alert threshold:
  WARNING if > 5% (many unauthorized attempts)
  CRITICAL if > 20% (possible attack or misconfiguration)

---

METRIC 2: Function execution latency (p-99)
─────────────────────────────────────────────

Query:
  SELECT histogram_quantile(0.99, rate(function_exec_time[5m]))
  WHERE function IN (
    'get_daily_totals',
    'get_entity_ytd_summary',
    'get_daily_performance_tracker',
    'professional_delete_goal_transaction',
    'transfer_funds'
  )

Expected: < 200 ms p-99 for all functions

Alert threshold:
  WARNING if > 500 ms
  CRITICAL if > 2000 ms

---

METRIC 3: Database CPU utilization
────────────────────────────────────

Query:
  SELECT avg(cpu_percent) [5m]

Expected: < 50% average

Alert threshold:
  WARNING if > 75%
  CRITICAL if > 90%

(Not a direct indicator of the migration, but monitor for performance regressions)

---

METRIC 4: Authentication failures in application logs
───────────────────────────────────────────────────────

Query:
  SELECT count(*) WHERE log_level = 'ERROR' AND message LIKE '42501'

Expected: 0–5 per hour (few unauthorized attempts)

Alert threshold:
  WARNING if > 20 per hour
  CRITICAL if > 100 per hour

---

✅ MONITORING DASHBOARD CONFIGURED

Review these metrics every hour for the first 24 hours post-deployment.
After 24 hours, revert to normal monitoring cadence (daily).

================================================================================
SECTION 9: TROUBLESHOOTING
================================================================================

If any step in Sections 4 or 5 fails, reference this troubleshooting guide.

ISSUE 1: Migration fails with "function does not exist"
─────────────────────────────────────────────────────────

Error message example:
  ERROR: function public.get_daily_totals(uuid, date) does not exist
  
Root cause: The original function was dropped or never created.

Solution:
  1. Check if the function exists:
     supabase db shell
     SELECT proname FROM pg_proc WHERE proname = 'get_daily_totals';
  
  2. If function is missing, check migration history:
     SELECT name FROM schema_migrations WHERE name LIKE 'backfill%';
  
  3. If backfill_missing_rpc_functions.sql is NOT in schema_migrations,
     the P0 migrations assume the function exists. Deploy the backfill
     migration first:
     supabase db push --file supabase/migrations/backfill_missing_rpc_functions.sql

After deploying backfill, retry the P0 migration.

---

ISSUE 2: Migration fails with "role does not exist"
────────────────────────────────────────────────────

Error message example:
  ERROR: role "authenticated" does not exist
  
Root cause: Supabase Postgres roles are not initialized.

Solution:
  1. This should not happen in a standard Supabase project.
  2. Verify the project is initialized by checking for built-in roles:
     supabase db shell
     SELECT rolname FROM pg_roles WHERE rolname IN ('authenticated', 'anon', 'service_role');
  
  3. If roles are missing, contact Supabase support or reinitialize the project.

---

ISSUE 3: Authenticated users get 42501 (permission denied) on legitimate calls
────────────────────────────────────────────────────────────────────────────────

Error message:
  ERROR: Δεν έχετε πρόσβαση σε αυτό το κατάστημα. (42501)
  
Root cause: User does not have a store_access row for the store they're accessing.

Solution:
  1. Verify the store_access row exists:
     supabase db shell
     SET request.jwt.claims = '{"sub":"<user-uuid>"}';
     SELECT * FROM public.store_access
     WHERE user_id = auth.uid();
  
  2. If no rows are returned: Insert the missing row
     INSERT INTO public.store_access (user_id, store_id, role)
     VALUES ('<user-uuid>', '<store-uuid>', 'admin');
  
  3. Retry the function call.

Alternatively, investigate why the store_access row is missing:
  - Was the user not properly onboarded when added to the store?
  - Was the row deleted by accident?
  - Is there a sync process that should have created the row?

---

ISSUE 4: Unauthenticated users can still call the function (auth guard not working)
───────────────────────────────────────────────────────────────────────────────────

Error: Function call succeeds without Authorization header

Root cause: Likely that a function replacement failed silently.

Solution:
  1. Verify the function has the new body (with auth guard):
     supabase db shell
     
     \df+ get_daily_totals
     
     Look for lines containing:
       v_caller_id := auth.uid();
       IF v_caller_id IS NULL THEN
         RAISE EXCEPTION 'Απαιτείται σύνδεση.'
  
  2. If the function body still shows the OLD code (no auth guard), then
     the migration did not apply correctly.
  
  3. Manually re-apply the migration:
     supabase db push --file supabase/migrations/20260515_p0_b_fix_get_daily_totals.sql
  
  4. If error occurs: Check the Supabase logs for the exact error.

---

ISSUE 5: Migration deployment hangs / times out
───────────────────────────────────────────────

Error message:
  (No response after 60 seconds)
  
Root cause: Long-running query or lock contention on the function.

Solution:
  1. Check for active queries:
     supabase db shell
     
     SELECT pid, query, query_start
     FROM pg_stat_activity
     WHERE state = 'active'
     ORDER BY query_start;
  
  2. If a query has been running for > 30 seconds and is not related to
     the migration, terminate it:
     SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE query_start < now() - interval '30 seconds'
     AND usename != 'service_role';
  
  3. Retry the migration.

---

ISSUE 6: Rollback migration fails
─────────────────────────────────

Error message:
  ERROR: function ... cannot be dropped
  
Root cause: The rollback CREATE OR REPLACE is trying to revert a function
  that has dependent views or triggers.

Solution:
  1. Check for dependencies:
     supabase db shell
     
     SELECT pg_get_referencedby_identities('public.get_daily_totals'::regprocedure);
  
  2. If views or triggers depend on the function, they must be dropped first
     (or the rollback needs to drop them). This is unlikely for P0 migrations
     because they only modify function bodies, not signatures.
  
  3. If this occurs, contact database admin; the rollback may require
     manual intervention to drop dependent objects.

---

ISSUE 7: 42501 error but user IS an admin
──────────────────────────────────────────

Error message:
  Δεν έχετε δικαιώματα... (from professional_delete_goal_transaction)
  
Root cause: The store_access row has role='admin' but can_edit_transactions
  is NULL or false.

Solution:
  1. Check the store_access row in detail:
     supabase db shell
     
     SELECT user_id, store_id, role, can_edit_transactions
     FROM public.store_access
     WHERE user_id = '<user-uuid>'
     AND store_id = '<store-uuid>';
  
  2. Update if necessary:
     UPDATE public.store_access
     SET can_edit_transactions = true
     WHERE user_id = '<user-uuid>'
     AND store_id = '<store-uuid>';
  
  3. Retry the delete operation.

================================================================================
SECTION 10: ROLLBACK PROCEDURE
================================================================================

⚠️  ONLY ROLLBACK IF:
   1. A critical production issue occurs that is directly caused by the P0 migrations
      (e.g., all legitimate users are blocked, functions crash, data corruption)
   2. The issue cannot be fixed by investigating root cause (Section 9)
   3. You have verified it is NOT a client-side or configuration issue

DO NOT ROLLBACK just because users see 42501 errors. That is correct behavior
for unauthorized access.

ROLLBACK STEPS
──────────────

[ ] 10.1 Stop deployment communication to users
    Notify on-call: "Investigating production issue; potential rollback coming"

[ ] 10.2 Verify the issue is not a misconfiguration
    Run ISSUE investigations from Section 9 first.
    If misconfiguration is found, fix it and proceed (do not rollback).

[ ] 10.3 Get approval from on-call DBA or deployment lead
    Record: "Rollback approved by [name] at [timestamp]"

[ ] 10.4 Deploy rollback migrations in REVERSE ORDER

    Command:
    supabase db push --file supabase/migrations/20260515_p0_f_rollback_move_manage_entity_search_path.sql
    
    Wait 10 seconds for confirmation.
    
    supabase db push --file supabase/migrations/20260515_p0_e_rollback_get_daily_performance_tracker.sql
    
    Wait 10 seconds.
    
    supabase db push --file supabase/migrations/20260515_p0_d_rollback_professional_delete_goal_transaction.sql
    
    Wait 10 seconds.
    
    supabase db push --file supabase/migrations/20260515_p0_c_rollback_get_entity_ytd_summary.sql
    
    Wait 10 seconds.
    
    supabase db push --file supabase/migrations/20260515_p0_b_rollback_get_daily_totals.sql
    
    Wait 10 seconds.
    
    supabase db push --file supabase/migrations/20260515_p0_a_rollback_revoke_public_grants.sql

    Expected output (for each): ✓ Migrated [...].sql

    Total rollback time: ~1 minute

[ ] 10.5 Verify rollback is complete
    Command:
    supabase db shell
    
    SELECT name, executed_at
    FROM schema_migrations
    WHERE name LIKE '20260515_p0_%'
    ORDER BY executed_at DESC;
    
    Expected: 12 rows (6 forward migrations + 6 rollback migrations)
    The 6 rollback migrations should have the most recent executed_at times.

[ ] 10.6 Verify functions are back to pre-P0 state
    Command:
    supabase db shell
    
    -- Check one function to confirm rollback worked:
    SELECT proname, prosecdef, proconfig
    FROM pg_proc
    WHERE proname = 'get_daily_performance_tracker';
    
    Expected (after rollback to old state):
      prosecdef = true (SECURITY DEFINER, reverted from INVOKER)
      proconfig = NULL (no search_path, reverted)

[ ] 10.7 Notify users and stakeholders
    Send message:
    ────────────────────────────────────────────────────────────
    ⚠️ P0 Security Deployment has been ROLLED BACK as of [timestamp]
    
    Reason: [Brief explanation without technical details]
    Status: System is stable and back to normal operation
    
    We will investigate and redeploy with a fix.
    Apologies for the disruption.
    ────────────────────────────────────────────────────────────

[ ] 10.8 Post-incident review
    1. Investigate root cause (why did the issue occur?)
    2. Document in deployment log
    3. Create a GitHub issue or ticket
    4. Schedule a post-incident review meeting
    5. Re-deploy the fixed migrations after root cause is addressed

✅ ROLLBACK COMPLETE

Expected user experience after rollback:
  - Functions behave as they did before P0 (may include cross-tenant data access)
  - No 42501 errors (auth guards are gone)
  - All dashboards should load again (if they were blocked before)

================================================================================
SECTION 11: SUCCESS CRITERIA (End of 24-hour window)
================================================================================

Confirm ALL of the following to declare the deployment a SUCCESS:

[ ] All 6 migrations appear in schema_migrations table
[ ] No ERROR level logs related to the P0 migrations
[ ] All P0 functions are callable (via SQL and REST API)
[ ] Unauthenticated users get 42501 on get_daily_totals (verified in TEST 1)
[ ] Authorized users can call functions with their store_id (verified in TEST 3)
[ ] Users without store_access get 42501 (verified in TEST 2)
[ ] Read-only users cannot delete transactions (verified in TEST 4)
[ ] Cross-store entity access is blocked (verified in TEST 5)
[ ] get_daily_performance_tracker is SECURITY INVOKER (verified in QUERY 3)
[ ] move_manage_entity has search_path set (verified in QUERY 4)
[ ] Function latency is < 200ms p-99 (verified in QUERY 5)
[ ] No excessive lock timeouts (verified in QUERY 6)
[ ] store_access table is accessible (verified in QUERY 7)
[ ] Zero 42501 errors for legitimate business operations (verified in METRIC 4)
[ ] All dashboards load without auth errors for authorized users
[ ] No customer-reported issues in support tickets
[ ] Payroll, transaction entry, and reports continue normally
[ ] No data corruption detected

✅ IF ALL CRITERIA PASS: Deployment is SUCCESSFUL

Announce to stakeholders:
────────────────────────────────────────────────────────────
✅ P0 SECURITY DEPLOYMENT COMPLETE

Status: SUCCESS (24-hour validation window passed)
All security fixes are now active:
  • Cross-tenant financial data access is blocked
  • Unauthorized deletes are prevented
  • Permission checks are enforced
  • search_path poisoning risk is eliminated

System is stable. No further action required.
────────────────────────────────────────────────────────────

Archive this playbook in your deployment log for future reference.

================================================================================
END OF DEPLOYMENT PLAYBOOK
================================================================================

# SCHEMA USAGE AUDIT - Field Inventory

**Date**: March 17, 2026  
**Scope**: Analysis-only audit of existing schema  
**Focus Tables**: transactions, suppliers, fixed_assets, revenue_sources, store_access  
**Focus Pages**: analysis, reports, credits, profit, suppliers-balance

---

## A) FIELD INVENTORY BY TABLE

### TABLE: `transactions`

**Schema fields (inferred from code usage):**
- `id` - UUID PK
- `store_id` - FK to stores
- `date` - VARCHAR/DATE (transaction date)
- `created_at` - TIMESTAMP (creation time)
- `type` - VARCHAR (expense, income, salary_advance, debt_payment, etc.)
- `amount` - NUMERIC (signed, negative for expenses)
- `category` - VARCHAR (nullable, "Εσοδα Ζ", "Staff", "Εμπορεύματα", etc.)
- `method` / `payment_method` - VARCHAR (nullable, "Μετρητά", "Τράπεζα", "Πίστωση")
- `notes` - TEXT (nullable, free-form)
- `description` - TEXT (nullable)
- `is_credit` - BOOLEAN (nullable, marks credit transactions)
- `supplier_id` - FK (nullable, to suppliers)
- `fixed_asset_id` - FK (nullable, to fixed_assets)
- `revenue_source_id` - FK (nullable, to revenue_sources)
- `is_deleted` - BOOLEAN (nullable)
- `invoice_image` - VARCHAR (optional, file path to storage)
- `bank_name` - VARCHAR (optional, payment bank)
- `rf_code` - VARCHAR (optional, reference code)
- `created_by_name` - VARCHAR (optional, user name at creation)
- `settlement_id` - FK (optional, to settlements)
- `installment_number` - INT (optional, for installments)
- `user_id` - FK (to auth users)

**Fields actually used in 5 focus pages:**
- ✅ `id` - For keying, deletion
- ✅ `store_id` - For filtering
- ✅ `date` / `created_at` - Date parsing fallback, year extraction
- ✅ `type` - Categorizing (income, expense, debt_payment, salary_advance, tip_entry)
- ✅ `amount` - Financial calculations
- ✅ `category` - Grouping by category
- ✅ `method` / `payment_method` - Grouping by payment method; checking for "Πίστωση"
- ✅ `notes` - Description text, parsing for entity names
- ✅ `is_credit` - Filtering credit transactions
- ✅ `supplier_id` - FK to supplier entity
- ✅ `fixed_asset_id` - FK to fixed_asset entity
- ✅ `revenue_source_id` - FK to revenue_source entity

**Fields NOT used (can skip in select()):**
- ❌ `invoice_image` - Not in analysis/reports/credits/profit/suppliers-balance
- ❌ `bank_name` - Not in these 5 pages (employees/page uses it differently)
- ❌ `rf_code` - Not in these 5 pages
- ❌ `created_by_name` - Not used in focus pages
- ❌ `settlement_id` - Not used in focus pages
- ❌ `installment_number` - Not used in focus pages
- ❌ `description` - Checked but typically empty or ignored
- ❌ `user_id` - Not queried in these pages

**Field Naming Issues:**
- ⚠️ `method` vs `payment_method` - Code checks both with fallback: `tx.payment_method ?? tx.method`
- ⚠️ `date` vs `created_at` - Code uses fallback: `t?.date || t?.created_at`

---

### TABLE: `suppliers`

**Schema fields (inferred from code usage):**
- `id` - UUID PK
- `store_id` - FK to stores
- `name` - VARCHAR
- `phone` - VARCHAR (nullable)
- `vat_number` - VARCHAR (nullable)
- `bank_name` - VARCHAR (nullable)
- `iban` - VARCHAR (nullable)
- `rf_code` - VARCHAR (nullable, reference/RF number)
- `is_active` - BOOLEAN (default true)

**Selects found in codebase:**

| Page | Select Pattern | Fields Used |
|------|---|---|
| analysis | `select('id, name')` | id, name |
| add-expense | `select('id, name, phone, vat_number, bank_name, iban')` | All major fields |
| manage-revenue | `select('*')` | All |
| suppliers-balance | `select('*')` | All (computed: balance) |
| credits | `select('*')` | All |
| settings | `select('*')` | All |

**Fields actually used in 5 focus pages:**
- ✅ `id` - Primary key
- ✅ `name` - Display, grouping, mapping
- ✅ `bank_name` - Entity badge computation (isSup filter)
- ✅ `rf_code` - Display with bank_name

**Fields used but NOT required in focus pages:**
- ⚠️ `phone`, `vat_number`, `iban` - Available but not directly used in analysis/reports/credits/profit/suppliers-balance views

**Pattern:**
- ✅ Can use explicit `select('id, name, bank_name, rf_code')` in all 5 focus pages

---

### TABLE: `fixed_assets`

**Schema fields (inferred from code usage):**
- `id` - UUID PK
- `store_id` - FK to stores
- `name` - VARCHAR
- `phone` - VARCHAR (nullable)
- `vat_number` - VARCHAR (nullable)
- `bank_name` - VARCHAR (nullable)
- `iban` - VARCHAR (nullable)
- `rf_code` - VARCHAR (nullable)
- `sub_category` - VARCHAR (enum-like: 'staff', 'maintenance', 'utility', 'other')
- `category` - VARCHAR (fallback field, sometimes used instead of sub_category)
- `is_active` - BOOLEAN
- `start_date` - DATE (nullable, for staff)
- `pay_basis` - VARCHAR (monthly/daily, for staff)
- `monthly_salary` - NUMERIC (nullable, for staff)
- `daily_rate` - NUMERIC (nullable, for staff)
- `monthly_days` - INT (default 25, for staff)
- `position` - VARCHAR (nullable, for staff)
- `amka` - VARCHAR (nullable, for staff)

**Selects found in codebase:**

| Page | Select Pattern | Fields Extracted |
|------|---|---|
| settings | `select('*')` and `select('id, name')` | All / specific |
| analysis | Joined via sub_category | name, sub_category, category |
| manage-revenue | `select('*')` | All |
| suppliers-balance | `select('*')` | All (balanced items) |
| credits | `select('*')` | All |

**Fields actually used in 5 focus pages:**
- ✅ `id` - Primary key
- ✅ `name` - Display, grouping
- ✅ `sub_category` - Type detection (maintenance, utility, other, staff)
- ✅ `category` - Fallback for sub_category in some comparisons

**Fields NOT used in focus pages:**
- ❌ `phone`, `vat_number`, `iban` - Not in these 5 pages
- ❌ `rf_code` - Not in these 5 pages  
- ❌ `start_date`, `pay_basis`, `monthly_salary`, `daily_rate`, `monthly_days`, `position`, `amka` - Staff-specific, not in balance/credit analysis pages
- ⚠️ `bank_name` - Not directly used in our 5 pages (but used elsewhere)

**Pattern:**
- ✅ Can use explicit `select('id, name, sub_category, category, is_active')` in focus pages
- ⚠️ If checking staff records, may need `start_date` (not in focus 5, but common dependency)

---

### TABLE: `revenue_sources`

**Schema fields (inferred):**
- `id` - UUID PK
- `store_id` - FK to stores
- `name` - VARCHAR
- `phone` - VARCHAR (nullable)
- `vat_number` - VARCHAR (nullable)
- `bank_name` - VARCHAR (nullable)
- `iban` - VARCHAR (nullable)
- `rf_code` - VARCHAR (nullable, reference number)
- `is_active` - BOOLEAN

**Selects found in codebase:**

| Page | Select Pattern | Fields |
|------|---|---|
| add-income | `select('id, name')` | Minimal |
| manage-revenue | `select('*')` | All |
| suppliers-balance | `select('*')` | All |
| credits (income tab) | `select('*')` | All |
| analysis | `select('id, name')` | Minimal |

**Fields actually used in 5 focus pages:**
- ✅ `id` - Primary key
- ✅ `name` - Display, mapping, grouping

**Pattern:**
- ✅ Can use explicit `select('id, name')` in all 5 focus pages (minimal)

---

### TABLE: `store_access`

**Fields:**
- `user_id` - FK to auth.users
- `store_id` - FK to stores
- Unique constraint: (user_id, store_id)

**Usage in focus pages:**
- ❌ None directly queried in the 5 focus pages
- ✅ Used implicitly via RLS policies on transactions/suppliers/fixed_assets/revenue_sources

**Pattern:**
- Store filtering (`eq('store_id', storeId)`) operates with RLS backing

---

## B) PAGES SAFE FOR EXPLICIT `select()`

**These pages can use explicit field selection (NO `select('*')`)**:

### ✅ `analysis/page.tsx`
**Lines: 452-454**
```typescript
// Currently:
// suppliers: select('id, name')
// revenue_sources: select('id, name')
// fixed_assets: NOT explicitly queried (no select() call visible in lines 1-100)
```
**Recommendation:**
```typescript
// Keep analysis as is for suppliers/revenue_sources
// Safe explicit fields: id, name only (minimal use)
```

### ✅ `reports/page.tsx`
**Lines: 73-79**
```typescript
// Currently: select('*')
// Used fields: id, date/created_at, type, amount, category, method/payment_method, notes
```
**Recommendation:**
```typescript
.select('id, store_id, date, created_at, type, amount, category, method, payment_method, notes, supplier_id, fixed_asset_id, revenue_source_id, is_credit')
```

### ✅ `credits/page.tsx`
**Lines: 228, 252-285**
```typescript
// Currently: 
// transactions: select('*') at line 228
// suppliers/fixed_assets/revenue_sources: select('*') at lines 252-285
```
**Recommendation:**
```typescript
// transactions:
.select('id, store_id, date, created_at, type, amount, is_credit, supplier_id, fixed_asset_id, revenue_source_id')

// suppliers/fixed_assets/revenue_sources:
suppliers.select('id, name, bank_name, rf_code')
fixed_assets.select('id, name, sub_category, category, is_active')
revenue_sources.select('id, name')
```

### ✅ `profit/page.tsx`
**Lines: 73-79**
```typescript
// Currently: select('*')
// Used fields: Similar to reports
```
**Recommendation:**
```typescript
.select('id, store_id, date, created_at, type, amount, category, method, payment_method, notes, is_credit')
```

### ✅ `suppliers-balance/page.tsx`
**Lines: 273, 282-336**
```typescript
// Currently: select('*') for all tables
// Used fields: Limited subset actually visually displayed
```
**Recommendation:**
```typescript
// transactions:
.select('id, date, created_at, type, amount, is_credit, supplier_id, fixed_asset_id, revenue_source_id')

// suppliers/fixed_assets:
.select('id, name, is_active')

// revenue_sources:
.select('id, name')
```

---

## C) PAGES THAT MUST KEEP `select('*')`

**None of the 5 focus pages REQUIRE `select('*')`**.

All 5 pages can migrate to explicit fields with these recommended selections:

| Page | Recommended Select | Reason |
|------|---|---|
| analysis | Keep minimal (id, name) | Only names used for display |
| reports | Explicit subset | Only date, type, amount, category, method used |
| credits | Explicit subset | Only credit-flag, dates, amounts, entity IDs |
| profit | Explicit subset | Similar to reports (date, type, amount, category) |
| suppliers-balance | Explicit subset | Only balance computation needed, not all fields |

---

## D) FIELDS REQUIRING STANDARDIZATION

### ✅ CANDIDATE 1: `method` vs `payment_method`

**Issue:** Code checks both with fallback
```typescript
String((t.payment_method || t.method || "").trim() || "Άγνωστη Μέθοδος")
```

**Current usage:**
- `method` - Primary field in most code
- `payment_method` - In reports/credits as fallback check

**Recommendation:**
- ✅ Standardize on **`method`** (used more frequently)
- Add migration if `payment_method` exists: `ALTER TABLE transactions RENAME COLUMN payment_method TO method`
- Or deprecate one field slowly

---

### ✅ CANDIDATE 2: `date` vs `created_at` for transaction date

**Issue:** Code checks both with fallback
```typescript
const raw = t?.date || t?.created_at
```

**Current usage:**
- Both used in balance/credit type detection
- `date` = Actual transaction date (user-specified)
- `created_at` = Database insertion time (system-generated)

**Recommendation:**
- ✅ Keep both (they serve different purposes)
- **Always require `date`** on insert (no nulls)
- Use `date` for all grouping/reporting (don't fall back to `created_at`)
- Add NOT NULL constraint to `transactions.date`

---

### ✅ CANDIDATE 3: `category` vs `sub_category` (fixed_assets)

**Issue:** Code checks both fields
```typescript
const sub = String(a.sub_category || '').trim().toLowerCase()
const cat = String(a.category || '').trim().toLowerCase()
if (isMaintenance) return sub === 'maintenance' || cat === 'maintenance'
```

**Current usage:**
- Fixed assets have **structured `sub_category`** enum: (maintenance, utility, other, staff)
- Sometimes `category` appears in balance computations (redundant?)

**Recommendation:**
- ✅ **Authoritative field: `sub_category`** (already enum-like with known values)
- Remove `category` from fixed_assets if redundant
- Ensure all fixed_assets have `sub_category` populated (no NULLs)

---

### ✅ CANDIDATE 4: `is_credit` flag

**Usage in credits/balance pages:**
```typescript
const isCredit = t?.is_credit === true
```

**Recommendation:**
- ✅ Keep as boolean NOT NULL with default false
- Standardize: Always explicitly set on insert for clarity

---

### ✅ CANDIDATE 5: Optional email/phone in entity tables

**Issue:** Seldom used but stored
- `suppliers.phone`, `suppliers.vat_number`
- `fixed_assets.phone`, `fixed_assets.vat_number`
- `revenue_sources.phone`, `revenue_sources.vat_number`

**Usage:** Available in add-expense/add-income forms but not in our 5 focus pages

**Recommendation:**
- ✅ Keep fields (used in other pages)
- Can skip in explicit selects for balance/credit pages
- Document as "rarely accessed" to avoid default `select('*')`

---

## SUMMARY TABLE

| Item | Recommendation | Reason |
|------|---|---|
| Field: `method` | Standardize on it | Primary in all code |
| Field: `date` | Always require (NOT NULL) | Better than created_at fallback |
| Field: `sub_category` (fixed_assets) | Authoritative | Remove `category` if redundant |
| Page: reports | Explicit select (no *) | Only 6-7 fields used |
| Page: credits | Explicit select (no *) | Only 6-7 fields used |
| Page: profit | Explicit select (no *) | Only 6-7 fields used |
| Page: suppliers-balance | Explicit select (no *) | Only entity IDs + names + balance |
| Page: analysis | Already uses explicit | Keep minimal (id, name) |

---

## RECOMMENDATIONS FOR SAFE EXPLICIT SELECT()

### 1. **transactions** - Safe to specify:
```typescript
select('id, store_id, date, created_at, type, amount, category, method, notes, supplier_id, fixed_asset_id, revenue_source_id, is_credit')
```
*Skip: invoice_image, bank_name, rf_code, created_by_name, settlement_id, installment_number, user_id, description*

### 2. **suppliers** - For balance/credit pages:
```typescript
select('id, name, bank_name, rf_code')
```
*Skip: phone, vat_number, iban (not used in these 5 pages)*

### 3. **fixed_assets** - For balance/credit pages:
```typescript
select('id, name, sub_category, is_active')
```
*Skip: phone, vat_number, iban, rf_code, bank_name, (and all staff fields: start_date, pay_basis, salary)*

### 4. **revenue_sources** - For balance/credit pages:
```typescript
select('id, name')
```
*Skip: phone, vat_number, bank_name, iban, rf_code (not used)*

---

**Status**: Analysis only. No code changes or migrations applied.

'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentRed: '#dc2626',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
}

type ExpenseCategoryKey = 'suppliers' | 'worker' | 'utility' | 'staff' | 'other'

const CATEGORY_UI: Array<{
  key: ExpenseCategoryKey
  icon: string
  label: string
  dbCategory: 'Εμπορεύματα' | 'Maintenance' | 'Utilities' | 'Staff' | 'Other'
}> = [
  { key: 'suppliers', icon: '🛒', label: 'Εμπορεύματα', dbCategory: 'Εμπορεύματα' },

  // ✅ RENAME + ICON UPDATE (Μάστορες -> Συντήρηση, 🛠️ -> 🔧)
  // ✅ DB CONSISTENCY: κρατάμε key 'worker' ώστε να ταιριάζει με sub_category στο fixed_assets,
  // αλλά dbCategory παραμένει 'Maintenance'
  { key: 'worker', icon: '🔧', label: 'Συντήρηση', dbCategory: 'Maintenance' },

  { key: 'utility', icon: '💡', label: 'Λογαριασμοί', dbCategory: 'Utilities' },
  { key: 'staff', icon: '👤', label: 'Προσωπικό', dbCategory: 'Staff' },
  { key: 'other', icon: '📦', label: 'Λοιπά', dbCategory: 'Other' },
]

function AddExpenseForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const editId = searchParams.get('editId')
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]

  // ✅ MUST read storeId from URL searchParams
  const urlStoreId = searchParams.get('store')

  // ✅ NEW: deep-link params from Cards
  const urlSupId = searchParams.get('supId')
  const urlAssetId = searchParams.get('assetId')

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'Μετρητά' | 'Τράπεζα'>('Μετρητά')
  const [notes, setNotes] = useState('')
  const [isCredit, setIsCredit] = useState(false)
  const [isAgainstDebt, setIsAgainstDebt] = useState(searchParams.get('mode') === 'debt')
  const [noInvoice, setNoInvoice] = useState(false)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [currentUsername, setCurrentUsername] = useState('Χρήστης')
  const [loading, setLoading] = useState(true)

  const [storeId, setStoreId] = useState<string | null>(urlStoreId)

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])

  const [dayStats, setDayStats] = useState({ income: 0, expenses: 0 })

  // ✅ NEW: category selector state (default 'suppliers')
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategoryKey>('suppliers')

  // ✅ Simple select only (Vercel/mobile stable)
  const [selectedItemId, setSelectedItemId] = useState<string>('')

  const [isSupModalOpen, setIsSupModalOpen] = useState(false)
  const [newSupName, setNewSupName] = useState('')

  const dbCategoryFromKey = useCallback((key: ExpenseCategoryKey) => {
    return CATEGORY_UI.find(c => c.key === key)?.dbCategory || 'Other'
  }, [])

  const keyFromDbCategory = useCallback((cat: string | null | undefined): ExpenseCategoryKey => {
    if (cat === 'Εμπορεύματα') return 'suppliers'

    // ✅ DB CONSISTENCY:
    // Όταν η βάση επιστρέφει 'Maintenance', επιλέγουμε το UI key που αντιστοιχεί στη "Συντήρηση"
    // (κρατάμε key = 'worker' για συμβατότητα με existing fixed_assets sub_category)
    if (cat === 'Maintenance') return 'worker'

    if (cat === 'Utilities') return 'utility'
    if (cat === 'Staff') return 'staff'
    return 'other'
  }, [])

  // ✅ maps fixed_assets.sub_category -> UI key (for urlAssetId deep link)
  const keyFromFixedAssetSubCategory = useCallback((subCategory: any): ExpenseCategoryKey => {
    const sub = String(subCategory || '').trim().toLowerCase()
    if (sub === 'maintenance') return 'worker'
    if (sub === 'worker') return 'worker'
    if (sub === 'staff') return 'staff'
    if (sub === 'utility' || sub === 'utilities') return 'utility'
    return 'other'
  }, [])

  const loadFormData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      // ✅ URL store has priority (requirement)
      const activeStoreId =
        urlStoreId || (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null)

      if (!activeStoreId) {
        setLoading(false)
        return
      }

      setStoreId(activeStoreId)

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile) setCurrentUsername(profile.username || 'Admin')

      const [sRes, fRes, tRes] = await Promise.all([
        supabase
          .from('suppliers')
          .select('*')
          .eq('store_id', activeStoreId)
          .neq('is_active', false)
          .order('name'),
        // ✅ need sub_category for filtering
        supabase
          .from('fixed_assets')
          .select('id, name, sub_category')
          .eq('store_id', activeStoreId)
          .order('name'),
        supabase.from('transactions').select('amount, type').eq('store_id', activeStoreId).eq('date', selectedDate),
      ])

      const supData = sRes.data || []
      const faData = fRes.data || []

      if (sRes.data) setSuppliers(sRes.data)
      if (fRes.data) setFixedAssets(fRes.data)

      if (tRes.data) {
        const inc = tRes.data
          .filter((t: any) => t.type === 'income')
          .reduce((acc: number, t: any) => acc + Number(t.amount), 0)

        const exp = tRes.data
          .filter((t: any) => t.type === 'expense' || t.type === 'debt_payment')
          .reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0)

        setDayStats({ income: inc, expenses: exp })
      }

      // ✅ Edit mode load existing tx
      if (editId) {
        const { data: tx } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', editId)
          .eq('store_id', activeStoreId)
          .single()

        if (tx) {
          setAmount(Math.abs(tx.amount).toString())
          setMethod(tx.method === 'Τράπεζα' ? 'Τράπεζα' : 'Μετρητά')
          setNotes(tx.notes || '')
          setIsCredit(!!tx.is_credit)
          setIsAgainstDebt(tx.type === 'debt_payment')
          setNoInvoice((tx.notes || '').includes('ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ'))

          const inferredKey = keyFromDbCategory(tx.category)
          setExpenseCategory(inferredKey)

          // choose selected item by category
          const itemId = inferredKey === 'suppliers' ? tx.supplier_id || '' : tx.fixed_asset_id || ''
          setSelectedItemId(itemId)
        }
      } else {
        // ✅ NEW record: allow deep-link preselect AFTER data loads
        // 1) supId => suppliers
        if (urlSupId) {
          setExpenseCategory('suppliers')
          setSelectedItemId(urlSupId)
        }
        // 2) assetId => infer category from fixed_assets.sub_category
        else if (urlAssetId) {
          const found = faData.find((x: any) => x.id === urlAssetId)
          const inferredKey = keyFromFixedAssetSubCategory(found?.sub_category)
          setExpenseCategory(inferredKey)
          setSelectedItemId(urlAssetId)
        } else {
          // no deep-link: clear selection
          setSelectedItemId('')
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [
    editId,
    keyFromDbCategory,
    keyFromFixedAssetSubCategory,
    router,
    selectedDate,
    urlStoreId,
    urlSupId,
    urlAssetId,
  ])

  useEffect(() => {
    loadFormData()
  }, [loadFormData])

  const currentBalance = useMemo(() => dayStats.income - dayStats.expenses, [dayStats])

  // ✅ FIX: proper mapping for worker -> Maintenance
  const fixedAssetsFiltered = useMemo(() => {
    if (expenseCategory === 'suppliers') return []

    return fixedAssets.filter((f: any) => {
      const sub = f.sub_category || ''

      // Αν η επιλεγμένη κατηγορία στο UI είναι 'worker' (Συντήρηση)
      // τότε ψάχνουμε στη βάση για 'Maintenance'
      if (expenseCategory === 'worker') {
        return sub === 'Maintenance'
      }

      // Για τις υπόλοιπες κατηγορίες (staff, utility κλπ)
      return sub === expenseCategory
    })
  }, [expenseCategory, fixedAssets])

  const activeSelectOptions = useMemo(() => {
    if (expenseCategory === 'suppliers') return suppliers
    return fixedAssetsFiltered
  }, [expenseCategory, suppliers, fixedAssetsFiltered])

  const selectedLabel = useMemo(() => {
    if (!selectedItemId) return ''
    const found = activeSelectOptions.find((x: any) => x.id === selectedItemId)
    return found?.name || ''
  }, [activeSelectOptions, selectedItemId])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return toast.error('Συμπληρώστε το ποσό')
    if (!selectedItemId) return toast.error('Επιλέξτε από τη λίστα')

    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return router.push('/login')
      }

      // ✅ URL store has priority (requirement)
      const activeStoreId =
        urlStoreId ||
        (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null) ||
        storeId

      if (!activeStoreId) {
        setLoading(false)
        return toast.error('Δεν βρέθηκε κατάστημα (store)')
      }

      const dbCategory = dbCategoryFromKey(expenseCategory)

      const payload: any = {
        amount: -Math.abs(Number(amount)),
        method: isCredit ? 'Πίστωση' : method,
        is_credit: isCredit,
        type: isAgainstDebt ? 'debt_payment' : 'expense',
        date: selectedDate,
        user_id: session.user.id,
        store_id: activeStoreId,

        supplier_id: expenseCategory === 'suppliers' ? selectedItemId : null,
        fixed_asset_id: expenseCategory === 'suppliers' ? null : selectedItemId,

        // ✅ REQUIRED CATEGORY VALUES
        category: dbCategory,

        created_by_name: currentUsername,
        notes: noInvoice ? (notes ? `${notes} (ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ)` : 'ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ') : notes,
      }

      // Image upload logic (if present)
      if (imageFile && !noInvoice && !editId) {
        const fileExt = imageFile.name.split('.').pop() || 'jpg'
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `${activeStoreId}/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage.from('invoices').upload(filePath, imageFile)

        if (uploadError) throw uploadError
        payload.invoice_image = uploadData?.path || null
      }

      let error: any = null
      if (editId) {
        const res = await supabase.from('transactions').update(payload).eq('id', editId)
        error = res.error
      } else {
        const res = await supabase.from('transactions').insert([payload])
        error = res.error
      }

      if (error) throw error

      toast.success(editId ? 'Η κίνηση ενημερώθηκε!' : 'Η κίνηση καταχωρήθηκε!')

      router.push(`/?date=${selectedDate}&store=${activeStoreId}`)
      router.refresh()
    } catch (error: any) {
      toast.error(error?.message || 'Κάτι πήγε στραβά')
      setLoading(false)
    }
  }

  const onPickCategory = (key: ExpenseCategoryKey) => {
    setExpenseCategory(key)
    setSelectedItemId('') // reset selection when switching lists
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '120px' }}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>💸</div>
            <div>
              <h1 style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>{editId ? 'Διόρθωση' : 'Έξοδο'}</h1>
              <p style={{ margin: 0, fontSize: 16, color: colors.secondaryText, fontWeight: 700 }}>
                {new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' }).toUpperCase()}
              </p>
            </div>
          </div>

          <Link href={`/?store=${urlStoreId || storeId || ''}`} style={backBtnStyle}>
            ✕
          </Link>
        </div>

        <div style={formCard}>
          <label style={labelStyle}>ΠΟΣΟ (€)</label>
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={inputStyle}
            placeholder="0.00"
          />

          <div
            onClick={() => setNoInvoice(!noInvoice)}
            style={{
              ...noInvoiceToggle,
              backgroundColor: noInvoice ? '#fee2e2' : colors.bgLight,
              border: `1px solid ${noInvoice ? colors.accentRed : colors.border}`,
              marginTop: 15,
            }}
          >
            <div
              style={{
                ...checkboxBox,
                backgroundColor: noInvoice ? colors.accentRed : 'white',
                border: `2px solid ${noInvoice ? colors.accentRed : colors.secondaryText}`,
              }}
            >
              {noInvoice && '✓'}
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: noInvoice ? colors.accentRed : colors.primaryDark }}>
              ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ
            </span>
          </div>

          <label style={{ ...labelStyle, marginTop: 20 }}>ΜΕΘΟΔΟΣ ΠΛΗΡΩΜΗΣ</label>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => {
                setMethod('Μετρητά')
                setIsCredit(false)
              }}
              style={{
                ...methodBtn,
                backgroundColor: method === 'Μετρητά' && !isCredit ? colors.primaryDark : colors.white,
                color: method === 'Μετρητά' && !isCredit ? 'white' : colors.secondaryText,
              }}
            >
              💵 Μετρητά
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('Τράπεζα')
                setIsCredit(false)
              }}
              style={{
                ...methodBtn,
                backgroundColor: method === 'Τράπεζα' && !isCredit ? colors.primaryDark : colors.white,
                color: method === 'Τράπεζα' && !isCredit ? 'white' : colors.secondaryText,
              }}
            >
              🏛️ Τράπεζα
            </button>
          </div>

          <div style={creditPanel}>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={isCredit}
                onChange={e => {
                  setIsCredit(e.target.checked)
                  if (e.target.checked) setIsAgainstDebt(false)
                }}
                id="credit"
                style={checkboxStyle}
              />
              <label htmlFor="credit" style={checkLabel}>
                ΕΠΙ ΠΙΣΤΩΣΕΙ (ΝΕΟ ΧΡΕΟΣ)
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={isAgainstDebt}
                onChange={e => {
                  setIsAgainstDebt(e.target.checked)
                  if (e.target.checked) setIsCredit(false)
                }}
                id="against"
                style={checkboxStyle}
              />
              <label htmlFor="against" style={{ ...checkLabel, color: isAgainstDebt ? colors.accentBlue : colors.primaryDark }}>
                ΕΝΑΝΤΙ ΠΑΛΑΙΟΥ ΧΡΕΟΥ
              </label>
            </div>
          </div>

          <label style={{ ...labelStyle, marginTop: 20 }}>ΚΑΤΗΓΟΡΙΑ ΕΞΟΔΟΥ</label>
          <div style={categoryRow}>
            {CATEGORY_UI.map(c => {
              const active = expenseCategory === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onPickCategory(c.key)}
                  style={{
                    ...categoryBtn,
                    backgroundColor: active ? colors.primaryDark : colors.white,
                    border: `1px solid ${active ? colors.primaryDark : colors.border}`,
                    color: active ? 'white' : colors.primaryDark,
                  }}
                  aria-label={c.label}
                  title={c.label}
                >
                  <span style={{ fontSize: 16, lineHeight: '16px' }}>{c.icon}</span>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{c.label}</span>
                </button>
              )
            })}
          </div>

          <label style={{ ...labelStyle, marginTop: 20 }}>
            {expenseCategory === 'suppliers' ? 'ΠΡΟΜΗΘΕΥΤΗΣ' : 'ΠΑΓΙΟ / ΚΑΤΑΧΩΡΗΣΗ'}
          </label>

          <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} style={inputStyle}>
            <option value="">Επιλογή από λίστα...</option>

            {activeSelectOptions.map((x: any) => (
              <option key={x.id} value={x.id}>
                {(x.name || '').toUpperCase()}
              </option>
            ))}
          </select>

          {!!selectedLabel && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.bgLight,
                border: `1px solid ${colors.border}`,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Επιλογή: <span style={{ fontWeight: 900 }}>{String(selectedLabel).toUpperCase()}</span>
            </div>
          )}

          {expenseCategory === 'suppliers' && (
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={() => setIsSupModalOpen(true)} style={addSupplierBtn}>
                + Νέος Προμηθευτής
              </button>
            </div>
          )}

          <label style={{ ...labelStyle, marginTop: 20 }}>ΣΗΜΕΙΩΣΕΙΣ</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: 80 }} />

          {!editId && !noInvoice && (
            <div style={{ marginTop: 20 }}>
              <label style={labelStyle}>📸 ΦΩΤΟΓΡΑΦΙΑ ΤΙΜΟΛΟΓΙΟΥ</label>
              <div style={imageUploadContainer}>
                {imagePreview ? (
                  <div style={{ position: 'relative', width: '100%', height: 140 }}>
                    <img src={imagePreview} alt="Preview" style={imagePreviewStyle} />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null)
                        setImagePreview(null)
                      }}
                      style={removeImageBtn}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label style={uploadPlaceholder}>
                    <span style={{ fontSize: 16 }}>📷 Επιλογή φωτογραφίας</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 25 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={{
                ...smartSaveBtn,
                backgroundColor: editId ? colors.accentBlue : colors.accentRed,
                opacity: loading ? 0.75 : 1,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 900 }}>
                  {loading ? 'SYNCING...' : editId ? 'ΕΝΗΜΕΡΩΣΗ ΔΕΔΟΜΕΝΩΝ' : 'ΟΛΟΚΛΗΡΩΣΗ ΕΞΟΔΟΥ'}
                </span>
                <span style={{ fontSize: 16, opacity: 0.85, fontWeight: 800, marginTop: 6 }}>
                  ΚΑΘΑΡΟ ΤΑΜΕΙΟ: {currentBalance.toFixed(2)}€
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {isSupModalOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <h2 style={{ fontSize: 16, margin: '0 0 15px', fontWeight: 900 }}>Νέος Προμηθευτής</h2>

            <input
              value={newSupName}
              onChange={e => setNewSupName(e.target.value)}
              style={{ ...inputStyle, marginBottom: 15 }}
              placeholder="Όνομα"
            />

            <button
              type="button"
              onClick={async () => {
                if (!newSupName.trim()) return

                const activeStoreId =
                  urlStoreId ||
                  (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null) ||
                  storeId

                if (!activeStoreId) return toast.error('Δεν βρέθηκε κατάστημα (store)')

                const { data, error } = await supabase
                  .from('suppliers')
                  .insert([{ name: newSupName.trim(), store_id: activeStoreId }])
                  .select()
                  .single()

                if (error) return toast.error(error.message)

                if (data) {
                  setSuppliers(prev => [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))))
                  setExpenseCategory('suppliers')
                  setSelectedItemId(data.id)
                  setIsSupModalOpen(false)
                  setNewSupName('')
                  toast.success('Προστέθηκε!')
                }
              }}
              style={saveBtn}
            >
              ΠΡΟΣΘΗΚΗ
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSupModalOpen(false)
                setNewSupName('')
              }}
              style={cancelBtn}
            >
              ΑΚΥΡΩΣΗ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// STYLES (✅ All texts/inputs 16px)
const iphoneWrapper: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100dvh',
  padding: 20,
  overflowY: 'auto',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  fontSize: 16,
}

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }
const logoBoxStyle: any = {
  width: 42,
  height: 42,
  backgroundColor: colors.primaryDark,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: 16,
  fontWeight: 900,
}
const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondaryText,
  padding: '10px 12px',
  backgroundColor: 'white',
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 900,
}

const formCard: any = { backgroundColor: 'white', padding: 20, borderRadius: 24, border: `1px solid ${colors.border}` }
const labelStyle: any = { fontSize: 16, fontWeight: 900, color: colors.secondaryText, display: 'block', marginBottom: 8 }

const inputStyle: any = {
  width: '100%',
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 700,
  backgroundColor: colors.bgLight,
  boxSizing: 'border-box',
}

const methodBtn: any = {
  flex: 1,
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  cursor: 'pointer',
  fontWeight: 900,
  fontSize: 16,
}

const noInvoiceToggle: any = { display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, cursor: 'pointer' }
const checkboxBox: any = {
  width: 20,
  height: 20,
  borderRadius: 6,
  border: '2px solid #cbd5e1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: 16,
  fontWeight: 900,
}

const creditPanel: any = { backgroundColor: colors.bgLight, padding: 16, borderRadius: 14, border: `1px solid ${colors.border}`, marginTop: 20 }
const checkboxStyle: any = { width: 20, height: 20 }
const checkLabel: any = { fontSize: 16, fontWeight: 900, color: colors.primaryDark }

const categoryRow: any = { display: 'flex', gap: 10, flexWrap: 'wrap' }
const categoryBtn: any = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 12px',
  borderRadius: 14,
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 900,
  userSelect: 'none',
}

const addSupplierBtn: any = {
  width: '100%',
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  fontSize: 16,
  fontWeight: 900,
  cursor: 'pointer',
}

const smartSaveBtn: any = {
  width: '100%',
  padding: 16,
  color: 'white',
  border: 'none',
  borderRadius: 16,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  fontSize: 16,
}

const imageUploadContainer: any = { width: '100%', backgroundColor: colors.bgLight, borderRadius: 14, border: `2px dashed ${colors.border}`, overflow: 'hidden' }
const uploadPlaceholder: any = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'pointer' }
const imagePreviewStyle: any = { width: '100%', height: 140, objectFit: 'cover' as const }
const removeImageBtn: any = {
  position: 'absolute',
  top: 8,
  right: 8,
  backgroundColor: 'rgba(0,0,0,0.5)',
  color: 'white',
  border: 'none',
  borderRadius: 999,
  width: 30,
  height: 30,
  fontSize: 16,
  fontWeight: 900,
}

const modalOverlay: any = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 20,
}
const modalCard: any = { backgroundColor: 'white', padding: 20, borderRadius: 20, width: '100%', maxWidth: 420, border: `1px solid ${colors.border}` }
const saveBtn: any = { width: '100%', padding: 16, backgroundColor: colors.accentRed, color: 'white', border: 'none', borderRadius: 14, fontWeight: 900, marginTop: 10, fontSize: 16, cursor: 'pointer' }
const cancelBtn: any = { width: '100%', padding: 16, backgroundColor: colors.white, color: colors.primaryDark, border: `1px solid ${colors.border}`, borderRadius: 14, fontWeight: 900, marginTop: 10, fontSize: 16, cursor: 'pointer' }

export default function AddExpensePage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
      <AddExpenseForm />
    </Suspense>
  )
}
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo, useRef } from 'react'
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
  { key: 'worker', icon: '🔧', label: 'Συντήρηση', dbCategory: 'Maintenance' },
  { key: 'utility', icon: '💡', label: 'Λογαριασμοί', dbCategory: 'Utilities' },
  { key: 'staff', icon: '👤', label: 'Προσωπικό', dbCategory: 'Staff' },
  { key: 'other', icon: '📦', label: 'Λοιπά', dbCategory: 'Other' },
]

type SmartItem =
  | { kind: 'supplier'; id: string; name: string }
  | { kind: 'asset'; id: string; name: string; sub_category: string; uiKey: ExpenseCategoryKey }

// -----------------------------
// ✅ SEARCH HELPERS (Greeklish + Fuzzy)
// -----------------------------
function stripDiacritics(input: string) {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeForSearch(input: any) {
  return stripDiacritics(String(input || '').toLowerCase().trim())
}

// Greek -> Greeklish (basic but solid for names)
function greekToGreeklish(input: string) {
  let out = normalizeForSearch(input)

  // Digraphs first
  const digraphs: Array<[RegExp, string]> = [
    [/ου/g, 'ou'],
    [/αι/g, 'ai'],
    [/ει/g, 'ei'],
    [/οι/g, 'oi'],
    [/υι/g, 'yi'],
    [/αυ/g, 'av'],
    [/ευ/g, 'ev'],
    [/μπ/g, 'b'],
    [/ντ/g, 'd'],
    [/γκ/g, 'g'],
    [/γγ/g, 'ng'],
    [/τσ/g, 'ts'],
    [/τζ/g, 'tz'],
  ]
  for (const [re, rep] of digraphs) out = out.replace(re, rep)

  // Single letters
  const map: Record<string, string> = {
    α: 'a',
    β: 'v',
    γ: 'g',
    δ: 'd',
    ε: 'e',
    ζ: 'z',
    η: 'h', // -> deh for ΔΕΗ
    θ: 'th',
    ι: 'i',
    κ: 'k',
    λ: 'l',
    μ: 'm',
    ν: 'n',
    ξ: 'x',
    ο: 'o',
    π: 'p',
    ρ: 'r',
    σ: 's',
    ς: 's',
    τ: 't',
    υ: 'y',
    φ: 'f',
    χ: 'x',
    ψ: 'ps',
    ω: 'o',
  }

  let final = ''
  for (const ch of out) final += map[ch] ?? ch
  return final
}

/**
 * Fuzzy normalize:
 * - Treats (h,i,y) as same-ish for Greek vowels (η/ι/υ) in Greeklish context
 * - Also collapses common combos: ei/oi/yi -> i, ou -> u (optional), etc.
 * This makes "dei" match "deh" and also match Greek "ΔΕΗ".
 */
function fuzzyLatin(s: string) {
  let out = normalizeForSearch(s)

  // Collapse common multi-letter vowel sounds to simpler forms
  out = out
    .replace(/ei/g, 'i')
    .replace(/oi/g, 'i')
    .replace(/yi/g, 'i')
    .replace(/ou/g, 'u')
    .replace(/ai/g, 'e') // optional simplification
    .replace(/th/g, 't') // optional: θ -> t for very fuzzy search

  // Collapse h / i / y in latin to i (so h≈i≈y)
  out = out.replace(/[hy]/g, 'i')

  // Remove non letters/numbers (keeps searching forgiving)
  out = out.replace(/[^a-z0-9]/g, '')

  return out
}

function matchesSmartQuery(name: string, query: string) {
  const qRaw = normalizeForSearch(query)
  if (!qRaw) return true

  const nRaw = normalizeForSearch(name)
  if (nRaw.includes(qRaw)) return true

  const nGreeklish = greekToGreeklish(name)
  if (nGreeklish.includes(qRaw)) return true

  // ✅ FUZZY PASS: makes "dei" match "deh"
  const qF = fuzzyLatin(query)
  const nF1 = fuzzyLatin(name) // if name itself is latin
  if (nF1.includes(qF)) return true

  const nF2 = fuzzyLatin(nGreeklish) // if name is greek -> greeklish -> fuzzy
  if (nF2.includes(qF)) return true

  return false
}

function groupTitleForKey(key: ExpenseCategoryKey) {
  if (key === 'suppliers') return 'ΠΡΟΜΗΘΕΥΤΕΣ'
  if (key === 'staff') return 'ΠΡΟΣΩΠΙΚΟ'
  if (key === 'worker') return 'ΣΥΝΤΗΡΗΣΗ'
  if (key === 'utility') return 'ΛΟΓΑΡΙΑΣΜΟΙ'
  return 'ΛΟΙΠΑ'
}

function AddExpenseForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const editId = searchParams.get('editId')
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const urlStoreId = searchParams.get('store')
  const urlSupId = searchParams.get('supId')
  const urlAssetId = searchParams.get('assetId')

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'Μετρητά' | 'Τράπεζα'>('Μετρητά')

  // ✅ NOTES uppercase too (if you don't want, tell me)
  const [notes, setNotes] = useState('')

  const [isCredit, setIsCredit] = useState(false)
  const [isAgainstDebt, setIsAgainstDebt] = useState(searchParams.get('mode') === 'debt')
  const [noInvoice, setNoInvoice] = useState(false)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [currentUsername, setCurrentUsername] = useState('ΧΡΗΣΤΗΣ')
  const [loading, setLoading] = useState(true)

  const [storeId, setStoreId] = useState<string | null>(urlStoreId)

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])

  const [dayStats, setDayStats] = useState({ income: 0, expenses: 0 })

  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategoryKey>('suppliers')
  const [selectedItemId, setSelectedItemId] = useState<string>('')

  const [isSupModalOpen, setIsSupModalOpen] = useState(false)
  const [newSupName, setNewSupName] = useState('')

  // ✅ SMART SEARCH
  const [smartQuery, setSmartQuery] = useState('')
  const [smartOpen, setSmartOpen] = useState(false)

  // ✅ RECENTS
  const [recentIds, setRecentIds] = useState<string[]>([])
  const smartBoxRef = useRef<HTMLDivElement | null>(null)

  const dbCategoryFromKey = useCallback((key: ExpenseCategoryKey) => {
    return CATEGORY_UI.find(c => c.key === key)?.dbCategory || 'Other'
  }, [])

  const keyFromDbCategory = useCallback((cat: string | null | undefined): ExpenseCategoryKey => {
    if (cat === 'Εμπορεύματα') return 'suppliers'
    if (cat === 'Maintenance') return 'worker'
    if (cat === 'Utilities') return 'utility'
    if (cat === 'Staff') return 'staff'
    return 'other'
  }, [])

  const keyFromFixedAssetSubCategory = useCallback((subCategory: any): ExpenseCategoryKey => {
    const sub = String(subCategory || '').trim().toLowerCase()
    if (sub === 'maintenance') return 'worker'
    if (sub === 'worker') return 'worker'
    if (sub === 'staff') return 'staff'
    if (sub === 'utility' || sub === 'utilities') return 'utility'
    if (sub === 'other') return 'other'
    return 'other'
  }, [])

  // ✅ click outside to close results
  useEffect(() => {
    const onDown = (e: any) => {
      if (!smartBoxRef.current) return
      if (!smartBoxRef.current.contains(e.target)) setSmartOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // ✅ load recents from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const key = `expense_recents_${urlStoreId || 'default'}`
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setRecentIds(parsed.slice(0, 8))
      } catch {}
    }
  }, [urlStoreId])

  const saveRecent = (id: string) => {
    if (typeof window === 'undefined') return
    const key = `expense_recents_${urlStoreId || 'default'}`
    setRecentIds(prev => {
      const next = [id, ...prev.filter(x => x !== id)].slice(0, 8)
      localStorage.setItem(key, JSON.stringify(next))
      return next
    })
  }

  const loadFormData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

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

      if (profile) setCurrentUsername(String(profile.username || 'ADMIN').toUpperCase())

      const [sRes, fRes, tRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('store_id', activeStoreId).order('name'),
        supabase
          .from('fixed_assets')
          .select('id, name, sub_category')
          .eq('store_id', activeStoreId)
          .in('sub_category', ['staff', 'Maintenance', 'utility', 'other'])
          .order('name'),
        supabase.from('transactions').select('amount, type').eq('store_id', activeStoreId).eq('date', selectedDate),
      ])

      const supData = sRes.data || []
      const faData = fRes.data || []

      setSuppliers(supData)
      setFixedAssets(faData)

      if (tRes.data) {
        const inc = tRes.data
          .filter((t: any) => t.type === 'income')
          .reduce((acc: number, t: any) => acc + Number(t.amount), 0)

        const exp = tRes.data
          .filter((t: any) => t.type === 'expense' || t.type === 'debt_payment')
          .reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0)

        setDayStats({ income: inc, expenses: exp })
      }

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
          setNotes(String(tx.notes || '').toUpperCase())
          setIsCredit(!!tx.is_credit)
          setIsAgainstDebt(tx.type === 'debt_payment')
          setNoInvoice((tx.notes || '').includes('ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ'))

          const inferredKey = keyFromDbCategory(tx.category)
          setExpenseCategory(inferredKey)

          const itemId = inferredKey === 'suppliers' ? tx.supplier_id || '' : tx.fixed_asset_id || ''
          setSelectedItemId(itemId)

          if (itemId) {
            const found =
              inferredKey === 'suppliers' ? supData.find((x: any) => x.id === itemId) : faData.find((x: any) => x.id === itemId)
            setSmartQuery(String(found?.name || '').toUpperCase())
          }
        }
      } else {
        if (urlSupId) {
          setExpenseCategory('suppliers')
          setSelectedItemId(urlSupId)
          const found = supData.find((x: any) => x.id === urlSupId)
          setSmartQuery(String(found?.name || '').toUpperCase())
        } else if (urlAssetId) {
          const found = faData.find((x: any) => x.id === urlAssetId)
          const inferredKey = keyFromFixedAssetSubCategory(found?.sub_category)
          setExpenseCategory(inferredKey)
          setSelectedItemId(urlAssetId)
          setSmartQuery(String(found?.name || '').toUpperCase())
        } else {
          setSelectedItemId('')
          setSmartQuery('')
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [editId, keyFromDbCategory, keyFromFixedAssetSubCategory, router, selectedDate, urlStoreId, urlSupId, urlAssetId])

  useEffect(() => {
    loadFormData()
  }, [loadFormData])

  const currentBalance = useMemo(() => dayStats.income - dayStats.expenses, [dayStats])

  const smartItems = useMemo(() => {
    const s: SmartItem[] = suppliers.map((x: any) => ({ kind: 'supplier', id: x.id, name: x.name || '' }))

    const a: SmartItem[] = fixedAssets.map((x: any) => ({
      kind: 'asset',
      id: x.id,
      name: x.name || '',
      sub_category: x.sub_category || '',
      uiKey: keyFromFixedAssetSubCategory(x.sub_category),
    }))

    return [...s, ...a]
  }, [suppliers, fixedAssets, keyFromFixedAssetSubCategory])

  const recentItems = useMemo(() => {
    if (!recentIds.length) return []
    const map = new Map(smartItems.map(i => [`${i.kind}:${i.id}`, i]))
    return recentIds.map(k => map.get(k)).filter(Boolean) as SmartItem[]
  }, [recentIds, smartItems])

  const groupedResults = useMemo(() => {
    const list = smartQuery.trim()
      ? smartItems.filter(i => matchesSmartQuery(i.name, smartQuery)).slice(0, 40)
      : recentItems.length
      ? recentItems
      : smartItems.slice(0, 15)

    const groups: Record<string, SmartItem[]> = {}
    for (const item of list) {
      const groupKey = item.kind === 'supplier' ? 'suppliers' : item.uiKey
      const title = groupTitleForKey(groupKey as ExpenseCategoryKey)
      if (!groups[title]) groups[title] = []
      groups[title].push(item)
    }
    return groups
  }, [smartQuery, smartItems, recentItems])

  const pickSmartItem = (item: SmartItem) => {
    setSmartQuery(String(item.name || '').toUpperCase())
    setSmartOpen(false)

    if (item.kind === 'supplier') {
      setExpenseCategory('suppliers')
      setSelectedItemId(item.id)
      saveRecent(`supplier:${item.id}`)
      return
    }

    setExpenseCategory(item.uiKey)
    setSelectedItemId(item.id)
    saveRecent(`asset:${item.id}`)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return toast.error('ΣΥΜΠΛΗΡΩΣΤΕ ΤΟ ΠΟΣΟ')
    if (!selectedItemId) return toast.error('ΕΠΙΛΕΞΤΕ ΔΙΚΑΙΟΥΧΟ ΑΠΟ ΤΗΝ ΑΝΑΖΗΤΗΣΗ')

    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return router.push('/login')
      }

      const activeStoreId =
        urlStoreId ||
        (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null) ||
        storeId

      if (!activeStoreId) {
        setLoading(false)
        return toast.error('ΔΕΝ ΒΡΕΘΗΚΕ ΚΑΤΑΣΤΗΜΑ (STORE)')
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

        category: dbCategory,
        created_by_name: currentUsername,
        notes: noInvoice
          ? notes
            ? `${notes} (ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ)`
            : 'ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ'
          : notes,
      }

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

      toast.success(editId ? 'Η ΚΙΝΗΣΗ ΕΝΗΜΕΡΩΘΗΚΕ!' : 'Η ΚΙΝΗΣΗ ΚΑΤΑΧΩΡΗΘΗΚΕ!')
      router.push(`/?date=${selectedDate}&store=${activeStoreId}`)
      router.refresh()
    } catch (error: any) {
      toast.error(error?.message || 'ΚΑΤΙ ΠΗΓΕ ΣΤΡΑΒΑ')
      setLoading(false)
    }
  }

  const onPickCategory = (key: ExpenseCategoryKey) => {
    setExpenseCategory(key)
    setSelectedItemId('')
    setSmartQuery('')
    setSmartOpen(true)
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '120px' }}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>💸</div>
            <div>
              <h1 style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>{editId ? 'ΔΙΟΡΘΩΣΗ' : 'ΕΞΟΔΟ'}</h1>
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
          {/* SMART SEARCH */}
          <label style={labelStyle}>ΔΙΚΑΙΟΥΧΟΣ (SMART SEARCH)</label>

          <div ref={smartBoxRef} style={{ position: 'relative' }}>
            <input
              value={smartQuery}
              onChange={e => {
                setSmartQuery(String(e.target.value || '').toUpperCase())
                setSelectedItemId('')
                setSmartOpen(true)
              }}
              onFocus={() => setSmartOpen(true)}
              placeholder="🔎 ΓΡΑΨΕ ΟΝΟΜΑ... (DEI/DEH, ΔΕΗ, TZILIOS...)"
              style={inputStyle}
            />

            {!!smartQuery && (
              <button
                type="button"
                onClick={() => {
                  setSmartQuery('')
                  setSelectedItemId('')
                  setSmartOpen(true)
                }}
                style={clearBtn}
              >
                ✕
              </button>
            )}

            {smartOpen && (
              <div style={resultsPanel}>
                {Object.keys(groupedResults).length === 0 ? (
                  <div style={{ padding: 14, fontSize: 16, fontWeight: 800, color: colors.secondaryText }}>
                    ΔΕΝ ΒΡΕΘΗΚΕ ΑΠΟΤΕΛΕΣΜΑ
                  </div>
                ) : (
                  Object.entries(groupedResults).map(([group, items]) => (
                    <div key={group}>
                      <div style={groupHeader}>{group}</div>
                      {items.map(item => (
                        <button
                          key={`${item.kind}-${item.id}`}
                          type="button"
                          onClick={() => pickSmartItem(item)}
                          style={resultRow}
                        >
                          <div style={{ fontSize: 16, fontWeight: 900, color: colors.primaryDark }}>
                            {String(item.name || '').toUpperCase()}
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: colors.secondaryText }}>
                            {item.kind === 'supplier' ? 'ΠΡΟΜΗΘΕΥΤΗΣ' : 'ΠΑΓΙΟ'}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {!!selectedItemId && !!smartQuery && (
            <div style={selectedBox}>
              ΕΠΙΛΟΓΗ: <span style={{ fontWeight: 900 }}>{String(smartQuery).toUpperCase()}</span>
            </div>
          )}

          {expenseCategory === 'suppliers' && (
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={() => setIsSupModalOpen(true)} style={addSupplierBtn}>
                + ΝΕΟΣ ΠΡΟΜΗΘΕΥΤΗΣ
              </button>
            </div>
          )}

          {/* Category Buttons (optional override) */}
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
                >
                  <span style={{ fontSize: 16 }}>{c.icon}</span>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{String(c.label || '').toUpperCase()}</span>
                </button>
              )
            })}
          </div>

          <label style={{ ...labelStyle, marginTop: 20 }}>ΠΟΣΟ (€)</label>
          <input
            type="number"
            inputMode="decimal"
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
              💵 ΜΕΤΡΗΤΑ
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
              🏛️ ΤΡΑΠΕΖΑ
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

          <label style={{ ...labelStyle, marginTop: 20 }}>ΣΗΜΕΙΩΣΕΙΣ</label>
          <textarea
            value={notes}
            onChange={e => setNotes(String(e.target.value || '').toUpperCase())}
            style={{ ...inputStyle, height: 80 }}
          />

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
                    <span style={{ fontSize: 16 }}>📷 ΕΠΙΛΟΓΗ ΦΩΤΟΓΡΑΦΙΑΣ</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} style={{ display: 'none' }} />
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
            <h2 style={{ fontSize: 16, margin: '0 0 15px', fontWeight: 900 }}>ΝΕΟΣ ΠΡΟΜΗΘΕΥΤΗΣ</h2>

            <input
              value={newSupName}
              onChange={e => setNewSupName(String(e.target.value || '').toUpperCase())}
              style={{ ...inputStyle, marginBottom: 15 }}
              placeholder="ΟΝΟΜΑ"
            />

            <button
              type="button"
              onClick={async () => {
                if (!newSupName.trim()) return

                const activeStoreId =
                  urlStoreId ||
                  (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null) ||
                  storeId

                if (!activeStoreId) return toast.error('ΔΕΝ ΒΡΕΘΗΚΕ ΚΑΤΑΣΤΗΜΑ (STORE)')

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
                  setSmartQuery(String(data.name || '').toUpperCase())
                  setSmartOpen(false)
                  saveRecent(`supplier:${data.id}`)

                  setIsSupModalOpen(false)
                  setNewSupName('')
                  toast.success('ΠΡΟΣΤΕΘΗΚΕ!')
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

// -----------------------------
// STYLES
// -----------------------------
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
  fontWeight: 800,
  backgroundColor: colors.bgLight,
  boxSizing: 'border-box',
  textTransform: 'uppercase', // ✅ ALWAYS CAPS in UI
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

// search ui
const clearBtn: any = {
  position: 'absolute',
  top: 10,
  right: 10,
  width: 34,
  height: 34,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  fontSize: 16,
  fontWeight: 900,
  cursor: 'pointer',
  color: colors.secondaryText,
}
const resultsPanel: any = {
  marginTop: 8,
  border: `1px solid ${colors.border}`,
  borderRadius: 14,
  background: colors.white,
  maxHeight: 320,
  overflowY: 'auto',
}
const groupHeader: any = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  background: colors.bgLight,
  padding: '10px 12px',
  fontSize: 16,
  fontWeight: 900,
  color: colors.secondaryText,
  borderBottom: `1px solid ${colors.border}`,
}
const resultRow: any = {
  width: '100%',
  border: 'none',
  background: colors.white,
  padding: 12,
  textAlign: 'left',
  cursor: 'pointer',
  borderBottom: `1px solid ${colors.border}`,
}
const selectedBox: any = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  backgroundColor: colors.bgLight,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 800,
}

export default function AddExpensePage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>ΦΟΡΤΩΣΗ...</div>}>
      <AddExpenseForm />
    </Suspense>
  )
}
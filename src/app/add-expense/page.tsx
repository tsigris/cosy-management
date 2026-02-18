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

type SmartKind = 'supplier' | 'asset'
type AssetGroup = 'staff' | 'maintenance' | 'utility' | 'other'

type SmartItem = {
  kind: SmartKind
  id: string
  name: string
  sub_category?: string | null
  group?: AssetGroup
}

type SelectedEntity = { kind: SmartKind; id: string } | null

function stripDiacritics(str: string) {
  // αφαιρεί τόνους
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeGreek(str: any) {
  return stripDiacritics(String(str || ''))
    .toLowerCase()
    .trim()
    .replace(/ς/g, 'σ')
}

// ελληνικά -> greeklish (απλό αλλά πολύ χρήσιμο)
function greekToGreeklish(input: string) {
  let s = normalizeGreek(input)

  // πρώτα δίψηφα
  const digraphs: Array<[RegExp, string]> = [
    [/ου/g, 'ou'],
    [/αι/g, 'ai'],
    [/ει/g, 'ei'],
    [/οι/g, 'oi'],
    [/υι/g, 'yi'],
    [/αυ/g, 'av'],
    [/ευ/g, 'ev'],
    [/γγ/g, 'ng'],
    [/γκ/g, 'gk'],
    [/ντ/g, 'nt'],
    [/μπ/g, 'mp'],
    [/τσ/g, 'ts'],
    [/τζ/g, 'tz'],
  ]
  digraphs.forEach(([r, v]) => (s = s.replace(r, v)))

  const map: Record<string, string> = {
    α: 'a',
    β: 'v',
    γ: 'g',
    δ: 'd',
    ε: 'e',
    ζ: 'z',
    η: 'h',
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
    τ: 't',
    υ: 'y',
    φ: 'f',
    χ: 'x',
    ψ: 'ps',
    ω: 'o',
  }

  let out = ''
  for (const ch of s) out += map[ch] ?? ch
  return out
}

// fuzzy: ανοχή σε h/i και i/y (η/ι/υ)
function fuzzyIHI(str: string) {
  return normalizeGreek(str)
    .replace(/h/g, 'i')
    .replace(/y/g, 'i')
    .replace(/u/g, 'i')
    .replace(/ei/g, 'i')
    .replace(/oi/g, 'i')
    .replace(/yi/g, 'i')
}

// match: πιάνει Ελληνικά + Greeklish + fuzzy
function smartMatch(name: string, query: string) {
  const q = normalizeGreek(query)
  if (!q) return true

  const n = normalizeGreek(name)
  if (n.includes(q)) return true

  const nLatin = greekToGreeklish(name)
  if (nLatin.includes(q)) return true

  // αν ο χρήστης γράφει greeklish (dei/deh) να πιάνει και τα 2
  const qF = fuzzyIHI(q)
  const nF = fuzzyIHI(nLatin)
  if (nF.includes(qF)) return true

  return false
}

function groupTitle(group: AssetGroup | 'suppliers') {
  if (group === 'suppliers') return 'Προμηθευτές'
  if (group === 'staff') return 'Προσωπικό'
  if (group === 'maintenance') return 'Συντήρηση'
  if (group === 'utility') return 'Λογαριασμοί'
  return 'Λοιπά'
}

function groupFromSubCategory(sub: any): AssetGroup {
  const s = String(sub || '').trim().toLowerCase()
  if (s === 'staff') return 'staff'
  if (s === 'utility' || s === 'utilities') return 'utility'
  if (s === 'maintenance' || s === 'worker') return 'maintenance'
  return 'other'
}

function categoryFromSelection(sel: SelectedEntity, itemMap: Map<string, SmartItem>) {
  if (!sel) return 'Other'
  if (sel.kind === 'supplier') return 'Εμπορεύματα'

  const key = `asset:${sel.id}`
  const item = itemMap.get(key)
  const g = item?.group || 'other'

  if (g === 'staff') return 'Staff'
  if (g === 'utility') return 'Utilities'
  if (g === 'maintenance') return 'Maintenance'
  return 'Other'
}

function AddExpenseForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const editId = searchParams.get('editId')
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const urlStoreId = searchParams.get('store')

  // deep links
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

  // ✅ Selection replaces category dropdown
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null)

  // ✅ Smart search
  const [smartQuery, setSmartQuery] = useState('')
  const [smartOpen, setSmartOpen] = useState(false)
  const [recentKeys, setRecentKeys] = useState<string[]>([])
  const smartBoxRef = useRef<HTMLDivElement | null>(null)

  // close on outside tap (mobile-safe)
  useEffect(() => {
    const handler = (e: any) => {
      const el = smartBoxRef.current
      if (!el) return
      if (!el.contains(e.target)) setSmartOpen(false)
    }
    document.addEventListener('pointerdown', handler, true)
    return () => document.removeEventListener('pointerdown', handler, true)
  }, [])

  // recents
  useEffect(() => {
    if (typeof window === 'undefined') return
    const key = `expense_recents_${urlStoreId || 'default'}`
    const raw = localStorage.getItem(key)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) setRecentKeys(parsed.slice(0, 10))
    } catch {}
  }, [urlStoreId])

  const saveRecent = (k: string) => {
    if (typeof window === 'undefined') return
    const key = `expense_recents_${urlStoreId || 'default'}`
    setRecentKeys(prev => {
      const next = [k, ...prev.filter(x => x !== k)].slice(0, 10)
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

      if (profile) setCurrentUsername(profile.username || 'Admin')

      const [sRes, fRes, tRes] = await Promise.all([
        supabase.from('suppliers').select('id, name').eq('store_id', activeStoreId).order('name'),
        supabase
          .from('fixed_assets')
          .select('id, name, sub_category')
          .eq('store_id', activeStoreId)
          .order('name'),
        supabase.from('transactions').select('amount, type').eq('store_id', activeStoreId).eq('date', selectedDate),
      ])

      const supData = sRes.data || []
      const faAll = fRes.data || []

      // ✅ κρατάμε ΜΟΝΟ τα sub_category που έχεις στο manage-lists:
      // staff | Maintenance | utility | other (και πιάνουμε και maintenance σε lowercase)
      const faData = faAll.filter((x: any) => {
        const g = groupFromSubCategory(x.sub_category)
        return g === 'staff' || g === 'maintenance' || g === 'utility' || g === 'other'
      })

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

      // ----- EDIT MODE -----
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

          // choose selected entity
          if (tx.supplier_id) {
            const id = String(tx.supplier_id)
            setSelectedEntity({ kind: 'supplier', id })
            const found = supData.find((x: any) => String(x.id) === id)
            setSmartQuery(found?.name || '')
          } else if (tx.fixed_asset_id) {
            const id = String(tx.fixed_asset_id)
            setSelectedEntity({ kind: 'asset', id })
            const found = faData.find((x: any) => String(x.id) === id)
            setSmartQuery(found?.name || '')
          } else {
            setSelectedEntity(null)
            setSmartQuery('')
          }
        }
      } else {
        // ----- NEW MODE (DEEP LINKS) -----
        if (urlSupId) {
          const id = String(urlSupId)
          setSelectedEntity({ kind: 'supplier', id })
          const found = supData.find((x: any) => String(x.id) === id)
          setSmartQuery(found?.name || '')
        } else if (urlAssetId) {
          const id = String(urlAssetId)
          setSelectedEntity({ kind: 'asset', id })
          const found = faData.find((x: any) => String(x.id) === id)
          setSmartQuery(found?.name || '')
        } else {
          setSelectedEntity(null)
          setSmartQuery('')
        }
      }
    } catch (error) {
      console.error(error)
      toast.error('Σφάλμα φόρτωσης')
    } finally {
      setLoading(false)
    }
  }, [editId, router, selectedDate, urlStoreId, urlSupId, urlAssetId])

  useEffect(() => {
    loadFormData()
  }, [loadFormData])

  const currentBalance = useMemo(() => dayStats.income - dayStats.expenses, [dayStats])

  // Build smart items + map
  const smartItems = useMemo<SmartItem[]>(() => {
    const sList: SmartItem[] =
      suppliers?.map((s: any) => ({
        kind: 'supplier',
        id: String(s.id),
        name: String(s.name || ''),
      })) || []

    const aList: SmartItem[] =
      fixedAssets?.map((a: any) => ({
        kind: 'asset',
        id: String(a.id),
        name: String(a.name || ''),
        sub_category: a.sub_category,
        group: groupFromSubCategory(a.sub_category),
      })) || []

    return [...sList, ...aList]
  }, [suppliers, fixedAssets])

  const smartItemMap = useMemo(() => {
    const m = new Map<string, SmartItem>()
    for (const it of smartItems) {
      const k = `${it.kind}:${it.id}`
      m.set(k, it)
    }
    return m
  }, [smartItems])

  const recentItems = useMemo(() => {
    if (!recentKeys.length) return []
    return recentKeys.map(k => smartItemMap.get(k)).filter(Boolean) as SmartItem[]
  }, [recentKeys, smartItemMap])

  const filtered = useMemo(() => {
    const q = smartQuery.trim()
    if (!q) {
      // αν δεν γράφει, δείξε πρόσφατα, αλλιώς λίγα πρώτα
      return recentItems.length ? recentItems : smartItems.slice(0, 25)
    }
    return smartItems.filter(i => smartMatch(i.name, q)).slice(0, 60)
  }, [smartQuery, smartItems, recentItems])

  const groupedResults = useMemo(() => {
    const groups: Record<string, SmartItem[]> = {}

    for (const it of filtered) {
      const key =
        it.kind === 'supplier'
          ? 'suppliers'
          : (it.group || 'other')

      const title = groupTitle(key as any)
      if (!groups[title]) groups[title] = []
      groups[title].push(it)
    }

    // μικρό sort μέσα σε κάθε group
    for (const g of Object.keys(groups)) {
      groups[g] = groups[g].sort((a, b) => String(a.name).localeCompare(String(b.name)))
    }

    return groups
  }, [filtered])

  const pickSmartItem = (item: SmartItem) => {
    setSelectedEntity({ kind: item.kind, id: item.id })
    setSmartQuery(item.name)
    setSmartOpen(false)
    saveRecent(`${item.kind}:${item.id}`)
  }

  const clearSelection = () => {
    setSelectedEntity(null)
    setSmartQuery('')
    setSmartOpen(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return toast.error('Συμπλήρωσε το ποσό')
    if (!selectedEntity) return toast.error('Επίλεξε δικαιούχο από την αναζήτηση')

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
        return toast.error('Δεν βρέθηκε κατάστημα (store)')
      }

      const category = categoryFromSelection(selectedEntity, smartItemMap)

      const payload: any = {
        amount: -Math.abs(Number(amount)),
        method: isCredit ? 'Πίστωση' : method,
        is_credit: isCredit,
        type: isAgainstDebt ? 'debt_payment' : 'expense',
        date: selectedDate,
        user_id: session.user.id,
        store_id: activeStoreId,

        supplier_id: selectedEntity.kind === 'supplier' ? selectedEntity.id : null,
        fixed_asset_id: selectedEntity.kind === 'asset' ? selectedEntity.id : null,

        category,
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

  const selectedLabel = useMemo(() => {
    if (!selectedEntity) return ''
    const it = smartItemMap.get(`${selectedEntity.kind}:${selectedEntity.id}`)
    return it?.name || smartQuery || ''
  }, [selectedEntity, smartItemMap, smartQuery])

  const selectedMeta = useMemo(() => {
    if (!selectedEntity) return ''
    const it = smartItemMap.get(`${selectedEntity.kind}:${selectedEntity.id}`)
    if (!it) return ''
    if (it.kind === 'supplier') return 'Προμηθευτής'
    const g = it.group || 'other'
    if (g === 'maintenance') return 'Συντήρηση'
    if (g === 'staff') return 'Προσωπικό'
    if (g === 'utility') return 'Λογαριασμός'
    return 'Λοιπά'
  }, [selectedEntity, smartItemMap])

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
                {new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          <Link href={`/?store=${urlStoreId || storeId || ''}`} style={backBtnStyle}>
            ✕
          </Link>
        </div>

        <div style={formCard}>
          {/* SMART SEARCH */}
          <label style={labelStyle}>Δικαιούχος</label>

          <div ref={smartBoxRef} style={{ position: 'relative' }}>
            <input
              value={smartQuery}
              onChange={e => {
                setSmartQuery(e.target.value)
                setSelectedEntity(null)
                setSmartOpen(true)
              }}
              onFocus={() => setSmartOpen(true)}
              placeholder="Αναζήτηση... (π.χ. ΔΕΗ / deh / Τζηλιος / tzhlios)"
              style={inputStyle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />

            {!!smartQuery && (
              <button type="button" onClick={clearSelection} style={clearBtn} aria-label="Καθαρισμός">
                ✕
              </button>
            )}

            {smartOpen && (
              <div style={resultsPanel}>
                {Object.keys(groupedResults).length === 0 ? (
                  <div style={{ padding: 14, fontSize: 14, fontWeight: 700, color: colors.secondaryText }}>
                    Δεν βρέθηκε αποτέλεσμα
                  </div>
                ) : (
                  Object.entries(groupedResults).map(([group, items]) => (
                    <div key={group}>
                      <div style={groupHeader}>{group}</div>

                      {items.map(item => (
                        <button
                          key={`${item.kind}-${item.id}`}
                          type="button"
                          onPointerDown={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            pickSmartItem(item)
                          }}
                          onTouchStart={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            pickSmartItem(item)
                          }}
                          style={resultRow}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 15, fontWeight: 900, color: colors.primaryDark, textTransform: 'none' }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: colors.secondaryText, textTransform: 'none' }}>
                              {item.kind === 'supplier'
                                ? 'Προμηθευτής'
                                : (item.group === 'maintenance'
                                    ? 'Συντήρηση'
                                    : item.group === 'staff'
                                      ? 'Προσωπικό'
                                      : item.group === 'utility'
                                        ? 'Λογαριασμός'
                                        : 'Λοιπά')}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {!!selectedEntity && (
            <div style={selectedBox}>
              Επιλογή: <span style={{ fontWeight: 900 }}>{selectedLabel}</span>
              {!!selectedMeta && (
                <span style={{ marginLeft: 8, color: colors.secondaryText, fontWeight: 800 }}>({selectedMeta})</span>
              )}
            </div>
          )}

          <label style={{ ...labelStyle, marginTop: 20 }}>Ποσό (€)</label>
          <input
            type="number"
            inputMode="decimal"
            autoFocus={!smartOpen}
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
            <span style={{ fontSize: 14, fontWeight: 900, color: noInvoice ? colors.accentRed : colors.primaryDark }}>
              Χωρίς τιμολόγιο
            </span>
          </div>

          <label style={{ ...labelStyle, marginTop: 20 }}>Μέθοδος πληρωμής</label>
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
                Επί πιστώσει (νέο χρέος)
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
                Έναντι παλαιού χρέους
              </label>
            </div>
          </div>

          <label style={{ ...labelStyle, marginTop: 20 }}>Σημειώσεις</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: 80 }} />

          {!editId && !noInvoice && (
            <div style={{ marginTop: 20 }}>
              <label style={labelStyle}>📸 Φωτογραφία τιμολογίου</label>
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
                    <span style={{ fontSize: 14, fontWeight: 900 }}>📷 Επιλογή φωτογραφίας</span>
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
                <span style={{ fontSize: 14, fontWeight: 900 }}>
                  {loading ? 'Αποθήκευση...' : editId ? 'Ενημέρωση' : 'Καταχώρηση'}
                </span>
                <span style={{ fontSize: 14, opacity: 0.85, fontWeight: 800, marginTop: 6 }}>
                  Καθαρό ταμείο: {currentBalance.toFixed(2)}€
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// STYLES
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
  touchAction: 'pan-y',
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
  fontSize: 18,
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
const labelStyle: any = { fontSize: 12, fontWeight: 900, color: colors.secondaryText, display: 'block', marginBottom: 8 }

const inputStyle: any = {
  width: '100%',
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  fontSize: 16, // ✅ anti-zoom mobile
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
  fontSize: 14,
  fontWeight: 900,
}

const creditPanel: any = { backgroundColor: colors.bgLight, padding: 16, borderRadius: 14, border: `1px solid ${colors.border}`, marginTop: 20 }
const checkboxStyle: any = { width: 20, height: 20 }
const checkLabel: any = { fontSize: 14, fontWeight: 900, color: colors.primaryDark }

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
  position: 'absolute',
  left: 0,
  right: 0,
  top: 'calc(100% + 8px)',
  zIndex: 999,
  border: `1px solid ${colors.border}`,
  borderRadius: 14,
  background: colors.white,
  maxHeight: 360,
  overflowY: 'auto',
  boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
}

const groupHeader: any = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  background: colors.bgLight,
  padding: '10px 12px',
  fontSize: 12,
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
  fontSize: 14,
  fontWeight: 700,
}

export default function AddExpensePage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
      <AddExpenseForm />
    </Suspense>
  )
}
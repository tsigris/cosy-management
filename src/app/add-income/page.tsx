'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { ArrowUpCircle } from 'lucide-react'

const colors = {
  primaryDark: 'var(--text)',
  secondaryText: 'var(--muted)',
  accentGreen: '#10b981',
  accentBlue: '#6366f1',
  bgLight: 'var(--bg-grad)',
  border: 'var(--border)',
  white: 'var(--surface)',
  modalBackdrop: 'rgba(2,6,23,0.6)',
}

const AUTO_DEBT_NOTES = 'ΕΞΟΦΛΗΣΗ ΥΠΟΛΟΙΠΟΥ ΚΑΡΤΕΛΑΣ'

// ---------- Helpers ----------
function stripDiacritics(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
function normalizeGreek(str: any) {
  return stripDiacritics(String(str || ''))
    .toLowerCase()
    .trim()
    .replace(/ς/g, 'σ')
}
function greekToGreeklish(input: string) {
  let s = normalizeGreek(input)

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
function fuzzyIHI(str: string) {
  return normalizeGreek(str)
    .replace(/h/g, 'i')
    .replace(/y/g, 'i')
    .replace(/u/g, 'i')
    .replace(/ei/g, 'i')
    .replace(/oi/g, 'i')
    .replace(/yi/g, 'i')
}
function smartMatch(name: string, query: string) {
  const q = normalizeGreek(query)
  if (!q) return false

  const n = normalizeGreek(name)
  if (n.includes(q)) return true

  const nLatin = greekToGreeklish(name)
  if (nLatin.includes(q)) return true

  const qF = fuzzyIHI(q)
  const nF = fuzzyIHI(nLatin)
  if (nF.includes(qF)) return true

  return false
}

// ---------- Types ----------
type RevenueSource = {
  id: string
  name: string
}

type PaymentMethod = 'Μετρητά' | 'Τράπεζα' | 'Πίστωση'

function parseAmount(input: string) {
  const s = String(input || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.')
  return Number(s)
}

function AddIncomeForm() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()

  const editId = searchParams.get('editId')
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const urlStoreId = searchParams.get('store')
  const urlSourceId = searchParams.get('sourceId')
  const mode = searchParams.get('mode')

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('Μετρητά')
  const [notes, setNotes] = useState('')
  const [isCredit, setIsCredit] = useState(false) // Αναμονή είσπραξης
  const [isAgainstDebt, setIsAgainstDebt] = useState(mode === 'debt')

  const [currentUsername, setCurrentUsername] = useState('Χρήστης')

  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(urlStoreId)

  const [sources, setSources] = useState<any[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string>('')

  const [smartQuery, setSmartQuery] = useState('')
  const [smartOpen, setSmartOpen] = useState(false)
  const smartBoxRef = useRef<HTMLDivElement | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [cName, setCName] = useState('')

  // close dropdown on outside
  useEffect(() => {
    const handler = (e: any) => {
      const el = smartBoxRef.current
      if (!el) return
      if (!el.contains(e.target)) setSmartOpen(false)
    }
    document.addEventListener('pointerdown', handler, true)
    return () => document.removeEventListener('pointerdown', handler, true)
  }, [])

  const getActiveStoreId = useCallback(() => {
    const ls = typeof window !== 'undefined' ? (localStorage.getItem('active_store_id') || '').trim() : ''
    const url = (urlStoreId || '').trim()
    if (ls) return ls
    if (url) {
      try {
        localStorage.setItem('active_store_id', url)
      } catch {}
      return url
    }
    return storeId || null
  }, [urlStoreId, storeId])

  const loadFormData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const activeStoreId = getActiveStoreId()
      if (!activeStoreId) {
        toast.error('Δεν βρέθηκε κατάστημα (store)')
        setLoading(false)
        return
      }
      setStoreId(activeStoreId)

      const [sourcesRes, profileRes] = await Promise.all([
        supabase.from('revenue_sources').select('id, name').eq('store_id', activeStoreId).order('name'),
        supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle(),
      ])

      const sourceRows = sourcesRes.data || []
      setSources(sourceRows)

      if (profileRes.data) setCurrentUsername(profileRes.data.username || 'Admin')

      if (editId) {
        const { data: tx, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', editId)
          .eq('store_id', activeStoreId)
          .single()

        if (error) throw error

        if (tx) {
          setAmount(Math.abs(tx.amount).toString())
          setMethod(tx.method === 'Τράπεζα' ? 'Τράπεζα' : 'Μετρητά')
          setNotes(tx.notes || '')
          setIsCredit(!!tx.is_credit)

          // ✅ Canonical: for income-side debt collection we use debt_received
          setIsAgainstDebt(tx.type === 'debt_received')

          const txSourceId = tx.revenue_source_id ? String(tx.revenue_source_id) : ''
          setSelectedSourceId(txSourceId)
          const found = sourceRows.find((s: any) => String(s.id) === txSourceId)
          setSmartQuery(found?.name || '')
        }
      } else {
        if (urlSourceId) {
          const deepLinkId = String(urlSourceId)
          setSelectedSourceId(deepLinkId)
          const found = sourceRows.find((s: any) => String(s.id) === deepLinkId)
          setSmartQuery(found?.name || '')
        }

        if (mode === 'debt') {
          setNotes((prev) => (prev && prev.trim().length > 0 ? prev : AUTO_DEBT_NOTES))
          setIsAgainstDebt(true)
          setIsCredit(false) // hard rule
        }
      }
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || 'Σφάλμα φόρτωσης')
    } finally {
      setLoading(false)
    }
  }, [editId, router, urlSourceId, mode, getActiveStoreId])

  useEffect(() => {
    loadFormData()
  }, [loadFormData])

  const sourceItems = useMemo<RevenueSource[]>(() => {
    return (sources || [])
      .map((s: any) => ({
        id: String(s.id),
        name: String(s.name || ''),
      }))
      .filter((s) => !!s.id && !!s.name)
  }, [sources])

  const sourceMap = useMemo(() => {
    const map = new Map<string, RevenueSource>()
    for (const s of sourceItems) map.set(s.id, s)
    return map
  }, [sourceItems])

  const filtered = useMemo(() => {
    const q = smartQuery.trim()
    if (!q) return []
    return sourceItems.filter((s) => smartMatch(s.name, q)).slice(0, 80)
  }, [smartQuery, sourceItems])

  const hasExactMatch = useMemo(() => {
    const q = smartQuery.trim()
    if (!q) return false
    const nq = normalizeGreek(q)
    return sourceItems.some((s) => normalizeGreek(s.name) === nq)
  }, [smartQuery, sourceItems])

  const showCreateInline = useMemo(() => {
    const q = smartQuery.trim()
    if (!smartOpen) return false
    if (!q) return false
    if (hasExactMatch) return false
    return filtered.length === 0
  }, [smartOpen, smartQuery, hasExactMatch, filtered.length])

  const pickSource = (item: RevenueSource) => {
    setSelectedSourceId(item.id)
    setSmartQuery(item.name)
    setSmartOpen(false)
  }

  const clearSelection = () => {
    setSelectedSourceId('')
    setSmartQuery('')
    setSmartOpen(true)
  }

  const openCreateModal = () => {
    setCName(smartQuery.trim())
    setCreateOpen(true)
    setSmartOpen(false)
  }

  const doCreateSource = async () => {
    const activeStoreId = getActiveStoreId()
    if (!activeStoreId) return toast.error('Δεν βρέθηκε κατάστημα (store)')

    const nm = cName.trim()
    if (!nm) return toast.error('Γράψε όνομα πηγής')

    const existing = sourceItems.find((s) => normalizeGreek(s.name) === normalizeGreek(nm))
    if (existing) {
      pickSource(existing)
      setCreateOpen(false)
      toast.success('Η πηγή υπάρχει ήδη και επιλέχθηκε')
      return
    }

    try {
      setCreateSaving(true)
      const { data, error } = await supabase
        .from('revenue_sources')
        .insert([{ name: nm, store_id: activeStoreId }])
        .select('id, name')
        .single()

      if (error) throw error

      setSources((prev) =>
        [...prev, data].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
      )
      setSelectedSourceId(String(data.id))
      setSmartQuery(String(data.name || nm))
      setCreateOpen(false)
      toast.success('Η νέα πηγή προστέθηκε')
    } catch (error: any) {
      toast.error(error?.message || 'Αποτυχία δημιουργίας πηγής')
    } finally {
      setCreateSaving(false)
    }
  }

  const handleSave = async () => {
    const amt = parseAmount(amount)
    if (!amount || !Number.isFinite(amt) || amt <= 0) return toast.error('Συμπληρώστε σωστό ποσό')
    if (!selectedSourceId) return toast.error('Επιλέξτε πηγή εσόδου')

    // ✅ HARD RULES:
    // - debt_received δεν μπορεί να είναι "Πίστωση"
    // - debt_received δεν επιτρέπεται is_credit
    if (isAgainstDebt && isCredit) {
      return toast.error('Η εξόφληση χρέους δεν μπορεί να είναι "Αναμονή είσπραξης". Βάλε Μετρητά ή Τράπεζα.')
    }

    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error('Δεν βρέθηκε session χρήστη')

      const { data: prof } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .maybeSingle()

      const createdByName = (prof?.username || session.user.email?.split('@')[0] || 'Χρήστης').trim()

      const activeStoreId = getActiveStoreId()
      if (!activeStoreId) {
        toast.error('Δεν βρέθηκε κατάστημα (store)')
        setLoading(false)
        return
      }

      // ✅ Canonical transaction type:
      // income side debt collection = debt_received
      const txType = isAgainstDebt ? 'debt_received' : 'income'
      const finalIsCredit = txType === 'debt_received' ? false : isCredit
      const finalMethod: PaymentMethod = txType === 'debt_received' ? method : isCredit ? 'Πίστωση' : method

      // ✅ Auto notes safety for debt collection
      const baseNotes = (notes || '').trim()
      const finalNotes =
        txType === 'debt_received' && !/εξοφλησ/i.test(baseNotes)
          ? baseNotes
            ? `${baseNotes} | ${AUTO_DEBT_NOTES}`
            : AUTO_DEBT_NOTES
          : baseNotes

      const payload: any = {
        amount: Math.abs(amt), // income always +
        method: finalMethod,
        is_credit: finalIsCredit,
        type: txType,
        category: 'income',
        date: selectedDate,
        user_id: session.user.id,
        store_id: activeStoreId,
        revenue_source_id: selectedSourceId,
        created_by_name: createdByName,
        notes: finalNotes,
      }

      const { error } = editId
        ? await supabase.from('transactions').update(payload).eq('id', editId).eq('store_id', activeStoreId)
        : await supabase.from('transactions').insert([payload])

      if (error) throw error

      toast.success(editId ? 'Το έσοδο ενημερώθηκε!' : 'Το έσοδο καταχωρήθηκε!')
      router.push(`/?date=${selectedDate}&store=${getActiveStoreId() || ''}`)
      router.refresh()
    } catch (error: any) {
      toast.error(error?.message || 'Κάτι πήγε στραβά')
      setLoading(false)
    }
  }

  const selectedLabel = useMemo(() => {
    return sourceMap.get(selectedSourceId)?.name || ''
  }, [sourceMap, selectedSourceId])

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '120px' }}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>
              <ArrowUpCircle color="white" size={24} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>
                  {editId ? 'ΔΙΟΡΘΩΣΗ ΕΣΟΔΟΥ' : 'ΝΕΟ ΕΣΟΔΟ'}
                </h1>

                {isAgainstDebt && <span style={headerBadge}>ΕΞΟΦΛΗΣΗ</span>}
              </div>

              <p style={{ margin: 0, fontSize: 16, color: colors.secondaryText, fontWeight: 700 }}>
                {new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' }).toUpperCase()}
              </p>
            </div>
          </div>

          <Link href={`/?store=${getActiveStoreId() || ''}`} style={backBtnStyle}>
            ✕
          </Link>
        </div>

        <div style={formCard}>
          <label style={labelStyle}>ΠΗΓΗ ΕΣΟΔΟΥ (AIRBNB, ΠΕΛΑΤΗΣ κλπ)</label>

          <div ref={smartBoxRef} style={{ position: 'relative' }}>
            <input
              value={smartQuery}
              onChange={(e) => {
                setSmartQuery(e.target.value)
                setSelectedSourceId('')
                setSmartOpen(true)
              }}
              onFocus={() => setSmartOpen(true)}
              placeholder="Αναζήτηση πηγής"
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

            {smartOpen && smartQuery.trim() && (
              <div style={resultsPanel}>
                {showCreateInline && (
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      openCreateModal()
                    }}
                    style={createRow}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: colors.primaryDark }}>
                          Δεν βρέθηκε: <span style={{ color: colors.accentBlue }}>{smartQuery.trim()}</span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors.secondaryText }}>Πάτα για καταχώρηση</div>
                      </div>
                      <div style={plusPill}>＋</div>
                    </div>
                  </button>
                )}

                {filtered.length === 0 ? (
                  !showCreateInline ? (
                    <div style={{ padding: 14, fontSize: 14, fontWeight: 700, color: colors.secondaryText }}>
                      Δεν βρέθηκε αποτέλεσμα
                    </div>
                  ) : null
                ) : (
                  filtered.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        pickSource(item)
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        pickSource(item)
                      }}
                      style={resultRow}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: colors.primaryDark }}>{item.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors.secondaryText }}>Πηγή εσόδου</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {!!selectedLabel && (
            <div style={selectedBox}>
              Πηγή: <span style={{ fontWeight: 900 }}>{selectedLabel.toUpperCase()}</span>
            </div>
          )}

          <label style={{ ...labelStyle, marginTop: 20 }}>ΠΟΣΟ (€)</label>
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={amountInput}
            placeholder="0.00"
          />

          <label style={{ ...labelStyle, marginTop: 20 }}>ΜΕΘΟΔΟΣ ΕΙΣΠΡΑΞΗΣ</label>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => {
                setMethod('Μετρητά')
                setIsCredit(false)
              }}
              style={{
                ...methodBtn,
                backgroundColor: method === 'Μετρητά' && !isCredit ? colors.primaryDark : 'white',
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
                backgroundColor: method === 'Τράπεζα' && !isCredit ? colors.primaryDark : 'white',
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
                onChange={(e) => {
                  // ✅ If debt collection, forbid credit
                  if (isAgainstDebt && e.target.checked) {
                    toast.error('Η εξόφληση χρέους δεν μπορεί να είναι "Αναμονή είσπραξης".')
                    return
                  }
                  setIsCredit(e.target.checked)
                  if (e.target.checked) setIsAgainstDebt(false)
                }}
                id="credit"
                style={checkboxStyle}
              />
              <label htmlFor="credit" style={checkLabel}>
                ΑΝΑΜΟΝΗ ΕΙΣΠΡΑΞΗΣ (ΠΙΣΤΩΣΗ)
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={isAgainstDebt}
                onChange={(e) => {
                  setIsAgainstDebt(e.target.checked)
                  if (e.target.checked) setIsCredit(false)
                }}
                id="against"
                style={checkboxStyle}
              />
              <label
                htmlFor="against"
                style={{ ...checkLabel, color: isAgainstDebt ? colors.accentBlue : colors.primaryDark }}
              >
                ΕΞΟΦΛΗΣΗ ΠΑΛΑΙΟΥ ΧΡΕΟΥ
              </label>
            </div>
          </div>

          <label style={{ ...labelStyle, marginTop: 20 }}>ΣΗΜΕΙΩΣΕΙΣ</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ ...inputStyle, height: 80 }}
            placeholder="Λεπτομέρειες εσόδου..."
          />

          <div style={{ marginTop: 25 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={{
                ...smartSaveBtn,
                backgroundColor: colors.accentGreen,
                opacity: loading ? 0.75 : 1,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 900 }}>
                {loading ? 'SYNCING...' : editId ? 'ΕΝΗΜΕΡΩΣΗ ΕΣΟΔΟΥ' : 'ΟΛΟΚΛΗΡΩΣΗ ΕΙΣΠΡΑΞΗΣ'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {createOpen && (
        <div style={modalOverlay} onMouseDown={() => !createSaving && setCreateOpen(false)}>
          <div style={modalCard} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: colors.primaryDark }}>Νέα πηγή εσόδου</h2>
              <button
                type="button"
                onClick={() => !createSaving && setCreateOpen(false)}
                style={modalCloseBtn}
                aria-label="Κλείσιμο"
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '8px 0 14px', fontSize: 13, fontWeight: 700, color: colors.secondaryText }}>
              Δεν βρέθηκε <strong>{smartQuery.trim()}</strong>. Καταχώρησέ το άμεσα στη λίστα.
            </p>

            <label style={modalLabel}>Όνομα πηγής</label>
            <input
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              style={modalInput}
              placeholder="π.χ. Airbnb"
              disabled={createSaving}
              autoFocus
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                style={modalSecondaryBtn}
                disabled={createSaving}
              >
                Ακύρωση
              </button>
              <button type="button" onClick={doCreateSource} style={modalPrimaryBtn} disabled={createSaving}>
                {createSaving ? 'Αποθήκευση...' : 'Προσθήκη'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Styles ----------
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
const headerStyle: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
}
const logoBoxStyle: any = {
  width: 42,
  height: 42,
  backgroundColor: colors.accentGreen,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondaryText,
  padding: '10px 12px',
  backgroundColor: colors.white,
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 900,
}
const headerBadge: any = {
  backgroundColor: colors.accentGreen,
  color: 'white',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.3,
  border: '1px solid rgba(255,255,255,0.25)',
}
const formCard: any = {
  backgroundColor: colors.white,
  padding: 20,
  borderRadius: 24,
  border: `1px solid ${colors.border}`,
  boxShadow: 'var(--shadow)',
}
const labelStyle: any = {
  fontSize: 16,
  fontWeight: 900,
  color: colors.secondaryText,
  display: 'block',
  marginBottom: 8,
}
const inputStyle: any = {
  width: '100%',
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 700,
  backgroundColor: colors.white,
  color: colors.primaryDark,
  boxSizing: 'border-box',
}
const amountInput: any = { ...inputStyle, fontSize: '24px', color: colors.accentGreen }
const methodBtn: any = {
  flex: 1,
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  cursor: 'pointer',
  fontWeight: 900,
  fontSize: 16,
  backgroundColor: colors.white,
  color: colors.primaryDark,
}
const creditPanel: any = {
  backgroundColor: colors.white,
  padding: 16,
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  marginTop: 20,
}
const checkboxStyle: any = { width: 20, height: 20 }
const checkLabel: any = { fontSize: 16, fontWeight: 900, color: colors.primaryDark }
const smartSaveBtn: any = {
  width: '100%',
  padding: 18,
  color: 'var(--surface)',
  border: 'none',
  borderRadius: 16,
  cursor: 'pointer',
  boxShadow: 'var(--shadow)',
}

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
  boxShadow: 'var(--shadow)',
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

const createRow: any = {
  width: '100%',
  border: 'none',
  background: colors.white,
  padding: 12,
  textAlign: 'left',
  cursor: 'pointer',
  borderBottom: `1px solid ${colors.border}`,
}

const plusPill: any = {
  width: 34,
  height: 34,
  borderRadius: 999,
  backgroundColor: colors.accentBlue,
  color: 'var(--surface)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
  fontSize: 18,
  flexShrink: 0,
}

const selectedBox: any = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  fontSize: 14,
  fontWeight: 700,
  color: colors.primaryDark,
}

const modalOverlay: any = {
  position: 'fixed',
  inset: 0,
  backgroundColor: colors.modalBackdrop,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 2000,
}

const modalCard: any = {
  width: '100%',
  maxWidth: 520,
  background: colors.white,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  padding: 16,
  boxShadow: 'var(--shadow)',
}

const modalCloseBtn: any = {
  width: 36,
  height: 36,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  background: colors.white,
  cursor: 'pointer',
  fontWeight: 900,
  fontSize: 16,
  color: colors.secondaryText,
}

const modalLabel: any = {
  display: 'block',
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 900,
  color: colors.secondaryText,
}

const modalInput: any = {
  width: '100%',
  padding: 12,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  fontSize: 14,
  fontWeight: 700,
  boxSizing: 'border-box',
  backgroundColor: colors.white,
  color: colors.primaryDark,
}

const modalSecondaryBtn: any = {
  flex: 1,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  padding: 12,
  fontWeight: 900,
  cursor: 'pointer',
}

const modalPrimaryBtn: any = {
  flex: 1,
  borderRadius: 12,
  border: 'none',
  backgroundColor: colors.accentGreen,
  color: 'var(--surface)',
  padding: 12,
  fontWeight: 900,
  cursor: 'pointer',
}

export default function AddIncomePage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
      <AddIncomeForm />
    </Suspense>
  )
}
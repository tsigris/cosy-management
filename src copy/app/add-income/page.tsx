'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { ArrowUpCircle } from 'lucide-react'

const colors = {
  primaryDark: '#0f172a',
  secondaryText: '#64748b',
  accentGreen: '#10b981',
  accentBlue: '#6366f1',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
}

const AUTO_DEBT_NOTES = 'ΕΞΟΦΛΗΣΗ ΥΠΟΛΟΙΠΟΥ ΚΑΡΤΕΛΑΣ'

function AddIncomeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const editId = searchParams.get('editId')
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const urlStoreId = searchParams.get('store')
  const urlSourceId = searchParams.get('sourceId') // Deep link από καρτέλες εσόδων
  const mode = searchParams.get('mode')

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'Μετρητά' | 'Τράπεζα'>('Μετρητά')
  const [notes, setNotes] = useState('')
  const [isCredit, setIsCredit] = useState(false) // Αναμονή είσπραξης
  const [isAgainstDebt, setIsAgainstDebt] = useState(mode === 'debt')

  const [currentUsername, setCurrentUsername] = useState('Χρήστης')
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(urlStoreId)
  const [sources, setSources] = useState<any[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string>('')

  const loadFormData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const activeStoreId =
        urlStoreId ||
        (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null)

      if (!activeStoreId) return setLoading(false)
      setStoreId(activeStoreId)

      const [sourcesRes, profileRes] = await Promise.all([
        supabase.from('revenue_sources').select('*').eq('store_id', activeStoreId).order('name'),
        supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle(),
      ])

      // ✅ Select Fix: αν υπάρχει is_active, κράτα ΜΟΝΟ τις ενεργές πηγές
      if (sourcesRes.data) {
        const hasIsActive = sourcesRes.data.some((s: any) => typeof s?.is_active !== 'undefined')
        const filtered = hasIsActive
          ? sourcesRes.data.filter((s: any) => s?.is_active === true)
          : sourcesRes.data

        setSources(filtered)
      }

      if (profileRes.data) setCurrentUsername(profileRes.data.username || 'Admin')

      if (editId) {
        const { data: tx } = await supabase.from('transactions').select('*').eq('id', editId).single()
        if (tx) {
          setAmount(Math.abs(tx.amount).toString())
          setMethod(tx.method === 'Τράπεζα' ? 'Τράπεζα' : 'Μετρητά')
          setNotes(tx.notes || '')
          setIsCredit(!!tx.is_credit)
          setIsAgainstDebt(tx.type === 'debt_payment')
          setSelectedSourceId(tx.revenue_source_id || '')
        }
      } else {
        if (urlSourceId) setSelectedSourceId(urlSourceId)

        // ✅ Auto-Notes: αν mode === 'debt', βάλε αυτόματα σημειώσεις (ΜΟΝΟ σε νέο)
        if (mode === 'debt') {
          setNotes(prev => (prev && prev.trim().length > 0 ? prev : AUTO_DEBT_NOTES))
          setIsAgainstDebt(true)
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [editId, router, urlStoreId, urlSourceId, mode])

  useEffect(() => {
    loadFormData()
  }, [loadFormData])

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return toast.error('Συμπληρώστε το ποσό')
    if (!selectedSourceId) return toast.error('Επιλέξτε πηγή εσόδου')

    // ✅ Validation: δεν γίνεται εξόφληση χρέους με "Πίστωση"
    if (isAgainstDebt && (isCredit || method === ('Πίστωση' as any))) {
      return toast.error('Δεν μπορείς να εξοφλείς χρέος με Πίστωση. Επίλεξε Μετρητά ή Τράπεζα.')
    }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error('Δεν βρέθηκε session χρήστη')

      const payload: any = {
        amount: Math.abs(Number(amount)),
        method: isCredit ? 'Πίστωση' : method,
        is_credit: isCredit,
        type: isAgainstDebt ? 'debt_payment' : 'income', // Αν είναι εξόφληση χρέους πλατφόρμας
        category: 'income',
        date: selectedDate,
        user_id: session.user.id,
        store_id: storeId,
        revenue_source_id: selectedSourceId,
        created_by_name: currentUsername,
        notes: notes,
      }

      const { error } = editId
        ? await supabase.from('transactions').update(payload).eq('id', editId)
        : await supabase.from('transactions').insert([payload])

      if (error) throw error

      toast.success('Το έσοδο καταχωρήθηκε!')
      router.push(`/?date=${selectedDate}&store=${storeId}`)
    } catch (error: any) {
      toast.error(error.message)
      setLoading(false)
    }
  }

  const selectedLabel = useMemo(() => {
    return sources.find(s => s.id === selectedSourceId)?.name || ''
  }, [sources, selectedSourceId])

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

                {/* ✅ Header Badge */}
                {isAgainstDebt && (
                  <span style={headerBadge}>
                    ΕΞΟΦΛΗΣΗ
                  </span>
                )}
              </div>

              <p style={{ margin: 0, fontSize: 16, color: colors.secondaryText, fontWeight: 700 }}>
                {new Date(selectedDate)
                  .toLocaleDateString('el-GR', { day: 'numeric', month: 'long' })
                  .toUpperCase()}
              </p>
            </div>
          </div>

          <Link href={`/?store=${storeId}`} style={backBtnStyle}>
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
                onChange={e => {
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
                onChange={e => {
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

          <label style={{ ...labelStyle, marginTop: 20 }}>ΠΗΓΗ ΕΣΟΔΟΥ (AIRBNB, ΠΕΛΑΤΗΣ κλπ)</label>
          <select
            value={selectedSourceId}
            onChange={e => setSelectedSourceId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Επιλογή από λίστα...</option>
            {sources.map(s => (
              <option key={s.id} value={s.id}>
                {(s.name || '').toUpperCase()}
              </option>
            ))}
          </select>

          {!!selectedLabel && (
            <div style={selectionBadge}>
              Πηγή: <span style={{ fontWeight: 900 }}>{selectedLabel.toUpperCase()}</span>
            </div>
          )}

          <label style={{ ...labelStyle, marginTop: 20 }}>ΣΗΜΕΙΩΣΕΙΣ</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
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
    </div>
  )
}

// STYLES
const iphoneWrapper: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100dvh',
  padding: 20,
  overflowY: 'auto',
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
  backgroundColor: 'white',
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 900,
}
const headerBadge: any = {
  backgroundColor: '#16a34a', // πράσινο
  color: 'white',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.3,
  border: '1px solid rgba(255,255,255,0.25)',
}
const formCard: any = {
  backgroundColor: 'white',
  padding: 20,
  borderRadius: 24,
  border: `1px solid ${colors.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
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
  backgroundColor: colors.bgLight,
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
}
const creditPanel: any = {
  backgroundColor: colors.bgLight,
  padding: 16,
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  marginTop: 20,
}
const checkboxStyle: any = { width: 20, height: 20 }
const checkLabel: any = { fontSize: 16, fontWeight: 900, color: colors.primaryDark }
const selectionBadge: any = {
  marginTop: 10,
  padding: 12,
  borderRadius: 12,
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  fontSize: 16,
  fontWeight: 700,
  color: colors.accentGreen,
}
const smartSaveBtn: any = {
  width: '100%',
  padding: 18,
  color: 'white',
  border: 'none',
  borderRadius: 16,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
}

export default function AddIncomePage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
      <AddIncomeForm />
    </Suspense>
  )
}
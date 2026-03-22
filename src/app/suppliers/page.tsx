'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { parseDateInputSafe } from '@/lib/businessDate'
import Link from 'next/link'
import {
  Plus,
  TrendingUp,
  Phone,
  CreditCard,
  Hash,
  Tag,
  Trash2,
  Edit2,
  ChevronLeft,
  Building2,
} from 'lucide-react'
import { toast, Toaster } from 'sonner'

const colors = {
  primaryDark: '#0f172a',
  secondaryText: '#64748b',
  accentGreen: '#10b981',
  accentRed: '#f43f5e',
  accentBlue: '#6366f1',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  warning: '#fffbeb',
  warningText: '#92400e',
}

function SuppliersContent() {
  const supabase = getSupabase()
  const searchParams = useSearchParams()
  const router = useRouter()

  const storeIdFromUrl = searchParams.get('store')

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentStoreName, setCurrentStoreName] = useState('Φορτώνει...')

  // ✅ HERO YEAR (default: current year)
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)

  // Form State
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [afm, setAfm] = useState('')
  const [iban, setIban] = useState('')
  const [bank, setBank] = useState('')
  const [category, setCategory] = useState('Εμπορεύματα')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const fetchSuppliersData = useCallback(async () => {
    if (!storeIdFromUrl) return
    try {
      setLoading(true)

      const { data: storeInfo } = await supabase.from('stores').select('name').eq('id', storeIdFromUrl).single()
      if (storeInfo) setCurrentStoreName(storeInfo.name)

      const [sRes, tRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('store_id', storeIdFromUrl),

        // ✅ bring date (for year filter) + type (for turnover rule)
        supabase
          .from('transactions')
          .select('amount, supplier_id, type, date, created_at')
          .eq('store_id', storeIdFromUrl),
      ])

      setSuppliers(sRes.data || [])
      setTransactions(tRes.data || [])
    } catch (err) {
      toast.error('Σφάλμα συγχρονισμού')
    } finally {
      setLoading(false)
    }
  }, [storeIdFromUrl])

  useEffect(() => {
    fetchSuppliersData()
  }, [fetchSuppliersData])

  // helpers
  const getTxDate = (t: any) => {
    const raw = t?.date
    if (!raw) return null
    return parseDateInputSafe(raw)
  }

  const isTxInYear = (t: any, year: number) => {
    const d = getTxDate(t)
    if (!d) return false
    return d.getFullYear() === year
  }

  // ✅ Available years for dropdown (from data + current year)
  const yearOptions = useMemo(() => {
    const years = new Set<number>()
    years.add(currentYear)
    for (const t of transactions) {
      const d = getTxDate(t)
      if (d) years.add(d.getFullYear())
    }
    return Array.from(years).sort((a, b) => b - a)
  }, [transactions, currentYear])

  // ✅ TURNOVER = ΜΟΝΟ ΑΓΟΡΕΣ (type === 'expense') μέσα στο επιλεγμένο έτος
  const supplierTotals = useMemo(() => {
    const totals: Record<string, number> = {}

    transactions.forEach((t: any) => {
      if (!t?.supplier_id) return
      if (String(t.type || '') !== 'expense') return // ✅ exclude debt_payment
      if (!isTxInYear(t, selectedYear)) return // ✅ year filter

      const amount = Math.abs(Number(t.amount)) || 0
      totals[t.supplier_id] = (totals[t.supplier_id] || 0) + amount
    })

    return totals
  }, [transactions, selectedYear])

  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      const totalA = supplierTotals[a.id] || 0
      const totalB = supplierTotals[b.id] || 0
      return totalB - totalA
    })
  }, [suppliers, supplierTotals])

  const getSupplierTurnover = (id: string) => supplierTotals[id] || 0

  // ✅ HERO TOTAL = total turnover across all suppliers (selected year)
  const totalSuppliersTurnover = useMemo(() => {
    return Object.values(supplierTotals).reduce((acc, n) => acc + (Number(n) || 0), 0)
  }, [supplierTotals])

  const resetForm = () => {
    setName('')
    setPhone('')
    setAfm('')
    setIban('')
    setBank('')
    setCategory('Εμπορεύματα')
    setEditingId(null)
    setIsFormOpen(false)
  }

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Συμπληρώστε το όνομα')
    if (!storeIdFromUrl) return toast.error('Σφάλμα καταστήματος')

    setIsSaving(true)
    try {
      const supplierData = {
        name: name.trim().toUpperCase(),
        phone: phone.trim(),
        vat_number: afm.trim(),
        iban: iban.trim().toUpperCase(),
        bank: bank,
        category: category,
        store_id: storeIdFromUrl,
      }

      let error: any
      if (editingId) {
        const { error: err } = await supabase.from('suppliers').update(supplierData).eq('id', editingId).eq('store_id', storeIdFromUrl)
        error = err
      } else {
        const { error: err } = await supabase.from('suppliers').insert([{ ...supplierData, is_active: true }])
        error = err
      }

      if (error) throw error

      toast.success('Επιτυχής καταχώρηση')
      resetForm()
      fetchSuppliersData()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Οριστική διαγραφή προμηθευτή;')) return
    if (!storeIdFromUrl) return toast.error('Σφάλμα καταστήματος')
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id).eq('store_id', storeIdFromUrl)
      if (error) throw error
      toast.success('Διαγράφηκε')
      fetchSuppliersData()
    } catch (err) {
      toast.error('Σφάλμα διαγραφής')
    }
  }

  return (
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />
      <div style={contentWrapper}>
        <header style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Προμηθευτές</h1>
            <p style={subtitleStyle}>
              ΚΑΤΑΣΤΗΜΑ: <span style={{ color: colors.accentBlue }}>{currentStoreName.toUpperCase()}</span>
            </p>
          </div>
          <Link href={`/?store=${storeIdFromUrl}`} style={closeBtn}>
            <ChevronLeft size={20} />
          </Link>
        </header>

        {/* ✅ HERO CARD: TOTAL TURNOVER FOR SELECTED YEAR */}
        <div style={heroCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={heroKicker}>ΣΥΝΟΛΟ ΤΖΙΡΟΥ ΠΡΟΜΗΘΕΥΤΩΝ</div>
              <div style={heroValue}>
                {totalSuppliersTurnover.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
              </div>
              <div style={heroHint}>Μετράει μόνο αγορές (expense). Δεν μετράει πληρωμές χρέους.</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <div style={heroYearLabel}>ΕΤΟΣ</div>
              <select
                value={String(selectedYear)}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={heroSelect}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            editingId ? resetForm() : setIsFormOpen(!isFormOpen)
          }}
          style={isFormOpen ? cancelBtn : addBtn}
        >
          {isFormOpen ? (
            'ΑΚΥΡΩΣΗ'
          ) : (
            <>
              <Plus size={16} /> ΝΕΟΣ ΠΡΟΜΗΘΕΥΤΗΣ
            </>
          )}
        </button>

        {isFormOpen && (
          <div style={formCard}>
            <div style={inputGroup}>
              <label style={labelStyle}>
                <Hash size={12} /> ΕΠΩΝΥΜΙΑ
              </label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="π.χ. COCA COLA" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={inputGroup}>
                <label style={labelStyle}>
                  <Phone size={12} /> ΤΗΛΕΦΩΝΟ
                </label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
              </div>
              <div style={inputGroup}>
                <label style={labelStyle}>
                  <Tag size={12} /> ΑΦΜ
                </label>
                <input value={afm} onChange={(e) => setAfm(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={inputGroup}>
              <label style={labelStyle}>
                <Building2 size={12} /> ΤΡΑΠΕΖΑ
              </label>
              <select value={bank} onChange={(e) => setBank(e.target.value)} style={inputStyle}>
                <option value="">Επιλέξτε Τράπεζα...</option>
                <option value="Εθνική Τράπεζα">Εθνική Τράπεζα</option>
                <option value="Eurobank">Eurobank</option>
                <option value="Τράπεζα Πειραιώς">Τράπεζα Πειραιώς</option>
                <option value="Alpha Bank">Alpha Bank</option>
                <option value="Viva Wallet">Viva Wallet</option>
              </select>
            </div>

            <div style={inputGroup}>
              <label style={labelStyle}>
                <CreditCard size={12} /> IBAN
              </label>
              <input value={iban} onChange={(e) => setIban(e.target.value)} style={inputStyle} placeholder="GR..." />
            </div>

            <div style={inputGroup}>
              <label style={labelStyle}>ΚΑΤΗΓΟΡΙΑ</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                <option value="Εμπορεύματα">🛒 Εμπορεύματα</option>
                <option value="Αναλώσιμα">📦 Αναλώσιμα</option>
                <option value="Υπηρεσίες">🛠️ Υπηρεσίες</option>
                <option value="Άλλο">❓ Άλλο</option>
              </select>
            </div>

            <button onClick={handleSave} disabled={isSaving} style={saveBtn}>
              {isSaving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΚΑΤΑΧΩΡΗΣΗ'}
            </button>
          </div>
        )}

        <div style={listArea}>
          <div style={rankingHeader}>
            <TrendingUp size={14} /> ΚΑΤΑΤΑΞΗ ΒΑΣΕΙ ΤΖΙΡΟΥ ({selectedYear})
          </div>

          {loading ? (
            <p style={emptyText}>Συγχρονισμός δεδομένων...</p>
          ) : sortedSuppliers.length === 0 ? (
            <p style={emptyText}>Δεν βρέθηκαν προμηθευτές.</p>
          ) : (
            sortedSuppliers.map((s, idx) => (
              <div key={s.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                <div style={rowWrapper} onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                  <div style={rankNumber}>{idx + 1}</div>
                  <div style={{ flex: 1 }}>
                    <p style={rowName}>{s.name.toUpperCase()}</p>
                    <p style={categoryBadge}>
                      {s.category} {s.bank ? `| ${s.bank}` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={turnoverText}>{getSupplierTurnover(s.id).toFixed(2)}€</p>
                  </div>
                </div>

                {expandedId === s.id && (
                  <div style={actionPanel}>
                    <div style={infoGrid}>
                      <p style={infoText}>
                        <strong>Τηλ:</strong> {s.phone || '-'}
                      </p>
                      <p style={infoText}>
                        <strong>ΑΦΜ:</strong> {s.vat_number || '-'}
                      </p>
                      <p style={infoText}>
                        <strong>Τράπεζα:</strong> {s.bank || '-'}
                      </p>
                      <p style={infoText}>
                        <strong>IBAN:</strong> {s.iban || '-'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button
                        onClick={() => {
                          setName(s.name)
                          setPhone(s.phone || '')
                          setAfm(s.vat_number || '')
                          setIban(s.iban || '')
                          setBank(s.bank || '')
                          setCategory(s.category)
                          setEditingId(s.id)
                          setIsFormOpen(true)
                        }}
                        style={editBtn}
                      >
                        <Edit2 size={14} /> Διόρθωση
                      </button>
                      <button onClick={() => handleDelete(s.id)} style={delBtn}>
                        <Trash2 size={14} /> Διαγραφή
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// --- STYLES ---
const containerStyle: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100%',
  width: '100%',
  padding: '20px',
  touchAction: 'pan-y',
}

const contentWrapper: any = { maxWidth: '480px', margin: '0 auto', paddingBottom: '120px' }

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }

const titleStyle: any = { fontSize: '22px', fontWeight: '800', color: colors.primaryDark, margin: 0 }

const subtitleStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginTop: '4px' }

const closeBtn: any = {
  padding: '8px',
  background: 'white',
  borderRadius: '12px',
  border: `1px solid ${colors.border}`,
  color: colors.primaryDark,
  textDecoration: 'none',
  display: 'flex',
}

/* ✅ HERO CARD styles */
const heroCard: any = {
  background: colors.primaryDark,
  color: 'white',
  padding: '18px',
  borderRadius: '22px',
  border: `1px solid rgba(255,255,255,0.08)`,
  boxShadow: '0 18px 50px rgba(15,23,42,0.18)',
  marginBottom: '18px',
}

const heroKicker: any = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '1px',
  opacity: 0.9,
}

const heroValue: any = {
  fontSize: 28,
  fontWeight: 950,
  lineHeight: 1.1,
}

const heroHint: any = {
  fontSize: 10,
  fontWeight: 800,
  opacity: 0.75,
  marginTop: 4,
}

const heroYearLabel: any = {
  fontSize: 10,
  fontWeight: 900,
  opacity: 0.9,
  letterSpacing: '1px',
}

const heroSelect: any = {
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.08)',
  color: 'white',
  fontWeight: 900,
  outline: 'none',
}

const addBtn: any = {
  width: '100%',
  backgroundColor: colors.primaryDark,
  color: 'white',
  padding: '16px',
  borderRadius: '16px',
  fontWeight: '800',
  border: 'none',
  marginBottom: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: 'pointer',
}

const cancelBtn: any = { ...addBtn, backgroundColor: '#fee2e2', color: colors.accentRed }

const formCard: any = {
  background: 'white',
  padding: '24px',
  borderRadius: '24px',
  marginBottom: '25px',
  border: `1px solid ${colors.border}`,
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
}

const inputGroup: any = { marginBottom: '15px' }

const labelStyle: any = {
  fontSize: '10px',
  fontWeight: '800',
  color: colors.secondaryText,
  marginBottom: '6px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
}

const inputStyle: any = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  border: `1px solid ${colors.border}`,
  fontSize: '16px',
  fontWeight: '600',
  outline: 'none',
  backgroundColor: colors.bgLight,
}

const saveBtn: any = {
  width: '100%',
  padding: '16px',
  backgroundColor: colors.accentGreen,
  color: 'white',
  borderRadius: '16px',
  border: 'none',
  fontWeight: '800',
  fontSize: '14px',
  marginTop: '10px',
  cursor: 'pointer',
}

const listArea: any = {
  background: 'white',
  borderRadius: '24px',
  border: `1px solid ${colors.border}`,
  overflow: 'hidden',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
}

const rankingHeader: any = {
  padding: '14px 20px',
  backgroundColor: colors.bgLight,
  fontSize: '10px',
  fontWeight: '800',
  color: colors.secondaryText,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

const rowWrapper: any = { display: 'flex', padding: '18px 20px', alignItems: 'center', cursor: 'pointer' }

const rankNumber: any = { width: '30px', fontWeight: '800', color: colors.secondaryText, fontSize: '14px' }

const rowName: any = { fontSize: '15px', fontWeight: '800', margin: 0, color: colors.primaryDark }

const categoryBadge: any = { fontSize: '10px', fontWeight: '700', color: colors.secondaryText, margin: 0 }

const turnoverText: any = { fontSize: '16px', fontWeight: '800', color: colors.accentGreen }

const actionPanel: any = { padding: '20px', backgroundColor: '#fcfcfc', borderTop: `1px dashed ${colors.border}` }

const infoGrid: any = { display: 'grid', gap: '8px' }

const infoText: any = { fontSize: '12px', margin: 0, color: colors.primaryDark }

const editBtn: any = {
  flex: 1,
  padding: '10px',
  background: colors.warning,
  color: colors.warningText,
  border: 'none',
  borderRadius: '10px',
  fontWeight: '700',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
  cursor: 'pointer',
}

const delBtn: any = {
  flex: 1,
  padding: '10px',
  background: '#fee2e2',
  color: colors.accentRed,
  border: 'none',
  borderRadius: '10px',
  fontWeight: '700',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
  cursor: 'pointer',
}

const emptyText: any = { padding: '40px', textAlign: 'center', color: colors.secondaryText, fontSize: '13px', fontWeight: '600' }

export default function SuppliersPage() {
  return (
    <Suspense fallback={null}>
      <SuppliersContent />
    </Suspense>
  )
}
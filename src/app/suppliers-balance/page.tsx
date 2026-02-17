'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, useCallback, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast, Toaster } from 'sonner'
import { ChevronLeft, Search, Plus, Camera, X, CheckCircle2, AlertTriangle } from 'lucide-react'

// --- COLOR PALETTE (EXACT) ---
const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentRed: '#dc2626',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  warning: '#fffbeb',
  warningText: '#92400e'
}

// --- HELPERS ---
const isValidUUID = (id: any) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof id === 'string' && regex.test(id)
}

type Supplier = { id: string; name: string; category?: string | null; store_id?: string | null }
type FixedAsset = { id: string; name: string; store_id?: string | null }

function SupplierFormModal({
  open,
  storeId,
  onClose,
  onCreated
}: {
  open: boolean
  storeId: string
  onClose: () => void
  onCreated: (supplier: Supplier) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setCategory('')
      setSaving(false)
    }
  }, [open])

  const handleSaveSupplier = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Βάλε όνομα προμηθευτή.')
      return
    }
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([
          {
            store_id: storeId,
            name: trimmed,
            category: category.trim() || null
          }
        ])
        .select('id,name,category,store_id')
        .single()

      if (error) throw error
      toast.success('Ο προμηθευτής προστέθηκε ✅')
      onCreated(data as Supplier)
      onClose()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Σφάλμα κατά την αποθήκευση προμηθευτή.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div style={modalOverlay}>
      <div style={modalCard}>
        <div style={modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={modalIconBox}>
              <Plus size={18} />
            </div>
            <div>
              <div style={modalTitle}>Νέος Προμηθευτής</div>
              <div style={modalSubtitle}>Δημιούργησε τον άμεσα χωρίς να φύγεις από τη σελίδα</div>
            </div>
          </div>
          <button onClick={onClose} style={iconBtn} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={label}>ΟΝΟΜΑ *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={input} placeholder="π.χ. ΑΒ Βιομηχανικά" />
        </div>

        <div style={{ marginTop: '14px' }}>
          <label style={label}>ΚΑΤΗΓΟΡΙΑ (προαιρετικό)</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} style={input} placeholder="π.χ. Τρόφιμα / Ανταλλακτικά" />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          <button onClick={onClose} style={btnGhost} disabled={saving}>
            ΑΚΥΡΟ
          </button>
          <button onClick={handleSaveSupplier} style={btnPrimary} disabled={saving}>
            {saving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΠΡΟΣΘΗΚΗ'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddExpenseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const storeId = searchParams.get('store')
  const presetSupplierId = searchParams.get('supId')
  const presetMode = searchParams.get('mode') // e.g. "debt"

  // SaaS guard
  useEffect(() => {
    if (!storeId || storeId === 'null' || !isValidUUID(storeId)) {
      router.replace('/select-store')
    }
  }, [storeId, router])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Data
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([])

  // Form
  const [amount, setAmount] = useState<string>('')
  const [method, setMethod] = useState<'cash' | 'bank'>('cash')

  // Credit / Debt toggles
  const [isCredit, setIsCredit] = useState(false)
  const [isDebtPayment, setIsDebtPayment] = useState(false)

  // Supplier select + search (synced)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [supplierSearch, setSupplierSearch] = useState<string>('')

  // Fixed asset
  const [selectedAssetId, setSelectedAssetId] = useState<string>('')

  // Notes + No Invoice
  const [notes, setNotes] = useState<string>('')
  const [noInvoice, setNoInvoice] = useState<boolean>(false)

  // Photo upload
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')

  // Supplier modal
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)

  const fetchInitial = useCallback(async () => {
    if (!storeId || storeId === 'null' || !isValidUUID(storeId)) return
    setLoading(true)
    try {
      const { data: supData, error: supErr } = await supabase
        .from('suppliers')
        .select('id,name,category,store_id')
        .eq('store_id', storeId)
        .order('name')

      if (supErr) throw supErr

      const { data: assetData, error: assetErr } = await supabase
        .from('fixed_assets')
        .select('id,name,store_id')
        .eq('store_id', storeId)
        .order('name')

      if (assetErr) throw assetErr

      setSuppliers((supData || []) as Supplier[])
      setFixedAssets((assetData || []) as FixedAsset[])

      // Presets (from URL)
      if (presetSupplierId && isValidUUID(presetSupplierId)) {
        setSelectedSupplierId(presetSupplierId)
        const found = (supData || []).find((s: any) => s.id === presetSupplierId)
        if (found?.name) setSupplierSearch(found.name)
      }

      if (presetMode === 'debt') {
        setIsDebtPayment(true)
        setIsCredit(false)
      }
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Σφάλμα φόρτωσης δεδομένων.')
    } finally {
      setLoading(false)
    }
  }, [storeId, presetSupplierId, presetMode])

  useEffect(() => {
    fetchInitial()
  }, [fetchInitial])

  // Manage preview URL lifecycle
  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Filter supplier options based on search (nice UX, still synced)
  const supplierOptions = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter((s) => (s.name || '').toLowerCase().includes(q))
  }, [suppliers, supplierSearch])

  // Sync: dropdown -> search
  const onSupplierSelect = (id: string) => {
    setSelectedSupplierId(id)
    const s = suppliers.find((x) => x.id === id)
    setSupplierSearch(s?.name || '')
  }

  // Sync: search -> dropdown
  const onSupplierSearchChange = (val: string) => {
    setSupplierSearch(val)

    const exact = suppliers.find((s) => (s.name || '').trim().toLowerCase() === val.trim().toLowerCase())
    if (exact) {
      setSelectedSupplierId(exact.id)
      return
    }

    // If user is typing something non-exact, keep select empty to avoid wrong selection
    setSelectedSupplierId('')
  }

  const onCreatedSupplier = (s: Supplier) => {
    // update list and select it
    setSuppliers((prev) => {
      const next = [...prev, s]
      next.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'el'))
      return next
    })
    setSelectedSupplierId(s.id)
    setSupplierSearch(s.name || '')
  }

  // Ensure credit/debt are mutually exclusive
  const toggleCredit = () => {
    setIsCredit((v) => {
      const next = !v
      if (next) setIsDebtPayment(false)
      return next
    })
  }
  const toggleDebtPayment = () => {
    setIsDebtPayment((v) => {
      const next = !v
      if (next) setIsCredit(false)
      return next
    })
  }

  const uploadInvoiceImage = async (): Promise<string | null> => {
    if (!file) return null
    if (!storeId || storeId === 'null' || !isValidUUID(storeId)) return null

    const safeName = file.name.replace(/\s+/g, '_')
    const path = `${storeId}/${Date.now()}_${safeName}`

    const { error: upErr } = await supabase.storage.from('invoices').upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })

    if (upErr) throw upErr

    const { data } = supabase.storage.from('invoices').getPublicUrl(path)
    return data?.publicUrl || null
  }

  const handleSave = async () => {
    if (!storeId || storeId === 'null' || !isValidUUID(storeId)) {
      router.replace('/select-store')
      return
    }

    const amountNum = Number(String(amount).replace(',', '.'))
    if (!amount || Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error('Βάλε έγκυρο ποσό.')
      return
    }

    // If credit/debt payment, supplier must be selected
    if ((isCredit || isDebtPayment) && !selectedSupplierId) {
      toast.error('Επίλεξε προμηθευτή.')
      return
    }

    setSaving(true)
    try {
      let finalNotes = (notes || '').trim()

      if (noInvoice) {
        // Requirement: label is "ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ" (no "Μαύρα")
        // Keep the text inside notes so the analysis badge can work.
        if (!finalNotes) finalNotes = 'ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ'
        else if (!finalNotes.toUpperCase().includes('ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ')) finalNotes = `${finalNotes} | ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ`
      }

      const imageUrl = await uploadInvoiceImage()

      const type = isDebtPayment ? 'debt_payment' : 'expense'
      const methodDb = method === 'cash' ? 'Μετρητά' : 'Τράπεζα'

      // Requirement: amount saved as negative number (Math.abs)
      const finalAmount = -Math.abs(amountNum)

      const payload: any = {
        store_id: storeId,
        amount: finalAmount,
        type,
        method: methodDb,
        date: new Date().toISOString().slice(0, 10),
        notes: finalNotes || null,
        supplier_id: selectedSupplierId || null,
        fixed_asset_id: selectedAssetId || null,
        is_credit: isCredit === true // credit flag (for supplier balance logic)
      }

      if (imageUrl) payload.image_url = imageUrl

      const { error } = await supabase.from('transactions').insert([payload])
      if (error) throw error

      toast.success('Το έξοδο αποθηκεύτηκε ✅')

      // Reset form (keep store context)
      setAmount('')
      setMethod('cash')
      setIsCredit(false)
      setIsDebtPayment(false)
      setSelectedSupplierId('')
      setSupplierSearch('')
      setSelectedAssetId('')
      setNotes('')
      setNoInvoice(false)
      setFile(null)

      // optional: go back home
      router.replace(`/?store=${storeId}`)
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Σφάλμα αποθήκευσης.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '520px', margin: '0 auto', paddingBottom: '120px' }}>
        {/* HEADER */}
        <div style={headerRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBox}>➖</div>
            <div>
              <h1 style={title}>Προσθήκη Εξόδου</h1>
              <p style={subtitle}>ΚΑΤΑΧΩΡΗΣΗ ΝΕΑΣ ΚΙΝΗΣΗΣ</p>
            </div>
          </div>

          <Link href={`/?store=${storeId || ''}`} style={backBtn} aria-label="Back">
            <ChevronLeft size={20} />
          </Link>
        </div>

        {/* CARD */}
        <div style={card}>
          {/* AMOUNT */}
          <label style={label}>ΠΟΣΟ (€) *</label>
          <input
            inputMode="decimal"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            style={{ ...input, fontSize: '22px', textAlign: 'center' }}
          />

          {/* METHOD */}
          <div style={{ marginTop: '14px' }}>
            <label style={label}>ΤΡΟΠΟΣ ΠΛΗΡΩΜΗΣ</label>
            <div style={segmentedRow}>
              <button onClick={() => setMethod('cash')} style={method === 'cash' ? segActive : segInactive} type="button">
                💵 ΜΕΤΡΗΤΑ
              </button>
              <button onClick={() => setMethod('bank')} style={method === 'bank' ? segActive : segInactive} type="button">
                🏦 ΤΡΑΠΕΖΑ
              </button>
            </div>
          </div>

          {/* CREDIT / DEBT */}
          <div style={{ marginTop: '14px' }}>
            <label style={label}>ΚΑΤΑΣΤΑΣΗ</label>
            <div style={toggleGrid}>
              <button onClick={toggleCredit} style={isCredit ? toggleOn : toggleOff} type="button">
                {isCredit ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                ΠΙΣΤΩΣΗ
              </button>
              <button onClick={toggleDebtPayment} style={isDebtPayment ? toggleOnBlue : toggleOff} type="button">
                {isDebtPayment ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                ΕΞΟΦΛΗΣΗ ΧΡΕΟΥΣ
              </button>
            </div>
            <p style={hint}>
              {isCredit
                ? 'Η κίνηση θα μετρήσει ως πίστωση προμηθευτή.'
                : isDebtPayment
                  ? 'Η κίνηση θα μετρήσει ως πληρωμή χρέους (debt_payment).'
                  : 'Κανονικό έξοδο.'}
            </p>
          </div>

          {/* SUPPLIER: SEARCH + PLUS + SELECT */}
          <div style={{ marginTop: '14px' }}>
            <label style={label}>ΠΡΟΜΗΘΕΥΤΗΣ</label>

            <div style={supplierSearchRow}>
              <div style={searchWrap}>
                <input
                  value={supplierSearch}
                  onChange={(e) => onSupplierSearchChange(e.target.value)}
                  placeholder="Αναζήτηση προμηθευτή..."
                  style={searchInput}
                />
                {/* Search icon on RIGHT */}
                <Search size={16} style={searchIconRight} />
              </div>

              <button onClick={() => setSupplierModalOpen(true)} style={plusBtn} type="button" title="Νέος προμηθευτής">
                <Plus size={18} />
              </button>
            </div>

            <select value={selectedSupplierId} onChange={(e) => onSupplierSelect(e.target.value)} style={select}>
              <option value="">{supplierOptions.length ? 'Επίλεξε προμηθευτή' : 'Δεν υπάρχουν προμηθευτές'}</option>
              {supplierOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {String(s.name || '').toUpperCase()}
                </option>
              ))}
            </select>

            {(isCredit || isDebtPayment) && !selectedSupplierId && (
              <div style={warnBox}>⚠️ Για ΠΙΣΤΩΣΗ / ΕΞΟΦΛΗΣΗ ΧΡΕΟΥΣ πρέπει να επιλέξεις προμηθευτή.</div>
            )}
          </div>

          {/* FIXED ASSET */}
          <div style={{ marginTop: '14px' }}>
            <label style={label}>ΠΑΓΙΟ (προαιρετικό)</label>
            <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)} style={select}>
              <option value="">—</option>
              {fixedAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {String(a.name || '').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* NO INVOICE */}
          <div style={{ marginTop: '14px' }}>
            <button
              type="button"
              onClick={() => setNoInvoice((v) => !v)}
              style={noInvoice ? toggleNoInvoiceOn : toggleNoInvoiceOff}
            >
              {noInvoice ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ
            </button>
          </div>

          {/* NOTES */}
          <div style={{ marginTop: '14px' }}>
            <label style={label}>ΣΗΜΕΙΩΣΕΙΣ</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="π.χ. Υλικά / service / μεταφορικά..."
              style={textarea}
              rows={3}
            />
          </div>

          {/* PHOTO */}
          <div style={{ marginTop: '14px' }}>
            <label style={label}>ΦΩΤΟ / ΤΙΜΟΛΟΓΙΟ</label>

            <div style={photoRow}>
              <label style={photoPickBtn}>
                <Camera size={16} />
                Επιλογή Φωτο
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>

              {file && (
                <button type="button" onClick={() => setFile(null)} style={photoRemoveBtn}>
                  <X size={16} /> Αφαίρεση
                </button>
              )}
            </div>

            {previewUrl && (
              <div style={previewWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Preview" style={previewImg} />
              </div>
            )}
          </div>

          {/* SAVE */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              ...saveBtn,
              opacity: saving || loading ? 0.7 : 1
            }}
          >
            {saving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ ΕΞΟΔΟΥ'}
          </button>

          {loading && <div style={smallHint}>Φόρτωση προμηθευτών/παγίων...</div>}
        </div>
      </div>

      {/* MODAL */}
      {!!storeId && storeId !== 'null' && isValidUUID(storeId) && (
        <SupplierFormModal
          open={supplierModalOpen}
          storeId={storeId}
          onClose={() => setSupplierModalOpen(false)}
          onCreated={onCreatedSupplier}
        />
      )}
    </div>
  )
}

// --- STYLES (INLINE CSS ONLY) ---
const iphoneWrapper: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100dvh',
  padding: '18px',
  overflowY: 'auto',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0
}

const headerRow: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '18px'
}

const logoBox: any = {
  width: '44px',
  height: '44px',
  borderRadius: '14px',
  backgroundColor: '#eef2ff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px'
}

const title: any = { margin: 0, fontWeight: '900', fontSize: '20px', color: colors.primaryDark }
const subtitle: any = { margin: 0, marginTop: '3px', fontWeight: '800', fontSize: '10px', letterSpacing: '1px', color: colors.secondaryText }

const backBtn: any = {
  width: '40px',
  height: '40px',
  borderRadius: '12px',
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  color: colors.secondaryText,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none'
}

const card: any = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: '24px',
  padding: '18px',
  boxShadow: '0 6px 16px rgba(0,0,0,0.04)'
}

const label: any = {
  fontSize: '10px',
  fontWeight: '900',
  color: colors.secondaryText,
  letterSpacing: '1px',
  marginBottom: '6px',
  display: 'block',
  textTransform: 'uppercase'
}

const input: any = {
  width: '100%',
  padding: '14px',
  borderRadius: '14px',
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.bgLight,
  outline: 'none',
  fontWeight: '900',
  color: colors.primaryDark,
  boxSizing: 'border-box'
}

const textarea: any = {
  ...input,
  fontSize: '14px',
  fontWeight: '800',
  resize: 'none'
}

const segmentedRow: any = { display: 'flex', gap: '10px' }
const segActive: any = {
  flex: 1,
  padding: '12px',
  borderRadius: '14px',
  border: 'none',
  backgroundColor: colors.primaryDark,
  color: colors.white,
  fontWeight: '900',
  fontSize: '12px',
  cursor: 'pointer'
}
const segInactive: any = {
  ...segActive,
  backgroundColor: colors.bgLight,
  color: colors.secondaryText,
  border: `1px solid ${colors.border}`
}

const toggleGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }
const toggleOff: any = {
  padding: '12px',
  borderRadius: '14px',
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  color: colors.secondaryText,
  fontWeight: '900',
  fontSize: '11px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px'
}
const toggleOn: any = { ...toggleOff, backgroundColor: '#ecfdf5', border: '1px solid #bbf7d0', color: colors.accentGreen }
const toggleOnBlue: any = { ...toggleOff, backgroundColor: '#eff6ff', border: '1px solid #dbeafe', color: colors.accentBlue }

const hint: any = { margin: '8px 0 0', fontSize: '11px', fontWeight: '800', color: colors.secondaryText }

const supplierSearchRow: any = { display: 'flex', gap: '10px', alignItems: 'center' }

const searchWrap: any = { position: 'relative', flex: 1 }
const searchInput: any = {
  ...input,
  paddingRight: '42px' // ✅ so text doesn't overlap icon (icon on right)
}
const searchIconRight: any = {
  position: 'absolute',
  right: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: colors.secondaryText,
  pointerEvents: 'none'
}

const plusBtn: any = {
  width: '52px',
  height: '48px',
  borderRadius: '14px',
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.primaryDark,
  boxShadow: '0 6px 14px rgba(0,0,0,0.04)'
}

const select: any = {
  width: '100%',
  marginTop: '10px',
  padding: '14px',
  borderRadius: '14px',
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  outline: 'none',
  fontWeight: '900',
  color: colors.primaryDark,
  appearance: 'none',
  boxSizing: 'border-box'
}

const warnBox: any = {
  marginTop: '10px',
  backgroundColor: colors.warning,
  color: colors.warningText,
  border: `1px solid #fde68a`,
  borderRadius: '14px',
  padding: '10px 12px',
  fontWeight: '900',
  fontSize: '11px'
}

const noInvoiceToggleBase: any = {
  width: '100%',
  padding: '12px',
  borderRadius: '14px',
  fontWeight: '900',
  fontSize: '12px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px'
}
const toggleNoInvoiceOff: any = { ...noInvoiceToggleBase, backgroundColor: colors.white, border: `1px solid ${colors.border}`, color: colors.secondaryText }
const toggleNoInvoiceOn: any = { ...noInvoiceToggleBase, backgroundColor: colors.warning, border: '1px solid #fde68a', color: colors.warningText }

const photoRow: any = { display: 'flex', gap: '10px', alignItems: 'center' }
const photoPickBtn: any = {
  flex: 1,
  padding: '12px',
  borderRadius: '14px',
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.bgLight,
  fontWeight: '900',
  fontSize: '12px',
  color: colors.primaryDark,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px'
}
const photoRemoveBtn: any = {
  padding: '12px',
  borderRadius: '14px',
  border: `1px solid #fecaca`,
  backgroundColor: '#fef2f2',
  fontWeight: '900',
  fontSize: '12px',
  color: colors.accentRed,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
}

const previewWrap: any = {
  marginTop: '10px',
  borderRadius: '16px',
  border: `1px solid ${colors.border}`,
  overflow: 'hidden',
  backgroundColor: colors.bgLight
}
const previewImg: any = { width: '100%', height: '220px', objectFit: 'cover', display: 'block' }

const saveBtn: any = {
  marginTop: '18px',
  width: '100%',
  padding: '16px',
  borderRadius: '16px',
  border: 'none',
  backgroundColor: colors.primaryDark,
  color: colors.white,
  fontWeight: '900',
  fontSize: '14px',
  cursor: 'pointer'
}

const smallHint: any = { marginTop: '10px', fontSize: '11px', fontWeight: '800', color: colors.secondaryText, textAlign: 'center' }

// --- MODAL STYLES ---
const modalOverlay: any = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  padding: '18px'
}

const modalCard: any = {
  width: '100%',
  maxWidth: '420px',
  backgroundColor: colors.white,
  borderRadius: '24px',
  border: `1px solid ${colors.border}`,
  padding: '16px',
  boxShadow: '0 18px 44px rgba(0,0,0,0.18)'
}

const modalHeader: any = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '10px'
}

const modalIconBox: any = {
  width: '40px',
  height: '40px',
  borderRadius: '14px',
  backgroundColor: '#eef2ff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.primaryDark
}

const modalTitle: any = { fontWeight: '900', color: colors.primaryDark, fontSize: '16px' }
const modalSubtitle: any = { marginTop: '3px', fontWeight: '800', color: colors.secondaryText, fontSize: '11px' }

const iconBtn: any = {
  width: '40px',
  height: '40px',
  borderRadius: '14px',
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.secondaryText
}

const btnGhost: any = {
  flex: 1,
  padding: '14px',
  borderRadius: '14px',
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  color: colors.secondaryText,
  fontWeight: '900',
  cursor: 'pointer'
}

const btnPrimary: any = {
  flex: 1,
  padding: '14px',
  borderRadius: '14px',
  border: 'none',
  backgroundColor: colors.primaryDark,
  color: colors.white,
  fontWeight: '900',
  cursor: 'pointer'
}

export default function AddExpensePage() {
  return (
    <main style={{ backgroundColor: colors.bgLight, minHeight: '100vh' }}>
      <Suspense fallback={<div style={{ padding: '50px', textAlign: 'center', fontWeight: 900, color: colors.secondaryText }}>Φόρτωση...</div>}>
        <AddExpenseContent />
      </Suspense>
    </main>
  )
}
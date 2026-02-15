'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Trash2, Edit2, Eye, EyeOff, X, Plus, Search } from 'lucide-react'
import { toast, Toaster } from 'sonner'

// --- MODERN PREMIUM PALETTE ---
const colors = {
  primary: '#0f172a',    
  secondary: '#64748b',
  success: '#10b981',   
  danger: '#f43f5e',     
  background: '#f8fafc',       
  surface: '#ffffff',
  border: '#e2e8f0',
  indigo: '#6366f1'
}

function SuppliersContent() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  
  const [showInactive, setShowInactive] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [afm, setAfm] = useState('') 
  const [iban, setIban] = useState('')
  const [category, setCategory] = useState('Εμπορεύματα')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const fetchSuppliersData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return;

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', session.user.id).single()
      
      if (profile?.store_id) {
        setStoreId(profile.store_id)
        const [sData, tData] = await Promise.all([
          supabase.from('suppliers').select('*').eq('store_id', profile.store_id).order('name'),
          supabase.from('transactions').select('amount, supplier_id').eq('store_id', profile.store_id)
        ])
        setSuppliers(sData.data || [])
        setTransactions(tData.data || [])
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSuppliersData() }, [fetchSuppliersData])

  const getSupplierTurnover = (supplierId: string) => {
    return transactions
      .filter(t => t.supplier_id === supplierId)
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  }

  async function toggleActive(supplier: any) {
    try {
      const { error } = await supabase.from('suppliers').update({ is_active: !supplier.is_active }).eq('id', supplier.id);
      if (error) throw error;
      toast.success(supplier.is_active ? 'Απενεργοποιήθηκε' : 'Ενεργοποιήθηκε');
      fetchSuppliersData();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Προσοχή: Η διαγραφή είναι οριστική. Θέλετε να συνεχίσετε;')) return;
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      toast.success('Διαγράφηκε οριστικά');
      fetchSuppliersData();
    } catch (err: any) { toast.error('Σφάλμα κατά τη διαγραφή'); }
  }

  async function handleSave() {
    if (!name) return toast.error('Συμπληρώστε το όνομα')
    if (!storeId) return toast.error('Σφάλμα καταστήματος')
    setIsSaving(true)
    try {
      const supplierData = { name, phone, vat_number: afm, iban, category, store_id: storeId }
      let error;
      if (editingId) {
        const res = await supabase.from('suppliers').update(supplierData).eq('id', editingId)
        error = res.error
      } else {
        const res = await supabase.from('suppliers').insert([{ ...supplierData, is_active: true }])
        error = res.error
      }
      if (error) throw error;
      toast.success(editingId ? 'Ενημερώθηκε!' : 'Προστέθηκε!');
      resetForm();
      fetchSuppliersData();
    } catch (error: any) { toast.error(error.message) } finally { setIsSaving(false) }
  }

  const handleEdit = (s: any) => {
    setEditingId(s.id); setName(s.name); setPhone(s.phone || '');
    setAfm(s.vat_number || ''); setIban(s.iban || '');
    setCategory(s.category || 'Εμπορεύματα');
    setIsFormOpen(true);
  }

  const resetForm = () => {
    setName(''); setPhone(''); setAfm(''); setIban(''); setCategory('Εμπορεύματα');
    setEditingId(null); setIsFormOpen(false);
  }

  const visibleSuppliers = suppliers.filter(s => showInactive ? true : s.is_active !== false);

  if (loading) return <div style={loaderStyle}>Φόρτωση...</div>

  return (
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        body { background-color: ${colors.background}; font-family: 'Plus Jakarta Sans', sans-serif; margin: 0; }
        .supplier-card { transition: transform 0.2s ease; }
        .supplier-card:active { transform: scale(0.98); }
      `}} />

      <div style={contentWrapper}>
        {/* HEADER */}
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBox}>🛒</div>
            <div>
              <h1 style={titleStyle}>Προμηθευτές</h1>
              <p style={subtitleStyle}>ΣΥΝΕΡΓΑΤΕΣ ({suppliers.length})</p>
            </div>
          </div>
          <Link href="/" style={backBtn}><X size={20} /></Link>
        </header>

        {/* TOP ACTIONS */}
        <div style={topActionsRow}>
          <button onClick={() => setIsFormOpen(!isFormOpen)} style={mainAddBtn}>
            {isFormOpen ? 'ΑΚΥΡΩΣΗ' : <><Plus size={18} /> ΝΕΟΣ ΠΡΟΜΗΘΕΥΤΗΣ</>}
          </button>
          <button onClick={() => setShowInactive(!showInactive)} style={filterBtn(showInactive)}>
            {showInactive ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
        </div>

        {/* FORM CARD */}
        {isFormOpen && (
          <div style={formCard}>
            <div style={{marginBottom: '16px'}}>
                <label style={labelStyle}>ΕΠΩΝΥΜΙΑ ΕΠΙΧΕΙΡΗΣΗΣ</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="π.χ. Παπαδόπουλος Α.Ε." style={inputStyle} />
            </div>
            
            <div style={grid2}>
              <div>
                <label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} inputMode="tel" placeholder="210..." />
              </div>
              <div>
                <label style={labelStyle}>Α.Φ.Μ.</label>
                <input maxLength={9} value={afm} onChange={(e) => setAfm(e.target.value)} style={inputStyle} inputMode="numeric" placeholder="9 ψηφία" />
              </div>
            </div>

            <div style={{marginTop: '16px'}}>
                <label style={labelStyle}>IBAN ΛΟΓΑΡΙΑΣΜΟΣ</label>
                <input value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="GR..." style={inputStyle} />
            </div>

            <div style={{marginTop: '16px'}}>
                <label style={labelStyle}>ΚΑΤΗΓΟΡΙΑ</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                    <option value="Εμπορεύματα">🛒 Εμπορεύματα</option>
                    <option value="Πάγια">🏢 Πάγια / Λογαριασμοί</option>
                    <option value="Λοιπά">📦 Λοιπά Έξοδα</option>
                </select>
            </div>

            <button onClick={handleSave} disabled={isSaving} style={saveBtn}>
              {isSaving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΔΗΜΙΟΥΡΓΙΑ ΣΥΝΕΡΓΑΤΗ')}
            </button>
          </div>
        )}

        {/* SUPPLIERS LIST */}
        <div style={{ marginTop: '20px' }}>
          <p style={sectionLabel}>ΛΙΣΤΑ ΣΥΝΕΡΓΑΤΩΝ</p>
          {visibleSuppliers.map(s => (
            <div key={s.id} style={{...supplierRow, opacity: s.is_active === false ? 0.5 : 1}} className="supplier-card">
              <div style={{ flex: 1 }}>
                <p style={supplierName}>{s.name.toUpperCase()}</p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                   <span style={badgeStyle}>{s.category}</span>
                   <span style={turnoverStyle}>{getSupplierTurnover(s.id).toFixed(2)}€</span>
                </div>
              </div>
              
              <div style={actionsContainer}>
                <button onClick={() => handleEdit(s)} style={actionIconBtn}><Edit2 size={16}/></button>
                <button onClick={() => toggleActive(s)} style={{...actionIconBtn, color: s.is_active ? colors.secondary : colors.success}}>
                    {s.is_active ? '🚫' : '✅'}
                </button>
                <button onClick={() => handleDelete(s.id)} style={{...actionIconBtn, color: colors.danger}}><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
          
          {visibleSuppliers.length === 0 && !isFormOpen && (
            <div style={emptyState}>Δεν βρέθηκαν συνεργάτες.</div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- MODERN STYLES ---
const containerStyle: any = { minHeight: '100dvh', padding: '20px', backgroundColor: colors.background }
const contentWrapper: any = { maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }
const logoBox: any = { width: '44px', height: '44px', backgroundColor: colors.primary, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
const titleStyle: any = { fontWeight: '800', fontSize: '22px', margin: 0, color: colors.primary, letterSpacing: '-0.5px' }
const subtitleStyle: any = { margin: 0, fontSize: '10px', color: colors.secondary, fontWeight: '700', letterSpacing: '1px' }
const backBtn: any = { textDecoration: 'none', color: colors.secondary, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: '12px', border: `1px solid ${colors.border}` }

const topActionsRow: any = { display: 'flex', gap: '12px', marginBottom: '25px' }
const mainAddBtn: any = { flex: 1, height: '52px', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)' }
const filterBtn = (active: boolean): any => ({ width: '52px', height: '52px', backgroundColor: active ? colors.primary : colors.surface, color: active ? 'white' : colors.primary, border: `1px solid ${colors.border}`, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' })

const formCard: any = { backgroundColor: colors.surface, padding: '24px', borderRadius: '24px', border: `1px solid ${colors.border}`, marginBottom: '25px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondary, marginBottom: '6px', display: 'block', letterSpacing: '0.5px' }
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '14px', border: `1px solid ${colors.border}`, fontSize: '15px', fontWeight: '600', backgroundColor: colors.background, boxSizing: 'border-box', outline: 'none' }
const grid2: any = { display: 'flex', gap: '12px' }
const saveBtn: any = { width: '100%', padding: '16px', backgroundColor: colors.success, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '15px', marginTop: '24px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }

const sectionLabel: any = { fontSize: '11px', fontWeight: '800', color: colors.secondary, marginBottom: '16px', letterSpacing: '1px' }
const supplierRow: any = { backgroundColor: colors.surface, padding: '18px 20px', borderRadius: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${colors.border}`, marginBottom: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }
const supplierName: any = { fontWeight: '800', margin: 0, fontSize: '15px', color: colors.primary, letterSpacing: '-0.2px' }
const badgeStyle: any = { fontSize: '10px', fontWeight: '700', backgroundColor: colors.background, padding: '4px 10px', borderRadius: '8px', color: colors.secondary, border: `1px solid ${colors.border}` }
const turnoverStyle: any = { fontSize: '13px', color: colors.success, fontWeight: '800' }
const actionsContainer: any = { display: 'flex', gap: '8px' }
const actionIconBtn: any = { background: colors.background, border: `1px solid ${colors.border}`, width: '38px', height: '38px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.secondary }

const emptyState: any = { textAlign: 'center', padding: '60px 20px', color: colors.secondary, fontWeight: '600', fontSize: '14px' }
const loaderStyle: any = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.secondary, fontWeight: '700' }

export default function SuppliersPage() {
  return <main><Suspense fallback={null}><SuppliersContent /></Suspense></main>
}
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Trash2, Edit2, Eye, EyeOff, X, Plus, Copy, Check } from 'lucide-react'
import { toast, Toaster } from 'sonner'

// --- FUTURISTIC DARK PALETTE ---
const colors = {
  bg: '#0a0a0c',
  glass: 'rgba(255, 255, 255, 0.03)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  accent: '#6366f1', // Electric Indigo
  success: '#10b981', 
  danger: '#f43f5e',
  textMain: '#ffffff',
  textDim: '#94a3b8'
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
    return transactions.filter(t => t.supplier_id === supplierId).reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
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
    if (!confirm('Προσοχή: Η διαγραφή είναι οριστική.')) return;
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      toast.success('Διαγράφηκε οριστικά');
      fetchSuppliersData();
    } catch (err: any) { toast.error('Σφάλμα κατά τη διαγραφή'); }
  }

  async function handleSave() {
    if (!name || !storeId) return toast.error('Συμπληρώστε τα απαραίτητα')
    setIsSaving(true)
    try {
      const supplierData = { name, phone, vat_number: afm, iban, category, store_id: storeId }
      const { error } = editingId 
        ? await supabase.from('suppliers').update(supplierData).eq('id', editingId)
        : await supabase.from('suppliers').insert([{ ...supplierData, is_active: true }])
      if (error) throw error;
      toast.success('Επιτυχής αποθήκευση');
      resetForm(); fetchSuppliersData();
    } catch (error: any) { toast.error(error.message) } finally { setIsSaving(false) }
  }

  const handleEdit = (s: any) => {
    setEditingId(s.id); setName(s.name); setPhone(s.phone || '');
    setAfm(s.vat_number || ''); setIban(s.iban || '');
    setCategory(s.category || 'Εμπορεύματα'); setIsFormOpen(true);
  }

  const resetForm = () => {
    setName(''); setPhone(''); setAfm(''); setIban(''); setCategory('Εμπορεύματα');
    setEditingId(null); setIsFormOpen(false);
  }

  const visibleSuppliers = suppliers.filter(s => showInactive ? true : s.is_active !== false);

  if (loading) return <div style={loaderStyle}>SYSTEM INITIALIZING...</div>

  return (
    <div style={mainContainer}>
      <Toaster position="top-center" theme="dark" richColors />
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;500;700;800&display=swap');
        body { background: ${colors.bg}; font-family: 'Plus Jakarta Sans', sans-serif; color: ${colors.textMain}; }
        .glass-card { background: ${colors.glass}; backdrop-filter: blur(12px); border: 1px solid ${colors.glassBorder}; }
        .neon-btn { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .neon-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3); }
      `}} />

      <div style={contentWrapper}>
        {/* HEADER AREA */}
        <div style={headerSection}>
          <div style={brandBox}>
             <div style={logoGlow}>🛒</div>
             <div>
                <h1 style={mainTitle}>Προμηθευτές</h1>
                <p style={subTitle}>DATABASE MANAGEMENT</p>
             </div>
          </div>
          <Link href="/" style={closeBtn}><X size={20} /></Link>
        </div>

        {/* TOP ACTIONS */}
        <div style={actionRow}>
           <button onClick={() => setIsFormOpen(!isFormOpen)} style={primaryActionBtn} className="neon-btn">
              {isFormOpen ? 'CLOSE FORM' : <><Plus size={20} /> ΝΕΟΣ ΠΡΟΜΗΘΕΥΤΗΣ</>}
           </button>
           <button onClick={() => setShowInactive(!showInactive)} style={toggleBtn(showInactive)}>
              {showInactive ? <Eye size={20} /> : <EyeOff size={20} />}
           </button>
        </div>

        {/* FORM MODAL / CARD */}
        {isFormOpen && (
          <div style={formWrapper} className="glass-card">
            <h3 style={formHeader}>{editingId ? 'Edit Partner' : 'Create New Partner'}</h3>
            <div style={inputGroup}>
              <label style={microLabel}>ΕΠΩΝΥΜΙΑ</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputField} placeholder="Company Name" />
            </div>
            <div style={rowGrid}>
              <div style={{flex:1}}>
                <label style={microLabel}>PHONE</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputField} placeholder="Contact" />
              </div>
              <div style={{flex:1}}>
                <label style={microLabel}>VAT / AFM</label>
                <input value={afm} onChange={(e) => setAfm(e.target.value)} style={inputField} placeholder="9 digits" />
              </div>
            </div>
            <div style={inputGroup}>
              <label style={microLabel}>IBAN</label>
              <input value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} style={inputField} placeholder="GR00 0000..." />
            </div>
            <div style={inputGroup}>
              <label style={microLabel}>CATEGORY</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectField}>
                 <option value="Εμπορεύματα">🛒 Εμπορεύματα</option>
                 <option value="Πάγια">🏢 Πάγια / Λογαριασμοί</option>
                 <option value="Λοιπά">📦 Λοιπά Έξοδα</option>
              </select>
            </div>
            <button onClick={handleSave} style={submitBtn} disabled={isSaving}>
              {isSaving ? 'SYNCING...' : 'SAVE PARTNER'}
            </button>
          </div>
        )}

        {/* THE LIST TABLE */}
        <div style={listArea}>
          <div style={listHead}>
             <span>PARTNER NAME</span>
             <span style={{textAlign: 'right'}}>TURNOVER</span>
          </div>
          
          {visibleSuppliers.map(s => (
            <div key={s.id} style={{...rowItem, opacity: s.is_active === false ? 0.4 : 1}} className="glass-card">
               <div style={{flex: 1}}>
                  <p style={rowName}>{s.name.toUpperCase()}</p>
                  <div style={tagRow}>
                     <span style={categoryTag}>{s.category}</span>
                     {s.phone && <span style={contactTag}>📞 {s.phone}</span>}
                  </div>
               </div>
               <div style={priceArea}>
                  <p style={turnoverPrice}>{getSupplierTurnover(s.id).toFixed(2)}€</p>
                  <div style={rowActions}>
                     <button onClick={() => handleEdit(s)} style={miniBtn}><Edit2 size={12}/></button>
                     <button onClick={() => toggleActive(s)} style={miniBtn}>{s.is_active ? '🚫' : '✅'}</button>
                     <button onClick={() => handleDelete(s.id)} style={{...miniBtn, color: colors.danger}}><Trash2 size={12}/></button>
                  </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- FUTURISTIC STYLES ---
const mainContainer: any = { minHeight: '100dvh', padding: '20px', background: 'radial-gradient(circle at top right, #1e1b4b, #0a0a0c)' }
const contentWrapper: any = { maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }

const headerSection: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }
const brandBox = { display: 'flex', alignItems: 'center', gap: '15px' }
const logoGlow = { width: '50px', height: '50px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' }
const mainTitle = { margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px' }
const subTitle = { margin: 0, fontSize: '10px', color: colors.accent, fontWeight: 700, letterSpacing: '2px' }
const closeBtn: any = { color: colors.textDim, background: colors.glass, width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }

const actionRow: any = { display: 'flex', gap: '10px', marginBottom: '30px' }
const primaryActionBtn: any = { flex: 1, height: '55px', background: colors.accent, color: 'white', border: 'none', borderRadius: '18px', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer' }
const toggleBtn = (active: boolean): any => ({ width: '55px', height: '55px', background: active ? colors.textMain : colors.glass, color: active ? colors.bg : 'white', border: `1px solid ${colors.glassBorder}`, borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' })

const formWrapper: any = { padding: '25px', borderRadius: '24px', marginBottom: '30px' }
const formHeader = { marginTop: 0, marginBottom: '20px', fontSize: '16px', fontWeight: 700, color: colors.accent }
const inputGroup = { marginBottom: '15px' }
const microLabel = { fontSize: '9px', fontWeight: 800, color: colors.textDim, display: 'block', marginBottom: '6px', letterSpacing: '1px' }
const inputField: any = { width: '100%', background: 'rgba(0,0,0,0.2)', border: `1px solid ${colors.glassBorder}`, padding: '14px', borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none' }
const selectField: any = { ...inputField, appearance: 'none' }
const rowGrid = { display: 'flex', gap: '12px', marginBottom: '15px' }
const submitBtn: any = { width: '100%', height: '50px', background: 'white', color: 'black', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', marginTop: '10px' }

const listArea = { marginTop: '20px' }
const listHead = { display: 'flex', justifyContent: 'space-between', padding: '0 20px 10px', fontSize: '10px', fontWeight: 800, color: colors.textDim, letterSpacing: '1px' }
const rowItem: any = { padding: '18px 20px', borderRadius: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }
const rowName = { margin: 0, fontSize: '15px', fontWeight: 700, letterSpacing: '-0.2px' }
const tagRow = { display: 'flex', gap: '8px', marginTop: '6px' }
const categoryTag = { fontSize: '9px', fontWeight: 700, background: 'rgba(99, 102, 241, 0.1)', color: colors.accent, padding: '3px 8px', borderRadius: '6px' }
const contactTag = { fontSize: '9px', fontWeight: 600, color: colors.textDim }

const priceArea = { textAlign: 'right' as any }
const turnoverPrice = { margin: 0, fontSize: '18px', fontWeight: 800, color: colors.success }
const rowActions = { display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end' }
const miniBtn: any = { background: 'rgba(255,255,255,0.05)', border: 'none', width: '30px', height: '30px', borderRadius: '8px', color: colors.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }

const loaderStyle: any = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, letterSpacing: '2px', color: colors.accent }

export default function SuppliersPage() {
  return <main><Suspense fallback={null}><SuppliersContent /></Suspense></main>
}
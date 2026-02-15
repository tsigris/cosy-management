'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Trash2, Edit2, Eye, EyeOff, X, Plus } from 'lucide-react'
import { toast, Toaster } from 'sonner'

// --- ΕΠΑΝΑΦΟΡΑ ΣΤΗΝ ΑΡΧΙΚΗ ΠΑΛΕΤΑ ---
const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentGreen: '#10b981',
  accentRed: '#f43f5e',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff'
};

function SuppliersContent() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  // Form State
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

  if (loading) return <div style={{padding:'40px', textAlign:'center', color: colors.secondaryText}}>Φόρτωση...</div>

  return (
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />
      
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
          <Link href="/" style={backBtn}>✕</Link>
        </header>

        {/* TOP CONTROLS */}
        <div style={controlsRow}>
          <button onClick={() => setIsFormOpen(!isFormOpen)} style={addBtn}>
            {isFormOpen ? 'ΑΚΥΡΩΣΗ' : <><Plus size={16} /> ΠΡΟΣΘΗΚΗ</>}
          </button>
          <button onClick={() => setShowInactive(!showInactive)} style={filterBtn(showInactive)}>
            {showInactive ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        </div>

        {/* FORM CARD */}
        {isFormOpen && (
          <div style={formCard}>
            <label style={labelStyle}>ΕΠΩΝΥΜΙΑ</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Όνομα..." style={inputStyle} />
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} inputMode="tel" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Α.Φ.Μ.</label>
                <input maxLength={9} value={afm} onChange={(e) => setAfm(e.target.value)} style={inputStyle} inputMode="numeric" />
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={labelStyle}>IBAN</label>
              <input value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="GR..." style={inputStyle} />
            </div>

            <label style={{ ...labelStyle, marginTop: '12px' }}>ΚΑΤΗΓΟΡΙΑ</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              <option value="Εμπορεύματα">🛒 Εμπορεύματα</option>
              <option value="Πάγια">🏢 Πάγια / Λογαριασμοί</option>
              <option value="Λοιπά">📦 Λοιπά Έξοδα</option>
            </select>

            <button onClick={handleSave} disabled={isSaving} style={saveBtn}>
              {isSaving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΚΑΤΑΧΩΡΗΣΗ')}
            </button>
          </div>
        )}

        {/* LIST AREA */}
        <div style={listArea}>
          {visibleSuppliers.map((s, idx) => (
            <div key={s.id} style={{ 
              ...rowWrapper, 
              borderBottom: idx === visibleSuppliers.length - 1 ? 'none' : `1px solid ${colors.border}`,
              opacity: s.is_active === false ? 0.6 : 1
            }}>
              <div style={{ flex: 1 }}>
                <p style={rowName}>{s.name.toUpperCase()}</p>
                <div style={rowMeta}>
                  <span style={categoryBadge}>{s.category}</span>
                  {s.phone && <span style={metaText}>📞 {s.phone}</span>}
                </div>
                
                <div style={actionButtonsRow}>
                  <button onClick={() => handleEdit(s)} style={actionBtn}>Επεξεργασία</button>
                  <button onClick={() => toggleActive(s)} style={actionBtn}>{s.is_active ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}</button>
                  <button onClick={() => handleDelete(s.id)} style={{...actionBtn, color: colors.accentRed}}>Διαγραφή</button>
                </div>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <p style={turnoverText}>{getSupplierTurnover(s.id).toFixed(2)}€</p>
                <p style={microLabel}>ΤΖΙΡΟΣ</p>
              </div>
            </div>
          ))}
          {visibleSuppliers.length === 0 && !isFormOpen && (
            <p style={emptyText}>Δεν βρέθηκαν συνεργάτες</p>
          )}
        </div>
      </div>
    </div>
  )
}

// --- CLEAN BUSINESS STYLES ---
const containerStyle: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px' };
const contentWrapper: any = { maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' };

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const logoBox: any = { width: '40px', height: '40px', backgroundColor: colors.primaryDark, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '18px' };
const titleStyle: any = { fontSize: '20px', fontWeight: '800', color: colors.primaryDark, margin: 0 };
const subtitleStyle: any = { fontSize: '10px', fontWeight: '700', color: colors.secondaryText, margin: 0, letterSpacing: '0.5px' };
const backBtn: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', fontWeight: 'bold' };

const controlsRow: any = { display: 'flex', gap: '8px', marginBottom: '20px' };
const addBtn: any = { flex: 1, backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' };
const filterBtn = (active: boolean): any => ({ width: '45px', backgroundColor: active ? colors.primaryDark : 'white', color: active ? 'white' : colors.primaryDark, border: `1px solid ${colors.border}`, borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' });

const formCard: any = { backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: `1px solid ${colors.border}`, marginBottom: '25px' };
const inputStyle: any = { width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${colors.border}`, backgroundColor: colors.bgLight, fontSize: '14px', fontWeight: '600', outline: 'none', boxSizing: 'border-box' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '4px', display: 'block' };
const saveBtn: any = { width: '100%', padding: '14px', backgroundColor: colors.accentGreen, color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', marginTop: '15px' };

const listArea: any = { backgroundColor: 'white', borderRadius: '20px', border: `1px solid ${colors.border}`, overflow: 'hidden' };
const rowWrapper: any = { display: 'flex', padding: '16px', alignItems: 'flex-start' };
const rowName: any = { fontSize: '14px', fontWeight: '800', color: colors.primaryDark, margin: 0 };
const rowMeta: any = { display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' };
const categoryBadge: any = { fontSize: '9px', fontWeight: '700', color: colors.secondaryText, backgroundColor: colors.bgLight, padding: '2px 6px', borderRadius: '4px' };
const metaText: any = { fontSize: '10px', color: colors.secondaryText, fontWeight: '600' };
const actionButtonsRow: any = { display: 'flex', gap: '12px', marginTop: '12px' };
const actionBtn: any = { background: 'none', border: 'none', padding: 0, fontSize: '11px', fontWeight: '700', color: colors.secondaryText, cursor: 'pointer', textDecoration: 'underline' };

const turnoverText: any = { fontSize: '16px', fontWeight: '800', color: colors.accentGreen, margin: 0 };
const microLabel: any = { fontSize: '8px', fontWeight: '800', color: colors.secondaryText, margin: 0 };
const emptyText: any = { textAlign: 'center', padding: '30px', color: colors.secondaryText, fontSize: '13px' };

export default function SuppliersPage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><SuppliersContent /></Suspense></main>
}
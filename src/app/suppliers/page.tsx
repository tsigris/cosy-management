'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Trash2, Edit2, Eye, EyeOff, Plus, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'
import { toast, Toaster } from 'sonner'

const colors = {
  primaryDark: '#0f172a',
  secondaryText: '#64748b',
  accentGreen: '#10b981',
  accentRed: '#f43f5e',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  warning: '#fffbeb',
  warningText: '#92400e'
};

function SuppliersContent() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [afm, setAfm] = useState('') 
  const [iban, setIban] = useState('')
  const [category, setCategory] = useState('Εμπορεύματα')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 1. ΦΟΡΤΩΣΗ ΔΕΔΟΜΕΝΩΝ ΜΕ ΑΥΣΤΗΡΟ ΦΙΛΤΡΟ STORE_ID
  const fetchSuppliersData = useCallback(async () => {
    try {
      setLoading(true)
      const activeStoreId = localStorage.getItem('active_store_id');
      
      if (!activeStoreId) {
        setLoading(false)
        return
      }

      const [sRes, tRes] = await Promise.all([
        supabase.from('suppliers')
          .select('*')
          .eq('store_id', activeStoreId),
        supabase.from('transactions')
          .select('amount, supplier_id')
          .eq('store_id', activeStoreId)
      ]);

      if (sRes.error) throw sRes.error;

      setSuppliers(sRes.data || []);
      setTransactions(tRes.data || []);
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error('Σφάλμα φόρτωσης');
    } finally {
      setLoading(false);
    }
  }, [])

  useEffect(() => { 
    fetchSuppliersData() 
  }, [fetchSuppliersData])

  const getSupplierTurnover = (supplierId: string) => {
    return transactions
      .filter(t => t.supplier_id === supplierId)
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  }

  const visibleSuppliers = suppliers
    .filter(s => showInactive ? true : s.is_active !== false)
    .sort((a, b) => getSupplierTurnover(b.id) - getSupplierTurnover(a.id));

  // 2. ΑΠΟΘΗΚΕΥΣΗ ΜΕ ΔΥΝΑΜΙΚΟ STORE_ID
  async function handleSave() {
    const currentStoreId = localStorage.getItem('active_store_id');
    
    if (!name.trim()) return toast.error('Συμπληρώστε το όνομα');
    if (!currentStoreId) {
        toast.error('Σφάλμα: Δεν βρέθηκε ενεργό κατάστημα. Παρακαλώ ξαναεπιλέξτε κατάστημα από την αρχική.');
        return;
    }

    setIsSaving(true);
    try {
      const supplierData = {
        name: name.trim(),
        phone: phone.trim(),
        vat_number: afm.trim(),
        iban: iban.trim(),
        category: category,
        store_id: currentStoreId // Χρησιμοποιεί το ID τη στιγμή της καταχώρησης
      };

      const { error } = editingId
        ? await supabase.from('suppliers').update(supplierData).eq('id', editingId)
        : await supabase.from('suppliers').insert([{ ...supplierData, is_active: true }]);

      if (error) throw error;
      
      toast.success('Αποθηκεύτηκε επιτυχώς!');
      resetForm(); 
      fetchSuppliersData();
    } catch (error: any) { 
      toast.error('Σφάλμα: ' + error.message); 
    } finally { 
      setIsSaving(false); 
    }
  }

  async function toggleActive(supplier: any) {
    try {
      const { error } = await supabase.from('suppliers').update({ is_active: !supplier.is_active }).eq('id', supplier.id);
      if (error) throw error;
      fetchSuppliersData();
    } catch (err: any) { toast.error('Σφάλμα'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Οριστική διαγραφή;')) return;
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      fetchSuppliersData();
      toast.success('Διαγράφηκε');
    } catch (err: any) { toast.error('Σφάλμα'); }
  }

  const handleEdit = (s: any) => {
    setEditingId(s.id); setName(s.name); setPhone(s.phone || '');
    setAfm(s.vat_number || ''); setIban(s.iban || '');
    setCategory(s.category || 'Εμπορεύματα'); setIsFormOpen(true);
    setExpandedId(null);
  }

  const resetForm = () => {
    setName(''); setPhone(''); setAfm(''); setIban(''); setCategory('Εμπορεύματα');
    setEditingId(null); setIsFormOpen(false);
  }

  if (loading) return <div style={{padding:'50px', textAlign:'center', color: colors.secondaryText, fontWeight:'800'}}>ΦΟΡΤΩΣΗ...</div>

  return (
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />
      <div style={contentWrapper}>
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBox}>🛒</div>
            <div>
              <h1 style={titleStyle}>Προμηθευτές</h1>
              <p style={subtitleStyle}>ΔΙΑΧΕΙΡΙΣΗ ΑΝΑ ΚΑΤΑΣΤΗΜΑ</p>
            </div>
          </div>
          <Link href="/" style={backBtn}>✕</Link>
        </header>

        <div style={controlsRow}>
          <button onClick={() => { if(isFormOpen) resetForm(); setIsFormOpen(!isFormOpen); }} style={addBtn}>
            {isFormOpen ? 'ΑΚΥΡΩΣΗ' : <><Plus size={16} /> ΠΡΟΣΘΗΚΗ</>}
          </button>
          <button onClick={() => setShowInactive(!showInactive)} style={filterBtn(showInactive)}>
            {showInactive ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        </div>

        {isFormOpen && (
          <div style={formCard}>
            <label style={labelStyle}>ΕΠΩΝΥΜΙΑ</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Όνομα..." style={inputStyle} />
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <div style={{ flex: 1 }}><label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label><input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} inputMode="tel" /></div>
              <div style={{ flex: 1 }}><label style={labelStyle}>Α.Φ.Μ.</label><input maxLength={9} value={afm} onChange={(e) => setAfm(e.target.value)} style={inputStyle} inputMode="numeric" /></div>
            </div>
            <div style={{ marginTop: '12px' }}><label style={labelStyle}>IBAN</label><input value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="GR..." style={inputStyle} /></div>
            <label style={{ ...labelStyle, marginTop: '12px' }}>ΚΑΤΗΓΟΡΙΑ</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              <option value="Εμπορεύματα">🛒 Εμπορεύματα</option>
              <option value="Πάγια">🏢 Πάγια / Λογαριασμοί</option>
              <option value="Λοιπά">📦 Λοιπά Έξοδα</option>
            </select>
            <button onClick={handleSave} disabled={isSaving} style={saveBtn}>{isSaving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΚΑΤΑΧΩΡΗΣΗ')}</button>
          </div>
        )}

        <div style={listArea}>
          <div style={rankingHeader}><TrendingUp size={14} /> Η ΛΙΣΤΑ ΣΟΥ</div>
          {visibleSuppliers.map((s, idx) => (
            <div key={s.id} style={{ borderBottom: `1px solid ${colors.border}`, opacity: s.is_active === false ? 0.6 : 1 }}>
              <div style={rowWrapper} onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                <div style={rankNumber}>{idx + 1}</div>
                <div style={{ flex: 1 }}>
                  <p style={rowName}>{s.name.toUpperCase()}</p>
                  <div style={rowMeta}><span style={categoryBadge}>{s.category}</span></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <p style={turnoverText}>{getSupplierTurnover(s.id).toFixed(2)}€</p>
                </div>
              </div>
              {expandedId === s.id && (
                <div style={actionPanel}>
                  <button onClick={() => handleEdit(s)} style={panelBtnEdit}>✎ Edit</button>
                  <button onClick={() => toggleActive(s)} style={panelBtnActive}>{s.is_active ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => handleDelete(s.id)} style={panelBtnDelete}>🗑 Delete</button>
                </div>
              )}
            </div>
          ))}
          {visibleSuppliers.length === 0 && (
              <div style={{padding:'40px', textAlign:'center', color: colors.secondaryText}}>
                  Δεν υπάρχουν προμηθευτές για αυτό το κατάστημα.
              </div>
          )}
        </div>
      </div>
    </div>
  )
}

// STYLES
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
const rankingHeader: any = { padding: '12px 16px', backgroundColor: colors.bgLight, fontSize: '10px', fontWeight: '800', color: colors.secondaryText, display: 'flex', alignItems: 'center', gap: '6px', borderBottom: `1px solid ${colors.border}` };
const rowWrapper: any = { display: 'flex', padding: '16px', alignItems: 'center', cursor: 'pointer' };
const rankNumber: any = { width: '24px', height: '24px', backgroundColor: colors.bgLight, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', color: colors.secondaryText, marginRight: '12px' };
const rowName: any = { fontSize: '14px', fontWeight: '800', color: colors.primaryDark, margin: 0 };
const rowMeta: any = { display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' };
const categoryBadge: any = { fontSize: '9px', fontWeight: '700', color: colors.secondaryText, backgroundColor: colors.bgLight, padding: '2px 6px', borderRadius: '4px' };
const turnoverText: any = { fontSize: '16px', fontWeight: '800', color: colors.accentGreen, margin: 0 };
const actionPanel: any = { display: 'flex', gap: '8px', padding: '12px 16px', backgroundColor: '#f8fafc', borderTop: `1px solid ${colors.border}`, justifyContent: 'space-between' };
const panelBtnBase: any = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', border: 'none', cursor: 'pointer' };
const panelBtnEdit: any = { ...panelBtnBase, backgroundColor: colors.warning, color: colors.warningText };
const panelBtnActive: any = { ...panelBtnBase, backgroundColor: colors.white, color: colors.primaryDark, border: `1px solid ${colors.border}` };
const panelBtnDelete: any = { ...panelBtnBase, backgroundColor: '#fee2e2', color: colors.accentRed };

export default function SuppliersPage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><SuppliersContent /></Suspense></main>
}
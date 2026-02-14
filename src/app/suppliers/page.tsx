'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Copy, Check, Power, PowerOff, Trash2, Edit2 } from 'lucide-react'
import { toast, Toaster } from 'sonner'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff'
};

function SuppliersContent() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [afm, setAfm] = useState('') 
  const [iban, setIban] = useState('')
  const [category, setCategory] = useState('Εμπορεύματα')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchSuppliersData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return;

      const { data: profile } = await supabase.from('profiles')
        .select('store_id')
        .eq('id', session.user.id)
        .single()
      
      if (profile?.store_id) {
        setStoreId(profile.store_id)
        const [sData, tData] = await Promise.all([
          supabase.from('suppliers').select('*').eq('store_id', profile.store_id).order('name'),
          supabase.from('transactions').select('amount, supplier_id').eq('store_id', profile.store_id)
        ])
        setSuppliers(sData.data || [])
        setTransactions(tData.data || [])
      }
    } catch (err) {
      console.error("Fetch error:", err)
    } finally {
      setLoading(false)
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

  const handleCopyIban = (ibanText: string, id: string) => {
    navigator.clipboard.writeText(ibanText);
    setCopiedId(id);
    toast.success("IBAN Αντιγράφηκε!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function toggleActive(supplier: any) {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active: !supplier.is_active })
        .eq('id', supplier.id);
      if (error) throw error;
      toast.success(supplier.is_active ? 'Απενεργοποιήθηκε' : 'Ενεργοποιήθηκε');
      fetchSuppliersData();
    } catch (err: any) {
      toast.error('Σφάλμα: ' + err.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Είστε σίγουροι; Η διαγραφή είναι οριστική και μπορεί να επηρεάσει το ιστορικό των συναλλαγών.')) return;
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      toast.success('Ο προμηθευτής διαγράφηκε');
      fetchSuppliersData();
    } catch (err: any) {
      toast.error('Σφάλμα κατά τη διαγραφή');
    }
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
    } catch (error: any) {
      toast.error('Σφάλμα: ' + error.message)
    } finally {
      setIsSaving(false)
    }
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

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: colors.secondaryText }}>Φόρτωση...</div>

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '120px' }}>
        
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>🛒</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '24px', margin: 0, color: colors.primaryDark }}>Προμηθευτές</h1>
              <p style={{ margin: 0, fontSize: '11px', color: colors.secondaryText, fontWeight: '600' }}>ΣΥΝΕΡΓΑΤΕΣ ({suppliers.length})</p>
            </div>
          </div>
          <Link href="/" style={backBtnStyle}>✕</Link>
        </div>

        <button onClick={() => { if(isFormOpen) resetForm(); setIsFormOpen(!isFormOpen); }} style={isFormOpen ? cancelBtnStyle : addBtnStyle}>
          {isFormOpen ? 'ΑΚΥΡΩΣΗ' : '+ ΝΕΟΣ ΠΡΟΜΗΘΕΥΤΗΣ'}
        </button>

        {isFormOpen && (
          <div style={formCard}>
            <label style={labelStyle}>ΕΠΩΝΥΜΙΑ</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Όνομα..." style={inputStyle} />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <div style={{ flex: 1 }}><label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label><input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} inputMode="tel" /></div>
              <div style={{ flex: 1 }}><label style={labelStyle}>Α.Φ.Μ.</label><input maxLength={9} value={afm} onChange={(e) => setAfm(e.target.value)} style={inputStyle} inputMode="numeric" /></div>
            </div>
            <div style={{ marginTop: '16px' }}><label style={labelStyle}>IBAN</label><input value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="GR..." style={inputStyle} /></div>
            <label style={{ ...labelStyle, marginTop: '16px' }}>ΚΑΤΗΓΟΡΙΑ</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              <option value="Εμπορεύματα">🛒 Εμπορεύματα</option>
              <option value="Πάγια">🏢 Πάγια / Λογαριασμοί</option>
              <option value="Λοιπά">📦 Λοιπά Έξοδα</option>
            </select>
            <button onClick={handleSave} disabled={isSaving} style={saveBtn}>{isSaving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΔΗΜΙΟΥΡΓΙΑ')}</button>
          </div>
        )}

        <div style={{ marginTop: '15px' }}>
          {suppliers.map(s => (
            <div key={s.id} style={{ marginBottom: '12px', opacity: s.is_active === false ? 0.5 : 1 }}>
              <div style={supplierItem}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '700', margin: 0, fontSize: '16px', color: colors.primaryDark }}>
                    {s.name.toUpperCase()} {s.is_active === false && <span style={{fontSize: '10px', color: colors.accentRed}}>(ΑΠΕΝΕΡΓΟΣ)</span>}
                  </p>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
                     <span style={badgeStyle}>{s.category}</span>
                     <span style={{ fontSize: '13px', color: colors.accentGreen, fontWeight: '700' }}>{getSupplierTurnover(s.id).toFixed(2)}€</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleEdit(s)} style={smallIconBtn}><Edit2 size={14}/></button>
                  <button onClick={() => toggleActive(s)} style={{...smallIconBtn, color: s.is_active ? colors.secondaryText : colors.accentGreen}}>{s.is_active ? '🚫' : '✅'}</button>
                  <button onClick={() => handleDelete(s.id)} style={{...smallIconBtn, color: colors.accentRed}}><Trash2 size={14}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// STYLES
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', overflowY: 'auto', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const logoBoxStyle: any = { width: '48px', height: '48px', backgroundColor: colors.primaryDark, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '22px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` };
const addBtnStyle: any = { width: '100%', padding: '16px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '700', fontSize: '14px', marginBottom: '25px' };
const cancelBtnStyle: any = { ...addBtnStyle, backgroundColor: colors.white, color: colors.secondaryText, border: `1px solid ${colors.border}` };
const formCard: any = { backgroundColor: colors.white, padding: '24px', borderRadius: '24px', border: `1px solid ${colors.border}`, marginBottom: '25px' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '6px', display: 'block' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '15px', fontWeight: '600', backgroundColor: colors.bgLight, boxSizing: 'border-box' };
const saveBtn: any = { width: '100%', padding: '16px', backgroundColor: colors.accentGreen, color: 'white', border: 'none', borderRadius: '14px', fontWeight: '700', fontSize: '15px', marginTop: '20px' };
const supplierItem: any = { backgroundColor: colors.white, padding: '16px 18px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${colors.border}` };
const badgeStyle: any = { fontSize: '10px', fontWeight: '700', backgroundColor: colors.bgLight, padding: '3px 8px', borderRadius: '6px', color: colors.secondaryText, border: `1px solid ${colors.border}` };
const smallIconBtn: any = { background: colors.bgLight, border: `1px solid ${colors.border}`, width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

export default function SuppliersPage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><SuppliersContent /></Suspense></main>
}
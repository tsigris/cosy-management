'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

// --- ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΠΑΛΕΤΑ ΧΡΩΜΑΤΩΝ ---
const colors = {
  primaryDark: '#1e293b', // Slate 800
  secondaryText: '#64748b', // Slate 500
  accentGreen: '#059669', // Emerald 600
  accentRed: '#dc2626',   // Red 600
  bgLight: '#f8fafc',     // Slate 50
  border: '#e2e8f0',      // Slate 200
  white: '#ffffff'
};

function SuppliersContent() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)
  
  // Φόρμα & UI States
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [afm, setAfm] = useState('') 
  const [iban, setIban] = useState('') // Νέο state για IBAN
  const [category, setCategory] = useState('Εμπορεύματα')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showTransactions, setShowTransactions] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString('el-GR', {
        hour: '2-digit', minute: '2-digit', hour12: true
      })
    } catch (e) { return '--:--' }
  }

  const fetchSuppliersData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', session.user.id).maybeSingle()
      
      if (profile?.store_id) {
        setStoreId(profile.store_id)
        const [sData, tData] = await Promise.all([
          supabase.from('suppliers').select('*').eq('store_id', profile.store_id).order('name'),
          supabase.from('transactions').select('*').eq('store_id', profile.store_id).order('date', { ascending: false })
        ])
        setSuppliers(sData.data || [])
        setTransactions(tData.data || [])
      }
    } catch (err) {
      console.error("Wake up fetch failed:", err)
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

  async function handleSave() {
    if (!name) return alert('Συμπληρώστε το όνομα')
    setIsSaving(true)
    try {
      const supplierData = { 
        name, 
        phone, 
        vat_number: afm, 
        iban, // Προσθήκη IBAN στο payload
        category, 
        store_id: storeId 
      }
      if (editingId) {
        await supabase.from('suppliers').update(supplierData).eq('id', editingId)
      } else {
        await supabase.from('suppliers').insert([supplierData])
      }
      resetForm()
      fetchSuppliersData()
    } catch (error: any) {
      alert('Σφάλμα: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (s: any) => {
    setEditingId(s.id); setName(s.name); setPhone(s.phone || '');
    setAfm(s.vat_number || ''); setIban(s.iban || ''); // Φόρτωση IBAN
    setCategory(s.category || 'Εμπορεύματα');
    setIsFormOpen(true);
  }

  const resetForm = () => {
    setName(''); setPhone(''); setAfm(''); setIban(''); setCategory('Εμπορεύματα');
    setEditingId(null); setIsFormOpen(false);
  }

  return (
    <div style={iphoneWrapper}>
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '120px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>🛒</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '24px', margin: 0, color: colors.primaryDark }}>Προμηθευτές</h1>
              <p style={{ margin: 0, fontSize: '11px', color: colors.secondaryText, fontWeight: '600', letterSpacing: '1px' }}>ΣΥΝΕΡΓΑΤΕΣ ({suppliers.length})</p>
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
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Όνομα προμηθευτή" style={inputStyle} />

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} inputMode="tel" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Α.Φ.Μ.</label>
                <input maxLength={9} value={afm} onChange={(e) => setAfm(e.target.value)} style={inputStyle} inputMode="numeric" />
              </div>
            </div>

            {/* ΝΕΟ ΠΕΔΙΟ IBAN */}
            <div style={{ marginTop: '16px' }}>
              <label style={labelStyle}>IBAN ΠΡΟΜΗΘΕΥΤΗ</label>
              <input 
                value={iban} 
                onChange={(e) => setIban(e.target.value.toUpperCase())} 
                placeholder="GR00 0000 0000..." 
                style={inputStyle} 
              />
            </div>

            <label style={{ ...labelStyle, marginTop: '16px' }}>ΚΑΤΗΓΟΡΙΑ</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              <option value="Εμπορεύματα">🛒 Εμπορεύματα</option>
              <option value="Πάγια">🏢 Πάγια / Λογαριασμοί</option>
              <option value="Λοιπά">📦 Λοιπά Έξοδα</option>
            </select>

            <button onClick={handleSave} disabled={isSaving} style={saveBtn}>
              {isSaving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ ΣΤΟΙΧΕΙΩΝ' : 'ΔΗΜΙΟΥΡΓΙΑ ΠΡΟΜΗΘΕΥΤΗ')}
            </button>
          </div>
        )}

        <div style={{ marginTop: '15px' }}>
          {suppliers.map(s => (
            <div key={s.id} style={{ marginBottom: '12px' }}>
              <div style={supplierItem}>
                <div style={{ flex: 1 }} onClick={() => setShowTransactions(showTransactions === s.id ? null : s.id)}>
                  <p style={{ fontWeight: '700', margin: 0, fontSize: '16px', color: colors.primaryDark }}>{s.name.toUpperCase()}</p>
                  
                  {/* Εμφάνιση IBAN στην καρτέλα αν υπάρχει */}
                  {s.iban && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '10px', color: colors.secondaryText, fontWeight: '700', letterSpacing: '0.5px' }}>IBAN: {s.iban.substring(0,10)}...</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleCopyIban(s.iban, s.id); }} 
                        style={copyIconBtn}
                      >
                        {copiedId === s.id ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
                     <span style={badgeStyle}>{s.category}</span>
                     <span style={{ fontSize: '13px', color: colors.accentGreen, fontWeight: '700' }}>Τζίρος: {getSupplierTurnover(s.id).toFixed(2)}€</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleEdit(s)} style={iconBtnStyle}>✎</button>
                  <button onClick={async () => { if(confirm('Διαγραφή;')){ await supabase.from('suppliers').delete().eq('id', s.id); fetchSuppliersData(); } }} style={deleteBtnStyle}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- PROFESSIONAL STYLES ---
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const logoBoxStyle: any = { width: '48px', height: '48px', backgroundColor: colors.primaryDark, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '22px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', fontWeight: 'bold', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` };
const addBtnStyle: any = { width: '100%', padding: '16px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '700', fontSize: '14px', marginBottom: '25px', boxShadow: '0 4px 12px rgba(30, 41, 59, 0.2)' };
const cancelBtnStyle: any = { ...addBtnStyle, backgroundColor: colors.white, color: colors.secondaryText, boxShadow: 'none', border: `1px solid ${colors.border}` };
const formCard: any = { backgroundColor: colors.white, padding: '24px', borderRadius: '24px', border: `1px solid ${colors.border}`, marginBottom: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '6px', display: 'block', letterSpacing: '0.5px' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '15px', fontWeight: '600', backgroundColor: colors.bgLight, boxSizing: 'border-box', outline: 'none', color: colors.primaryDark };
const saveBtn: any = { width: '100%', padding: '16px', backgroundColor: colors.accentGreen, color: 'white', border: 'none', borderRadius: '14px', fontWeight: '700', fontSize: '15px', marginTop: '20px', boxShadow: '0 4px 10px rgba(5, 150, 105, 0.2)' };
const supplierItem: any = { backgroundColor: colors.white, padding: '18px 20px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${colors.border}`, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' };
const badgeStyle: any = { fontSize: '10px', fontWeight: '700', backgroundColor: colors.bgLight, padding: '3px 8px', borderRadius: '6px', color: colors.secondaryText, border: `1px solid ${colors.border}` };
const iconBtnStyle: any = { background: colors.bgLight, border: `1px solid ${colors.border}`, width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', color: colors.primaryDark };
const deleteBtnStyle: any = { ...iconBtnStyle, background: '#fef2f2', borderColor: '#fecaca', color: colors.accentRed };
const copyIconBtn: any = { background: colors.bgLight, border: 'none', padding: '4px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' };

export default function SuppliersPage() {
  return (
    <main><Suspense fallback={<div>Φόρτωση...</div>}><SuppliersContent /></Suspense></main>
  )
}
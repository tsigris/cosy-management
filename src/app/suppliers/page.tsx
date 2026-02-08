'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function SuppliersContent() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  
  // State για τη φόρμα
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [afm, setAfm] = useState('') 
  const [category, setCategory] = useState('Εμπορεύματα')
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showTransactions, setShowTransactions] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [storeId, setStoreId] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user.id).single()
      
      if (profile?.store_id) {
        setStoreId(profile.store_id)
        // Φιλτράρισμα βάσει store_id για ασφάλεια
        const [sData, tData] = await Promise.all([
          supabase.from('suppliers').select('*').eq('store_id', profile.store_id).order('name'),
          supabase.from('transactions').select('*').eq('store_id', profile.store_id).order('date', { ascending: false })
        ])
        if (sData.data) setSuppliers(sData.data)
        if (tData.data) setTransactions(tData.data)
      }
    } catch (err) { console.error(err) }
  }

  const getSupplierTurnover = (supplierId: string) => {
    return transactions
      .filter(t => t.supplier_id === supplierId)
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  }

  async function handleSave() {
    if (!name) return alert('Συμπληρώστε το όνομα')
    
    // ΕΛΕΓΧΟΣ ΑΦΜ (9 ΨΗΦΙΑ)
    if (afm && (afm.length !== 9 || isNaN(Number(afm)))) {
      return alert('Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία.')
    }

    setLoading(true)
    try {
      const supplierData = { 
        name, 
        phone, 
        vat_number: afm, 
        category,
        store_id: storeId 
      }

      if (editingId) {
        const { error } = await supabase.from('suppliers').update(supplierData).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('suppliers').insert([supplierData])
        if (error) throw error
      }

      resetForm()
      fetchData()
    } catch (error: any) {
      alert('Σφάλμα: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (s: any) => {
    setEditingId(s.id); 
    setName(s.name); 
    setPhone(s.phone || '');
    setAfm(s.vat_number || ''); 
    setCategory(s.category || 'Εμπορεύματα');
    setIsFormOpen(true);
    window.scrollTo(0, 0);
  }

  const resetForm = () => {
    setName(''); setPhone(''); setAfm(''); setCategory('Εμπορεύματα');
    setEditingId(null); setIsFormOpen(false);
  }

  const getPaymentIcon = (method: string) => {
    if (method === 'Μετρητά') return '💵'
    if (method === 'Κάρτα' || method === 'POS') return '💳'
    return '🏦'
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* PROFESSIONAL GRAPHIC HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>
            <span style={{ fontSize: '20px' }}>🛒</span>
          </div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
              Προμηθευτές
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ΔΙΑΧΕΙΡΙΣΗ ΣΥΝΕΡΓΑΤΩΝ
            </p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      <button 
        onClick={() => { if(isFormOpen) resetForm(); setIsFormOpen(!isFormOpen); }} 
        style={isFormOpen ? cancelBtnStyle : addBtnStyle}
      >
        {isFormOpen ? 'ΑΚΥΡΩΣΗ' : '+ ΝΕΟΣ ΠΡΟΜΗΘΕΥΤΗΣ'}
      </button>

      {isFormOpen && (
        <div style={{ ...formCard, border: editingId ? '2px solid #f59e0b' : '2px solid #0f172a' }}>
          <p style={labelStyle}>ΕΠΩΝΥΜΙΑ ΠΡΟΜΗΘΕΥΤΗ</p>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="π.χ. Coffee Experts" />

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <div style={{ flex: 1 }}><p style={labelStyle}>ΤΗΛΕΦΩΝΟ</p><input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="210..." /></div>
            <div style={{ flex: 1 }}><p style={labelStyle}>Α.Φ.Μ. (9 ΨΗΦΙΑ)</p><input maxLength={9} value={afm} onChange={(e) => setAfm(e.target.value)} style={inputStyle} placeholder="123456789" /></div>
          </div>

          <p style={{ ...labelStyle, marginTop: '16px' }}>ΚΑΤΗΓΟΡΙΑ</p>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            <option value="Εμπορεύματα">🛒 Εμπορεύματα</option>
            <option value="Πάγια">🏢 Πάγια / Λογαριασμοί</option>
            <option value="Λοιπά">📦 Λοιπά Έξοδα</option>
          </select>

          <button onClick={handleSave} disabled={loading} style={{ ...saveBtn, backgroundColor: editingId ? '#f59e0b' : '#0f172a' }}>
            {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ ΣΤΟΙΧΕΙΩΝ' : 'ΔΗΜΙΟΥΡΓΙΑ ΠΡΟΜΗΘΕΥΤΗ')}
          </button>
        </div>
      )}

      <div style={{ marginTop: '12px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase' }}>ΛΙΣΤΑ ΣΥΝΕΡΓΑΤΩΝ ({suppliers.length})</p>
        {suppliers.map(s => (
          <div key={s.id} style={{ marginBottom: '12px' }}>
            <div style={supplierItem}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setShowTransactions(showTransactions === s.id ? null : s.id)}>
                <p style={{ fontWeight: '800', margin: 0, fontSize: '15px', color: '#1e293b' }}>{s.name.toUpperCase()}</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                   <span style={badgeStyle}>{s.category || 'Εμπορεύματα'}</span>
                   <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Τζίρος: {getSupplierTurnover(s.id).toFixed(2)}€</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => handleEdit(s)} style={editBtnStyle}>✎</button>
                <button onClick={() => { if(confirm('Διαγραφή;')) { supabase.from('suppliers').delete().eq('id', s.id).then(() => fetchData()); } }} style={deleteBtnStyle}>🗑️</button>
              </div>
            </div>

            {showTransactions === s.id && (
              <div style={transList}>
                <p style={{ fontSize: '10px', fontWeight: '900', color: '#64748b', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>ΙΣΤΟΡΙΚΟ ΣΥΝΑΛΛΑΓΩΝ</p>
                {transactions.filter(t => t.supplier_id === s.id).length > 0 ? (
                  transactions.filter(t => t.supplier_id === s.id).map(t => (
                    <div key={t.id} style={transItem}>
                      <span style={{ color: '#64748b' }}>{t.date.split('T')[0]}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>{getPaymentIcon(t.method)}</span>
                        <span style={{ fontWeight: '800', color: '#1e293b' }}>{Number(t.amount).toFixed(2)}€</span>
                      </div>
                    </div>
                  ))
                ) : <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>Δεν υπάρχουν κινήσεις</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// STYLES (Fixed for TypeScript compatibility)
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' };
const addBtnStyle: any = { width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '13px', cursor: 'pointer', marginBottom: '20px' };
const cancelBtnStyle: any = { ...addBtnStyle, backgroundColor: '#f1f5f9', color: '#64748b' };
const formCard: any = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
const labelStyle: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '15px', fontWeight: 'bold', boxSizing: 'border-box' };
const saveBtn: any = { width: '100%', padding: '16px', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', marginTop: '20px' };
const supplierItem: any = { backgroundColor: 'white', padding: '16px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9' };
const badgeStyle: any = { fontSize: '9px', fontWeight: '800', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', color: '#64748b' };
const editBtnStyle: any = { background: '#fef3c7', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer' };
const deleteBtnStyle: any = { background: '#fee2e2', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer' };
const transList: any = { backgroundColor: 'white', padding: '16px', borderRadius: '0 0 20px 20px', marginTop: '-10px', border: '1px solid #f1f5f9', borderTop: 'none' };
const transItem: any = { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0', borderBottom: '1px dotted #e2e8f0' };

export default function SuppliersPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><SuppliersContent /></Suspense>
    </main>
  )
}
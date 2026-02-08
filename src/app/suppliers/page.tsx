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

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user.id).single()
      
      if (profile?.store_id) {
        setStoreId(profile.store_id)
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
    if (afm && (afm.length !== 9 || isNaN(Number(afm)))) {
      return alert('Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία.')
    }

    setLoading(true)
    try {
      const supplierData = { 
        name, phone, vat_number: afm, category, store_id: storeId 
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const resetForm = () => {
    setName(''); setPhone(''); setAfm(''); setCategory('Εμπορεύματα');
    setEditingId(null); setIsFormOpen(false);
  }

  const handleDelete = async (id: string) => {
    if (confirm('Θέλετε να διαγράψετε αυτόν τον προμηθευτή;')) {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (!error) fetchData()
      else alert(error.message)
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', paddingBottom: '100px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', paddingTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={logoBoxStyle}>🛒</div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '24px', margin: 0, color: '#0f172a' }}>Προμηθευτές</h1>
            <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: '800', letterSpacing: '1px' }}>ΔΙΑΧΕΙΡΙΣΗ ΣΥΝΕΡΓΑΤΩΝ</p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      <button onClick={() => { if(isFormOpen) resetForm(); setIsFormOpen(!isFormOpen); }} style={isFormOpen ? cancelBtnStyle : addBtnStyle}>
        {isFormOpen ? 'ΑΚΥΡΩΣΗ' : '+ ΝΕΟΣ ΠΡΟΜΗΘΕΥΤΗΣ'}
      </button>

      {/* ΦΟΡΜΑ */}
      {isFormOpen && (
        <div style={{ ...formCard, border: editingId ? '1px solid #f59e0b' : '1px solid #e2e8f0' }}>
          <label>ΕΠΩΝΥΜΙΑ ΠΡΟΜΗΘΕΥΤΗ</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="π.χ. Coffee Experts" />

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <div style={{ flex: 1 }}>
              <label>ΤΗΛΕΦΩΝΟ</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="210..." />
            </div>
            <div style={{ flex: 1 }}>
              <label>Α.Φ.Μ. (9 ΨΗΦΙΑ)</label>
              <input maxLength={9} value={afm} onChange={(e) => setAfm(e.target.value)} placeholder="123456789" />
            </div>
          </div>

          <label style={{ marginTop: '16px' }}>ΚΑΤΗΓΟΡΙΑ</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%' }}>
            <option value="Εμπορεύματα">🛒 Εμπορεύματα</option>
            <option value="Πάγια">🏢 Πάγια / Λογαριασμοί</option>
            <option value="Λοιπά">📦 Λοιπά Έξοδα</option>
          </select>

          <button onClick={handleSave} disabled={loading} style={{ ...saveBtn, backgroundColor: editingId ? '#f59e0b' : '#0f172a' }}>
            {loading ? 'ΦΟΡΤΩΣΗ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ ΣΤΟΙΧΕΙΩΝ' : 'ΔΗΜΙΟΥΡΓΙΑ ΠΡΟΜΗΘΕΥΤΗ')}
          </button>
        </div>
      )}

      {/* ΛΙΣΤΑ */}
      <div style={{ marginTop: '15px' }}>
        <p style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', marginBottom: '15px', letterSpacing: '0.5px' }}>ΛΙΣΤΑ ΣΥΝΕΡΓΑΤΩΝ ({suppliers.length})</p>
        
        {suppliers.map(s => (
          <div key={s.id} style={{ marginBottom: '12px' }}>
            <div style={supplierItem}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setShowTransactions(showTransactions === s.id ? null : s.id)}>
                <p style={{ fontWeight: '800', margin: 0, fontSize: '16px', color: '#0f172a' }}>{s.name.toUpperCase()}</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '5px' }}>
                   <span style={badgeStyle}>{s.category || 'Εμπορεύματα'}</span>
                   <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: '800' }}>Τζίρος: {getSupplierTurnover(s.id).toFixed(2)}€</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleEdit(s)} style={iconBtnStyle}>✎</button>
                <button onClick={() => handleDelete(s.id)} style={deleteBtnStyle}>🗑️</button>
              </div>
            </div>

            {/* ΙΣΤΟΡΙΚΟ */}
            {showTransactions === s.id && (
              <div style={transList}>
                <p style={transHeader}>ΙΣΤΟΡΙΚΟ ΣΥΝΑΛΛΑΓΩΝ</p>
                {transactions.filter(t => t.supplier_id === s.id).length > 0 ? (
                  transactions.filter(t => t.supplier_id === s.id).map(t => (
                    <div key={t.id} style={transItem}>
                      <span style={{ color: '#475569', fontWeight: '700' }}>{t.date.split('T')[0]}</span>
                      <span style={{ fontWeight: '800', color: '#0f172a' }}>{Number(t.amount).toFixed(2)}€</span>
                    </div>
                  ))
                ) : <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '10px' }}>Δεν υπάρχουν κινήσεις</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// PREMIUM STYLES
const logoBoxStyle: any = { width: '48px', height: '48px', backgroundColor: '#0f172a', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '22px', boxShadow: '0 8px 16px rgba(15, 23, 42, 0.1)' };
const backBtnStyle: any = { textDecoration: 'none', color: '#64748b', fontSize: '18px', fontWeight: 'bold', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const addBtnStyle: any = { width: '100%', padding: '18px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '20px', fontWeight: '800', fontSize: '14px', marginBottom: '25px', boxShadow: '0 8px 16px rgba(15, 23, 42, 0.15)' };
const cancelBtnStyle: any = { ...addBtnStyle, backgroundColor: '#f1f5f9', color: '#64748b', boxShadow: 'none', border: '1px solid #e2e8f0' };
const formCard: any = { backgroundColor: 'white', padding: '24px', borderRadius: '28px', border: '1px solid #f1f5f9', marginBottom: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' };
const saveBtn: any = { width: '100%', padding: '18px', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '15px', marginTop: '20px' };
const supplierItem: any = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f8fafc', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' };
const badgeStyle: any = { fontSize: '10px', fontWeight: '800', backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '8px', color: '#475569' };
const iconBtnStyle: any = { background: '#f8fafc', border: '1px solid #e2e8f0', width: '38px', height: '38px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', color: '#475569' };
const deleteBtnStyle: any = { ...iconBtnStyle, background: '#fee2e2', borderColor: '#fecaca', color: '#dc2626' };
const transList: any = { backgroundColor: 'white', padding: '20px', borderRadius: '0 0 24px 24px', marginTop: '-15px', border: '1px solid #f1f5f9', borderTop: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' };
const transHeader: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '12px', borderBottom: '1px solid #f8fafc', paddingBottom: '5px', letterSpacing: '0.5px' };
const transItem: any = { display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '10px 0', borderBottom: '1px dashed #f1f5f9' };

export default function SuppliersPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><SuppliersContent /></Suspense>
    </main>
  )
}
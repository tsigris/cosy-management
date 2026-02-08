'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function SuppliersContent() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  
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
    if (afm && afm.length !== 9) return alert('Το ΑΦΜ πρέπει να έχει 9 ψηφία.')

    setLoading(true)
    try {
      const supplierData = { name, phone, vat_number: afm, category, store_id: storeId }
      if (editingId) {
        await supabase.from('suppliers').update(supplierData).eq('id', editingId)
      } else {
        await supabase.from('suppliers').insert([supplierData])
      }
      resetForm(); fetchData();
    } catch (error: any) { alert(error.message) } finally { setLoading(false) }
  }

  const handleEdit = (s: any) => {
    setEditingId(s.id); setName(s.name); setPhone(s.phone || '');
    setAfm(s.vat_number || ''); setCategory(s.category || 'Εμπορεύματα');
    setIsFormOpen(true);
  }

  const resetForm = () => {
    setName(''); setPhone(''); setAfm(''); setCategory('Εμπορεύματα');
    setEditingId(null); setIsFormOpen(false);
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '15px' }}>
      
      {/* HEADER */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>🛒</div>
          <div>
            <h1 style={{ fontWeight: '950', fontSize: '22px', margin: 0, color: '#000000' }}>Προμηθευτές</h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#000000', fontWeight: '900', textTransform: 'uppercase' }}>Διαχείριση</p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      <button onClick={() => { if(isFormOpen) resetForm(); setIsFormOpen(!isFormOpen); }} style={isFormOpen ? cancelBtnStyle : addBtnStyle}>
        {isFormOpen ? 'ΑΚΥΡΩΣΗ' : '+ ΝΕΟΣ ΠΡΟΜΗΘΕΥΤΗΣ'}
      </button>

      {isFormOpen && (
        <div style={{ ...formCard, border: '3px solid #000000' }}>
          <p style={labelStyle}>ΕΠΩΝΥΜΙΑ</p>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <div style={{ flex: 1 }}><p style={labelStyle}>ΤΗΛΕΦΩΝΟ</p><input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} /></div>
            <div style={{ flex: 1 }}><p style={labelStyle}>ΑΦΜ</p><input maxLength={9} value={afm} onChange={(e) => setAfm(e.target.value)} style={inputStyle} /></div>
          </div>

          <p style={{ ...labelStyle, marginTop: '16px' }}>ΚΑΤΗΓΟΡΙΑ</p>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            <option value="Εμπορεύματα">🛒 Εμπορεύματα</option>
            <option value="Πάγια">🏢 Πάγια / Λογαριασμοί</option>
            <option value="Λοιπά">📦 Λοιπά Έξοδα</option>
          </select>

          <button onClick={handleSave} disabled={loading} style={saveBtn}>
            {loading ? 'ΚΑΤΑΧΩΡΗΣΗ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΔΗΜΙΟΥΡΓΙΑ')}
          </button>
        </div>
      )}

      {/* ΛΙΣΤΑ */}
      <div style={{ marginTop: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: '950', color: '#000', marginBottom: '15px' }}>ΛΙΣΤΑ ΣΥΝΕΡΓΑΤΩΝ ({suppliers.length})</p>
        {suppliers.map(s => (
          <div key={s.id} style={{ marginBottom: '12px' }}>
            <div style={supplierItem}>
              <div style={{ flex: 1 }} onClick={() => setShowTransactions(showTransactions === s.id ? null : s.id)}>
                <p style={{ fontWeight: '950', margin: 0, fontSize: '17px', color: '#000' }}>{s.name.toUpperCase()}</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                   <span style={badgeStyle}>{s.category}</span>
                   <span style={{ fontSize: '14px', color: '#000', fontWeight: '950' }}>{getSupplierTurnover(s.id).toFixed(2)}€</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleEdit(s)} style={editBtnStyle}>✎</button>
              </div>
            </div>
            {showTransactions === s.id && (
              <div style={transList}>
                {transactions.filter(t => t.supplier_id === s.id).map(t => (
                  <div key={t.id} style={transItem}>
                    <span style={{ fontWeight: '800' }}>{t.date.split('T')[0]}</span>
                    <span style={{ fontWeight: '950' }}>{Number(t.amount).toFixed(2)}€</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* ΧΩΡΟΣ ΣΤΟ ΤΕΛΟΣ ΓΙΑ ΤΟ IPHONE */}
      <div style={{ height: '80px' }} />
    </div>
  )
}

// STYLES - ΔΙΟΡΘΩΜΕΝΑ ΓΙΑ ΜΕΓΙΣΤΗ ΑΝΤΙΘΕΣΗ
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingTop: '10px' };
const logoBoxStyle: any = { width: '45px', height: '45px', backgroundColor: '#000', color: '#fff', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' };
const backBtnStyle: any = { textDecoration: 'none', color: '#000', fontSize: '20px', fontWeight: '950', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2.5px solid #000', borderRadius: '12px' };
const addBtnStyle: any = { width: '100%', padding: '18px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '18px', fontWeight: '950', fontSize: '14px', marginBottom: '20px' };
const cancelBtnStyle: any = { ...addBtnStyle, backgroundColor: '#f1f5f9', color: '#000', border: '2.5px solid #000' };
const formCard: any = { backgroundColor: '#fff', padding: '24px', borderRadius: '28px', marginBottom: '25px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' };
const labelStyle: any = { fontSize: '11px', fontWeight: '950', color: '#000', marginBottom: '6px' };
const inputStyle: any = { width: '100%', padding: '16px', borderRadius: '16px', border: '2.5px solid #000', fontSize: '16px', fontWeight: '800', color: '#000', boxSizing: 'border-box' };
const saveBtn: any = { width: '100%', padding: '18px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: '950', marginTop: '20px' };
const supplierItem: any = { backgroundColor: '#fff', padding: '18px', borderRadius: '22px', border: '2.5px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const badgeStyle: any = { fontSize: '10px', fontWeight: '950', backgroundColor: '#000', padding: '4px 10px', borderRadius: '8px', color: '#fff' };
const editBtnStyle: any = { background: '#fef3c7', border: '2px solid #f59e0b', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize: '18px' };
const transList: any = { backgroundColor: '#f8fafc', padding: '15px', borderRadius: '0 0 22px 22px', border: '2.5px solid #f1f5f9', borderTop: 'none', marginTop: '-10px' };
const transItem: any = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0' };

export default function SuppliersPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><SuppliersContent /></Suspense>
    </main>
  )
}
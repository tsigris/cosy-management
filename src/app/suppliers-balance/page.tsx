'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function SuppliersContent() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({ name: '', phone: '', vat_number: '' })

  useEffect(() => { 
    fetchInitialData() 
  }, [])

  async function fetchInitialData() {
    setLoading(true)
    const { data: sups } = await supabase.from('suppliers').select('*').order('name')
    const { data: trans } = await supabase.from('transactions').select('amount, supplier_id')
    if (sups) setSuppliers(sups)
    if (trans) setTransactions(trans)
    setLoading(false)
  }

  // Υπολογισμός συνολικού τζίρου ανά προμηθευτή
  const getTurnover = (id: string) => {
    return transactions
      .filter(t => t.supplier_id === id)
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  }

  async function handleSave() {
    if (!formData.name.trim()) return alert('Το όνομα είναι υποχρεωτικό!')
    setLoading(true)
    
    const payload = { 
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        vat_number: formData.vat_number.trim() || null
    }

    const { error } = editingId 
      ? await supabase.from('suppliers').update(payload).eq('id', editingId)
      : await supabase.from('suppliers').insert([payload])

    if (!error) {
      setEditingId(null)
      setFormData({ name: '', phone: '', vat_number: '' })
      setIsAdding(false)
      fetchInitialData()
    } else {
      alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Προσοχή! Η διαγραφή του προμηθευτή θα επηρεάσει τις καρτέλες. Σίγουρα;')) return
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (!error) fetchInitialData()
    else alert('Σφάλμα διαγραφής: ' + error.message)
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => router.push('/')} style={backBtnStyle}>←</button>
        <h2 style={{ fontWeight: '900', margin: 0 }}>Προμηθευτές</h2>
        <button 
          onClick={() => { setIsAdding(!isAdding); setEditingId(null); setFormData({name:'', phone:'', vat_number:''}); }}
          style={addBtnStyle}
        >
          {isAdding ? 'Άκυρο' : '+ Νέος'}
        </button>
      </div>

      {isAdding && (
        <div style={formBoxStyle}>
          <label style={labelStyle}>ΟΝΟΜΑ ΠΡΟΜΗΘΕΥΤΗ *</label>
          <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={inputStyle} />
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label>
              <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Α.Φ.Μ.</label>
              <input value={formData.vat_number} onChange={e => setFormData({...formData, vat_number: e.target.value})} style={inputStyle} />
            </div>
          </div>
          
          <button onClick={handleSave} disabled={loading} style={saveBtnStyle}>
            {loading ? 'ΠΕΡΙΜΕΝΕΤΕ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΑΠΟΘΗΚΕΥΣΗ')}
          </button>
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {suppliers.map(s => (
          <div key={s.id} style={supplierCardStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '800', fontSize: '16px' }}>{s.name}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', marginTop: '4px' }}>
                ΣΥΝ. ΤΖΙΡΟΣ: {getTurnover(s.id).toFixed(2)}€
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => { setFormData({name: s.name, phone: s.phone || '', vat_number: s.vat_number || ''}); setEditingId(s.id); setIsAdding(true); }}
                style={editIconBtn}
              >✎</button>
              <button onClick={() => handleDelete(s.id)} style={deleteIconBtn}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={<div>Φόρτωση...</div>}>
      <SuppliersContent />
    </Suspense>
  )
}

// STYLES
const backBtnStyle = { border: 'none', background: '#f1f5f9', width: '40px', height: '40px', borderRadius: '12px', fontSize: '20px', cursor: 'pointer' };
const addBtnStyle = { backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' };
const formBoxStyle = { padding: '20px', border: '2px solid #2563eb', borderRadius: '20px', marginBottom: '25px', backgroundColor: '#f8fafc' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '10px', boxSizing: 'border-box' as const };
const labelStyle = { fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', display: 'block', marginBottom: '5px' };
const saveBtnStyle = { width: '100%', padding: '15px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' };
const supplierCardStyle = { padding: '15px', backgroundColor: 'white', border: '1px solid #f1f5f9', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const editIconBtn = { background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '35px', height: '35px', cursor: 'pointer', fontSize: '16px' };
const deleteIconBtn = { background: '#fee2e2', border: 'none', borderRadius: '8px', width: '35px', height: '35px', cursor: 'pointer', fontSize: '16px' };
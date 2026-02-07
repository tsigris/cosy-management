'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [afm, setAfm] = useState('')
  const [category, setCategory] = useState('Εμπορεύματα')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showTransactions, setShowTransactions] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { 
    fetchData() 
  }, [])

  async function fetchData() {
    // Λήψη προμηθευτών και συναλλαγών για τον υπολογισμό τζίρου
    const { data: sData } = await supabase.from('suppliers').select('*').order('name')
    const { data: tData } = await supabase.from('transactions').select('*')
    if (sData) setSuppliers(sData)
    if (tData) setTransactions(tData)
  }

  // Υπολογισμός τζίρου ανά προμηθευτή
  const getSupplierTurnover = (supplierId: string) => {
    return transactions
      .filter(t => t.supplier_id === supplierId)
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  }

  async function handleSave() {
    if (!name) return alert('Δώσε όνομα')
    setLoading(true)
    
    const supplierData = { name, phone, afm, category }

    if (editingId) {
      const { error } = await supabase.from('suppliers').update(supplierData).eq('id', editingId)
      if (!error) setEditingId(null)
    } else {
      await supabase.from('suppliers').insert([supplierData])
    }

    setName(''); setPhone(''); setAfm(''); setCategory('Εμπορεύματα')
    fetchData()
    setLoading(false)
  }

  const handleEdit = (s: any) => {
    setEditingId(s.id)
    setName(s.name)
    setPhone(s.phone || '')
    setAfm(s.afm || '')
    setCategory(s.category || 'Εμπορεύματα')
    window.scrollTo(0, 0)
  }

  return (
    <main style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#2563eb', fontWeight: 'bold' }}>← Πίσω</Link>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900' }}>Προμηθευτές</h2>
        <button onClick={() => { setEditingId(null); setName(''); setPhone(''); setAfm(''); }} style={cancelBtn}>Άκυρο</button>
      </div>

      {/* ΦΟΡΜΑ ΕΓΓΡΑΦΗΣ / ΕΠΕΞΕΡΓΑΣΙΑΣ */}
      <div style={{ ...formCard, borderColor: editingId ? '#f59e0b' : '#2563eb' }}>
        <p style={labelStyle}>ΕΠΩΝΥΜΙΑ ΠΡΟΜΗΘΕΥΤΗ</p>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="π.χ. Fiat Κουλουράς" />

        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <div style={{ flex: 1 }}>
            <p style={labelStyle}>ΤΗΛΕΦΩΝΟ</p>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={labelStyle}>Α.Φ.Μ.</p>
            <input value={afm} onChange={(e) => setAfm(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <p style={{ ...labelStyle, marginTop: '15px' }}>ΚΑΤΗΓΟΡΙΑ ΕΞΟΔΩΝ</p>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
          <option value="Εμπορεύματα">🛒 Εμπορεύματα</option>
          <option value="Πάγια">🏢 Πάγια / Λογαριασμοί</option>
          <option value="Προσωπικό">👥 Προσωπικό (Μισθοδοσία)</option>
          <option value="Λοιπά">📦 Λοιπά Έξοδα</option>
        </select>

        <button onClick={handleSave} disabled={loading} style={{ ...saveBtn, backgroundColor: editingId ? '#f59e0b' : '#4ade80' }}>
          {editingId ? 'ΕΝΗΜΕΡΩΣΗ ΑΛΛΑΓΩΝ' : 'ΕΝΗΜΕΡΩΣΗ'}
        </button>
      </div>

      {/* ΛΙΣΤΑ ΠΡΟΜΗΘΕΥΤΩΝ */}
      <div style={{ marginTop: '30px' }}>
        {suppliers.map(s => (
          <div key={s.id} style={{ marginBottom: '15px' }}>
            <div style={supplierItem}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setShowTransactions(showTransactions === s.id ? null : s.id)}>
                <p style={{ fontWeight: '900', margin: 0, fontSize: '16px' }}>{s.name}</p>
                <p style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', margin: '2px 0' }}>{s.category || 'Εμπορεύματα'}</p>
                <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>ΣΥΝ. ΤΖΙΡΟΣ: {getSupplierTurnover(s.id).toFixed(2)}€</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleEdit(s)} style={editBtn}>✎</button>
                <button onClick={async () => { if(confirm('Διαγραφή;')) { await supabase.from('suppliers').delete().eq('id', s.id); fetchData(); } }} style={deleteBtn}>🗑️</button>
              </div>
            </div>

            {/* ΠΡΟΒΟΛΗ ΣΥΝΑΛΛΑΓΩΝ ΠΡΟΜΗΘΕΥΤΗ */}
            {showTransactions === s.id && (
              <div style={transList}>
                <p style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '10px' }}>ΙΣΤΟΡΙΚΟ ΣΥΝΑΛΛΑΓΩΝ</p>
                {transactions.filter(t => t.supplier_id === s.id).length > 0 ? (
                  transactions.filter(t => t.supplier_id === s.id).map(t => (
                    <div key={t.id} style={transItem}>
                      <span>{t.date}</span>
                      <span style={{ fontWeight: 'bold' }}>{Number(t.amount).toFixed(2)}€</span>
                    </div>
                  ))
                ) : <p style={{ fontSize: '12px', color: '#94a3b8' }}>Καμία συναλλαγή</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}

// STYLES
const formCard = { backgroundColor: 'white', padding: '20px', borderRadius: '25px', border: '2px solid', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' };
const labelStyle = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '5px' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '15px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '15px', fontWeight: 'bold', boxSizing: 'border-box' as const };
const saveBtn = { width: '100%', padding: '15px', color: 'white', border: 'none', borderRadius: '15px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginTop: '20px' };
const cancelBtn = { padding: '8px 15px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' };
const supplierItem = { backgroundColor: 'white', padding: '15px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9' };
const editBtn = { background: '#fef3c7', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px' };
const deleteBtn = { background: '#fee2e2', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px' };
const transList = { backgroundColor: '#f1f5f9', padding: '15px', borderRadius: '0 0 20px 20px', marginTop: '-10px', border: '1px solid #e2e8f0' };
const transItem = { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '5px 0', borderBottom: '1px solid #e2e8f0' };
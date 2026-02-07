'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [afm, setAfm] = useState('')
  const [category, setCategory] = useState('Εμπορεύματα') // Νέο state
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchSuppliers() }, [])

  async function fetchSuppliers() {
    const { data } = await supabase.from('suppliers').select('*').order('name')
    if (data) setSuppliers(data)
  }

  async function handleAddSupplier() {
    if (!name) return alert('Δώσε όνομα')
    setLoading(true)
    const { error } = await supabase.from('suppliers').insert([{ 
        name, 
        phone, 
        afm, 
        category // Αποθήκευση κατηγορίας
    }])
    if (!error) {
      setName(''); setPhone(''); setAfm(''); setCategory('Εμπορεύματα')
      fetchSuppliers()
    }
    setLoading(false)
  }

  return (
    <main style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#2563eb', fontWeight: 'bold' }}>← Πίσω</Link>
        <h2 style={{ margin: 0 }}>Προμηθευτές</h2>
        <button onClick={() => window.location.reload()} style={cancelBtn}>Άκυρο</button>
      </div>

      <div style={formCard}>
        <div style={{ marginBottom: '15px' }}>
          <label style={labelStyle}>ΕΠΩΝΥΜΙΑ ΠΡΟΜΗΘΕΥΤΗ</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="π.χ. Fiat Κουλουράς" />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Α.Φ.Μ.</label>
            <input value={afm} onChange={(e) => setAfm(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* ΝΕΟ ΠΕΔΙΟ ΚΑΤΗΓΟΡΙΑΣ */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>ΚΑΤΗΓΟΡΙΑ ΕΞΟΔΩΝ</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            <option value="Εμπορεύματα">🛒 Εμπορεύματα</option>
            <option value="Πάγια">🏢 Πάγια / Λογαριασμοί</option>
            <option value="Προσωπικό">👥 Προσωπικό (Μισθοδοσία)</option>
            <option value="Λοιπά">📦 Λοιπά Έξοδα</option>
          </select>
        </div>

        <button onClick={handleAddSupplier} disabled={loading} style={saveBtn}>
          {loading ? 'ΓΙΝΕΤΑΙ ΕΓΓΡΑΦΗ...' : 'ΕΝΗΜΕΡΩΣΗ'}
        </button>
      </div>

      <div style={{ marginTop: '30px' }}>
        {suppliers.map(s => (
          <div key={s.id} style={supplierItem}>
            <div>
              <p style={{ fontWeight: 'bold', margin: 0 }}>{s.name}</p>
              <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>{s.category}</p>
            </div>
            <button onClick={async () => { if(confirm('Διαγραφή;')) { await supabase.from('suppliers').delete().eq('id', s.id); fetchSuppliers(); } }} style={deleteBtn}>🗑️</button>
          </div>
        ))}
      </div>
    </main>
  )
}

const formCard = { backgroundColor: 'white', padding: '25px', borderRadius: '25px', border: '2px solid #2563eb', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' };
const labelStyle = { fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', marginBottom: '8px', display: 'block' };
const inputStyle = { width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '16px', fontWeight: 'bold' };
const saveBtn = { width: '100%', padding: '18px', backgroundColor: '#4ade80', color: 'white', border: 'none', borderRadius: '15px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' };
const cancelBtn = { padding: '8px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' };
const supplierItem = { backgroundColor: 'white', padding: '15px', borderRadius: '20px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9' };
const deleteBtn = { background: '#fee2e2', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer' };
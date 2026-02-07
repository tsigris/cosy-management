'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function SuppliersContent() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({ name: '', phone: '', vat_number: '' })

  useEffect(() => { fetchSuppliers() }, [])

  async function fetchSuppliers() {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').order('name')
    if (data) setSuppliers(data)
    setLoading(false)
  }

  async function handleSave() {
    if (!formData.name.trim()) return alert('Το όνομα είναι υποχρεωτικό!')
    setLoading(true)
    
    // ΕΔΩ ΕΙΝΑΙ Η ΔΙΟΡΘΩΣΗ: Χρησιμοποιούμε το vat_number όπως στη βάση σου
    const { error } = await supabase.from('suppliers').insert([{
      name: formData.name.trim(),
      phone: formData.phone.trim() || null,
      vat_number: formData.vat_number.trim() || null
    }])

    if (!error) {
      alert('Επιτυχής Αποθήκευση!');
      setFormData({ name: '', phone: '', vat_number: '' })
      setIsAdding(false)
      fetchSuppliers()
    } else {
      alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '20px' }}>←</button>
        <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>Προμηθευτές</h1>
        <button onClick={() => setIsAdding(!isAdding)} style={{ backgroundColor: '#2563eb', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>
          {isAdding ? 'Άκυρο' : '+ Νέος'}
        </button>
      </div>

      {isAdding && (
        <div style={{ padding: '20px', border: '2px solid #2563eb', borderRadius: '15px', marginBottom: '20px', backgroundColor: '#f8fafc' }}>
          <label style={labelStyle}>ΟΝΟΜΑ ΠΡΟΜΗΘΕΥΤΗ *</label>
          <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={inputStyle} />
          
          <label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label>
          <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={inputStyle} />
          
          <label style={labelStyle}>Α.Φ.Μ.</label>
          <input value={formData.vat_number} onChange={e => setFormData({...formData, vat_number: e.target.value})} style={inputStyle} />
          
          <button onClick={handleSave} disabled={loading} style={saveButtonStyle}>
            {loading ? 'ΓΙΝΕΤΑΙ ΑΠΟΘΗΚΕΥΣΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ'}
          </button>
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {suppliers.map(s => (
          <div key={s.id} style={{ padding: '15px', backgroundColor: 'white', border: '1px solid #f1f5f9', borderRadius: '12px', fontWeight: 'bold' }}>
            {s.name} {s.vat_number ? `(${s.vat_number})` : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={<p style={{ textAlign: 'center' }}>Φόρτωση...</p>}>
      <SuppliersContent />
    </Suspense>
  )
}

const labelStyle = { fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', display: 'block', marginBottom: '5px' };
const inputStyle = { width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' as const };
const saveButtonStyle = { width: '100%', padding: '15px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };
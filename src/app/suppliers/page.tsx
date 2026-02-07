'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function SuppliersContent() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({ name: '', phone: '', vat: '' })

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
    
    // Προσπάθεια εισαγωγής στη Supabase
    const { error } = await supabase.from('suppliers').insert([formData])

    if (!error) {
      alert('Επιτυχής Αποθήκευση!');
      setFormData({ name: '', phone: '', vat: '' })
      setIsAdding(false)
      fetchSuppliers()
    } else {
      alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 'bold' }}>← Πίσω</Link>
        <button onClick={() => setIsAdding(!isAdding)} style={{ backgroundColor: '#2563eb', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '10px' }}>
          {isAdding ? 'Άκυρο' : '+ Νέος'}
        </button>
      </div>

      {isAdding && (
        <div style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '15px', marginBottom: '20px' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8' }}>ΟΝΟΜΑ ΠΡΟΜΗΘΕΥΤΗ *</label>
          <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
          <button onClick={handleSave} disabled={loading} style={{ width: '100%', padding: '15px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>
            {loading ? 'ΠΕΡΙΜΕΝΕΤΕ...' : 'ΑΠΟΘΗΚΕΥΣΗ'}
          </button>
        </div>
      )}
      
      {/* Λίστα Προμηθευτών */}
      <div>
        {suppliers.map(s => (
          <div key={s.id} style={{ padding: '15px', borderBottom: '1px solid #f1f5f9', fontWeight: 'bold' }}>{s.name}</div>
        ))}
      </div>
    </div>
  )
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={<p>Φόρτωση...</p>}>
      <SuppliersContent />
    </Suspense>
  )
}
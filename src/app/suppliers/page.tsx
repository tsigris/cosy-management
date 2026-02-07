'use client'
// 1. Προσθήκη για αποφυγή σφαλμάτων build στο Vercel
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// 2. Μεταφέρουμε όλη τη λειτουργικότητα σε ένα εσωτερικό Component
function SuppliersContent() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({ 
    name: '', email: '', phone: '', vat: '', address: '', notes: '' 
  })

  useEffect(() => { 
    fetchInitialData() 
  }, [])

  async function fetchInitialData() {
    setLoading(true)
    try {
        const { data: sups } = await supabase.from('suppliers').select('*').order('name')
        const { data: trans } = await supabase.from('transactions').select('*')
        if (sups) setSuppliers(sups)
        if (trans) setTransactions(trans)
    } catch (err) {
        console.error("Fetch error:", err)
    }
    setLoading(false)
  }

  const getSupplierStats = (id: string) => {
    return transactions
      .filter(t => t.supplier_id === id)
      .reduce((acc, t) => {
        const amt = Number(t.amount) || 0
        if (t.type === 'expense') {
          if (t.is_credit) acc.credits += amt
          else if (t.is_debt_payment) acc.payments += amt
          else acc.cash += amt
          acc.turnover += amt
        }
        return acc
      }, { turnover: 0, cash: 0, credits: 0, payments: 0 })
  }

  async function handleSave() {
    if (!formData.name.trim()) return alert('Το όνομα είναι υποχρεωτικό!')
    setLoading(true)
    
    const payload: any = { 
        name: formData.name.trim(),
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        vat: formData.vat?.trim() || null,
        address: formData.address?.trim() || null,
        notes: formData.notes?.trim() || null
    }

    try {
        const { error } = editingId 
          ? await supabase.from('suppliers').update(payload).eq('id', editingId)
          : await supabase.from('suppliers').insert([payload])

        if (!error) {
          alert(editingId ? 'Ενημερώθηκε!' : 'Αποθηκεύτηκε!')
          setEditingId(null)
          setFormData({ name: '', email: '', phone: '', vat: '', address: '', notes: '' })
          setIsAdding(false)
          fetchInitialData()
        } else {
            alert('Σφάλμα: ' + error.message)
        }
    } catch (err) {
        alert('Πρόβλημα σύνδεσης με τη βάση.')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link href="/" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 'bold', fontSize: '20px' }}>←</Link>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Προμηθευτές</h1>
        </div>
        <button 
          onClick={() => { setIsAdding(!isAdding); setSelectedSupplierId(null); setEditingId(null); setFormData({ name: '', email: '', phone: '', vat: '', address: '', notes: '' }); }}
          style={{ backgroundColor: isAdding ? '#94a3b8' : '#2563eb', color: 'white', padding: '10px 18px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {isAdding ? 'Άκυρο' : '+ Νέος'}
        </button>
      </div>

      {/* ΦΟΡΜΑ ΚΑΤΑΧΩΡΗΣΗΣ */}
      {isAdding && (
        <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '18px', marginBottom: '25px', border: '2px solid #2563eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>ΟΝΟΜΑ ΠΡΟΜΗΘΕΥΤΗ *</label>
              <input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} style={inputStyle} />
            </div>
            <div><label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label><input value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} style={inputStyle} /></div>
            <div><label style={labelStyle}>Α.Φ.Μ.</label><input value={formData.vat || ''} onChange={e => setFormData({...formData, vat: e.target.value})} style={inputStyle} /></div>
          </div>
          <button onClick={handleSave} disabled={loading} style={saveBtnStyle}>
            {loading ? 'ΠΑΡΑΚΑΛΩ ΠΕΡΙΜΕΝΕΤΕ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΑΠΟΘΗΚΕΥΣΗ')}
          </button>
        </div>
      )}

      {/* ΛΙΣΤΑ ΠΡΟΜΗΘΕΥΤΩΝ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {loading && !isAdding ? <p style={{ textAlign: 'center' }}>Φόρτωση...</p> : suppliers.map((s) => {
          const stats = getSupplierStats(s.id)
          const isSelected = selectedSupplierId === s.id

          return (
            <div key={s.id} style={{ border: '1px solid #f1f5f9', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div 
                onClick={() => setSelectedSupplierId(isSelected ? null : s.id)}
                style={{ backgroundColor: 'white', padding: '18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '16px' }}>{s.name}</span>
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>ΤΖΙΡΟΣ: {stats.turnover.toFixed(2)}€</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px', color: '#cbd5e0' }}>{isSelected ? '▲' : '▼'}</span>
                </div>
              </div>

              {isSelected && (
                <div style={{ backgroundColor: '#fdfdfd', padding: '18px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <div style={statBox}>
                      <p style={statLabel}>ΜΕΤΡΗΤΑ / ΚΑΡΤΑ</p>
                      <p style={{...statValue, color: '#16a34a'}}>{stats.cash.toFixed(2)}€</p>
                    </div>
                    <div style={statBox}>
                      <p style={statLabel}>ΕΠΙ ΠΙΣΤΩΣΕΙ</p>
                      <p style={{...statValue, color: '#ea580c'}}>{stats.credits.toFixed(2)}€</p>
                    </div>
                  </div>
                  <div style={{...statBox, backgroundColor: '#f1f5f9', marginBottom: '15px'}}>
                    <p style={statLabel}>ΥΠΟΛΟΙΠΟ ΟΦΕΙΛΗΣ (ΚΑΡΤΕΛΑ)</p>
                    <p style={{...statValue, color: '#1e293b'}}>{(stats.credits - stats.payments).toFixed(2)}€</p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => { setFormData(s); setEditingId(s.id); setIsAdding(true); }} style={actionBtn}>ΕΠΕΞΕΡΓΑΣΙΑ ✎</button>
                    <button onClick={async () => { if(confirm('Διαγραφή;')) { await supabase.from('suppliers').delete().eq('id', s.id); fetchInitialData(); } }} style={{...actionBtn, color: '#ef4444'}}>ΔΙΑΓΡΑΦΗ 🗑️</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 3. Η κύρια σελίδα που τυλίγει τα πάντα σε Suspense
export default function SuppliersPage() {
  return (
    <main style={{ backgroundColor: '#ffffff', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px' }}>Φόρτωση σελίδας...</div>}>
        <SuppliersContent />
      </Suspense>
    </main>
  )
}

// STYLES (Παραμένουν τα ίδια)
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', display: 'block', marginBottom: '4px', textTransform: 'uppercase' as const };
const inputStyle = { width: '100%', padding: '
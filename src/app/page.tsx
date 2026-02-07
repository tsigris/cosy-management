'use client'
// Διασφαλίζει ότι η σελίδα θα φορτώνει σωστά στο Vercel
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function SuppliersContent() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  
  // Κρατάμε μόνο τα πεδία που υπάρχουν σίγουρα στη βάση σου (name, phone)
  const [formData, setFormData] = useState({ 
    name: '', phone: '' 
  })

  useEffect(() => { 
    fetchInitialData() 
  }, [])

  async function fetchInitialData() {
    setLoading(true)
    const { data: sups } = await supabase.from('suppliers').select('*').order('name')
    const { data: trans } = await supabase.from('transactions').select('*')
    if (sups) setSuppliers(sups)
    if (trans) setTransactions(trans)
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
    
    // Στέλνουμε μόνο το όνομα και το τηλέφωνο για να μην έχουμε σφάλμα στήλης
    const payload: any = { 
        name: formData.name.trim(),
        phone: formData.phone?.trim() || null
    }

    const { error } = editingId 
      ? await supabase.from('suppliers').update(payload).eq('id', editingId)
      : await supabase.from('suppliers').insert([payload])

    if (!error) {
      alert(editingId ? 'Ενημερώθηκε!' : 'Αποθηκεύτηκε!')
      setEditingId(null)
      setFormData({ name: '', phone: '' })
      setIsAdding(false)
      fetchInitialData()
    } else {
      alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '24px', cursor: 'pointer' }}>←</button>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Προμηθευτές</h1>
        </div>
        <button 
          onClick={() => { setIsAdding(!isAdding); setSelectedSupplierId(null); }}
          style={{ backgroundColor: isAdding ? '#94a3b8' : '#2563eb', color: 'white', padding: '10px 18px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {isAdding ? 'Άκυρο' : '+ Νέος'}
        </button>
      </div>

      {/* ΦΟΡΜΑ ΚΑΤΑΧΩΡΗΣΗΣ */}
      {isAdding && (
        <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '18px', marginBottom: '25px', border: '2px solid #2563eb' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={labelStyle}>ΟΝΟΜΑ ΠΡΟΜΗΘΕΥΤΗ *</label>
              <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={inputStyle} placeholder="π.χ. Fiat Κουλουράς" />
            </div>
            <div>
              <label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label>
              <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={inputStyle} placeholder="210..." />
            </div>
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
                <span style={{ fontSize: '18px', color: '#cbd5e0' }}>{isSelected ? '▲' : '▼'}</span>
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
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => { setFormData({ name: s.name, phone: s.phone || '' }); setEditingId(s.id); setIsAdding(true); }} style={actionBtn}>ΕΠΕΞΕΡΓΑΣΙΑ ✎</button>
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

// Η κύρια σελίδα που περιλαμβάνει το Suspense Boundary
export default function SuppliersPage() {
  return (
    <main style={{ backgroundColor: '#ffffff', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px' }}>Φόρτωση...</div>}>
        <SuppliersContent />
      </Suspense>
    </main>
  )
}

const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', display: 'block', marginBottom: '4px', textTransform: 'uppercase' as const };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '15px' };
const saveBtnStyle = { width: '100%', backgroundColor: '#16a34a', color: 'white', padding: '16px', borderRadius: '12px', border: 'none', fontWeight: 'bold' as const, fontSize: '15px', marginTop: '10px', cursor: 'pointer' };
const statBox = { padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9', backgroundColor: 'white' };
const statLabel = { fontSize: '9px', fontWeight: '800' as const, color: '#94a3b8', margin: '0 0 4px 0' };
const statValue = { fontSize: '16px', fontWeight: '900' as const, margin: 0 };
const actionBtn = { flex: 1, background: 'white', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' as const };
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function AddExpenseForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  // State φόρμας
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [notes, setNotes] = useState('')
  
  // State λογικής
  const [isCredit, setIsCredit] = useState(false) 
  const [isAgainstDebt, setIsAgainstDebt] = useState(false)
  const [source, setSource] = useState('store') 
  const [currentUsername, setCurrentUsername] = useState('Χρήστης')
  const [loading, setLoading] = useState(true)

  // Λίστες Δεδομένων
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])
  
  // Επιλογές (IDs)
  const [selectedSup, setSelectedSup] = useState('')
  const [selectedFixed, setSelectedFixed] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase.from('profiles').select('username, store_id').eq('id', user.id).maybeSingle()
        if (profile?.username) setCurrentUsername(profile.username)

        if (profile?.store_id) {
          const [sRes, fRes] = await Promise.all([
            supabase.from('suppliers').select('id, name').eq('store_id', profile.store_id).order('name'),
            supabase.from('fixed_assets').select('id, name').eq('store_id', profile.store_id).order('name')
          ])
          
          if (sRes.data) setSuppliers(sRes.data)
          if (fRes.data) setFixedAssets(fRes.data)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  async function handleSave() {
    if (!amount || Number(amount) <= 0) return alert('Συμπληρώστε το ποσό')
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user?.id).maybeSingle()

      if (!profile?.store_id) throw new Error('Δεν βρέθηκε κατάστημα')

      let category = 'Λοιπά'
      if (selectedSup) category = 'Εμπορεύματα'
      else if (selectedFixed) category = 'Πάγια'

      const payload = {
        amount: source === 'pocket' ? -Math.abs(Number(amount)) : Number(amount),
        method: isCredit ? 'Πίστωση' : method,
        notes: source === 'pocket' ? `(ΤΣΕΠΗ) ${notes}` : notes,
        is_credit: isCredit,
        type: isAgainstDebt ? 'debt_payment' : 'expense',
        date: selectedDate,
        user_id: user?.id,
        store_id: profile.store_id,
        supplier_id: selectedSup || null,
        fixed_asset_id: selectedFixed || null,
        category: source === 'pocket' ? 'pocket' : (isAgainstDebt ? 'Εξόφληση Χρέους' : category),
        created_by_name: currentUsername
      }

      const { error } = await supabase.from('transactions').insert([payload])
      if (error) throw error

      router.push(`/?date=${selectedDate}`)
    } catch (error: any) {
      alert('Σφάλμα: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={formCardStyle}>
        
        {/* ΕΠΑΓΓΕΛΜΑΤΙΚΟ ΓΡΑΦΙΚΟ HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>
              <span style={{ fontSize: '20px' }}>💸</span>
            </div>
            <div>
              <h1 style={{ fontWeight: '900', fontSize: '20px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
                Νέο Έξοδο
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                ΚΑΤΑΧΩΡΗΣΗ ΔΑΠΑΝΗΣ
              </p>
            </div>
          </div>
          <Link href="/" style={backBtnStyle}>✕</Link>
        </div>

        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b' }}>👤 ΚΑΤΑΧΩΡΗΣΗ ΑΠΟ: {currentUsername.toUpperCase()}</span>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>ΠΗΓΗ ΧΡΗΜΑΤΩΝ</label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button 
              type="button"
              onClick={() => { setSource('store'); setIsCredit(false); setIsAgainstDebt(false); }} 
              style={{ ...sourceBtn, backgroundColor: source === 'store' ? '#0f172a' : '#f1f5f9', color: source === 'store' ? 'white' : '#64748b' }}
            >
              🏪 ΤΑΜΕΙΟ
            </button>
            <button 
              type="button"
              onClick={() => { setSource('pocket'); setIsCredit(false); setIsAgainstDebt(false); }} 
              style={{ ...sourceBtn, backgroundColor: source === 'pocket' ? '#8b5cf6' : '#f1f5f9', color: source === 'pocket' ? 'white' : '#64748b' }}
            >
              💰 ΤΣΕΠΗ
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1.5 }}>
            <label style={labelStyle}>ΠΟΣΟ (€)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" autoFocus />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>ΜΕΘΟΔΟΣ</label>
            <select value={method} onChange={e => setMethod(e.target.value)} style={inputStyle} disabled={isCredit}>
              <option value="Μετρητά">Μετρητά</option>
              <option value="Τράπεζα">Τράπεζα</option>
            </select>
          </div>
        </div>

        {source === 'store' && (
          <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '15px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={isCredit} onChange={e => {setIsCredit(e.target.checked); if(e.target.checked) setIsAgainstDebt(false)}} id="credit" />
              <label htmlFor="credit" style={checkLabel}>ΕΠΙ ΠΙΣΤΩΣΕΙ (ΝΕΟ ΧΡΕΟΣ)</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={isAgainstDebt} onChange={e => {setIsAgainstDebt(e.target.checked); if(e.target.checked) setIsCredit(false)}} id="against" />
              <label htmlFor="against" style={checkLabel}>ΕΝΑΝΤΙ ΠΑΛΑΙΟΥ ΧΡΕΟΥ</label>
            </div>
          </div>
        )}

        <div style={selectGroup}>
          <label style={labelStyle}>🏭 ΠΡΟΜΗΘΕΥΤΗΣ</label>
          <select value={selectedSup} onChange={e => {setSelectedSup(e.target.value); setSelectedFixed('');}} style={inputStyle}>
            <option value="">— Επιλογή —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div style={selectGroup}>
          <label style={labelStyle}>🏢 ΠΑΓΙΟ / ΕΞΟΠΛΙΣΜΟΣ</label>
          <select value={selectedFixed} onChange={e => {setSelectedFixed(e.target.value); setSelectedSup('');}} style={inputStyle}>
            <option value="">— Επιλογή —</option>
            {fixedAssets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ / ΠΕΡΙΓΡΑΦΗ</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: '60px', paddingTop: '10px' }} placeholder="Λεπτομέρειες εξόδου..." />
        </div>

        <button onClick={handleSave} disabled={loading} style={saveBtn}>
          {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ ΕΞΟΔΟΥ'}
        </button>
      </div>
    </main>
  )
}

// Στυλ
const formCardStyle = { maxWidth: '500px', margin: '0 auto', backgroundColor: 'white', borderRadius: '28px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.02)' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#fee2e2', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: '10px' };
const labelStyle: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '5px', display: 'block' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 'bold', backgroundColor: '#f8fafc', boxSizing: 'border-box', outline: 'none' };
const sourceBtn: any = { flex: 1, padding: '14px', borderRadius: '12px', border: 'none', fontWeight: '900', fontSize: '12px', cursor: 'pointer' };
const selectGroup = { marginBottom: '15px' };
const saveBtn: any = { width: '100%', padding: '18px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '16px', cursor: 'pointer', marginTop: '10px' };
const checkLabel: any = { fontSize: '13px', fontWeight: '700', color: '#1e293b', cursor: 'pointer' };

export default function AddExpensePage() {
  return (
    <Suspense fallback={<div style={{padding:'20px', textAlign:'center'}}>Φόρτωση...</div>}>
      <AddExpenseForm />
    </Suspense>
  )
}
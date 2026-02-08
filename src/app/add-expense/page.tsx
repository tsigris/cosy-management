'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function AddExpenseForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // State φόρμας
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [notes, setNotes] = useState('')
  const [invoiceNum, setInvoiceNum] = useState('')
  
  // State λογικής
  const [isCredit, setIsCredit] = useState(false) 
  const [isAgainstDebt, setIsAgainstDebt] = useState(false)
  const [source, setSource] = useState('store') 
  const [currentUsername, setCurrentUsername] = useState('Χρήστης')
  const [loading, setLoading] = useState(true)

  // Λίστες Δεδομένων
  const [employees, setEmployees] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])
  
  // Επιλογές (IDs)
  const [selectedEmp, setSelectedEmp] = useState('')
  const [selectedSup, setSelectedSup] = useState('')
  const [selectedFixed, setSelectedFixed] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase.from('profiles').select('username, store_id').eq('id', user.id).maybeSingle()
        if (profile?.username) setCurrentUsername(profile.username)

        if (!profile?.store_id) {
          console.warn("No store_id found");
          setLoading(false);
          return;
        }

        const [eRes, sRes, fRes] = await Promise.all([
          supabase.from('profiles').select('id, username').eq('store_id', profile.store_id).neq('role', 'service_role').order('username'),
          supabase.from('suppliers').select('id, name').eq('store_id', profile.store_id).order('name'),
          supabase.from('fixed_assets').select('id, name').eq('store_id', profile.store_id).order('name')
        ])
        
        if (eRes.data) setEmployees(eRes.data)
        if (sRes.data) setSuppliers(sRes.data)
        if (fRes.data) setFixedAssets(fRes.data)

        const supIdFromUrl = searchParams.get('supId')
        const againstDebtFromUrl = searchParams.get('againstDebt')
        if (supIdFromUrl) setSelectedSup(supIdFromUrl)
        if (againstDebtFromUrl === 'true') setIsAgainstDebt(true)
      
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [searchParams])

  async function handleSave() {
    if (!amount || Number(amount) <= 0) return alert('Συμπληρώστε το ποσό')

    let category = 'Λοιπά'
    if (selectedSup) category = 'Εμπορεύματα'
    else if (selectedEmp) category = 'Προσωπικό'
    else if (selectedFixed) category = 'Πάγια'

    const finalAmount = source === 'pocket' ? -Math.abs(Number(amount)) : Number(amount)
    const finalCategory = source === 'pocket' ? 'pocket' : (isAgainstDebt ? 'Εξόφληση Χρέους' : category)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Δεν βρέθηκε χρήστης')

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user.id).maybeSingle()
      if (!profile?.store_id) throw new Error('Το προφίλ σας δεν έχει συνδεδεμένο κατάστημα!')

      const payload: any = {
        amount: finalAmount,
        method: isCredit ? 'Πίστωση' : method,
        notes: source === 'pocket' ? `(ΑΠΟ ΤΣΕΠΗ) ${notes}` : notes,
        invoice_number: invoiceNum,
        is_credit: isCredit,
        type: isAgainstDebt ? 'debt_payment' : 'expense',
        date: new Date().toISOString().split('T')[0],
        user_id: user.id,
        store_id: profile.store_id,
        employee_id: selectedEmp || null,
        supplier_id: selectedSup || null,
        fixed_asset_id: selectedFixed || null,
        category: finalCategory,
        created_by_name: currentUsername
      }

      const { error } = await supabase.from('transactions').insert([payload])
      if (error) throw error

      window.location.href = '/'
    } catch (error: any) {
      alert('Σφάλμα αποθήκευσης: ' + error.message)
    }
  }

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={formCardStyle}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
          <Link href="/" style={{ textDecoration: 'none', fontSize: '24px', color: '#64748b' }}>←</Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Νέο Έξοδο</h2>
        </div>

        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b' }}>👤 ΚΑΤΑΧΩΡΗΣΗ ΑΠΟ: {currentUsername.toUpperCase()}</span>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>ΠΗΓΗ ΧΡΗΜΑΤΩΝ</label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button 
              onClick={() => { setSource('store'); setIsCredit(false); }} 
              style={{ ...sourceBtn, backgroundColor: source === 'store' ? '#0f172a' : '#f1f5f9', color: source === 'store' ? 'white' : '#64748b' }}
            >
              🏪 ΤΑΜΕΙΟ
            </button>
            <button 
              onClick={() => { setSource('pocket'); setIsCredit(false); }} 
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
          <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '15px', marginBottom: '20px', border: '1px solid #f1f5f9' }}>
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={isCredit} onChange={e => {setIsCredit(e.target.checked); if(e.target.checked) setIsAgainstDebt(false)}} id="credit" />
              <label htmlFor="credit" style={{fontSize:'13px', fontWeight:'800'}}>ΕΠΙ ΠΙΣΤΩΣΕΙ</label>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '15px' }}>
          <label style={labelStyle}>🏭 ΠΡΟΜΗΘΕΥΤΗΣ</label>
          <select value={selectedSup} onChange={e => {setSelectedSup(e.target.value); setSelectedEmp(''); setSelectedFixed('');}} style={inputStyle}>
            <option value="">— Επιλέξτε —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={labelStyle}>🏢 ΠΑΓΙΟ</label>
          <select value={selectedFixed} onChange={e => {setSelectedFixed(e.target.value); setSelectedSup(''); setSelectedEmp('');}} style={inputStyle}>
            <option value="">— Επιλογή —</option>
            {fixedAssets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: '60px' }} placeholder="..." />
        </div>

        <button onClick={handleSave} style={saveBtn}>ΑΠΟΘΗΚΕΥΣΗ</button>
      </div>
    </main>
  )
}

export default function AddExpensePage() {
  return (
    <Suspense fallback={<div style={{padding: '20px', textAlign: 'center'}}>Φόρτωση...</div>}>
      <AddExpenseForm />
    </Suspense>
  )
}

const formCardStyle = { maxWidth: '500px', margin: '0 auto', backgroundColor: 'white', borderRadius: '28px', padding: '24px', border: '1px solid #e2e8f0' };
const labelStyle: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '5px', display: 'block' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 'bold', backgroundColor: '#f8fafc', boxSizing: 'border-box' };
const sourceBtn: any = { flex: 1, padding: '14px', borderRadius: '12px', border: 'none', fontWeight: '900', fontSize: '12px', cursor: 'pointer' };
const saveBtn: any = { width: '100%', padding: '18px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '16px', cursor: 'pointer' };
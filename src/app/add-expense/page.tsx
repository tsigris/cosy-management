'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// --- ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΠΑΛΕΤΑ ΧΡΩΜΑΤΩΝ ---
const colors = {
  primaryDark: '#1e293b', // Slate 800
  secondaryText: '#64748b', // Slate 500
  accentRed: '#dc2626',   // Red 600
  accentBlue: '#2563eb',  // Blue 600 (Για εξοφλήσεις)
  bgLight: '#f8fafc',     // Slate 50
  border: '#e2e8f0',      // Slate 200
  white: '#ffffff'
};

function AddExpenseForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ΔΙΑΒΑΣΜΑ ΠΑΡΑΜΕΤΡΩΝ ΑΠΟ ΤΟ URL (Για αυτόματη εξόφληση)
  const urlSupId = searchParams.get('supId')
  const isDebtMode = searchParams.get('mode') === 'debt'

  // ΥΠΟΛΟΓΙΣΜΟΣ ΗΜΕΡΟΜΗΝΙΑΣ (07:00 Logic)
  const getBusinessDate = () => {
    const now = new Date()
    if (now.getHours() < 7) {
      now.setDate(now.getDate() - 1)
    }
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const selectedDate = searchParams.get('date') || getBusinessDate()
  
  // Form State
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [notes, setNotes] = useState('')
  const [isCredit, setIsCredit] = useState(false) 
  const [isAgainstDebt, setIsAgainstDebt] = useState(isDebtMode) // Αυτόματο τσεκάρισμα
  const [source, setSource] = useState('store') 
  const [currentUsername, setCurrentUsername] = useState('Χρήστης')
  const [loading, setLoading] = useState(true)

  // Lists
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])
  const [selectedSup, setSelectedSup] = useState(urlSupId || '') // Αυτόματη επιλογή προμηθευτή
  const [selectedFixed, setSelectedFixed] = useState('')

  const loadFormData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase.from('profiles').select('username, store_id').eq('id', session.user.id).maybeSingle()
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
      console.error('Error loading form data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFormData()
    const handleWakeUp = () => {
      if (document.visibilityState === 'visible') loadFormData()
    }
    document.addEventListener('visibilitychange', handleWakeUp)
    window.addEventListener('focus', handleWakeUp)

    return () => {
      document.removeEventListener('visibilitychange', handleWakeUp)
      window.removeEventListener('focus', handleWakeUp)
    }
  }, [loadFormData])

  async function handleSave() {
    if (!amount || Number(amount) <= 0) return alert('Συμπληρώστε το ποσό')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
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
      router.refresh()
    } catch (error: any) {
      alert('Σφάλμα: ' + error.message)
      setLoading(false)
    }
  }

  // Δυναμικό χρώμα ανάλογα με το αν είναι έξοδο ή εξόφληση
  const themeColor = isAgainstDebt ? colors.accentBlue : colors.accentRed;

  return (
    <main style={{ backgroundColor: colors.bgLight, minHeight: '100vh', padding: '16px' }}>
      <div style={formCardStyle}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ ...logoBoxStyle, backgroundColor: isAgainstDebt ? '#dbeafe' : '#fef2f2' }}>
              {isAgainstDebt ? '💳' : '💸'}
            </div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '20px', margin: 0, color: colors.primaryDark }}>
                {isAgainstDebt ? 'Εξόφληση Χρέους' : 'Νέο Έξοδο'}
              </h1>
              <p style={{ margin: 0, fontSize: '10px', color: colors.secondaryText, fontWeight: '700' }}>
                {new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' }).toUpperCase()}
              </p>
            </div>
          </div>
          <Link href={isDebtMode ? "/suppliers-balance" : "/"} style={backBtnStyle}>✕</Link>
        </div>

        <div style={userIndicator}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: colors.secondaryText }}>👤 ΚΑΤΑΧΩΡΗΣΗ: {currentUsername.toUpperCase()}</span>
        </div>

        {/* ΠΗΓΗ ΧΡΗΜΑΤΩΝ */}
        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}>ΠΗΓΗ ΧΡΗΜΑΤΩΝ</label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button 
              type="button"
              onClick={() => { setSource('store'); setIsCredit(false); }} 
              style={{ ...sourceBtn, backgroundColor: source === 'store' ? colors.primaryDark : colors.white, color: source === 'store' ? 'white' : colors.secondaryText, border: source === 'store' ? 'none' : `1px solid ${colors.border}` }}
            >
              🏪 ΤΑΜΕΙΟ
            </button>
            <button 
              type="button"
              onClick={() => { setSource('pocket'); setIsCredit(false); setIsAgainstDebt(false); }} 
              style={{ ...sourceBtn, backgroundColor: source === 'pocket' ? '#8b5cf6' : colors.white, color: source === 'pocket' ? 'white' : colors.secondaryText, border: source === 'pocket' ? 'none' : `1px solid ${colors.border}` }}
            >
              💰 ΤΣΕΠΗ
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1.5 }}>
            <label style={labelStyle}>ΠΟΣΟ (€)</label>
            <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" autoFocus />
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
          <div style={{ ...creditPanel, border: isAgainstDebt ? `2px solid ${colors.accentBlue}` : `1px solid ${colors.border}` }}>
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={isCredit} onChange={e => {setIsCredit(e.target.checked); if(e.target.checked) setIsAgainstDebt(false)}} id="credit" style={checkboxStyle} />
              <label htmlFor="credit" style={checkLabel}>ΕΠΙ ΠΙΣΤΩΣΕΙ (ΝΕΟ ΧΡΕΟΣ)</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={isAgainstDebt} onChange={e => {setIsAgainstDebt(e.target.checked); if(e.target.checked) setIsCredit(false)}} id="against" style={checkboxStyle} />
              <label htmlFor="against" style={{...checkLabel, color: isAgainstDebt ? colors.accentBlue : colors.primaryDark }}>ΕΝΑΝΤΙ ΠΑΛΑΙΟΥ ΧΡΕΟΥ</label>
            </div>
          </div>
        )}

        <div style={selectGroup}>
          <label style={labelStyle}>🏭 ΠΡΟΜΗΘΕΥΤΗΣ</label>
          <select value={selectedSup} onChange={e => {setSelectedSup(e.target.value); setSelectedFixed('');}} style={{...inputStyle, border: urlSupId ? `2px solid ${colors.accentBlue}` : `1px solid ${colors.border}`}}>
            <option value="">— Επιλογή —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div style={selectGroup}>
          <label style={labelStyle}>🏢 ΠΑΓΙΟ / ΛΟΓΑΡΙΑΣΜΟΣ</label>
          <select value={selectedFixed} onChange={e => {setSelectedFixed(e.target.value); setSelectedSup('');}} style={inputStyle}>
            <option value="">— Επιλογή —</option>
            {fixedAssets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: '70px', paddingTop: '12px', fontWeight: '500' }} placeholder="Περιγραφή..." />
        </div>

        <button onClick={handleSave} disabled={loading} style={{ ...saveBtn, backgroundColor: themeColor }}>
          {loading ? 'ΓΙΝΕΤΑΙ ΑΠΟΘΗΚΕΥΣΗ...' : (isAgainstDebt ? 'ΟΛΟΚΛΗΡΩΣΗ ΕΞΟΦΛΗΣΗΣ' : 'ΟΛΟΚΛΗΡΩΣΗ ΕΞΟΔΟΥ')}
        </button>
      </div>
    </main>
  )
}

// --- STYLES ---
const formCardStyle = { maxWidth: '500px', margin: '0 auto', backgroundColor: colors.white, borderRadius: '24px', padding: '24px', border: `1px solid ${colors.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
const logoBoxStyle: any = { width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', fontWeight: 'bold', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgLight, borderRadius: '10px', border: `1px solid ${colors.border}` };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '6px', display: 'block', letterSpacing: '0.5px' };
const inputStyle: any = { width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '15px', fontWeight: '700', backgroundColor: colors.bgLight, boxSizing: 'border-box' as const, outline: 'none', color: colors.primaryDark };
const sourceBtn: any = { flex: 1, padding: '14px', borderRadius: '12px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' };
const userIndicator = { marginBottom: '20px', padding: '8px', backgroundColor: colors.bgLight, borderRadius: '10px', textAlign: 'center' as any, border: `1px solid ${colors.border}` };
const creditPanel = { backgroundColor: colors.bgLight, padding: '16px', borderRadius: '16px', marginBottom: '24px', border: `1px solid ${colors.border}` };
const selectGroup = { marginBottom: '18px' };
const saveBtn: any = { width: '100%', padding: '18px', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '16px', cursor: 'pointer' };
const checkLabel: any = { fontSize: '12px', fontWeight: '700', color: colors.primaryDark, cursor: 'pointer' };
const checkboxStyle = { width: '18px', height: '18px', cursor: 'pointer' };

export default function AddExpensePage() {
  return <Suspense fallback={<div style={{padding:'40px', textAlign:'center', color: colors.secondaryText, fontWeight: '600'}}>Φόρτωση φόρμας...</div>}><AddExpenseForm /></Suspense>
}
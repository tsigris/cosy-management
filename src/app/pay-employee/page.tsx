'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// --- ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΠΑΛΕΤΑ ---
const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff'
};

function PayEmployeeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const empId = searchParams.get('id')
  const empName = searchParams.get('name')

  // 1. ΛΟΓΙΚΗ ΗΜΕΡΟΜΗΝΙΑΣ (07:00)
  const getBusinessDate = () => {
    const now = new Date()
    if (now.getHours() < 7) now.setDate(now.getDate() - 1)
    const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`
  }

  // STATES ΦΟΡΜΑΣ
  const [baseAmount, setBaseAmount] = useState('')
  const [overtime, setOvertime] = useState('')
  const [bonus, setBonus] = useState('')
  const [gift, setGift] = useState('')
  const [allowance, setAllowance] = useState('')
  
  const [method, setMethod] = useState('Μετρητά')
  const [date, setDate] = useState(getBusinessDate())
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState({ store_id: '', username: '' })

  // Υπολογισμός Συνόλου
  const totalAmount = (Number(baseAmount) || 0) + (Number(overtime) || 0) + (Number(bonus) || 0) + (Number(gift) || 0) + (Number(allowance) || 0);

  // 2. WAKE UP & ΦΟΡΤΩΣΗ ΠΡΟΦΙΛ
  const loadProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').select('store_id, username').eq('id', session.user.id).single()
        if (profile) setUserData({ store_id: profile.store_id, username: profile.username || 'Admin' })
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadProfile()
    const handleWakeUp = () => { if (document.visibilityState === 'visible') loadProfile() }
    document.addEventListener('visibilitychange', handleWakeUp)
    return () => document.removeEventListener('visibilitychange', handleWakeUp)
  }, [loadProfile])

  async function handlePayment() {
    if (totalAmount <= 0) return alert('Παρακαλώ εισάγετε ποσά πληρωμής.')
    
    setLoading(true)

    // Δημιουργία αυτόματης περιγραφής για τις σημειώσεις
    const parts = [];
    if (baseAmount) parts.push(`Βασικός: ${baseAmount}€`);
    if (overtime) parts.push(`Υπερ.: ${overtime}€`);
    if (bonus) parts.push(`Bonus: ${bonus}€`);
    if (gift) parts.push(`Δώρο: ${gift}€`);
    if (allowance) parts.push(`Επίδ.: ${allowance}€`);
    const autoNotes = `Πληρωμή ${empName}: ${parts.join(', ')}`;

    const payload = {
      amount: totalAmount,
      type: 'expense',
      category: 'Προσωπικό',
      method: method,
      date,
      employee_id: empId,
      store_id: userData.store_id,
      created_by_name: userData.username,
      notes: autoNotes
    }

    const { error } = await supabase.from('transactions').insert([payload])

    if (!error) {
      router.push('/employees')
      router.refresh()
    } else {
      alert('Σφάλμα: ' + error.message)
      setLoading(false)
    }
  }

  return (
    <div style={iphoneWrapper}>
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '50px' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>💸</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '20px', margin: 0, color: colors.primaryDark }}>Πληρωμή</h1>
              <p style={{ margin: 0, fontSize: '10px', color: colors.secondaryText, fontWeight: '700', letterSpacing: '0.5px' }}>ΕΚΚΑΘΑΡΙΣΗ ΜΙΣΘΟΔΟΣΙΑΣ</p>
            </div>
          </div>
          <Link href="/employees" style={backBtnStyle}>✕</Link>
        </div>

        <div style={formCardStyle}>
          {/* EMPLOYEE INFO */}
          <div style={infoBoxStyle}>
            <p style={labelStyle}>ΥΠΑΛΛΗΛΟΣ</p>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: colors.primaryDark }}>{empName?.toUpperCase()}</p>
          </div>

          {/* ΑΝΑΛΥΣΗ ΠΛΗΡΩΜΗΣ */}
          <p style={{ ...labelStyle, marginBottom: '15px', color: colors.primaryDark }}>ΑΝΑΛΥΣΗ ΑΜΟΙΒΩΝ (€)</p>
          
          <div style={gridInputs}>
            <div style={inputGroup}>
              <label style={subLabel}>ΒΑΣΙΚΟΣ ΜΙΣΘΟΣ</label>
              <input type="number" inputMode="decimal" value={baseAmount} onChange={e => setBaseAmount(e.target.value)} style={smallInput} placeholder="0.00" />
            </div>
            <div style={inputGroup}>
              <label style={subLabel}>ΥΠΕΡΩΡΙΕΣ</label>
              <input type="number" inputMode="decimal" value={overtime} onChange={e => setOvertime(e.target.value)} style={smallInput} placeholder="0.00" />
            </div>
            <div style={inputGroup}>
              <label style={subLabel}>BONUS / TIPS</label>
              <input type="number" inputMode="decimal" value={bonus} onChange={e => setBonus(e.target.value)} style={smallInput} placeholder="0.00" />
            </div>
            <div style={inputGroup}>
              <label style={subLabel}>ΔΩΡΑ (ΧΡΙΣΤ./ΠΑΣΧΑ)</label>
              <input type="number" inputMode="decimal" value={gift} onChange={e => setGift(e.target.value)} style={smallInput} placeholder="0.00" />
            </div>
            <div style={inputGroup}>
              <label style={subLabel}>ΕΠΙΔΟΜΑΤΑ</label>
              <input type="number" inputMode="decimal" value={allowance} onChange={e => setAllowance(e.target.value)} style={smallInput} placeholder="0.00" />
            </div>
          </div>

          {/* ΣΥΝΟΛΟ & ΤΡΟΠΟΣ */}
          <div style={totalDisplayCard}>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: colors.secondaryText, letterSpacing: '1px' }}>ΣΥΝΟΛΙΚΗ ΠΛΗΡΩΜΗ</p>
              <h2 style={{ margin: '5px 0 0', fontSize: '36px', fontWeight: '900', color: colors.accentBlue }}>
                  {totalAmount.toFixed(2)}€
              </h2>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>ΤΡΟΠΟΣ ΠΛΗΡΩΜΗΣ</label>
              <select value={method} onChange={e => setMethod(e.target.value)} style={selectStyle}>
                <option value="Μετρητά">💵 Μετρητά</option>
                <option value="Τράπεζα">🏦 Τράπεζα</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>ΗΜΕΡΟΜΗΝΙΑ</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={selectStyle} />
            </div>
          </div>

          <button onClick={handlePayment} disabled={loading || totalAmount === 0} style={saveBtnStyle}>
            {loading ? 'ΓΙΝΕΤΑΙ ΚΑΤΑΧΩΡΗΣΗ...' : 'ΕΠΙΒΕΒΑΙΩΣΗ & ΑΠΟΘΗΚΕΥΣΗ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- STYLES ---
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#dbeafe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', fontWeight: 'bold', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` };
const formCardStyle: any = { backgroundColor: colors.white, padding: '24px', borderRadius: '24px', border: `1px solid ${colors.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
const infoBoxStyle: any = { padding: '16px', backgroundColor: colors.bgLight, borderRadius: '16px', marginBottom: '25px', border: `1px solid ${colors.border}`, textAlign: 'center' as any };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '8px', display: 'block', letterSpacing: '0.5px' };
const subLabel: any = { fontSize: '9px', fontWeight: '700', color: colors.secondaryText, marginBottom: '4px', display: 'block' };
const gridInputs: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '25px' };
const inputGroup: any = { display: 'flex', flexDirection: 'column' };
const smallInput: any = { width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${colors.border}`, fontSize: '14px', fontWeight: '700', backgroundColor: colors.bgLight, outline: 'none', color: colors.primaryDark };
const selectStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '14px', fontWeight: '700', backgroundColor: colors.bgLight, outline: 'none', color: colors.primaryDark };
const totalDisplayCard: any = { padding: '25px 20px', backgroundColor: '#eff6ff', borderRadius: '20px', textAlign: 'center', marginBottom: '25px', border: '1px solid #bfdbfe' };
const saveBtnStyle: any = { width: '100%', padding: '18px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', boxShadow: '0 10px 20px rgba(30, 41, 59, 0.2)' };

export default function PayEmployeePage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><PayEmployeeContent /></Suspense></main>
}
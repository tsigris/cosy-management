'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// --- ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΠΑΛΕΤΑ ΧΡΩΜΑΤΩΝ ---
const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff'
};

function PayEmployeeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const empId = searchParams.get('id')
  const empName = searchParams.get('name')

  const getBusinessDate = () => {
    const now = new Date()
    if (now.getHours() < 7) now.setDate(now.getDate() - 1)
    const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`
  }

  // STATES
  const [baseSalary, setBaseSalary] = useState('')
  const [overtime, setOvertime] = useState('')
  const [bonus, setBonus] = useState('')
  const [gift, setGift] = useState('')
  const [allowance, setAllowance] = useState('')
  const [paidBank, setPaidBank] = useState('')
  const [paidCash, setPaidCash] = useState('')
  const [date, setDate] = useState(getBusinessDate())
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState({ store_id: '', username: '' })

  // ΥΠΟΛΟΓΙΣΜΟΙ
  const totalEarnings = (Number(baseSalary) || 0) + (Number(overtime) || 0) + (Number(bonus) || 0) + (Number(gift) || 0) + (Number(allowance) || 0);
  const totalPaid = (Number(paidBank) || 0) + (Number(paidCash) || 0);
  const difference = totalEarnings - totalPaid;

  // ΦΟΡΤΩΣΗ ΠΡΟΦΙΛ & ΑΥΤΟΜΑΤΟΥ ΜΙΣΘΟΥ (monthly_salary)
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: profile } = await supabase.from('profiles').select('store_id, username').eq('id', session.user.id).maybeSingle()
      if (profile) setUserData({ store_id: profile.store_id, username: profile.username || 'Admin' })

      if (empId) {
        // ΔΙΟΡΘΩΣΗ: Χρησιμοποιούμε τη στήλη monthly_salary
        const { data: employee } = await supabase.from('employees').select('monthly_salary').eq('id', empId).maybeSingle()
        if (employee?.monthly_salary) {
          setBaseSalary(employee.monthly_salary.toString())
        }
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [empId])

  useEffect(() => {
    loadData()
    const handleWakeUp = () => { if (document.visibilityState === 'visible') loadData() }
    document.addEventListener('visibilitychange', handleWakeUp)
    return () => document.removeEventListener('visibilitychange', handleWakeUp)
  }, [loadData])

  async function handlePayment() {
    if (totalEarnings <= 0) return alert('Εισάγετε ποσά στις αμοιβές.')
    if (Math.abs(difference) > 0.01) return alert(`Πρέπει να κατανείμετε όλο το ποσό (${totalEarnings.toFixed(2)}€) σε Τράπεζα ή Μετρητά για να είναι σωστή η λογιστική εγγραφή.`);
    
    setLoading(true)
    const parts = [];
    if (baseSalary) parts.push(`Βασικός: ${baseSalary}€`);
    if (overtime) parts.push(`Υπερ.: ${overtime}€`);
    if (bonus) parts.push(`Bonus: ${bonus}€`);
    if (gift) parts.push(`Δώρο: ${gift}€`);
    if (allowance) parts.push(`Επίδ.: ${allowance}€`);
    const breakdownText = parts.join(', ');

    const transactionBatch = [];
    if (Number(paidBank) > 0) {
      transactionBatch.push({
        amount: Number(paidBank),
        type: 'expense',
        category: 'Προσωπικό',
        method: 'Τράπεζα',
        date,
        employee_id: empId,
        store_id: userData.store_id,
        created_by_name: userData.username,
        notes: `Πληρωμή ${empName} (Τράπεζα) [${breakdownText}]`
      });
    }
    if (Number(paidCash) > 0) {
      transactionBatch.push({
        amount: Number(paidCash),
        type: 'expense',
        category: 'Προσωπικό',
        method: 'Μετρητά',
        date,
        employee_id: empId,
        store_id: userData.store_id,
        created_by_name: userData.username,
        notes: `Πληρωμή ${empName} (Μετρητά) [${breakdownText}]`
      });
    }

    const { error } = await supabase.from('transactions').insert(transactionBatch)
    if (!error) { router.push('/employees'); router.refresh(); } 
    else { alert(error.message); setLoading(false); }
  }

  return (
    <div style={iphoneWrapper}>
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '50px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>💸</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '20px', margin: 0, color: colors.primaryDark }}>Πληρωμή</h1>
              <p style={{ margin: 0, fontSize: '10px', color: colors.secondaryText, fontWeight: '700' }}>ΕΚΚΑΘΑΡΙΣΗ ΜΙΣΘΟΔΟΣΙΑΣ</p>
            </div>
          </div>
          <Link href="/employees" style={backBtnStyle}>✕</Link>
        </div>

        <div style={formCardStyle}>
          <div style={infoBoxStyle}>
            <p style={labelStyle}>ΥΠΑΛΛΗΛΟΣ</p>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: colors.primaryDark }}>{empName?.toUpperCase()}</p>
          </div>

          <p style={sectionTitle}>1. ΑΝΑΛΥΣΗ ΑΜΟΙΒΩΝ (€)</p>
          <div style={gridInputs}>
            <div style={inputGroup}>
              <label style={subLabel}>ΒΑΣΙΚΟΣ (AUTO)</label>
              <input type="number" inputMode="decimal" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} style={{...smallInput, border: '2px solid #cbd5e1'}} />
            </div>
            <div style={inputGroup}><label style={subLabel}>ΥΠΕΡΩΡΙΕΣ</label><input type="number" inputMode="decimal" value={overtime} onChange={e => setOvertime(e.target.value)} style={smallInput} /></div>
            <div style={inputGroup}><label style={subLabel}>BONUS</label><input type="number" inputMode="decimal" value={bonus} onChange={e => setBonus(e.target.value)} style={smallInput} /></div>
            <div style={inputGroup}><label style={subLabel}>ΔΩΡΑ</label><input type="number" inputMode="decimal" value={gift} onChange={e => setGift(e.target.value)} style={smallInput} /></div>
            <div style={inputGroup}><label style={subLabel}>ΕΠΙΔΟΜΑΤΑ</label><input type="number" inputMode="decimal" value={allowance} onChange={e => setAllowance(e.target.value)} style={smallInput} /></div>
            <div style={totalEarningsBox}>
              <label style={subLabel}>ΣΥΝΟΛΟ ΑΜΟΙΒΩΝ</label>
              <p style={{margin:0, fontWeight:'900', color:colors.primaryDark, fontSize:'16px'}}>{totalEarnings.toFixed(2)}€</p>
            </div>
          </div>

          <p style={{ ...sectionTitle, color: colors.accentBlue, marginTop: '20px' }}>2. ΚΑΤΑΝΟΜΗ ΠΛΗΡΩΜΗΣ (€)</p>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={subLabel}>🏦 ΤΡΑΠΕΖΑ</label>
              <input type="number" inputMode="decimal" value={paidBank} onChange={e => setPaidBank(e.target.value)} style={{ ...smallInput, borderColor: colors.accentBlue }} placeholder="0.00" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={subLabel}>💵 ΜΕΤΡΗΤΑ</label>
              <input type="number" inputMode="decimal" value={paidCash} onChange={e => setPaidCash(e.target.value)} style={{ ...smallInput, borderColor: colors.accentGreen }} placeholder="0.00" />
            </div>
          </div>

          {/* STATUS CARD */}
          <div style={{ ...statusCard, backgroundColor: (Math.abs(difference) < 0.01 && totalEarnings > 0) ? '#f0fdf4' : '#fff1f2' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: colors.secondaryText }}>ΕΛΕΓΧΟΣ ΥΠΟΛΟΙΠΟΥ</p>
            <p style={{ margin: '4px 0 0', fontWeight: '900', color: (Math.abs(difference) < 0.01 && totalEarnings > 0) ? colors.accentGreen : colors.accentRed }}>
              {(Math.abs(difference) < 0.01 && totalEarnings > 0) ? '✓ ΤΑ ΠΟΣΑ ΤΑΥΤΙΖΟΝΤΑΙ' : `ΑΔΙΑΘΕΤΟ ΠΟΣΟ: ${difference.toFixed(2)}€`}
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>ΗΜΕΡΟΜΗΝΙΑ</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={selectStyle} />
          </div>

          <button onClick={handlePayment} disabled={loading || totalEarnings === 0 || Math.abs(difference) > 0.01} style={{ ...saveBtnStyle, opacity: (totalEarnings === 0 || Math.abs(difference) > 0.01) ? 0.5 : 1 }}>
            {loading ? 'ΚΑΤΑΧΩΡΗΣΗ...' : 'ΟΛΟΚΛΗΡΩΣΗ ΠΛΗΡΩΜΗΣ'}
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
const infoBoxStyle: any = { padding: '16px', backgroundColor: colors.bgLight, borderRadius: '16px', marginBottom: '25px', border: `1px solid ${colors.border}`, textAlign: 'center' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '8px', display: 'block', letterSpacing: '0.5px' };
const sectionTitle: any = { fontSize: '11px', fontWeight: '900', color: colors.primaryDark, marginBottom: '15px', letterSpacing: '0.5px' };
const subLabel: any = { fontSize: '9px', fontWeight: '700', color: colors.secondaryText, marginBottom: '4px', display: 'block' };
const gridInputs: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' };
const inputGroup: any = { display: 'flex', flexDirection: 'column' };
const smallInput: any = { width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${colors.border}`, fontSize: '14px', fontWeight: '700', backgroundColor: colors.bgLight, outline: 'none', color: colors.primaryDark, boxSizing: 'border-box' };
const totalEarningsBox: any = { ...inputGroup, backgroundColor: '#f1f5f9', padding: '10px', borderRadius: '10px', justifyContent: 'center', alignItems: 'center', border: '1px dashed #cbd5e1' };
const statusCard: any = { padding: '15px', borderRadius: '16px', textAlign: 'center', marginBottom: '25px', border: '1px solid #e2e8f0' };
const selectStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '14px', fontWeight: '700', backgroundColor: colors.bgLight, outline: 'none', color: colors.primaryDark, boxSizing: 'border-box' };
const saveBtnStyle: any = { width: '100%', padding: '18px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', boxShadow: '0 10px 20px rgba(30, 41, 59, 0.2)' };

export default function PayEmployeePage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><PayEmployeeContent /></Suspense></main>
}
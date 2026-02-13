'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'

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
    return now.toISOString().split('T')[0]
  }

  // STATES ΥΠΟΛΟΓΙΣΜΟΥ
  const [agreementSalary, setAgreementSalary] = useState<number>(1000)
  const [agreementDays, setAgreementDays] = useState<number>(26)
  const [absences, setAbsences] = useState<number>(0)
  const [extraDays, setExtraDays] = useState<number>(0)

  // ΛΟΙΠΑ STATES
  const [overtime, setOvertime] = useState('')
  const [bonus, setBonus] = useState('')
  const [gift, setGift] = useState('')
  const [allowance, setAllowance] = useState('')
  const [paidBank, setPaidBank] = useState('')
  const [paidCash, setPaidCash] = useState('')
  const [date, setDate] = useState(getBusinessDate())
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState({ store_id: '', username: '' })

  // ΔΥΝΑΜΙΚΟΙ ΥΠΟΛΟΓΙΣΜΟΙ
  const dailyRate = agreementSalary / agreementDays;
  const calculatedBase = (agreementDays - absences + extraDays) * dailyRate;
  
  const totalEarnings = calculatedBase + (Number(overtime) || 0) + (Number(bonus) || 0) + (Number(gift) || 0) + (Number(allowance) || 0);
  const totalPaid = (Number(paidBank) || 0) + (Number(paidCash) || 0);
  const difference = totalEarnings - totalPaid;

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: profile } = await supabase.from('profiles').select('store_id, username').eq('id', session.user.id).maybeSingle()
      if (profile) setUserData({ store_id: profile.store_id, username: profile.username || 'Admin' })

      if (empId) {
        const { data: employee } = await supabase.from('employees').select('monthly_salary, monthly_days').eq('id', empId).maybeSingle()
        if (employee) {
          setAgreementSalary(employee.monthly_salary || 1000)
          setAgreementDays(employee.monthly_days || 26)
        }
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [empId])

  useEffect(() => { loadData() }, [loadData])

  // Αυτόματη συμπλήρωση τράπεζας όταν αλλάζει το σύνολο ή τα μετρητά
  useEffect(() => {
    const remaining = totalEarnings - (Number(paidCash) || 0);
    setPaidBank(remaining > 0 ? remaining.toFixed(2) : '0');
  }, [totalEarnings, paidCash]);

  async function handlePayment() {
    if (totalEarnings <= 0) return toast.error('Εισάγετε ποσά στις αμοιβές.')
    if (Math.abs(difference) > 0.01) return toast.error('Σφάλμα στην κατανομή ποσών.');
    
    setLoading(true)
    const breakdownText = `Βασικός(${agreementDays-absences+extraDays}ημ): ${calculatedBase.toFixed(2)}€, Bonus: ${bonus || 0}€`;

    const transactionBatch = [];
    if (Number(paidBank) > 0) {
      transactionBatch.push({
        amount: Number(paidBank), type: 'expense', category: 'Προσωπικό', method: 'Τράπεζα',
        date, employee_id: empId, store_id: userData.store_id, created_by_name: userData.username,
        notes: `Πληρωμή ${empName} (Τράπεζα) [${breakdownText}]`
      });
    }
    if (Number(paidCash) > 0) {
      transactionBatch.push({
        amount: Number(paidCash), type: 'expense', category: 'Προσωπικό', method: 'Μετρητά',
        date, employee_id: empId, store_id: userData.store_id, created_by_name: userData.username,
        notes: `Πληρωμή ${empName} (Μετρητά) [${breakdownText}]`
      });
    }

    const { error } = await supabase.from('transactions').insert(transactionBatch)
    if (!error) { 
      toast.success('Η πληρωμή καταχωρήθηκε!');
      router.push('/employees'); 
      router.refresh(); 
    } else { 
      toast.error(error.message); 
      setLoading(false); 
    }
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '50px' }}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>💸</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '18px', margin: 0 }}>Πληρωμή</h1>
              <p style={{ margin: 0, fontSize: '10px', color: colors.secondaryText, fontWeight: '700' }}>{empName?.toUpperCase()}</p>
            </div>
          </div>
          <Link href="/employees" style={backBtnStyle}>✕</Link>
        </div>

        <div style={formCardStyle}>
          {/* ΣΥΜΦΩΝΙΑ & ΥΠΟΛΟΓΙΣΜΟΣ */}
          <p style={sectionTitle}>1. ΣΥΜΦΩΝΙΑ & ΗΜΕΡΕΣ</p>
          <div style={agreementGrid}>
            <div style={inputGroup}>
              <label style={subLabel}>ΣΥΜΦΩΝΙΑ</label>
              <select value={agreementDays} onChange={e => setAgreementDays(Number(e.target.value))} style={selectStyle}>
                <option value={30}>30 Ημέρες (Χωρίς Ρεπό)</option>
                <option value={26}>26 Ημέρες (1 Ρεπό)</option>
                <option value={22}>22 Ημέρες (2 Ρεπό)</option>
                <option value={8}>8 Ημέρες (Μόνο ΣΚ)</option>
              </select>
            </div>
            <div style={inputGroup}>
              <label style={subLabel}>ΜΙΣΘΟΣ (€)</label>
              <input type="number" value={agreementSalary} onChange={e => setAgreementSalary(Number(e.target.value))} style={smallInput} />
            </div>
          </div>

          <div style={gridInputs}>
            <div style={inputGroup}>
              <label style={subLabel}>ΑΠΟΥΣΙΕΣ (-)</label>
              <input type="number" value={absences} onChange={e => setAbsences(Number(e.target.value))} style={{...smallInput, color: colors.accentRed}} />
            </div>
            <div style={inputGroup}>
              <label style={subLabel}>ΕΞΤΡΑ (+)</label>
              <input type="number" value={extraDays} onChange={e => setExtraDays(Number(e.target.value))} style={{...smallInput, color: colors.accentGreen}} />
            </div>
          </div>

          {/* ΑΝΑΛΥΣΗ ΑΜΟΙΒΩΝ */}
          <p style={{...sectionTitle, marginTop: '20px'}}>2. ΑΝΑΛΥΣΗ ΑΜΟΙΒΩΝ (€)</p>
          <div style={gridInputs}>
            <div style={inputGroup}>
              <label style={subLabel}>ΒΑΣΙΚΟΣ (ΥΠΟΛΟΓΙΣΜΟΣ)</label>
              <div style={calcBox}>{calculatedBase.toFixed(2)}€</div>
            </div>
            <div style={inputGroup}><label style={subLabel}>ΥΠΕΡΩΡΙΕΣ</label><input type="number" value={overtime} onChange={e => setOvertime(e.target.value)} style={smallInput} /></div>
            <div style={inputGroup}><label style={subLabel}>BONUS</label><input type="number" value={bonus} onChange={e => setBonus(e.target.value)} style={smallInput} /></div>
            <div style={inputGroup}><label style={subLabel}>ΕΠΙΔΟΜΑΤΑ</label><input type="number" value={allowance} onChange={e => setAllowance(e.target.value)} style={smallInput} /></div>
          </div>

          {/* ΤΟ ΠΛΑΙΣΙΟ ΤΡΑΠΕΖΑΣ (ΛΟΓΙΣΤΗΣ) */}
          <div style={bankFrameStyle}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                    <label style={{fontSize:'10px', fontWeight:'800', color:colors.accentBlue}}>ΠΡΟΣ ΚΑΤΑΘΕΣΗ (ΤΡΑΠΕΖΑ)</label>
                    <p style={{margin:0, fontSize:'22px', fontWeight:'900', color:colors.primaryDark}}>{Number(paidBank).toFixed(2)}€</p>
                </div>
                <div style={{textAlign:'right'}}>
                    <label style={subLabel}>ΣΥΝΟΛΟ ΜΙΚΤΑ</label>
                    <p style={{margin:0, fontWeight:'700'}}>{totalEarnings.toFixed(2)}€</p>
                </div>
            </div>
          </div>

          <div style={{marginTop: '20px'}}>
              <label style={subLabel}>💵 ΜΕΤΡΗΤΑ / ΠΡΟΚΑΤΑΒΟΛΗ (€)</label>
              <input type="number" value={paidCash} onChange={e => setPaidCash(e.target.value)} style={{...smallInput, border: '2px solid' + colors.accentGreen}} placeholder="Ποσό στο χέρι" />
          </div>

          <div style={{ marginTop: '20px' }}>
            <label style={subLabel}>ΗΜΕΡΟΜΗΝΙΑ ΚΑΤΑΧΩΡΗΣΗΣ</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={smallInput} />
          </div>

          <button onClick={handlePayment} disabled={loading || totalEarnings <= 0} style={saveBtnStyle}>
            {loading ? 'ΚΑΤΑΧΩΡΗΣΗ...' : 'ΟΛΟΚΛΗΡΩΣΗ ΠΛΗΡΩΜΗΣ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- STYLES (ΠΡΟΣΑΡΜΟΣΜΕΝΑ) ---
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflowY: 'auto' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#eff6ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}`, fontWeight: 'bold' };
const formCardStyle: any = { backgroundColor: colors.white, padding: '24px', borderRadius: '24px', border: `1px solid ${colors.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
const sectionTitle: any = { fontSize: '11px', fontWeight: '900', color: colors.primaryDark, marginBottom: '15px', letterSpacing: '0.5px' };
const subLabel: any = { fontSize: '9px', fontWeight: '800', color: colors.secondaryText, marginBottom: '5px', display: 'block' };
const agreementGrid: any = { display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px', marginBottom: '12px' };
const gridInputs: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' };
const inputGroup: any = { display: 'flex', flexDirection: 'column' };
const smallInput: any = { width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${colors.border}`, fontSize: '14px', fontWeight: '700', backgroundColor: colors.bgLight, color: colors.primaryDark, outline: 'none', boxSizing: 'border-box' };
const selectStyle: any = { ...smallInput, cursor: 'pointer' };
const calcBox: any = { ...smallInput, backgroundColor: '#f1f5f9', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center' };
const bankFrameStyle: any = { marginTop: '20px', padding: '18px', backgroundColor: '#eff6ff', borderRadius: '18px', border: '2px solid #bfdbfe' };
const saveBtnStyle: any = { width: '100%', padding: '18px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', marginTop: '25px', boxShadow: '0 8px 16px rgba(30, 41, 59, 0.2)' };

export default function PayEmployeePage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><PayEmployeeContent /></Suspense></main>
}
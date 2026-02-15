'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'

// ΧΡΩΜΑΤΑ & STYLES
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

  // STATES
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState({ store_id: '', username: '' })
  const [agreement, setAgreement] = useState({ type: 'monthly', salary: 1000, days: 26, rate: 50 });
  const [workData, setWorkData] = useState({ absences: 0, workedDays: 1 });
  const [extra, setExtra] = useState({ overtime: '', bonus: '', gifts: '', bank: '' });
  
  // TIPS STATE (Local Management)
  const [tipsList, setTipsList] = useState<{id: number, amount: number}[]>([]);
  const [currentTip, setCurrentTip] = useState('');

  // OVERTIMES STATE (From DB)
  const [overtimeList, setOvertimeList] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const loadData = useCallback(async () => {
    if (!empId) return;
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      
      const { data: profile } = await supabase.from('profiles').select('store_id, username').eq('id', session.user.id).maybeSingle()
      if (profile) setUserData({ store_id: profile.store_id, username: profile.username || 'Admin' })

      const [empRes, otRes] = await Promise.all([
        supabase.from('employees').select('*').eq('id', empId).maybeSingle(),
        supabase.from('employee_overtimes').select('*').eq('employee_id', empId).eq('is_paid', false).order('created_at', { ascending: false })
      ])

      if (empRes.data) {
        const e = empRes.data;
        setAgreement({ type: e.pay_basis || 'monthly', salary: e.monthly_salary || 1000, days: e.monthly_days || 26, rate: e.daily_rate || 50 });
      }
      if (otRes.data) setOvertimeList(otRes.data);
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [empId])

  useEffect(() => { loadData() }, [loadData])

  // TIPS LOGIC
  const addTip = () => {
    if (!currentTip || isNaN(Number(currentTip))) return;
    setTipsList([...tipsList, { id: Date.now(), amount: Number(currentTip) }]);
    setCurrentTip('');
  };

  const deleteTip = (id: number) => setTipsList(tipsList.filter(t => t.id !== id));

  const editTip = (id: number) => {
    const tip = tipsList.find(t => t.id === id);
    const newAmount = window.prompt("Αλλαγή ποσού Tip:", tip?.amount.toString());
    if (newAmount) setTipsList(tipsList.map(t => t.id === id ? { ...t, amount: Number(newAmount) } : t));
  };

  // CALCULATIONS
  const basePay = agreement.type === 'monthly' 
    ? (agreement.salary / agreement.days) * (agreement.days - workData.absences)
    : workData.workedDays * agreement.rate;

  const totalTips = tipsList.reduce((sum, t) => sum + t.amount, 0);
  const totalEarnings = basePay + (Number(extra.overtime) || 0) + (Number(extra.bonus) || 0) + (Number(extra.gifts) || 0) + totalTips;
  const autoCashAmount = totalEarnings - (Number(extra.bank) || 0);

  // FINAL SUBMIT
  async function handlePayment() {
    if (totalEarnings <= 0) return toast.error('Το ποσό πρέπει να είναι > 0');
    setLoading(true);
    try {
      const breakdown = `Σύνολο: ${totalEarnings.toFixed(2)}€ (Τράπεζα: ${extra.bank}€, Μετρητά: ${autoCashAmount.toFixed(2)}€, Tips: ${totalTips}€)`;
      const common = { type: 'expense', category: 'Προσωπικό', date, employee_id: empId, store_id: userData.store_id };
      const transactions = [];

      if (Number(extra.bank) > 0) transactions.push({ ...common, amount: Number(extra.bank), method: 'Τράπεζα', notes: `Μισθοδοσία ${empName} (Τράπεζα) [${breakdown}]` });
      if (autoCashAmount > 0) transactions.push({ ...common, amount: autoCashAmount, method: 'Μετρητά', notes: `Μισθοδοσία ${empName} (Μετρητά) [${breakdown}]` });

      const { data: transData, error: transError } = await supabase.from('transactions').insert(transactions).select();
      if (transError) throw transError;

      // Mark Overtimes as paid
      if (overtimeList.length > 0) {
        await supabase.from('employee_overtimes').update({ is_paid: true, transaction_id: transData[0].id }).in('id', overtimeList.map(o => o.id));
      }

      toast.success('Η πληρωμή ολοκληρώθηκε!');
      router.push('/employees');
    } catch (err: any) { toast.error(err.message); setLoading(false); }
  }

  return (
    <div style={styles.iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
        
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={styles.logoBox}>⚖️</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '18px', margin: 0 }}>Εκκαθάριση</h1>
              <p style={styles.subText}>{empName?.toUpperCase()}</p>
            </div>
          </div>
          <Link href="/employees" style={styles.backBtn}>✕</Link>
        </div>

        <div style={styles.formCard}>
          {/* TYPE TOGGLE */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            {['monthly', 'daily'].map(t => (
              <button key={t} onClick={() => setAgreement({...agreement, type: t})} style={agreement.type === t ? styles.activeTab : styles.inactiveTab}>
                {t === 'monthly' ? 'ΜΗΝΙΑΙΟΣ' : 'ΗΜΕΡΟΜΙΣΘΙΟ'}
              </button>
            ))}
          </div>

          <div style={styles.grid2}>
            {agreement.type === 'monthly' ? (
              <>
                <div style={styles.inputGroup}><label style={styles.subLabel}>ΣΥΜΦΩΝΙΑ (ΗΜΕΡΕΣ)</label>
                  <select value={agreement.days} onChange={e => setAgreement({...agreement, days: Number(e.target.value)})} style={styles.input}>
                    {[22, 26, 30].map(d => <option key={d} value={d}>{d} Ημέρες</option>)}
                  </select>
                </div>
                <div style={styles.inputGroup}><label style={styles.subLabel}>ΑΠΟΥΣΙΕΣ (-)</label>
                  <input type="number" value={workData.absences} onChange={e => setWorkData({...workData, absences: Number(e.target.value)})} style={styles.input} />
                </div>
              </>
            ) : (
              <>
                <div style={styles.inputGroup}><label style={styles.subLabel}>ΗΜΕΡΟΜΙΣΘΙΟ (€)</label>
                  <input type="number" value={agreement.rate} onChange={e => setAgreement({...agreement, rate: Number(e.target.value)})} style={styles.input} />
                </div>
                <div style={styles.inputGroup}><label style={styles.subLabel}>ΗΜΕΡΕΣ ΕΡΓΑΣΙΑΣ</label>
                  <input type="number" value={workData.workedDays} onChange={e => setWorkData({...workData, workedDays: Number(e.target.value)})} style={styles.input} />
                </div>
              </>
            )}
          </div>

          {/* EXTRA & TIPS */}
          <p style={styles.sectionTitle}>EXTRA ΠΑΡΟΧΕΣ & TIPS (€)</p>
          <div style={styles.grid3}>
            <input type="number" placeholder="Υπερωρίες" value={extra.overtime} onChange={e => setExtra({...extra, overtime: e.target.value})} style={{...styles.input, border: `1px solid ${colors.accentBlue}`}} />
            <input type="number" placeholder="Bonus" value={extra.bonus} onChange={e => setExtra({...extra, bonus: e.target.value})} style={styles.input} />
            <input type="number" placeholder="Δώρα" value={extra.gifts} onChange={e => setExtra({...extra, gifts: e.target.value})} style={styles.input} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <input type="number" placeholder="Ποσό Tip..." value={currentTip} onChange={(e) => setCurrentTip(e.target.value)} style={styles.input} />
            <button onClick={addTip} style={styles.addTipBtn}>+ TIP</button>
          </div>

          {/* TIPS LIST */}
          {tipsList.length > 0 && (
            <div style={styles.tipsContainer}>
              {tipsList.map(tip => (
                <div key={tip.id} style={styles.tipRow}>
                  <span style={{fontWeight: '800'}}>💰 {tip.amount.toFixed(2)}€</span>
                  <div style={{display: 'flex', gap: '5px'}}>
                    <button onClick={() => editTip(tip.id)} style={styles.miniBtn}>✏️</button>
                    <button onClick={() => deleteTip(tip.id)} style={styles.miniBtnRed}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={styles.accountingBox}>
            <label style={{ fontSize: '10px', fontWeight: '900', color: colors.accentBlue }}>📄 ΤΡΑΠΕΖΙΚΗ ΚΑΤΑΘΕΣΗ (ΛΟΓΙΣΤΗ)</label>
            <input type="number" value={extra.bank} onChange={e => setExtra({...extra, bank: e.target.value})} style={styles.accountingInput} placeholder="0.00" />
          </div>

          <div style={styles.resultRow}>
            <div style={styles.resItem}><label style={styles.subLabel}>ΣΥΝΟΛΟ</label><p style={styles.amount}>{totalEarnings.toFixed(2)}€</p></div>
            <div style={styles.resItem}><label style={styles.subLabel}>ΜΕΤΡΗΤΑ</label><p style={{ ...styles.amount, color: colors.accentGreen }}>{autoCashAmount.toFixed(2)}€</p></div>
          </div>

          <button onClick={handlePayment} disabled={loading || totalEarnings <= 0} style={styles.saveBtn}>
            {loading ? 'ΚΑΤΑΧΩΡΗΣΗ...' : 'ΟΛΟΚΛΗΡΩΣΗ ΠΛΗΡΩΜΗΣ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- STYLES OBJECT ---
const styles: any = {
  iphoneWrapper: { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  logoBox: { width: '42px', height: '42px', backgroundColor: '#e0f2fe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' },
  subText: { margin: 0, fontSize: '10px', color: colors.secondaryText, fontWeight: '700' },
  backBtn: { textDecoration: 'none', color: colors.secondaryText, width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` },
  formCard: { backgroundColor: colors.white, padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' },
  subLabel: { fontSize: '9px', fontWeight: '800', color: colors.secondaryText, marginBottom: '5px', display: 'block' },
  sectionTitle: { fontSize: '10px', fontWeight: '900', color: colors.primaryDark, margin: '20px 0 10px' },
  input: { width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${colors.border}`, fontSize: '14px', fontWeight: '700', outline: 'none' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' },
  activeTab: { flex: 1, padding: '10px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '700' },
  inactiveTab: { flex: 1, padding: '10px', backgroundColor: '#f1f5f9', color: colors.secondaryText, border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '700' },
  addTipBtn: { backgroundColor: colors.accentBlue, color: 'white', border: 'none', borderRadius: '10px', padding: '0 15px', fontWeight: '800', fontSize: '10px' },
  tipsContainer: { backgroundColor: '#f8fafc', padding: '10px', borderRadius: '12px', margin: '10px 0', border: `1px solid ${colors.border}` },
  tipRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '8px 12px', borderRadius: '8px', marginBottom: '5px', border: `1px solid ${colors.border}` },
  accountingBox: { padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '15px', margin: '15px 0', border: `1px solid #bae6fd` },
  accountingInput: { width: '100%', padding: '10px', marginTop: '5px', borderRadius: '8px', border: `2px solid ${colors.accentBlue}`, fontSize: '18px', fontWeight: '900', outline: 'none' },
  resultRow: { display: 'flex', gap: '20px', marginTop: '10px' },
  amount: { margin: 0, fontSize: '22px', fontWeight: '900' },
  miniBtn: { border: 'none', background: '#f1f5f9', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer' },
  miniBtnRed: { border: 'none', background: '#fee2e2', color: colors.accentRed, borderRadius: '6px', padding: '5px 10px', cursor: 'pointer' },
  saveBtn: { width: '100%', padding: '18px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', marginTop: '25px', cursor: 'pointer' }
};

export default function PayEmployeePage() {
  return (
    <main><Suspense fallback={<div>Φόρτωση...</div>}><PayEmployeeContent /></Suspense></main>
  );
}
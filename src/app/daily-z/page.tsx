'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, subHours } from 'date-fns'

export default function DailyZPage() {
  const router = useRouter()
  const [cashZ, setCashZ] = useState('')      
  const [posZ, setPosZ] = useState('')        
  const [noTax, setNoTax] = useState('')      
  
  const [date, setDate] = useState(() => {
    const now = new Date()
    return format(subHours(now, 7), 'yyyy-MM-dd')
  })
  
  const [loading, setLoading] = useState(false)
  const [isAlreadyClosed, setIsAlreadyClosed] = useState(false)
  const [username, setUsername] = useState('Admin')

  // Έλεγχος αν υπάρχει ήδη Ζ
  useEffect(() => {
    async function checkExistingZ() {
      const { data } = await supabase
        .from('transactions')
        .select('id')
        .eq('category', 'Εσοδα Ζ')
        .eq('date', date)
        .limit(1)
      
      setIsAlreadyClosed(data && data.length > 0 ? true : false)
    }
    checkExistingZ()
  }, [date])

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('username').eq('id', user.id).single()
        if (data?.username) setUsername(data.username)
      }
    }
    fetchUser()
  }, [])

  const totalSales = Number(cashZ) + Number(posZ) + Number(noTax)

  async function handleSaveZ() {
    if (isAlreadyClosed) return
    if (totalSales <= 0) return alert('Παρακαλώ συμπληρώστε τα ποσά.')
    setLoading(true)

    const incomeTransactions = [
      { amount: Number(cashZ), method: 'Μετρητά (Ζ)', notes: 'Ζ ΤΑΜΕΙΑΚΗΣ', type: 'income', date, category: 'Εσοδα Ζ', created_by_name: username },
      { amount: Number(posZ), method: 'Κάρτα', notes: 'Ζ ΤΑΜΕΙΑΚΗΣ (POS)', type: 'income', date, category: 'Εσοδα Ζ', created_by_name: username },
      { amount: Number(noTax), method: 'Μετρητά', notes: 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ', type: 'income', date, category: 'Εσοδα Ζ', created_by_name: username }
    ].filter(t => t.amount > 0)

    const { error } = await supabase.from('transactions').insert(incomeTransactions)
    if (!error) {
      alert(`Επιτυχές κλείσιμο βάρδιας: ${format(new Date(date), 'dd/MM')}`)
      router.push('/')
    } else {
      alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <main style={mainWrapperStyle}>
      <div style={cardStyle}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
          <Link href="/" style={backBtnStyle}>←</Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Κλείσιμο Ζ</h2>
        </div>

        {isAlreadyClosed && (
          <div style={warningBox}>
            <p style={{margin: '0 0 10px 0'}}>⚠️ Το ταμείο έχει ήδη κλείσει για αυτή την ημερομηνία.</p>
            <button 
              onClick={() => router.push(`/analysis?date=${date}`)} 
              style={viewBtn}
            >
              🔎 ΠΡΟΒΟΛΗ ΚΛΕΙΣΙΜΑΤΟΣ
            </button>
          </div>
        )}

        <div style={userLabelStyle}>
          <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b' }}>👤 ΧΡΗΣΤΗΣ: {username.toUpperCase()}</span>
        </div>

        <div style={sectionBox}>
          <p style={sectionTitle}>💰 ΕΙΣΠΡΑΞΕΙΣ ΒΑΡΔΙΑΣ</p>
          <div style={fieldBox}>
            <label style={labelStyle}>💵 ΜΕΤΡΗΤΑ (Z)</label>
            <input type="number" inputMode="decimal" value={cashZ} onChange={e => setCashZ(e.target.value)} style={inputStyle} disabled={isAlreadyClosed} placeholder="0.00" />
          </div>
          <div style={fieldBox}>
            <label style={labelStyle}>💳 ΚΑΡΤΑ / POS (Z)</label>
            <input type="number" inputMode="decimal" value={posZ} onChange={e => setPosZ(e.target.value)} style={inputStyle} disabled={isAlreadyClosed} placeholder="0.00" />
          </div>
          <div style={fieldBox}>
            <label style={labelStyle}>🧾 ΧΩΡΙΣ ΑΠΟΔΕΙΞΗ</label>
            <input type="number" inputMode="decimal" value={noTax} onChange={e => setNoTax(e.target.value)} style={inputStyle} disabled={isAlreadyClosed} placeholder="0.00" />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>ΗΜΕΡΟΜΗΝΙΑ ΒΑΡΔΙΑΣ</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={dateInputStyle} />
        </div>

        <div style={totalDisplay}>
          <p style={labelStyle}>ΣΥΝΟΛΙΚΟΣ ΤΖΙΡΟΣ</p>
          <h2 style={{ fontSize: '32px', margin: 0, fontWeight: '900', color: '#0f172a' }}>{totalSales.toFixed(2)}€</h2>
        </div>

        <button 
          onClick={handleSaveZ} 
          disabled={loading || isAlreadyClosed} 
          style={{...saveBtn, backgroundColor: isAlreadyClosed ? '#cbd5e1' : '#0f172a', cursor: isAlreadyClosed ? 'not-allowed' : 'pointer'}}
        >
          {loading ? 'Αποθήκευση...' : isAlreadyClosed ? 'ΗΜΕΡΑ ΚΛΕΙΣΜΕΝΗ' : 'ΟΡΙΣΤΙΚΟΠΟΙΗΣΗ & ΚΛΕΙΣΙΜΟ'}
        </button>

        <div style={{ height: '60px' }} />
      </div>
    </main>
  )
}

// --- STYLES ---
const mainWrapperStyle: any = { backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' };
const cardStyle: any = { maxWidth: '500px', margin: '0 auto', backgroundColor: 'white', borderRadius: '28px', padding: '24px', paddingBottom: '100px', boxShadow: '0 10px 15px rgba(0,0,0,0.05)' };
const warningBox = { backgroundColor: '#fff1f2', color: '#be123c', padding: '15px', borderRadius: '18px', fontSize: '13px', fontWeight: '800', marginBottom: '20px', border: '1px solid #fecaca', textAlign: 'center' as const };
const viewBtn = { backgroundColor: '#be123c', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer' };
const userLabelStyle = { marginBottom: '20px', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '12px', textAlign: 'center' as const };
const sectionBox = { marginBottom: '20px', padding: '18px', borderRadius: '22px', border: '1px solid #e2e8f0' };
const sectionTitle = { fontSize: '10px', fontWeight: '900', color: '#64748b', marginBottom: '15px', letterSpacing: '0.5px' };
const fieldBox = { marginBottom: '15px' };
const labelStyle = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '5px', display: 'block' };
const inputStyle: any = { width: '100%', border: 'none', background: 'transparent', fontSize: '22px', fontWeight: 'bold', color: '#1e293b', outline: 'none', borderBottom: '2px solid #f1f5f9', padding: '8px 0' };
const dateInputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '16px', fontWeight: 'bold' as const };
const totalDisplay = { textAlign: 'center' as const, padding: '20px', marginBottom: '25px', backgroundColor: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' };
const saveBtn: any = { width: '100%', padding: '20px', color: 'white', borderRadius: '18px', border: 'none', fontWeight: '900', fontSize: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const backBtnStyle: any = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: '#f1f5f9', width: '40px', height: '40px', borderRadius: '12px', fontSize: '20px', color: '#64748b' };
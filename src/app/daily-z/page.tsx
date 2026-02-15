'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DailyZPage() {
  const router = useRouter()
  const [cashZ, setCashZ] = useState('')      
  const [posZ, setPosZ] = useState('')        
  const [noTax, setNoTax] = useState('')      
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('Admin')

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()
        if (data?.username) setUsername(data.username)
      }
    }
    fetchUser()
  }, [])

  const totalSales = Number(cashZ) + Number(posZ) + Number(noTax)

  async function handleSaveZ() {
    if (totalSales <= 0) return alert('Παρακαλώ συμπληρώστε τα ποσά της ημέρας.')
    setLoading(true)

    const incomeTransactions = [
      { amount: Number(cashZ), method: 'Μετρητά (Ζ)', notes: 'Ζ ΤΑΜΕΙΑΚΗΣ', type: 'income', date, category: 'Εσοδα Ζ', created_by_name: username },
      { amount: Number(posZ), method: 'Κάρτα', notes: 'Ζ ΤΑΜΕΙΑΚΗΣ (POS)', type: 'income', date, category: 'Εσοδα Ζ', created_by_name: username },
      { amount: Number(noTax), method: 'Μετρητά', notes: 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ', type: 'income', date, category: 'Εσοδα Ζ', created_by_name: username }
    ].filter(t => t.amount > 0)

    const { error } = await supabase.from('transactions').insert(incomeTransactions)
    
    if (!error) {
      alert(`Το ταμείο έκλεισε επιτυχώς από τον χρήστη: ${username}`)
      router.push('/')
    } else {
      alert('Σφάλμα κατά την αποθήκευση: ' + error.message)
    }
    setLoading(false)
  }

  return (
    // ΔΙΟΡΘΩΣΗ: Προσθήκη overflowY και flex column για σωστό scrolling
    <main style={mainWrapperStyle}>
      <div style={cardStyle}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
          <Link href="/" style={backBtnStyle}>←</Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Κλείσιμο Ζ</h2>
        </div>

        {/* USER LABEL */}
        <div style={userLabelStyle}>
          <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b' }}>👤 ΣΥΝΔΕΔΕΜΕΝΟΣ: {username.toUpperCase()}</span>
        </div>

        {/* SECTION: ΕΣΟΔΑ */}
        <div style={sectionBox}>
          <p style={sectionTitle}>💰 ΕΙΣΠΡΑΞΕΙΣ (ΑΠΟ ΤΑΜΕΙΑΚΗ & POS)</p>
          <div style={fieldBox}>
            <label style={labelStyle}>ΜΕΤΡΗΤΑ ΤΑΜΕΙΑΚΗΣ (Z)</label>
            <input type="number" inputMode="decimal" value={cashZ} onChange={e => setCashZ(e.target.value)} style={inputStyle} placeholder="0.00" />
          </div>
          <div style={fieldBox}>
            <label style={labelStyle}>ΚΑΡΤΑ / POS (Z)</label>
            <input type="number" inputMode="decimal" value={posZ} onChange={e => setPosZ(e.target.value)} style={inputStyle} placeholder="0.00" />
          </div>
          <div style={fieldBox}>
            <label style={labelStyle}>ΧΩΡΙΣ ΑΠΟΔΕΙΞΗ / ΣΗΜΑΝΣΗ</label>
            <input type="number" inputMode="decimal" value={noTax} onChange={e => setNoTax(e.target.value)} style={inputStyle} placeholder="0.00" />
          </div>
        </div>

        {/* ΗΜΕΡΟΜΗΝΙΑ */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>ΗΜΕΡΟΜΗΝΙΑ ΚΛΕΙΣΙΜΑΤΟΣ</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={dateInputStyle} />
        </div>

        {/* ΣΥΝΟΛΟ */}
        <div style={totalDisplay}>
          <p style={labelStyle}>ΣΥΝΟΛΙΚΟΣ ΤΖΙΡΟΣ ΗΜΕΡΑΣ</p>
          <h2 style={{ fontSize: '32px', margin: 0, fontWeight: '900', color: '#0f172a' }}>
            {totalSales.toFixed(2)}€
          </h2>
        </div>

        <button onClick={handleSaveZ} disabled={loading} style={saveBtn}>
          {loading ? 'Γίνεται αποθήκευση...' : 'ΟΡΙΣΤΙΚΟΠΟΙΗΣΗ & ΚΛΕΙΣΙΜΟ'}
        </button>

        {/* EXTRA PADDING ΓΙΑ ΤΟ SCROLL ΣΤΑ ΚΙΝΗΤΑ */}
        <div style={{ height: '60px' }} />
      </div>
    </main>
  )
}

// --- STYLES ---
const mainWrapperStyle: any = { 
  backgroundColor: '#f8fafc', 
  minHeight: '100vh', 
  padding: '16px', 
  fontFamily: 'sans-serif',
  overflowY: 'auto', // Επιτρέπει το σκρολάρισμα
  WebkitOverflowScrolling: 'touch' 
};

const cardStyle: any = { 
  maxWidth: '500px', 
  margin: '0 auto', 
  backgroundColor: 'white', 
  borderRadius: '28px', 
  padding: '24px', 
  paddingBottom: '100px', // Κενό στο τέλος για να μη "χάνεται" το κουμπί
  boxShadow: '0 10px 15px rgba(0,0,0,0.05)',
  display: 'flex',
  flexDirection: 'column'
};

const userLabelStyle = { marginBottom: '20px', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '12px', textAlign: 'center' as const };
const sectionBox = { marginBottom: '20px', padding: '18px', borderRadius: '22px', border: '1px solid #e2e8f0' };
const sectionTitle = { fontSize: '10px', fontWeight: '900', color: '#64748b', marginBottom: '15px', letterSpacing: '0.5px' };
const fieldBox = { marginBottom: '15px' };
const labelStyle = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '5px', display: 'block' };
const inputStyle: any = { width: '100%', border: 'none', background: 'transparent', fontSize: '22px', fontWeight: 'bold', color: '#1e293b', outline: 'none', borderBottom: '2px solid #f1f5f9', padding: '8px 0' };
const dateInputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '16px', fontWeight: 'bold' as const };
const totalDisplay = { textAlign: 'center' as const, padding: '20px', marginBottom: '25px', backgroundColor: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' };
const saveBtn: any = { width: '100%', padding: '20px', backgroundColor: '#0f172a', color: 'white', borderRadius: '18px', border: 'none', fontWeight: '900', fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.3)' };
const backBtnStyle: any = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: '#f1f5f9', width: '40px', height: '40px', borderRadius: '12px', fontSize: '20px', color: '#64748b' };
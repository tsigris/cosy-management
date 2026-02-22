'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format, subHours } from 'date-fns'

// ✅ ΟΡΙΣΤΙΚΕΣ ΣΤΑΘΕΡΕΣ ΓΙΑ ΑΠΟΛΥΤΗ ΤΑΥΤΙΣΗ ΜΕ ΤΗΝ ΑΝΑΛΥΣΗ
const Z_METHODS = {
  CASH: 'Μετρητά (Z)', // ✅ Επίσημο Ζ (Latin Z)
  CARD: 'Κάρτα', // ✅ POS
  NO_TAX: 'Χωρίς Απόδειξη', // ✅ Clean label στη λίστα
} as const

const Z_NOTES = {
  OFFICIAL: 'Ζ ΤΑΜΕΙΑΚΗΣ',
  OFFICIAL_POS: 'Ζ ΤΑΜΕΙΑΚΗΣ (POS)',
  BLACK: 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ', // ✅ Το "κλειδί" για την Ανάλυση
} as const

const Z_CATEGORY = 'Εσοδα Ζ' as const

function DailyZContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 1. SaaS ΠΗΓΗ ΑΛΗΘΕΙΑΣ: Το ID από το URL
  const storeId = searchParams.get('store')

  const [cashZ, setCashZ] = useState('')
  const [posZ, setPosZ] = useState('')
  const [noTax, setNoTax] = useState('')

  const [date, setDate] = useState(() => {
    const now = new Date()
    // Προσαρμογή ώρας για κλείσιμο μετά τα μεσάνυχτα
    return format(subHours(now, 7), 'yyyy-MM-dd')
  })

  const [loading, setLoading] = useState(false)
  const [isAlreadyClosed, setIsAlreadyClosed] = useState(false)
  const [username, setUsername] = useState('Admin')

  // ✅ SaaS Guard: Προστασία από απώλεια καταστήματος
  useEffect(() => {
    if (!storeId || storeId === 'null') {
      router.replace('/select-store')
    }
  }, [storeId, router])

  const checkExistingZ = useCallback(async () => {
    if (!storeId) return
    const { data } = await supabase
      .from('transactions')
      .select('id')
      .eq('category', Z_CATEGORY)
      .eq('date', date)
      .eq('store_id', storeId)
      .limit(1)

    setIsAlreadyClosed(data && data.length > 0 ? true : false)
  }, [date, storeId])

  useEffect(() => {
    checkExistingZ()
  }, [checkExistingZ])

  useEffect(() => {
    async function fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
        if (data?.username) setUsername(data.username)
      }
    }
    fetchUser()
  }, [])

  async function handleUnlock() {
    if (!storeId) return
    const confirmUnlock = confirm(
      'ΠΡΟΣΟΧΗ!\nΑυτό θα διαγράψει το τρέχον κλείσιμο Ζ για να εισάγετε νέα ποσά. Θέλετε να συνεχίσετε;'
    )
    if (!confirmUnlock) return

    setLoading(true)

    // ✅ Σβήνουμε ΟΛΕΣ τις εγγραφές του Z κλεισίματος (category + date + store)
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('category', Z_CATEGORY)
      .eq('date', date)
      .eq('store_id', storeId)

    if (!error) {
      setIsAlreadyClosed(false)
      setCashZ('')
      setPosZ('')
      setNoTax('')
      alert('Η ημέρα ξεκλειδώθηκε. Μπορείτε να εισάγετε τα νέα ποσά.')
    } else {
      alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  const totalSales = Number(cashZ) + Number(posZ) + Number(noTax)

  async function handleSaveZ() {
    if (isAlreadyClosed || totalSales <= 0 || !storeId) return
    setLoading(true)

    const incomeTransactions = [
      {
        amount: Number(cashZ),
        method: Z_METHODS.CASH, // ✅ Μετρητά (Z)
        notes: Z_NOTES.OFFICIAL,
        type: 'income',
        date,
        category: Z_CATEGORY,
        created_by_name: username,
        store_id: storeId,
      },
      {
        amount: Number(posZ),
        method: Z_METHODS.CARD, // ✅ Κάρτα
        notes: Z_NOTES.OFFICIAL_POS,
        type: 'income',
        date,
        category: Z_CATEGORY,
        created_by_name: username,
        store_id: storeId,
      },
      {
        amount: Number(noTax),
        method: Z_METHODS.NO_TAX, // ✅ Χωρίς Απόδειξη (clean label)
        notes: Z_NOTES.BLACK, // ✅ ΧΩΡΙΣ ΣΗΜΑΝΣΗ (κλειδί για Ανάλυση)
        type: 'income',
        date,
        category: Z_CATEGORY, // ✅ ΠΑΝΤΑ Εσοδα Ζ
        created_by_name: username,
        store_id: storeId,
      },
    ].filter((t) => (Number(t.amount) || 0) > 0)

    const { error } = await supabase.from('transactions').insert(incomeTransactions)

    if (!error) {
      alert(`Επιτυχές κλείσιμο βάρδιας: ${format(new Date(date), 'dd/MM')}`)
      router.push(`/?store=${storeId}`)
    } else {
      alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <main style={mainWrapperStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
          {/* ✅ Επιστροφή με διατήρηση καταστήματος */}
          <Link href={`/?store=${storeId}`} style={backBtnStyle}>
            ←
          </Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Κλείσιμο Ζ</h2>
        </div>

        {isAlreadyClosed && (
          <div style={warningBox}>
            <p style={{ margin: '0 0 10px 0' }}>⚠️ Το ταμείο έχει ήδη κλείσει για αυτή την ημερομηνία.</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button onClick={() => router.push(`/analysis?date=${date}&store=${storeId}`)} style={viewBtn}>
                🔎 ΠΡΟΒΟΛΗ
              </button>
              <button onClick={handleUnlock} style={unlockBtn} disabled={loading}>
                🔓 ΞΕΚΛΕΙΔΩΜΑ
              </button>
            </div>
          </div>
        )}

        <div style={userLabelStyle}>
          <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b' }}>
            👤 ΧΡΗΣΤΗΣ: {username.toUpperCase()}
          </span>
        </div>

        <div style={sectionBox}>
          <p style={sectionTitle}>💰 ΕΙΣΠΡΑΞΕΙΣ ΒΑΡΔΙΑΣ</p>

          <div style={fieldBox}>
            <label style={labelStyle}>💵 ΜΕΤΡΗΤΑ (Z)</label>
            <input
              type="number"
              inputMode="decimal"
              value={cashZ}
              onChange={(e) => setCashZ(e.target.value)}
              style={inputStyle}
              disabled={isAlreadyClosed}
              placeholder="0.00"
            />
          </div>

          <div style={fieldBox}>
            <label style={labelStyle}>💳 ΚΑΡΤΑ / POS (Z)</label>
            <input
              type="number"
              inputMode="decimal"
              value={posZ}
              onChange={(e) => setPosZ(e.target.value)}
              style={inputStyle}
              disabled={isAlreadyClosed}
              placeholder="0.00"
            />
          </div>

          <div style={fieldBox}>
            <label style={labelStyle}>🧾 ΧΩΡΙΣ ΑΠΟΔΕΙΞΗ</label>
            <input
              type="number"
              inputMode="decimal"
              value={noTax}
              onChange={(e) => setNoTax(e.target.value)}
              style={inputStyle}
              disabled={isAlreadyClosed}
              placeholder="0.00"
            />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>ΗΜΕΡΟΜΗΝΙΑ ΒΑΡΔΙΑΣ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={dateInputStyle} />
        </div>

        <div style={totalDisplay}>
          <p style={labelStyle}>ΣΥΝΟΛΙΚΟΣ ΤΖΙΡΟΣ</p>
          <h2 style={{ fontSize: '32px', margin: 0, fontWeight: '900', color: '#0f172a' }}>{totalSales.toFixed(2)}€</h2>
        </div>

        <button
          onClick={handleSaveZ}
          disabled={loading || isAlreadyClosed}
          style={{
            ...saveBtn,
            backgroundColor: isAlreadyClosed ? '#cbd5e1' : '#0f172a',
            cursor: isAlreadyClosed ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Επεξεργασία...' : isAlreadyClosed ? 'ΗΜΕΡΑ ΚΛΕΙΣΜΕΝΗ' : 'ΟΡΙΣΤΙΚΟΠΟΙΗΣΗ & ΚΛΕΙΣΙΜΟ'}
        </button>

        {/* ✅ Extra space για άνετο scrolling */}
        <div style={{ height: '80px' }} />
      </div>
    </main>
  )
}

// --- ΣΤΥΛ ΠΟΥ ΔΙΟΡΘΩΝΟΥΝ ΤΟ SCROLLING ΣΤΟΝ ΥΠΟΛΟΓΙΣΤΗ ---
const mainWrapperStyle: any = {
  backgroundColor: '#f8fafc',
  minHeight: '100dvh',
  padding: '16px',
  fontFamily: 'sans-serif',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflowY: 'auto',
}

const cardStyle: any = {
  maxWidth: '500px',
  margin: '0 auto',
  backgroundColor: 'white',
  borderRadius: '28px',
  padding: '24px',
  boxShadow: '0 10px 15px rgba(0,0,0,0.05)',
  marginBottom: '20px',
}

const warningBox = {
  backgroundColor: '#fff1f2',
  color: '#be123c',
  padding: '15px',
  borderRadius: '18px',
  fontSize: '13px',
  fontWeight: '800',
  marginBottom: '20px',
  border: '1px solid #fecaca',
  textAlign: 'center' as const,
}

const viewBtn = {
  backgroundColor: '#1e293b',
  color: 'white',
  border: 'none',
  padding: '10px 15px',
  borderRadius: '10px',
  fontSize: '10px',
  fontWeight: '900',
  cursor: 'pointer',
}

const unlockBtn = {
  backgroundColor: '#be123c',
  color: 'white',
  border: 'none',
  padding: '10px 15px',
  borderRadius: '10px',
  fontSize: '10px',
  fontWeight: '900',
  cursor: 'pointer',
}

const userLabelStyle = {
  marginBottom: '20px',
  padding: '10px',
  backgroundColor: '#f1f5f9',
  borderRadius: '12px',
  textAlign: 'center' as const,
}

const sectionBox = { marginBottom: '20px', padding: '18px', borderRadius: '22px', border: '1px solid #e2e8f0' }

const sectionTitle = {
  fontSize: '10px',
  fontWeight: '900',
  color: '#64748b',
  marginBottom: '15px',
  letterSpacing: '0.5px',
}

const fieldBox = { marginBottom: '15px' }

const labelStyle = {
  fontSize: '10px',
  fontWeight: '900',
  color: '#94a3b8',
  marginBottom: '5px',
  display: 'block',
}

const inputStyle: any = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#1e293b',
  outline: 'none',
  borderBottom: '2px solid #f1f5f9',
  padding: '8px 0',
}

const dateInputStyle = {
  width: '100%',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  fontSize: '16px',
  fontWeight: 'bold' as const,
}

const totalDisplay = {
  textAlign: 'center' as const,
  padding: '20px',
  marginBottom: '25px',
  backgroundColor: '#f8fafc',
  borderRadius: '20px',
  border: '1px solid #e2e8f0',
}

const saveBtn: any = {
  width: '100%',
  padding: '20px',
  color: 'white',
  borderRadius: '18px',
  border: 'none',
  fontWeight: '900',
  fontSize: '16px',
}

const backBtnStyle: any = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  background: '#f1f5f9',
  width: '40px',
  height: '40px',
  borderRadius: '12px',
  fontSize: '20px',
  color: '#64748b',
}

export default function DailyZPage() {
  return (
    <Suspense fallback={null}>
      <DailyZContent />
    </Suspense>
  )
}
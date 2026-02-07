'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    async function fetchTransactions() {
      setLoading(true)
      // Φέρνουμε και το όνομα του προμηθευτή (suppliers) μαζί με τη συναλλαγή
      const { data } = await supabase
        .from('transactions')
        .select('*, suppliers(name)') 
        .gte('date', `${selectedDate}T00:00:00`)
        .lte('date', `${selectedDate}T23:59:59`)
        .order('created_at', { ascending: false })
      if (data) setTransactions(data)
      setLoading(false)
    }
    fetchTransactions()
  }, [selectedDate])

  // ΥΠΟΛΟΓΙΣΜΟΣ ΣΥΝΟΛΩΝ (Οι πιστώσεις ΔΕΝ αφαιρούνται από το ταμείο)
  const totals = transactions.reduce((acc, t) => {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') {
      acc.inc += amt
    } else if (t.type === 'expense' && !t.is_credit) {
      // Μόνο αν ΔΕΝ είναι πίστωση αφαιρείται από το ταμείο
      acc.exp += amt
    }
    return acc
  }, { inc: 0, exp: 0 })

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      {/* HEADER & MENU */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '10px' }}>
        <h1 style={{ fontWeight: '900', fontSize: '28px', margin: 0 }}>ΚΑΤΑΣΤΗΜΑ</h1>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={gearBtnStyle}>⚙️ ▼</button>
          {isMenuOpen && (
            <div style={dropdownStyle}>
              <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
              <Link href="/employees" style={menuItem}>👤 Υπάλληλοι</Link>
              <Link href="/suppliers" style={menuItem}>🛒 Προμηθευτές</Link>
              <Link href="/analysis" style={menuItem}>📈 Ανάλυση</Link>
              <button onClick={() => alert('Logout...')} style={{...menuItem, color: 'red', border: 'none', background: 'none', width: '100%'}}>ΑΠΟΣΥΝΔΕΣΗ 🚪</button>
            </div>
          )}
        </div>
      </div>

      {/* CARDS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}><p style={labelStyle}>ΕΣΟΔΑ ΗΜΕΡΑΣ</p><p style={{ color: '#16a34a', fontSize: '24px', fontWeight: '900' }}>{totals.inc.toFixed(2)}€</p></div>
        <div style={cardStyle}><p style={labelStyle}>ΕΞΟΔΑ ΗΜΕΡΑΣ</p><p style={{ color: '#dc2626', fontSize: '24px', fontWeight: '900' }}>{totals.exp.toFixed(2)}€</p></div>
      </div>

      {/* BUTTONS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
        <Link href={`/add-income?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#7da07d' }}>+ ΕΣΟΔΑ</Link>
        <Link href={`/add-expense?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#c45a4a' }}>- ΕΞΟΔΑ</Link>
      </div>

      <input type="date" value={selectedDate} onChange={(e) => router.push(`/?date=${e.target.value}`)} style={dateInputStyle} />

      {/* LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? <p style={{ textAlign: 'center' }}>Φόρτωση...</p> : transactions.map(t => (
          <div key={t.id} style={itemStyle}>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '800', margin: 0 }}>
                {t.type === 'income' ? '💰 ' + (t.notes || 'ΕΙΣΠΡΑΞΗ') : '💸 ' + (t.category || 'ΕΞΟΔΟ')}
                {t.is_credit && <span style={creditBadgeStyle}>🚩 ΠΙΣΤΩΣΗ</span>}
              </p>
              <p style={subLabelStyle}>
                {t.method} {t.suppliers?.name ? `| ${t.suppliers.name}` : ''}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <p style={{ fontWeight: '900', fontSize: '16px', color: t.is_credit ? '#94a3b8' : (t.type === 'income' ? '#16a34a' : '#dc2626'), margin: 0 }}>
                {t.type === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€
              </p>
              <button onClick={async () => { if(confirm('Διαγραφή;')) { await supabase.from('transactions').delete().eq('id', t.id); router.refresh(); } }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <main style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '20px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><DashboardContent /></Suspense>
    </main>
  )
}

// STYLES
const cardStyle = { flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '25px', textAlign: 'center' as const };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '5px' };
const btnStyle = { flex: 1, padding: '20px', borderRadius: '20px', color: 'white', textDecoration: 'none', textAlign: 'center' as const, fontWeight: 'bold', fontSize: '18px' };
const itemStyle = { backgroundColor: 'white', padding: '15px', borderRadius: '20px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const subLabelStyle = { fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' as const, margin: '4px 0 0 0', fontWeight: 'bold' };
const gearBtnStyle = { backgroundColor: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' };
const dropdownStyle = { position: 'absolute' as const, top: '50px', right: '0', backgroundColor: 'white', minWidth: '180px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '15px', zIndex: 100 };
const menuItem = { display: 'block', padding: '10px', textDecoration: 'none', color: '#1e293b', fontWeight: '600' as const, fontSize: '14px' };
const menuSectionLabel = { fontSize: '9px', fontWeight: '800' as const, color: '#94a3b8', marginBottom: '10px' };
const creditBadgeStyle = { color: '#ea580c', fontSize: '10px', marginLeft: '8px', verticalAlign: 'middle', fontWeight: '900' };
const dateInputStyle = { width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' as const, marginBottom: '20px' };
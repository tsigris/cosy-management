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
      // Φέρνουμε τις κινήσεις και το όνομα προμηθευτή
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

  // Λειτουργία Πραγματικής Αποσύνδεσης
  async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      router.push('/login')
      router.refresh()
    } else {
      alert('Σφάλμα: ' + error.message)
    }
  }

  // Λειτουργία Διαγραφής Κίνησης
  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή κίνησης;')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) {
      setTransactions(transactions.filter(t => t.id !== id))
    }
  }

  // Υπολογισμός Συνόλων (χωρίς τις πιστώσεις στα έξοδα)
  const totals = transactions.reduce((acc, t) => {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') acc.inc += amt
    else if (t.type === 'expense' && !t.is_credit) acc.exp += amt
    return acc
  }, { inc: 0, exp: 0 })

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '10px' }}>
        <h1 style={{ fontWeight: '900', fontSize: '26px', margin: 0, color: '#0f172a' }}>ΚΑΤΑΣΤΗΜΑ</h1>
        
        <div style={{ position: 'relative' }}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={menuBtnStyle}>⋮</button>

          {isMenuOpen && (
            <div style={dropdownStyle}>
              <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
              <Link href="/employees" style={menuItem} onClick={() => setIsMenuOpen(false)}>👤 Υπάλληλοι</Link>
              <Link href="/suppliers" style={menuItem} onClick={() => setIsMenuOpen(false)}>🛒 Προμηθευτές</Link>
              <Link href="/suppliers-balance" style={menuItem} onClick={() => setIsMenuOpen(false)}>🚩 Καρτέλες (Χρέη)</Link>
              <Link href="/analysis" style={menuItem} onClick={() => setIsMenuOpen(false)}>📈 Ανάλυση</Link>
              <div style={divider} />
              <button onClick={handleLogout} style={logoutBtnStyle}>ΑΠΟΣΥΝΔΕΣΗ 🚪</button>
            </div>
          )}
        </div>
      </div>

      {/* CARDS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}><p style={labelStyle}>ΕΣΟΔΑ ΗΜΕΡΑΣ</p><p style={{ color: '#16a34a', fontSize: '24px', fontWeight: '900' }}>{totals.inc.toFixed(2)}€</p></div>
        <div style={cardStyle}><p style={labelStyle}>ΕΞΟΔΑ ΗΜΕΡΑΣ</p><p style={{ color: '#dc2626', fontSize: '24px', fontWeight: '900' }}>{totals.exp.toFixed(2)}€</p></div>
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '25px' }}>
        <Link href={`/add-income?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#10b981' }}>+ ΕΣΟΔΑ</Link>
        <Link href={`/add-expense?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#ef4444' }}>- ΕΞΟΔΑ</Link>
      </div>

      <input type="date" value={selectedDate} onChange={(e) => router.push(`/?date=${e.target.value}`)} style={dateInputStyle} />

      {/* LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Πρόσφατες Κινήσεις</p>
        {loading ? <p style={{ textAlign: 'center' }}>Φόρτωση...</p> : transactions.map(t => (
          <div key={t.id} style={itemStyle}>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '800', margin: 0 }}>
                {t.type === 'income' ? '💰 ' + (t.notes || 'ΕΙΣΠΡΑΞΗ') : (
                    t.is_credit ? <span><span style={{color: '#f97316'}}>🚩 ΠΙΣΤΩΣΗ:</span> {t.suppliers?.name || 'Προμηθευτής'}</span> : '💸 ' + (t.suppliers?.name || t.category)
                )}
              </p>
              <p style={subLabelStyle}>{t.method} {t.description ? `• ${t.description}` : ''}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <p style={{ fontWeight: '900', fontSize: '16px', color: t.is_credit ? '#94a3b8' : (t.type === 'income' ? '#16a34a' : '#dc2626'), margin: 0 }}>
                {t.type === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€
              </p>
              <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', opacity: 0.4 }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><DashboardContent /></Suspense>
    </main>
  )
}

// STYLES
const menuBtnStyle = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', fontSize: '20px', color: '#64748b' };
const dropdownStyle = { position: 'absolute' as const, top: '50px', right: '0', backgroundColor: 'white', minWidth: '200px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', padding: '12px', zIndex: 100, border: '1px solid #f1f5f9' };
const menuItem = { display: 'block', padding: '12px', textDecoration: 'none', color: '#334155', fontWeight: '700' as const, fontSize: '14px', borderRadius: '10px' };
const logoutBtnStyle = { ...menuItem, color: '#ef4444', border: 'none', background: '#fee2e2', width: '100%', cursor: 'pointer', textAlign: 'left' as const };
const menuSectionLabel = { fontSize: '9px', fontWeight: '800' as const, color: '#94a3b8', marginBottom: '8px', paddingLeft: '12px' };
const divider = { height: '1px', backgroundColor: '#f1f5f9', margin: '8px 0' };
const cardStyle = { flex: 1, backgroundColor: 'white', padding: '18px', borderRadius: '20px', textAlign: 'center' as const };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '4px' };
const btnStyle = { flex: 1, padding: '18px', borderRadius: '16px', color: 'white', textDecoration: 'none', textAlign: 'center' as const, fontWeight: '800' };
const itemStyle = { backgroundColor: 'white', padding: '14px', borderRadius: '18px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const subLabelStyle = { fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' as const, margin: '4px 0 0 0', fontWeight: 'bold' };
const dateInputStyle = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '16px', fontWeight: 'bold', textAlign: 'center' as const, marginBottom: '20px', backgroundColor: 'white' };
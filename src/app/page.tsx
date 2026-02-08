'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Σταθερή ημερομηνία
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [storeName, setStoreName] = useState('ΦΟΡΤΩΣΗ...')
  
  const [permissions, setPermissions] = useState({
    role: 'user',
    can_view_history: false,
    can_view_analysis: false,
    enable_payroll: false
  })

  useEffect(() => {
    async function fetchAppData() {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Φέρνουμε προφίλ και συναλλαγές ταυτόχρονα
          const [profileRes, transRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('transactions')
              .select('*, suppliers(name), fixed_assets(name)')
              .gte('date', `${selectedDate}T00:00:00`)
              .lte('date', `${selectedDate}T23:59:59`)
              .order('created_at', { ascending: false })
          ])

          if (profileRes.data) {
            const p = profileRes.data
            setStoreName(p.store_name || 'ΚΑΤΑΣΤΗΜΑ')
            setPermissions({
              role: p.role || 'user',
              can_view_history: p.can_view_history || false,
              can_view_analysis: p.can_view_analysis || false,
              enable_payroll: p.enable_payroll || false
            })

            let data = transRes.data || []
            // Φιλτράρισμα για τον απλό χρήστη
            if (p.role !== 'admin') {
              data = data.filter(t => t.user_id === user.id)
            }
            setTransactions(data)
          }
        }
      } catch (err) {
        console.error("Fetch error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchAppData()
  }, [selectedDate])

  const totals = transactions.reduce((acc, t) => {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') acc.inc += amt
    else if (t.type === 'expense' && !t.is_credit && t.category !== 'pocket') acc.exp += amt
    return acc
  }, { inc: 0, exp: 0 })

  const isAdmin = permissions.role === 'admin'

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', position: 'relative' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '10px' }}>
        <h1 style={{ fontWeight: '900', fontSize: '26px', margin: 0, color: '#0f172a' }}>
          {storeName.toUpperCase()}
        </h1>
        
        <div style={{ position: 'relative', zIndex: 100 }}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={menuBtnStyle}>⋮</button>
          {isMenuOpen && (
            <div style={dropdownStyle}>
              <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
              {isAdmin && (
                <>
                  <Link href="/suppliers" style={menuItem}>🛒 Προμηθευτές</Link>
                  <Link href="/fixed-assets" style={menuItem}>🔌 Πάγια</Link>
                  <Link href="/employees" style={menuItem}>👥 Υπάλληλοι</Link>
                </>
              )}
              {(isAdmin || permissions.can_view_analysis) && (
                <Link href="/analysis" style={menuItem}>📈 Ανάλυση</Link>
              )}
              <div style={divider} />
              <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} style={logoutBtnStyle}>ΕΞΟΔΟΣ 🚪</button>
            </div>
          )}
        </div>
      </div>

      {/* CARDS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}>
            <p style={labelStyle}>{isAdmin ? 'ΕΣΟΔΑ ΗΜΕΡΑΣ' : 'ΔΙΚΑ ΜΟΥ ΕΣΟΔΑ'}</p>
            <p style={{ color: '#16a34a', fontSize: '24px', fontWeight: '900', margin: 0 }}>{totals.inc.toFixed(2)}€</p>
        </div>
        <div style={cardStyle}>
            <p style={labelStyle}>{isAdmin ? 'ΕΞΟΔΑ ΗΜΕΡΑΣ' : 'ΔΙΚΑ ΜΟΥ ΕΞΟΔΑ'}</p>
            <p style={{ color: '#dc2626', fontSize: '24px', fontWeight: '900', margin: 0 }}>{totals.exp.toFixed(2)}€</p>
        </div>
      </div>

      {/* ACTION BUTTONS - ΤΟ ΚΡΙΣΙΜΟ ΣΗΜΕΙΟ */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', position: 'relative', zIndex: 10 }}>
        <button 
          onClick={() => router.push(`/add-income?date=${selectedDate}`)}
          style={{ ...btnStyle, backgroundColor: '#10b981', border: 'none', cursor: 'pointer' }}
        >
          + ΕΣΟΔΑ
        </button>
        <button 
          onClick={() => router.push(`/add-expense?date=${selectedDate}`)}
          style={{ ...btnStyle, backgroundColor: '#ef4444', border: 'none', cursor: 'pointer' }}
        >
          - ΕΞΟΔΑ
        </button>
      </div>

      {isAdmin && (
        <button 
          onClick={() => router.push('/daily-z')}
          style={{ ...zBtnStyle, width: '100%', border: 'none', cursor: 'pointer' }}
        >
          📟 ΚΛΕΙΣΙΜΟ ΤΑΜΕΙΟΥ (Ζ)
        </button>
      )}

      <div style={{ marginTop: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>
          {isAdmin ? 'Καθημερινές Κινήσεις' : 'Οι Καταχωρήσεις μου'}
        </p>
        
        {loading ? (
          <p style={{ textAlign: 'center', padding: '20px' }}>Φόρτωση...</p>
        ) : (
          transactions.filter(t => t.category !== 'Εσοδα Ζ' && t.category !== 'pocket').map(t => (
            <div key={t.id} style={itemStyle}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '800', margin: 0 }}>
                  {t.type === 'income' ? '💰 ' + (t.notes || 'ΕΙΣΠΡΑΞΗ') : (
                      t.is_credit ? '🚩 ΠΙΣΤΩΣΗ: ' + t.suppliers?.name : 
                      t.category === 'Πάγια' ? '🔌 ' + t.fixed_assets?.name :
                      '💸 ' + (t.suppliers?.name || t.category)
                  )}
                </p>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <span style={subLabelStyle}>{t.method}</span>
                  <span style={userBadge}>👤 {t.created_by_name}</span>
                </div>
              </div>
              <p style={{ fontWeight: '900', fontSize: '16px', color: t.is_credit ? '#94a3b8' : (t.type === 'income' ? '#16a34a' : '#dc2626'), margin: 0 }}>
                {t.type === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// STYLES
const menuBtnStyle = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '12px', fontSize: '20px', color: '#64748b' };
const dropdownStyle = { position: 'absolute' as const, top: '50px', right: '0', backgroundColor: 'white', minWidth: '200px', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '10px', border: '1px solid #f1f5f9' };
const menuItem = { display: 'block', padding: '10px', textDecoration: 'none', color: '#334155', fontWeight: '700' as const, fontSize: '14px' };
const logoutBtnStyle = { ...menuItem, color: '#ef4444', border: 'none', background: '#fee2e2', width: '100%', cursor: 'pointer', textAlign: 'left' as const, borderRadius: '8px' };
const menuSectionLabel = { fontSize: '9px', fontWeight: '800' as const, color: '#94a3b8', marginBottom: '5px', paddingLeft: '10px' };
const divider = { height: '1px', backgroundColor: '#f1f5f9', margin: '8px 0' };
const cardStyle = { flex: 1, backgroundColor: 'white', padding: '15px', borderRadius: '18px', textAlign: 'center' as const, border: '1px solid #f1f5f9' };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '4px' };
const btnStyle = { flex: 1, padding: '16px', borderRadius: '14px', color: 'white', fontWeight: '800', fontSize: '14px' };
const zBtnStyle = { padding: '14px', borderRadius: '14px', backgroundColor: '#0f172a', color: 'white', fontWeight: '900', fontSize: '13px' };
const itemStyle = { backgroundColor: 'white', padding: '12px', borderRadius: '15px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' };
const subLabelStyle = { fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' };
const userBadge = { fontSize: '9px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 5px', borderRadius: '4px' };

export default function HomePage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <DashboardContent />
      </Suspense>
    </main>
  )
}
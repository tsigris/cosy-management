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
  const [storeName, setStoreName] = useState('ΚΑΤΑΣΤΗΜΑ')
  
  // STATE ΓΙΑ ΔΙΚΑΙΩΜΑΤΑ
  const [permissions, setPermissions] = useState({
    role: 'user',
    can_view_history: false,
    can_view_analysis: false
  })

  useEffect(() => {
    async function fetchAppData() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // 1. Φόρτωση Προφίλ & Δικαιωμάτων
        const { data: profile } = await supabase
          .from('profiles')
          .select('store_name, role, can_view_history, can_view_analysis')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setStoreName(profile.store_name || 'ΚΑΤΑΣΤΗΜΑ')
          setPermissions({
            role: profile.role || 'user',
            can_view_history: profile.can_view_history || false,
            can_view_analysis: profile.can_view_analysis || false
          })
        }

        // 2. Φόρτωση Συναλλαγών (Μόνο αν έχει δικαίωμα ή είναι Admin)
        const { data: transData } = await supabase
          .from('transactions')
          .select('*, suppliers(name), fixed_assets(name)')
          .gte('date', `${selectedDate}T00:00:00`)
          .lte('date', `${selectedDate}T23:59:59`)
          .order('created_at', { ascending: false })
        
        if (transData) setTransactions(transData)
      }
      setLoading(false)
    }

    fetchAppData()
  }, [selectedDate])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleDelete(id: string) {
    if (confirm('Θέλετε να διαγράψετε αυτή την κίνηση;')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (!error) {
        setTransactions(prev => prev.filter(t => t.id !== id))
      }
    }
  }

  const totals = transactions.reduce((acc, t) => {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') acc.inc += amt
    else if (t.type === 'expense' && !t.is_credit && t.category !== 'pocket') acc.exp += amt
    return acc
  }, { inc: 0, exp: 0 })

  const filteredForList = transactions.filter(t => 
    t.category !== 'Εσοδα Ζ' && t.category !== 'pocket'
  )

  const isAdmin = permissions.role === 'admin'

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '10px' }}>
        <h1 style={{ fontWeight: '900', fontSize: '26px', margin: 0, color: '#0f172a' }}>
          {storeName.toUpperCase()}
        </h1>
        
        <div style={{ position: 'relative' }}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={menuBtnStyle}>⋮</button>

          {isMenuOpen && (
            <div style={dropdownStyle}>
              <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
              
              {/* Κουμπί Δικαιωμάτων - Μόνο για Admin */}
              {isAdmin && (
                <Link href="/admin/permissions" style={menuItem} onClick={() => setIsMenuOpen(false)}>
                  🔐 Δικαιώματα Χρηστών
                </Link>
              )}

              {isAdmin && (
                <>
                  <Link href="/suppliers" style={menuItem} onClick={() => setIsMenuOpen(false)}>🛒 Προμηθευτές</Link>
                  <Link href="/fixed-assets" style={menuItem} onClick={() => setIsMenuOpen(false)}>🔌 Πάγια</Link>
                  <Link href="/suppliers-balance" style={menuItem} onClick={() => setIsMenuOpen(false)}>🚩 Καρτέλες (Χρέη)</Link>
                </>
              )}
              
              {(isAdmin || permissions.can_view_analysis) && (
                <Link href="/analysis" style={menuItem} onClick={() => setIsMenuOpen(false)}>📈 Ανάλυση</Link>
              )}
              
              <div style={divider} />
              <p style={menuSectionLabel}>ΕΦΑΡΜΟΓΗ</p>
              <Link href="/subscription" style={menuItem} onClick={() => setIsMenuOpen(false)}>💳 Συνδρομή</Link>
              <Link href="/settings" style={menuItem} onClick={() => setIsMenuOpen(false)}>⚙️ Ρυθμίσεις</Link>
              
              <div style={divider} />
              <button onClick={handleLogout} style={logoutBtnStyle}>ΑΠΟΣΥΝΔΕΣΗ 🚪</button>
            </div>
          )}
        </div>
      </div>

      {/* ΣΤΑΤΙΣΤΙΚΑ ΗΜΕΡΑΣ */}
      {(isAdmin || permissions.can_view_history) && (
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <div style={cardStyle}>
              <p style={labelStyle}>ΕΣΟΔΑ ΗΜΕΡΑΣ</p>
              <p style={{ color: '#16a34a', fontSize: '24px', fontWeight: '900', margin: 0 }}>{totals.inc.toFixed(2)}€</p>
          </div>
          <div style={cardStyle}>
              <p style={labelStyle}>ΕΞΟΔΑ ΗΜΕΡΑΣ</p>
              <p style={{ color: '#dc2626', fontSize: '24px', fontWeight: '900', margin: 0 }}>{totals.exp.toFixed(2)}€</p>
          </div>
        </div>
      )}

      {/* QUICK BUTTONS */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <Link href={`/add-income?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#10b981' }}>+ ΕΣΟΔΑ</Link>
        <Link href={`/add-expense?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#ef4444' }}>- ΕΞΟΔΑ</Link>
      </div>

      <Link href="/daily-z" style={zBtnStyle}>
        📟 ΚΛΕΙΣΙΜΟ ΤΑΜΕΙΟΥ (Ζ) & ΑΝΑΛΗΨΗ
      </Link>

      <div style={{ marginBottom: '20px' }} />

      {/* ΛΙΣΤΑ ΚΙΝΗΣΕΩΝ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Καθημερινές Κινήσεις</p>
        
        {loading ? (
          <p style={{ textAlign: 'center', padding: '20px' }}>Φόρτωση...</p>
        ) : (isAdmin || permissions.can_view_history) ? (
          filteredForList.length > 0 ? (
            filteredForList.map(t => (
              <div key={t.id} style={itemStyle}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '800', margin: 0 }}>
                    {t.type === 'income' ? '💰 ' + (t.notes || 'ΕΙΣΠΡΑΞΗ') : (
                        t.is_credit ? <span>🚩 ΠΙΣΤΩΣΗ: {t.suppliers?.name}</span> : 
                        t.category === 'Πάγια' ? <span>🔌 {t.fixed_assets?.name}</span> :
                        '💸 ' + (t.suppliers?.name || t.category)
                    )}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <span style={subLabelStyle}>{t.method}</span>
                    {t.created_by_name && <span style={userBadge}>👤 {t.created_by_name}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <p style={{ fontWeight: '900', fontSize: '16px', color: t.is_credit ? '#94a3b8' : (t.type === 'income' ? '#16a34a' : '#dc2626'), margin: 0 }}>
                    {t.type === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€
                  </p>
                  {isAdmin && <button onClick={() => handleDelete(t.id)} style={delBtnStyle}>🗑️</button>}
                </div>
              </div>
            ))
          ) : (
            <div style={emptyState}>Καμία καθημερινή κίνηση.</div>
          )
        ) : (
          <div style={lockedState}>
            <p>🔒 Το ιστορικό είναι κλειδωμένο από τον διαχειριστή.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// STYLES
const userBadge = { fontSize: '9px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 5px', borderRadius: '4px', fontWeight: 'bold' };
const lockedState = { textAlign: 'center' as const, padding: '40px', backgroundColor: 'white', borderRadius: '20px', border: '1px dashed #cbd5e1', color: '#94a3b8', fontSize: '14px' };
const emptyState = { textAlign: 'center' as const, padding: '30px', color: '#94a3b8', background: 'white', borderRadius: '20px' };
const menuBtnStyle = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', fontSize: '20px', color: '#64748b' };
const dropdownStyle = { position: 'absolute' as const, top: '50px', right: '0', backgroundColor: 'white', minWidth: '220px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', padding: '12px', zIndex: 100, border: '1px solid #f1f5f9' };
const menuItem = { display: 'block', padding: '12px', textDecoration: 'none', color: '#334155', fontWeight: '700' as const, fontSize: '14px', borderRadius: '10px' };
const logoutBtnStyle = { ...menuItem, color: '#ef4444', border: 'none', background: '#fee2e2', width: '100%', cursor: 'pointer', textAlign: 'left' as const, marginTop: '5px' };
const menuSectionLabel = { fontSize: '9px', fontWeight: '800' as const, color: '#94a3b8', marginBottom: '8px', paddingLeft: '12px', marginTop: '8px', letterSpacing: '0.5px' };
const divider = { height: '1px', backgroundColor: '#f1f5f9', margin: '8px 0' };
const cardStyle = { flex: 1, backgroundColor: 'white', padding: '18px', borderRadius: '20px', textAlign: 'center' as const, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '4px' };
const btnStyle = { flex: 1, padding: '18px', borderRadius: '16px', color: 'white', textDecoration: 'none', textAlign: 'center' as const, fontWeight: '800', fontSize: '15px' };
const zBtnStyle = { display: 'block', padding: '16px', borderRadius: '16px', backgroundColor: '#0f172a', color: 'white', textDecoration: 'none', textAlign: 'center' as const, fontWeight: '900', fontSize: '14px' };
const itemStyle = { backgroundColor: 'white', padding: '14px', borderRadius: '18px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const subLabelStyle = { fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' as const, margin: '0', fontWeight: 'bold' };
const delBtnStyle = { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', opacity: 0.3 };

export default function HomePage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <DashboardContent />
      </Suspense>
    </main>
  )
}
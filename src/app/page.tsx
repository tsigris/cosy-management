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
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [isZExpanded, setIsZExpanded] = useState(false)
  
  const [storeName, setStoreName] = useState('Cosy App')
  const [permissions, setPermissions] = useState({ 
    role: 'user', 
    store_id: null as string | null,
    can_view_analysis: false,
    can_view_history: false
  })

  useEffect(() => {
    async function fetchAppData() {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
          if (profile) {
            setStoreName(profile.store_name || 'Cosy App')
            setPermissions({ 
              role: profile.role || 'user', 
              store_id: profile.store_id,
              can_view_analysis: profile.can_view_analysis || false,
              can_view_history: profile.can_view_history || false
            })

            const { data: transData } = await supabase.from('transactions')
              .select('*, suppliers(name), fixed_assets(name), employees(full_name)')
              .eq('store_id', profile.store_id)
              .gte('date', `${selectedDate}T00:00:00`)
              .lte('date', `${selectedDate}T23:59:59`)
              .order('created_at', { ascending: false })

            if (transData) {
              const canSeeEverything = profile.role === 'admin' || profile.can_view_history;
              setTransactions(canSeeEverything ? transData : transData.filter(t => t.user_id === user.id))
            }
          }
        }
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    fetchAppData()
  }, [selectedDate])

  const handleDateChange = (newDate: string) => {
    router.push(`/?date=${newDate}`)
    setIsMenuOpen(false)
  }

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    handleDateChange(d.toISOString().split('T')[0])
  }

  const zEntries = transactions.filter(t => t.category === 'Εσοδα Ζ')
  const zTotal = zEntries.reduce((acc, t) => acc + Number(t.amount), 0)
  const regularEntries = transactions.filter(t => t.category !== 'Εσοδα Ζ' && t.category !== 'pocket')
  
  const totalInc = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0)
  const totalExp = transactions.filter(t => t.type === 'expense' && !t.is_credit && t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0)
  const isAdmin = permissions.role === 'admin'

  const handleDelete = async (id: string) => {
    if (confirm('Θέλετε να διαγράψετε αυτή την κίνηση;')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (!error) setTransactions(prev => prev.filter(t => t.id !== id))
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', position: 'relative' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}><span style={{ fontSize: '20px' }}>📈</span></div>
          <div>
            <h1 style={{ fontWeight: '800', fontSize: '22px', margin: 0, color: '#1e293b' }}>{storeName}</h1>
            <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Business Dashboard</p>
          </div>
        </div>
        
        <div style={{ position: 'relative' }}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={menuBtnStyle}>⋮</button>
          {isMenuOpen && (
            <div style={dropdownStyle}>
              <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
              <Link href="/suppliers" style={menuItem} onClick={() => setIsMenuOpen(false)}>🛒 Προμηθευτές</Link>
              <Link href="/fixed-assets" style={menuItem} onClick={() => setIsMenuOpen(false)}>🔌 Πάγια</Link>
              {isAdmin && <Link href="/employees" style={menuItem} onClick={() => setIsMenuOpen(false)}>👥 Υπάλληλοι</Link>}
              {isAdmin && <Link href="/suppliers-balance" style={menuItem} onClick={() => setIsMenuOpen(false)}>🚩 Καρτέλες (Χρέη)</Link>}
              
              {(isAdmin || permissions.can_view_analysis) && (
                <Link href="/analysis" style={menuItem} onClick={() => setIsMenuOpen(false)}>📊 Ανάλυση</Link>
              )}
              
              <div style={divider} />
              <p style={menuSectionLabel}>ΕΦΑΡΜΟΓΗ</p>
              {isAdmin && <Link href="/admin/permissions" style={menuItem} onClick={() => setIsMenuOpen(false)}>🔐 Δικαιώματα</Link>}
              <Link href="/subscription" style={menuItem} onClick={() => setIsMenuOpen(false)}>💳 Συνδρομή</Link>
              <Link href="/settings" style={menuItem} onClick={() => setIsMenuOpen(false)}>⚙️ Ρυθμίσεις</Link>
              
              <div style={divider} />
              <button onClick={() => supabase.auth.signOut().then(() => window.location.href='/login')} style={logoutBtnStyle}>ΑΠΟΣΥΝΔΕΣΗ 🚪</button>
            </div>
          )}
        </div>
      </div>

      {/* DATE SELECTOR */}
      <div style={dateBarStyle}>
        <button onClick={() => shiftDate(-1)} style={dateArrowStyle}>←</button>
        <div style={{ position: 'relative', flex: 1, textAlign: 'center' }}>
          <input type="date" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} style={dateInputStyle} />
          <span style={dateDisplayStyle}>
            {selectedDate === new Date().toISOString().split('T')[0] ? 'ΣΗΜΕΡΑ' : new Date(selectedDate).toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}
          </span>
        </div>
        <button onClick={() => shiftDate(1)} style={dateArrowStyle}>→</button>
      </div>

      {/* STATS CARDS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}><p style={labelStyle}>ΕΣΟΔΑ ΗΜΕΡΑΣ</p><p style={{ color: '#10b981', fontSize: '24px', fontWeight: '800', margin: 0 }}>{totalInc.toFixed(2)}€</p></div>
        <div style={cardStyle}><p style={labelStyle}>ΕΞΟΔΑ ΗΜΕΡΑΣ</p><p style={{ color: '#ef4444', fontSize: '24px', fontWeight: '800', margin: 0 }}>{totalExp.toFixed(2)}€</p></div>
      </div>

      {/* ACTIONS */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <Link href={`/add-income?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#10b981', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>+ ΕΣΟΔΑ</Link>
        <Link href={`/add-expense?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#ef4444', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}>- ΕΞΟΔΑ</Link>
      </div>
      {isAdmin && <Link href="/daily-z" style={zBtnStyle}>📟 ΚΛΕΙΣΙΜΟ ΤΑΜΕΙΟΥ (Ζ)</Link>}

      {/* LIST SECTION */}
      <div style={{ marginTop: '25px' }}>
        <p style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Κινήσεις Ημέρας</p>
        {loading ? <div style={{ textAlign: 'center', padding: '20px', fontWeight: '700', color: '#94a3b8' }}>Φόρτωση...</div> : (
          <>
            {zTotal > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <div onClick={() => isAdmin && setIsZExpanded(!isZExpanded)} style={zItemHeader}>
                  <div style={{ flex: 1 }}><p style={{ fontWeight: '800', margin: 0, fontSize: '15px' }}>📟 ΣΥΝΟΛΟ Ζ</p></div>
                  <p style={{ fontWeight: '800', fontSize: '18px', margin: 0 }}>+{zTotal.toFixed(2)}€</p>
                </div>
                {isZExpanded && (
                  <div style={zBreakdownPanel}>
                    {zEntries.map(z => (
                      <div key={z.id} style={zSubItem}>
                        <div style={{ flex: 1 }}><p style={{ fontWeight: '600', margin: 0, fontSize: '13px', color: '#475569' }}>{z.method}</p></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <p style={{ fontWeight: '700', fontSize: '14px', margin: 0, color: '#1e293b' }}>{Number(z.amount).toFixed(2)}€</p>
                          {isAdmin && <button onClick={() => handleDelete(z.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {regularEntries.map(t => (
              <div key={t.id} style={{ marginBottom: '10px' }}>
                <div style={itemStyle} onClick={() => isAdmin && setExpandedTx(expandedTx === t.id ? null : t.id)}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '700', margin: 0, fontSize: '15px', color: '#1e293b' }}>
                      {t.type === 'income' ? '💰 ' + (t.notes || 'ΕΙΣΠΡΑΞΗ') : (t.suppliers?.name || t.category.toUpperCase())}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <span style={subLabelStyle}>{t.method}</span>
                      <span style={userBadge}>👤 {t.created_by_name?.toUpperCase()}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: '800', fontSize: '17px', color: t.type === 'income' ? '#10b981' : '#ef4444', margin: 0 }}>
                      {t.type === 'income' ? '+' : '-'}{Math.abs(Number(t.amount)).toFixed(2)}€
                    </p>
                  </div>
                </div>
                {isAdmin && expandedTx === t.id && (
                  <div style={actionPanel}>
                    <button onClick={() => handleDelete(t.id)} style={deleteBtnStyle}>ΔΙΑΓΡΑΦΗ ΚΙΝΗΣΗΣ 🗑️</button>
                  </div>
                )}
              </div>
            ))}
            {transactions.length === 0 && (
              <div style={emptyStateStyle}>Δεν υπάρχουν κινήσεις για αυτή την ημερομηνία.</div>
            )}
          </>
        )}
      </div>
      <div style={{ height: '100px' }} />
    </div>
  )
}

// STYLES - ΕΠΑΝΑΦΟΡΑ PREMIUM ΑΙΣΘΗΤΙΚΗΣ
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#1e293b', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(30, 41, 59, 0.15)' };
const menuBtnStyle: any = { backgroundColor: 'white', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '12px', fontSize: '20px', cursor: 'pointer', color: '#1e293b', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const dropdownStyle: any = { position: 'absolute' as any, top: '55px', right: '0', backgroundColor: 'white', minWidth: '240px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '12px', zIndex: 1100, border: '1px solid #f1f5f9', maxHeight: '75dvh', overflowY: 'auto' };
const menuItem: any = { display: 'block', padding: '12px', textDecoration: 'none', color: '#334155', fontWeight: '600', fontSize: '14px', borderRadius: '10px' };
const logoutBtnStyle: any = { ...menuItem, color: '#dc2626', border: 'none', background: '#fee2e2', width: '100%', cursor: 'pointer', textAlign: 'left', marginTop: '5px', borderRadius: '10px', fontWeight: '700' };
const menuSectionLabel: any = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '8px', paddingLeft: '12px', marginTop: '12px', letterSpacing: '0.5px' };
const divider: any = { height: '1px', backgroundColor: '#f1f5f9', margin: '10px 0' };
const dateBarStyle: any = { display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '10px', borderRadius: '16px', marginBottom: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' };
const dateArrowStyle: any = { background: 'none', border: 'none', fontSize: '20px', fontWeight: '800', cursor: 'pointer', color: '#64748b', padding: '0 10px' };
const dateInputStyle: any = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' };
const dateDisplayStyle: any = { fontSize: '14px', fontWeight: '800', color: '#1e293b' };
const cardStyle: any = { flex: 1, backgroundColor: 'white', padding: '20px 15px', borderRadius: '20px', textAlign: 'center', border: '1px solid #f8fafc', boxShadow: '0 8px 20px rgba(0,0,0,0.04)' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '5px', letterSpacing: '0.5px' };
const btnStyle: any = { flex: 1, padding: '18px', borderRadius: '18px', color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '800', fontSize: '14px' };
const zBtnStyle: any = { display: 'block', padding: '18px', borderRadius: '18px', backgroundColor: '#1e293b', color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '800', fontSize: '14px', marginTop: '10px', boxShadow: '0 6px 15px rgba(30, 41, 59, 0.2)' };
const itemStyle: any = { backgroundColor: 'white', padding: '18px', borderRadius: '18px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' };
const zItemHeader: any = { ...itemStyle, backgroundColor: '#1e293b', color: 'white', border: 'none', boxShadow: '0 6px 15px rgba(30, 41, 59, 0.15)' };
const subLabelStyle: any = { fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' };
const userBadge: any = { fontSize: '10px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '8px', fontWeight: '700' };
const zBreakdownPanel: any = { backgroundColor: 'white', padding: '15px 20px', borderRadius: '0 0 18px 18px', border: '1px solid #f1f5f9', borderTop: 'none', marginTop: '-12px', marginBottom: '15px', boxShadow: '0 4px 8px rgba(0,0,0,0.02)' };
const zSubItem: any = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8fafc' };
const actionPanel: any = { padding: '10px', backgroundColor: '#fff', borderRadius: '0 0 18px 18px', border: '1px solid #f1f5f9', borderTop: 'none', marginTop: '-12px', marginBottom: '15px' };
const deleteBtnStyle: any = { width: '100%', padding: '10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' };
const emptyStateStyle: any = { textAlign: 'center', padding: '40px', color: '#94a3b8', fontWeight: '600', fontSize: '14px', background: 'white', borderRadius: '20px', border: '2px dashed #f1f5f9' };

export default function HomePage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100dvh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><DashboardContent /></Suspense>
    </main>
  )
}
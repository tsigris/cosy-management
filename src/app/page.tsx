'use client'

// 1. ΕΠΙΒΟΛΗ DYNAMIC ΓΙΑ ΤΟ VERCEL BUILD
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

// --- ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΠΑΛΕΤΑ ΧΡΩΜΑΤΩΝ ---
const colors = {
  primaryDark: '#0f172a',    
  primaryText: '#1e293b', 
  secondaryText: '#64748b',
  accentGreen: '#10b981',   
  accentRed: '#f43f5e',     
  bgLight: '#f1f5f9',       
  cardBg: '#ffffff',
  border: '#e2e8f0',
  hoverBg: '#f8fafc',
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const getBusinessDate = () => {
    const now = new Date()
    if (now.getHours() < 7) now.setDate(now.getDate() - 1)
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [businessToday, setBusinessToday] = useState(getBusinessDate())
  const selectedDate = searchParams.get('date') || businessToday

  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [isZExpanded, setIsZExpanded] = useState(false)
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null)

  const [storeName, setStoreName] = useState('Cosy App')
  const [storeId, setStoreId] = useState<string | null>(null)
  const [permissions, setPermissions] = useState({
    role: 'user',
    store_id: null as string | null,
    can_view_analysis: false,
    can_view_history: false,
  })

  const isAdmin = permissions.role === 'admin'

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString('el-GR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return '--:--'
    }
  }

  const fetchAppData = useCallback(async () => {
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 7000)
      )
      const authPromise = supabase.auth.getSession()
      const sessionRes: any = await Promise.race([authPromise, timeout])
      const session = sessionRes.data?.session

      if (!session) {
        const hasPin = localStorage.getItem('fleet_track_pin_enabled') === 'true'
        const hasBio = localStorage.getItem('fleet_track_biometrics') === 'true'
        if (hasPin || hasBio) router.push('/login?mode=fast')
        else router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile) {
        setStoreName(profile.store_name || 'Cosy App')
        setPermissions({
          role: profile.role || 'user',
          store_id: profile.store_id,
          can_view_analysis: profile.can_view_analysis || false,
          can_view_history: profile.can_view_history || false,
        })
        setStoreId(profile.store_id || null)

        const { data: transData } = await supabase
          .from('transactions')
          .select('*, suppliers(name), fixed_assets(name), employees(full_name)')
          .eq('store_id', profile.store_id)
          .eq('date', selectedDate)
          .order('created_at', { ascending: false })

        setTransactions(transData || [])
      }
    } catch (err) {
      console.error('Fetch Error:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedDate, router])

  useEffect(() => {
    fetchAppData()
    const timer = setInterval(() => {
      if (getBusinessDate() !== businessToday) window.location.reload()
    }, 30000)
    return () => clearInterval(timer)
  }, [fetchAppData, businessToday])

  useEffect(() => {
    if (!storeId) return
    const channel = supabase
      .channel(`realtime-dashboard-${storeId}-${selectedDate}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `store_id=eq.${storeId}` }, 
      () => fetchAppData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [storeId, selectedDate, fetchAppData])

  const getPaymentIcon = (method: string) => {
    const m = method?.toLowerCase() || ''
    if (m.includes('μετρητά')) return '💵'
    if (m.includes('κάρτα') || m.includes('pos')) return '💳'
    return '📝'
  }

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    router.push(`/?date=${d.toISOString().split('T')[0]}`)
  }

  const zEntries = useMemo(() => transactions.filter((t) => t.category === 'Εσοδα Ζ'), [transactions])
  const zTotal = useMemo(() => zEntries.reduce((acc, t) => acc + Number(t.amount), 0), [zEntries])
  const regularEntries = useMemo(() => 
    transactions.filter((t) => !['Εσοδα Ζ', 'Προσωπικό', 'pocket'].includes(t.category)), 
  [transactions])

  const totalInc = useMemo(() => transactions.filter((t) => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0), [transactions])
  const totalExp = useMemo(() => transactions.filter((t) => t.type === 'expense' && !t.is_credit && t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0), [transactions])

  const handleDelete = async (id: string) => {
    if (isAdmin && confirm('Οριστική διαγραφή;')) {
      await supabase.from('transactions').delete().eq('id', id)
      fetchAppData()
    }
  }

  if (loading) return <div style={loaderStyle}>Φορτώνεται...</div>

  return (
    <div style={iphoneWrapper}>
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '40px' }}>
        
        {/* HEADER */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>📈</div>
            <div>
              <h1 style={titleStyle}>{storeName}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <p style={subtitleStyle}>BUSINESS DASHBOARD</p>
                <div style={onlineDot}></div>
              </div>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={menuBtnStyle}>⋮</button>
            {isMenuOpen && (
              <div style={dropdownStyle}>
                 <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
                 <Link href="/suppliers" style={menuItem}>🛒 Προμηθευτές</Link>
                 {isAdmin && <Link href="/employees" style={menuItem}>👥 Υπάλληλοι</Link>}
                 <Link href="/analysis" style={menuItem}>📊 Ανάλυση</Link>
                 <div style={divider} />
                 <button onClick={() => supabase.auth.signOut()} style={logoutBtnStyle}>ΑΠΟΣΥΝΔΕΣΗ 🚪</button>
              </div>
            )}
          </div>
        </div>

        {/* DATE SELECTOR */}
        <div style={dateBarStyle}>
          <button onClick={() => shiftDate(-1)} style={arrowStyle}>←</button>
          <div style={dateTextStyle}>
            {new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' }).toUpperCase()}
          </div>
          <button onClick={() => shiftDate(1)} style={arrowStyle}>→</button>
        </div>

        {/* STATS CARDS */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div style={cardStyle}>
            <p style={cardLabel}>ΕΣΟΔΑ</p>
            <p style={{ ...amountStyle, color: totalInc > 0 ? colors.accentGreen : colors.secondaryText }}>{totalInc.toFixed(2)}€</p>
          </div>
          <div style={cardStyle}>
            <p style={cardLabel}>ΕΞΟΔΑ</p>
            <p style={{ ...amountStyle, color: totalExp > 0 ? colors.accentRed : colors.secondaryText }}>{totalExp.toFixed(2)}€</p>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <Link href={`/add-income?date=${selectedDate}`} style={{ ...actionBtn, backgroundColor: colors.accentGreen }}>+ ΕΣΟΔΑ</Link>
          <Link href={`/add-expense?date=${selectedDate}`} style={{ ...actionBtn, backgroundColor: colors.accentRed }}>- ΕΞΟΔΑ</Link>
        </div>
        {isAdmin && (
          <Link href="/daily-z" style={zBtnStyle}>📟 ΚΛΕΙΣΙΜΟ ΤΑΜΕΙΟΥ (Ζ)</Link>
        )}

        {/* TRANSACTIONS LIST */}
        <div style={{ marginTop: '32px' }}>
          <p style={listHeaderStyle}>ΚΙΝΗΣΕΙΣ ΗΜΕΡΑΣ</p>

          {zEntries.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div onClick={() => setIsZExpanded(!isZExpanded)} style={zItemHeader}>
                <span style={{ fontWeight: '700' }}>📟 ΣΥΝΟΛΟ Ζ</span>
                <span style={{ fontWeight: '800', fontSize: '18px' }}>+{zTotal.toFixed(2)}€</span>
              </div>
              {isZExpanded && (
                <div style={breakdownPanel}>
                  {zEntries.map(z => (
                    <div key={z.id} style={subItemStyle}>
                      <div>
                        <p style={subItemTitle}>{getPaymentIcon(z.method)} {z.method.toUpperCase()}</p>
                        <span style={timeBadge}>🕒 {formatTime(z.created_at)}</span>
                      </div>
                      <p style={{ fontWeight: '700' }}>{Number(z.amount).toFixed(2)}€</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {regularEntries.map((t) => (
            <div key={t.id} style={itemCard} onClick={() => isAdmin && setExpandedTx(expandedTx === t.id ? null : t.id)}>
              <div style={{ flex: 1 }}>
                <p style={itemTitleStyle}>{t.suppliers?.name || t.category?.toUpperCase()}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <span style={methodBadge}>{getPaymentIcon(t.method)} {t.method.toUpperCase()}</span>
                  <span style={timeBadge}>🕒 {formatTime(t.created_at)}</span>
                </div>
              </div>
              <p style={{ ...itemAmountStyle, color: t.type === 'income' ? colors.accentGreen : colors.accentRed }}>
                {t.type === 'income' ? '+' : '-'}{Math.abs(Number(t.amount)).toFixed(2)}€
              </p>
            </div>
          ))}

          {transactions.length === 0 && !loading && (
             <p style={{ textAlign: 'center', padding: '60px 0', color: colors.secondaryText, fontWeight: '600', fontSize: '14px' }}>
               Δεν υπάρχουν κινήσεις για αυτή την ημέρα.
             </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  return <Suspense fallback={<div style={loaderStyle}>Φόρτωση...</div>}><DashboardContent /></Suspense>
}

// --- STYLES ---
const iphoneWrapper: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100dvh',
  padding: '20px',
}

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }
const titleStyle: any = { fontWeight: '800', fontSize: '22px', margin: 0, color: colors.primaryDark, letterSpacing: '-0.5px' }
const subtitleStyle: any = { margin: 0, fontSize: '10px', color: colors.secondaryText, fontWeight: '700', letterSpacing: '1px' }
const onlineDot: any = { width: '6px', height: '6px', backgroundColor: colors.accentGreen, borderRadius: '50%' }

const logoBoxStyle: any = {
  width: '44px', height: '44px', backgroundColor: colors.primaryDark, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)'
}

const cardStyle: any = {
  flex: 1, background: colors.cardBg, padding: '24px 16px', borderRadius: '24px', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)', border: `1px solid ${colors.border}`
}

const amountStyle: any = { fontSize: '26px', fontWeight: '800', margin: 0, letterSpacing: '-1px' }
const cardLabel: any = { fontSize: '11px', fontWeight: '700', color: colors.secondaryText, marginBottom: '6px' }

const dateBarStyle: any = {
  display: 'flex', alignItems: 'center', background: colors.cardBg, padding: '12px', borderRadius: '16px', marginBottom: '20px', border: `1px solid ${colors.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
}

const dateTextStyle: any = { flex: 1, textAlign: 'center', fontWeight: '800', color: colors.primaryDark, fontSize: '14px' }
const arrowStyle: any = { background: 'none', border: 'none', fontSize: '18px', fontWeight: '800', cursor: 'pointer', padding: '0 10px' }

const actionBtn: any = {
  flex: 1, padding: '16px', borderRadius: '16px', color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '800', fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
}

const zBtnStyle: any = {
  display: 'block', padding: '16px', borderRadius: '16px', backgroundColor: colors.primaryDark, color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '700', fontSize: '13px', marginTop: '12px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)'
}

const itemCard: any = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: colors.cardBg, padding: '18px 20px', borderRadius: '20px', border: `1px solid ${colors.border}`, marginBottom: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
}

const itemTitleStyle: any = { fontWeight: '700', margin: 0, fontSize: '15px', color: colors.primaryDark }
const itemAmountStyle: any = { fontWeight: '800', fontSize: '17px', margin: 0 }
const listHeaderStyle: any = { fontSize: '11px', fontWeight: '800', color: colors.secondaryText, marginBottom: '16px', letterSpacing: '1px' }

const timeBadge: any = { fontSize: '10px', backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '6px', fontWeight: '700' }
const methodBadge: any = { fontSize: '10px', fontWeight: '700', color: colors.secondaryText }

const loaderStyle: any = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.secondaryText, fontWeight: '700', backgroundColor: colors.bgLight }

const menuBtnStyle: any = { width: '40px', height: '40px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: 'white', fontSize: '20px', cursor: 'pointer' }
const dropdownStyle: any = { position: 'absolute' as any, top: '50px', right: 0, background: 'white', minWidth: '200px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '8px', zIndex: 1100, border: `1px solid ${colors.border}` }
const menuItem: any = { display: 'block', padding: '12px', textDecoration: 'none', color: colors.primaryDark, fontWeight: '600', fontSize: '14px' }
const menuSectionLabel: any = { fontSize: '9px', fontWeight: '800', color: colors.secondaryText, padding: '4px 12px' }
const divider: any = { height: '1px', backgroundColor: colors.border, margin: '4px 0' }
const logoutBtnStyle: any = { ...menuItem, width: '100%', textAlign: 'left', background: '#fff1f2', color: colors.accentRed, border: 'none', borderRadius: '8px', cursor: 'pointer' }

const zItemHeader: any = { ...itemCard, background: colors.primaryDark, color: 'white', border: 'none', cursor: 'pointer' }
const breakdownPanel: any = { background: 'white', padding: '15px', borderRadius: '0 0 20px 20px', border: `1px solid ${colors.border}`, borderTop: 'none', marginTop: '-15px', marginBottom: '15px' }
const subItemStyle: any = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.border}` }
const subItemTitle: any = { margin: 0, fontSize: '13px', fontWeight: '600' }
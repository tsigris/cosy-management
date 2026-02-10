'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

// --- ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΠΑΛΕΤΑ ΧΡΩΜΑΤΩΝ ---
const colors = {
  primaryDark: '#1e293b',
  primaryText: '#334155',
  secondaryText: '#64748b',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  cardBg: '#ffffff',
  border: '#e2e8f0',
  hoverBg: '#f1f5f9',
};

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 1. ΛΟΓΙΚΗ ΒΑΡΔΙΑΣ (Αλλαγή στις 07:00)
  const getBusinessDate = () => {
    const now = new Date()
    if (now.getHours() < 7) now.setDate(now.getDate() - 1)
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [businessToday] = useState(getBusinessDate())
  const selectedDate = searchParams.get('date') || businessToday
  
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [isZExpanded, setIsZExpanded] = useState(false)
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null)
  
  const [storeName, setStoreName] = useState('Cosy App')
  const [permissions, setPermissions] = useState({ 
    role: 'user', store_id: null as string | null,
    can_view_analysis: false, can_view_history: false
  })

  // 2. ΜΗΧΑΝΙΣΜΟΣ ΑΥΤΟ-ΙΑΣΗΣ (Καθαρισμός Cookies & Storage)
  const forceSelfHeal = useCallback(async () => {
    await supabase.auth.signOut()
    localStorage.clear()
    sessionStorage.clear()
    // Καθαρισμός Cookies μέσω JS
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
    })
    window.location.href = '/login'
  }, [])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      localStorage.clear()
      window.location.href = '/login'
    } catch (err) { window.location.href = '/login' }
  }

  // 3. ΚΕΝΤΡΙΚΗ ΣΥΝΑΡΤΗΣΗ ΦΟΡΤΩΣΗΣ ΜΕ TIMEOUT
  const fetchAppData = useCallback(async () => {
    try {
      // Timeout 7 δευτερολέπτων για να μην κολλάει η οθόνη
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 7000))
      const authPromise = supabase.auth.getSession()
      const sessionRes: any = await Promise.race([authPromise, timeout])
      
      const session = sessionRes.data?.session
      if (!session) {
        router.push('/login')
        return
      }
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      
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
          .eq('date', selectedDate) 
          .order('created_at', { ascending: false })

        setTransactions(transData || [])
      }
    } catch (err) { 
      console.error("Refresh Error:", err) 
    } finally { 
      setLoading(false) 
    }
  }, [selectedDate, router]);

  // 4. ΑΥΤΟΜΑΤΙΣΜΟΙ WAKE UP
  useEffect(() => {
    const handleWakeUp = () => {
      if (document.visibilityState === 'visible') {
        const currentBD = getBusinessDate()
        if (currentBD !== businessToday) {
          window.location.reload()
        } else {
          fetchAppData()
        }
      }
    }

    fetchAppData()

    document.addEventListener('visibilitychange', handleWakeUp)
    window.addEventListener('focus', handleWakeUp)

    const timer = setInterval(() => {
      if (getBusinessDate() !== businessToday) window.location.reload()
    }, 45000)

    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchAppData())
      .subscribe()

    return () => { 
      document.removeEventListener('visibilitychange', handleWakeUp)
      window.removeEventListener('focus', handleWakeUp)
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [selectedDate, fetchAppData, businessToday])

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
    } catch (e) { return '--:--' }
  }

  const getPaymentIcon = (method: string) => {
    const m = method?.toLowerCase() || ''
    if (m.includes('μετρητά')) return '💵'
    if (m.includes('κάρτα') || m.includes('pos') || m.includes('τράπεζα')) return '💳'
    if (m.includes('πίστωση')) return '🚩'
    return '📝'
  }

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    router.push(`/?date=${year}-${month}-${day}`)
  }

  const zTotal = transactions.filter(t => t.category === 'Εσοδα Ζ').reduce((acc, t) => acc + Number(t.amount), 0)
  const salaryEntries = transactions.filter(t => t.category === 'Προσωπικό')
  const groupedSalaries = salaryEntries.reduce((acc: any, t) => {
    const empId = t.employee_id || 'unknown'
    if (!acc[empId]) acc[empId] = { name: t.employees?.full_name || 'Προσωπικό', total: 0, items: [] }
    acc[empId].total += Math.abs(Number(t.amount))
    acc[empId].items.push(t)
    return acc
  }, {})

  const totalInc = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0)
  const totalExp = transactions.filter(t => t.type === 'expense' && !t.is_credit && t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0)

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '20px', textAlign: 'center' }}>
        <p style={{ fontWeight: '800', color: colors.primaryDark, fontSize: '18px' }}>ΣΥΓΧΡΟΝΙΣΜΟΣ...</p>
        <p style={{ fontSize: '12px', color: colors.secondaryText, marginTop: '10px', maxWidth: '280px' }}>Αν η φόρτωση καθυστερεί, πατήστε το παρακάτω κουμπί για αυτόματη επιδιόρθωση cookies.</p>
        <button onClick={forceSelfHeal} style={{ marginTop: '25px', backgroundColor: colors.accentRed, color: 'white', padding: '14px 24px', borderRadius: '14px', border: 'none', fontWeight: '800', fontSize: '13px', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)' }}>
          ΑΥΤΟΜΑΤΗ ΕΠΙΔΙΟΡΘΩΣΗ 🛠️
        </button>
      </div>
    )
  }

  return (
    <div style={iphoneWrapper}>
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>📈</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '24px', margin: 0, color: colors.primaryDark }}>{storeName}</h1>
              <p style={{ margin: 0, fontSize: '11px', color: colors.secondaryText, fontWeight: '600', letterSpacing: '1px' }}>BUSINESS DASHBOARD</p>
            </div>
          </div>
          
          <div style={{ position: 'relative' }}>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={menuBtnStyle}>⋮</button>
            {isMenuOpen && (
              <div style={dropdownStyle}>
                <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
                <Link href="/suppliers" style={menuItem} onClick={() => setIsMenuOpen(false)}>🛒 Προμηθευτές</Link>
                <Link href="/fixed-assets" style={menuItem} onClick={() => setIsMenuOpen(false)}>🔌 Πάγια</Link>
                {permissions.role === 'admin' && (
                  <>
                    <Link href="/employees" style={menuItem} onClick={() => setIsMenuOpen(false)}>👥 Υπάλληλοι</Link>
                    <Link href="/suppliers-balance" style={menuItem} onClick={() => setIsMenuOpen(false)}>🚩 Καρτέλες (Χρέη)</Link>
                  </>
                )}
                {(permissions.role === 'admin' || permissions.can_view_analysis) && <Link href="/analysis" style={menuItem} onClick={() => setIsMenuOpen(false)}>📊 Ανάλυση</Link>}
                <div style={divider} />
                <button onClick={handleLogout} style={logoutBtnStyle}>ΑΠΟΣΥΝΔΕΣΗ 🚪</button>
              </div>
            )}
          </div>
        </div>

        {/* DATE SELECTOR */}
        <div style={dateBarStyle}>
          <button onClick={() => shiftDate(-1)} style={arrowStyle}>←</button>
          <div style={{ flex: 1, textAlign: 'center', fontWeight: '800', color: colors.primaryDark, fontSize: '16px' }}>
            {new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' }).toUpperCase()}
          </div>
          <button onClick={() => shiftDate(1)} style={arrowStyle}>→</button>
        </div>

        {/* STATS */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
          <div style={cardStyle}>
            <p style={cardLabel}>ΕΣΟΔΑ</p>
            <p style={{ color: colors.accentGreen, fontSize: '26px', fontWeight: '800', margin: 0 }}>{totalInc.toFixed(2)}€</p>
          </div>
          <div style={cardStyle}>
            <p style={cardLabel}>ΕΞΟΔΑ</p>
            <p style={{ color: colors.accentRed, fontSize: '26px', fontWeight: '800', margin: 0 }}>{totalExp.toFixed(2)}€</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <Link href={`/add-income?date=${selectedDate}`} style={{ ...actionBtn, backgroundColor: colors.accentGreen }}>+ ΕΣΟΔΑ</Link>
          <Link href={`/add-expense?date=${selectedDate}`} style={{ ...actionBtn, backgroundColor: colors.accentRed }}>- ΕΞΟΔΑ</Link>
        </div>
        {permissions.role === 'admin' && <Link href="/daily-z" style={zBtnStyle}>📟 ΚΛΕΙΣΙΜΟ ΤΑΜΕΙΟΥ (Ζ)</Link>}

        {/* LIST */}
        <div style={{ marginTop: '35px' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: colors.secondaryText, marginBottom: '15px', letterSpacing: '1px' }}>ΚΙΝΗΣΕΙΣ ΗΜΕΡΑΣ</p>
          
          {zTotal > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div onClick={() => setIsZExpanded(!isZExpanded)} style={zItemHeader}>
                <div style={{ flex: 1 }}><p style={{ fontWeight: '700', margin: 0, fontSize: '15px' }}>📟 ΣΥΝΟΛΟ Ζ</p></div>
                <p style={{ fontWeight: '800', fontSize: '18px', margin: 0 }}>+{zTotal.toFixed(2)}€</p>
              </div>
            </div>
          )}

          {Object.keys(groupedSalaries).map(empId => {
            const group = groupedSalaries[empId]
            return (
              <div key={empId} style={salaryItemHeader}>
                <div style={{ flex: 1 }}><p style={{ fontWeight: '700', margin: 0, fontSize: '15px', color: '#1e40af' }}>👤 {group.name.toUpperCase()}</p></div>
                <p style={{ fontWeight: '800', fontSize: '18px', color: colors.accentRed, margin: 0 }}>-{group.total.toFixed(2)}€</p>
              </div>
            )
          })}

          {transactions.filter(t => t.category !== 'Εσοδα Ζ' && t.category !== 'Προσωπικό' && t.category !== 'pocket').map(t => (
            <div key={t.id} style={itemCard}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '700', margin: 0, fontSize: '16px', color: colors.primaryDark }}>{t.suppliers?.name || t.category.toUpperCase()}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <span style={timeBadge}>🕒 {formatTime(t.created_at)}</span>
                  <span style={{ fontSize: '12px', color: colors.secondaryText, fontWeight: '600' }}>{getPaymentIcon(t.method)} {t.method.toUpperCase()}</span>
                </div>
              </div>
              <p style={{ fontWeight: '800', fontSize: '18px', color: t.type === 'income' ? colors.accentGreen : colors.accentRed, margin: 0 }}>
                {t.type === 'income' ? '+' : '-'}{Math.abs(Number(t.amount)).toFixed(2)}€
              </p>
            </div>
          ))}
          {transactions.length === 0 && <p style={{ textAlign: 'center', padding: '40px', color: colors.secondaryText, fontWeight: '600' }}>Καμία κίνηση για σήμερα.</p>}
        </div>
      </div>
    </div>
  )
}

const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const logoBoxStyle: any = { width: '48px', height: '48px', backgroundColor: colors.primaryDark, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '22px' };
const menuBtnStyle: any = { width: '42px', height: '42px', borderRadius: '12px', border: `1px solid ${colors.border}`, background: colors.cardBg, fontSize: '20px', cursor: 'pointer' };
const dropdownStyle: any = { position: 'absolute' as any, top: '50px', right: 0, background: colors.cardBg, minWidth: '220px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '8px', zIndex: 1000, border: `1px solid ${colors.border}` };
const menuItem: any = { display: 'block', padding: '10px 14px', textDecoration: 'none', color: colors.primaryDark, fontWeight: '600', fontSize: '14px', borderRadius: '10px' };
const menuSectionLabel: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, paddingLeft: '14px', marginTop: '8px', marginBottom: '4px', letterSpacing: '1px' };
const logoutBtnStyle: any = { ...menuItem, width: '100%', textAlign: 'left', background: '#fee2e2', color: colors.accentRed, border: 'none', marginTop: '8px' };
const divider: any = { height: '1px', backgroundColor: colors.border, margin: '6px 0' };
const dateBarStyle: any = { display: 'flex', alignItems: 'center', background: colors.cardBg, padding: '10px', borderRadius: '16px', marginBottom: '25px', border: `1px solid ${colors.border}` };
const arrowStyle: any = { background: 'none', border: 'none', fontSize: '18px', fontWeight: '800', color: colors.primaryDark, cursor: 'pointer', padding: '0 12px' };
const cardStyle: any = { flex: 1, background: colors.cardBg, padding: '20px 15px', borderRadius: '20px', textAlign: 'center', border: `1px solid ${colors.border}` };
const cardLabel: any = { fontSize: '11px', fontWeight: '700', color: colors.secondaryText, marginBottom: '8px' };
const actionBtn: any = { flex: 1, padding: '16px', borderRadius: '18px', color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '700', fontSize: '14px' };
const zBtnStyle: any = { display: 'block', padding: '16px', borderRadius: '18px', backgroundColor: colors.primaryDark, color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '700', fontSize: '14px', marginTop: '12px' };
const itemCard: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: colors.cardBg, padding: '18px', borderRadius: '18px', border: `1px solid ${colors.border}`, marginBottom: '10px' };
const zItemHeader: any = { ...itemCard, background: colors.primaryDark, color: 'white', border: 'none' };
const salaryItemHeader: any = { ...itemCard, background: '#eff6ff', border: '1px solid #bfdbfe' };
const timeBadge: any = { fontSize: '10px', backgroundColor: '#f0f9ff', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', fontWeight: '700', border: '1px solid #bae6fd' };

export default function HomePage() { return <main><Suspense fallback={<div>Φόρτωση...</div>}><DashboardContent /></Suspense></main> }
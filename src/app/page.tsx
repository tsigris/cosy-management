'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

// --- MODERN PREMIUM PALETTE ---
const colors = {
  primary: '#0f172a',    
  secondary: '#64748b',
  success: '#10b981',   
  danger: '#f43f5e',     
  background: '#f8fafc',       
  surface: '#ffffff',
  border: '#e2e8f0',
  indigo: '#6366f1'
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [businessToday] = useState(() => {
    const now = new Date()
    if (now.getHours() < 7) now.setDate(now.getDate() - 1)
    return now.toISOString().split('T')[0]
  })
  
  const selectedDate = searchParams.get('date') || businessToday

  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [isZExpanded, setIsZExpanded] = useState(false)
  const [storeName, setStoreName] = useState('Cosy')
  const [permissions, setPermissions] = useState({ role: 'user', store_id: null as any })

  const isAdmin = permissions.role === 'admin'

  const fetchAppData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.push('/login')

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    if (profile) {
      setStoreName(profile.store_name || 'Cosy')
      setPermissions({ role: profile.role, store_id: profile.store_id })
      
      const { data } = await supabase
        .from('transactions')
        .select('*, suppliers(name), employees(full_name)')
        .eq('store_id', profile.store_id)
        .eq('date', selectedDate)
        .order('created_at', { ascending: false })
      setTransactions(data || [])
    }
    setLoading(false)
  }, [selectedDate, router])

  useEffect(() => { fetchAppData() }, [fetchAppData])

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString('el-GR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch { return '--:--' }
  }

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    router.push(`/?date=${d.toISOString().split('T')[0]}`)
  }

  const totals = useMemo(() => {
    return transactions.reduce((acc, t) => {
      if (t.category === 'pocket') return acc
      const amt = Number(t.amount)
      if (t.type === 'income') acc.inc += amt
      else if (!t.is_credit) acc.exp += amt
      return acc
    }, { inc: 0, exp: 0 })
  }, [transactions])

  const zTotal = useMemo(() => 
    transactions.filter(t => t.category === 'Εσοδα Ζ').reduce((a, b) => a + Number(b.amount), 0), 
  [transactions])

  if (loading) return null

  return (
    <div style={containerStyle}>
      {/* Διόρθωση του Style Tag για να μην πετάει error */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        body { background-color: ${colors.background}; font-family: 'Plus Jakarta Sans', sans-serif; color: ${colors.primary}; margin: 0; }
        .modern-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .modern-card:active { transform: scale(0.98); }
      `}} />

      {/* TOP BAR */}
      <header style={topBar}>
        <div style={brandArea}>
          <div style={logoIcon}>C</div>
          <div>
            <h1 style={brandTitle}>{storeName}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={liveStatus}>Live</span>
              <div style={livePulse} />
            </div>
          </div>
        </div>
        <button style={menuToggle} onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <div style={hamburgerLine} />
          <div style={{ ...hamburgerLine, width: '12px' }} />
        </button>
      </header>

      {/* FLOATING DATE SELECTOR */}
      <div style={datePickerCard} className="modern-card">
        <button onClick={() => shiftDate(-1)} style={dateArrow}>←</button>
        <span style={dateDisplay}>
          {new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button onClick={() => shiftDate(1)} style={dateArrow}>→</button>
      </div>

      {/* HERO SECTION */}
      <section style={heroCard}>
        <p style={heroLabel}>ΔΙΑΘΕΣΙΜΟ ΥΠΟΛΟΙΠΟ ΗΜΕΡΑΣ</p>
        <h2 style={heroAmount}>{(totals.inc - totals.exp).toFixed(2)}€</h2>
        <div style={heroStatsRow}>
          <div style={heroStatItem}>
            <span style={statCircle(colors.success)}>↓</span>
            <span>{totals.inc.toFixed(2)}€</span>
          </div>
          <div style={heroStatItem}>
            <span style={statCircle(colors.danger)}>↑</span>
            <span>{totals.exp.toFixed(2)}€</span>
          </div>
        </div>
      </section>

      {/* ACTION BUTTONS */}
      <div style={actionsGrid}>
        <Link href={`/add-income?date=${selectedDate}`} style={actionBtn(colors.success)}>+ Έσοδο</Link>
        <Link href={`/add-expense?date=${selectedDate}`} style={actionBtn(colors.danger)}>- Έξοδο</Link>
        {isAdmin && <Link href="/daily-z" style={actionBtn(colors.primary)}>📟 Ζ</Link>}
      </div>

      {/* TRANSACTIONS FEED */}
      <div style={{ marginTop: '30px' }}>
        <h3 style={feedTitle}>Κινήσεις</h3>

        {zTotal > 0 && (
          <div style={zCard} onClick={() => setIsZExpanded(!isZExpanded)}>
             <div style={{ flex: 1 }}>
                <span style={zBadge}>DAILY TOTAL</span>
                <p style={{ margin: 0, fontWeight: 700 }}>Σύνολο Ζ</p>
             </div>
             <span style={zAmountText}>+{zTotal.toFixed(2)}€</span>
          </div>
        )}

        {transactions.filter(t => t.category !== 'Εσοδα Ζ').map((t) => (
          <div key={t.id} style={txRow} className="modern-card">
            <div style={txIconContainer(t.type === 'income')}>
              {t.type === 'income' ? '↙' : '↗'}
            </div>
            <div style={{ flex: 1, marginLeft: '12px' }}>
              <p style={txTitleText}>{t.suppliers?.name || t.category || 'Συναλλαγή'}</p>
              <p style={txSubText}>{t.method} • {formatTime(t.created_at)}</p>
            </div>
            <div style={txAmountValue(t.type === 'income')}>
              {t.type === 'income' ? '+' : '-'}{Math.abs(t.amount).toFixed(2)}€
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- REFINED STYLES ---
const containerStyle: any = { maxWidth: '480px', margin: '0 auto', padding: '0 20px 100px' }
const topBar: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0' }
const brandArea: any = { display: 'flex', alignItems: 'center', gap: '12px' }
const logoIcon: any = { width: '36px', height: '36px', background: colors.primary, color: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '18px' }
const brandTitle: any = { fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }
const liveStatus: any = { fontSize: '10px', fontWeight: '700', color: colors.secondary, textTransform: 'uppercase' }
const livePulse: any = { width: '6px', height: '6px', background: colors.success, borderRadius: '50%' }
const menuToggle: any = { background: 'none', border: 'none', padding: '8px', cursor: 'pointer' }
const hamburgerLine: any = { width: '20px', height: '2.5px', background: colors.primary, marginBottom: '4px', borderRadius: '2px' }

const datePickerCard: any = { background: colors.surface, padding: '14px 20px', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '25px', border: `1px solid ${colors.border}` }
const dateDisplay: any = { fontWeight: '700', fontSize: '14px', color: colors.primary }
const dateArrow: any = { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: colors.primary }

const heroCard: any = { background: colors.primary, padding: '28px', borderRadius: '24px', color: 'white', boxShadow: '0 15px 35px rgba(15, 23, 42, 0.25)', marginBottom: '25px' }
const heroLabel: any = { fontSize: '10px', fontWeight: '700', opacity: 0.6, letterSpacing: '1px', marginBottom: '8px' }
const heroAmount: any = { fontSize: '34px', fontWeight: '800', margin: 0, letterSpacing: '-1px' }
const heroStatsRow: any = { display: 'flex', gap: '16px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }
const heroStatItem: any = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600' }
const statCircle = (bg: string): any => ({ width: '20px', height: '20px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' })

const actionsGrid: any = { display: 'flex', gap: '12px' }
const actionBtn = (bg: string): any => ({ flex: 1, padding: '16px', background: bg, color: 'white', borderRadius: '18px', textAlign: 'center', textDecoration: 'none', fontWeight: '700', fontSize: '14px', boxShadow: `0 6px 12px ${bg}22` })

const feedTitle: any = { fontSize: '16px', fontWeight: '800', marginBottom: '16px' }
const zCard: any = { background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', padding: '18px', borderRadius: '20px', display: 'flex', alignItems: 'center', marginBottom: '16px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }
const zBadge: any = { fontSize: '9px', background: colors.indigo, padding: '3px 8px', borderRadius: '6px', fontWeight: '800', marginBottom: '4px', display: 'inline-block' }
const zAmountText: any = { fontSize: '18px', fontWeight: '800' }

const txRow: any = { background: colors.surface, padding: '16px', borderRadius: '20px', display: 'flex', alignItems: 'center', marginBottom: '12px', border: `1px solid ${colors.border}` }
const txIconContainer = (isInc: boolean): any => ({ width: '42px', height: '42px', borderRadius: '14px', background: isInc ? '#ecfdf5' : '#fff1f2', color: isInc ? colors.success : colors.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' })
const txTitleText: any = { margin: 0, fontWeight: '700', fontSize: '15px', color: colors.primary }
const txSubText: any = { margin: 0, fontSize: '12px', color: colors.secondary, marginTop: '2px' }
const txAmountValue = (isInc: boolean): any => ({ fontWeight: '800', fontSize: '16px', color: isInc ? colors.success : colors.primary })

export default function HomePage() { return <Suspense fallback={null}><DashboardContent /></Suspense> }
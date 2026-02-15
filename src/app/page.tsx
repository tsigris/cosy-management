'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { el } from 'date-fns/locale'

// --- MODERN PREMIUM PALETTE ---
const colors = {
  primaryDark: '#0f172a', 
  secondaryText: '#64748b', 
  accentRed: '#f43f5e',   
  accentBlue: '#6366f1',  
  accentGreen: '#10b981',
  bgLight: '#f8fafc',     
  border: '#e2e8f0',      
  white: '#ffffff'
};

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // 1. DATE LOGIC (07:00 AM)
  const getBusinessDate = () => {
    const now = new Date()
    if (now.getHours() < 7) now.setDate(now.getDate() - 1)
    return format(now, 'yyyy-MM-dd')
  }

  const selectedDate = searchParams.get('date') || getBusinessDate()
  
  // 2. STATE
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [storeName, setStoreName] = useState('Φορτώνει...')
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // 3. LOAD DATA
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const { data: profile } = await supabase.from('profiles').select('*, stores(name)').eq('id', session.user.id).single()
      
      if (profile) {
        setIsAdmin(profile.role === 'admin' || profile.role === 'superadmin')
        setStoreName(profile.stores?.name || 'My Store')

        const { data: tx } = await supabase
          .from('transactions')
          .select('*, suppliers(name), fixed_assets(name)')
          .eq('store_id', profile.store_id)
          .eq('date', selectedDate)
          .order('created_at', { ascending: false })

        if (tx) setTransactions(tx)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedDate, router])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  // 4. CALCULATIONS
  const totals = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0)
    const expense = transactions.filter(t => t.type === 'expense' || t.type === 'debt_payment').reduce((acc, t) => acc + t.amount, 0)
    return { income, expense, balance: income - expense }
  }, [transactions])

  const changeDate = (days: number) => {
    const current = parseISO(selectedDate)
    const next = days > 0 ? addDays(current, 1) : subDays(current, 1)
    router.push(`/?date=${format(next, 'yyyy-MM-dd')}`)
  }

  return (
    <div style={iphoneWrapper}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}} />

      {/* MODERN TOP BAR */}
      <header style={headerStyle}>
        <div style={brandArea}>
          <div style={logoBox}>📈</div>
          <div>
            <h1 style={storeTitle}>{storeName}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={dashboardSub}>BUSINESS DASHBOARD</span>
              <div style={statusDot} />
            </div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <button style={menuToggle} onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <div style={hamburgerLine} />
            <div style={{ ...hamburgerLine, width: '12px', marginBottom: 0 }} />
          </button>

          {/* DROPDOWN MENU */}
          {isMenuOpen && (
            <div style={dropdownStyle}>
              <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
              <Link href="/suppliers" style={menuItem}>🛒 Προμηθευτές</Link>
              <Link href="/fixed-assets" style={menuItem}>🔌 Πάγια</Link>
              {isAdmin && (
                <>
                  <Link href="/employees" style={menuItem}>👥 Υπάλληλοι</Link>
                  <Link href="/suppliers-balance" style={menuItem}>🚩 Καρτέλες (Χρέη)</Link>
                </>
              )}
              <Link href="/analysis" style={menuItem}>📊 Ανάλυση</Link>
              <div style={menuDivider} />
              <p style={menuSectionLabel}>ΕΦΑΡΜΟΓΗ</p>
              <Link href="/settings" style={menuItem}>⚙️ Ρυθμίσεις</Link>
              <button onClick={() => supabase.auth.signOut()} style={logoutBtnStyle}>ΑΠΟΣΥΝΔΕΣΗ 🚪</button>
            </div>
          )}
        </div>
      </header>

      {/* DATE SELECTOR */}
      <div style={dateCard}>
        <button onClick={() => changeDate(-1)} style={dateNavBtn}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <p style={dateText}>{format(parseISO(selectedDate), 'EEEE, d MMMM', { locale: el }).toUpperCase()}</p>
          <input type="date" value={selectedDate} onChange={(e) => router.push(`/?date=${e.target.value}`)} style={dateHiddenInput} />
        </div>
        <button onClick={() => changeDate(1)} style={dateNavBtn}>›</button>
      </div>

      {/* STATS GRID */}
      <div style={statsGrid}>
        <div style={{ ...statBox, backgroundColor: colors.accentGreen }}>
          <p style={statLabel}>ΕΣΟΔΑ</p>
          <h2 style={statValue}>{totals.income.toFixed(2)}€</h2>
        </div>
        <div style={{ ...statBox, backgroundColor: colors.accentRed }}>
          <p style={statLabel}>ΕΞΟΔΑ</p>
          <h2 style={statValue}>{totals.expense.toFixed(2)}€</h2>
        </div>
      </div>

      {/* BALANCE CARD */}
      <div style={balanceCard}>
        <p style={{ ...statLabel, color: colors.secondaryText }}>ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ</p>
        <h2 style={{ ...statValue, color: colors.primaryDark, fontSize: '32px' }}>{totals.balance.toFixed(2)}€</h2>
      </div>

      {/* ACTIONS */}
      <div style={actionGrid}>
        <Link href={`/expenses/add?date=${selectedDate}`} style={{ ...actionBtn, backgroundColor: colors.primaryDark }}>+ ΕΞΟΔΟ</Link>
        <Link href={`/income/add?date=${selectedDate}`} style={{ ...actionBtn, backgroundColor: colors.accentGreen }}>+ ΕΣΟΔΟ</Link>
      </div>

      {/* TRANSACTION LIST */}
      <div style={listContainer}>
        <p style={listHeader}>ΚΙΝΗΣΕΙΣ ΗΜΕΡΑΣ ({transactions.length})</p>
        {loading ? <p style={{textAlign:'center', padding:'20px'}}>Φορτώνει...</p> : (
          transactions.map(t => (
            <div key={t.id} style={txRow} onClick={() => router.push(`/${t.type === 'income' ? 'income' : 'expenses'}/add?editId=${t.id}`)}>
              <div style={{ flex: 1 }}>
                <p style={txTitle}>{t.suppliers?.name || t.fixed_assets?.name || t.category}</p>
                <p style={txMeta}>{t.method} • {t.created_by_name}</p>
              </div>
              <p style={{ ...txAmount, color: t.type === 'income' ? colors.accentGreen : colors.accentRed }}>
                {t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)}€
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// --- MODERN STYLES ---
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', paddingBottom: '100px' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const brandArea = { display: 'flex', alignItems: 'center', gap: '12px' };
const logoBox = { width: '42px', height: '42px', backgroundColor: colors.primaryDark, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const storeTitle = { fontSize: '18px', fontWeight: '800', margin: 0, color: colors.primaryDark };
const dashboardSub = { fontSize: '9px', fontWeight: '800', color: colors.secondaryText, letterSpacing: '1px' };
const statusDot = { width: '6px', height: '6px', backgroundColor: colors.accentGreen, borderRadius: '50%' };
const menuToggle: any = { background: 'white', border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '10px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' };
const hamburgerLine = { width: '20px', height: '2px', backgroundColor: colors.primaryDark, marginBottom: '4px', borderRadius: '2px' };

const dropdownStyle: any = { position: 'absolute', top: '55px', right: 0, background: 'white', minWidth: '220px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', padding: '8px', zIndex: 2000, border: `1px solid ${colors.border}` };
const menuItem: any = { display: 'block', padding: '12px 14px', textDecoration: 'none', color: colors.primaryDark, fontWeight: '700', fontSize: '14px', borderRadius: '10px' };
const menuSectionLabel = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, padding: '8px 14px 4px', letterSpacing: '0.5px' };
const menuDivider = { height: '1px', backgroundColor: colors.border, margin: '6px 0' };
const logoutBtnStyle: any = { ...menuItem, width: '100%', textAlign: 'left', background: '#fff1f2', color: colors.accentRed, border: 'none', marginTop: '8px', cursor: 'pointer' };

const dateCard: any = { backgroundColor: 'white', padding: '15px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', border: `1px solid ${colors.border}` };
const dateText = { fontSize: '12px', fontWeight: '800', color: colors.primaryDark, margin: 0 };
const dateNavBtn = { background: 'none', border: 'none', fontSize: '24px', color: colors.secondaryText, cursor: 'pointer', padding: '0 10px' };
const dateHiddenInput: any = { border: 'none', fontSize: '10px', color: colors.accentBlue, fontWeight: '700', background: 'none', cursor: 'pointer' };

const statsGrid = { display: 'flex', gap: '12px', marginBottom: '12px' };
const statBox: any = { flex: 1, padding: '20px', borderRadius: '24px', color: 'white' };
const statLabel = { fontSize: '10px', fontWeight: '800', opacity: 0.8, margin: 0, letterSpacing: '0.5px' };
const statValue = { fontSize: '24px', fontWeight: '800', margin: '5px 0' };

const balanceCard: any = { backgroundColor: 'white', padding: '25px', borderRadius: '24px', textAlign: 'center', border: `1px solid ${colors.border}`, marginBottom: '20px' };
const actionGrid = { display: 'flex', gap: '12px', marginBottom: '25px' };
const actionBtn: any = { flex: 1, padding: '18px', borderRadius: '18px', color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '800', fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };

const listContainer = { backgroundColor: 'white', borderRadius: '28px', padding: '20px', border: `1px solid ${colors.border}` };
const listHeader = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '15px', letterSpacing: '0.5px' };
const txRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: `1px solid ${colors.bgLight}`, cursor: 'pointer' };
const txTitle = { fontWeight: '700', fontSize: '14px', margin: 0, color: colors.primaryDark };
const txMeta = { fontSize: '11px', color: colors.secondaryText, margin: 0, fontWeight: '600' };
const txAmount = { fontWeight: '800', fontSize: '15px' };

export default function DashboardPage() {
  return <Suspense fallback={<div>Φόρτωση...</div>}><DashboardContent /></Suspense>
}
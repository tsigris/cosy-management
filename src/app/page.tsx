'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NextLink from 'next/link'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { el } from 'date-fns/locale'
import { Toaster, toast } from 'sonner'
import { TrendingUp, TrendingDown, Menu, X, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react'

// --- MODERN PREMIUM PALETTE ---
const colors = {
  primaryDark: '#0f172a',
  secondaryText: '#64748b',
  accentRed: '#f43f5e',
  accentBlue: '#6366f1',
  accentGreen: '#10b981',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  warning: '#fffbeb',
  warningText: '#92400e',
}

type YtdInfo = {
  loading: boolean
  // income via revenue_source
  turnoverIncome?: number
  // income collections (received) for revenue_source (optional)
  receivedIncome?: number
  // open (credit - received) for revenue_source (optional)
  openIncome?: number

  // expenses for supplier/asset
  totalExpenses?: number
  // payments for supplier/asset
  payments?: number
  // open (expenses on credit - payments) for supplier/asset (optional)
  openExpense?: number
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdFromUrl = searchParams.get('store')

  // ✅ Business day logic: before 07:00 counts as previous day
  const getBusinessDate = () => {
    const now = new Date()
    if (now.getHours() < 7) now.setDate(now.getDate() - 1)
    return format(now, 'yyyy-MM-dd')
  }

  const selectedDate = searchParams.get('date') || getBusinessDate()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isStoreAdmin, setIsStoreAdmin] = useState(false)
  const [canViewAnalysis, setCanViewAnalysis] = useState(false)
  const [storeName, setStoreName] = useState('Φορτώνει...')
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)

  // ✅ NEW: Z visibility flag (from settings)
  const [zEnabled, setZEnabled] = useState<boolean>(true)

  // NEW: cache YTD metrics per entity key
  const [ytdCache, setYtdCache] = useState<Record<string, YtdInfo>>({})

  // ✅ YTD should follow BUSINESS day (same as app logic)
  const businessTodayStr = getBusinessDate()
  const businessYear = String(businessTodayStr).slice(0, 4)
  const yearStartStr = `${businessYear}-01-01`

  const getEntityKeyFromTx = (t: any) => {
    if (t?.revenue_source_id) return `rev:${t.revenue_source_id}`
    if (t?.supplier_id) return `sup:${t.supplier_id}`
    if (t?.fixed_asset_id) return `asset:${t.fixed_asset_id}`
    return null
  }

  const getEntityLabelFromTx = (t: any) => {
    return (
      t?.revenue_sources?.name ||
      t?.suppliers?.name ||
      t?.fixed_assets?.name ||
      t?.category ||
      'Συναλλαγή'
    )
  }

  const loadYtdForTx = useCallback(
    async (t: any) => {
      const key = getEntityKeyFromTx(t)
      if (!key || !storeIdFromUrl) return

      // avoid refetch
      if (ytdCache[key]?.loading === true) return
      if (ytdCache[key]?.loading === false) return

      setYtdCache((prev) => ({ ...prev, [key]: { loading: true } }))

      try {
        let q = supabase
          .from('transactions')
          .select('amount, type, is_credit, supplier_id, fixed_asset_id, revenue_source_id, date')
          .eq('store_id', storeIdFromUrl)
          .gte('date', yearStartStr)
          .lte('date', businessTodayStr)

        if (key.startsWith('rev:')) q = q.eq('revenue_source_id', key.replace('rev:', ''))
        if (key.startsWith('sup:')) q = q.eq('supplier_id', key.replace('sup:', ''))
        if (key.startsWith('asset:')) q = q.eq('fixed_asset_id', key.replace('asset:', ''))

        const res = await q
        if (res.error) throw res.error
        const rows = res.data || []

        // --- Revenue source YTD ---
        if (key.startsWith('rev:')) {
          const turnoverIncome = rows
            .filter((r: any) => String(r.type || '') === 'income')
            .reduce((acc: number, r: any) => acc + Math.abs(Number(r.amount) || 0), 0)

          const RECEIVED_TYPES = ['income_collection', 'debt_received', 'debt_payment']
          const receivedIncome = rows
            .filter((r: any) => RECEIVED_TYPES.includes(String(r.type || '')))
            .reduce((acc: number, r: any) => acc + Math.abs(Number(r.amount) || 0), 0)

          const creditIncome = rows
            .filter((r: any) => r.is_credit === true)
            .reduce((acc: number, r: any) => acc + Math.abs(Number(r.amount) || 0), 0)

          const openIncome = creditIncome - receivedIncome

          setYtdCache((prev) => ({
            ...prev,
            [key]: { loading: false, turnoverIncome, receivedIncome, openIncome },
          }))
          return
        }

        // --- Supplier / Asset YTD ---
        const totalExpenses = rows
          .filter((r: any) => String(r.type || '') === 'expense')
          .reduce((acc: number, r: any) => acc + Math.abs(Number(r.amount) || 0), 0)

        const payments = rows
          .filter((r: any) => String(r.type || '') === 'debt_payment')
          .reduce((acc: number, r: any) => acc + Math.abs(Number(r.amount) || 0), 0)

        const creditExpenses = rows
          .filter((r: any) => r.is_credit === true)
          .reduce((acc: number, r: any) => acc + Math.abs(Number(r.amount) || 0), 0)

        const openExpense = creditExpenses - payments

        setYtdCache((prev) => ({
          ...prev,
          [key]: { loading: false, totalExpenses, payments, openExpense },
        }))
      } catch (e) {
        console.error(e)
        setYtdCache((prev) => ({ ...prev, [key]: { loading: false } }))
      }
    },
    [storeIdFromUrl, ytdCache, yearStartStr, businessTodayStr]
  )

  const loadDashboard = useCallback(async () => {
    if (!storeIdFromUrl) {
      router.replace('/select-store')
      return
    }

    try {
      setLoading(true)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      // ✅ store name + settings (z_enabled)
      const { data: storeData, error: storeErr } = await supabase
        .from('stores')
        .select('name, z_enabled')
        .eq('id', storeIdFromUrl)
        .maybeSingle()

      if (storeErr) console.error(storeErr)
      if (storeData?.name) setStoreName(storeData.name)

      // default: true (if null/undefined)
      setZEnabled(storeData?.z_enabled === false ? false : true)

      // ✅ day transactions
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('*, suppliers(name), fixed_assets(name), revenue_sources(name)')
        .eq('store_id', storeIdFromUrl)
        .eq('date', selectedDate)
        .order('created_at', { ascending: false })

      if (txError) throw txError
      setTransactions(tx || [])

      // RBAC
      const { data: access } = await supabase
        .from('store_access')
        .select('role, can_view_analysis')
        .eq('user_id', session.user.id)
        .eq('store_id', storeIdFromUrl)
        .maybeSingle()

      if (access) {
        setIsStoreAdmin(access.role === 'admin')
        setCanViewAnalysis(access.role === 'admin' || access.can_view_analysis === true)
      } else {
        setIsStoreAdmin(false)
        setCanViewAnalysis(false)
      }
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedDate, router, storeIdFromUrl])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const handleDelete = async (id: string) => {
    if (!confirm('Οριστική διαγραφή αυτής της κίνησης;')) return
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id).eq('store_id', storeIdFromUrl)

      if (error) throw error
      setTransactions((prev) => prev.filter((t) => t.id !== id))
      setExpandedTx(null)
      toast.success('Η κίνηση διαγράφηκε')
    } catch (err) {
      toast.error('Σφάλμα κατά τη διαγραφή')
    }
  }

  const totals = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

    const expense = transactions
      .filter((t) => (t.type === 'expense' || t.type === 'debt_payment') && t.is_credit !== true)
      .reduce((acc, t) => acc + (Math.abs(Number(t.amount)) || 0), 0)

    // ✅ NEW: total credits of the day (any tx with is_credit === true)
    const credits = transactions
      .filter((t) => t.is_credit === true)
      .reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount) || 0), 0)

    return { income, expense, credits, balance: income - expense }
  }, [transactions])

  const changeDate = (days: number) => {
    const current = parseISO(selectedDate)
    const next = days > 0 ? addDays(current, 1) : subDays(current, 1)
    router.push(`/?date=${format(next, 'yyyy-MM-dd')}&store=${storeIdFromUrl}`)
    setExpandedTx(null)
  }

  const money = (n: any) => (Number(n) || 0).toLocaleString('el-GR', { minimumFractionDigits: 2 })

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />

      <header style={headerStyle}>
        <div style={brandArea}>
          <div style={logoBox}>{storeName?.charAt(0) || '?'}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={storeTitleText}>{storeName?.toUpperCase() || 'ΦΟΡΤΩΣΗ...'}</h1>
              <NextLink href="/select-store" style={switchBtnStyle}>
                ΑΛΛΑΓΗ
              </NextLink>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={dashboardSub}>BUSINESS DASHBOARD</span>
              <div style={statusDot} />
            </div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <button style={menuToggle} onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {isMenuOpen && (
            <div style={dropdownStyle}>
              {isStoreAdmin && (
                <>
                  <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
                  <NextLink
                    href={`/manage-lists?store=${storeIdFromUrl}`}
                    style={menuItem}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    ⚙️ Διαχείριση Καταλόγων
                  </NextLink>
                </>
              )}
              {(isStoreAdmin || canViewAnalysis) && <div style={menuDivider} />}
              {canViewAnalysis && (
                <NextLink
                  href={`/analysis?store=${storeIdFromUrl}`}
                  style={menuItem}
                  onClick={() => setIsMenuOpen(false)}
                >
                  📊 Ανάλυση
                </NextLink>
              )}
              <div style={menuDivider} />
              <p style={menuSectionLabel}>ΥΠΟΣΤΗΡΙΞΗ & ΡΥΘΜΙΣΕΙΣ</p>
              <NextLink href={`/settings?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>
                ⚙️ Ρυθμίσεις
              </NextLink>
              <NextLink
                href={`/instructions?store=${storeIdFromUrl}`}
                style={menuItem}
                onClick={() => setIsMenuOpen(false)}
              >
                📖 Οδηγίες Χρήσης
              </NextLink>

              <NextLink
                href={`/permissions?store=${storeIdFromUrl}`}
                style={menuItem}
                onClick={() => setIsMenuOpen(false)}
              >
                🔐 Δικαιώματα
              </NextLink>

              <div style={menuDivider} />
              <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} style={logoutBtnStyle}>
                ΑΠΟΣΥΝΔΕΣΗ 🚪
              </button>
            </div>
          )}
        </div>
      </header>

      <div style={dateCard}>
        <button onClick={() => changeDate(-1)} style={dateNavBtn}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={dateText}>
            {format(parseISO(selectedDate), 'EEEE, d MMMM', { locale: el }).toUpperCase()}
          </p>
          <p style={businessHint}>
            Λογιστική μέρα έως 06:59 • YTD: {yearStartStr} → {businessTodayStr}
          </p>
        </div>
        <button onClick={() => changeDate(1)} style={dateNavBtn}>
          <ChevronRight size={24} />
        </button>
      </div>

      <div style={heroCardStyle}>
        <p style={heroLabel}>ΔΙΑΘΕΣΙΜΟ ΥΠΟΛΟΙΠΟ ΗΜΕΡΑΣ</p>
        <h2 style={heroAmountText}>{totals.balance.toFixed(2)}€</h2>

        <div style={heroStatsRow}>
          <div style={heroStatItem}>
            <div style={statCircle(colors.accentGreen)}>
              <TrendingUp size={12} />
            </div>
            <span style={heroStatValue}>{totals.income.toFixed(2)}€</span>
          </div>

          <div style={heroStatItem}>
            <div style={statCircle(colors.accentRed)}>
              <TrendingDown size={12} />
            </div>
            <span style={heroStatValue}>{totals.expense.toFixed(2)}€</span>
          </div>
        </div>

        {/* ✅ NEW: Credits of day */}
        <div style={heroCreditWrap}>
          <div style={heroCreditPill}>
            <div style={creditIconCircle}>
              <CreditCard size={14} />
            </div>
            <span style={heroCreditLabel}>ΠΙΣΤΩΣΕΙΣ ΗΜΕΡΑΣ</span>
            <span style={heroCreditValue}>{totals.credits.toFixed(2)}€</span>
          </div>
        </div>
      </div>

      {/* ✅ NEW LAYOUT: Income/Expense row + Z centered below */}
      <div style={actionGrid}>
        <div style={actionRow}>
          <NextLink
            href={`/add-income?date=${selectedDate}&store=${storeIdFromUrl}`}
            style={{ ...actionBtn, backgroundColor: colors.accentGreen }}
          >
            + Έσοδο
          </NextLink>

          <NextLink
            href={`/add-expense?date=${selectedDate}&store=${storeIdFromUrl}`}
            style={{ ...actionBtn, backgroundColor: colors.accentRed }}
          >
            - Έξοδο
          </NextLink>
        </div>

        {/* ✅ Hide Z if disabled from Settings */}
        {zEnabled && (
          <div style={zRowWrap}>
            <NextLink
              href={`/daily-z?store=${storeIdFromUrl}`}
              style={{ ...actionBtn, ...zBtnStyle, backgroundColor: colors.primaryDark }}
            >
              📟 Z
            </NextLink>
          </div>
        )}
      </div>

      <div style={listContainer}>
        <p style={listHeader}>ΚΙΝΗΣΕΙΣ ΗΜΕΡΑΣ ({transactions.length})</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={spinnerStyle}></div>
          </div>
        ) : transactions.length === 0 ? (
          <div style={emptyStateStyle}>Δεν υπάρχουν κινήσεις</div>
        ) : (
          transactions.map((t) => {
            const txTitleText = getEntityLabelFromTx(t)
            const entityKey = getEntityKeyFromTx(t)
            const ytd = entityKey ? ytdCache[entityKey] : undefined
            const isIncomeTx = t.type === 'income'

            return (
              <div key={t.id} style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    ...txRow,
                    borderRadius: expandedTx === t.id ? '20px 20px 0 0' : '20px',
                    borderBottom: expandedTx === t.id ? `1px dashed ${colors.border}` : `1px solid ${colors.border}`,
                  }}
                  onClick={() => {
                    const next = expandedTx === t.id ? null : t.id
                    setExpandedTx(next)
                    if (next) loadYtdForTx(t)
                  }}
                >
                  <div style={txIconContainer(isIncomeTx)}>
                    {isIncomeTx ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  </div>

                  <div style={{ flex: 1, marginLeft: '12px' }}>
                    <p style={txTitle}>
                      {txTitleText}
                      {t.is_credit && <span style={creditBadgeStyle}>ΠΙΣΤΩΣΗ</span>}
                    </p>
                    <p style={txMeta}>
                      {t.method} • {t.created_at ? format(parseISO(t.created_at), 'HH:mm') : '--:--'} •{' '}
                      {t.created_by_name || 'Admin'}
                    </p>
                  </div>

                  <p style={{ ...txAmount, color: isIncomeTx ? colors.accentGreen : colors.accentRed }}>
                    {isIncomeTx ? '+' : '-'}
                    {Math.abs(Number(t.amount) || 0).toFixed(2)}€
                  </p>
                </div>

                {expandedTx === t.id && (
                  <div style={actionPanel}>
                    <button
                      onClick={() =>
                        router.push(`/add-${isIncomeTx ? 'income' : 'expense'}?editId=${t.id}&store=${storeIdFromUrl}`)
                      }
                      style={editRowBtn}
                    >
                      Επεξεργασία
                    </button>
                    <button onClick={() => handleDelete(t.id)} style={deleteRowBtn}>
                      Διαγραφή
                    </button>

                    {/* YTD card */}
                    <div style={ytdCard}>
                      <p style={ytdTitle}>ΣΥΝΟΨΗ ΕΤΟΥΣ (YTD)</p>
                      <p style={ytdSubTitle}>
                        Από {yearStartStr} έως {businessTodayStr}
                      </p>

                      {!entityKey ? (
                        <p style={ytdHint}>
                          Δεν υπάρχει συνδεδεμένη καρτέλα (supplier / asset / revenue source) σε αυτή την κίνηση.
                        </p>
                      ) : ytd?.loading ? (
                        <p style={ytdLoading}>Υπολογισμός…</p>
                      ) : entityKey.startsWith('rev:') ? (
                        <>
                          <div style={ytdRow}>
                            <span style={ytdLabel}>Τζίρος έτους</span>
                            <span style={ytdValueGreen}>{money(ytd?.turnoverIncome)}€</span>
                          </div>
                          <div style={ytdRow}>
                            <span style={ytdLabel}>Εισπράξεις έτους</span>
                            <span style={ytdValue}>{money(ytd?.receivedIncome)}€</span>
                          </div>
                          <div style={ytdRow}>
                            <span style={ytdLabel}>Ανοιχτό υπόλοιπο</span>
                            <span
                              style={{
                                ...ytdValue,
                                color: (Number(ytd?.openIncome) || 0) > 0 ? colors.accentRed : colors.accentGreen,
                              }}
                            >
                              {money(ytd?.openIncome)}€
                            </span>
                          </div>
                          <p style={ytdHint}>Πηγή: {txTitleText.toUpperCase()}</p>
                        </>
                      ) : (
                        <>
                          <div style={ytdRow}>
                            <span style={ytdLabel}>Έξοδα έτους</span>
                            <span style={ytdValueRed}>{money(ytd?.totalExpenses)}€</span>
                          </div>
                          <div style={ytdRow}>
                            <span style={ytdLabel}>Πληρωμές έτους</span>
                            <span style={ytdValue}>{money(ytd?.payments)}€</span>
                          </div>
                          <div style={ytdRow}>
                            <span style={ytdLabel}>Ανοιχτό υπόλοιπο</span>
                            <span
                              style={{
                                ...ytdValue,
                                color: (Number(ytd?.openExpense) || 0) > 0 ? colors.accentRed : colors.accentGreen,
                              }}
                            >
                              {money(ytd?.openExpense)}€
                            </span>
                          </div>
                          <p style={ytdHint}>Οντότητα: {txTitleText.toUpperCase()}</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// --- STYLES ---
const iphoneWrapper: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100%',
  width: '100%',
  padding: '20px',
  paddingBottom: '120px',
  touchAction: 'pan-y',
}

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }
const brandArea = { display: 'flex', alignItems: 'center', gap: '12px' }
const logoBox = {
  width: '42px',
  height: '42px',
  backgroundColor: colors.primaryDark,
  borderRadius: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: '18px',
  fontWeight: '800',
}
const storeTitleText = { fontSize: '16px', fontWeight: '800', margin: 0, color: colors.primaryDark }
const switchBtnStyle: any = {
  fontSize: '9px',
  fontWeight: '800',
  color: colors.accentBlue,
  backgroundColor: '#eef2ff',
  border: 'none',
  padding: '4px 8px',
  borderRadius: '8px',
  cursor: 'pointer',
  textDecoration: 'none',
}
const dashboardSub = { fontSize: '9px', fontWeight: '800', color: colors.secondaryText, letterSpacing: '0.5px' }
const statusDot = { width: '6px', height: '6px', background: colors.accentGreen, borderRadius: '50%' }
const menuToggle: any = {
  background: 'white',
  border: `1px solid ${colors.border}`,
  borderRadius: '12px',
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: colors.primaryDark,
}
const dropdownStyle: any = {
  position: 'absolute',
  top: '50px',
  right: 0,
  background: 'white',
  minWidth: '220px',
  borderRadius: '18px',
  boxShadow: '0 15px 35px rgba(0,0,0,0.1)',
  padding: '10px',
  zIndex: 100,
  border: `1px solid ${colors.border}`,
}
const menuItem: any = {
  display: 'block',
  padding: '12px 15px',
  textDecoration: 'none',
  color: colors.primaryDark,
  fontWeight: '700',
  fontSize: '14px',
  borderRadius: '12px',
}
const menuSectionLabel = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, padding: '8px 15px 5px' }
const menuDivider = { height: '1px', backgroundColor: colors.border, margin: '8px 0' }
const logoutBtnStyle: any = {
  width: '100%',
  textAlign: 'left',
  padding: '12px 15px',
  background: '#fff1f2',
  color: colors.accentRed,
  border: 'none',
  borderRadius: '12px',
  fontWeight: '700',
  cursor: 'pointer',
}

const dateCard: any = {
  backgroundColor: 'white',
  padding: '10px',
  borderRadius: '16px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '25px',
  border: `1px solid ${colors.border}`,
}
const dateText = { fontSize: '13px', fontWeight: '800', color: colors.primaryDark, margin: 0 }
const businessHint: any = { margin: '6px 0 0 0', fontSize: '10px', fontWeight: '800', color: colors.secondaryText, opacity: 0.9 }
const dateNavBtn = { background: 'none', border: 'none', color: colors.secondaryText, cursor: 'pointer', display: 'flex', alignItems: 'center' }

const heroCardStyle: any = {
  background: colors.primaryDark,
  padding: '30px 20px',
  borderRadius: '28px',
  color: 'white',
  boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
  marginBottom: '30px',
  textAlign: 'center',
}
const heroLabel: any = { fontSize: '10px', fontWeight: '700', opacity: 0.5, letterSpacing: '1px', marginBottom: '10px' }
const heroAmountText: any = { fontSize: '38px', fontWeight: '900', margin: 0 }
const heroStatsRow: any = { display: 'flex', gap: '20px', marginTop: '25px', justifyContent: 'center' }
const heroStatItem: any = { display: 'flex', alignItems: 'center', gap: '8px' }
const heroStatValue = { fontSize: '15px', fontWeight: '800' }
const statCircle = (bg: string): any => ({
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  background: bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
})

// ✅ NEW hero credit pill styles
const heroCreditWrap: any = { marginTop: '18px', display: 'flex', justifyContent: 'center' }
const heroCreditPill: any = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 12px',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.14)',
}
const creditIconCircle: any = {
  width: '28px',
  height: '28px',
  borderRadius: '10px',
  background: 'rgba(99, 102, 241, 0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
}
const heroCreditLabel: any = { fontSize: '10px', fontWeight: '900', opacity: 0.9, letterSpacing: '0.6px' }
const heroCreditValue: any = { fontSize: '14px', fontWeight: '900' }

// ✅ NEW action layout
const actionGrid: any = { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }
const actionRow: any = { display: 'flex', gap: '12px' }
const zRowWrap: any = { display: 'flex', justifyContent: 'center' }

const actionBtn: any = {
  flex: 1,
  padding: '18px',
  borderRadius: '18px',
  color: 'white',
  textDecoration: 'none',
  textAlign: 'center',
  fontWeight: '800',
  fontSize: '14px',
  boxShadow: '0 8px 15px rgba(0,0,0,0.08)',
}
const zBtnStyle: any = { flex: 'unset', width: '100%', maxWidth: '260px' }

const listContainer = { backgroundColor: 'transparent' }
const listHeader = { fontSize: '11px', fontWeight: '900', color: colors.secondaryText, marginBottom: '15px', letterSpacing: '0.5px' }
const txRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'white', border: `1px solid ${colors.border}`, cursor: 'pointer' }
const txIconContainer = (isInc: boolean): any => ({
  width: '42px',
  height: '42px',
  borderRadius: '12px',
  background: isInc ? '#f0fdf4' : '#fef2f2',
  color: isInc ? colors.accentGreen : colors.accentRed,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})
const txTitle = { fontWeight: '800', fontSize: '14px', margin: 0, color: colors.primaryDark }
const txMeta = { fontSize: '11px', color: colors.secondaryText, margin: 0, fontWeight: '600' }
const txAmount = { fontWeight: '900', fontSize: '16px' }
const creditBadgeStyle = { fontSize: '8px', marginLeft: '6px', color: colors.accentBlue, background: '#eef2ff', padding: '2px 5px', borderRadius: '4px' }

const actionPanel: any = { display: 'flex', gap: '10px', padding: '15px', backgroundColor: 'white', border: `1px solid ${colors.border}`, borderTop: 'none', borderRadius: '0 0 20px 20px', alignItems: 'stretch', flexWrap: 'wrap' }
const editRowBtn: any = { flex: 1, padding: '10px', backgroundColor: colors.bgLight, color: colors.primaryDark, border: `1px solid ${colors.border}`, borderRadius: '10px', fontWeight: '700', fontSize: '12px', minWidth: '140px' }
const deleteRowBtn: any = { flex: 1, padding: '10px', backgroundColor: '#fee2e2', color: colors.accentRed, border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '12px', minWidth: '120px' }

const ytdCard: any = { width: '100%', padding: '14px', borderRadius: '16px', border: `1px solid ${colors.border}`, background: '#f8fafc', marginTop: '10px' }
const ytdTitle: any = { margin: 0, fontSize: '10px', fontWeight: '900', color: colors.secondaryText, letterSpacing: '0.8px' }
const ytdSubTitle: any = { margin: '6px 0 0 0', fontSize: '10px', fontWeight: '800', color: colors.secondaryText, opacity: 0.85 }
const ytdRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '10px' }
const ytdLabel: any = { fontSize: '12px', fontWeight: '800', color: colors.primaryDark }
const ytdValue: any = { fontSize: '12px', fontWeight: '900', color: colors.primaryDark }
const ytdValueGreen: any = { fontSize: '12px', fontWeight: '900', color: colors.accentGreen }
const ytdValueRed: any = { fontSize: '12px', fontWeight: '900', color: colors.accentRed }
const ytdHint: any = { margin: '10px 0 0 0', fontSize: '10px', fontWeight: '800', color: colors.secondaryText }
const ytdLoading: any = { margin: '10px 0 0 0', fontSize: '12px', fontWeight: '800', color: colors.secondaryText }

const emptyStateStyle: any = { textAlign: 'center', padding: '40px 20px', color: colors.secondaryText, fontWeight: '600', fontSize: '13px' }
const spinnerStyle: any = { width: '24px', height: '24px', border: '3px solid #f3f3f3', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import NotificationsBell from '@/components/NotificationsBell'
import NextLink from 'next/link'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { el } from 'date-fns/locale'
import { Toaster, toast } from 'sonner'
import { TrendingUp, TrendingDown, Menu, X, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react'
import ErrorBoundary from '@/components/ErrorBoundary'
import * as styles from '@/components/dashboard/dashboard.styles'
import { getPaymentMethod, getUserLabelFromTx } from '@/components/dashboard/dashboard.logic'

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
  turnoverIncome?: number
  receivedIncome?: number
  openIncome?: number
  totalExpenses?: number
  payments?: number
  openExpense?: number
  loanTotal?: number
  loanPaid?: number
  loanRemaining?: number
  loanInstallmentsPaid?: number
  loanInstallmentsTotal?: number
}

interface Transaction {
  [key: string]: any
}

function DashboardContent() {
  const supabase = getSupabase()
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

  // ✅ Z visibility flag
  const [zEnabled, setZEnabled] = useState<boolean>(true)

  // cache YTD metrics per entity key
  const [ytdCache, setYtdCache] = useState<Record<string, YtdInfo>>({})

  // ✅ YTD uses BUSINESS day
  const businessTodayStr = getBusinessDate()
  const businessYear = String(businessTodayStr).slice(0, 4)
  const yearStartStr = `${businessYear}-01-01`

  const getEntityKeyFromTx = (t: any) => {
    const description = String(t?.description || t?.notes || '')
    if (description.startsWith('Πληρωμή Δόσης')) return `loan:${t.id}`
    if (t?.revenue_source_id) return `rev:${t.revenue_source_id}`
    if (t?.supplier_id) return `sup:${t.supplier_id}`
    if (t?.fixed_asset_id) return `asset:${t.fixed_asset_id}`
    return null
  }

  // ✅ Clean labels για κουμπαρά
  const getEntityLabelFromTx = (t: any) => {
    const type = String(t?.type || '')
    if (type === 'savings_deposit') return 'ΚΑΤΑΘΕΣΗ ΚΟΥΜΠΑΡΑ'
    if (type === 'savings_withdrawal') return 'ΑΝΑΛΗΨΗ ΚΟΥΜΠΑΡΑ'

    if (t?.revenue_sources?.name) return t.revenue_sources.name
    if (t?.suppliers?.name) return t.suppliers.name
    if (t?.fixed_assets?.name) return t.fixed_assets.name
    const description = String(t?.description || t?.notes || '')
    if (description.startsWith('Πληρωμή Δόσης')) {
      const parts = description.split(':')
      if (parts.length > 1) return parts[1].split('(')[0].trim()
      return 'Πληρωμή Δόσης'
    }
    return t?.category || 'Συναλλαγή'
  }

  const loadYtdForTx = useCallback(
    async (t: any) => {
      const key = getEntityKeyFromTx(t)
      if (!key || !storeIdFromUrl) return

      if (ytdCache[key]?.loading === true) return
      if (ytdCache[key]?.loading === false) return

      setYtdCache((prev) => ({ ...prev, [key]: { loading: true } }))

      if (key.startsWith('loan:')) {
        try {
          const txId = key.replace('loan:', '')
          const { data: inst } = await supabase.from('installments').select('settlement_id').eq('transaction_id', txId).maybeSingle()

          if (!inst?.settlement_id) {
            setYtdCache((prev) => ({ ...prev, [key]: { loading: false } }))
            return
          }

          const { data: sett } = await supabase
            .from('settlements')
            .select('total_amount, installments_count')
            .eq('id', inst.settlement_id)
            .single()

          const { data: allInst } = await supabase.from('installments').select('amount, status').eq('settlement_id', inst.settlement_id)

          const paidInst = (allInst || []).filter((i: any) => i.status === 'paid')
          const loanPaid = paidInst.reduce((acc: number, i: any) => acc + Number(i.amount), 0)
          const loanTotal = Number(sett?.total_amount || 0)

          setYtdCache((prev) => ({
            ...prev,
            [key]: {
              loading: false,
              loanTotal,
              loanPaid,
              loanRemaining: loanTotal - loanPaid,
              loanInstallmentsPaid: paidInst.length,
              loanInstallmentsTotal: sett?.installments_count || 0,
            },
          }))
        } catch (e) {
          console.error(e)
          setYtdCache((prev) => ({ ...prev, [key]: { loading: false } }))
        }
        return
      }

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

        if (key.startsWith('rev:')) {
          const turnoverIncome = rows
            .filter((r: any) => String(r.type || '') === 'income')
            .reduce((acc: number, r: any) => acc + Math.abs(Number(r.amount) || 0), 0)

          const RECEIVED_TYPES = ['income_collection', 'debt_received']
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

        const totalExpenses = rows
          .filter((r: any) => String(r.type || '') === 'expense')
          .reduce((acc: number, r: any) => acc + Math.abs(Number(r.amount) || 0), 0)

        const payments = rows
          .filter((r: any) => String(r.type || '') === 'debt_payment')
          .reduce((acc: number, r: any) => acc + Math.abs(Number(r.amount) || 0), 0)

        const creditExpenses = rows
          .filter((r: any) => r.is_credit === true && String(r.type || '') === 'expense')
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

      // store name + settings
      const { data: storeData, error: storeErr } = await supabase.from('stores').select('name, z_enabled').eq('id', storeIdFromUrl).maybeSingle()

      if (storeErr) console.error(storeErr)
      if (storeData?.name) setStoreName(storeData.name)
      setZEnabled(storeData?.z_enabled === false ? false : true)

      // ✅ BUSINESS WINDOW: selectedDate 07:00 → next day 06:59:59.999 (local → ISO UTC)
      const nextDateStr = format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd')
      const windowStartIso = new Date(`${selectedDate}T07:00:00`).toISOString()
      const windowEndIso = new Date(`${nextDateStr}T06:59:59.999`).toISOString()

      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select(`
  id,
  created_at,
  amount,
  type,
  category,
  description:notes,
  method,
  date,
  is_credit,
  supplier_id,
  fixed_asset_id,
  revenue_source_id,
  user_id,
  created_by_name,
  profiles:profiles!transactions_user_id_fkey (
    username
  ),
  suppliers(name),
  fixed_assets(name),
  revenue_sources(name)
`)
        .eq('store_id', storeIdFromUrl)
        .or(`date.eq.${selectedDate},and(created_at.gte.${windowStartIso},created_at.lte.${windowEndIso})`)
        .order('created_at', { ascending: false })

      let txRows = tx || []

      if (txError) {
        const joinFailed = /relationship|foreign key|could not find a relationship/i.test(String(txError.message || ''))

        if (!joinFailed) throw txError

        const { data: txWithoutJoin, error: txWithoutJoinError } = await supabase
          .from('transactions')
          .select(`
  id,
  created_at,
  amount,
  type,
  category,
  description:notes,
  method,
  date,
  is_credit,
  supplier_id,
  fixed_asset_id,
  revenue_source_id,
  user_id,
  created_by_name,
  suppliers(name),
  fixed_assets(name),
  revenue_sources(name)
`)
          .eq('store_id', storeIdFromUrl)
          .or(`date.eq.${selectedDate},and(created_at.gte.${windowStartIso},created_at.lte.${windowEndIso})`)
          .order('created_at', { ascending: false })

        if (txWithoutJoinError) throw txWithoutJoinError

        const baseRows = txWithoutJoin || []
        const userIds = Array.from(new Set(baseRows.map((row: any) => String(row?.user_id || '').trim()).filter(Boolean)))

        let profilesByUserId: Record<string, { username?: string | null }> = {}

        if (userIds.length > 0) {
          const { data: profileRows, error: profilesError } = await supabase.from('profiles').select('id, username').in('id', userIds)

          if (profilesError) {
            console.error('Profiles fallback load failed:', profilesError)
          } else {
            profilesByUserId = (profileRows || []).reduce((acc: Record<string, { username?: string | null }>, profile: any) => {
              acc[String(profile.id)] = {
                username: profile.username,
              }
              return acc
            }, {})
          }
        }

        txRows = baseRows.map((row: any) => ({
          ...row,
          profiles: profilesByUserId[String(row?.user_id || '')] || null,
        }))
      }

      // ✅ DEDUPE
      const map = new Map<string, any>()
      for (const row of txRows) map.set(String(row.id), row)
      setTransactions(Array.from(map.values()))

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
      toast.error('Σφάλμα φόρτωσης Dashboard')
    } finally {
      setLoading(false)
    }
  }, [selectedDate, router, storeIdFromUrl])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard, storeIdFromUrl])

  const handleDelete = async (id: string) => {
    if (!confirm('Οριστική διαγραφή αυτής της κίνησης;')) return
    if (!storeIdFromUrl) {
      toast.error('Σφάλμα καταστήματος')
      return
    }
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id).eq('store_id', storeIdFromUrl)
      if (error) throw error
      setTransactions((prev) => prev.filter((t) => String(t.id) !== String(id)))
      setExpandedTx(null)
      toast.success('Η κίνηση διαγράφηκε')
    } catch (err) {
      toast.error('Σφάλμα κατά τη διαγραφή')
    }
  }

  const handleDeleteLoanPayment = async (txId: string) => {
    if (!confirm('Οριστική διαγραφή πληρωμής δόσης; Θα γυρίσει η δόση σε εκκρεμότητα.')) return
    if (!storeIdFromUrl) {
      toast.error('Σφάλμα καταστήματος')
      return
    }

    try {
      const { data: installment, error: installmentError } = await supabase.from('installments').select('id').eq('transaction_id', txId).maybeSingle()

      if (installmentError) throw installmentError

      if (installment?.id) {
        const { error: updateError } = await supabase.from('installments').update({ status: 'pending', transaction_id: null }).eq('id', installment.id)

        if (updateError) throw updateError
      }

      const { error: deleteError } = await supabase.from('transactions').delete().eq('id', txId).eq('store_id', storeIdFromUrl)
      if (deleteError) throw deleteError

      setTransactions((prev) => prev.filter((t) => String(t.id) !== String(txId)))
      setExpandedTx(null)
      toast.success('Η πληρωμή διαγράφηκε')
    } catch (err) {
      toast.error('Σφάλμα κατά τη διαγραφή')
    }
  }

  const handleEditZ = async (date: string) => {
    router.push(`/daily-z?store=${storeIdFromUrl}&date=${date}`)
  }

  const handleDeleteZ = async (date: string) => {
    if (!confirm('Διαγραφή Κλεισίματος Ζ;')) return
    if (!storeIdFromUrl) {
      toast.error('Σφάλμα καταστήματος')
      return
    }

    const { error } = await supabase.from('transactions').delete().eq('store_id', storeIdFromUrl).eq('category', 'Εσοδα Ζ').eq('date', date)

    if (error) {
      toast.error('Σφάλμα διαγραφής Ζ')
      return
    }

    toast.success('Το Ζ διαγράφηκε')
    loadDashboard()
  }

  const Z_MASTER_ROW_ID = '__z_master__'

  const isZTransaction = useCallback((t: any) => {
    const category = String(t?.category || '').trim().toLowerCase()
    const method = getPaymentMethod(t).toLowerCase()
    const notes = String(t?.notes || '').trim().toLowerCase()

    const categoryLooksZ = category === 'ζ' || category === 'εσοδα ζ' || category.includes(' ζ') || category.endsWith('ζ')
    const looksLikeDayClose = method.includes('(ζ)') || notes.includes('ζ ταμειακης') || notes === 'χωρις σημανση'

    return categoryLooksZ || (t?.type === 'income' && looksLikeDayClose)
  }, [])

  const zTransactions = useMemo(() => (Array.isArray(transactions) ? transactions.filter((t) => isZTransaction(t)) : []), [transactions, isZTransaction])

  const displayTransactions = useMemo(() => {
    const zTx = zTransactions

    const safeTransactions = Array.isArray(transactions) ? transactions : []

    if (zTx.length <= 1) {
      return safeTransactions.map((t) => ({ kind: 'normal' as const, id: String(t?.id), tx: t }))
    }

    const zTotal = zTx.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
    const methodTotals = zTx.reduce((acc: Record<string, number>, t) => {
      const key = String(t?.method || 'Άλλο').trim() || 'Άλλο'
      acc[key] = (acc[key] || 0) + (Number(t.amount) || 0)
      return acc
    }, {})

    const zBreakdown = Object.entries(methodTotals)
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount)

    const rows: Array<
      | { kind: 'normal'; id: string; tx: any }
      | {
          kind: 'z-master'
          id: string
          date: string
          amount: number
          created_at: string | null
          user_label: string
          itemsCount: number
          breakdown: Array<{ method: string; amount: number }>
        }
    > = []

    let zInserted = false

    for (const t of safeTransactions) {
      if (!isZTransaction(t)) {
        rows.push({ kind: 'normal', id: String(t.id), tx: t })
        continue
      }

      if (!zInserted) {
        rows.push({
          kind: 'z-master',
          id: Z_MASTER_ROW_ID,
          date: zTx[0]?.date || selectedDate,
          amount: zTotal,
          created_at: zTx[0]?.created_at || null,
          user_label: getUserLabelFromTx(zTx[0]),
          itemsCount: zTx.length,
          breakdown: zBreakdown,
        })
        zInserted = true
      }
    }

    return rows
  }, [transactions, zTransactions, isZTransaction, selectedDate])

  // ✅ Totals (ΣΩΣΤΟ FIX: Ο κουμπαράς επηρεάζει ΜΟΝΟ το ταμείο, ΟΧΙ τα επιχειρηματικά Έσοδα/Έξοδα)
  const totals = useMemo(() => {
    // 1. Καθαρά Έσοδα Επιχείρησης
    const INCOME_TYPES = ['income', 'income_collection', 'debt_received']
    const income = transactions
      .filter((t) => INCOME_TYPES.includes(String(t.type)))
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

    // 2. Καθαρά Έξοδα Επιχείρησης
    const expense = transactions
      .filter((t) => (t.type === 'expense' && t.is_credit !== true) || t.type === 'debt_payment')
      .reduce((acc, t) => acc + (Math.abs(Number(t.amount)) || 0), 0)

    const credits = transactions
      .filter((t) => t.type === 'expense' && t.is_credit === true)
      .reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount) || 0), 0)

    // 3. Κινήσεις Κουμπαρά (Αποταμίευση) – επηρεάζουν ΜΟΝΟ το ταμείο/ρευστό
    const savingsDeposits = transactions
      .filter((t) => t.type === 'savings_deposit')
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

    const savingsWithdrawals = transactions
      .filter((t) => t.type === 'savings_withdrawal')
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

    return {
      income,
      expense,
      credits,
      // Ρευστό Ημέρας = Καθαρά Έσοδα - Καθαρά Έξοδα - Καταθέσεις στον κουμπαρά + Αναλήψεις από κουμπαρά
      balance: income - expense - savingsDeposits + savingsWithdrawals,
    }
  }, [transactions])

  const changeDate = (days: number) => {
    const current = parseISO(selectedDate)
    const next = days > 0 ? addDays(current, 1) : subDays(current, 1)
    router.push(`/?date=${format(next, 'yyyy-MM-dd')}&store=${storeIdFromUrl}`)
    setExpandedTx(null)
  }

  const money = (n: any) => (Number(n) || 0).toLocaleString('el-GR', { minimumFractionDigits: 2 })

  return (
    <div style={styles.iphoneWrapper}>
      <Toaster position="top-center" richColors />

      <header style={styles.headerStyle}>
        <div style={styles.brandArea}>
          <div style={styles.logoBox}>{storeName?.charAt(0) || '?'}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={styles.storeTitleText}>{storeName?.toUpperCase() || 'ΦΟΡΤΩΣΗ...'}</h1>
              <NextLink href="/select-store" style={styles.switchBtnStyle}>
                ΑΛΛΑΓΗ
              </NextLink>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={styles.dashboardSub}>BUSINESS DASHBOARD</span>
              <div style={styles.statusDot} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <NotificationsBell storeId={storeIdFromUrl || ''} onUpdate={loadDashboard} />

          <div style={{ position: 'relative' }}>
            <button style={styles.menuToggle} onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {isMenuOpen && (
              <div style={styles.dropdownStyle}>
                {isStoreAdmin && (
                  <>
                    <p style={styles.menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
                    <NextLink href={`/manage-lists?store=${storeIdFromUrl}`} style={styles.menuItem} onClick={() => setIsMenuOpen(false)}>
                      ⚙️ Διαχείριση Καταλόγων
                    </NextLink>
                    <NextLink href={`/settlements?store=${storeIdFromUrl}`} style={styles.menuItem} onClick={() => setIsMenuOpen(false)}>
                      💳 Δάνεια & Ρυθμίσεις
                    </NextLink>
                  </>
                )}
                {(isStoreAdmin || canViewAnalysis) && <div style={styles.menuDivider} />}
                {canViewAnalysis && (
                  <NextLink href={`/analysis?store=${storeIdFromUrl}`} style={styles.menuItem} onClick={() => setIsMenuOpen(false)}>
                    📊 Ανάλυση
                  </NextLink>
                )}
                {isStoreAdmin && (
                  <NextLink href={`/goals?store=${storeIdFromUrl}`} style={styles.menuItem} onClick={() => setIsMenuOpen(false)}>
                    🎯 Στόχοι & Κουμπαράδες
                  </NextLink>
                )}
                <div style={styles.menuDivider} />
                <p style={styles.menuSectionLabel}>ΥΠΟΣΤΗΡΙΞΗ & ΡΥΘΜΙΣΕΙΣ</p>
                <NextLink href={`/settings?store=${storeIdFromUrl}`} style={styles.menuItem} onClick={() => setIsMenuOpen(false)}>
                  ⚙️ Ρυθμίσεις
                </NextLink>
                <NextLink href={`/help?store=${storeIdFromUrl}`} style={styles.menuItem} onClick={() => setIsMenuOpen(false)}>
                  📖 Οδηγίες Χρήσης
                </NextLink>
                <NextLink
                  href={
                    storeIdFromUrl
                      ? `https://cosy-management.vercel.app/admin/permissions?store=${storeIdFromUrl}`
                      : '#'
                  }
                  style={styles.menuItem}
                  onClick={(e) => {
                    if (!storeIdFromUrl) {
                      e.preventDefault()
                      toast.error('Δεν βρέθηκε store στο URL')
                      return
                    }
                    setIsMenuOpen(false)
                  }}
                >
                  🔐 Δικαιώματα
                </NextLink>

                <div style={styles.menuDivider} />
                <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} style={styles.logoutBtnStyle}>
                  ΑΠΟΣΥΝΔΕΣΗ 🚪
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={styles.dateCard}>
        <button onClick={() => changeDate(-1)} style={styles.dateNavBtn}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={styles.dateText}>{format(parseISO(selectedDate), 'EEEE, d MMMM', { locale: el }).toUpperCase()}</p>
          <p style={styles.businessHint}>
            Λογιστική μέρα έως 06:59 • YTD: {yearStartStr} → {businessTodayStr}
          </p>
        </div>
        <button onClick={() => changeDate(1)} style={styles.dateNavBtn}>
          <ChevronRight size={24} />
        </button>
      </div>

      <div style={styles.heroCardStyle}>
        <p style={styles.heroLabel}>ΔΙΑΘΕΣΙΜΟ ΥΠΟΛΟΙΠΟ ΗΜΕΡΑΣ</p>
        <h2 style={styles.heroAmountText}>{totals.balance.toFixed(2)}€</h2>

        <div style={styles.heroStatsRow}>
          <div style={styles.heroStatItem}>
            <div style={styles.statCircle(colors.accentGreen)}>
              <TrendingUp size={12} />
            </div>
            <span style={styles.heroStatValue}>{totals.income.toFixed(2)}€</span>
          </div>

          <div style={styles.heroStatItem}>
            <div style={styles.statCircle(colors.accentRed)}>
              <TrendingDown size={12} />
            </div>
            <span style={styles.heroStatValue}>{totals.expense.toFixed(2)}€</span>
          </div>
        </div>

        <div style={styles.heroCreditWrap}>
          <div style={styles.heroCreditPill}>
            <div style={styles.creditIconCircle}>
              <CreditCard size={14} />
            </div>
            <span style={styles.heroCreditLabel}>ΠΙΣΤΩΣΕΙΣ ΗΜΕΡΑΣ</span>
            <span style={styles.heroCreditValue}>{totals.credits.toFixed(2)}€</span>
          </div>
        </div>
      </div>

      <div style={styles.actionGrid}>
        <div style={styles.actionRow}>
          <NextLink href={`/add-income?date=${selectedDate}&store=${storeIdFromUrl}`} style={{ ...styles.actionBtn, backgroundColor: colors.accentGreen }}>
            + Έσοδο
          </NextLink>

          <NextLink href={`/add-expense?date=${selectedDate}&store=${storeIdFromUrl}`} style={{ ...styles.actionBtn, backgroundColor: colors.accentRed }}>
            - Έξοδο
          </NextLink>
        </div>

        {zEnabled && (
          <div style={styles.zRowWrap}>
            <NextLink href={`/daily-z?store=${storeIdFromUrl}`} style={{ ...styles.actionBtn, ...styles.zBtnStyle, backgroundColor: colors.primaryDark }}>
              📟 Z
            </NextLink>
          </div>
        )}
      </div>

      <div style={styles.listContainer}>
        <p style={styles.listHeader}>ΚΙΝΗΣΕΙΣ ΗΜΕΡΑΣ ({Array.isArray(displayTransactions) ? displayTransactions.length : 0})</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={styles.spinnerStyle}></div>
          </div>
        ) : !Array.isArray(displayTransactions) || displayTransactions.length === 0 ? (
          <div style={styles.emptyStateStyle}>Δεν υπάρχουν κινήσεις</div>
        ) : (
          displayTransactions.map((row) => {
            const isZMaster = row.kind === 'z-master'
            const t = row.kind === 'normal' ? row.tx : ({ __collapsedZ: true, date: row.date } as any)
            const txId = row.id

            const txTitleText = isZMaster ? 'ΚΛΕΙΣΙΜΟ Ζ' : getEntityLabelFromTx(t)
            const entityKey = !isZMaster && t ? getEntityKeyFromTx(t) : null
            const ytd = entityKey ? ytdCache[entityKey] : undefined

            // ✅ σωστό πράσινο για ανάληψη κουμπαρά
            const INCOME_TYPES = ['income', 'income_collection', 'debt_received', 'savings_withdrawal']
            const isIncomeTx = isZMaster ? true : INCOME_TYPES.includes(String(t?.type))

            const txMethod = isZMaster ? 'Συγκεντρωτική εγγραφή' : t?.method
            const txCreatedAt = isZMaster ? row.created_at : t?.created_at

            const displayUser = isZMaster ? row.user_label : t?.created_by_name || t?.profiles?.username || 'Χρήστης'
            const txAmountValue = isZMaster ? row.amount : Number(t?.amount) || 0

            return (
              <div key={txId} style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    ...styles.txRow,
                    borderRadius: expandedTx === txId ? '20px 20px 0 0' : '20px',
                    borderBottom: expandedTx === txId ? `1px dashed ${colors.border}` : `1px solid ${colors.border}`,
                  }}
                  onClick={() => {
                    const next = expandedTx === txId ? null : txId
                    setExpandedTx(next)
                    if (next && !isZMaster && t) loadYtdForTx(t)
                  }}
                >
                  <div style={styles.txIconContainer(isIncomeTx)}>{isIncomeTx ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</div>

                  <div style={{ flex: 1, marginLeft: '12px' }}>
                    <p style={styles.txTitle}>
                      {txTitleText}
                      {!isZMaster && t?.is_credit && <span style={styles.creditBadgeStyle}>ΠΙΣΤΩΣΗ</span>}
                      {isZMaster && <span style={styles.creditBadgeStyle}>{row.itemsCount} ΚΙΝΗΣΕΙΣ</span>}
                    </p>

                    {!isZMaster && t?.description && (
                      <p style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', margin: '4px 0 2px 0' }}>
                        {t.description}
                      </p>
                    )}

                    <p style={styles.txMeta}>
                      {txMethod} • {txCreatedAt ? format(parseISO(txCreatedAt), 'HH:mm') : '--:--'} • {displayUser}
                    </p>
                  </div>

                  <p style={{ ...styles.txAmount, color: isIncomeTx ? colors.accentGreen : colors.accentRed }}>
                    {isIncomeTx ? '+' : '-'}
                    {Math.abs(txAmountValue).toFixed(2)}€
                  </p>
                </div>

                {expandedTx === txId && (
                  <div style={styles.actionPanel}>
                    {isZMaster ? (
                      <div style={styles.zBreakdownCard}>
                        <p style={styles.ytdTitle}>ΑΝΑΛΥΣΗ ΚΛΕΙΣΙΜΑΤΟΣ Ζ</p>
                        <p style={styles.ytdSubTitle}>Ανάλυση ανά μέθοδο</p>

                        {Array.isArray(row.breakdown) && row.breakdown.length > 0 ? row.breakdown.map((item) => (
                          <div key={item.method} style={styles.zBreakdownRow}>
                            <span style={styles.ytdLabel}>{item.method}</span>
                            <span style={styles.ytdValueGreen}>{money(item.amount)}€</span>
                          </div>
                        )) : <p style={styles.ytdHint}>Δεν βρέθηκε ανάλυση μεθόδων.</p>}

                        {t.__collapsedZ && (
                          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                            <button
                              onClick={() => handleEditZ(t.date)}
                              style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: 10,
                                border: '1px solid #6366f1',
                                background: '#eef2ff',
                                color: '#4338ca',
                                fontWeight: 900,
                                cursor: 'pointer',
                              }}
                            >
                              Επεξεργασία
                            </button>

                            <button
                              onClick={() => handleDeleteZ(t.date)}
                              style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: 10,
                                border: '1px solid #fca5a5',
                                background: '#fff1f2',
                                color: '#dc2626',
                                fontWeight: 900,
                                cursor: 'pointer',
                              }}
                            >
                              Διαγραφή
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {!entityKey?.startsWith('loan:') ? (
                          <>
                            <button
                              onClick={() => router.push(`/add-${isIncomeTx ? 'income' : 'expense'}?editId=${t.id}&store=${storeIdFromUrl}`)}
                              style={styles.editRowBtn}
                            >
                              Επεξεργασία
                            </button>
                            <button onClick={() => handleDelete(t.id)} style={styles.deleteRowBtn}>
                              Διαγραφή
                            </button>
                          </>
                        ) : (
                          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                            <button onClick={() => router.push(`/settlements?store=${storeIdFromUrl}`)} style={{ ...styles.editRowBtn, width: '100%' }}>
                              💳 Διαχείριση Ρύθμισης
                            </button>
                            <button onClick={() => handleDeleteLoanPayment(t.id)} style={styles.deleteRowBtn}>
                              🗑️ Διαγραφή
                            </button>
                          </div>
                        )}

                        <div style={styles.ytdCard}>
                          <p style={styles.ytdTitle}>{entityKey?.startsWith('loan:') ? 'ΚΑΤΑΣΤΑΣΗ ΡΥΘΜΙΣΗΣ' : 'ΣΥΝΟΨΗ ΕΤΟΥΣ (YTD)'}</p>
                          {!entityKey?.startsWith('loan:') && <p style={styles.ytdSubTitle}>Από {yearStartStr} έως {businessTodayStr}</p>}

                          {!entityKey ? (
                            <p style={styles.ytdHint}>Δεν υπάρχει συνδεδεμένη καρτέλα σε αυτή την κίνηση.</p>
                          ) : ytd?.loading ? (
                            <p style={styles.ytdLoading}>Υπολογισμός…</p>
                          ) : entityKey.startsWith('loan:') ? (
                            <>
                              <div style={styles.ytdRow}>
                                <span style={styles.ytdLabel}>Σύνολο Ρύθμισης</span>
                                <span style={styles.ytdValue}>{money(ytd?.loanTotal)}€</span>
                              </div>
                              <div style={styles.ytdRow}>
                                <span style={styles.ytdLabel}>
                                  Πληρωμένες ({ytd?.loanInstallmentsPaid}/{ytd?.loanInstallmentsTotal})
                                </span>
                                <span style={styles.ytdValueGreen}>{money(ytd?.loanPaid)}€</span>
                              </div>
                              <div style={styles.ytdRow}>
                                <span style={styles.ytdLabel}>Υπόλοιπο Οφειλής</span>
                                <span style={styles.ytdValueRed}>{money(ytd?.loanRemaining)}€</span>
                              </div>
                            </>
                          ) : entityKey.startsWith('rev:') ? (
                            <>
                              <div style={styles.ytdRow}>
                                <span style={styles.ytdLabel}>Τζίρος έτους</span>
                                <span style={styles.ytdValueGreen}>{money(ytd?.turnoverIncome)}€</span>
                              </div>
                              <div style={styles.ytdRow}>
                                <span style={styles.ytdLabel}>Εισπράξεις έτους</span>
                                <span style={styles.ytdValue}>{money(ytd?.receivedIncome)}€</span>
                              </div>
                              <div style={styles.ytdRow}>
                                <span style={styles.ytdLabel}>Ανοιχτό υπόλοιπο</span>
                                <span style={{ ...styles.ytdValue, color: (Number(ytd?.openIncome) || 0) > 0 ? colors.accentRed : colors.accentGreen }}>
                                  {money(ytd?.openIncome)}€
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={styles.ytdRow}>
                                <span style={styles.ytdLabel}>Έξοδα έτους</span>
                                <span style={styles.ytdValueRed}>{money(ytd?.totalExpenses)}€</span>
                              </div>
                              <div style={styles.ytdRow}>
                                <span style={styles.ytdLabel}>Πληρωμές έτους</span>
                                <span style={styles.ytdValue}>{money(ytd?.payments)}€</span>
                              </div>
                              <div style={styles.ytdRow}>
                                <span style={styles.ytdLabel}>Ανοιχτό υπόλοιπο</span>
                                <span style={{ ...styles.ytdValue, color: (Number(ytd?.openExpense) || 0) > 0 ? colors.accentRed : colors.accentGreen }}>
                                  {money(ytd?.openExpense)}€
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
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

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '40px', color: colors.secondaryText, fontWeight: 800 }}>Φόρτωση dashboard...</div>}>
        <DashboardContent />
      </Suspense>
    </ErrorBoundary>
  )
}
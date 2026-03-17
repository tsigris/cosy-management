'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import useStoreAccess from '@/hooks/useStoreAccess'
import { getBusinessDate } from '@/lib/businessDate'
import { formatAmount } from '@/lib/formatters'
import NotificationsBell from '@/components/NotificationsBell'
import NextLink from 'next/link'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { el } from 'date-fns/locale'
import { Toaster, toast } from 'sonner'
import { TrendingUp, TrendingDown, Menu, X, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react'
import ErrorBoundary from '@/components/ErrorBoundary'

// --- MODERN PREMIUM PALETTE ---
const colors = {
  primaryDark: 'var(--text)',
  secondaryText: 'var(--muted)',
  accentRed: '#f43f5e',
  accentBlue: '#6366f1',
  accentGreen: '#10b981',
  bgLight: 'var(--bg)',
  border: 'var(--border)',
  white: 'var(--surfaceSolid)',
  surfaceSolid: 'var(--surfaceSolid)',
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

function getPaymentMethod(tx: any): string {
  return String(tx?.payment_method ?? tx?.method ?? '').trim()
}

function getUserLabelFromTx(tx: any): string {
  return tx?.created_by_name || tx?.profiles?.username || 'Χρήστης'
}

function DashboardContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdFromUrl = searchParams.get('store')

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
  // ref-based guard: tracks keys that have been started (loading or loaded) so loadYtdForTx
  // does not need to read ytdCache state, keeping the callback stable
  const ytdLoadedKeys = useRef<Set<string>>(new Set())

  // ✅ Use shared hook for permission checking (consolidates repeated store_access queries)
  const { data: accessData } = useStoreAccess({
    storeId: storeIdFromUrl || undefined,
    fields: 'role, can_view_analysis',
    autoFetch: !!storeIdFromUrl,
  })

  // ✅ YTD uses BUSINESS day — memoized so getBusinessDate() is not called on every render
  const businessTodayStr = useMemo(() => getBusinessDate(), [])
  const businessYear = useMemo(() => String(businessTodayStr).slice(0, 4), [businessTodayStr])
  const yearStartStr = useMemo(() => `${businessYear}-01-01`, [businessYear])

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

      if (ytdLoadedKeys.current.has(key)) return
      ytdLoadedKeys.current.add(key)

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
    [storeIdFromUrl, yearStartStr, businessTodayStr]
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
      const { data: storeData, error: storeErr } = await supabase
        .from('stores')
        .select('name, z_enabled')
        .eq('id', storeIdFromUrl)
        .maybeSingle()

      if (storeErr) console.error(storeErr)
      if (storeData?.name) setStoreName(storeData.name)
      setZEnabled(storeData?.z_enabled !== false)

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
        .eq('date', selectedDate)
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
          .eq('date', selectedDate)
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
    } catch (err) {
      console.error('Dashboard error:', err)
      toast.error('Σφάλμα φόρτωσης Dashboard')
    } finally {
      setLoading(false)
    }
  }, [selectedDate, router, storeIdFromUrl])

  // storeIdFromUrl is already a dep of loadDashboard itself; no need to repeat it here
  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // ✅ Update permissions from shared hook (replaces inline store_access query)
  useEffect(() => {
    if (accessData) {
      setIsStoreAdmin(accessData.role === 'admin')
      setCanViewAnalysis(accessData.role === 'admin' || accessData.can_view_analysis === true)
    } else {
      setIsStoreAdmin(false)
      setCanViewAnalysis(false)
    }
  }, [accessData])

  // Clear YTD cache and ref guard when store changes to prevent stale data from previous store
  useEffect(() => {
    setYtdCache({})
    ytdLoadedKeys.current.clear()
  }, [storeIdFromUrl])

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
    // Query aliases `notes` as `description`, so read the aliased field here
    const description = String(t?.description || '').trim().toLowerCase()

    const categoryLooksZ = category === 'ζ' || category === 'εσοδα ζ' || category.includes(' ζ') || category.endsWith('ζ')
    const looksLikeDayClose = method.includes('(ζ)') || description.includes('ζ ταμειακης') || description === 'χωρις σημανση'

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
    const INCOME_TYPES = ['income', 'income_collection', 'debt_received']
    const income = transactions
      .filter((t) => INCOME_TYPES.includes(String(t.type)))
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

    const EXPENSE_TYPES = ['expense', 'debt_payment', 'salary_advance']

    const expense = transactions
      .filter((t) => {
        const type = String(t.type || '')
        if (!EXPENSE_TYPES.includes(type)) return false
        if (type === 'expense' && t.is_credit === true) return false
        return true
      })
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

    const credits = transactions
      .filter((t) => t.type === 'expense' && t.is_credit === true)
      .reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount) || 0), 0)

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
      balance: income - expense - savingsDeposits + savingsWithdrawals,
    }
  }, [transactions])

  const changeDate = (days: number) => {
    const current = parseISO(selectedDate)
    const next = days > 0 ? addDays(current, 1) : subDays(current, 1)
    router.push(`/?date=${format(next, 'yyyy-MM-dd')}&store=${storeIdFromUrl}`)
    setExpandedTx(null)
  }

  const money = (n: any) => formatAmount(Number(n) || 0)

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <NotificationsBell storeId={storeIdFromUrl || ''} onUpdate={loadDashboard} />

          <div style={{ position: 'relative' }}>
            <button style={menuToggle} onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {isMenuOpen && (
              <div style={dropdownStyle}>
                {isStoreAdmin && (
                  <>
                    <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
                    <NextLink href={`/manage-lists?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>
                      ⚙️ Διαχείριση Καταλόγων
                    </NextLink>
                    <NextLink href={`/settlements?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>
                      💳 Δάνεια & Ρυθμίσεις
                    </NextLink>
                  </>
                )}
                {(isStoreAdmin || canViewAnalysis) && <div style={menuDivider} />}
                {canViewAnalysis && (
                  <NextLink href={`/analysis?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>
                    📊 Ανάλυση
                  </NextLink>
                )}
                {isStoreAdmin && (
                  <NextLink href={`/goals?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>
                    🎯 Στόχοι & Κουμπαράδες
                  </NextLink>
                )}
                <div style={menuDivider} />
                <p style={menuSectionLabel}>ΥΠΟΣΤΗΡΙΞΗ & ΡΥΘΜΙΣΕΙΣ</p>
                <NextLink href={`/settings?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>
                  ⚙️ Ρυθμίσεις
                </NextLink>
                <NextLink href={`/help?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>
                  📖 Οδηγίες Χρήσης
                </NextLink>
                <NextLink
                  href={
                    storeIdFromUrl
                      ? `https://cosy-management.vercel.app/admin/permissions?store=${storeIdFromUrl}`
                      : '#'
                  }
                  style={menuItem}
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

                <div style={menuDivider} />
                <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} style={logoutBtnStyle}>
                  ΑΠΟΣΥΝΔΕΣΗ 🚪
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={dateCard}>
        <button onClick={() => changeDate(-1)} style={dateNavBtn}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={dateText}>{format(parseISO(selectedDate), 'EEEE, d MMMM', { locale: el }).toUpperCase()}</p>
          <p style={businessHint}>
            Λογιστική μέρα έως 06:59 • YTD: {yearStartStr} → {businessTodayStr}
          </p>
        </div>
        <button onClick={() => changeDate(1)} style={dateNavBtn}>
          <ChevronRight size={24} />
        </button>
      </div>

      <div style={heroCardStyle as any}>
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

      <div style={actionGrid}>
        <div style={actionRow}>
          <NextLink href={`/add-income?date=${selectedDate}&store=${storeIdFromUrl}`} style={{ ...actionBtn, backgroundColor: colors.accentGreen }}>
            + Έσοδα
          </NextLink>

          <NextLink href={`/add-expense?date=${selectedDate}&store=${storeIdFromUrl}`} style={{ ...actionBtn, backgroundColor: colors.accentRed }}>
            - Έξοδα
          </NextLink>
        </div>

        {zEnabled && (
          <div style={zRowWrap}>
            <NextLink href={`/daily-z?store=${storeIdFromUrl}`} style={{ ...actionBtn, ...zBtnStyle, backgroundColor: colors.primaryDark }}>
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
        ) : !Array.isArray(displayTransactions) || displayTransactions.length === 0 ? (
          <div style={emptyStateStyle}>Δεν υπάρχουν κινήσεις</div>
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
                    ...txRow,
                    borderRadius: expandedTx === txId ? '20px 20px 0 0' : '20px',
                    borderBottom: expandedTx === txId ? `1px dashed ${colors.border}` : `1px solid ${colors.border}`,
                  }}
                  onClick={() => {
                    const next = expandedTx === txId ? null : txId
                    setExpandedTx(next)
                    if (next && !isZMaster && t) loadYtdForTx(t)
                  }}
                >
                  <div style={txIconContainer(isIncomeTx)}>{isIncomeTx ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</div>

                  <div style={{ flex: 1, marginLeft: '12px' }}>
                    <p style={txTitle}>
                      {txTitleText}
                      {!isZMaster && t?.is_credit && <span style={creditBadgeStyle}>ΠΙΣΤΩΣΗ</span>}
                      {isZMaster && <span style={creditBadgeStyle}>{row.itemsCount} ΚΙΝΗΣΕΙΣ</span>}
                    </p>

                    {!isZMaster && t?.description && (
                      <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--muted)', margin: '4px 0 2px 0' }}>
                        {t.description}
                      </p>
                    )}

                    <p style={txMeta}>
                      {txMethod} • {txCreatedAt ? format(parseISO(txCreatedAt), 'HH:mm') : '--:--'} • {displayUser}
                    </p>
                  </div>

                  <p style={{ ...txAmount, color: isIncomeTx ? colors.accentGreen : colors.accentRed }}>
                    {isIncomeTx ? '+' : '-'}
                    {Math.abs(txAmountValue).toFixed(2)}€
                  </p>
                </div>

                {expandedTx === txId && (
                  <div style={actionPanel as any}>
                    {isZMaster ? (
                      <div style={zBreakdownCard}>
                        <p style={ytdTitle}>ΑΝΑΛΥΣΗ ΚΛΕΙΣΙΜΑΤΟΣ Ζ</p>
                        <p style={ytdSubTitle}>Ανάλυση ανά μέθοδο</p>

                        {Array.isArray(row.breakdown) && row.breakdown.length > 0 ? row.breakdown.map((item) => (
                          <div key={item.method} style={zBreakdownRow}>
                            <span style={ytdLabel}>{item.method}</span>
                            <span style={ytdValueGreen}>{money(item.amount)}€</span>
                          </div>
                        )) : <p style={ytdHint}>Δεν βρέθηκε ανάλυση μεθόδων.</p>}

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
                              style={editRowBtn}
                            >
                              Επεξεργασία
                            </button>
                            <button onClick={() => handleDelete(t.id)} style={deleteRowBtn}>
                              Διαγραφή
                            </button>
                          </>
                        ) : (
                          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                            <button onClick={() => router.push(`/settlements?store=${storeIdFromUrl}`)} style={{ ...editRowBtn, width: '100%' }}>
                              💳 Διαχείριση Ρύθμισης
                            </button>
                            <button onClick={() => handleDeleteLoanPayment(t.id)} style={deleteRowBtn}>
                              🗑️ Διαγραφή
                            </button>
                          </div>
                        )}

                        <div style={ytdCard}>
                          <p style={ytdTitle}>{entityKey?.startsWith('loan:') ? 'ΚΑΤΑΣΤΑΣΗ ΡΥΘΜΙΣΗΣ' : 'ΣΥΝΟΨΗ ΕΤΟΥΣ (YTD)'}</p>
                          {!entityKey?.startsWith('loan:') && <p style={ytdSubTitle}>Από {yearStartStr} έως {businessTodayStr}</p>}

                          {!entityKey ? (
                            <p style={ytdHint}>Δεν υπάρχει συνδεδεμένη καρτέλα σε αυτή την κίνηση.</p>
                          ) : ytd?.loading ? (
                            <p style={ytdLoading}>Υπολογισμός…</p>
                          ) : entityKey.startsWith('loan:') ? (
                            <>
                              <div style={ytdRow}>
                                <span style={ytdLabel}>Σύνολο Ρύθμισης</span>
                                <span style={ytdValue}>{money(ytd?.loanTotal)}€</span>
                              </div>
                              <div style={ytdRow}>
                                <span style={ytdLabel}>
                                  Πληρωμένες ({ytd?.loanInstallmentsPaid}/{ytd?.loanInstallmentsTotal})
                                </span>
                                <span style={ytdValueGreen}>{money(ytd?.loanPaid)}€</span>
                              </div>
                              <div style={ytdRow}>
                                <span style={ytdLabel}>Υπόλοιπο Οφειλής</span>
                                <span style={ytdValueRed}>{money(ytd?.loanRemaining)}€</span>
                              </div>
                            </>
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
                                <span style={{ ...ytdValue, color: (Number(ytd?.openIncome) || 0) > 0 ? colors.accentRed : colors.accentGreen }}>
                                  {money(ytd?.openIncome)}€
                                </span>
                              </div>
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
                                <span style={{ ...ytdValue, color: (Number(ytd?.openExpense) || 0) > 0 ? colors.accentRed : colors.accentGreen }}>
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

// --- STYLES ---
const iphoneWrapper = {
  background: 'var(--bg-grad)',
  minHeight: '100%',
  width: '100%',
  padding: '20px',
  paddingBottom: '120px',
  touchAction: 'pan-y',
}

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }
const brandArea = { display: 'flex', alignItems: 'center', gap: '12px' }
const logoBox = {
  width: '42px',
  height: '42px',
  backgroundColor: colors.primaryDark,
  borderRadius: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.white,
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
  background: colors.white,
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
  background: colors.white,
  minWidth: '220px',
  borderRadius: '18px',
  boxShadow: 'var(--shadow)',
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

const dateCard = {
  background: 'var(--surface)',
  padding: '10px',
  borderRadius: '16px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '25px',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)',
}
const dateText = { fontSize: '13px', fontWeight: '800', color: colors.primaryDark, margin: 0 }
const businessHint: any = { margin: '6px 0 0 0', fontSize: '10px', fontWeight: '800', color: colors.secondaryText, opacity: 0.9 }
const dateNavBtn = { background: 'none', border: 'none', color: colors.secondaryText, cursor: 'pointer', display: 'flex', alignItems: 'center' }

const heroCardStyle = {
  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
  padding: '30px 20px',
  borderRadius: '28px',
  color: 'white',
  boxShadow: 'var(--shadow)',
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
  boxShadow: 'var(--shadow)',
}
const zBtnStyle: any = { flex: 'unset', width: '100%', maxWidth: '260px' }

const listContainer = { backgroundColor: 'transparent' }
const listHeader = { fontSize: '11px', fontWeight: '900', color: colors.secondaryText, marginBottom: '15px', letterSpacing: '0.5px' }
const txRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  cursor: 'pointer',
  boxShadow: 'var(--shadow)',
}
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

const actionPanel = {
  display: 'flex',
  gap: '10px',
  padding: '15px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderTop: 'none',
  borderRadius: '0 0 20px 20px',
  alignItems: 'stretch',
  flexWrap: 'wrap',
}
const editRowBtn: any = { flex: 1, padding: '10px', backgroundColor: colors.bgLight, color: colors.primaryDark, border: `1px solid ${colors.border}`, borderRadius: '10px', fontWeight: '700', fontSize: '12px', minWidth: '140px', cursor: 'pointer' }
const deleteRowBtn: any = { flex: 1, padding: '10px', backgroundColor: '#fee2e2', color: colors.accentRed, border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '12px', minWidth: '120px', cursor: 'pointer' }

const ytdCard: any = { width: '100%', padding: '14px', borderRadius: '16px', border: `1px solid var(--border)`, background: 'var(--bg)', marginTop: '10px' }
const ytdTitle: any = { margin: 0, fontSize: '10px', fontWeight: '900', color: colors.secondaryText, letterSpacing: '0.8px' }
const ytdSubTitle: any = { margin: '6px 0 0 0', fontSize: '10px', fontWeight: '800', color: colors.secondaryText, opacity: 0.85 }
const ytdRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '10px' }
const ytdLabel: any = { fontSize: '12px', fontWeight: '800', color: colors.primaryDark }
const ytdValue: any = { fontSize: '12px', fontWeight: '900', color: colors.primaryDark }
const ytdValueGreen: any = { fontSize: '12px', fontWeight: '900', color: colors.accentGreen }
const ytdValueRed: any = { fontSize: '12px', fontWeight: '900', color: colors.accentRed }
const ytdHint: any = { margin: '10px 0 0 0', fontSize: '10px', fontWeight: '800', color: colors.secondaryText }
const ytdLoading: any = { margin: '10px 0 0 0', fontSize: '12px', fontWeight: '800', color: colors.secondaryText }

const zBreakdownCard: any = { width: '100%', padding: '14px', borderRadius: '16px', border: `1px solid var(--border)`, background: 'var(--bg)' }
const zBreakdownRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '10px' }

const emptyStateStyle: any = { textAlign: 'center', padding: '40px 20px', color: colors.secondaryText, fontWeight: '600', fontSize: '13px' }
const spinnerStyle: any = { width: '24px', height: '24px', border: '3px solid #f3f3f3', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '40px', color: colors.secondaryText, fontWeight: 800 }}>Φόρτωση dashboard...</div>}>
        <DashboardContent />
      </Suspense>
    </ErrorBoundary>
  )
}
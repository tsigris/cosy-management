'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NotificationsBell from '@/components/NotificationsBell'
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

function getPaymentMethod(tx: any): string {
  return String(tx?.payment_method ?? tx?.method ?? '').trim()
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdFromUrl = searchParams.get('store')
  const inviteTokenFromUrl = searchParams.get('token')

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
    if (t?.notes && t.notes.startsWith('Πληρωμή Δόσης')) return `loan:${t.id}`
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
    if (t?.notes && t.notes.startsWith('Πληρωμή Δόσης')) {
      const parts = t.notes.split(':')
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
      if (inviteTokenFromUrl) return
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
        .select('*, suppliers(name), fixed_assets(name), revenue_sources(name)')
        .eq('store_id', storeIdFromUrl)
        .or(`date.eq.${selectedDate},and(created_at.gte.${windowStartIso},created_at.lte.${windowEndIso})`)
        .order('created_at', { ascending: false })

      if (txError) throw txError

      // ✅ DEDUPE
      const map = new Map<string, any>()
      for (const row of tx || []) map.set(String(row.id), row)
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
  }, [selectedDate, router, storeIdFromUrl, inviteTokenFromUrl])

  const acceptInviteFromToken = useCallback(async () => {
    if (!inviteTokenFromUrl || storeIdFromUrl) return

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/login?next=${encodeURIComponent(`/?token=${inviteTokenFromUrl}`)}`)
        return
      }

      const { data, error } = await supabase.rpc('accept_store_invite', { p_token: inviteTokenFromUrl })
      if (error) throw error

      const acceptedStoreId =
        typeof data === 'string' || typeof data === 'number'
          ? String(data)
          : (data as { storeId?: string; store_id?: string } | null)?.storeId ||
            (data as { storeId?: string; store_id?: string } | null)?.store_id ||
            ''

      if (!acceptedStoreId) {
        throw new Error('Η πρόσκληση δεν επέστρεψε έγκυρο κατάστημα.')
      }

      toast.success('Η πρόσκληση έγινε αποδεκτή!')
      router.replace(`/?store=${acceptedStoreId}`)
    } catch (err) {
      console.error('Invite accept error:', err)
      toast.error('Αποτυχία αποδοχής πρόσκλησης')
    }
  }, [inviteTokenFromUrl, storeIdFromUrl, router])

  useEffect(() => {
    if (!inviteTokenFromUrl || storeIdFromUrl) return
    void acceptInviteFromToken()
  }, [inviteTokenFromUrl, storeIdFromUrl, acceptInviteFromToken])

  useEffect(() => {
    if (inviteTokenFromUrl && !storeIdFromUrl) return
    loadDashboard()
  }, [loadDashboard, inviteTokenFromUrl, storeIdFromUrl])

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

  const zTransactions = useMemo(() => transactions.filter((t) => isZTransaction(t)), [transactions, isZTransaction])

  const displayTransactions = useMemo(() => {
    const zTx = zTransactions

    if (zTx.length <= 1) {
      return transactions.map((t) => ({ kind: 'normal' as const, id: String(t.id), tx: t }))
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
          created_by_name: string | null
          itemsCount: number
          breakdown: Array<{ method: string; amount: number }>
        }
    > = []

    let zInserted = false

    for (const t of transactions) {
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
          created_by_name: zTx[0]?.created_by_name || null,
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
                <NextLink href={`/permissions?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>
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
            + Έσοδο
          </NextLink>

          <NextLink href={`/add-expense?date=${selectedDate}&store=${storeIdFromUrl}`} style={{ ...actionBtn, backgroundColor: colors.accentRed }}>
            - Έξοδο
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
        <p style={listHeader}>ΚΙΝΗΣΕΙΣ ΗΜΕΡΑΣ ({displayTransactions.length})</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={spinnerStyle}></div>
          </div>
        ) : displayTransactions.length === 0 ? (
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

            const txCreatedBy = isZMaster ? row.created_by_name : t?.created_by_name || 'Χρήστης'
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

                    {!isZMaster && t?.notes && (
                      <p style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', margin: '4px 0 2px 0' }}>
                        {t.notes}
                      </p>
                    )}

                    <p style={txMeta}>
                      {txMethod} • {txCreatedAt ? format(parseISO(txCreatedAt), 'HH:mm') : '--:--'} • {txCreatedBy}
                    </p>
                  </div>

                  <p style={{ ...txAmount, color: isIncomeTx ? colors.accentGreen : colors.accentRed }}>
                    {isIncomeTx ? '+' : '-'}
                    {Math.abs(txAmountValue).toFixed(2)}€
                  </p>
                </div>

                {expandedTx === txId && (
                  <div style={actionPanel}>
                    {isZMaster ? (
                      <div style={zBreakdownCard}>
                        <p style={ytdTitle}>ΑΝΑΛΥΣΗ ΚΛΕΙΣΙΜΑΤΟΣ Ζ</p>
                        <p style={ytdSubTitle}>Ανάλυση ανά μέθοδο</p>

                        {row.breakdown.map((item) => (
                          <div key={item.method} style={zBreakdownRow}>
                            <span style={ytdLabel}>{item.method}</span>
                            <span style={ytdValueGreen}>{money(item.amount)}€</span>
                          </div>
                        ))}

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
const iphoneWrapper: any = {
  backgroundColor: colors.bgLight,
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
const editRowBtn: any = { flex: 1, padding: '10px', backgroundColor: colors.bgLight, color: colors.primaryDark, border: `1px solid ${colors.border}`, borderRadius: '10px', fontWeight: '700', fontSize: '12px', minWidth: '140px', cursor: 'pointer' }
const deleteRowBtn: any = { flex: 1, padding: '10px', backgroundColor: '#fee2e2', color: colors.accentRed, border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '12px', minWidth: '120px', cursor: 'pointer' }

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

const zBreakdownCard: any = { width: '100%', padding: '14px', borderRadius: '16px', border: `1px solid ${colors.border}`, background: '#f8fafc' }
const zBreakdownRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '10px' }

const emptyStateStyle: any = { textAlign: 'center', padding: '40px 20px', color: colors.secondaryText, fontWeight: '600', fontSize: '13px' }
const spinnerStyle: any = { width: '24px', height: '24px', border: '3px solid #f3f3f3', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}
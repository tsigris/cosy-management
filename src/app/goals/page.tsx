'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState, Suspense, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  PiggyBank,
  PlusCircle,
  TrendingUp,
  TrendingDown,
  CircleDashed,
  Target,
  X,
  Pencil,
  Trash2,
  CheckCircle2,
  Calendar,
  Clock,
  Wallet,
  CreditCard,
  Landmark,
  History,
  ArrowRight,
  ArrowLeft,
  Search,
} from 'lucide-react'

// --- ΧΡΩΜΑΤΑ & ΣΤΥΛ (SaaS UI) ---
const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  modalBackdrop: 'rgba(2,6,23,0.6)',
  warningBg: '#fffbeb',
  warningText: '#92400e',
  purple: '#7c3aed',
  indigo: '#6366f1',
}

type Goal = {
  id: string
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  status: 'active' | 'completed'
  color?: string
  icon?: string
  created_at?: string
}

type Tx = {
  id: string
  date: string
  type: string
  amount: number
  method?: string | null
  payment_method?: string | null
  notes?: string | null
  created_at?: string | null
  created_by_name?: string | null
}

type PayMethod = 'Μετρητά' | 'Κάρτα' | 'Τράπεζα'

// Helpers
function yyyyMmDd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getBusinessDate() {
  const now = new Date()
  // business day ends 06:59
  if (now.getHours() < 7) now.setDate(now.getDate() - 1)
  return yyyyMmDd(now)
}

function toMoney(value: number | null | undefined) {
  return `${Number(value || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function normalizeMoneyInput(raw: string) {
  return String(raw || '').replace(/\s/g, '').replace(/[^\d.,-]/g, '')
}

function parseMoney(raw: string): number | null {
  const s0 = normalizeMoneyInput(raw)
  if (!s0) return null
  let s = s0.replace(/(?!^)-/g, '')
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) s = s.replace(/\./g, '').replace(',', '.')
  else if (hasComma && !hasDot) s = s.replace(',', '.')
  const parts = s.split('.')
  if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function getPaymentMethod(tx: any): string {
  return String(tx?.payment_method ?? tx?.method ?? '').trim()
}

function formatMoneyInputEl(n: number) {
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

function daysBetweenInclusive(from: Date, to: Date) {
  const ms = 24 * 60 * 60 * 1000
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.floor((end - start) / ms) + 1
}

function monthsApprox(days: number) {
  return Math.max(1, Math.ceil(days / 30))
}

function GoalsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<Goal[]>([])

  // impact map (today net) per goal
  const [todayImpactByGoal, setTodayImpactByGoal] = useState<Record<string, number>>({})

  // Modal: Goal Form
  const [openGoalModal, setOpenGoalModal] = useState(false)
  const [savingGoal, setSavingGoal] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('') // yyyy-mm-dd

  // Modal: Transaction (Deposit/Withdraw)
  const [openTxModal, setOpenTxModal] = useState(false)
  const [savingTx, setSavingTx] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [txAction, setTxAction] = useState<'deposit' | 'withdraw'>('deposit')
  const [txAmount, setTxAmount] = useState('')
  const [txMethod, setTxMethod] = useState<PayMethod>('Μετρητά') // ✅ multi-wallet

  // Quick presets
  const presets = useMemo(() => [5, 10, 20, 50, 100], [])

  // History modal
  const [openHistoryModal, setOpenHistoryModal] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyRows, setHistoryRows] = useState<Tx[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(0)
  const [historyPageSize, setHistoryPageSize] = useState(20)
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')

  const businessDate = useMemo(() => getBusinessDate(), [])

  const loadGoals = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const goalsQ = supabase
        .from('savings_goals')
        .select('*')
        .eq('store_id', storeId)
        .order('status', { ascending: true }) // active first
        .order('created_at', { ascending: false })

      // ✅ one query to compute today's net impact for all goals
      const todayTxQ = supabase
        .from('transactions')
        .select('goal_id, amount, type, date')
        .eq('store_id', storeId)
        .eq('date', businessDate)
        .not('goal_id', 'is', null)

      const [{ data: gData, error: gErr }, { data: tData, error: tErr }] = await Promise.all([goalsQ, todayTxQ])
      if (gErr) throw gErr
      if (tErr) throw tErr

      const gList: Goal[] = (gData || []) as any
      setGoals(gList)

      const map: Record<string, number> = {}
      for (const row of (tData || []) as any[]) {
        const gid = String(row.goal_id || '')
        if (!gid) continue
        const amt = Number(row.amount) || 0
        // deposits stored as negative, withdrawals as positive (based on your implementation)
        map[gid] = (map[gid] || 0) + amt
      }
      setTodayImpactByGoal(map)
    } catch (e: any) {
      toast.error('Σφάλμα φόρτωσης στόχων')
    } finally {
      setLoading(false)
    }
  }, [storeId, router, businessDate])

  useEffect(() => {
    loadGoals()
  }, [loadGoals])

  useEffect(() => {
    const onWindowFocus = () => {
      loadGoals()
    }

    window.addEventListener('focus', onWindowFocus)
    return () => window.removeEventListener('focus', onWindowFocus)
  }, [loadGoals])

  // --- GOAL ACTIONS ---
  const resetGoalForm = () => {
    setEditingGoalId(null)
    setName('')
    setTargetAmount('')
    setTargetDate('')
  }

  const startCreate = () => {
    resetGoalForm()
    setOpenGoalModal(true)
  }

  const startEdit = (g: Goal) => {
    setEditingGoalId(g.id)
    setName(g.name)
    setTargetAmount(formatMoneyInputEl(Number(g.target_amount || 0)))
    setTargetDate(g.target_date || '')
    setOpenGoalModal(true)
  }

  const onSaveGoal = async () => {
    if (!storeId) return toast.error('Λείπει το κατάστημα')
    if (!name.trim()) return toast.error('Βάλε όνομα στόχου')
    const parsedTarget = parseMoney(targetAmount)
    if (!parsedTarget || parsedTarget <= 0) return toast.error('Βάλε σωστό ποσό στόχου')

    // validate target date (optional)
    if (targetDate) {
      const d = new Date(targetDate)
      if (Number.isNaN(d.getTime())) return toast.error('Λάθος ημερομηνία στόχου')
    }

    setSavingGoal(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Η συνεδρία έληξε')

      const payload: any = {
        store_id: storeId,
        user_id: session.user.id,
        name: name.trim(),
        target_amount: parsedTarget,
        target_date: targetDate || null,
      }

      if (editingGoalId) {
        const { error } = await supabase
          .from('savings_goals')
          .update(payload)
          .eq('id', editingGoalId)
          .eq('store_id', storeId)
        if (error) throw error
        toast.success('Ο στόχος ενημερώθηκε')
      } else {
        const { error } = await supabase.from('savings_goals').insert([payload])
        if (error) throw error
        toast.success('Ο στόχος δημιουργήθηκε')
      }

      setOpenGoalModal(false)
      loadGoals()
    } catch (e: any) {
      toast.error(e.message || 'Αποτυχία αποθήκευσης')
    } finally {
      setSavingGoal(false)
    }
  }

  const onDeleteGoal = async (id: string) => {
    if (!confirm('Διαγραφή αυτού του στόχου; Οι κινήσεις του ταμείου ΔΕΝ θα διαγραφούν.')) return
    try {
      const { error } = await supabase
        .from('savings_goals')
        .delete()
        .eq('id', id)
        .eq('store_id', storeId)
      if (error) throw error
      toast.success('Διαγράφηκε επιτυχώς')
      loadGoals()
    } catch (e: any) {
      toast.error('Αποτυχία διαγραφής (μόνο Admin)')
    }
  }

  // --- ATOMIC TRANSACTION ACTIONS ---
  const startTransaction = (g: Goal, action: 'deposit' | 'withdraw') => {
    setSelectedGoal(g)
    setTxAction(action)
    setTxAmount('')
    setTxMethod('Μετρητά')
    setOpenTxModal(true)
  }

  const applyPreset = (n: number) => {
    const current = parseMoney(txAmount) || 0
    const next = current + n
    setTxAmount(formatMoneyInputEl(next))
  }

  const onSaveTransaction = async () => {
    if (!storeId || !selectedGoal) return

    const amount = parseMoney(txAmount)
    if (!amount || amount <= 0) return toast.error('Βάλε σωστό ποσό')

    // UI check
    if (txAction === 'withdraw' && amount > Number(selectedGoal.current_amount || 0)) {
      return toast.error('Δεν επαρκεί το υπόλοιπο του κουμπαρά')
    }

    setSavingTx(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Η συνεδρία έληξε')

      const rawUser =
        (session.user.user_metadata as any)?.username ||
        (session.user.user_metadata as any)?.full_name ||
        session.user.email ||
        'Χρήστης'

      const userName = String(rawUser).split('@')[0]

      const delta = txAction === 'deposit' ? amount : -amount

      // 1) Atomic goal update via RPC
      const { data: newAmount, error: goalErr } = await supabase.rpc('increment_goal_amount', {
        goal_id: selectedGoal.id,
        store_id: storeId,
        amount: delta,
      })
      if (goalErr) throw goalErr

      // 2) Insert transaction in ledger
      // deposit => money leaves wallet => negative
      // withdraw => money returns to wallet => positive
      const dbAmount = txAction === 'deposit' ? -amount : amount
      const dbType = txAction === 'deposit' ? 'savings_deposit' : 'savings_withdrawal'
      const dbNotes =
        txAction === 'deposit'
          ? `Κατάθεση στον Κουμπαρά: ${selectedGoal.name}`
          : `Ανάληψη από Κουμπαρά: ${selectedGoal.name}`

      const methodValue = txMethod // Μετρητά / Κάρτα / Τράπεζα

      const { error: txErr } = await supabase.from('transactions').insert([
        {
          store_id: storeId,
          goal_id: selectedGoal.id,
          user_id: session.user.id,
          created_by_name: userName,
          type: dbType,
          amount: dbAmount,
          method: methodValue,
          category: 'Αποταμίευση',
          notes: dbNotes,
          date: getBusinessDate(),
        },
      ])
      if (txErr) throw txErr

      toast.success(txAction === 'deposit' ? 'Η κατάθεση ολοκληρώθηκε!' : 'Η ανάληψη ολοκληρώθηκε!')
      setOpenTxModal(false)

      // 3) Optimistic update goal list + today impact
      setGoals((prev) =>
        prev.map((g) => {
          if (g.id === selectedGoal.id) {
            const updatedAmount = Number(newAmount)
            const finalStatus =
              g.status === 'completed' && updatedAmount < Number(g.target_amount)
                ? 'completed'
                : updatedAmount >= Number(g.target_amount)
                  ? 'completed'
                  : 'active'
            return { ...g, current_amount: updatedAmount, status: finalStatus }
          }
          return g
        })
      )

      setTodayImpactByGoal((prev) => ({
        ...prev,
        [selectedGoal.id]: (prev[selectedGoal.id] || 0) + dbAmount,
      }))
    } catch (e: any) {
      toast.error(e.message || 'Σφάλμα συναλλαγής')
    } finally {
      setSavingTx(false)
    }
  }

  // ✅ History loading (last 10 + "view all" pagination & filters)
  const openHistory = async (g: Goal) => {
    setSelectedGoal(g)
    setOpenHistoryModal(true)
    setHistoryPage(0)
    setHistoryPageSize(20)
    setHistoryFrom('')
    setHistoryTo('')
    await loadHistory(g.id, 0, 20, '', '')
  }

  const loadHistory = useCallback(
    async (goalId: string, page: number, pageSize: number, from: string, to: string) => {
      if (!storeId) return
      setHistoryLoading(true)
      try {
        let q = supabase
          .from('transactions')
          .select('id, date, type, amount, method, notes, created_at, created_by_name', { count: 'exact' })
          .eq('store_id', storeId)
          .eq('goal_id', goalId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })

        if (from) q = q.gte('date', from)
        if (to) q = q.lte('date', to)

        const fromIdx = page * pageSize
        const toIdx = fromIdx + pageSize - 1

        const { data, error, count } = await q.range(fromIdx, toIdx)
        if (error) throw error

        setHistoryRows((data || []) as any)
        setHistoryTotal(Number(count || 0))
      } catch (e: any) {
        toast.error('Σφάλμα φόρτωσης ιστορικού')
      } finally {
        setHistoryLoading(false)
      }
    },
    [storeId]
  )

  const runHistorySearch = async () => {
    if (!selectedGoal) return
    setHistoryPage(0)
    await loadHistory(selectedGoal.id, 0, historyPageSize, historyFrom, historyTo)
  }

  const onDeleteTransaction = async (tx: Tx) => {
    if (!storeId || !selectedGoal) return
    if (!confirm('Θέλεις σίγουρα να διαγράψεις αυτή την κίνηση;')) return

    try {
      const { error } = await supabase.rpc('professional_delete_goal_transaction', {
        p_transaction_id: tx.id,
        p_goal_id: selectedGoal.id,
        p_store_id: storeId,
      })
      if (error) throw error
      setHistoryRows((prev) => prev.filter((row) => row.id !== tx.id))
      await loadGoals()
    } catch (e: any) {
      toast.error(e?.message || 'Αποτυχία διαγραφής κίνησης')
    }
  }

  // UI Stats
  const totalSaved = useMemo(() => goals.reduce((acc, g) => acc + Number(g.current_amount || 0), 0), [goals])

  const totalTodayImpact = useMemo(() => {
    // sum across all goals today
    return Object.values(todayImpactByGoal).reduce((a, v) => a + (Number(v) || 0), 0)
  }, [todayImpactByGoal])

  // ✅ plan helper (daily/monthly + expected pace)
  const getPlan = useCallback((g: Goal) => {
    const target = Number(g.target_amount || 0)
    const current = Number(g.current_amount || 0)
    const remaining = Math.max(0, target - current)

    const td = g.target_date ? new Date(g.target_date) : null
    const today = new Date()
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const hasDate = !!td && !Number.isNaN(td!.getTime())
    if (!hasDate) {
      return {
        hasDate: false,
        expired: false,
        remaining,
        daysLeft: null as number | null,
        perDay: null as number | null,
        perMonth: null as number | null,
        expectedNow: null as number | null,
        deltaFromExpected: null as number | null,
      }
    }

    const targetDate = new Date(td!.getFullYear(), td!.getMonth(), td!.getDate())
    const expired = todayDate.getTime() > targetDate.getTime() && current < target

    const daysLeft = Math.max(1, daysBetweenInclusive(todayDate, targetDate))
    const perDay = remaining / daysLeft
    const perMonth = remaining / monthsApprox(daysLeft)

    // expected pace: assume linear from created_at (or today if missing)
    const created = g.created_at ? new Date(g.created_at) : todayDate
    const start = new Date(created.getFullYear(), created.getMonth(), created.getDate())
    const totalDays = Math.max(1, daysBetweenInclusive(start, targetDate))
    const elapsedDays = clamp(daysBetweenInclusive(start, todayDate), 1, totalDays)
    const elapsedPct = clamp(elapsedDays / totalDays, 0, 1)
    const expectedNow = target * elapsedPct
    const deltaFromExpected = current - expectedNow

    return {
      hasDate: true,
      expired,
      remaining,
      daysLeft,
      perDay,
      perMonth,
      expectedNow,
      deltaFromExpected,
    }
  }, [])

  const proposeNewDate = useCallback((g: Goal) => {
    // suggest +3 months from today
    const d = new Date()
    d.setMonth(d.getMonth() + 3)
    return yyyyMmDd(d)
  }, [])

  if (loading) {
    return (
      <div style={wrapperStyle}>
        <div style={contentStyle}>
          <div style={loadingCardStyle}>
            <CircleDashed size={20} className="animate-spin" /> Φόρτωση Κουμπαράδων...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={wrapperStyle}>
      <Toaster richColors position="top-center" />
      <div style={contentStyle}>
        {/* Header */}
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={logoBoxStyle}>
              <PiggyBank size={22} color={colors.accentBlue} />
            </div>
            <div>
              <h1 style={titleStyle}>Κουμπαράδες</h1>
              <p style={subtitleStyle}>Αποταμίευση & Στόχοι</p>
            </div>
          </div>
          <Link href={`/?store=${storeId || ''}`} style={backBtnStyle}>
            <ChevronLeft size={18} />
          </Link>
        </header>

        {/* Total Summary */}
        <div style={summaryCardStyle}>
          <div style={{ minWidth: 0 }}>
            <p style={summaryLabelStyle}>ΣΥΝΟΛΙΚΗ ΑΠΟΤΑΜΙΕΥΣΗ</p>
            <p style={summaryValueStyle}>{toMoney(totalSaved)}</p>

            {/* ✅ "impact on cash today" (net) */}
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span style={chipStyle}>
                <Clock size={14} /> Σήμερα: {toMoney(totalTodayImpact)}
              </span>
              <span style={chipStyle}>
                <Calendar size={14} /> Business Date: {businessDate}
              </span>
            </div>
          </div>
          <Target size={32} opacity={0.18} />
        </div>

        <button type="button" style={newBtnStyle} onClick={startCreate}>
          <PlusCircle size={16} /> Νέος Στόχος
        </button>

        {/* Goals List */}
        {goals.length === 0 ? (
          <div style={emptyStateStyle}>
            <PiggyBank size={36} color="#cbd5e1" />
            <p style={{ margin: '8px 0 0', fontWeight: 800, color: colors.secondaryText }}>Δεν έχεις δημιουργήσει στόχους.</p>
          </div>
        ) : (
          <div style={goalsGridStyle}>
            {goals.map((g) => {
              const target = Number(g.target_amount || 0)
              const current = Number(g.current_amount || 0)
              const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
              const isCompleted = g.status === 'completed'
              const plan = getPlan(g)
              const todayImpact = Number(todayImpactByGoal[g.id] || 0) // negative for deposits, positive for withdraw
              const ringRadius = 28
              const ringCircumference = 2 * Math.PI * ringRadius
              const ringOffset = ringCircumference - (progress / 100) * ringCircumference

              const paceHint = plan.hasDate
                ? plan.expired
                  ? `Η ημερομηνία στόχου έχει περάσει. Υπόλοιπο: ${toMoney(plan.remaining)}`
                  : `Απομένουν ~${plan.daysLeft} ημέρες • /ημέρα: ${toMoney(plan.perDay || 0)} • /μήνα: ${toMoney(plan.perMonth || 0)}`
                : 'Βάλε ημερομηνία στόχου για να σου δείχνει /ημέρα και /μήνα.'

              const paceDelta = plan.hasDate
                ? plan.deltaFromExpected === null
                  ? null
                  : plan.deltaFromExpected >= 0
                    ? `Μπροστά από πλάνο: ${toMoney(plan.deltaFromExpected)}`
                    : `Πίσω από πλάνο: ${toMoney(Math.abs(plan.deltaFromExpected))}`
                : null

              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => openHistory(g)}
                  style={{ ...goalTileStyle, opacity: isCompleted ? 0.9 : 1 }}
                >
                  <div style={goalTileRingWrap}>
                    <svg width="84" height="84" viewBox="0 0 84 84" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="42" cy="42" r={ringRadius} stroke="#e2e8f0" strokeWidth="8" fill="none" />
                      <circle
                        cx="42"
                        cy="42"
                        r={ringRadius}
                        stroke={isCompleted ? colors.accentGreen : colors.accentBlue}
                        strokeWidth="8"
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        style={{ transition: 'stroke-dashoffset 0.35s ease' }}
                      />
                    </svg>
                    <div style={goalTileRingCenter}>
                      {isCompleted ? <CheckCircle2 size={20} color={colors.accentGreen} /> : <PiggyBank size={20} color={colors.accentBlue} />}
                    </div>
                  </div>

                  <div style={goalTilePercent}>{progress}%</div>
                  <h3 style={goalTileName}>{g.name}</h3>
                  <div style={goalTileAmount}>{toMoney(current)}</div>
                  <div style={goalTileTarget}>Στόχος: {toMoney(target)}</div>
                  <div style={goalTileBottomRow}>
                    <span style={{ ...miniChip, borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.08)', color: colors.indigo }}>
                      <Clock size={12} /> {toMoney(todayImpact)}
                    </span>
                    {!!g.target_date && (
                      <span style={dateBadgeStyle}>
                        <Calendar size={12} /> {g.target_date}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL: CREATE/EDIT GOAL */}
      {openGoalModal && (
        <div style={modalBackdropStyle} onClick={() => !savingGoal && setOpenGoalModal(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontWeight: 900 }}>{editingGoalId ? 'Επεξεργασία Στόχου' : 'Νέος Στόχος'}</h2>
              <button style={iconCloseBtnStyle} onClick={() => setOpenGoalModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
              <div>
                <label style={labelStyle}>Όνομα (π.χ. Ανακαίνιση)</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div>
                <label style={labelStyle}>Ποσό Στόχου</label>
                <input
                  style={inputStyle}
                  inputMode="decimal"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(normalizeMoneyInput(e.target.value))}
                  onBlur={() => {
                    const n = parseMoney(targetAmount)
                    if (n) setTargetAmount(formatMoneyInputEl(n))
                  }}
                />
              </div>

              {/* ✅ target date added */}
              <div>
                <label style={labelStyle}>Ημερομηνία Στόχου (προαιρετικό)</label>
                <div style={dateRow}>
                  <div style={dateIcon}>
                    <Calendar size={16} />
                  </div>
                  <input style={dateInput} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                </div>
                <div style={hintTiny}>Αν βάλεις ημερομηνία, θα σου δείχνει πόσα χρειάζεσαι ανά ημέρα και ανά μήνα.</div>
              </div>
            </div>

            <button style={saveBtnStyle} onClick={onSaveGoal} disabled={savingGoal}>
              {savingGoal ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: TRANSACTION */}
      {openTxModal && selectedGoal && (
        <div style={modalBackdropStyle} onClick={() => !savingTx && setOpenTxModal(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontWeight: 900 }}>{txAction === 'deposit' ? 'Κατάθεση στον Κουμπαρά' : 'Ανάληψη από Κουμπαρά'}</h2>
              <button style={iconCloseBtnStyle} onClick={() => setOpenTxModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 12, background: colors.bgLight, borderRadius: 12, marginBottom: 12 }}>
              <p style={{ margin: 0, fontWeight: 900, color: colors.primaryDark }}>{selectedGoal.name}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700, color: colors.secondaryText }}>
                Διαθέσιμο Υπόλοιπο: {toMoney(selectedGoal.current_amount)}
              </p>
            </div>

            {/* ✅ multi-wallet selector */}
            <label style={labelStyle}>Πηγή Χρημάτων</label>
            <div style={methodGrid}>
              <button type="button" onClick={() => setTxMethod('Μετρητά')} style={{ ...methodBtn, ...(txMethod === 'Μετρητά' ? methodBtnActive : {}) }}>
                <Wallet size={16} /> Μετρητά
              </button>
              <button type="button" onClick={() => setTxMethod('Κάρτα')} style={{ ...methodBtn, ...(txMethod === 'Κάρτα' ? methodBtnActive : {}) }}>
                <CreditCard size={16} /> Κάρτα
              </button>
              <button type="button" onClick={() => setTxMethod('Τράπεζα')} style={{ ...methodBtn, ...(txMethod === 'Τράπεζα' ? methodBtnActive : {}) }}>
                <Landmark size={16} /> Τράπεζα
              </button>
            </div>

            <label style={{ ...labelStyle, marginTop: 12 }}>Ποσό {txAction === 'deposit' ? 'Κατάθεσης' : 'Ανάληψης'}</label>

            <input
              style={inputStyle}
              inputMode="decimal"
              placeholder="π.χ. 50,00"
              value={txAmount}
              onChange={(e) => setTxAmount(normalizeMoneyInput(e.target.value))}
              onBlur={() => {
                const n = parseMoney(txAmount)
                if (n) setTxAmount(formatMoneyInputEl(n))
              }}
            />

            {/* ✅ presets */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {presets.map((p) => (
                <button key={p} type="button" onClick={() => applyPreset(p)} style={presetBtn}>
                  +{p}€
                </button>
              ))}
            </div>

            <p style={{ fontSize: 11, fontWeight: 850, color: colors.secondaryText, marginTop: 10, lineHeight: 1.4 }}>
              {txAction === 'deposit' ? (
                <>
                  * Το ποσό θα <b>αφαιρεθεί</b> από <b>{txMethod}</b> στο ταμείο και θα μπει στον κουμπαρά.
                </>
              ) : (
                <>
                  * Το ποσό θα <b>επιστρέψει</b> στο ταμείο ως <b>{txMethod}</b>.
                </>
              )}
            </p>

            <button
              style={{ ...saveBtnStyle, background: txAction === 'deposit' ? colors.primaryDark : colors.accentBlue }}
              onClick={onSaveTransaction}
              disabled={savingTx}
            >
              {savingTx ? 'Εκτέλεση...' : 'Επιβεβαίωση'}
            </button>
          </div>
        </div>
      )}

      {/* ✅ MODAL: GOAL DETAILS + HISTORY */}
      {openHistoryModal && selectedGoal && (
        <div style={modalBackdropStyle} onClick={() => setOpenHistoryModal(false)}>
          <div style={{ ...modalCardStyle, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <h2 style={{ margin: 0, fontWeight: 950 }}>Λεπτομέρειες Στόχου</h2>
                <div style={{ fontSize: 12, fontWeight: 800, color: colors.secondaryText }}>
                  {selectedGoal.name} • {toMoney(selectedGoal.current_amount)} / {toMoney(selectedGoal.target_amount)}
                </div>
              </div>
              <button style={iconCloseBtnStyle} onClick={() => setOpenHistoryModal(false)}>
                <X size={16} />
              </button>
            </div>

            {(() => {
              const target = Number(selectedGoal.target_amount || 0)
              const current = Number(selectedGoal.current_amount || 0)
              const plan = getPlan(selectedGoal)
              const paceHint = plan.hasDate
                ? plan.expired
                  ? `Η ημερομηνία στόχου έχει περάσει. Υπόλοιπο: ${toMoney(plan.remaining)}`
                  : `Απομένουν ~${plan.daysLeft} ημέρες • /ημέρα: ${toMoney(plan.perDay || 0)} • /μήνα: ${toMoney(plan.perMonth || 0)}`
                : 'Βάλε ημερομηνία στόχου για να σου δείχνει /ημέρα και /μήνα.'

              const paceDelta = plan.hasDate
                ? plan.deltaFromExpected === null
                  ? null
                  : plan.deltaFromExpected >= 0
                    ? `Μπροστά από πλάνο: ${toMoney(plan.deltaFromExpected)}`
                    : `Πίσω από πλάνο: ${toMoney(Math.abs(plan.deltaFromExpected))}`
                : null

              return (
                <>
                  <div style={planBox}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: colors.secondaryText, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Target size={14} /> Πλάνο
                      </span>
                      {plan.hasDate && plan.expired && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenHistoryModal(false)
                            startEdit(selectedGoal)
                            setTargetDate(proposeNewDate(selectedGoal))
                          }}
                          style={tinyBtnWarn}
                        >
                          Πρότεινε νέα ημερομηνία (+3 μήνες)
                        </button>
                      )}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, fontWeight: 850, color: plan.hasDate && plan.expired ? colors.accentRed : colors.secondaryText }}>
                      {paceHint}
                    </div>
                    {paceDelta && (
                      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 900, color: plan.deltaFromExpected! >= 0 ? colors.accentGreen : colors.accentRed }}>
                        {paceDelta}
                      </div>
                    )}
                    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 850, color: colors.secondaryText }}>
                      Υπόλοιπο: {toMoney(Math.max(0, target - current))}
                    </div>
                  </div>

                  <div style={detailsActionGrid}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenHistoryModal(false)
                        startTransaction(selectedGoal, 'deposit')
                      }}
                      style={{ ...txBtnStyle, background: colors.primaryDark, color: '#fff' }}
                    >
                      <TrendingUp size={16} /> Κατάθεση
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenHistoryModal(false)
                        startTransaction(selectedGoal, 'withdraw')
                      }}
                      disabled={current <= 0}
                      style={{
                        ...txBtnStyle,
                        background: '#f1f5f9',
                        color: colors.primaryDark,
                        opacity: current <= 0 ? 0.5 : 1,
                      }}
                    >
                      <TrendingDown size={16} /> Ανάληψη
                    </button>
                  </div>

                  <div style={detailsActionGrid}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenHistoryModal(false)
                        startEdit(selectedGoal)
                      }}
                      style={{ ...txBtnStyle, background: '#eef2ff', color: colors.indigo }}
                    >
                      <Pencil size={16} /> Επεξεργασία
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setOpenHistoryModal(false)
                        await onDeleteGoal(selectedGoal.id)
                      }}
                      style={{ ...txBtnStyle, background: '#fff1f2', color: colors.accentRed }}
                    >
                      <Trash2 size={16} /> Διαγραφή
                    </button>
                  </div>
                </>
              )
            })()}

            <div style={{ marginTop: 14, marginBottom: 8, fontSize: 13, fontWeight: 900, color: colors.primaryDark, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <History size={14} /> Ιστορικό
            </div>

            {/* Filters */}
            <div style={historyFilters}>
              <div style={historyFilterRow}>
                <div style={historyDateBox}>
                  <div style={historyDateLabel}>ΑΠΟ</div>
                  <input style={historyDateInput} type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
                </div>
                <div style={historyDateBox}>
                  <div style={historyDateLabel}>ΕΩΣ</div>
                  <input style={historyDateInput} type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <select value={historyPageSize} onChange={(e) => setHistoryPageSize(Number(e.target.value))} style={historySelect}>
                  <option value={10}>10/σελίδα</option>
                  <option value={20}>20/σελίδα</option>
                  <option value={30}>30/σελίδα</option>
                  <option value={50}>50/σελίδα</option>
                </select>

                <button
                  type="button"
                  onClick={runHistorySearch}
                  style={historySearchBtn}
                  disabled={historyLoading}
                  title="Αναζήτηση"
                >
                  <Search size={16} /> Αναζήτηση
                </button>
              </div>
            </div>

            {/* Results */}
            <div style={{ marginTop: 14 }}>
              {historyLoading ? (
                <div style={hintBox}>Φόρτωση...</div>
              ) : historyRows.length === 0 ? (
                <div style={hintBox}>Δεν βρέθηκαν κινήσεις για τα φίλτρα που επέλεξες.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {historyRows.map((t) => {
                    const amt = Number(t.amount) || 0
                    const isDeposit = t.type === 'savings_deposit' || amt < 0
                    const abs = Math.abs(amt)
                    const method = getPaymentMethod(t)
                    return (
                      <div key={t.id} style={historyRow}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 950, color: colors.primaryDark }}>{t.date}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                ...historyPill,
                                background: isDeposit ? '#fff1f2' : '#ecfdf5',
                                borderColor: isDeposit ? '#ffe4e6' : '#d1fae5',
                                color: isDeposit ? colors.accentRed : colors.accentGreen,
                              }}
                            >
                              {isDeposit ? '-' : '+'}
                              {abs.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                            </div>
                            <button type="button" onClick={() => onDeleteTransaction(t)} style={actionIconBtn} aria-label="delete transaction" title="Διαγραφή κίνησης">
                              <Trash2 size={16} color={colors.accentRed} />
                            </button>
                          </div>
                        </div>

                        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 850, color: colors.secondaryText }}>
                          <span style={{ fontWeight: 950 }}>Μέθοδος:</span> {method || '—'}
                        </div>

                        {!!t.notes && (
                          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 850, color: colors.secondaryText }}>{t.notes}</div>
                        )}

                        {!!t.created_by_name && (
                          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: '#94a3b8' }}>
                            by {t.created_by_name}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            <div style={historyPager}>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedGoal) return
                  const next = Math.max(0, historyPage - 1)
                  setHistoryPage(next)
                  await loadHistory(selectedGoal.id, next, historyPageSize, historyFrom, historyTo)
                }}
                style={pagerBtn}
                disabled={historyLoading || historyPage <= 0}
              >
                <ArrowLeft size={16} /> Prev
              </button>

              <div style={{ fontSize: 13, fontWeight: 900, color: colors.secondaryText }}>
                Σελίδα {historyPage + 1} / {Math.max(1, Math.ceil(historyTotal / historyPageSize))}
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!selectedGoal) return
                  const maxPage = Math.max(0, Math.ceil(historyTotal / historyPageSize) - 1)
                  const next = Math.min(maxPage, historyPage + 1)
                  setHistoryPage(next)
                  await loadHistory(selectedGoal.id, next, historyPageSize, historyFrom, historyTo)
                }}
                style={pagerBtn}
                disabled={historyLoading || historyPage >= Math.ceil(historyTotal / historyPageSize) - 1}
              >
                Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- STYLES ---
const wrapperStyle: CSSProperties = { background: colors.bgLight, minHeight: '100dvh', padding: '20px' }
const contentStyle: CSSProperties = { maxWidth: '720px', margin: '0 auto', paddingBottom: '100px' }
const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }
const logoBoxStyle: CSSProperties = { width: '44px', height: '44px', borderRadius: '14px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const titleStyle: CSSProperties = { margin: 0, fontSize: '20px', fontWeight: 900, color: colors.primaryDark }
const subtitleStyle: CSSProperties = { margin: 0, fontSize: '12px', fontWeight: 700, color: colors.secondaryText }
const backBtnStyle: CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '12px',
  background: colors.white,
  border: `1px solid ${colors.border}`,
  color: colors.secondaryText,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const summaryCardStyle: CSSProperties = {
  background: colors.accentBlue,
  borderRadius: '18px',
  padding: '14px 16px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: colors.white,
  marginBottom: '12px',
  boxShadow: '0 8px 20px rgba(37,99,235,0.2)',
}
const summaryLabelStyle: CSSProperties = { margin: 0, opacity: 0.85, fontWeight: 900, fontSize: '11px', letterSpacing: 0.6 }
const summaryValueStyle: CSSProperties = { margin: '2px 0 0', fontWeight: 950, fontSize: '22px' }
const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 9px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.14)',
  fontSize: 11,
  fontWeight: 900,
  color: '#fff',
}

const newBtnStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: '12px',
  background: colors.primaryDark,
  color: colors.white,
  fontWeight: 950,
  padding: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  cursor: 'pointer',
  marginBottom: '12px',
}

const goalsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
}

const goalTileStyle: CSSProperties = {
  border: `1px solid ${colors.border}`,
  background: '#fff',
  borderRadius: 20,
  padding: 12,
  minHeight: 210,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  cursor: 'pointer',
}

const goalTileRingWrap: CSSProperties = {
  width: 84,
  height: 84,
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
}

const goalTileRingCenter: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
}

const goalTilePercent: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  fontWeight: 950,
  color: colors.accentBlue,
}

const goalTileName: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 14,
  fontWeight: 950,
  color: colors.primaryDark,
  lineHeight: 1.2,
}

const goalTileAmount: CSSProperties = {
  marginTop: 4,
  fontSize: 16,
  fontWeight: 950,
  color: colors.primaryDark,
}

const goalTileTarget: CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  fontWeight: 850,
  color: colors.secondaryText,
}

const goalTileBottomRow: CSSProperties = {
  marginTop: 'auto',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
}

const emptyStateStyle: CSSProperties = { background: colors.white, border: `1px dashed ${colors.border}`, borderRadius: '18px', padding: '30px', textAlign: 'center' }
const loadingCardStyle: CSSProperties = {
  marginTop: '40px',
  background: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: '14px',
  padding: '22px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  color: colors.secondaryText,
  fontWeight: 900,
}

const cardStyle: CSSProperties = { background: colors.white, border: `1px solid ${colors.border}`, borderRadius: '18px', padding: '16px' }
const goalTitleStyle: CSSProperties = { margin: 0, fontSize: '16px', fontWeight: 950, color: colors.primaryDark }
const goalMetaStyle: CSSProperties = { margin: 0, fontSize: '12px', fontWeight: 800, color: colors.secondaryText }

const completedBadgeStyle: CSSProperties = {
  background: '#ecfdf5',
  color: colors.accentGreen,
  fontSize: 10,
  fontWeight: 950,
  padding: '3px 6px',
  borderRadius: 6,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  border: '1px solid #d1fae5',
}

const dateBadgeStyle: CSSProperties = {
  background: '#eef2ff',
  color: colors.indigo,
  fontSize: 10,
  fontWeight: 950,
  padding: '3px 6px',
  borderRadius: 6,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  border: '1px solid rgba(99,102,241,0.25)',
}

const actionIconBtn: CSSProperties = { background: '#fff', border: `1px solid ${colors.border}`, color: colors.secondaryText, cursor: 'pointer', padding: 8, borderRadius: 12 }
const progressTrackStyle: CSSProperties = { height: '10px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }
const progressFillStyle: CSSProperties = { height: '100%', borderRadius: '999px', transition: 'width 0.4s ease' }

const txBtnStyle: CSSProperties = {
  border: 'none',
  borderRadius: '12px',
  padding: '12px',
  fontWeight: 950,
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  cursor: 'pointer',
}

const detailsActionGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 12,
}

const planBox: CSSProperties = {
  marginTop: 10,
  padding: 12,
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  background: 'linear-gradient(180deg, #f8fafc, #ffffff)',
}

const tinyBtnWarn: CSSProperties = {
  border: 'none',
  background: colors.warningBg,
  color: colors.warningText,
  padding: '8px 10px',
  borderRadius: 10,
  fontWeight: 950,
  fontSize: 12,
  cursor: 'pointer',
  borderColor: '#fde68a',
}

const miniChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 10px',
  borderRadius: 999,
  border: '1px solid rgba(15,23,42,0.08)',
  background: '#fff',
  fontSize: 12,
  fontWeight: 950,
}

const modalBackdropStyle: CSSProperties = { position: 'fixed', inset: 0, background: colors.modalBackdrop, zIndex: 120, display: 'grid', placeItems: 'center', padding: '16px' }
const modalCardStyle: CSSProperties = { width: '100%', maxWidth: '420px', background: colors.white, borderRadius: '20px', padding: '18px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }
const modalHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', gap: 10 }
const iconCloseBtnStyle: CSSProperties = { width: '32px', height: '32px', borderRadius: '10px', background: colors.bgLight, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const labelStyle: CSSProperties = { fontSize: '12px', fontWeight: 900, color: colors.secondaryText, marginBottom: 6, display: 'block' }
const inputStyle: CSSProperties = { width: '100%', border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '12px', fontSize: '16px', fontWeight: 900, background: colors.bgLight, outline: 'none' }
const saveBtnStyle: CSSProperties = { width: '100%', marginTop: '18px', border: 'none', borderRadius: '12px', padding: '14px', background: colors.accentBlue, color: colors.white, fontWeight: 950, cursor: 'pointer' }

const hintTiny: CSSProperties = { marginTop: 6, fontSize: 11, fontWeight: 850, color: '#94a3b8' }

const dateRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
const dateIcon: CSSProperties = { width: 44, height: 44, borderRadius: 12, border: `1px solid ${colors.border}`, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.indigo }
const dateInput: CSSProperties = { flex: 1, height: 44, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.bgLight, padding: '0 12px', fontSize: 14, fontWeight: 950, outline: 'none' }

const methodGrid: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }
const methodBtn: CSSProperties = {
  border: `1px solid ${colors.border}`,
  background: '#fff',
  padding: '12px 10px',
  borderRadius: 12,
  fontWeight: 950,
  fontSize: 13,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  color: colors.primaryDark,
}
const methodBtnActive: CSSProperties = {
  borderColor: 'rgba(37,99,235,0.40)',
  background: 'rgba(37,99,235,0.08)',
  color: colors.accentBlue,
}

const presetBtn: CSSProperties = {
  border: `1px solid ${colors.border}`,
  background: '#fff',
  padding: '8px 10px',
  borderRadius: 999,
  fontWeight: 950,
  fontSize: 12,
  cursor: 'pointer',
  color: colors.primaryDark,
}

const hintBox: CSSProperties = { padding: 14, borderRadius: 16, backgroundColor: colors.bgLight, border: `1px solid ${colors.border}`, fontSize: 14, fontWeight: 900, color: colors.secondaryText }

// History styles
const historyFilters: CSSProperties = { padding: 12, borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.bgLight, display: 'grid', gap: 10 }
const historyFilterRow: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }
const historyDateBox: CSSProperties = { background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 14, padding: 10 }
const historyDateLabel: CSSProperties = { fontSize: 11, fontWeight: 950, color: colors.secondaryText, marginBottom: 6 }
const historyDateInput: CSSProperties = { width: '100%', height: 40, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.bgLight, padding: '0 10px', fontWeight: 950, outline: 'none' }
const historySelect: CSSProperties = { flex: 1, height: 44, borderRadius: 12, border: `1px solid ${colors.border}`, background: '#fff', padding: '0 10px', fontWeight: 950, outline: 'none' }
const historySearchBtn: CSSProperties = {
  height: 44,
  borderRadius: 12,
  border: 'none',
  background: colors.primaryDark,
  color: '#fff',
  fontWeight: 950,
  padding: '0 14px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}
const historyRow: CSSProperties = { padding: 14, borderRadius: 16, background: colors.bgLight, border: `1px solid ${colors.border}` }
const historyPill: CSSProperties = { padding: '8px 12px', borderRadius: 999, border: '1px solid', fontSize: 14, fontWeight: 950, whiteSpace: 'nowrap' }
const historyPager: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14 }
const pagerBtn: CSSProperties = { border: `1px solid ${colors.border}`, background: '#fff', borderRadius: 12, padding: '10px 12px', fontWeight: 950, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, color: colors.primaryDark }

export default function GoalsPage() {
  return (
    <Suspense fallback={null}>
      <GoalsContent />
    </Suspense>
  )
}
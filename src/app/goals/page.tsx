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
  CalendarDays,
  Timer,
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
}

type Goal = {
  id: string
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  status: 'active' | 'completed'
  color: string
  icon: string
}

// Helpers
function yyyyMmDd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getBusinessDate() {
  const now = new Date()
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

function formatMoneyInputEl(n: number) {
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// --- PLAN HELPERS (ρυθμός για να πιάσεις στόχο) ---
function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
function parseYmdToDate(ymd: string) {
  // ymd: YYYY-MM-DD
  const [y, m, d] = ymd.split('-').map((v) => Number(v))
  return new Date(y, (m || 1) - 1, d || 1)
}
function monthsDiffInclusive(from: Date, to: Date) {
  const a = from.getFullYear() * 12 + from.getMonth()
  const b = to.getFullYear() * 12 + to.getMonth()
  return Math.max(1, b - a + 1)
}
function daysLeftInclusive(today: Date, target: Date) {
  const ms = endOfDay(target).getTime() - startOfDay(today).getTime()
  const days = Math.ceil(ms / 86400000)
  return Math.max(1, days)
}

function GoalsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<Goal[]>([])

  // Modal: Goal Form
  const [openGoalModal, setOpenGoalModal] = useState(false)
  const [savingGoal, setSavingGoal] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('') // YYYY-MM-DD or ''

  // Modal: Transaction (Deposit/Withdraw)
  const [openTxModal, setOpenTxModal] = useState(false)
  const [savingTx, setSavingTx] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [txAction, setTxAction] = useState<'deposit' | 'withdraw'>('deposit')
  const [txAmount, setTxAmount] = useState('')

  const loadGoals = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('store_id', storeId)
        .order('status', { ascending: true }) // active first
        .order('created_at', { ascending: false })
      if (error) throw error
      setGoals(data || [])
    } catch (e: any) {
      toast.error('Σφάλμα φόρτωσης στόχων')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    loadGoals()
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
    setTargetAmount(formatMoneyInputEl(g.target_amount))
    setTargetDate(g.target_date || '')
    setOpenGoalModal(true)
  }

  const onSaveGoal = async () => {
    if (!storeId) return toast.error('Λείπει το κατάστημα')
    if (!name.trim()) return toast.error('Βάλε όνομα στόχου')
    const parsedTarget = parseMoney(targetAmount)
    if (!parsedTarget || parsedTarget <= 0) return toast.error('Βάλε σωστό ποσό στόχου')

    // targetDate optional, but if set must be valid YYYY-MM-DD
    if (targetDate) {
      const dt = parseYmdToDate(targetDate)
      if (!Number.isFinite(dt.getTime())) return toast.error('Βάλε σωστή ημερομηνία στόχου')
    }

    setSavingGoal(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Η συνεδρία έληξε')

      const payload: any = {
        store_id: storeId,
        user_id: session.user.id,
        name: name.trim(),
        target_amount: parsedTarget,
        target_date: targetDate || null,
      }

      if (editingGoalId) {
        const { error } = await supabase.from('savings_goals').update(payload).eq('id', editingGoalId).eq('store_id', storeId)
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
      const { error } = await supabase.from('savings_goals').delete().eq('id', id).eq('store_id', storeId)
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
    setOpenTxModal(true)
  }

  const onSaveTransaction = async () => {
    if (!storeId || !selectedGoal) return

    const amount = parseMoney(txAmount)
    if (!amount || amount <= 0) return toast.error('Βάλε σωστό ποσό')

    // Πρώτο check UI επιπέδου για αποφυγή περιττού request
    if (txAction === 'withdraw' && amount > selectedGoal.current_amount) {
      return toast.error('Δεν επαρκεί το υπόλοιπο του κουμπαρά')
    }

    setSavingTx(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Η συνεδρία έληξε')

      const rawUser = session.user.user_metadata?.username || session.user.user_metadata?.full_name || session.user.email || 'Χρήστης'
      const userName = String(rawUser).split('@')[0]

      const delta = txAction === 'deposit' ? amount : -amount

      // 1. ATOMIC DB UPDATE ΜΕΣΩ RPC
      const { data: newAmount, error: goalErr } = await supabase.rpc('increment_goal_amount', {
        goal_id: selectedGoal.id,
        store_id: storeId,
        amount: delta,
      })

      if (goalErr) throw goalErr

      // 2. ΕΓΓΡΑΦΗ ΚΙΝΗΣΗΣ ΣΤΟ ΤΑΜΕΙΟ
      const dbAmount = txAction === 'deposit' ? -amount : amount
      const dbType = txAction === 'deposit' ? 'savings_deposit' : 'savings_withdrawal'
      const dbNotes =
        txAction === 'deposit' ? `Κατάθεση στον Κουμπαρά: ${selectedGoal.name}` : `Ανάληψη από Κουμπαρά: ${selectedGoal.name}`

      const { error: txErr } = await supabase.from('transactions').insert([
        {
          store_id: storeId,
          goal_id: selectedGoal.id,
          user_id: session.user.id,
          created_by_name: userName,
          type: dbType,
          amount: dbAmount,
          method: 'Μετρητά',
          category: 'Αποταμίευση',
          notes: dbNotes,
          date: getBusinessDate(),
        },
      ])

      if (txErr) throw txErr

      toast.success(txAction === 'deposit' ? 'Η κατάθεση ολοκληρώθηκε!' : 'Η ανάληψη ολοκληρώθηκε!')

      setOpenTxModal(false)

      // 3. OPTIMISTIC UI UPDATE
      setGoals((prev) =>
        prev.map((g) => {
          if (g.id === selectedGoal.id) {
            const updatedAmount = Number(newAmount)
            // Σεβόμαστε τον κανόνα No-Reopen και στο UI
            const finalStatus =
              g.status === 'completed' && updatedAmount < g.target_amount
                ? 'completed'
                : updatedAmount >= g.target_amount
                  ? 'completed'
                  : 'active'

            return { ...g, current_amount: updatedAmount, status: finalStatus }
          }
          return g
        })
      )
    } catch (e: any) {
      toast.error(e.message || 'Σφάλμα συναλλαγής')
    } finally {
      setSavingTx(false)
    }
  }

  // UI Stats
  const totalSaved = useMemo(() => goals.reduce((acc, g) => acc + Number(g.current_amount), 0), [goals])

  const computePlan = useCallback((g: Goal) => {
    const remaining = Math.max(0, Number(g.target_amount || 0) - Number(g.current_amount || 0))
    const completed = g.status === 'completed' || remaining <= 0

    if (!g.target_date) {
      return { remaining, completed, hasTargetDate: false, daysLeft: null as number | null, monthsLeft: null as number | null, perDay: null as number | null, perMonth: null as number | null }
    }

    const today = new Date()
    const target = parseYmdToDate(g.target_date)
    const daysLeft = daysLeftInclusive(today, target)
    const monthsLeft = monthsDiffInclusive(today, target)

    const perDay = completed ? null : remaining / daysLeft
    const perMonth = completed ? null : remaining / monthsLeft

    return { remaining, completed, hasTargetDate: true, daysLeft, monthsLeft, perDay, perMonth }
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
          <div>
            <p style={summaryLabelStyle}>ΣΥΝΟΛΙΚΗ ΑΠΟΤΑΜΙΕΥΣΗ</p>
            <p style={summaryValueStyle}>{toMoney(totalSaved)}</p>
          </div>
          <Target size={32} opacity={0.2} />
        </div>

        <button type="button" style={newBtnStyle} onClick={startCreate}>
          <PlusCircle size={18} /> Νέος Στόχος
        </button>

        {/* Goals List */}
        {goals.length === 0 ? (
          <div style={emptyStateStyle}>
            <PiggyBank size={36} color="#cbd5e1" />
            <p style={{ margin: '8px 0 0', fontWeight: 800, color: colors.secondaryText }}>Δεν έχεις δημιουργήσει στόχους.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {goals.map((g) => {
              const progress = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) || 0
              const isCompleted = g.status === 'completed' || g.current_amount >= g.target_amount

              const plan = computePlan(g)

              return (
                <article key={g.id} style={{ ...cardStyle, opacity: isCompleted ? 0.86 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <h3 style={goalTitleStyle}>{g.name}</h3>
                        {isCompleted && (
                          <span style={completedBadgeStyle}>
                            <CheckCircle2 size={12} /> ΟΛΟΚΛΗΡΩΘΗΚΕ
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <p style={goalMetaStyle}>Στόχος: {toMoney(g.target_amount)}</p>
                        {g.target_date ? (
                          <span style={datePill}>
                            <CalendarDays size={14} /> έως {g.target_date}
                          </span>
                        ) : (
                          <span style={datePillMuted}>
                            <CalendarDays size={14} /> χωρίς ημερομηνία
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => startEdit(g)} style={actionIconBtn} aria-label="edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => onDeleteGoal(g.id)} style={actionIconBtn} aria-label="delete">
                        <Trash2 size={14} color={colors.accentRed} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 900, color: colors.primaryDark }}>{toMoney(g.current_amount)}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: colors.accentBlue }}>{progress}%</span>
                    </div>
                    <div style={progressTrackStyle}>
                      <div
                        style={{
                          ...progressFillStyle,
                          width: `${progress}%`,
                          background: isCompleted ? colors.accentGreen : colors.accentBlue,
                        }}
                      />
                    </div>
                  </div>

                  {/* ✅ PLAN / ΡΥΘΜΟΣ */}
                  <div style={planBox}>
                    <div style={planTitleRow}>
                      <div style={planTitleLeft}>
                        <Timer size={16} />
                        <div style={planTitleText}>ΡΥΘΜΟΣ ΓΙΑ ΝΑ ΠΙΑΣΕΙΣ ΤΟΝ ΣΤΟΧΟ</div>
                      </div>
                      <div style={planRightPill}>Υπόλοιπο: {toMoney(plan.remaining)}</div>
                    </div>

                    {plan.completed ? (
                      <div style={planDoneText}>Στόχος επιτεύχθηκε 🎉</div>
                    ) : !plan.hasTargetDate ? (
                      <div style={planHintText}>Βάλε ημερομηνία στόχου (edit) για να σου βγάζω ποσό ανά ημέρα & μήνα.</div>
                    ) : (
                      <>
                        <div style={planGrid}>
                          <div style={planStatCard}>
                            <div style={planStatLabel}>Ανά ημέρα</div>
                            <div style={planStatValue}>{toMoney(plan.perDay || 0)}</div>
                          </div>
                          <div style={planStatCard}>
                            <div style={planStatLabel}>Ανά μήνα</div>
                            <div style={planStatValue}>{toMoney(plan.perMonth || 0)}</div>
                          </div>
                        </div>

                        <div style={planMetaLine}>
                          Υπόλοιπο: <b>{toMoney(plan.remaining)}</b> • Μέρες: <b>{plan.daysLeft}</b> • Μήνες: <b>{plan.monthsLeft}</b>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                    <button
                      onClick={() => startTransaction(g, 'deposit')}
                      style={{ ...txBtnStyle, background: colors.primaryDark, color: 'white' }}
                    >
                      <TrendingUp size={16} /> Κατάθεση
                    </button>
                    <button
                      onClick={() => startTransaction(g, 'withdraw')}
                      disabled={g.current_amount <= 0}
                      style={{
                        ...txBtnStyle,
                        background: '#f1f5f9',
                        color: colors.primaryDark,
                        opacity: g.current_amount <= 0 ? 0.5 : 1,
                      }}
                    >
                      <TrendingDown size={16} /> Ανάληψη
                    </button>
                  </div>
                </article>
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
              <button style={iconCloseBtnStyle} onClick={() => setOpenGoalModal(false)} aria-label="close">
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

              {/* ✅ ΝΕΟ: Ημερομηνία στόχου */}
              <div>
                <label style={labelStyle}>Ημερομηνία Στόχου (προαιρετικό)</label>
                <input
                  style={inputStyle}
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
                <div style={smallHint}>
                  Αν βάλεις ημερομηνία, θα σου δείχνει “Ανά ημέρα” και “Ανά μήνα” για να πιάσεις τον στόχο.
                </div>
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
              <button style={iconCloseBtnStyle} onClick={() => setOpenTxModal(false)} aria-label="close">
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 12, background: colors.bgLight, borderRadius: 12, marginBottom: 14 }}>
              <p style={{ margin: 0, fontWeight: 900, color: colors.primaryDark }}>{selectedGoal.name}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700, color: colors.secondaryText }}>
                Διαθέσιμο Υπόλοιπο: {toMoney(selectedGoal.current_amount)}
              </p>
            </div>

            <label style={labelStyle}>Ποσό {txAction === 'deposit' ? 'Κατάθεσης' : 'Ανάληψης'}</label>
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

            <p style={{ fontSize: 11, fontWeight: 800, color: colors.secondaryText, marginTop: 8 }}>
              {txAction === 'deposit'
                ? '* Το ποσό θα αφαιρεθεί από το ταμείο της ημέρας και θα μπει στον κουμπαρά.'
                : '* Το ποσό θα επιστρέψει στο ταμείο της ημέρας.'}
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
    </div>
  )
}

// --- STYLES ---
const wrapperStyle: CSSProperties = { background: colors.bgLight, minHeight: '100dvh', padding: '20px' }
const contentStyle: CSSProperties = { maxWidth: '640px', margin: '0 auto', paddingBottom: '100px' }
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
  borderRadius: '20px',
  padding: '20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: colors.white,
  marginBottom: '16px',
  boxShadow: '0 10px 25px rgba(37,99,235,0.2)',
}
const summaryLabelStyle: CSSProperties = { margin: 0, opacity: 0.8, fontWeight: 800, fontSize: '11px', letterSpacing: 0.5 }
const summaryValueStyle: CSSProperties = { margin: '4px 0 0', fontWeight: 900, fontSize: '26px' }

const newBtnStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: '14px',
  background: colors.primaryDark,
  color: colors.white,
  fontWeight: 900,
  padding: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  cursor: 'pointer',
  marginBottom: '16px',
}

const emptyStateStyle: CSSProperties = { background: colors.white, border: `1px dashed ${colors.border}`, borderRadius: '18px', padding: '30px', textAlign: 'center' }
const loadingCardStyle: CSSProperties = { marginTop: '40px', background: colors.white, border: `1px solid ${colors.border}`, borderRadius: '14px', padding: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: colors.secondaryText, fontWeight: 800 }

const cardStyle: CSSProperties = { background: colors.white, border: `1px solid ${colors.border}`, borderRadius: '18px', padding: '16px', transition: 'all 0.2s' }
const goalTitleStyle: CSSProperties = { margin: 0, fontSize: '16px', fontWeight: 900, color: colors.primaryDark }
const goalMetaStyle: CSSProperties = { margin: 0, fontSize: '12px', fontWeight: 700, color: colors.secondaryText }
const completedBadgeStyle: CSSProperties = { background: '#ecfdf5', color: colors.accentGreen, fontSize: 10, fontWeight: 900, padding: '3px 6px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }

const datePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#f1f5ff',
  color: colors.primaryDark,
  fontSize: 12,
  fontWeight: 900,
}
const datePillMuted: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#f8fafc',
  color: colors.secondaryText,
  fontSize: 12,
  fontWeight: 900,
}

const actionIconBtn: CSSProperties = { background: 'transparent', border: 'none', color: colors.secondaryText, cursor: 'pointer', padding: 4 }
const progressTrackStyle: CSSProperties = { height: '10px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }
const progressFillStyle: CSSProperties = { height: '100%', borderRadius: '999px', transition: 'width 0.4s ease' }

const txBtnStyle: CSSProperties = { border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 900, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }

const planBox: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 14,
  background: 'linear-gradient(180deg, #f8fafc, #ffffff)',
  border: `1px solid ${colors.border}`,
}
const planTitleRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }
const planTitleLeft: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const planTitleText: CSSProperties = { fontSize: 12, fontWeight: 950, color: colors.primaryDark, letterSpacing: 0.3 }
const planRightPill: CSSProperties = {
  fontSize: 12,
  fontWeight: 950,
  color: colors.primaryDark,
  padding: '6px 10px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  whiteSpace: 'nowrap',
}

const planGrid: CSSProperties = { marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }
const planStatCard: CSSProperties = { padding: 10, borderRadius: 12, border: `1px solid ${colors.border}`, background: '#fff' }
const planStatLabel: CSSProperties = { fontSize: 11, fontWeight: 900, color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.4 }
const planStatValue: CSSProperties = { marginTop: 6, fontSize: 16, fontWeight: 950, color: colors.accentBlue }
const planMetaLine: CSSProperties = { marginTop: 10, fontSize: 12, fontWeight: 800, color: colors.secondaryText }
const planHintText: CSSProperties = { marginTop: 10, fontSize: 12, fontWeight: 850, color: colors.secondaryText }
const planDoneText: CSSProperties = { marginTop: 10, fontSize: 13, fontWeight: 950, color: colors.accentGreen }

const smallHint: CSSProperties = { marginTop: 6, fontSize: 11, fontWeight: 750, color: colors.secondaryText }

const modalBackdropStyle: CSSProperties = { position: 'fixed', inset: 0, background: colors.modalBackdrop, zIndex: 120, display: 'grid', placeItems: 'center', padding: '16px' }
const modalCardStyle: CSSProperties = { width: '100%', maxWidth: '400px', background: colors.white, borderRadius: '20px', padding: '18px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }
const modalHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }
const iconCloseBtnStyle: CSSProperties = { width: '32px', height: '32px', borderRadius: '10px', background: colors.bgLight, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const labelStyle: CSSProperties = { fontSize: '12px', fontWeight: 800, color: colors.secondaryText, marginBottom: 4, display: 'block' }
const inputStyle: CSSProperties = { width: '100%', border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '12px', fontSize: '16px', fontWeight: 800, background: colors.bgLight, outline: 'none' }
const saveBtnStyle: CSSProperties = { width: '100%', marginTop: '18px', border: 'none', borderRadius: '12px', padding: '14px', background: colors.accentBlue, color: colors.white, fontWeight: 900, cursor: 'pointer' }

export default function GoalsPage() {
  return (
    <Suspense fallback={null}>
      <GoalsContent />
    </Suspense>
  )
}
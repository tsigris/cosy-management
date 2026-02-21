'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Bell, X, AlertTriangle, AlertOctagon, Info, Banknote, Landmark, PlusCircle } from 'lucide-react'

type PaymentMethod = 'Μετρητά' | 'Τράπεζα'

type InstallmentRow = {
  id: string
  settlement_id: string
  installment_number: number
  due_date: string
  amount: number
  status: string | null
  transaction_id: string | null
  store_id?: string | null
}

type SettlementRow = {
  id: string
  name: string
  type?: 'settlement' | 'loan' | null
  rf_code: string | null
}

type DbNotification = {
  id: string
  title: string
  message: string | null
  severity: 'info' | 'warning' | 'danger' | string
  due_date: string | null
  show_from: string | null
  show_until: string | null
  dismissed_at: string | null
  resolved_at: string | null
  kind: string
}

type StaffRow = {
  id: string
  name: string | null
  start_date: string | null
}

type UiNotification =
  | {
  notificationKey: string
      source: 'installment'
      severity: 'warning' | 'danger'
      title: string
      message: string
      dueDate: string
      daysText: string
      installment: InstallmentRow
      settlement: SettlementRow
    }
  | {
      notificationKey: string
      source: 'custom'
      severity: 'info' | 'warning' | 'danger'
      title: string
      message: string
      dueDate?: string | null
      row: DbNotification
    }
  | {
      notificationKey: string
      source: 'employee_pay'
      severity: 'warning' | 'danger'
      title: string
      message: string
      dueDate: string
      employee: { id: string; name: string }
      daysLeft: number
    }

const colors = {
  primaryDark: '#0f172a',
  secondaryText: '#64748b',
  border: '#e2e8f0',
  bgLight: '#f8fafc',
  white: '#ffffff',
  accentBlue: '#6366f1',
  accentGreen: '#10b981',
  accentRed: '#f43f5e',
  warningBg: '#fffbeb',
  warningText: '#92400e',
  dangerBg: '#fff1f2',
  dangerText: '#be123c',
}

function yyyyMmDd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysDiff(fromDate: string, toDate: string) {
  const a = new Date(`${fromDate}T12:00:00`)
  const b = new Date(`${toDate}T12:00:00`)
  const ms = a.getTime() - b.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function formatDateGr(dateStr: string) {
  const p = dateStr.split('-')
  if (p.length !== 3) return dateStr
  return `${p[2]}-${p[1]}-${p[0]}`
}

function money(n: any) {
  return (Number(n) || 0).toLocaleString('el-GR', { minimumFractionDigits: 2 })
}

const getBusinessDate = () => {
  const now = new Date()
  if (now.getHours() < 7) now.setDate(now.getDate() - 1)
  return yyyyMmDd(now)
}

// ✅ Correct next pay date:
// - payday = day-of-month from start_date
// - if not passed yet => this month
// - else => next month
// - clamp for months with fewer days (e.g. 31 -> 30/28)
function getNextMonthlyPayDate(startDateStr: string, todayStr: string) {
  const today = new Date(`${todayStr}T00:00:00`)
  const start = new Date(`${startDateStr}T00:00:00`)
  if (isNaN(start.getTime()) || isNaN(today.getTime())) return null

  const payDay = start.getDate()

  const lastDayOfMonth = (y: number, mZeroBased: number) => new Date(y, mZeroBased + 1, 0).getDate()

  // candidate: this month
  const y = today.getFullYear()
  const m = today.getMonth()

  const clampDayThisMonth = Math.min(payDay, lastDayOfMonth(y, m))
  let candidate = new Date(y, m, clampDayThisMonth)

  // if candidate already passed => next month
  if (candidate < today) {
    const nextM = m + 1
    const ny = nextM > 11 ? y + 1 : y
    const nm = nextM % 12
    const clampDayNextMonth = Math.min(payDay, lastDayOfMonth(ny, nm))
    candidate = new Date(ny, nm, clampDayNextMonth)
  }

  return yyyyMmDd(candidate)
}

export default function NotificationsBell({ storeId, onUpdate }: { storeId: string; onUpdate?: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)

  const [installments, setInstallments] = useState<InstallmentRow[]>([])
  const [settlementsMap, setSettlementsMap] = useState<Record<string, SettlementRow>>({})
  const [customRows, setCustomRows] = useState<DbNotification[]>([])
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set())
  const [dismissalsLoaded, setDismissalsLoaded] = useState(false)

  // ✅ staff for payroll notifications
  const [staff, setStaff] = useState<StaffRow[]>([])

  const [payOpen, setPayOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Μετρητά')
  const [selectedInst, setSelectedInst] = useState<InstallmentRow | null>(null)
  const [selectedSet, setSelectedSet] = useState<SettlementRow | null>(null)
  const [savingPayment, setSavingPayment] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [customDueDate, setCustomDueDate] = useState(getBusinessDate())

  const todayStr = useMemo(() => getBusinessDate(), [])

  const loadNotifications = useCallback(async () => {
    if (!storeId || !sessionUserId) return
    setLoading(true)
    setDismissalsLoaded(false)
    setInstallments([])
    setSettlementsMap({})
    setCustomRows([])
    setStaff([])
    try {
      const min = yyyyMmDd(new Date(Date.now() - 60 * 24 * 3600 * 1000))
      const max = yyyyMmDd(new Date(Date.now() + 14 * 24 * 3600 * 1000))

      // 1) installments
      const { data: inst, error: instErr } = await supabase
        .from('installments')
        .select('id, settlement_id, installment_number, due_date, amount, status, transaction_id, store_id')
        .eq('store_id', storeId)
        .gte('due_date', min)
        .lte('due_date', max)

      if (instErr) throw instErr

      const pending = (inst || []).filter((r: any) => String(r.status || 'pending').toLowerCase() === 'pending')

      const settlementIds = Array.from(new Set(pending.map((r: any) => String(r.settlement_id))))
      const setMap: Record<string, SettlementRow> = {}

      if (settlementIds.length) {
        const { data: sets, error: setsErr } = await supabase
          .from('settlements')
          .select('id, name, type, rf_code')
          .eq('store_id', storeId)
          .in('id', settlementIds)

        if (setsErr) throw setsErr
        for (const s of (sets || []) as any[]) setMap[String(s.id)] = s as SettlementRow
      }

      setInstallments(pending as any)
      setSettlementsMap(setMap)

      // 2) custom notifications
      const { data: custom, error: customErr } = await supabase
        .from('notifications')
        .select('id, title, message, severity, due_date, show_from, show_until, dismissed_at, resolved_at, kind')
        .eq('store_id', storeId)
        .is('dismissed_at', null)

      if (customErr) {
        console.warn(customErr)
        setCustomRows([])
      } else {
        setCustomRows((custom || []) as any)
      }

      // 3) staff payment reminders
      const { data: staffRows, error: staffErr } = await supabase
        .from('fixed_assets')
        .select('id, name, start_date')
        .eq('store_id', storeId)
        .eq('sub_category', 'staff')
        .eq('is_active', true)
        .order('name')

      if (staffErr) {
        console.warn(staffErr)
        setStaff([])
      } else {
        setStaff((staffRows || []) as any)
      }

      // 4) per-user dismissals
      const { data: dismissalRows, error: dismissErr } = await supabase
        .from('notification_dismissals')
        .select('notification_key')
        .eq('store_id', storeId)
        .eq('user_id', sessionUserId)

      if (dismissErr) {
        console.warn(dismissErr)
        setDismissedKeys(new Set())
        setDismissalsLoaded(true)
      } else {
        setDismissedKeys(new Set((dismissalRows || []).map((r: any) => String(r.notification_key))))
        setDismissalsLoaded(true)
      }
      setHasLoaded(true)
    } catch (e: any) {
      console.error(e)
      toast.error('Σφάλμα φόρτωσης ειδοποιήσεων')
      setDismissalsLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [storeId, sessionUserId])

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (mounted) setSessionUserId(session?.user?.id ?? null)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setSessionUserId(session?.user?.id ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!storeId || !sessionUserId) return
    setHasLoaded(false)
    loadNotifications()
  }, [storeId, sessionUserId, loadNotifications])

  useEffect(() => {
    setHydrated(true)
  }, [])

  const installmentNotifications: UiNotification[] = useMemo(() => {
    const out: UiNotification[] = []

    for (const inst of installments) {
      const due = String(inst.due_date)
      const setl = settlementsMap[String(inst.settlement_id)]
      if (!setl) continue

      const dueMinusToday = daysDiff(due, todayStr)

      let severity: 'warning' | 'danger' | null = null
      let daysText = ''

      if (dueMinusToday >= 0 && dueMinusToday <= 3) {
        severity = 'warning'
        daysText = dueMinusToday === 0 ? 'ΣΗΜΕΡΑ ΠΛΗΡΩΜΗ' : `σε ${dueMinusToday} μέρες`
      } else if (dueMinusToday <= -3) {
        severity = 'danger'
        daysText = `${Math.abs(dueMinusToday)} μέρες σε καθυστέρηση`
      }

      if (!severity) continue

      const isLoan = setl.type === 'loan'
      const title = isLoan ? 'Δόση Δανείου' : 'Δόση Ρύθμισης'
      const message = `${setl.name}${setl.rf_code ? ` (RF: ${setl.rf_code})` : ''} • Δόση #${inst.installment_number} • ${money(inst.amount)}€ • ${daysText}`
      const phase = severity
      const notificationKey = `inst:${inst.id}:${phase}`

      out.push({
        notificationKey,
        source: 'installment',
        severity,
        title,
        message,
        dueDate: due,
        daysText,
        installment: inst,
        settlement: setl,
      })
    }

    return out.sort((a, b) => {
      const sevA = a.severity === 'danger' ? 0 : 1
      const sevB = b.severity === 'danger' ? 0 : 1
      if (sevA !== sevB) return sevA - sevB
      return String(a.dueDate).localeCompare(String(b.dueDate))
    })
  }, [installments, settlementsMap, todayStr])

  const employeePayNotifications: UiNotification[] = useMemo(() => {
    const out: UiNotification[] = []

    for (const emp of staff) {
      const name = String(emp.name || 'Υπάλληλος').toUpperCase()
      if (!emp.start_date) continue

      const dueDate = getNextMonthlyPayDate(emp.start_date, todayStr)
      if (!dueDate) continue

      const daysLeft = daysDiff(dueDate, todayStr) // due - today

      let severity: 'warning' | 'danger' | null = null
      let msg = ''

      if (daysLeft === 0) {
        severity = 'danger'
        msg = 'ΣΗΜΕΡΑ ΠΛΗΡΩΜΗ'
      } else if (daysLeft >= 1 && daysLeft <= 3) {
        severity = 'warning'
        msg = `Πληρωμή σε ${daysLeft} μέρες • ${name}`
      }

      if (!severity) continue

      const notificationKey = `empPay:${emp.id}:${dueDate}:${severity}`

      out.push({
        notificationKey,
        source: 'employee_pay',
        severity,
        title: 'Πληρωμή Υπαλλήλου',
        message: msg,
        dueDate,
        employee: { id: emp.id, name },
        daysLeft,
      })
    }

    return out.sort((a, b) => {
      const sevA = a.severity === 'danger' ? 0 : 1
      const sevB = b.severity === 'danger' ? 0 : 1
      if (sevA !== sevB) return sevA - sevB
      return String(a.dueDate).localeCompare(String(b.dueDate))
    })
  }, [staff, todayStr])

  const customNotifications: UiNotification[] = useMemo(() => {
    const out: UiNotification[] = []

    for (const n of customRows) {
      const showFrom = n.show_from
      const showUntil = n.show_until
      if (showFrom && todayStr < showFrom) continue
      if (showUntil && todayStr > showUntil) continue

      out.push({
        notificationKey: `custom:${n.id}`,
        source: 'custom',
        severity: (n.severity as any) || 'info',
        title: n.title,
        message: n.message || '',
        dueDate: n.due_date,
        row: n,
      })
    }

    return out
  }, [customRows, todayStr])

  const allNotifications = useMemo(() => {
    return [...installmentNotifications, ...employeePayNotifications, ...customNotifications]
  }, [installmentNotifications, employeePayNotifications, customNotifications])

  const visibleNotifications = useMemo(() => {
    return allNotifications.filter((n) => !dismissedKeys.has(n.notificationKey))
  }, [allNotifications, dismissedKeys])

  const dangerCount = useMemo(() => visibleNotifications.filter((n) => n.severity === 'danger').length, [visibleNotifications])
  const warningCount = useMemo(() => visibleNotifications.filter((n) => n.severity === 'warning').length, [visibleNotifications])
  const badgeCount = dangerCount + warningCount
  const readyForBadge = hydrated && dismissalsLoaded && hasLoaded && !loading

  const bellColor = useMemo(() => {
    if (dangerCount > 0) return colors.accentRed
    if (warningCount > 0) return '#f59e0b'
    return colors.primaryDark
  }, [dangerCount, warningCount])

  const openPayModal = (inst: InstallmentRow, setl: SettlementRow) => {
    setSelectedInst(inst)
    setSelectedSet(setl)
    setPaymentMethod('Μετρητά')
    setPayOpen(true)
  }

  const onConfirmPayment = async () => {
    if (!storeId) return toast.error('Λείπει store')
    if (!selectedInst || !selectedSet) return toast.error('Δεν βρέθηκε δόση')

    setSavingPayment(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Η συνεδρία έληξε. Συνδέσου ξανά.')

      const raw = session.user.user_metadata?.username || session.user.user_metadata?.full_name || session.user.email || 'Χρήστης'
      const userName = String(raw).includes('@') ? String(raw).split('@')[0] : String(raw)

      const amount = Math.abs(Number(selectedInst.amount || 0))
      if (!amount) throw new Error('Μη έγκυρο ποσό')

      const today = getBusinessDate()
      const notes = `Πληρωμή Δόσης #${selectedInst.installment_number}: ${selectedSet.name}${selectedSet.rf_code ? ` (RF: ${selectedSet.rf_code})` : ''}`

      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .insert([
          {
            store_id: storeId,
            user_id: session.user.id,
            created_by_name: userName,
            type: 'expense',
            amount: -amount,
            method: paymentMethod,
            category: 'Λοιπά',
            notes,
            date: today,
          },
        ])
        .select('id')
        .single()

      if (txErr) throw txErr

      const { error: upErr } = await supabase
        .from('installments')
        .update({ status: 'paid', transaction_id: tx.id })
        .eq('id', selectedInst.id)
        .eq('store_id', storeId)

      if (upErr) throw upErr

      toast.success('Η δόση πληρώθηκε')
      setPayOpen(false)
      setSelectedInst(null)
      setSelectedSet(null)

      await loadNotifications()
      if (onUpdate) onUpdate()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Αποτυχία πληρωμής')
    } finally {
      setSavingPayment(false)
    }
  }

  const dismissAny = async (notificationKey: string) => {
    try {
      if (!storeId || !sessionUserId) {
        toast.error('Δεν βρέθηκε χρήστης')
        return
      }

      const target = allNotifications.find((n) => n.notificationKey === notificationKey)
      if (!target) return

      const { error } = await supabase
        .from('notification_dismissals')
        .upsert(
          [{
            store_id: storeId,
            user_id: sessionUserId,
            notification_key: target.notificationKey,
            dismissed_at: new Date().toISOString(),
          }],
          { onConflict: 'store_id,user_id,notification_key' }
        )

      if (error) {
        toast.error('Σφάλμα απόκρυψης')
        return
      }

      setDismissedKeys((prev) => new Set(prev).add(target.notificationKey))
    } catch (err) {
      toast.error('Σφάλμα απόκρυψης')
      console.error(err)
    }
  }

  const onSaveCustomNotification = async () => {
    if (!storeId) return toast.error('Λείπει το κατάστημα')
    if (!customTitle.trim()) return toast.error('Βάλε τίτλο υπενθύμισης')

    setSavingCustom(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Δεν βρέθηκε session')

      const { error } = await supabase.from('notifications').insert([{
        store_id: storeId,
        user_id: session.user.id,
        title: customTitle.trim(),
        message: customMessage.trim() || null,
        due_date: customDueDate,
        severity: 'info',
        kind: 'general'
      }])

      if (error) throw error

      toast.success('Η υπενθύμιση προστέθηκε!')
      setAddOpen(false)
      setCustomTitle('')
      setCustomMessage('')
      await loadNotifications()
    } catch (e: any) {
      toast.error(e.message || 'Αποτυχία προσθήκης')
    } finally {
      setSavingCustom(false)
    }
  }

  const iconFor = (sev: string) => {
    if (sev === 'danger') return <AlertOctagon size={16} />
    if (sev === 'warning') return <AlertTriangle size={16} />
    return <Info size={16} />
  }

  const pillStyleFor = (sev: string) => {
    if (sev === 'danger') return { background: colors.dangerBg, color: colors.dangerText, borderColor: '#fecdd3' }
    if (sev === 'warning') return { background: colors.warningBg, color: colors.warningText, borderColor: '#fde68a' }
    return { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }
  }

  const payEmployeeHref = (id: string, name: string) => {
    const n = encodeURIComponent(name)
    return `/pay-employee?id=${id}&name=${n}&store=${storeId}`
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => {
          if (!open && !hasLoaded && !loading) {
            loadNotifications()
          }
          setOpen((v) => !v)
        }}
        style={{
          position: 'relative',
          background: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: bellColor,
        }}
        title="Ειδοποιήσεις"
      >
        <Bell size={18} />
        {readyForBadge && badgeCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              background: colors.accentRed,
              color: 'white',
              fontWeight: 900,
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 999,
              border: '2px solid white',
              lineHeight: '14px',
            }}
          >
            {badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.45)',
            zIndex: 200,
            display: 'grid',
            placeItems: 'start center',
            padding: 14,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 640,
              marginTop: 60,
              background: colors.white,
              borderRadius: 18,
              border: `1px solid ${colors.border}`,
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                background: colors.bgLight,
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 900, color: colors.primaryDark }}>Ειδοποιήσεις</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: colors.secondaryText }}>
                    {dangerCount} κόκκινες • {warningCount} κίτρινες
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPayOpen(false)
                    setAddOpen(true)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px', borderRadius: 10,
                    background: '#eef2ff', color: colors.accentBlue, border: '1px solid #c7d2fe',
                    fontWeight: 900, fontSize: 12, cursor: 'pointer'
                  }}
                >
                  <PlusCircle size={14} /> Νέα
                </button>
              </div>

              <button
                onClick={() => setOpen(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  background: colors.white,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 14 }}>
              {loading ? (
                <div style={{ padding: 18, textAlign: 'center', color: colors.secondaryText, fontWeight: 800 }}>Φόρτωση…</div>
              ) : visibleNotifications.length === 0 ? (
                <div style={{ padding: 18, textAlign: 'center', color: colors.secondaryText, fontWeight: 800 }}>Δεν υπάρχουν ειδοποιήσεις</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {visibleNotifications.map((n) => (
                    <div
                      key={n.notificationKey}
                      style={{
                        position: 'relative',
                        border: `1px solid ${colors.border}`,
                        borderRadius: 14,
                        padding: 12,
                        background: 'white',
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          dismissAny(n.notificationKey)
                        }}
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          width: 34,
                          height: 34,
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          color: '#64748b',
                          cursor: 'pointer',
                          fontWeight: 900,
                          fontSize: 20,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          zIndex: 10,
                        }}
                      >
                        ×
                      </button>

                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                gap: 6,
                                alignItems: 'center',
                                padding: '4px 8px',
                                borderRadius: 999,
                                border: '1px solid',
                                fontSize: 11,
                                fontWeight: 900,
                                ...pillStyleFor(n.severity),
                              }}
                            >
                              {iconFor(n.severity)}
                              {n.severity === 'danger' ? 'ΚΑΘΥΣΤΕΡΗΣΗ' : n.severity === 'warning' ? 'ΠΛΗΣΙΑΖΕΙ' : 'INFO'}
                            </span>

                            <div style={{ fontWeight: 900, color: colors.primaryDark }}>{n.title}</div>
                          </div>

                          <div style={{ marginTop: 6, color: colors.secondaryText, fontWeight: 800, fontSize: 12 }}>
                            {n.message}
                          </div>

                          {('dueDate' in n && n.dueDate) ? (
                            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 900,
                                  background: colors.bgLight,
                                  border: `1px solid ${colors.border}`,
                                  padding: '6px 10px',
                                  borderRadius: 12,
                                  color: colors.primaryDark,
                                }}
                              >
                                Ημ/νία: {formatDateGr(String(n.dueDate))}
                              </span>
                            </div>
                          ) : null}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
                          {n.source === 'installment' ? (
                            <button
                              onClick={() => openPayModal(n.installment, n.settlement)}
                              style={{
                                border: 'none',
                                borderRadius: 12,
                                padding: '10px 10px',
                                fontWeight: 900,
                                cursor: 'pointer',
                                background: colors.accentGreen,
                                color: 'white',
                              }}
                            >
                              Πληρωμή
                            </button>
                          ) : n.source === 'employee_pay' ? (
                            <a
                              href={payEmployeeHref(n.employee.id, n.employee.name)}
                              style={{
                                textDecoration: 'none',
                                borderRadius: 12,
                                padding: '10px 10px',
                                fontWeight: 900,
                                cursor: 'pointer',
                                background: colors.accentGreen,
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                              }}
                            >
                              <Banknote size={16} /> ΠΛΗΡΩΜΗ
                            </a>
                          ) : (
                            <button
                              onClick={() => dismissAny(n.notificationKey)}
                              style={{
                                border: `1px solid ${colors.border}`,
                                borderRadius: 12,
                                padding: '10px 10px',
                                fontWeight: 900,
                                cursor: 'pointer',
                                background: colors.white,
                                color: colors.primaryDark,
                              }}
                            >
                              Απόκρυψη
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pay modal */}
            {payOpen && selectedInst && selectedSet && (
              <div
                onClick={() => !savingPayment && setPayOpen(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(2,6,23,0.6)',
                  zIndex: 260,
                  display: 'grid',
                  placeItems: 'center',
                  padding: 16,
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    maxWidth: 520,
                    background: colors.white,
                    borderRadius: 18,
                    border: `1px solid ${colors.border}`,
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 900, color: colors.primaryDark }}>Πληρωμή Δόσης</div>
                    <button
                      disabled={savingPayment}
                      onClick={() => setPayOpen(false)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 12,
                        border: `1px solid ${colors.border}`,
                        background: colors.white,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ marginTop: 10, padding: 12, borderRadius: 14, border: `1px solid ${colors.border}`, background: colors.bgLight }}>
                    <div style={{ fontWeight: 900, color: colors.primaryDark }}>{selectedSet.name}</div>
                    <div style={{ marginTop: 4, fontWeight: 800, color: colors.secondaryText, fontSize: 12 }}>
                      Δόση #{selectedInst.installment_number} • {money(selectedInst.amount)}€ • Λήξη: {formatDateGr(selectedInst.due_date)}
                    </div>
                  </div>

                  <div style={{ marginTop: 12, fontWeight: 900, color: colors.secondaryText, fontSize: 12 }}>Τρόπος πληρωμής</div>

                  <div
                    style={{
                      marginTop: 8,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 14,
                      background: colors.bgLight,
                      padding: 4,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 6,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Μετρητά')}
                      style={{
                        border: 'none',
                        borderRadius: 12,
                        padding: 10,
                        fontWeight: 900,
                        cursor: 'pointer',
                        background: paymentMethod === 'Μετρητά' ? colors.white : 'transparent',
                        boxShadow: paymentMethod === 'Μετρητά' ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
                        color: colors.primaryDark,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <Banknote size={16} /> Μετρητά
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Τράπεζα')}
                      style={{
                        border: 'none',
                        borderRadius: 12,
                        padding: 10,
                        fontWeight: 900,
                        cursor: 'pointer',
                        background: paymentMethod === 'Τράπεζα' ? colors.white : 'transparent',
                        boxShadow: paymentMethod === 'Τράπεζα' ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
                        color: colors.primaryDark,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <Landmark size={16} /> Τράπεζα
                    </button>
                  </div>

                  <button
                    onClick={onConfirmPayment}
                    disabled={savingPayment}
                    style={{
                      width: '100%',
                      marginTop: 14,
                      border: 'none',
                      borderRadius: 14,
                      padding: 12,
                      fontWeight: 900,
                      cursor: 'pointer',
                      background: colors.accentGreen,
                      color: 'white',
                    }}
                  >
                    {savingPayment ? 'Καταχώρηση…' : 'Ολοκλήρωση Πληρωμής'}
                  </button>
                </div>
              </div>
            )}

            {/* Add Custom Notification Modal */}
            {addOpen && (
              <div
                onClick={() => !savingCustom && setAddOpen(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', zIndex: 260, display: 'grid', placeItems: 'center', padding: 16 }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: '100%', maxWidth: 400, background: colors.white, borderRadius: 18, border: `1px solid ${colors.border}`, padding: 16 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontWeight: 900, color: colors.primaryDark }}>Νέα Υπενθύμιση</div>
                    <button
                      onClick={() => setAddOpen(false)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 12,
                        border: `1px solid ${colors.border}`,
                        background: colors.white,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: colors.secondaryText }}>Τίτλος (π.χ. Πληρωμή Ενοικίου)</label>
                      <input
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        style={{ width: '100%', marginTop: 4, padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.bgLight, fontWeight: 800 }}
                        placeholder="Τίτλος..."
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: colors.secondaryText }}>Σημειώσεις (Προαιρετικό)</label>
                      <input
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        style={{ width: '100%', marginTop: 4, padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.bgLight, fontWeight: 800 }}
                        placeholder="Λεπτομέρειες..."
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: colors.secondaryText }}>Ημερομηνία</label>
                      <input
                        type="date"
                        value={customDueDate}
                        onChange={(e) => setCustomDueDate(e.target.value)}
                        style={{ width: '100%', marginTop: 4, padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.bgLight, fontWeight: 800 }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={onSaveCustomNotification}
                    disabled={savingCustom}
                    style={{ width: '100%', marginTop: 18, border: 'none', borderRadius: 14, padding: 12, fontWeight: 900, cursor: 'pointer', background: colors.primaryDark, color: 'white' }}
                  >
                    {savingCustom ? 'Αποθήκευση…' : 'Προσθήκη Υπενθύμισης'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
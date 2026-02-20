'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Bell, X, AlertTriangle, AlertOctagon, Info, Banknote, Landmark } from 'lucide-react'

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

type UiNotification =
  | {
      key: string
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
      key: string
      source: 'custom'
      severity: 'info' | 'warning' | 'danger'
      title: string
      message: string
      dueDate?: string | null
      row: DbNotification
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
  // fromDate - toDate (both yyyy-mm-dd), business-safe midday
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

export default function NotificationsBell({
  storeId,
  onUpdate,
}: {
  storeId: string
  onUpdate?: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [installments, setInstallments] = useState<InstallmentRow[]>([])
  const [settlementsMap, setSettlementsMap] = useState<Record<string, SettlementRow>>({})
  const [customRows, setCustomRows] = useState<DbNotification[]>([])

  // Pay modal state
  const [payOpen, setPayOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Μετρητά')
  const [selectedInst, setSelectedInst] = useState<InstallmentRow | null>(null)
  const [selectedSet, setSelectedSet] = useState<SettlementRow | null>(null)
  const [savingPayment, setSavingPayment] = useState(false)

  const todayStr = useMemo(() => yyyyMmDd(new Date()), [])

  const loadNotifications = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    try {
      // 1) Installments: only pending, and only within windows we care
      // We need: due in 0..3 days OR overdue by >=3 days
      // We'll fetch a reasonable range and filter in JS:
      // from (today-60) to (today+14) to cover overdue + upcoming
      const min = yyyyMmDd(new Date(Date.now() - 60 * 24 * 3600 * 1000))
      const max = yyyyMmDd(new Date(Date.now() + 14 * 24 * 3600 * 1000))

      const { data: inst, error: instErr } = await supabase
        .from('installments')
        .select('id, settlement_id, installment_number, due_date, amount, status, transaction_id, store_id')
        .eq('store_id', storeId)
        .gte('due_date', min)
        .lte('due_date', max)

      if (instErr) throw instErr

      const pending = (inst || []).filter((r: any) => String(r.status || 'pending').toLowerCase() === 'pending')

      // 2) settlements for names/type/rf
      const settlementIds = Array.from(new Set(pending.map((r: any) => String(r.settlement_id))))
      let setMap: Record<string, SettlementRow> = {}

      if (settlementIds.length) {
        const { data: sets, error: setsErr } = await supabase
          .from('settlements')
          .select('id, name, type, rf_code')
          .eq('store_id', storeId)
          .in('id', settlementIds)

        if (setsErr) throw setsErr

        for (const s of (sets || []) as any[]) {
          setMap[String(s.id)] = s as SettlementRow
        }
      }

      setInstallments(pending as any)
      setSettlementsMap(setMap)

      // 3) Custom notifications (optional – for future payroll etc.)
      // only active, and within show window
      const { data: custom, error: customErr } = await supabase
        .from('notifications')
        .select('id, title, message, severity, due_date, show_from, show_until, dismissed_at, resolved_at, kind')
        .eq('store_id', storeId)
        .is('dismissed_at', null)
        .is('resolved_at', null)

      if (customErr) {
        // if table not created yet, don’t crash the bell
        console.warn(customErr)
        setCustomRows([])
      } else {
        setCustomRows((custom || []) as any)
      }
    } catch (e: any) {
      console.error(e)
      toast.error('Σφάλμα φόρτωσης ειδοποιήσεων')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    if (open) loadNotifications()
  }, [open, loadNotifications])

  const installmentNotifications: UiNotification[] = useMemo(() => {
    const out: UiNotification[] = []

    for (const inst of installments) {
      const due = String(inst.due_date)
      const setl = settlementsMap[String(inst.settlement_id)]
      if (!setl) continue

      const daysToDue = daysDiff(due, todayStr) * -1 // easier: positive means future? Let's compute properly:
      // We'll compute: dueDate - today
      const dueMinusToday = daysDiff(due, todayStr) // due - today (in days)

      // windows:
      // due in 0..3 => warning
      // overdue by >=3 => danger
      let severity: 'warning' | 'danger' | null = null
      let daysText = ''

      if (dueMinusToday >= 0 && dueMinusToday <= 3) {
        severity = 'warning'
        daysText = dueMinusToday === 0 ? 'λήγει σήμερα' : `σε ${dueMinusToday} μέρες`
      } else if (dueMinusToday <= -3) {
        severity = 'danger'
        daysText = `${Math.abs(dueMinusToday)} μέρες σε καθυστέρηση`
      } else {
        severity = null
      }

      if (!severity) continue

      const isLoan = setl.type === 'loan'
      const title = isLoan ? 'Δόση Δανείου' : 'Δόση Ρύθμισης'
      const message = `${setl.name}${setl.rf_code ? ` (RF: ${setl.rf_code})` : ''} • Δόση #${inst.installment_number} • ${money(inst.amount)}€ • ${daysText}`

      out.push({
        key: `inst:${inst.id}`,
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

    // sort: danger first, then warning, then nearest due
    return out.sort((a, b) => {
      const sevA = a.severity === 'danger' ? 0 : 1
      const sevB = b.severity === 'danger' ? 0 : 1
      if (sevA !== sevB) return sevA - sevB
      return String(a.dueDate).localeCompare(String(b.dueDate))
    })
  }, [installments, settlementsMap, todayStr])

  const customNotifications: UiNotification[] = useMemo(() => {
    const out: UiNotification[] = []

    for (const n of customRows) {
      // show window filter
      const showFrom = n.show_from
      const showUntil = n.show_until
      if (showFrom && todayStr < showFrom) continue
      if (showUntil && todayStr > showUntil) continue

      out.push({
        key: `custom:${n.id}`,
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
    return [...installmentNotifications, ...customNotifications]
  }, [installmentNotifications, customNotifications])

  const dangerCount = useMemo(() => allNotifications.filter((n) => n.severity === 'danger').length, [allNotifications])
  const warningCount = useMemo(() => allNotifications.filter((n) => n.severity === 'warning').length, [allNotifications])
  const badgeCount = dangerCount + warningCount

  const bellColor = useMemo(() => {
    if (dangerCount > 0) return colors.accentRed
    if (warningCount > 0) return '#f59e0b' // amber
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
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Η συνεδρία έληξε. Συνδέσου ξανά.')

      // ✅ πιο ασφαλές: ΜΗΝ βασίζεσαι σε profiles relation (που δεν έχεις)
      // Πάμε μόνο με created_by_name = 'Χρήστης' αν δεν έχεις username elsewhere
      // (Αν έχεις πίνακα "users" ή "profiles" ως table, το ξαναδένουμε μετά)
      const userName = 'Χρήστης'

      const amount = Math.abs(Number(selectedInst.amount || 0))
      if (!amount) throw new Error('Μη έγκυρο ποσό')

      const today = todayStr
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

      // refresh list
      await loadNotifications()
      await onUpdate?.()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Αποτυχία πληρωμής')
    } finally {
      setSavingPayment(false)
    }
  }

  const dismissCustom = async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', id).eq('store_id', storeId)
      if (error) throw error
      setCustomRows((prev) => prev.filter((x) => x.id !== id))
      toast.success('Έγινε απόκρυψη')
    } catch (e) {
      toast.error('Σφάλμα απόκρυψης')
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

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
        {badgeCount > 0 && (
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
              <div>
                <div style={{ fontWeight: 900, color: colors.primaryDark }}>Ειδοποιήσεις</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: colors.secondaryText }}>
                  {dangerCount} κόκκινες • {warningCount} κίτρινες
                </div>
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
              ) : allNotifications.length === 0 ? (
                <div style={{ padding: 18, textAlign: 'center', color: colors.secondaryText, fontWeight: 800 }}>Δεν υπάρχουν ειδοποιήσεις</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {allNotifications.map((n) => (
                    <div
                      key={n.key}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 14,
                        padding: 12,
                        background: 'white',
                      }}
                    >
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
                            {n.source === 'installment' ? n.message : (n.message || '')}
                          </div>

                          {n.source === 'installment' && (
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
                                Λήξη: {formatDateGr(n.dueDate)}
                              </span>
                            </div>
                          )}
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
                          ) : (
                            <button
                              onClick={() => dismissCustom(n.row.id)}
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
          </div>
        </div>
      )}
    </div>
  )
}
'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState, Suspense, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  HandCoins,
  PlusCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Hash,
  BadgeEuro,
  Landmark,
  Banknote,
  CircleDashed,
  CheckCircle2,
  X,
} from 'lucide-react'

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
}

type Settlement = {
  id: string
  name: string
  type?: 'settlement' | 'loan' | null
  rf_code: string | null
  total_amount: number | null
  installments_count: number | null
  installment_amount: number | null
  first_due_date: string | null
  store_id?: string | null
  created_at?: string | null
}

type Installment = {
  id: string
  settlement_id: string
  installment_number: number
  due_date: string
  amount: number
  status: string | null
  transaction_id: string | null
}

type PaymentMethod = 'Μετρητά' | 'Τράπεζα'

function addMonthsSafe(isoDate: string, months: number) {
  const source = new Date(`${isoDate}T12:00:00`)
  const day = source.getDate()

  const target = new Date(source)
  target.setMonth(target.getMonth() + months)

  if (target.getDate() !== day) {
    target.setDate(0)
  }

  const y = target.getFullYear()
  const m = String(target.getMonth() + 1).padStart(2, '0')
  const d = String(target.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toMoney(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(2)} €`
}

function formatDateGr(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Κάτι πήγε στραβά'
}

function SettlementsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const storeId = searchParams.get('store')

  const [loading, setLoading] = useState(true)
  const [savingSettlement, setSavingSettlement] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)

  const [openCreateModal, setOpenCreateModal] = useState(false)
  const [openPaymentModal, setOpenPaymentModal] = useState(false)

  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [installmentsMap, setInstallmentsMap] = useState<Record<string, Installment[]>>({})
  const [expandedSettlementId, setExpandedSettlementId] = useState<string | null>(null)

  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null)
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Μετρητά')

  const [name, setName] = useState('')
  const [type, setType] = useState<'settlement' | 'loan'>('settlement')
  const [rfCode, setRfCode] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [installmentsCount, setInstallmentsCount] = useState('12')
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [firstDueDate, setFirstDueDate] = useState(new Date().toISOString().split('T')[0])

  const pendingStats = useMemo(() => {
    let pendingCount = 0
    let pendingAmount = 0

    Object.values(installmentsMap).forEach((rows) => {
      rows.forEach((row) => {
        if ((row.status || 'pending').toLowerCase() === 'pending') {
          pendingCount += 1
          pendingAmount += Number(row.amount || 0)
        }
      })
    })

    return { pendingCount, pendingAmount }
  }, [installmentsMap])

  const resetCreateForm = () => {
    setName('')
    setType('settlement')
    setRfCode('')
    setTotalAmount('')
    setInstallmentsCount('12')
    setInstallmentAmount('')
    setFirstDueDate(new Date().toISOString().split('T')[0])
  }

  const loadData = useCallback(async () => {
    if (!storeId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data: settlementsData, error: settlementsErr } = await supabase
        .from('settlements')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })

      if (settlementsErr) throw settlementsErr

      const mappedSettlements = (settlementsData || []) as Settlement[]
      setSettlements(mappedSettlements)

      if (!mappedSettlements.length) {
        setInstallmentsMap({})
        return
      }

      const settlementIds = mappedSettlements.map((s) => s.id)
      const { data: installmentsData, error: installmentsErr } = await supabase
        .from('installments')
        .select('*')
        .in('settlement_id', settlementIds)
        .order('installment_number', { ascending: true })

      if (installmentsErr) throw installmentsErr

      const grouped: Record<string, Installment[]> = {}
      for (const row of (installmentsData || []) as Installment[]) {
        if (!grouped[row.settlement_id]) grouped[row.settlement_id] = []
        grouped[row.settlement_id].push(row)
      }
      setInstallmentsMap(grouped)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Αποτυχία φόρτωσης ρυθμίσεων')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      if (!storeId) {
        toast.error('Δεν βρέθηκε store στο URL')
        setLoading(false)
        return
      }

      await loadData()
    }

    void bootstrap()
  }, [router, storeId, loadData])

  const onCreateSettlement = async () => {
    if (!storeId) return toast.error('Λείπει το store')

    const cleanName = name.trim()
    const cleanRf = rfCode.trim()
    const parsedTotal = Number(totalAmount)
    const parsedCount = Number(installmentsCount)
    const parsedInstallment = Number(installmentAmount)

    if (!cleanName) return toast.error('Συμπλήρωσε όνομα ρύθμισης')
    if (!cleanRf) return toast.error('Συμπλήρωσε κωδικό RF / Ταυτότητα Οφειλής')
    if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) return toast.error('Μη έγκυρο συνολικό ποσό')
    if (!Number.isInteger(parsedCount) || parsedCount <= 0) return toast.error('Μη έγκυρος αριθμός δόσεων')
    if (!Number.isFinite(parsedInstallment) || parsedInstallment <= 0) return toast.error('Μη έγκυρο ποσό ανά δόση')
    if (!firstDueDate) return toast.error('Συμπλήρωσε ημερομηνία 1ης δόσης')

    setSavingSettlement(true)

    let createdSettlementId: string | null = null

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Η συνεδρία έληξε. Συνδέσου ξανά.')

      const settlementPayload = {
        store_id: storeId,
        user_id: session.user.id,
        name: cleanName,
        type,
        rf_code: cleanRf,
        total_amount: parsedTotal,
        installments_count: parsedCount,
        installment_amount: parsedInstallment,
        first_due_date: firstDueDate,
      }

      const { data: settlementRow, error: settlementErr } = await supabase
        .from('settlements')
        .insert([settlementPayload])
        .select('id')
        .single()

      if (settlementErr) throw settlementErr

      createdSettlementId = settlementRow.id

      const installmentsPayload = Array.from({ length: parsedCount }, (_, index) => ({
        store_id: storeId,
        settlement_id: createdSettlementId,
        installment_number: index + 1,
        amount: parsedInstallment,
        due_date: addMonthsSafe(firstDueDate, index),
        status: 'pending',
      }))

      const { error: installmentsErr } = await supabase.from('installments').insert(installmentsPayload)
      if (installmentsErr) throw installmentsErr

      toast.success('Η ρύθμιση δημιουργήθηκε με επιτυχία')
      setOpenCreateModal(false)
      resetCreateForm()
      await loadData()
    } catch (error: unknown) {
      if (createdSettlementId) {
        await supabase.from('settlements').delete().eq('id', createdSettlementId)
      }
      toast.error(getErrorMessage(error) || 'Αποτυχία δημιουργίας ρύθμισης')
    } finally {
      setSavingSettlement(false)
    }
  }

  const openPaymentFor = (settlement: Settlement, installment: Installment) => {
    setSelectedSettlement(settlement)
    setSelectedInstallment(installment)
    setPaymentMethod('Μετρητά')
    setOpenPaymentModal(true)
  }

  const onConfirmPayment = async () => {
    if (!storeId) return toast.error('Λείπει το store')
    if (!selectedInstallment || !selectedSettlement) return toast.error('Δεν βρέθηκε επιλεγμένη δόση')

    setSavingPayment(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Η συνεδρία έληξε. Συνδέσου ξανά.')
      let userName = 'Χρήστης'
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle()
      if (profile?.username) {
        userName = profile.username
      }

      const amount = Math.abs(Number(selectedInstallment.amount || 0))
      if (!amount) throw new Error('Μη έγκυρο ποσό δόσης')

      const today = new Date().toISOString().split('T')[0]
      const notes = `Πληρωμή Δόσης #${selectedInstallment.installment_number}: ${selectedSettlement.name} ${selectedSettlement.rf_code ? `(RF: ${selectedSettlement.rf_code})` : ''}`

      const { data: transactionRow, error: transErr } = await supabase
        .from('transactions')
        .insert([
          {
            store_id: storeId,
            user_id: session.user.id,
            created_by_name: userName,
            type: 'expense',
            amount: -amount,
            method: paymentMethod,
            category: 'Λοιπά', // Στην Ανάλυση θα πάει στο Other
            notes,
            date: today,
          },
        ])
        .select('id')
        .single()

      if (transErr) throw transErr

      const { error: installmentErr } = await supabase
        .from('installments')
        .update({
          status: 'paid',
          transaction_id: transactionRow.id,
        })
        .eq('id', selectedInstallment.id)

      if (installmentErr) throw installmentErr

      toast.success('Η δόση πληρώθηκε και καταχωρήθηκε στα έξοδα')
      setOpenPaymentModal(false)
      setSelectedInstallment(null)
      setSelectedSettlement(null)
      await loadData()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Αποτυχία πληρωμής δόσης')
    } finally {
      setSavingPayment(false)
    }
  }

  const onDeleteSettlement = async (settlementId: string) => {
    if (!confirm('Είστε σίγουροι; Θα διαγραφεί η ρύθμιση και όλες οι δόσεις της. (Τυχόν δόσεις που έχετε ήδη πληρώσει θα παραμείνουν στα έξοδα).')) return
    if (!storeId) return

    setLoading(true)
    try {
      const { error } = await supabase.from('settlements').delete().eq('id', settlementId).eq('store_id', storeId)
      if (error) throw error

      toast.success('Η ρύθμιση διαγράφηκε επιτυχώς')
      setExpandedSettlementId(null)
      await loadData()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Αποτυχία διαγραφής')
      setLoading(false)
    }
  }

  const onCopyRf = async (rf: string | null) => {
    if (!rf) return
    try {
      await navigator.clipboard.writeText(rf)
      toast.success('Ο κωδικός RF αντιγράφηκε')
    } catch {
      toast.error('Αποτυχία αντιγραφής')
    }
  }

  if (loading) {
    return (
      <div style={wrapperStyle}>
        <div style={contentStyle}>
          <div style={loadingCardStyle}>
            <CircleDashed size={20} className="animate-spin" />
            <span>Φόρτωση ρυθμίσεων...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={wrapperStyle}>
      <Toaster richColors position="top-center" />

      <div style={contentStyle}>
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={logoBoxStyle}>
              <HandCoins size={20} color={colors.accentBlue} />
            </div>
            <div>
              <h1 style={titleStyle}>Ρυθμίσεις & Δάνεια</h1>
              <p style={subtitleStyle}>Διαχείριση δόσεων και πληρωμών</p>
            </div>
          </div>

          <Link href={`/?store=${storeId || ''}`} style={backBtnStyle}>
            <ChevronLeft size={18} />
          </Link>
        </header>

        <div style={summaryCardStyle}>
          <div>
            <p style={summaryLabelStyle}>ΕΚΚΡΕΜΕΙΣ ΔΟΣΕΙΣ</p>
            <p style={summaryValueStyle}>{pendingStats.pendingCount}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={summaryLabelStyle}>ΣΥΝΟΛΟ ΥΠΟΛΟΙΠΟΥ</p>
            <p style={summaryValueStyle}>{toMoney(pendingStats.pendingAmount)}</p>
          </div>
        </div>

        <button
          type="button"
          style={newBtnStyle}
          onClick={() => setOpenCreateModal(true)}
        >
          <PlusCircle size={18} />
          Νέα Ρύθμιση
        </button>

        {settlements.length === 0 ? (
          <div style={emptyStateStyle}>
            <HandCoins size={36} color="#cbd5e1" />
            <p style={{ margin: '8px 0 0', fontWeight: 800, color: colors.secondaryText }}>Δεν υπάρχουν ρυθμίσεις ακόμη</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {settlements.map((settlement) => {
              const isOpen = expandedSettlementId === settlement.id
              const settlementInstallments = installmentsMap[settlement.id] || []

              return (
                <article key={settlement.id} style={cardStyle}>
                  <button
                    type="button"
                    style={accordionBtnStyle}
                    onClick={() => setExpandedSettlementId(isOpen ? null : settlement.id)}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ marginBottom: 5 }}>
                        {settlement.type === 'loan' ? (
                          <span style={{ ...typeBadgeStyle, ...loanTypeBadgeStyle }}>
                            <Landmark size={12} />
                            ΔΑΝΕΙΟ
                          </span>
                        ) : (
                          <span style={{ ...typeBadgeStyle, ...settlementTypeBadgeStyle }}>
                            <HandCoins size={12} />
                            ΡΥΘΜΙΣΗ
                          </span>
                        )}
                      </div>
                      <h3 style={settlementTitleStyle}>{settlement.name}</h3>
                      <div style={rfRowStyle}>
                        <Hash size={14} color={colors.secondaryText} />
                        <span style={rfTextStyle}>RF: {settlement.rf_code || '—'}</span>
                        {settlement.rf_code && (
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void onCopyRf(settlement.rf_code)
                            }}
                            style={copyBtnStyle}
                          >
                            <Copy size={14} />
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={miniBadgeStyle}>
                        {settlementInstallments.filter(i => i.status === 'paid').length} / {settlementInstallments.length} Πληρωμένες
                      </span>
                      {isOpen ? <ChevronUp size={18} color={colors.secondaryText} /> : <ChevronDown size={18} color={colors.secondaryText} />}
                    </div>
                  </button>

                  <div style={rowInfoStyle}>
                    <div style={rowInfoItemStyle}>
                      <BadgeEuro size={14} color={colors.accentBlue} />
                      <span>Σύνολο: {toMoney(settlement.total_amount)}</span>
                    </div>
                    <div style={rowInfoItemStyle}>
                      <CalendarDays size={14} color={colors.accentBlue} />
                      <span>1η Δόση: {formatDateGr(settlement.first_due_date)}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <>
                      <div style={installmentsWrapStyle}>
                        {settlementInstallments.length === 0 ? (
                          <p style={{ margin: 0, color: colors.secondaryText, fontWeight: 700 }}>Δεν υπάρχουν δόσεις.</p>
                        ) : (
                          settlementInstallments.map((inst) => {
                            const isPending = (inst.status || 'pending').toLowerCase() === 'pending'

                            return (
                              <div key={inst.id} style={installmentRowStyle}>
                                <div>
                                  <p style={installmentTitleStyle}>Δόση #{inst.installment_number}</p>
                                  <p style={installmentMetaStyle}>Λήξη: {formatDateGr(inst.due_date)}</p>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={amountChipStyle}>{toMoney(inst.amount)}</span>
                                  {isPending ? (
                                    <button
                                      type="button"
                                      style={payBtnStyle}
                                      onClick={() => openPaymentFor(settlement, inst)}
                                    >
                                      Πληρωμή
                                    </button>
                                  ) : (
                                    <span style={paidChipStyle}>
                                      <CheckCircle2 size={13} />
                                      Πληρωμένη
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )}
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px dashed ${colors.border}`, display: 'flex', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => onDeleteSettlement(settlement.id)}
                            style={{
                              background: 'transparent', border: 'none', color: colors.accentRed, fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                            }}
                          >
                            <X size={14} /> Διαγραφή Συμφωνίας
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>

      {openCreateModal && (
        <div style={modalBackdropStyle} onClick={() => !savingSettlement && setOpenCreateModal(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={modalTitleStyle}>Νέα Ρύθμιση</h2>
              <button type="button" style={iconCloseBtnStyle} onClick={() => setOpenCreateModal(false)} disabled={savingSettlement}>
                <X size={16} />
              </button>
            </div>

            <div style={formGridStyle}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Τύπος Συμφωνίας</label>
                <div style={typeToggleWrapStyle}>
                  <button
                    type="button"
                    style={{ ...typeBtnStyle, ...(type === 'settlement' ? typeBtnActiveStyle : {}) }}
                    onClick={() => setType('settlement')}
                  >
                    Ρύθμιση (π.χ. Εφορία)
                  </button>
                  <button
                    type="button"
                    style={{ ...typeBtnStyle, ...(type === 'loan' ? typeBtnActiveStyle : {}) }}
                    onClick={() => setType('loan')}
                  >
                    Δάνειο (Τράπεζα)
                  </button>
                </div>
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Όνομα</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Κωδικός RF / Ταυτότητα Οφειλής</label>
                <input style={inputStyle} value={rfCode} onChange={(e) => setRfCode(e.target.value)} />
              </div>

              <div style={twoColGridStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Συνολικό Ποσό</label>
                  <input style={inputStyle} type="number" min="0" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Αριθμός Δόσεων</label>
                  <input style={inputStyle} type="number" min="1" step="1" value={installmentsCount} onChange={(e) => setInstallmentsCount(e.target.value)} />
                </div>
              </div>

              <div style={twoColGridStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Ποσό ανά Δόση</label>
                  <input style={inputStyle} type="number" min="0" step="0.01" value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Ημερομηνία 1ης Δόσης</label>
                  <input style={inputStyle} type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
                </div>
              </div>
            </div>

            <button type="button" style={saveBtnStyle} onClick={onCreateSettlement} disabled={savingSettlement}>
              {savingSettlement ? 'Αποθήκευση...' : 'Αποθήκευση Ρύθμισης'}
            </button>
          </div>
        </div>
      )}

      {openPaymentModal && selectedInstallment && selectedSettlement && (
        <div style={modalBackdropStyle} onClick={() => !savingPayment && setOpenPaymentModal(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={modalTitleStyle}>Πληρωμή Δόσης</h2>
              <button type="button" style={iconCloseBtnStyle} onClick={() => setOpenPaymentModal(false)} disabled={savingPayment}>
                <X size={16} />
              </button>
            </div>

            <div style={paymentInfoBoxStyle}>
              <p style={paymentInfoTitleStyle}>{selectedSettlement.name}</p>
              <p style={paymentInfoMetaStyle}>Δόση #{selectedInstallment.installment_number} • {toMoney(selectedInstallment.amount)}</p>
            </div>

            <label style={{ ...labelStyle, marginTop: 10 }}>Τρόπος Πληρωμής</label>
            <div style={methodToggleWrapStyle}>
              <button
                type="button"
                style={{ ...methodBtnStyle, ...(paymentMethod === 'Μετρητά' ? methodBtnActiveStyle : {}) }}
                onClick={() => setPaymentMethod('Μετρητά')}
              >
                <Banknote size={15} />
                Μετρητά
              </button>
              <button
                type="button"
                style={{ ...methodBtnStyle, ...(paymentMethod === 'Τράπεζα' ? methodBtnActiveStyle : {}) }}
                onClick={() => setPaymentMethod('Τράπεζα')}
              >
                <Landmark size={15} />
                Τράπεζα
              </button>
            </div>

            <button type="button" style={saveBtnStyle} onClick={onConfirmPayment} disabled={savingPayment}>
              {savingPayment ? 'Καταχώρηση...' : 'Ολοκλήρωση Πληρωμής'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const wrapperStyle: CSSProperties = {
  background: colors.bgLight,
  minHeight: '100dvh',
  padding: '20px',
}

const contentStyle: CSSProperties = {
  maxWidth: '640px',
  margin: '0 auto',
  paddingBottom: '100px',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '14px',
}

const logoBoxStyle: CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: '14px',
  background: '#eef2ff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '20px',
  fontWeight: 900,
  color: colors.primaryDark,
}

const subtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '12px',
  fontWeight: 700,
  color: colors.secondaryText,
}

const backBtnStyle: CSSProperties = {
  textDecoration: 'none',
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
  background: colors.primaryDark,
  borderRadius: '20px',
  padding: '16px',
  display: 'flex',
  justifyContent: 'space-between',
  color: colors.white,
  marginBottom: '14px',
}

const summaryLabelStyle: CSSProperties = {
  margin: 0,
  opacity: 0.7,
  fontWeight: 800,
  fontSize: '11px',
}

const summaryValueStyle: CSSProperties = {
  margin: '6px 0 0',
  fontWeight: 900,
  fontSize: '22px',
}

const newBtnStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: '14px',
  background: colors.accentBlue,
  color: colors.white,
  fontWeight: 900,
  padding: '14px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  cursor: 'pointer',
  marginBottom: '12px',
}

const emptyStateStyle: CSSProperties = {
  background: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: '18px',
  padding: '24px',
  textAlign: 'center',
}

const cardStyle: CSSProperties = {
  background: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: '16px',
  padding: '12px',
}

const accordionBtnStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
}

const settlementTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '16px',
  fontWeight: 900,
  color: colors.primaryDark,
}

const rfRowStyle: CSSProperties = {
  marginTop: '4px',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const rfTextStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: colors.secondaryText,
}

const copyBtnStyle: CSSProperties = {
  width: '22px',
  height: '22px',
  borderRadius: '8px',
  border: `1px solid ${colors.border}`,
  background: '#f8fafc',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.secondaryText,
}

const miniBadgeStyle: CSSProperties = {
  background: '#eff6ff',
  color: '#1d4ed8',
  border: '1px solid #bfdbfe',
  fontSize: '11px',
  fontWeight: 800,
  borderRadius: '999px',
  padding: '4px 8px',
}

const typeBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  borderRadius: '999px',
  border: '1px solid',
  padding: '3px 8px',
  fontSize: '10px',
  fontWeight: 900,
  letterSpacing: 0.3,
}

const loanTypeBadgeStyle: CSSProperties = {
  background: '#eff6ff',
  color: colors.accentBlue,
  borderColor: '#bfdbfe',
}

const settlementTypeBadgeStyle: CSSProperties = {
  background: '#ecfdf5',
  color: colors.accentGreen,
  borderColor: '#a7f3d0',
}

const rowInfoStyle: CSSProperties = {
  marginTop: '10px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const rowInfoItemStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: '12px',
  fontWeight: 700,
  color: colors.secondaryText,
}

const installmentsWrapStyle: CSSProperties = {
  marginTop: '10px',
  borderTop: `1px solid ${colors.border}`,
  paddingTop: '10px',
  display: 'grid',
  gap: 8,
}

const installmentRowStyle: CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: '12px',
  padding: '10px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
}

const installmentTitleStyle: CSSProperties = {
  margin: 0,
  fontWeight: 900,
  fontSize: '13px',
  color: colors.primaryDark,
}

const installmentMetaStyle: CSSProperties = {
  margin: '3px 0 0',
  color: colors.secondaryText,
  fontSize: '12px',
  fontWeight: 700,
}

const amountChipStyle: CSSProperties = {
  background: '#f8fafc',
  border: `1px solid ${colors.border}`,
  borderRadius: '10px',
  padding: '6px 8px',
  fontWeight: 900,
  fontSize: '12px',
}

const payBtnStyle: CSSProperties = {
  border: 'none',
  borderRadius: '10px',
  background: colors.accentGreen,
  color: colors.white,
  fontSize: '12px',
  fontWeight: 800,
  padding: '8px 10px',
  cursor: 'pointer',
}

const paidChipStyle: CSSProperties = {
  background: '#ecfdf5',
  color: '#065f46',
  border: '1px solid #a7f3d0',
  borderRadius: '10px',
  fontSize: '12px',
  fontWeight: 800,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '7px 9px',
}

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
  fontWeight: 800,
}

const modalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: colors.modalBackdrop,
  zIndex: 120,
  display: 'grid',
  placeItems: 'center',
  padding: '16px',
}

const modalCardStyle: CSSProperties = {
  width: '100%',
  maxWidth: '520px',
  background: colors.white,
  borderRadius: '18px',
  border: `1px solid ${colors.border}`,
  padding: '16px',
}

const modalHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '10px',
}

const modalTitleStyle: CSSProperties = {
  margin: 0,
  fontWeight: 900,
  fontSize: '17px',
  color: colors.primaryDark,
}

const iconCloseBtnStyle: CSSProperties = {
  width: '30px',
  height: '30px',
  borderRadius: '10px',
  border: `1px solid ${colors.border}`,
  background: colors.white,
  color: colors.secondaryText,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const formGridStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const inputGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const labelStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  color: colors.secondaryText,
}

const typeToggleWrapStyle: CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: '12px',
  background: colors.bgLight,
  padding: '4px',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 4,
}

const typeBtnStyle: CSSProperties = {
  border: 'none',
  borderRadius: '9px',
  padding: '10px 8px',
  fontSize: '12px',
  fontWeight: 800,
  color: colors.secondaryText,
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'center',
}

const typeBtnActiveStyle: CSSProperties = {
  background: colors.white,
  color: colors.primaryDark,
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
}

const inputStyle: CSSProperties = {
  width: '100%',
  border: `1px solid ${colors.border}`,
  borderRadius: '12px',
  padding: '12px',
  fontSize: '16px',
  fontWeight: 700,
  outline: 'none',
  background: colors.bgLight,
}

const twoColGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
}

const saveBtnStyle: CSSProperties = {
  width: '100%',
  marginTop: '14px',
  border: 'none',
  borderRadius: '12px',
  padding: '13px',
  background: colors.accentBlue,
  color: colors.white,
  fontWeight: 900,
  cursor: 'pointer',
}

const paymentInfoBoxStyle: CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: '12px',
  padding: '10px',
  background: '#f8fafc',
}

const paymentInfoTitleStyle: CSSProperties = {
  margin: 0,
  fontWeight: 900,
  color: colors.primaryDark,
}

const paymentInfoMetaStyle: CSSProperties = {
  margin: '4px 0 0',
  fontSize: '12px',
  fontWeight: 700,
  color: colors.secondaryText,
}

const methodToggleWrapStyle: CSSProperties = {
  marginTop: '6px',
  border: `1px solid ${colors.border}`,
  borderRadius: '12px',
  background: colors.bgLight,
  padding: '4px',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 4,
}

const methodBtnStyle: CSSProperties = {
  border: 'none',
  borderRadius: '9px',
  padding: '10px',
  fontSize: '13px',
  fontWeight: 800,
  color: colors.secondaryText,
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
}

const methodBtnActiveStyle: CSSProperties = {
  background: colors.white,
  color: colors.primaryDark,
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
}

export default function SettlementsPage() {
  return (
    <Suspense fallback={null}>
      <SettlementsContent />
    </Suspense>
  )
}

'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import {
  ChevronLeft,
  Receipt,
  CreditCard,
  Hash,
  Landmark,
  Calendar,
  X,
  ChevronDown,
  ChevronUp,
  Clock3,
  Wallet,
} from 'lucide-react'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentOrange: '#f97316',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  accentBlue: '#2563eb',
  accentRed: '#dc2626',
  accentGreen: '#10b981',
}

type ViewMode = 'expenses' | 'income'

const isValidUUID = (id: any) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof id === 'string' && regex.test(id)
}

const normalize = (v: any) => String(v ?? '').trim().toLowerCase()

// ✅ BUSINESS DAY HELPERS (07:00 cutoff)
const toBusinessDayDate = (d: Date) => {
  const bd = new Date(d)
  if (bd.getHours() < 7) bd.setDate(bd.getDate() - 1)
  // normalize to date-only (so comparisons don't get messy)
  bd.setHours(12, 0, 0, 0)
  return bd
}

const getBusinessDayKey = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function BalancesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdFromUrl = searchParams.get('store')

  const [viewMode, setViewMode] = useState<ViewMode>('expenses')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all')

  const [allTransactions, setAllTransactions] = useState<any[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedEntityId('all')
    setExpandedId(null)
  }, [viewMode])

  const getEntityBadge = useCallback(
    (entity: any) => {
      if (viewMode === 'income') {
        return { text: 'ΑΠΑΙΤΗΣΗ', bg: '#ecfdf5', color: '#065f46' }
      }

      if (entity?.entityType === 'supplier') {
        return { text: 'ΕΜΠΟΡΕΥΜΑΤΑ', bg: '#f1f5f9', color: colors.secondaryText }
      }

      const sub = normalize(entity?.sub_category)
      const cat = normalize(entity?.category)

      const isMaintenance = sub === 'maintenance' || cat === 'maintenance'
      const isUtility = sub === 'utility' || cat === 'utility'

      if (isMaintenance) {
        return { text: 'ΣΥΝΤΗΡΗΣΗ', bg: '#fef3c7', color: '#b45309' }
      }
      if (isUtility) {
        return { text: 'ΛΟΓΑΡΙΑΣΜΟΣ', bg: '#f1f5f9', color: colors.secondaryText }
      }

      return { text: 'ΛΟΙΠΑ', bg: '#f1f5f9', color: colors.secondaryText }
    },
    [viewMode]
  )

  // -----------------------------
  // DATE HELPERS
  // -----------------------------
  const getTxDate = (t: any) => {
    if (!t) return null
    const raw = t.created_at || t.date
    const d = raw ? new Date(raw) : null
    return d && !isNaN(d.getTime()) ? d : null
  }

  const formatTxDate = (d: Date | null) => {
    if (!d) return '—'
    return d.toLocaleString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ✅ Uses BUSINESS DAY (07:00 cutoff)
  const daysAgoLabel = (d: Date | null) => {
    if (!d) return ''
    const now = new Date()

    const bdNow = toBusinessDayDate(now)
    const bdTx = toBusinessDayDate(d)

    const nowKey = getBusinessDayKey(bdNow)
    const txKey = getBusinessDayKey(bdTx)

    if (txKey === nowKey) return 'Σήμερα'

    // compute diff in business days
    const diffMs = bdNow.getTime() - bdTx.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return 'Χθες'
    if (diffDays < 0) return 'Μελλοντικό'
    return `${diffDays} μέρες πριν`
  }

  const money = (n: any) => Math.abs(Number(n) || 0).toFixed(2)

  // ✅ NEW: chip style by mode (income -> green, expenses -> blue)
  const amountChipStyle = (mode: ViewMode): any => {
    const isIncome = mode === 'income'
    return {
      ...miniAmountChip,
      background: isIncome ? '#ecfdf5' : '#eff6ff',
      border: isIncome ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
      color: isIncome ? '#065f46' : '#1d4ed8',
    }
  }

  const getEntityTransactions = (entity: any, transactions: any[], mode: ViewMode) => {
    const isIncome = mode === 'income'

    const entityTrans = transactions.filter((t) => {
      if (isIncome) return t.revenue_source_id === entity.id
      return entity.entityType === 'supplier' ? t.supplier_id === entity.id : t.fixed_asset_id === entity.id
    })

    const creditTxs = entityTrans
      .filter((t) => t.is_credit === true)
      .sort((a, b) => (getTxDate(b)?.getTime() || 0) - (getTxDate(a)?.getTime() || 0))

    const RECEIVED_TYPES = ['debt_payment', 'debt_received', 'income_collection']

    const settlementTxs = isIncome
      ? entityTrans
          .filter((t) => RECEIVED_TYPES.includes(String(t.type || '')))
          .sort((a, b) => (getTxDate(b)?.getTime() || 0) - (getTxDate(a)?.getTime() || 0))
      : entityTrans
          .filter((t) => String(t.type || '') === 'debt_payment')
          .sort((a, b) => (getTxDate(b)?.getTime() || 0) - (getTxDate(a)?.getTime() || 0))

    const latestCreditDate = creditTxs.length ? getTxDate(creditTxs[0]) : null
    const oldestCreditDate = creditTxs.length ? getTxDate(creditTxs[creditTxs.length - 1]) : null

    const latestSettlementTx = settlementTxs.length ? settlementTxs[0] : null
    const latestSettlementDate = latestSettlementTx ? getTxDate(latestSettlementTx) : null
    const latestSettlementAmount = latestSettlementTx ? Math.abs(Number(latestSettlementTx.amount) || 0) : null

    const totalCreditAmount = creditTxs.reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)
    const totalSettlementAmount = settlementTxs.reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

    return {
      creditTxs,
      settlementTxs,
      latestCreditDate,
      oldestCreditDate,
      latestSettlementTx,
      latestSettlementDate,
      latestSettlementAmount,
      totalCreditAmount,
      totalSettlementAmount,
    }
  }

  const fetchBalances = useCallback(async () => {
    if (!storeIdFromUrl || !isValidUUID(storeIdFromUrl)) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const transRes = await supabase.from('transactions').select('*').eq('store_id', storeIdFromUrl)
      if (transRes.error) throw transRes.error
      const transactions = transRes.data || []
      setAllTransactions(transactions)

      if (viewMode === 'expenses') {
        const [supsRes, assetsRes] = await Promise.all([
          supabase.from('suppliers').select('*').eq('store_id', storeIdFromUrl),
          supabase.from('fixed_assets').select('*').eq('store_id', storeIdFromUrl),
        ])

        if (supsRes.error) throw supsRes.error
        if (assetsRes.error) throw assetsRes.error

        const suppliers = (supsRes.data || []).map((s) => ({ ...s, entityType: 'supplier' }))

        const assets = (assetsRes.data || [])
          .filter((a) => {
            const sub = normalize(a?.sub_category)
            const cat = normalize(a?.category)
            return (
              sub === 'maintenance' ||
              sub === 'utility' ||
              sub === 'other' ||
              cat === 'maintenance' ||
              cat === 'utility' ||
              cat === 'other'
            )
          })
          .map((a) => ({ ...a, entityType: 'asset' }))

        const allEntities = [...suppliers, ...assets]

        const balanceList = allEntities
          .map((entity) => {
            const isSup = entity.entityType === 'supplier'

            const entityTrans = transactions.filter((t) =>
              isSup ? t.supplier_id === entity.id : t.fixed_asset_id === entity.id
            )

            const totalCredit = entityTrans
              .filter((t) => t.is_credit === true)
              .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

            const totalPaid = entityTrans
              .filter((t) => t.type === 'debt_payment')
              .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

            return { ...entity, balance: totalCredit - totalPaid }
          })
          .filter((e) => Math.abs(e.balance) > 0.1)
          .sort((a, b) => b.balance - a.balance)

        setData(balanceList)
        return
      }

      const revRes = await supabase.from('revenue_sources').select('*').eq('store_id', storeIdFromUrl)
      if (revRes.error) throw revRes.error

      const revenueSources = (revRes.data || []).map((r) => ({ ...r, entityType: 'revenue' }))

      const RECEIVED_TYPES = ['debt_payment', 'debt_received', 'income_collection']

      const balanceList = revenueSources
        .map((src) => {
          const srcTrans = transactions.filter((t) => t.revenue_source_id === src.id)

          const totalCredit = srcTrans
            .filter((t) => t.is_credit === true)
            .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

          const totalReceived = srcTrans
            .filter((t) => RECEIVED_TYPES.includes(String(t.type || '')))
            .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

          return { ...src, balance: totalCredit - totalReceived }
        })
        .filter((e) => Math.abs(e.balance) > 0.1)
        .sort((a, b) => b.balance - a.balance)

      setData(balanceList)
    } catch (err: any) {
      console.error(err)
      toast.error('Σφάλμα κατά τον υπολογισμό υπολοίπων')
    } finally {
      setLoading(false)
    }
  }, [storeIdFromUrl, viewMode])

  useEffect(() => {
    if (!storeIdFromUrl || !isValidUUID(storeIdFromUrl)) {
      router.replace('/select-store')
    } else {
      fetchBalances()
    }
  }, [fetchBalances, storeIdFromUrl, router])

  const filteredData = useMemo(() => {
    if (selectedEntityId === 'all') return data
    return data.filter((s) => s.id === selectedEntityId)
  }, [selectedEntityId, data])

  const totalDisplay = filteredData.reduce((acc, s) => acc + (Number(s.balance) || 0), 0)

  const totalCardBg = viewMode === 'income' ? colors.accentGreen : colors.primaryDark
  const totalLabel =
    viewMode === 'income' ? 'ΣΥΝΟΛΙΚΟ ΑΝΟΙΧΤΟ ΥΠΟΛΟΙΠΟ ΕΣΟΔΩΝ' : 'ΣΥΝΟΛΙΚΟ ΑΝΟΙΧΤΟ ΥΠΟΛΟΙΠΟ ΕΞΟΔΩΝ'

  const selectTitle = viewMode === 'income' ? 'ΟΛΕΣ ΟΙ ΠΗΓΕΣ ΕΣΟΔΩΝ' : 'ΟΛΕΣ ΟΙ ΟΦΕΙΛΕΣ'

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '520px', margin: '0 auto', paddingBottom: '120px' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>
              <Receipt size={22} color="#f97316" />
            </div>
            <div>
              <h1 style={{ fontWeight: '900', fontSize: '20px', margin: 0, color: colors.primaryDark }}>Καρτέλες</h1>
              <p style={{ margin: 0, fontSize: '10px', color: colors.secondaryText, fontWeight: '800', letterSpacing: '1px' }}>
                ΥΠΟΛΟΙΠΑ & ΙΣΤΟΡΙΚΟ ΚΙΝΗΣΕΩΝ
              </p>
            </div>
          </div>
          <Link href={`/?store=${storeIdFromUrl}`} style={backBtnStyle}>
            <ChevronLeft size={20} />
          </Link>
        </div>

        {/* SWITCHER */}
        <div style={switcherWrap}>
          <button
            onClick={() => setViewMode('expenses')}
            style={{
              ...switchBtn,
              backgroundColor: viewMode === 'expenses' ? colors.primaryDark : colors.white,
              color: viewMode === 'expenses' ? colors.white : colors.primaryDark,
            }}
          >
            ΕΞΟΔΑ
          </button>
          <button
            onClick={() => setViewMode('income')}
            style={{
              ...switchBtn,
              backgroundColor: viewMode === 'income' ? colors.accentGreen : colors.white,
              color: viewMode === 'income' ? colors.white : colors.primaryDark,
            }}
          >
            ΕΣΟΔΑ
          </button>
        </div>

        {/* SELECT FILTER */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ position: 'relative' }}>
            <select value={selectedEntityId} onChange={(e) => setSelectedEntityId(e.target.value)} style={selectStyle}>
              <option value="all">{selectTitle}</option>
              {data.map((s) => (
                <option key={s.id} value={s.id}>
                  {String(s.name || '').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TOTAL CARD */}
        <div style={{ ...totalCardStyle, backgroundColor: totalCardBg }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0.95 }}>
            <Wallet size={14} color="#fff" />
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: '#ffffff', letterSpacing: '1px' }}>
              {totalLabel}
            </p>
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '38px', fontWeight: '950', color: '#ffffff' }}>
            {totalDisplay.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '10px', fontWeight: '800', color: '#ffffff', opacity: 0.85 }}>
            Πάτησε σε μια καρτέλα για λεπτομέρειες κινήσεων
          </p>
        </div>

        {/* LIST AREA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>Υπολογισμός...</div>
          ) : filteredData.length > 0 ? (
            filteredData.map((s) => {
              const badge = getEntityBadge(s)
              const isIncome = viewMode === 'income'
              const isExpanded = expandedId === s.id

              const actionLabel = isIncome ? 'ΕΙΣΠΡΑΞΗ' : 'ΕΞΟΦΛΗΣΗ'
              const actionBg = isIncome ? '#ecfdf5' : '#eff6ff'
              const actionBorder = isIncome ? `1px solid #a7f3d0` : `1px solid #dbeafe`
              const actionColor = isIncome ? '#065f46' : colors.accentBlue

              const history = getEntityTransactions(s, allTransactions, viewMode)

              const summaryLine = history.latestCreditDate
                ? `Τελευταία καταχώρηση: ${formatTxDate(history.latestCreditDate)} (${daysAgoLabel(history.latestCreditDate)})`
                : '—'

              return (
                <div
                  key={s.id}
                  style={{
                    ...supplierCardStyle,
                    cursor: 'pointer',
                    border: isExpanded ? `1px solid ${colors.accentBlue}` : `1px solid ${colors.border}`,
                    boxShadow: isExpanded ? '0 14px 40px rgba(15, 23, 42, 0.10)' : '0 6px 18px rgba(15, 23, 42, 0.06)',
                  }}
                  onClick={() => setExpandedId((prev) => (prev === s.id ? null : s.id))}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <p style={{ fontWeight: '900', margin: 0, fontSize: '15px', color: colors.primaryDark }}>
                            {String(s.name || '').toUpperCase()}
                          </p>

                          <span style={{ ...badgeStyle, backgroundColor: badge.bg, color: badge.color }}>
                            {badge.text}
                          </span>
                        </div>

                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {s.rf_code && (
                            <div style={infoRow}>
                              <Hash size={12} /> <span style={infoText}>RF: {s.rf_code}</span>
                            </div>
                          )}
                          {s.bank_name && (
                            <div style={infoRow}>
                              <Landmark size={12} /> <span style={infoText}>{String(s.bank_name).toUpperCase()}</span>
                            </div>
                          )}
                          <div style={{ ...infoRow, marginTop: 2 }}>
                            <Clock3 size={12} />
                            <span style={infoText}>{summaryLine}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.secondaryText }}>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={detailsWrap} onClick={(e) => e.stopPropagation()}>
                        <div style={detailsHeader}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Calendar size={14} />
                            <span style={{ fontWeight: 950, fontSize: 12, letterSpacing: 0.2 }}>
                              {viewMode === 'income' ? 'ΙΣΤΟΡΙΚΟ ΑΠΑΙΤΗΣΕΩΝ' : 'ΙΣΤΟΡΙΚΟ ΟΦΕΙΛΩΝ'}
                            </span>
                          </div>

                          <button style={closeMiniBtn} onClick={() => setExpandedId(null)} title="Κλείσιμο">
                            <X size={14} />
                          </button>
                        </div>

                        <div style={miniSummaryRow}>
                          <div style={miniPill}>
                            <span style={miniPillLabel}>Πρώτη καταχώρηση</span>
                            <span style={miniPillValue}>
                              {history.oldestCreditDate ? formatTxDate(history.oldestCreditDate) : '—'}
                            </span>
                          </div>

                          <div style={miniPill}>
                            <span style={miniPillLabel}>Τελευταία καταχώρηση</span>
                            <span style={miniPillValue}>
                              {history.latestCreditDate ? formatTxDate(history.latestCreditDate) : '—'}
                            </span>
                          </div>

                          <div style={miniPill}>
                            <span style={miniPillLabel}>
                              {viewMode === 'income' ? 'Τελευταία είσπραξη' : 'Τελευταία εξόφληση'}
                            </span>

                            {history.latestSettlementDate ? (
                              <span style={{ ...miniPillValue, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span>
                                  {formatTxDate(history.latestSettlementDate)} ({daysAgoLabel(history.latestSettlementDate)})
                                </span>
                                <span style={amountChipStyle(viewMode)}>{money(history.latestSettlementAmount)}€</span>
                              </span>
                            ) : (
                              <span style={miniPillValue}>—</span>
                            )}
                          </div>

                          <div style={miniPill}>
                            <span style={miniPillLabel}>{viewMode === 'income' ? 'Σύνολο απαιτήσεων' : 'Σύνολο χρεώσεων'}</span>
                            <span style={miniPillValue}>{history.totalCreditAmount.toFixed(2)}€</span>
                          </div>

                          <div style={miniPill}>
                            <span style={miniPillLabel}>
                              {viewMode === 'income' ? 'Σύνολο εισπράξεων' : 'Σύνολο εξοφλήσεων'}
                            </span>
                            <span style={miniPillValue}>{history.totalSettlementAmount.toFixed(2)}€</span>
                          </div>
                        </div>

                        <div style={sectionTitle}>
                          {viewMode === 'income'
                            ? `Απαιτήσεις (${history.creditTxs.length})`
                            : `Χρεώσεις (${history.creditTxs.length})`}
                        </div>

                        {history.creditTxs.length === 0 ? (
                          <div style={rowMuted}>Δεν βρέθηκαν καταχωρήσεις.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {history.creditTxs.slice(0, 12).map((t: any) => {
                              const d = getTxDate(t)
                              const note =
                                String(t.notes || t.description || '').trim() ||
                                String(t.category || t.type || '').trim() ||
                                (viewMode === 'income' ? 'Απαίτηση' : 'Χρέωση')

                              return (
                                <div key={t.id} style={txRow}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <div style={txDate}>{formatTxDate(d)}</div>
                                      <span style={tinyChip}>{daysAgoLabel(d)}</span>
                                    </div>
                                    <div style={txNote} title={note}>
                                      {note}
                                    </div>
                                  </div>
                                  <div style={txAmount}>{Math.abs(Number(t.amount) || 0).toFixed(2)}€</div>
                                </div>
                              )
                            })}

                            {history.creditTxs.length > 12 && <div style={rowMuted}>Δείχνω τις 12 πιο πρόσφατες καταχωρήσεις.</div>}
                          </div>
                        )}

                        <div style={{ ...sectionTitle, marginTop: 14 }}>
                          {viewMode === 'income'
                            ? `Εισπράξεις (${history.settlementTxs.length})`
                            : `Εξοφλήσεις (${history.settlementTxs.length})`}
                        </div>

                        {history.settlementTxs.length === 0 ? (
                          <div style={rowMuted}>Δεν βρέθηκαν κινήσεις εξόφλησης/είσπραξης.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {history.settlementTxs.slice(0, 10).map((t: any) => {
                              const d = getTxDate(t)
                              const note =
                                String(t.notes || t.description || '').trim() ||
                                String(t.type || '').trim() ||
                                (viewMode === 'income' ? 'Είσπραξη' : 'Εξόφληση')

                              return (
                                <div key={t.id} style={txRow}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <div style={txDate}>{formatTxDate(d)}</div>
                                      <span style={tinyChip}>{daysAgoLabel(d)}</span>
                                    </div>
                                    <div style={txNote} title={note}>
                                      {note}
                                    </div>
                                  </div>
                                  <div style={{ ...txAmount, color: colors.accentGreen }}>
                                    {Math.abs(Number(t.amount) || 0).toFixed(2)}€
                                  </div>
                                </div>
                              )
                            })}

                            {history.settlementTxs.length > 10 && <div style={rowMuted}>Δείχνω τις 10 πιο πρόσφατες κινήσεις.</div>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      textAlign: 'right',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                      gap: '10px',
                      marginLeft: 12,
                      minWidth: 120,
                    }}
                  >
                    <p style={{ fontWeight: '950', fontSize: '18px', color: isIncome ? colors.accentGreen : colors.accentOrange, margin: 0 }}>
                      {(Number(s.balance) || 0).toFixed(2)}€
                    </p>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isIncome) {
                          router.push(`/add-income?store=${storeIdFromUrl}&sourceId=${s.id}&mode=debt`)
                        } else {
                          router.push(
                            `/add-expense?store=${storeIdFromUrl}&${s.entityType === 'supplier' ? 'supId' : 'assetId'}=${s.id}&mode=debt`
                          )
                        }
                      }}
                      style={{
                        ...payBtnStyle,
                        backgroundColor: actionBg,
                        border: actionBorder,
                        color: actionColor,
                      }}
                    >
                      <CreditCard size={14} /> {actionLabel}
                    </button>
                  </div>
                </div>
              )
            })
          ) : (
            <div style={emptyStateStyle}>Δεν υπάρχουν εκκρεμότητες</div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- STYLES ---
const iphoneWrapper: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100dvh',
  padding: '20px',
  position: 'relative',
}

const logoBoxStyle: any = {
  width: '45px',
  height: '45px',
  backgroundColor: '#fff7ed',
  borderRadius: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondaryText,
  backgroundColor: colors.white,
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '12px',
  border: `1px solid ${colors.border}`,
}

const switcherWrap: any = {
  display: 'flex',
  background: '#e2e8f0',
  padding: '4px',
  borderRadius: '14px',
  marginBottom: '20px',
}

const switchBtn: any = {
  flex: 1,
  padding: '12px',
  borderRadius: '10px',
  border: 'none',
  fontWeight: '950',
  fontSize: '12px',
  cursor: 'pointer',
}

const totalCardStyle: any = {
  padding: '26px 20px',
  borderRadius: '24px',
  marginBottom: '22px',
  textAlign: 'center',
  color: 'white',
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.15)',
}

const supplierCardStyle: any = {
  backgroundColor: colors.white,
  padding: '16px',
  borderRadius: '20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'stretch',
  border: `1px solid ${colors.border}`,
}

const payBtnStyle: any = {
  padding: '9px 12px',
  borderRadius: '12px',
  fontSize: '10px',
  fontWeight: '950',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  whiteSpace: 'nowrap',
}

const badgeStyle: any = {
  fontSize: '9px',
  fontWeight: '950',
  padding: '4px 8px',
  borderRadius: '8px',
  marginTop: '6px',
  display: 'inline-block',
  textTransform: 'uppercase',
}

const infoRow: any = { display: 'flex', alignItems: 'center', gap: '6px', color: colors.secondaryText }
const infoText: any = { fontSize: '11px', fontWeight: '800' }

const emptyStateStyle: any = {
  textAlign: 'center',
  padding: '60px 20px',
  background: colors.white,
  borderRadius: '24px',
  border: `2px dashed ${colors.border}`,
  color: colors.secondaryText,
  fontWeight: '800',
}

const selectStyle: any = {
  width: '100%',
  padding: '14px',
  borderRadius: '14px',
  border: `1px solid ${colors.border}`,
  fontSize: '13px',
  fontWeight: '800',
  backgroundColor: colors.white,
  outline: 'none',
  color: colors.primaryDark,
  appearance: 'none',
}

const detailsWrap: any = {
  marginTop: '14px',
  padding: '14px',
  borderRadius: '18px',
  background: '#f8fafc',
  border: `1px solid ${colors.border}`,
  width: '100%',
}

const detailsHeader: any = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '10px',
  color: colors.primaryDark,
}

const closeMiniBtn: any = {
  border: `1px solid ${colors.border}`,
  background: colors.white,
  borderRadius: '12px',
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: colors.secondaryText,
}

const miniSummaryRow: any = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 12,
}

const miniPill: any = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: 14,
  padding: '8px 10px',
}

const miniPillLabel: any = {
  fontSize: 10,
  fontWeight: 950,
  color: colors.secondaryText,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

const miniPillValue: any = {
  fontSize: 10,
  fontWeight: 950,
  color: colors.primaryDark,
}

const miniAmountChip: any = {
  fontSize: 10,
  fontWeight: 950,
  padding: '4px 10px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#f1f5f9',
  color: colors.primaryDark,
  letterSpacing: 0.2,
}

const sectionTitle: any = {
  fontSize: '11px',
  fontWeight: '950',
  color: colors.primaryDark,
  letterSpacing: '0.4px',
  marginBottom: '8px',
  textTransform: 'uppercase',
}

const txRow: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  padding: '10px',
  background: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: '16px',
}

const txDate: any = {
  fontSize: '11px',
  fontWeight: '950',
  color: colors.primaryDark,
}

const txNote: any = {
  fontSize: '11px',
  fontWeight: '800',
  color: colors.secondaryText,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
}

const txAmount: any = {
  fontSize: '12px',
  fontWeight: '950',
  color: colors.accentOrange,
  whiteSpace: 'nowrap',
}

const rowMuted: any = {
  fontSize: '11px',
  fontWeight: '800',
  color: colors.secondaryText,
  padding: '6px 2px',
}

const tinyChip: any = {
  fontSize: 9,
  fontWeight: 950,
  padding: '3px 8px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#f1f5f9',
  color: colors.secondaryText,
  textTransform: 'uppercase',
  letterSpacing: 0.2,
}

export default function SuppliersBalancePage() {
  return (
    <main style={{ backgroundColor: colors.bgLight, minHeight: '100vh' }}>
      <Suspense fallback={<div style={{ padding: '50px', textAlign: 'center' }}>Φόρτωση...</div>}>
        <BalancesContent />
      </Suspense>
    </main>
  )
}
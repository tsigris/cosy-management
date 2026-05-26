'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import {
  getSupplierBalanceComponents,
  isSupplierChargeTx,
  isSupplierCreditNoteTx,
  isSupplierPaymentTx,
} from '@/lib/supplierCreditNote'
import { toBusinessDayDateFromInput } from '@/lib/businessDate'
import {
  ChevronLeft,
  Receipt,
  CreditCard,
  Search,
  Copy,
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

type BalanceRow = {
  id: string
  store_id?: string
  name: string
  entityType: 'supplier' | 'asset' | 'revenue'
  sub_category?: string | null
  rf_code?: string | null
  bank_name?: string | null
  balance: number
}

const isValidUUID = (id: any) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof id === 'string' && regex.test(id)
}

const normalize = (v: any) => String(v ?? '').trim().toLowerCase()

function normalizeSearchText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ς/g, 'σ')
    .trim()
}

function greekToGreeklish(value: string) {
  const map: Record<string, string> = {
    α: 'a',
    β: 'v',
    γ: 'g',
    δ: 'd',
    ε: 'e',
    ζ: 'z',
    η: 'i',
    θ: 'th',
    ι: 'i',
    κ: 'k',
    λ: 'l',
    μ: 'm',
    ν: 'n',
    ξ: 'x',
    ο: 'o',
    π: 'p',
    ρ: 'r',
    σ: 's',
    τ: 't',
    υ: 'y',
    φ: 'f',
    χ: 'x',
    ψ: 'ps',
    ω: 'o',
  }

  return normalizeSearchText(value)
    .split('')
    .map((char) => map[char] ?? char)
    .join('')
}

// Date helpers (no automatic day shift)
const toBusinessDateNormalized = (d: Date) => new Date(d)

const getBusinessDayKey = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function BalancesContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdFromUrl = searchParams.get('store')

  const [viewMode, setViewMode] = useState<ViewMode>('expenses')
  const [loading, setLoading] = useState(true)
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all')
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [selectorSearch, setSelectorSearch] = useState('')

  const [rawTransactions, setRawTransactions] = useState<any[]>([])
  const [rawSuppliers, setRawSuppliers] = useState<any[]>([])
  const [rawAssets, setRawAssets] = useState<any[]>([])
  const [rawRevenueSources, setRawRevenueSources] = useState<any[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [voidingTxId, setVoidingTxId] = useState<string | null>(null)
  const fetchSeqRef = useRef(0)

  // ✅ YEAR SELECTOR (tab-aware)
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)

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

      const isMaintenance = sub === 'maintenance'
      const isUtility = sub === 'utility'

      if (isMaintenance) return { text: 'ΣΥΝΤΗΡΗΣΗ', bg: '#fef3c7', color: '#b45309' }
      if (isUtility) return { text: 'ΛΟΓΑΡΙΑΣΜΟΣ', bg: '#f1f5f9', color: colors.secondaryText }

      return { text: 'ΛΟΙΠΑ', bg: '#f1f5f9', color: colors.secondaryText }
    },
    [viewMode],
  )

  // -----------------------------
  // DATE + YEAR HELPERS
  // -----------------------------
  const getTxDate = (t: any) => {
    if (!t) return null
    const raw = t?.date
    const d = toBusinessDayDateFromInput(raw, { normalizeToNoon: true })
    return d && !isNaN(d.getTime()) ? d : null
  }

  const getTxYear = (t: any) => {
    const d = getTxDate(t)
    return d ? d.getFullYear() : null
  }

  const isTxInYear = (t: any, year: number) => {
    const y = getTxYear(t)
    return y === year
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

  // Uses stored date as-is (no automatic day shift)
  const daysAgoLabel = (d: Date | null) => {
    if (!d) return ''
    const now = new Date()

    const bdNow = toBusinessDateNormalized(now)
    const bdTx = toBusinessDateNormalized(d)

    const nowKey = getBusinessDayKey(bdNow)
    const txKey = getBusinessDayKey(bdTx)

    if (txKey === nowKey) return 'Σήμερα'

    const diffMs = bdNow.getTime() - bdTx.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return 'Χθες'
    if (diffDays < 0) return 'Μελλοντικό'
    return `${diffDays} μέρες πριν`
  }

  const money = (n: any) => Math.abs(Number(n) || 0).toFixed(2)

  // ✅ chip style by mode (income -> green, expenses -> blue)
  const amountChipStyle = (mode: ViewMode): any => {
    const isIncome = mode === 'income'
    return {
      ...miniAmountChip,
      background: isIncome ? '#ecfdf5' : '#eff6ff',
      border: isIncome ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
      color: isIncome ? '#065f46' : '#1d4ed8',
    }
  }

  // -----------------------------
  // YEAR OPTIONS (TAB-AWARE)
  // -----------------------------
  const RECEIVED_TYPES = useMemo(() => ['debt_payment', 'debt_received', 'income_collection'], [])

  const yearOptions = useMemo(() => {
    const years = new Set<number>()

    // Για UX: αν υπάρχει currentYear αλλά δεν υπάρχουν καθόλου κινήσεις, να φαίνεται μόνο το currentYear
    // (αλλιώς θα βγει κενό dropdown)
    let foundAny = false

    for (const t of rawTransactions) {
      // Tab relevance:
      const isIncome = viewMode === 'income'
      const relevantForTab = isIncome ? !!t?.revenue_source_id : !!t?.supplier_id || !!t?.fixed_asset_id
      if (!relevantForTab) continue

      // Balances relevance (credit ή settlement):
      const isCredit = isIncome ? t?.is_credit === true : isSupplierChargeTx(t) || isSupplierCreditNoteTx(t)
      const isSettlement = isIncome
        ? RECEIVED_TYPES.includes(String(t?.type || ''))
        : isSupplierPaymentTx(t)

      if (!isCredit && !isSettlement) continue

      const y = getTxYear(t)
      if (y) {
        years.add(y)
        foundAny = true
      }
    }

    if (!foundAny) years.add(currentYear)

    return Array.from(years).sort((a, b) => b - a)
  }, [rawTransactions, viewMode, RECEIVED_TYPES, currentYear])

  // ✅ Default selectedYear: currentYear if exists, else most recent
  useEffect(() => {
    if (!yearOptions.length) return
    const next = yearOptions.includes(currentYear) ? currentYear : yearOptions[0]
    setSelectedYear(next)
  }, [viewMode, yearOptions, currentYear])

  // -----------------------------
  // ENTITY TRANSACTIONS (FILTERED BY YEAR)
  // -----------------------------
  const getEntityTransactions = (entity: any, transactions: any[], mode: ViewMode, year: number) => {
    const isIncome = mode === 'income'

    const entityTrans = transactions
      .filter((t) => !!t)
      .filter((t) => {
        if (isIncome) return t?.revenue_source_id === entity.id
        return entity.entityType === 'supplier' ? t?.supplier_id === entity.id : t?.fixed_asset_id === entity.id
      })
      .filter((t) => isTxInYear(t, year)) // ✅ YEAR FILTER

    const creditTxs = entityTrans
      .filter((t) =>
        isIncome
          ? t?.is_credit === true
          : isSupplierChargeTx(t) || String(t?.type || '').trim().toLowerCase() === 'supplier_credit_note',
      )
      .sort((a, b) => (getTxDate(b)?.getTime() || 0) - (getTxDate(a)?.getTime() || 0))

    const settlementTxs = isIncome
      ? entityTrans
          .filter((t) => RECEIVED_TYPES.includes(String(t?.type || '')))
          .sort((a, b) => (getTxDate(b)?.getTime() || 0) - (getTxDate(a)?.getTime() || 0))
        : entityTrans
          .filter((t) => isSupplierPaymentTx(t))
          .sort((a, b) => (getTxDate(b)?.getTime() || 0) - (getTxDate(a)?.getTime() || 0))

    const latestCreditDate = creditTxs.length ? getTxDate(creditTxs[0]) : null
    const oldestCreditDate = creditTxs.length ? getTxDate(creditTxs[creditTxs.length - 1]) : null

    const latestSettlementTx = settlementTxs.length ? settlementTxs[0] : null
    const latestSettlementDate = latestSettlementTx ? getTxDate(latestSettlementTx) : null
    const latestSettlementAmount = latestSettlementTx ? Math.abs(Number(latestSettlementTx.amount) || 0) : null

    const expenseComponents = isIncome
      ? null
      : getSupplierBalanceComponents(entityTrans.filter((t) => !!t && (t?.supplier_id === entity.id || t?.fixed_asset_id === entity.id)))

    const totalCreditAmount = isIncome
      ? creditTxs.reduce((acc, t) => acc + Math.abs(Number(t?.amount) || 0), 0)
      : Number(expenseComponents?.charges || 0)
    const totalSettlementAmount = isIncome
      ? settlementTxs.reduce((acc, t) => acc + Math.abs(Number(t?.amount) || 0), 0)
      : Number(expenseComponents?.payments || 0)
    const totalCreditNotesAmount = isIncome ? 0 : Number(expenseComponents?.creditNotes || 0)

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
      totalCreditNotesAmount,
      openBalance: expenseComponents?.openBalance ?? null,
    }
  }

  const buildExpenseBalanceList = useCallback((transactions: any[], suppliers: any[], assets: any[], year: number): BalanceRow[] => {
    const txYearFiltered = transactions.filter((t) => !!t && isTxInYear(t, year))

    const allEntities: Array<{ id: string; store_id?: string; name: string; entityType: 'supplier' | 'asset'; sub_category?: string | null }> = [
      ...suppliers,
      ...assets,
    ]

    return allEntities
      .map((entity) => {
        const isSupplier = entity.entityType === 'supplier'

        const entityTrans = txYearFiltered.filter((t) =>
          isSupplier ? t?.supplier_id === entity.id : t?.fixed_asset_id === entity.id,
        )

        const { openBalance } = getSupplierBalanceComponents(entityTrans)

        return {
          ...entity,
          balance: openBalance,
        }
      })
      .filter((e) => Math.abs(e.balance) > 0.1)
      .sort((a, b) => b.balance - a.balance)
  }, [])

  const buildIncomeBalanceList = useCallback(
    (transactions: any[], revenueSources: any[], year: number): BalanceRow[] => {
      const txYearFiltered = transactions.filter((t) => !!t && isTxInYear(t, year))

      return revenueSources
        .map((src) => {
          const srcTrans = txYearFiltered.filter((t) => t?.revenue_source_id === src.id)

          const totalCredit = srcTrans
            .filter((t) => t.is_credit === true)
            .reduce((acc, t) => acc + Math.abs(Number(t?.amount) || 0), 0)

          const totalReceived = srcTrans
            .filter((t) => RECEIVED_TYPES.includes(String(t?.type || '')))
            .reduce((acc, t) => acc + Math.abs(Number(t?.amount) || 0), 0)

          return {
            ...src,
            balance: totalCredit - totalReceived,
          }
        })
        .filter((e) => Math.abs(e.balance) > 0.1)
        .sort((a, b) => b.balance - a.balance)
    },
    [RECEIVED_TYPES],
  )

  // -----------------------------
  // FETCH + COMPUTE BALANCES (YEAR-AWARE)
  // -----------------------------
  const fetchBalances = useCallback(async () => {
    if (!storeIdFromUrl || !isValidUUID(storeIdFromUrl)) {
      setLoading(false)
      return
    }

    const fetchId = ++fetchSeqRef.current

    try {
      setLoading(true)

      const transactionSelect =
        'id, store_id, created_at, date, type, amount, category, notes, is_credit, supplier_id, fixed_asset_id, revenue_source_id, linked_invoice_tx_id, supplier_credit_note_number, voided_at, voided_by, void_reason'

      console.log('RUNNING QUERY: transactions', { select: transactionSelect })
      const transRes = await supabase
        .from('transactions')
        .select(transactionSelect)
        .eq('store_id', storeIdFromUrl)
      if (transRes.error) {
        console.error('RAW QUERY ERROR', transRes.error)
        console.error('Suppliers balance transactions query failed', {
          message: transRes.error.message,
          details: transRes.error.details,
          hint: transRes.error.hint,
          query: {
            table: 'transactions',
            select: transactionSelect,
            filters: {
              store_id: storeIdFromUrl,
            },
          },
        })
        throw transRes.error
      }
      const transactions = transRes.data || []
      if (fetchId !== fetchSeqRef.current) return
      setRawTransactions(transactions)

      if (viewMode === 'expenses') {
        const suppliersSelect = 'id, store_id, name'
        const fixedAssetsSelect = 'id, store_id, name, sub_category'
        console.log('RUNNING QUERY: suppliers', { select: suppliersSelect })
        console.log('RUNNING QUERY: fixed_assets', { select: fixedAssetsSelect })
        const [supsRes, assetsRes] = await Promise.all([
          supabase.from('suppliers').select(suppliersSelect).eq('store_id', storeIdFromUrl),
          supabase.from('fixed_assets').select(fixedAssetsSelect).eq('store_id', storeIdFromUrl),
        ])

        if (supsRes.error) {
          console.error('RAW QUERY ERROR', supsRes.error)
          console.error('Suppliers balance suppliers query failed', {
            message: supsRes.error.message,
            details: supsRes.error.details,
            hint: supsRes.error.hint,
            query: {
              table: 'suppliers',
              select: suppliersSelect,
              filters: { store_id: storeIdFromUrl },
            },
          })
          throw supsRes.error
        }
        if (assetsRes.error) {
          console.error('RAW QUERY ERROR', assetsRes.error)
          console.error('Suppliers balance fixed_assets query failed', {
            message: assetsRes.error.message,
            details: assetsRes.error.details,
            hint: assetsRes.error.hint,
            query: {
              table: 'fixed_assets',
              select: fixedAssetsSelect,
              filters: { store_id: storeIdFromUrl },
            },
          })
          throw assetsRes.error
        }

        const suppliers = (supsRes.data || []).map((s) => ({ ...s, entityType: 'supplier' }))

        const assets = (assetsRes.data || [])
          .filter((a) => {
            const sub = normalize(a?.sub_category)
            return (
              sub === 'maintenance' ||
              sub === 'utility' ||
              sub === 'other'
            )
          })
          .map((a) => ({ ...a, entityType: 'asset' }))

        if (fetchId !== fetchSeqRef.current) return

        setRawSuppliers(suppliers)
        setRawAssets(assets)
        setRawRevenueSources([])
        return
      }

      const revenueSourcesSelect = 'id, store_id, name'
      console.log('RUNNING QUERY: revenue_sources', { select: revenueSourcesSelect })
      const revRes = await supabase.from('revenue_sources').select(revenueSourcesSelect).eq('store_id', storeIdFromUrl)
      if (revRes.error) {
        console.error('RAW QUERY ERROR', revRes.error)
        console.error('Suppliers balance revenue_sources query failed', {
          message: revRes.error.message,
          details: revRes.error.details,
          hint: revRes.error.hint,
          query: {
            table: 'revenue_sources',
            select: revenueSourcesSelect,
            filters: { store_id: storeIdFromUrl },
          },
        })
        throw revRes.error
      }

      const revenueSources = (revRes.data || []).map((r) => ({ ...r, entityType: 'revenue' }))

      if (fetchId !== fetchSeqRef.current) return

      setRawRevenueSources(revenueSources)
      setRawSuppliers([])
      setRawAssets([])
    } catch (err: any) {
      console.error('Suppliers balance load failed', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        viewMode,
        selectedYear,
      })
      toast.error('Σφάλμα κατά τον υπολογισμό υπολοίπων')
    } finally {
      if (fetchId === fetchSeqRef.current) {
        setLoading(false)
      }
    }
  }, [storeIdFromUrl, viewMode, selectedYear, buildExpenseBalanceList, buildIncomeBalanceList])

  const handleVoidSupplierCreditNote = useCallback(
    async (tx: any) => {
      if (!tx?.id || !storeIdFromUrl) return
      if (tx?.voided_at) {
        toast.error('Το πιστωτικό είναι ήδη ακυρωμένο')
        return
      }

      const reasonRaw = window.prompt('Αιτιολογία ακύρωσης (υποχρεωτικό):', '')
      const reason = String(reasonRaw || '').trim()
      if (!reason) {
        toast.error('Η αιτιολογία ακύρωσης είναι υποχρεωτική')
        return
      }

      const ok = window.confirm('Θες σίγουρα να ακυρώσεις αυτό το πιστωτικό; Η κίνηση θα παραμείνει στο ιστορικό για audit.')
      if (!ok) return

      try {
        setVoidingTxId(String(tx.id))
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.user?.id) throw new Error('Δεν βρέθηκε ενεργό session')

        const { error } = await supabase
          .from('transactions')
          .update({
            voided_at: new Date().toISOString(),
            voided_by: session.user.id,
            void_reason: reason,
          })
          .eq('id', tx.id)
          .eq('store_id', storeIdFromUrl)
          .eq('type', 'supplier_credit_note')
          .is('voided_at', null)

        if (error) throw error

        toast.success('Το πιστωτικό ακυρώθηκε')
        await fetchBalances()
      } catch (e: any) {
        toast.error(e?.message || 'Αποτυχία ακύρωσης πιστωτικού')
      } finally {
        setVoidingTxId(null)
      }
    },
    [fetchBalances, storeIdFromUrl, supabase],
  )

  useEffect(() => {
    if (!storeIdFromUrl || !isValidUUID(storeIdFromUrl)) {
      router.replace('/select-store')
    } else {
      fetchBalances()

      const onFocus = () => {
        fetchBalances()
      }

      const onVisibility = () => {
        if (!document.hidden) fetchBalances()
      }

      window.addEventListener('focus', onFocus)
      document.addEventListener('visibilitychange', onVisibility)

      return () => {
        window.removeEventListener('focus', onFocus)
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }, [fetchBalances, storeIdFromUrl, router])

  // όταν αλλάζει έτος, reset selection για να μην “κολλάει” σε entity που δεν έχει υπόλοιπο φέτος
  useEffect(() => {
    setSelectedEntityId('all')
    setExpandedId(null)
  }, [selectedYear])

  const computedBalanceList = useMemo(() => {
    if (viewMode === 'expenses') {
      return buildExpenseBalanceList(rawTransactions, rawSuppliers, rawAssets, selectedYear)
        .filter((row) => row.entityType === 'supplier')
    }

    return buildIncomeBalanceList(rawTransactions, rawRevenueSources, selectedYear)
  }, [
    rawTransactions,
    rawSuppliers,
    rawAssets,
    rawRevenueSources,
    viewMode,
    selectedYear,
    buildExpenseBalanceList,
    buildIncomeBalanceList,
  ])

  useEffect(() => {
    if (viewMode !== 'expenses') return
    console.log('[expenses-visible-rows]', computedBalanceList)
  }, [viewMode, computedBalanceList])

  const filteredData = useMemo(() => {
    if (selectedEntityId === 'all') return computedBalanceList
    return computedBalanceList.filter((s) => s.id === selectedEntityId)
  }, [selectedEntityId, computedBalanceList])

  const totalRowsForDisplay = useMemo(() => {
    if (viewMode === 'expenses') {
      return filteredData.filter((row) => row.entityType === 'supplier')
    }

    return filteredData
  }, [viewMode, filteredData])

  const totalDisplay = useMemo(
    () => totalRowsForDisplay.reduce((acc, s) => acc + (Number(s.balance) || 0), 0),
    [totalRowsForDisplay],
  )

  const totalCardBg = viewMode === 'income' ? colors.accentGreen : colors.primaryDark
  const totalLabel = viewMode === 'income' ? 'ΣΥΝΟΛΙΚΟ ΑΝΟΙΧΤΟ ΥΠΟΛΟΙΠΟ ΕΣΟΔΩΝ' : 'ΣΥΝΟΛΙΚΟ ΑΝΟΙΧΤΟ ΥΠΟΛΟΙΠΟ ΕΞΟΔΩΝ'
  const selectTitle = viewMode === 'income' ? 'ΟΛΕΣ ΟΙ ΠΗΓΕΣ ΕΣΟΔΩΝ' : 'ΟΛΕΣ ΟΙ ΟΦΕΙΛΕΣ'

  const selectorOptions = useMemo(
    () =>
      computedBalanceList.map((s) => ({
        id: s.id,
        label: String(s.name || '').toUpperCase(),
      })),
    [computedBalanceList],
  )

  const selectedEntityLabel = useMemo(() => {
    if (selectedEntityId === 'all') return selectTitle
    return selectorOptions.find((option) => option.id === selectedEntityId)?.label || selectTitle
  }, [selectedEntityId, selectorOptions, selectTitle])

  const filteredSelectorOptions = useMemo(() => {
    const q = normalizeSearchText(selectorSearch)
    if (!q) return selectorOptions

    const qGreeklish = greekToGreeklish(selectorSearch)

    return selectorOptions.filter((option) => {
      const normalizedLabel = normalizeSearchText(option.label)
      const greeklishLabel = greekToGreeklish(option.label)

      return (
        normalizedLabel.includes(q) ||
        greeklishLabel.includes(q) ||
        normalizedLabel.includes(qGreeklish) ||
        greeklishLabel.includes(qGreeklish)
      )
    })
  }, [selectorOptions, selectorSearch])

  const handleSelectEntity = useCallback((id: string) => {
    setSelectedEntityId(id)
    setSelectorOpen(false)
  }, [])

  useEffect(() => {
    if (!selectorOpen) {
      setSelectorSearch('')
    }
  }, [selectorOpen])

  useEffect(() => {
    const rowsSum = totalRowsForDisplay.reduce((s, r) => s + (Number(r?.balance) || 0), 0)
    const diff = Math.abs(rowsSum - totalDisplay)
    console.assert(diff < 0.0001, '[cards-balance-consistency]', {
      rowsSum,
      totalDisplay,
      diff,
      filteredCount: filteredData.length,
      totalSourceCount: totalRowsForDisplay.length,
      selectedEntityId,
      selectedYear,
      viewMode,
    })
  }, [filteredData, totalRowsForDisplay, totalDisplay, selectedEntityId, selectedYear, viewMode])

  useEffect(() => {
    console.log('[balances-final-check]', {
      viewMode,
      selectedYear,
      selectedEntityId,
      rows: filteredData.map((r) => ({
        id: r.id,
        name: r.name,
        balance: r.balance,
      })),
      totalSourceRows: totalRowsForDisplay.map((r) => ({
        id: r.id,
        name: r.name,
        entityType: r.entityType,
        balance: r.balance,
      })),
      totalDisplay,
    })
  }, [viewMode, selectedYear, selectedEntityId, filteredData, totalRowsForDisplay, totalDisplay])

  useEffect(() => {
    if (viewMode !== 'expenses') return

    console.log('[expenses-supplier-only-total]', {
      selectedEntityId,
      supplierRowsUsedForTotal: totalRowsForDisplay.map((r) => ({
        id: r.id,
        name: r.name,
        entityType: r.entityType,
        balance: r.balance,
      })),
      totalDisplay,
    })
  }, [viewMode, selectedEntityId, totalRowsForDisplay, totalDisplay])

  useEffect(() => {
    if (viewMode !== 'expenses') return

    const sample = computedBalanceList.slice(0, 10).map((row) => {
      const entityTrans = rawTransactions.filter((t) =>
        row.entityType === 'supplier'
          ? t?.supplier_id === row.id
          : t?.fixed_asset_id === row.id,
      )

      const components = getSupplierBalanceComponents(entityTrans)

      return {
        id: row.id,
        name: row.name,
        charges: components.charges,
        payments: components.payments,
        creditNotes: components.creditNotes,
        balance: row.balance,
      }
    })

    console.log('[expense-balance-proof]', sample)
  }, [viewMode, computedBalanceList, rawTransactions])

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
              <h1 style={{ fontWeight: '900', fontSize: '20px', margin: 0, color: 'var(--text)' }}>Καρτέλες</h1>
              <p style={{ margin: 0, fontSize: '10px', color: 'var(--muted)', fontWeight: '800', letterSpacing: '1px' }}>
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
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          >
            ΕΞΟΔΑ
          </button>
          <button
            onClick={() => setViewMode('income')}
            style={{
              ...switchBtn,
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          >
            ΕΣΟΔΑ
          </button>
        </div>

        {/* ✅ YEAR SELECTOR (TAB-AWARE) */}
        <div style={{ marginBottom: '18px' }}>
          <label style={smallLabel}>ΕΤΟΣ</label>
          <select value={String(selectedYear)} onChange={(e) => setSelectedYear(Number(e.target.value))} style={selectStyle}>
            {yearOptions.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* SELECT FILTER */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setSelectorOpen(true)} style={selectorOpenBtnStyle}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedEntityLabel}</span>
              <ChevronDown size={16} />
            </button>

            {selectorOpen && (
              <div style={selectorModalOverlay} onClick={() => setSelectorOpen(false)}>
                <div style={selectorModalCard} onClick={(e) => e.stopPropagation()}>
                  <div style={selectorModalHeader}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 950, color: 'var(--text)' }}>Επιλογή καρτέλας</h3>
                    <button type="button" style={selectorCloseBtn} onClick={() => setSelectorOpen(false)} aria-label="Κλείσιμο">
                      <X size={16} />
                    </button>
                  </div>

                  <div style={selectorSearchWrap}>
                    <Search size={14} color="var(--muted)" />
                    <input
                      value={selectorSearch}
                      onChange={(e) => setSelectorSearch(e.target.value)}
                      placeholder="Αναζήτηση καρτέλας..."
                      style={selectorSearchInput}
                    />
                  </div>

                  <div style={selectorListWrap}>
                    {normalizeSearchText(selectorSearch) === '' && (
                      <button type="button" style={selectorOptionRow} onClick={() => handleSelectEntity('all')}>
                        <span style={{ ...selectorCircle, ...(selectedEntityId === 'all' ? selectorCircleSelected : {}) }} />
                        <span style={selectorOptionLabel}>{selectTitle}</span>
                      </button>
                    )}

                    {filteredSelectorOptions.map((option) => (
                      <button key={option.id} type="button" style={selectorOptionRow} onClick={() => handleSelectEntity(option.id)}>
                        <span style={{ ...selectorCircle, ...(selectedEntityId === option.id ? selectorCircleSelected : {}) }} />
                        <span style={selectorOptionLabel}>{option.label}</span>
                      </button>
                    ))}

                    {filteredSelectorOptions.length === 0 && (
                      <div style={selectorNoResults}>Δεν βρέθηκε καρτέλα</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TOTAL CARD */}
        <div style={{ ...totalCardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0.95 }}>
            <Wallet size={14} color="#fff" />
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>
              {totalLabel} ({selectedYear})
            </p>
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '38px', fontWeight: '950', color: 'var(--text)' }}>
            {totalDisplay.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '10px', fontWeight: '800', color: 'var(--muted)', opacity: 0.85 }}>
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

              const history = getEntityTransactions(s, rawTransactions, viewMode, selectedYear)

              const summaryLine = history.latestCreditDate
                ? `Τελευταία καταχώρηση: ${formatTxDate(history.latestCreditDate)} (${daysAgoLabel(history.latestCreditDate)})`
                : '—'

              return (
                <div
                  key={s.id}
                  style={{
                    ...supplierCardStyle,
                    cursor: 'pointer',
                    border: '1px solid var(--border)',
                    boxShadow: isExpanded ? '0 14px 40px rgba(15, 23, 42, 0.10)' : '0 6px 18px rgba(15, 23, 42, 0.06)',
                  }}
                  onClick={() => setExpandedId((prev) => (prev === s.id ? null : s.id))}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <p style={{ fontWeight: '900', margin: 0, fontSize: '15px', color: 'var(--text)' }}>
                            {String(s.name || '').toUpperCase()}
                          </p>

                          <span style={{ ...badgeStyle, backgroundColor: 'var(--surface)', color: 'var(--muted)' }}>
                            {badge.text}
                          </span>
                        </div>

                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {s.rf_code && (
                            <div style={infoRow}>
                              <Hash size={12} />
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={infoText}>RF: {s.rf_code}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigator.clipboard.writeText(String(s.rf_code))
                                    toast.success('Το RF αντιγράφηκε!')
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px',
                                  }}
                                  title="Αντιγραφή RF"
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={detailsWrap} onClick={(e) => e.stopPropagation()}>
                        <div style={detailsHeader}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Calendar size={14} />
                            <span style={{ fontWeight: 950, fontSize: 12, letterSpacing: 0.2 }}>
                              {viewMode === 'income' ? 'ΙΣΤΟΡΙΚΟ ΑΠΑΙΤΗΣΕΩΝ' : 'ΙΣΤΟΡΙΚΟ ΟΦΕΙΛΩΝ'} ({selectedYear})
                            </span>
                          </div>

                          <button style={closeMiniBtn} onClick={() => setExpandedId(null)} title="Κλείσιμο">
                            <X size={14} />
                          </button>
                        </div>

                        <div style={miniSummaryRow}>
                          <div style={miniPill}>
                            <span style={miniPillLabel}>Πρώτη καταχώρηση</span>
                            <span style={miniPillValue}>{history.oldestCreditDate ? formatTxDate(history.oldestCreditDate) : '—'}</span>
                          </div>

                          <div style={miniPill}>
                            <span style={miniPillLabel}>Τελευταία καταχώρηση</span>
                            <span style={miniPillValue}>{history.latestCreditDate ? formatTxDate(history.latestCreditDate) : '—'}</span>
                          </div>

                          <div style={miniPill}>
                            <span style={miniPillLabel}>{viewMode === 'income' ? 'Τελευταία είσπραξη' : 'Τελευταία εξόφληση'}</span>

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

                          {viewMode === 'expenses' && (
                            <div style={miniPill}>
                              <span style={miniPillLabel}>Σύνολο πιστωτικών</span>
                              <span style={{ ...miniPillValue, color: colors.accentGreen }}>{history.totalCreditNotesAmount.toFixed(2)}€</span>
                            </div>
                          )}

                          <div style={miniPill}>
                            <span style={miniPillLabel}>{viewMode === 'income' ? 'Σύνολο εισπράξεων' : 'Σύνολο εξοφλήσεων'}</span>
                            <span style={miniPillValue}>{history.totalSettlementAmount.toFixed(2)}€</span>
                          </div>

                          {viewMode === 'expenses' && history.openBalance !== null && (
                            <div style={miniPill}>
                              <span style={miniPillLabel}>Υπόλοιπο (χρεώσεις-πληρωμές-πιστωτικά)</span>
                              <span style={miniPillValue}>{Number(history.openBalance || 0).toFixed(2)}€</span>
                            </div>
                          )}
                        </div>

                        <div style={sectionTitle}>
                          {viewMode === 'income' ? `Απαιτήσεις (${history.creditTxs.length})` : `Χρεώσεις (${history.creditTxs.length})`}
                        </div>

                        {history.creditTxs.length === 0 ? (
                          <div style={rowMuted}>Δεν βρέθηκαν καταχωρήσεις.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {history.creditTxs.slice(0, 12).map((t: any) => {
                              const d = getTxDate(t)
                              const isCreditNote = isSupplierCreditNoteTx(t)
                              const note =
                                String(t?.notes || '').trim() ||
                                String(t?.category || t?.type || '').trim() ||
                                (viewMode === 'income' ? 'Απαίτηση' : 'Χρέωση')

                              return (
                                <div key={t.id} style={txRow}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <div style={txDate}>{formatTxDate(d)}</div>
                                      <span style={tinyChip}>{daysAgoLabel(d)}</span>
                                    </div>
                                    <div style={txNote} title={note}>
                                      {isCreditNote ? 'Πιστωτικό Τιμολόγιο' : note}
                                    </div>
                                    {t?.voided_at && (
                                      <div style={{ ...rowMuted, color: colors.accentRed, marginTop: 2 }}>
                                        VOID: {String(t?.void_reason || 'Χωρίς αιτιολογία')}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                    <div
                                      style={{
                                        ...txAmount,
                                        color: isCreditNote ? colors.accentGreen : txAmount.color,
                                      }}
                                    >
                                      {Math.abs(Number(t?.amount) || 0).toFixed(2)}€
                                    </div>
                                    {isCreditNote && !t?.voided_at && s.entityType === 'supplier' && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleVoidSupplierCreditNote(t)
                                        }}
                                        style={{
                                          border: '1px solid #fecaca',
                                          background: '#fef2f2',
                                          color: colors.accentRed,
                                          borderRadius: 8,
                                          padding: '4px 8px',
                                          fontSize: 11,
                                          fontWeight: 900,
                                          cursor: voidingTxId === String(t.id) ? 'wait' : 'pointer',
                                          opacity: voidingTxId === String(t.id) ? 0.7 : 1,
                                        }}
                                        disabled={voidingTxId === String(t.id)}
                                      >
                                        {voidingTxId === String(t.id) ? 'ΑΚΥΡΩΣΗ...' : 'VOID'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}

                            {history.creditTxs.length > 12 && <div style={rowMuted}>Δείχνω τις 12 πιο πρόσφατες καταχωρήσεις.</div>}
                          </div>
                        )}

                        <div style={{ ...sectionTitle, marginTop: 14 }}>
                          {viewMode === 'income' ? `Εισπράξεις (${history.settlementTxs.length})` : `Εξοφλήσεις (${history.settlementTxs.length})`}
                        </div>

                        {history.settlementTxs.length === 0 ? (
                          <div style={rowMuted}>Δεν βρέθηκαν κινήσεις εξόφλησης/είσπραξης.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {history.settlementTxs.slice(0, 10).map((t: any) => {
                              const d = getTxDate(t)
                              const note =
                                String(t?.notes || '').trim() ||
                                String(t?.type || '').trim() ||
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
                                    {Math.abs(Number(t?.amount) || 0).toFixed(2)}€
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
                    <p
                      style={{
                        fontWeight: '950',
                        fontSize: '18px',
                        color: isIncome ? colors.accentGreen : colors.accentOrange,
                        margin: 0,
                      }}
                    >
                      {(Number(s.balance) || 0).toFixed(2)}€
                    </p>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isIncome) {
                          router.push(`/add-income?store=${storeIdFromUrl}&sourceId=${s.id}&mode=debt`)
                        } else {
                          router.push(
                            `/add-expense?store=${storeIdFromUrl}&${s.entityType === 'supplier' ? 'supId' : 'assetId'}=${s.id}&mode=debt`,
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

                    {!isIncome && s.entityType === 'supplier' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/add-expense?store=${storeIdFromUrl}&supId=${s.id}&mode=credit-note`)
                        }}
                        style={{
                          ...payBtnStyle,
                          marginTop: 6,
                          backgroundColor: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#065f46',
                        }}
                      >
                        <Receipt size={14} /> ΠΙΣΤΩΤΙΚΟ
                      </button>
                    )}
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
  background: 'var(--bg-grad)',
  minHeight: '100vh',
  padding: '20px',
  position: 'relative',
}

const logoBoxStyle: any = {
  width: '45px',
  height: '45px',
  background: 'var(--surface)',
  borderRadius: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const backBtnStyle: any = {
  textDecoration: 'none',
  color: 'var(--muted)',
  background: 'var(--surface)',
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '12px',
  border: '1px solid var(--border)',
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

const smallLabel: any = {
  fontSize: 10,
  fontWeight: 950,
  color: 'var(--muted)',
  marginBottom: 6,
  letterSpacing: 0.8,
}

const totalCardStyle: any = {
  padding: '26px 20px',
  borderRadius: '24px',
  marginBottom: '22px',
  textAlign: 'center',
  color: 'var(--text)',
  background: 'var(--surface)',
  boxShadow: 'var(--shadow)',
}

const supplierCardStyle: any = {
  background: 'var(--surface)',
  padding: '16px',
  borderRadius: '20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'stretch',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)',
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

const infoRow: any = { display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted)' }
const infoText: any = { fontSize: '11px', fontWeight: '800' }

const emptyStateStyle: any = {
  textAlign: 'center',
  padding: '60px 20px',
  background: 'var(--surface)',
  borderRadius: '24px',
  border: '2px dashed var(--border)',
  color: 'var(--muted)',
  fontWeight: '800',
}

const selectStyle: any = {
  width: '100%',
  padding: '14px',
  borderRadius: '14px',
  border: '1px solid var(--border)',
  fontSize: '13px',
  fontWeight: '800',
  background: 'var(--surface)',
  outline: 'none',
  color: 'var(--text)',
  appearance: 'none',
}

const selectorOpenBtnStyle: any = {
  ...selectStyle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  cursor: 'pointer',
}

const selectorModalOverlay: any = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.38)',
  zIndex: 1000,
  overflowX: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
}

const selectorModalCard: any = {
  width: 'min(92vw, 560px)',
  maxWidth: 560,
  maxHeight: '80vh',
  overflow: 'hidden',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.18)',
  display: 'flex',
  flexDirection: 'column',
  padding: 14,
}

const selectorModalHeader: any = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 10,
}

const selectorCloseBtn: any = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--muted)',
  width: 32,
  height: 32,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}

const selectorSearchWrap: any = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '10px 12px',
  marginBottom: 10,
  background: 'var(--surface)',
}

const selectorSearchInput: any = {
  flex: 1,
  border: 'none',
  outline: 'none',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text)',
  background: 'transparent',
}

const selectorListWrap: any = {
  flex: 1,
  minHeight: 0,
  marginTop: 12,
  overflowY: 'auto',
  overflowX: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingRight: 4,
}

const selectorOptionRow: any = {
  appearance: 'none',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  borderRadius: 12,
  padding: '12px 14px',
  cursor: 'pointer',
  boxSizing: 'border-box',
  overflowX: 'hidden',

  width: '100%',
  maxWidth: '100%',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 12,

  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 800,
  textAlign: 'left',
}

const selectorCircle: any = {
  flex: '0 0 auto',
  width: 16,
  height: 16,
  borderRadius: 999,
  border: '2px solid #94a3b8',
  background: '#ffffff',
  boxSizing: 'border-box',
}

const selectorCircleSelected: any = {
  borderColor: '#2563eb',
  boxShadow: 'inset 0 0 0 4px #2563eb',
}

const selectorOptionLabel: any = {
  flex: '1 1 auto',
  minWidth: 0,
  maxWidth: '100%',
  textAlign: 'left',
  fontWeight: 700,
  lineHeight: 1.25,
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
  writingMode: 'horizontal-tb',
  textOrientation: 'mixed',
}

const selectorNoResults: any = {
  textAlign: 'center',
  padding: '14px 10px',
  color: 'var(--muted)',
  fontSize: 13,
  fontWeight: 800,
}

const detailsWrap: any = {
  marginTop: '14px',
  padding: '14px',
  borderRadius: '18px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  width: '100%',
}

const detailsHeader: any = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '10px',
  color: 'var(--text)',
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
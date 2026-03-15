'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, Suspense, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
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
  Layers,
  List,
  SlidersHorizontal,
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
type CreditsView = 'entity' | 'date' | 'method' | 'movements'

const isValidUUID = (id: any) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof id === 'string' && regex.test(id)
}

const normalize = (v: any) => String(v ?? '').trim().toLowerCase()

function getPaymentMethodFromTx(tx: any) {
  return String(tx?.payment_method ?? tx?.method ?? '').trim()
}

function isCreditLike(tx: any) {
  if (!tx) return false
  if (tx?.is_credit === true) return true
  return getPaymentMethodFromTx(tx).toLowerCase() === 'πίστωση'
}

// ✅ BUSINESS DAY HELPERS (07:00 cutoff)
const toBusinessDayDate = (d: Date) => {
  const bd = new Date(d)
  if (bd.getHours() < 7) bd.setDate(bd.getDate() - 1)
  bd.setHours(12, 0, 0, 0)
  return bd
}

const getBusinessDayKey = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const formatBDKey = (key: string) => {
  // key: YYYY-MM-DD
  const [y, m, d] = key.split('-')
  if (!y || !m || !d) return key
  return `${d}/${m}/${y}`
}

type Tx = {
  id: string
  store_id: string
  created_at?: string | null
  date?: string | null
  type?: string | null
  amount?: number | string | null
  category?: string | null
  method?: string | null
  notes?: string | null
  description?: string | null
  is_credit?: boolean | null
  supplier_id?: string | null
  fixed_asset_id?: string | null
  revenue_source_id?: string | null
}

type EntityInfo = {
  id: string
  name: string
  entityType: 'supplier' | 'asset' | 'revenue'
  sub_category?: string | null
  category?: string | null
  rf_code?: string | null
  bank_name?: string | null
}

type GroupItem = {
  key: string
  title: string
  subtitle?: string
  count: number
  total: number
  txs: Tx[]
  badgeText?: string
  badgeBg?: string
  badgeColor?: string
}

function CreditsContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdFromParams = searchParams.get('store')

  const [storeId, setStoreId] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('expenses')
  const [creditsView, setCreditsView] = useState<CreditsView>('entity')

  const [allTx, setAllTx] = useState<Tx[]>([])
  const [entities, setEntities] = useState<Record<string, EntityInfo>>({})
  const [loading, setLoading] = useState(true)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string>('all')

  // ✅ YEAR SELECTOR (tab-aware)
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)

  useEffect(() => {
    setExpandedId(null)
    setSelectedKey('all')
  }, [viewMode, creditsView, selectedYear])

  // -----------------------------
  // DATE + YEAR HELPERS
  // -----------------------------
  const getTxDate = (t: Tx) => {
    const raw = t?.created_at || t?.date
    if (!raw) return null
    const d = new Date(raw)
    return !isNaN(d.getTime()) ? d : null
  }

  const getTxYear = (t: Tx) => {
    const d = getTxDate(t)
    return d ? d.getFullYear() : null
  }

  const isTxInYear = (t: Tx, year: number) => getTxYear(t) === year

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

  const daysAgoLabel = (d: Date | null) => {
    if (!d) return ''
    const now = new Date()
    const bdNow = toBusinessDayDate(now)
    const bdTx = toBusinessDayDate(d)

    const nowKey = getBusinessDayKey(bdNow)
    const txKey = getBusinessDayKey(bdTx)
    if (txKey === nowKey) return 'Σήμερα'

    const diffMs = bdNow.getTime() - bdTx.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 1) return 'Χθες'
    if (diffDays < 0) return 'Μελλοντικό'
    return `${diffDays} μέρες πριν`
  }

  const moneyAbs = (n: any) => Math.abs(Number(n) || 0)

  // -----------------------------
  // BADGES (same feel as your balances)
  // -----------------------------
  const getEntityBadge = useCallback(
    (entity?: EntityInfo | null) => {
      if (viewMode === 'income') {
        return { text: 'ΑΠΑΙΤΗΣΗ', bg: '#ecfdf5', color: '#065f46' }
      }
      if (!entity) return { text: 'ΛΟΙΠΑ', bg: '#f1f5f9', color: colors.secondaryText }
      if (entity.entityType === 'supplier') {
        return { text: 'ΕΜΠΟΡΕΥΜΑΤΑ', bg: '#f1f5f9', color: colors.secondaryText }
      }

      const sub = normalize(entity.sub_category)
      const cat = normalize(entity.category)

      const isMaintenance = sub === 'maintenance' || cat === 'maintenance'
      const isUtility = sub === 'utility' || cat === 'utility'

      if (isMaintenance) return { text: 'ΣΥΝΤΗΡΗΣΗ', bg: '#fef3c7', color: '#b45309' }
      if (isUtility) return { text: 'ΛΟΓΑΡΙΑΣΜΟΣ', bg: '#f1f5f9', color: colors.secondaryText }
      return { text: 'ΛΟΙΠΑ', bg: '#f1f5f9', color: colors.secondaryText }
    },
    [viewMode],
  )

  // -----------------------------
  // FETCH (transactions + entities)
  // -----------------------------
  const fetchAll = useCallback(async () => {
    if (!storeId || !isValidUUID(storeId)) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // 1) transactions
      const transRes = await supabase
        .from('transactions')
        .select(
          'id, store_id, created_at, date, type, amount, category, method, notes, is_credit, supplier_id, fixed_asset_id, revenue_source_id',
        )
        .eq('store_id', storeId)

      if (transRes.error) {
        console.error('Transactions query error', transRes.error)
        throw transRes.error
      }
      const txs: Tx[] = (transRes.data || []) as any
      setAllTx(txs)

      // 2) entities for names
      const [supsRes, assetsRes, revRes] = await Promise.all([
        supabase.from('suppliers').select('id, name, bank_name').eq('store_id', storeId),
        supabase.from('fixed_assets').select('id, name, sub_category, category').eq('store_id', storeId),
        supabase.from('revenue_sources').select('id, name').eq('store_id', storeId),
      ])

      if (supsRes.error) {
        console.error('Suppliers query error', supsRes.error)
        throw supsRes.error
      }
      if (assetsRes.error) {
        console.error('Fixed assets query error', assetsRes.error)
        throw assetsRes.error
      }
      if (revRes.error) {
        console.error('Revenue sources query error', revRes.error)
        throw revRes.error
      }

      const map: Record<string, EntityInfo> = {}

      for (const s of supsRes.data || []) {
        map[String(s.id)] = {
          id: String(s.id),
          name: String(s.name || ''),
          entityType: 'supplier',
          rf_code: (s as any).rf_code ?? null,
          bank_name: (s as any).bank_name ?? null,
        }
      }

      for (const a of assetsRes.data || []) {
        map[String(a.id)] = {
          id: String(a.id),
          name: String((a as any).name || ''),
          entityType: 'asset',
          sub_category: (a as any).sub_category ?? null,
          category: (a as any).category ?? null,
        }
      }

      for (const r of revRes.data || []) {
        map[String(r.id)] = {
          id: String(r.id),
          name: String((r as any).name || ''),
          entityType: 'revenue',
        }
      }

      setEntities(map)
    } catch (e: any) {
      console.error(e)
      toast.error('Σφάλμα φόρτωσης δεδομένων Πιστώσεων')
    } finally {
      setLoading(false)
    }
  }, [storeId, supabase])

  useEffect(() => {
    const id = storeIdFromParams || (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null)
    setStoreId(id)
  }, [storeIdFromParams])

  useEffect(() => {
    if (!storeId) return
    if (!isValidUUID(storeId)) {
      router.replace('/select-store')
      return
    }
    fetchAll()
  }, [fetchAll, storeId, router])

  // -----------------------------
  // CREDIT TX FILTER (year + mode + relevant entity)
  // -----------------------------
  const creditTxs = useMemo(() => {
    const isIncome = viewMode === 'income'
    return allTx
      .filter((t) => isCreditLike(t))
      .filter((t) => isTxInYear(t, selectedYear))
      .filter((t) => {
        if (isIncome) return !!t.revenue_source_id
        return !!t.supplier_id || !!t.fixed_asset_id
      })
      .sort((a, b) => (getTxDate(b)?.getTime() || 0) - (getTxDate(a)?.getTime() || 0))
  }, [allTx, viewMode, selectedYear])

  // -----------------------------
  // YEAR OPTIONS (TAB-AWARE, credit-only)
  // -----------------------------
  const yearOptions = useMemo(() => {
    const years = new Set<number>()
    let foundAny = false
    const isIncome = viewMode === 'income'

    for (const t of allTx) {
      if (!isCreditLike(t)) continue

      const relevantForTab = isIncome ? !!t?.revenue_source_id : !!t?.supplier_id || !!t?.fixed_asset_id
      if (!relevantForTab) continue

      const y = getTxYear(t)
      if (y) {
        years.add(y)
        foundAny = true
      }
    }

    if (!foundAny) years.add(currentYear)
    return Array.from(years).sort((a, b) => b - a)
  }, [allTx, viewMode, currentYear])

  useEffect(() => {
    if (!yearOptions.length) return
    const next = yearOptions.includes(currentYear) ? currentYear : yearOptions[0]
    setSelectedYear(next)
  }, [yearOptions, currentYear, viewMode])

  // -----------------------------
  // HELPERS: entity key/title per tx
  // -----------------------------
  const getTxEntityKey = (t: Tx): string | null => {
    if (viewMode === 'income') return t.revenue_source_id ? String(t.revenue_source_id) : null
    if (t.supplier_id) return String(t.supplier_id)
    if (t.fixed_asset_id) return String(t.fixed_asset_id)
    return null
  }

  const getTxEntityTitle = (t: Tx): { title: string; subtitle?: string; badge?: { text: string; bg: string; color: string } } => {
    const key = getTxEntityKey(t)
    const ent = key ? entities[key] : null

    if (viewMode === 'income') {
      return {
        title: String(ent?.name || 'ΠΗΓΗ ΕΣΟΔΟΥ'),
        subtitle: 'Πηγή εσόδου',
        badge: { text: 'ΑΠΑΙΤΗΣΗ', bg: '#ecfdf5', color: '#065f46' },
      }
    }

    const badge = getEntityBadge(ent || undefined)
    return {
      title: String(ent?.name || 'ΟΝΤΟΤΗΤΑ'),
      subtitle: ent?.entityType === 'supplier' ? 'Προμηθευτής' : 'Πάγιο',
      badge,
    }
  }

  // -----------------------------
  // GROUPING (fixes your “g.total / g.count” errors by defining GroupItem)
  // -----------------------------
  const groups: GroupItem[] = useMemo(() => {
    const map = new Map<string, GroupItem>()

    const add = (key: string, base: Omit<GroupItem, 'count' | 'total' | 'txs'>, tx: Tx) => {
      const prev = map.get(key)
      const amt = moneyAbs(tx.amount)
      if (!prev) {
        map.set(key, {
          key,
          title: base.title,
          subtitle: base.subtitle,
          badgeText: base.badgeText,
          badgeBg: base.badgeBg,
          badgeColor: base.badgeColor,
          count: 1,
          total: amt,
          txs: [tx],
        })
      } else {
        prev.count += 1
        prev.total += amt
        prev.txs.push(tx)
      }
    }

    for (const t of creditTxs) {
      if (creditsView === 'entity') {
        const ek = getTxEntityKey(t)
        if (!ek) continue
        const info = getTxEntityTitle(t)
        add(
          ek,
          {
            key: ek,
            title: info.title,
            subtitle: info.subtitle,
            badgeText: info.badge?.text,
            badgeBg: info.badge?.bg,
            badgeColor: info.badge?.color,
          },
          t,
        )
        continue
      }

      if (creditsView === 'date') {
        const d = getTxDate(t)
        if (!d) continue
        const bdKey = getBusinessDayKey(toBusinessDayDate(d))
        add(
          bdKey,
          {
            key: bdKey,
            title: formatBDKey(bdKey),
            subtitle: 'Business Day',
            badgeText: 'ΗΜΕΡΑ',
            badgeBg: '#f1f5f9',
            badgeColor: colors.secondaryText,
          },
          t,
        )
        continue
      }

      if (creditsView === 'method') {
        const m = String(t.method || 'Χωρίς Μέθοδο').trim() || 'Χωρίς Μέθοδο'
        add(
          m,
          {
            key: m,
            title: m.toUpperCase(),
            subtitle: 'Μέθοδος',
            badgeText: 'ΜΕΘΟΔΟΣ',
            badgeBg: '#f1f5f9',
            badgeColor: colors.secondaryText,
          },
          t,
        )
        continue
      }
    }

    const arr = Array.from(map.values()).map((g) => ({
      ...g,
      txs: g.txs.sort((a, b) => (getTxDate(b)?.getTime() || 0) - (getTxDate(a)?.getTime() || 0)),
    }))

    // sort: most total first (entity/method), newest first (date)
    if (creditsView === 'date') {
      return arr.sort((a, b) => {
        // YYYY-MM-DD string sort desc works
        return String(b.key).localeCompare(String(a.key))
      })
    }

    return arr.sort((a, b) => b.total - a.total)
  }, [creditTxs, creditsView, entities, viewMode, getEntityBadge])

  // Movements view is just list (no groups)
  const movements = useMemo(() => {
    return creditTxs
  }, [creditTxs])

  // selector options for grouped views
  const selectOptions = useMemo(() => {
    if (creditsView === 'movements') return []
    return groups.map((g) => ({ id: g.key, name: g.title }))
  }, [groups, creditsView])

  const filteredGroups = useMemo(() => {
    if (creditsView === 'movements') return []
    if (selectedKey === 'all') return groups
    return groups.filter((g) => g.key === selectedKey)
  }, [groups, selectedKey, creditsView])

  const totalDisplay = useMemo(() => {
    if (creditsView === 'movements') return movements.reduce((acc, t) => acc + moneyAbs(t.amount), 0)
    return filteredGroups.reduce((acc, g) => acc + (Number(g.total) || 0), 0)
  }, [filteredGroups, creditsView, movements])

  // -----------------------------
  // UI labels
  // -----------------------------
  const isIncome = viewMode === 'income'
  const headerTitle = 'Οικονομικό Κέντρο'
  const headerSubtitle = 'ΠΙΣΤΩΣΕΙΣ'
  const totalLabel = isIncome ? 'ΣΥΝΟΛΟ ΠΙΣΤΩΤΙΚΩΝ ΑΠΑΙΤΗΣΕΩΝ' : 'ΣΥΝΟΛΟ ΠΙΣΤΩΤΙΚΩΝ ΟΦΕΙΛΩΝ'

  const viewLabel =
    creditsView === 'entity'
      ? 'Ανά Οντότητα'
      : creditsView === 'date'
        ? 'Ανά Ημέρα'
        : creditsView === 'method'
          ? 'Ανά Μέθοδο'
          : 'Όλες οι Κινήσεις'

  // -----------------------------
  // Render
  // -----------------------------
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
              <h1 style={{ fontWeight: '900', fontSize: '20px', margin: 0, color: 'var(--text)' }}>{headerTitle}</h1>
              <p style={{ margin: 0, fontSize: '10px', color: 'var(--muted)', fontWeight: '800', letterSpacing: '1px' }}>
                {headerSubtitle}
              </p>
            </div>
          </div>
          <Link href={`/?store=${storeId || ''}`} style={backBtnStyle}>
            <ChevronLeft size={20} />
          </Link>
        </div>

        {/* MODE SWITCHER */}
        <div style={switcherWrap}>
          <button
            onClick={() => setViewMode('expenses')}
            style={{
              ...switchBtn,
              background: viewMode === 'expenses' ? 'var(--surface)' : 'transparent',
              color: 'var(--text)',
            }}
          >
            ΕΞΟΔΑ
          </button>
          <button
            onClick={() => setViewMode('income')}
            style={{
              ...switchBtn,
              background: viewMode === 'income' ? 'var(--surface)' : 'transparent',
              color: 'var(--text)',
            }}
          >
            ΕΣΟΔΑ
          </button>
        </div>

        {/* VIEW SWITCHER */}
        <div style={viewWrap}>
          <button
            onClick={() => setCreditsView('entity')}
            style={{ ...viewBtn, background: creditsView === 'entity' ? 'var(--surface)' : 'transparent' }}
            title="Ανά Οντότητα"
          >
            <Layers size={14} /> Οντότητα
          </button>
          <button
            onClick={() => setCreditsView('date')}
            style={{ ...viewBtn, background: creditsView === 'date' ? 'var(--surface)' : 'transparent' }}
            title="Ανά Ημέρα"
          >
            <Calendar size={14} /> Ημέρα
          </button>
          <button
            onClick={() => setCreditsView('method')}
            style={{ ...viewBtn, background: creditsView === 'method' ? 'var(--surface)' : 'transparent' }}
            title="Ανά Μέθοδο"
          >
            <SlidersHorizontal size={14} /> Μέθοδος
          </button>
          <button
            onClick={() => setCreditsView('movements')}
            style={{ ...viewBtn, background: creditsView === 'movements' ? 'var(--surface)' : 'transparent' }}
            title="Όλες οι κινήσεις"
          >
            <List size={14} /> Κινήσεις
          </button>
        </div>

        {/* YEAR SELECTOR */}
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

        {/* GROUP SELECT (only for grouped views) */}
        {creditsView !== 'movements' && (
          <div style={{ marginBottom: '18px' }}>
            <label style={smallLabel}>ΠΡΟΒΟΛΗ</label>
            <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} style={selectStyle}>
              <option value="all">
                {viewLabel.toUpperCase()} ({selectOptions.length})
              </option>
              {selectOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {String(o.name || '').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

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
            Προβολή: {viewLabel} • {isIncome ? 'Έσοδα' : 'Έξοδα'}
          </p>
        </div>

        {/* LIST AREA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>Υπολογισμός...</div>
          ) : creditsView === 'movements' ? (
            movements.length ? (
              movements.map((t) => {
                const d = getTxDate(t)
                const ent = getTxEntityTitle(t)
                const note =
                  String(t.notes || t.description || '').trim() ||
                  String(t.category || t.type || '').trim() ||
                  (isIncome ? 'Απαίτηση' : 'Οφειλή')

                return (
                  <div key={t.id} style={movementCard}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <p style={{ fontWeight: '900', margin: 0, fontSize: '14px', color: 'var(--text)' }}>
                            {String(ent.title || '').toUpperCase()}
                          </p>
                          <span
                            style={{
                              ...badgeStyle,
                              backgroundColor: 'var(--surface)',
                              color: 'var(--muted)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            ΠΙΣΤΩΣΗ
                          </span>
                          <span style={tinyChip}>{daysAgoLabel(d)}</span>
                        </div>

                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={infoRow}>
                            <Clock3 size={12} />
                            <span style={infoText}>{formatTxDate(d)}</span>
                          </div>
                          <div style={infoRow}>
                            <Hash size={12} />
                            <span style={infoText}>{note}</span>
                          </div>
                          {t.method && (
                            <div style={infoRow}>
                              <CreditCard size={12} />
                              <span style={infoText}>{String(t.method).toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          fontWeight: 950,
                          fontSize: 16,
                          color: isIncome ? colors.accentGreen : colors.accentOrange,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {moneyAbs(t.amount).toFixed(2)}€
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={emptyStateStyle}>Δεν υπάρχουν πιστωτικές κινήσεις</div>
            )
          ) : filteredGroups.length ? (
            filteredGroups.map((g) => {
              const isExpanded = expandedId === g.key
              const badgeText = g.badgeText || 'ΠΙΣΤΩΣΗ'
              const badgeBg = g.badgeBg || 'var(--surface)'
              const badgeColor = g.badgeColor || 'var(--muted)'

              const summaryDate = g.txs.length ? getTxDate(g.txs[0]) : null
              const summaryLine = summaryDate
                ? `Τελευταία κίνηση: ${formatTxDate(summaryDate)} (${daysAgoLabel(summaryDate)})`
                : '—'

              return (
                <div
                  key={g.key}
                  style={{
                    ...supplierCardStyle,
                    cursor: 'pointer',
                    border: '1px solid var(--border)',
                    boxShadow: isExpanded ? '0 14px 40px rgba(15, 23, 42, 0.10)' : '0 6px 18px rgba(15, 23, 42, 0.06)',
                  }}
                  onClick={() => setExpandedId((prev) => (prev === g.key ? null : g.key))}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <p style={{ fontWeight: '900', margin: 0, fontSize: '15px', color: 'var(--text)' }}>
                            {String(g.title || '').toUpperCase()}
                          </p>

                          <span style={{ ...badgeStyle, backgroundColor: badgeBg, color: badgeColor, border: '1px solid var(--border)' }}>
                            {badgeText}
                          </span>
                        </div>

                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {g.subtitle && (
                            <div style={infoRow}>
                              <Landmark size={12} />
                              <span style={infoText}>{String(g.subtitle).toUpperCase()}</span>
                            </div>
                          )}
                          <div style={{ ...infoRow, marginTop: 2 }}>
                            <Clock3 size={12} />
                            <span style={infoText}>{summaryLine}</span>
                          </div>
                          <div style={infoRow}>
                            <Layers size={12} />
                            <span style={infoText}>Κινήσεις: {g.count}</span>
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
                              ΙΣΤΟΡΙΚΟ ΠΙΣΤΩΣΕΩΝ ({selectedYear})
                            </span>
                          </div>

                          <button style={closeMiniBtn} onClick={() => setExpandedId(null)} title="Κλείσιμο">
                            <X size={14} />
                          </button>
                        </div>

                        <div style={miniSummaryRow}>
                          <div style={miniPill}>
                            <span style={miniPillLabel}>Σύνολο πιστώσεων</span>
                            <span style={miniPillValue}>{g.total.toFixed(2)}€</span>
                          </div>
                          <div style={miniPill}>
                            <span style={miniPillLabel}>Πλήθος κινήσεων</span>
                            <span style={miniPillValue}>{g.count}</span>
                          </div>
                        </div>

                        <div style={sectionTitle}>Κινήσεις (τελευταίες 12)</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {g.txs.slice(0, 12).map((t) => {
                            const d = getTxDate(t)
                            const note =
                              String(t.notes || t.description || '').trim() ||
                              String(t.category || t.type || '').trim() ||
                              'Πίστωση'
                            const method = String(t.method || '').trim()

                            return (
                              <div key={t.id} style={txRow}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <div style={txDate}>{formatTxDate(d)}</div>
                                    <span style={tinyChip}>{daysAgoLabel(d)}</span>
                                    {method && <span style={{ ...tinyChip, textTransform: 'none' }}>{method}</span>}
                                  </div>
                                  <div style={txNote} title={note}>
                                    {note}
                                  </div>
                                </div>
                                <div style={txAmount}>{moneyAbs(t.amount).toFixed(2)}€</div>
                              </div>
                            )
                          })}
                          {g.txs.length > 12 && <div style={rowMuted}>Δείχνω τις 12 πιο πρόσφατες κινήσεις.</div>}
                        </div>

                        {/* CTA */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => {
                              // “mode=debt” flows you already have; using your existing pages
                              if (viewMode === 'income') {
                                // if grouped by entity, key is revenue_source_id
                                if (creditsView === 'entity') router.push(`/add-income?store=${storeId}&sourceId=${g.key}&mode=debt`)
                                  else router.push(`/add-income?store=${storeId}&mode=debt`)
                              } else {
                                if (creditsView === 'entity') {
                                  const ent = entities[g.key]
                                  if (ent?.entityType === 'supplier') router.push(`/add-expense?store=${storeId}&supId=${g.key}&mode=debt`)
                                  else router.push(`/add-expense?store=${storeId}&assetId=${g.key}&mode=debt`)
                                } else {
                                  router.push(`/add-expense?store=${storeId}&mode=debt`)
                                }
                              }
                            }}
                            style={{
                              ...payBtnStyle,
                              backgroundColor: isIncome ? '#ecfdf5' : '#eff6ff',
                              border: isIncome ? '1px solid #a7f3d0' : '1px solid #dbeafe',
                              color: isIncome ? '#065f46' : colors.accentBlue,
                            }}
                          >
                            <CreditCard size={14} /> {isIncome ? 'ΕΙΣΠΡΑΞΗ' : 'ΕΞΟΦΛΗΣΗ'}
                          </button>
                        </div>
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
                      {g.total.toFixed(2)}€
                    </p>
                    <div style={{ fontSize: 10, fontWeight: 900, color: 'var(--muted)' }}>{g.count} κινήσεις</div>
                  </div>
                </div>
              )
            })
          ) : (
            <div style={emptyStateStyle}>Δεν υπάρχουν πιστώσεις για το {selectedYear}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- STYLES (same style language as your page) ---
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
  marginBottom: '12px',
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

const viewWrap: any = {
  display: 'flex',
  gap: 8,
  background: '#e2e8f0',
  padding: '4px',
  borderRadius: '14px',
  marginBottom: '20px',
  flexWrap: 'wrap',
}

const viewBtn: any = {
  flex: 1,
  minWidth: 110,
  padding: '10px 10px',
  borderRadius: '10px',
  border: 'none',
  fontWeight: '950',
  fontSize: '11px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  color: 'var(--text)',
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

const movementCard: any = {
  background: 'var(--surface)',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid var(--border)',
  boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)',
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

export default function CreditsPage() {
  return (
    <main style={{ backgroundColor: colors.bgLight, minHeight: '100vh' }}>
      <Suspense fallback={<div style={{ padding: '50px', textAlign: 'center' }}>Φόρτωση...</div>}>
        <CreditsContent />
      </Suspense>
    </main>
  )
}
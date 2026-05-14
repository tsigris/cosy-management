'use client'

import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TrendingDown, TrendingUp, Minus, CalendarDays, BarChart3 } from 'lucide-react'
import { useAnalysisComparison } from '@/hooks/useAnalysisComparison'
import type { FinancialMetricComparison } from '@/types/analysisComparison'

const positive = '#10b981'
const negative = '#ef4444'
const neutral = '#64748b'
const ink = '#0f172a'
const border = '#e2e8f0'
const surface = '#ffffff'
const surfaceAlt = '#f8fafc'
const amber = '#f59e0b'
const blue = '#0ea5e9'

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}€`
}

function formatCompactMoney(value: number) {
  return `${Number(value || 0).toLocaleString('el-GR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}€`
}

function formatPercent(value: number | null) {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '' : ''
  return `${sign}${value.toFixed(1)}%`
}

function formatDeltaMoney(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatMoney(value)}`
}

function tooltipMoneyFormatter(value: number | string | undefined) {
  return formatMoney(Number(value || 0))
}

function trendColor(metric: FinancialMetricComparison, positiveWhenUp = true) {
  if (metric.trend === 'flat') return neutral
  if (positiveWhenUp) return metric.trend === 'up' ? positive : negative
  return metric.trend === 'up' ? negative : positive
}

function TrendIcon({ metric, positiveWhenUp = true }: { metric: FinancialMetricComparison; positiveWhenUp?: boolean }) {
  const color = trendColor(metric, positiveWhenUp)

  if (metric.trend === 'up') return <TrendingUp size={16} color={color} />
  if (metric.trend === 'down') return <TrendingDown size={16} color={color} />
  return <Minus size={16} color={color} />
}

function ComparisonMetricCard({
  title,
  metric,
  formatter = formatMoney,
  inverse = false,
}: {
  title: string
  metric: FinancialMetricComparison
  formatter?: (value: number) => string
  inverse?: boolean
}) {
  const color = trendColor(metric, !inverse)

  return (
    <div
      style={{
        background: surface,
        border: `1px solid ${border}`,
        borderRadius: 16,
        padding: 14,
        boxShadow: 'var(--shadow)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: neutral }}>{title}</div>
        <TrendIcon metric={metric} positiveWhenUp={!inverse} />
      </div>
      <div style={{ marginTop: 10, fontSize: 21, lineHeight: 1.1, fontWeight: 950, color: ink }}>
        {formatter(metric.current)}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: neutral }}>
        Πέρυσι: {formatter(metric.previous)}
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            borderRadius: 999,
            padding: '5px 9px',
            background: `${color}14`,
            color,
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          {formatDeltaMoney(metric.delta)}
        </span>
        <span style={{ fontSize: 12, fontWeight: 900, color }}>{formatPercent(metric.deltaPct)}</span>
      </div>
    </div>
  )
}

export default function AnalysisComparisonPanel({
  storeId,
  fromDate,
  toDate,
  enabled,
}: {
  storeId: string | null
  fromDate: string
  toDate: string
  enabled: boolean
}) {
  const { data, loading, error } = useAnalysisComparison({
    storeId,
    fromDate,
    toDate,
    enabled,
  })
  const [chartMode, setChartMode] = useState<'calendar' | 'weekday'>('calendar')
  const [showDetails, setShowDetails] = useState(false)

  const dailyRevenueChart = useMemo(() => {
    if (!data) return []
    return data.daily.map((row) => ({
      label: row.label,
      revenueNow: row.currentRevenue,
      revenuePrev: row.previousRevenue,
      cumulativeNow: row.currentCumulativeRevenue,
      cumulativePrev: row.previousCumulativeRevenue,
      zNow: row.currentZTotal,
      zPrev: row.previousZTotal,
      weekdays: `${row.currentWeekday} / ${row.previousWeekday}`,
    }))
  }, [data])

  if (!enabled) return null

  return (
    <section
      style={{
        marginTop: 12,
        marginBottom: 12,
        background: 'linear-gradient(180deg, #f8fafc, #ffffff)',
        border: `1px solid ${border}`,
        borderRadius: 22,
        padding: 16,
        boxShadow: 'var(--shadow)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: neutral, fontWeight: 900, fontSize: 12 }}>
            <BarChart3 size={15} /> Σύγκριση Έτους προς Έτος
          </div>
          <h3 style={{ margin: '8px 0 6px', fontSize: 22, lineHeight: 1.15, fontWeight: 950, color: ink }}>
            Τρέχουσα περίοδος vs ίδια περίοδος πέρυσι
          </h3>
          <div style={{ fontSize: 13, fontWeight: 800, color: neutral }}>
            {data ? `${data.periods.current.label} • έναντι • ${data.periods.previous.label}` : 'Φόρτωση σύγκρισης...'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setChartMode('calendar')}
            style={{
              ...toggleButton,
              ...(chartMode === 'calendar' ? toggleButtonActive : null),
            }}
          >
            Ημέρα προς Ημέρα
          </button>
          <button
            type="button"
            onClick={() => setChartMode('weekday')}
            style={{
              ...toggleButton,
              ...(chartMode === 'weekday' ? toggleButtonActive : null),
            }}
          >
            Κανονικοποίηση Weekday
          </button>
        </div>
      </div>

      {loading ? (
        <div style={messageBox}>Φόρτωση συγκριτικής ανάλυσης...</div>
      ) : error ? (
        <div style={{ ...messageBox, color: negative }}>Σφάλμα: {error}</div>
      ) : !data ? (
        <div style={messageBox}>Δεν υπάρχουν διαθέσιμα δεδομένα σύγκρισης.</div>
      ) : (
        <>
          <div style={periodBanner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, color: ink }}>
              <CalendarDays size={15} />
              Περίοδος σύγκρισης {data.periods.current.days} ημερών
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: neutral }}>
              Αυτόματη αντιστοίχιση με ισοδύναμο εύρος προηγούμενου έτους
            </div>
          </div>

          <div style={metricGrid}>
            <ComparisonMetricCard title="Συνολικά Έσοδα" metric={data.summary.totalRevenue} />
            <ComparisonMetricCard title="Έσοδα Μετρητών" metric={data.summary.cashRevenue} />
            <ComparisonMetricCard title="Έσοδα Κάρτας" metric={data.summary.cardRevenue} />
            <ComparisonMetricCard title="Μέσο Ημερήσιο Έσοδο" metric={data.summary.averageDailyRevenue} />
            <ComparisonMetricCard title="Κινήσεις Εσόδων" metric={data.summary.transactionCount} formatter={(value) => `${value.toLocaleString('el-GR')}`} />
            <ComparisonMetricCard title="Μέσο Ticket" metric={data.summary.averageTicket} />
            <ComparisonMetricCard title="Κέρδος" metric={data.summary.profit} />
            <ComparisonMetricCard title="Έξοδα" metric={data.summary.expenses} inverse />
            <ComparisonMetricCard title="Μισθοδοσία %" metric={data.summary.payrollPct} formatter={(value) => `${value.toFixed(2)}%`} inverse />
            <ComparisonMetricCard title="Σύνολο Z" metric={data.summary.zTotals} />
            <ComparisonMetricCard title="Σύνολο Πιστώσεων" metric={data.summary.creditTotals} inverse />
          </div>

          {chartMode === 'calendar' ? (
            <div style={chartStack}>
              <div style={chartCard}>
                <div style={chartTitle}>Έσοδα ανά Ημέρα</div>
                <div style={chartSubtitle}>Η ίδια θέση στο range συγκρίνεται με την περσινή αντίστοιχη ημέρα.</div>
                <div style={chartFrame}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyRevenueChart} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={72} tickFormatter={formatCompactMoney} />
                      <Tooltip formatter={tooltipMoneyFormatter} labelFormatter={(label, payload) => {
                        const row = payload?.[0]?.payload
                        return `${label} • ${row?.weekdays || ''}`
                      }} />
                      <Legend />
                      <Bar dataKey="revenueNow" name="Τώρα" fill={positive} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="revenuePrev" name="Πέρυσι" fill={blue} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={chartCard}>
                <div style={chartTitle}>Σωρευτικά Έσοδα</div>
                <div style={chartSubtitle}>Συγκρίνει τη συσσωρευμένη πορεία εσόδων μέρα με μέρα.</div>
                <div style={chartFrame}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyRevenueChart} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={72} tickFormatter={formatCompactMoney} />
                      <Tooltip formatter={tooltipMoneyFormatter} />
                      <Legend />
                      <Area type="monotone" dataKey="cumulativeNow" name="Τώρα" stroke={positive} fill="#10b98122" />
                      <Area type="monotone" dataKey="cumulativePrev" name="Πέρυσι" stroke={blue} fill="#0ea5e922" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div style={chartCard}>
              <div style={chartTitle}>Weekday Normalization</div>
              <div style={chartSubtitle}>Μέσο έσοδο ανά ημέρα εβδομάδας για να συγκρίνεις Δευτέρα με Δευτέρα.</div>
              <div style={chartFrame}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.weekdayNormalized} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="weekday" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={72} tickFormatter={formatCompactMoney} />
                    <Tooltip formatter={tooltipMoneyFormatter} />
                    <Legend />
                    <Line type="monotone" dataKey="currentAverageRevenue" name="Τώρα" stroke={positive} strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="previousAverageRevenue" name="Πέρυσι" stroke={blue} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={() => setShowDetails((value) => !value)}
              style={{ ...toggleButton, width: '100%', justifyContent: 'center' }}
            >
              {showDetails ? 'Απόκρυψη αναλυτικών ημερών' : 'Προβολή αναλυτικών ημερών'}
            </button>
          </div>

          {showDetails && (
            <div style={detailsCard}>
              <div style={{ fontSize: 13, fontWeight: 900, color: ink, marginBottom: 10 }}>Αναλυτική σύγκριση ημερών</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.daily.map((row) => (
                  <div key={row.offset} style={detailRow}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: ink }}>{row.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: neutral }}>
                        {row.currentWeekday} vs {row.previousWeekday}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: ink }}>{formatMoney(row.currentRevenue)}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: neutral }}>πέρυσι {formatMoney(row.previousRevenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

const metricGrid: React.CSSProperties = {
  marginTop: 16,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
  gap: 12,
}

const chartStack: React.CSSProperties = {
  marginTop: 16,
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 12,
}

const chartCard: React.CSSProperties = {
  background: surface,
  border: `1px solid ${border}`,
  borderRadius: 18,
  padding: 14,
  boxShadow: 'var(--shadow)',
}

const chartFrame: React.CSSProperties = {
  marginTop: 12,
  width: '100%',
  height: 280,
}

const chartTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 950,
  color: ink,
}

const chartSubtitle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  fontWeight: 700,
  color: neutral,
}

const periodBanner: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 16,
  border: `1px solid ${border}`,
  background: surfaceAlt,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const messageBox: React.CSSProperties = {
  marginTop: 16,
  borderRadius: 16,
  border: `1px solid ${border}`,
  background: surfaceAlt,
  padding: 18,
  fontWeight: 800,
  color: neutral,
}

const toggleButton: React.CSSProperties = {
  borderRadius: 999,
  border: `1px solid ${border}`,
  background: surface,
  color: ink,
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 900,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

const toggleButtonActive: React.CSSProperties = {
  background: ink,
  color: '#ffffff',
  borderColor: ink,
}

const detailsCard: React.CSSProperties = {
  marginTop: 12,
  background: surface,
  border: `1px solid ${border}`,
  borderRadius: 18,
  padding: 14,
  boxShadow: 'var(--shadow)',
}

const detailRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '10px 0',
  borderTop: `1px solid ${border}`,
}

import { TrendingDown, TrendingUp } from 'lucide-react'
import type { CSSProperties } from 'react'
import { formatAmount } from '@/lib/formatters'

type DailyPerformanceCardProps = {
  incomeToday: number
  incomeAvg: number
  expenseToday: number
  expenseAvg: number
  weekdayLabel: string
}

type SectionTone = {
  percentColor: string
  iconBg: string
  iconColor: string
  progressGradient: string
  insightText: string
  comparisonText: string
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function money(value: number): string {
  return `${formatAmount(Number(value) || 0)}€`
}

function getSectionTone(kind: 'income' | 'expense', diff: number): SectionTone {
  if (kind === 'income') {
    if (diff > 0) {
      return {
        percentColor: '#047857',
        iconBg: '#ecfdf5',
        iconColor: '#047857',
        progressGradient: 'linear-gradient(90deg, #34d399 0%, #059669 100%)',
        insightText: 'Υψηλότερα από το συνηθισμένο',
        comparisonText: 'πάνω από τον μέσο όρο',
      }
    }

    if (diff < 0) {
      return {
        percentColor: '#be123c',
        iconBg: '#fff1f2',
        iconColor: '#be123c',
        progressGradient: 'linear-gradient(90deg, #34d399 0%, #059669 100%)',
        insightText: 'Χαμηλότερα από το συνηθισμένο',
        comparisonText: 'κάτω από τον μέσο όρο',
      }
    }

    return {
      percentColor: '#047857',
      iconBg: '#ecfdf5',
      iconColor: '#047857',
      progressGradient: 'linear-gradient(90deg, #34d399 0%, #059669 100%)',
      insightText: 'Σταθερά έσοδα',
      comparisonText: 'στον μέσο όρο',
    }
  }

  if (diff > 0) {
    return {
      percentColor: '#be123c',
      iconBg: '#fff1f2',
      iconColor: '#be123c',
      progressGradient: 'linear-gradient(90deg, #fb7185 0%, #e11d48 100%)',
      insightText: 'Αυξημένα έξοδα',
      comparisonText: 'πάνω από τον μέσο όρο',
    }
  }

  if (diff < 0) {
    return {
      percentColor: '#047857',
      iconBg: '#ecfdf5',
      iconColor: '#047857',
      progressGradient: 'linear-gradient(90deg, #fb7185 0%, #e11d48 100%)',
      insightText: 'Ελεγχόμενα έξοδα',
      comparisonText: 'κάτω από τον μέσο όρο',
    }
  }

  return {
    percentColor: '#be123c',
    iconBg: '#fff1f2',
    iconColor: '#be123c',
    progressGradient: 'linear-gradient(90deg, #fb7185 0%, #e11d48 100%)',
    insightText: 'Σταθερά έξοδα',
    comparisonText: 'στον μέσο όρο',
  }
}

function PerformanceSection({
  kind,
  label,
  today,
  average,
  weekdayLabel,
}: {
  kind: 'income' | 'expense'
  label: string
  today: number
  average: number
  weekdayLabel: string
}) {
  const hasAverage = average > 0
  const diff = hasAverage ? ((today - average) / average) * 100 : 0
  const progress = hasAverage ? clampPercent((today / average) * 100) : 0
  const tone = getSectionTone(kind, diff)

  return (
    <div style={sectionWrap}>
      <div style={sectionHeaderRow}>
        <div style={sectionLabel}>{label}</div>
      </div>

      {hasAverage ? (
        <>
          <div style={mainRow}>
            <div style={{ ...iconBadge, background: tone.iconBg, color: tone.iconColor }}>
              {kind === 'income' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            </div>
            <p style={{ ...percentText, color: tone.percentColor }}>
              {diff >= 0 ? '+' : ''}
              {diff.toFixed(0)}%
            </p>
          </div>

          <p style={mainLineText}>
            {tone.comparisonText} {weekdayLabel}
          </p>

          <p style={metaText}>Σήμερα {money(today)} • Μ.Ο. {money(average)}</p>
          <p style={insightText}>{tone.insightText}</p>

          <div style={progressTrack}>
            <div style={{ ...progressFill, width: `${progress}%`, background: tone.progressGradient }} />
          </div>
        </>
      ) : (
        <>
          <p style={neutralText}>Δεν υπάρχουν αρκετά ιστορικά δεδομένα για σύγκριση.</p>
          <p style={metaText}>Σήμερα {money(today)} • Μ.Ο. {money(average)}</p>
          <div style={progressTrack}>
            <div style={{ ...progressFill, width: '0%', background: kind === 'income' ? 'linear-gradient(90deg, #34d399 0%, #059669 100%)' : 'linear-gradient(90deg, #fb7185 0%, #e11d48 100%)' }} />
          </div>
        </>
      )}
    </div>
  )
}

export default function DailyPerformanceCard({
  incomeToday,
  incomeAvg,
  expenseToday,
  expenseAvg,
  weekdayLabel,
}: DailyPerformanceCardProps) {
  return (
    <div style={cardWrap}>
      <p style={cardTitle}>ΗΜΕΡΗΣΙΑ ΑΠΟΔΟΣΗ</p>

      <PerformanceSection
        kind="income"
        label="ΕΣΟΔΑ"
        today={incomeToday}
        average={incomeAvg}
        weekdayLabel={weekdayLabel}
      />

      <div style={divider} />

      <PerformanceSection
        kind="expense"
        label="ΕΞΟΔΑ"
        today={expenseToday}
        average={expenseAvg}
        weekdayLabel={weekdayLabel}
      />
    </div>
  )
}

const cardWrap: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '24px',
  padding: '18px',
  marginTop: '-14px',
  marginBottom: '24px',
  boxShadow: 'var(--shadow)',
}

const cardTitle: CSSProperties = {
  margin: 0,
  fontSize: '12px',
  fontWeight: '900',
  color: 'var(--muted)',
  letterSpacing: '0.7px',
}

const sectionWrap: CSSProperties = {
  marginTop: '12px',
}

const sectionHeaderRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const sectionLabel: CSSProperties = {
  fontSize: '10px',
  fontWeight: '900',
  color: 'var(--muted)',
  letterSpacing: '0.6px',
}

const mainRow: CSSProperties = {
  marginTop: '8px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

const iconBadge: CSSProperties = {
  width: '24px',
  height: '24px',
  borderRadius: '9px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const percentText: CSSProperties = {
  margin: 0,
  fontSize: '30px',
  fontWeight: '900',
  letterSpacing: '-0.5px',
  lineHeight: 1,
}

const mainLineText: CSSProperties = {
  margin: '2px 0 0 0',
  fontSize: '14px',
  fontWeight: '700',
  color: 'var(--text)',
  opacity: 0.85,
}

const metaText: CSSProperties = {
  margin: '6px 0 0 0',
  fontSize: '11px',
  fontWeight: '800',
  color: 'var(--text)',
  opacity: 0.68,
}

const insightText: CSSProperties = {
  margin: '4px 0 0 0',
  fontSize: '11px',
  fontWeight: '800',
  color: 'var(--muted)',
}

const neutralText: CSSProperties = {
  margin: '8px 0 0 0',
  fontSize: '12px',
  fontWeight: '800',
  color: 'var(--muted)',
}

const progressTrack: CSSProperties = {
  marginTop: '9px',
  width: '100%',
  height: '6px',
  borderRadius: '999px',
  background: 'linear-gradient(180deg, #eef2f8 0%, #e3eaf5 100%)',
  boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.08)',
  overflow: 'hidden',
}

const progressFill: CSSProperties = {
  height: '100%',
  borderRadius: '999px',
  transition: 'width 400ms ease',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.16)',
}

const divider: CSSProperties = {
  marginTop: '14px',
  marginBottom: '14px',
  height: '1px',
  background: 'linear-gradient(90deg, rgba(148, 163, 184, 0) 0%, rgba(148, 163, 184, 0.38) 50%, rgba(148, 163, 184, 0) 100%)',
}

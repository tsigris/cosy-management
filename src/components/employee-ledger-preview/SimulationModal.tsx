'use client'

import type { CSSProperties } from 'react'

type SimulationAction = 'earning' | 'payment' | 'deduction'

type SimulationModalProps = {
  open: boolean
  action: SimulationAction
  currentBalance: number
  onClose: () => void
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
}

export default function SimulationModal({ open, action, currentBalance, onClose }: SimulationModalProps) {
  if (!open) return null

  const defaultAmount = action === 'earning' ? 120 : action === 'payment' ? 80 : 30
  const projectedChange = action === 'earning' ? defaultAmount : -defaultAmount
  const projectedNewBalance = Number((currentBalance + projectedChange).toFixed(2))
  const titleByAction: Record<SimulationAction, string> = {
    earning: 'Προσθήκη Κέρδους',
    payment: 'Πληρωμή Υπαλλήλου',
    deduction: 'Κράτηση Υπαλλήλου',
  }

  const amountLabelByAction: Record<SimulationAction, string> = {
    earning: 'Κέρδος',
    payment: 'Πληρωμή',
    deduction: 'Κράτηση',
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        <div style={titleRowStyle}>
          <h3 style={titleStyle}>{titleByAction[action]}</h3>
          <button onClick={onClose} style={closeBtnStyle}>Κλείσιμο</button>
        </div>

        <div style={bannerStyle}>Προεπισκόπηση - Δεν αποθηκεύεται τίποτα</div>

        <div style={gridStyle}>
          <Metric label="Τρέχον υπόλοιπο" value={money(currentBalance)} />
          <Metric
            label={amountLabelByAction[action]}
            value={money(Math.abs(defaultAmount))}
            tone={projectedChange >= 0 ? '#065f46' : '#9a3412'}
          />
          <Metric label="Νέο υπόλοιπο" value={money(projectedNewBalance)} />
        </div>

        <div style={footerStyle}>
          <button disabled style={saveBtnStyle}>Αποθήκευση απενεργοποιημένη</button>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={metricStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <span style={{ ...metricValueStyle, color: tone || '#0f172a' }}>{value}</span>
    </div>
  )
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.55)',
  zIndex: 1200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
}

const modalStyle: CSSProperties = {
  width: 'min(560px, 100%)',
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  padding: '16px',
  boxShadow: '0 14px 40px rgba(15, 23, 42, 0.2)',
}

const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  color: '#0f172a',
}

const closeBtnStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
  borderRadius: '10px',
  padding: '8px 10px',
  fontWeight: 700,
  cursor: 'pointer',
}

const bannerStyle: CSSProperties = {
  marginTop: '12px',
  borderRadius: '10px',
  border: '1px dashed #f59e0b',
  backgroundColor: '#fff7ed',
  color: '#9a3412',
  fontWeight: 800,
  fontSize: '13px',
  padding: '10px',
}

const gridStyle: CSSProperties = {
  marginTop: '14px',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '10px',
}

const metricStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  background: '#f8fafc',
  padding: '10px',
}

const metricLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 800,
  color: '#64748b',
}

const metricValueStyle: CSSProperties = {
  display: 'block',
  marginTop: '4px',
  fontSize: '18px',
  fontWeight: 900,
}

const footerStyle: CSSProperties = {
  marginTop: '14px',
  display: 'flex',
  justifyContent: 'flex-end',
}

const saveBtnStyle: CSSProperties = {
  border: 'none',
  borderRadius: '10px',
  padding: '10px 14px',
  fontWeight: 800,
  color: '#ffffff',
  backgroundColor: '#94a3b8',
  cursor: 'not-allowed',
}

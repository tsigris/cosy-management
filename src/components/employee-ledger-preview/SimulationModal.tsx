'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

type SimulationAction = 'earning' | 'payment' | 'deduction'

type SimulationModalProps = {
  open: boolean
  action: SimulationAction
  currentBalance: number
  onClose: () => void
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}€`
}

function defaultAmountForAction(action: SimulationAction) {
  if (action === 'earning') return 120
  if (action === 'payment') return 80
  return 30
}

export default function SimulationModal({ open, action, currentBalance, onClose }: SimulationModalProps) {
  const [amount, setAmount] = useState(String(defaultAmountForAction(action)))

  useEffect(() => {
    setAmount(String(defaultAmountForAction(action)))
  }, [action])

  if (!open) return null

  const parsedAmount = Number(amount.replace(',', '.'))
  const safeAmount = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0
  const projectedChange = action === 'earning' ? safeAmount : -safeAmount
  const projectedNewBalance = Number((currentBalance + projectedChange).toFixed(2))

  const titleByAction: Record<SimulationAction, string> = {
    earning: 'Του χρωστάμε',
    payment: 'Του πλήρωσα',
    deduction: 'Αφαίρεση',
  }

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" onClick={onClose}>
      <div style={sheetStyle} onClick={(event) => event.stopPropagation()}>
        <div style={grabberStyle} />
        <h3 style={titleStyle}>{titleByAction[action]}</h3>

        <label style={labelStyle} htmlFor="employee-wallet-amount">
          Ποσό
        </label>
        <input
          id="employee-wallet-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          style={inputStyle}
        />

        <p style={hintStyle}>Αν αποθηκευόταν, το νέο υπόλοιπο θα ήταν {money(projectedNewBalance)}</p>

        <button type="button" disabled style={disabledButtonStyle}>
          Δεν αποθηκεύεται ακόμα
        </button>

        <button type="button" onClick={onClose} style={closeButtonStyle}>
          Κλείσιμο
        </button>
      </div>
    </div>
  )
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.32)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  zIndex: 1200,
}

const sheetStyle: CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  background: '#ffffff',
  borderTopLeftRadius: '20px',
  borderTopRightRadius: '20px',
  padding: '12px 16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
}

const grabberStyle: CSSProperties = {
  width: '44px',
  height: '5px',
  borderRadius: '999px',
  background: '#cbd5e1',
  alignSelf: 'center',
}

const titleStyle: CSSProperties = {
  margin: '4px 0 0 0',
  fontSize: '28px',
  lineHeight: 1,
  fontWeight: 900,
  color: '#0f172a',
}

const labelStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#475569',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '50px',
  borderRadius: '12px',
  border: '1px solid #cbd5e1',
  padding: '12px 14px',
  fontSize: '20px',
  fontWeight: 800,
  color: '#0f172a',
}

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: '15px',
  lineHeight: 1.4,
  color: '#334155',
}

const disabledButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: '50px',
  borderRadius: '14px',
  border: 'none',
  background: '#94a3b8',
  color: '#ffffff',
  fontSize: '17px',
  fontWeight: 900,
  cursor: 'not-allowed',
}

const closeButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: '46px',
  borderRadius: '14px',
  border: 'none',
  background: '#e2e8f0',
  color: '#0f172a',
  fontSize: '16px',
  fontWeight: 800,
  cursor: 'pointer',
}

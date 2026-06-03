'use client'

type SimulationAction = 'earning' | 'payment' | 'deduction'

type SimulationModalProps = {
  open: boolean
  action: SimulationAction
  currentBalance: number
  onClose: () => void
}

export default function SimulationModal(_props: SimulationModalProps) {
  return null
}

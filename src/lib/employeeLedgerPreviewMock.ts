export type EmployeeLedgerPreviewEventType =
  | 'earning'
  | 'payment'
  | 'deduction'
  | 'adjustment'
  | 'reversal'

export type EmployeeLedgerPreviewEvent = {
  id: string
  date: string
  type: EmployeeLedgerPreviewEventType
  amount: number
  reference: string
  source: string
  reason: string
  balanceBefore: number
  balanceAfter: number
}

export type EmployeeLedgerPreviewSummary = {
  currentBalance: number
  totalEarned: number
  totalPaid: number
  totalDeductions: number
  netChange: number
  lastUpdated: string
  events: EmployeeLedgerPreviewEvent[]
}

type EmployeeSeed = {
  id: string
  name?: string | null
  monthly_salary?: number | null
  agreed_extra_salary?: number | null
  daily_rate?: number | null
  pay_basis?: string | null
}

function toMoney(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0
}

function buildEvent(
  id: string,
  date: string,
  type: EmployeeLedgerPreviewEventType,
  amount: number,
  reference: string,
  source: string,
  reason: string,
  balanceBefore: number,
): EmployeeLedgerPreviewEvent {
  const sign = type === 'earning' || type === 'reversal' ? 1 : -1
  const balanceAfter = toMoney(balanceBefore + amount * sign)

  return {
    id,
    date,
    type,
    amount: toMoney(amount),
    reference,
    source,
    reason,
    balanceBefore: toMoney(balanceBefore),
    balanceAfter,
  }
}

export function getEmployeeLedgerPreviewSummary(employee: EmployeeSeed): EmployeeLedgerPreviewSummary {
  const today = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const baseSalary = toMoney(employee.monthly_salary)
  const extraSalary = toMoney(employee.agreed_extra_salary)
  const dailyRate = toMoney(employee.daily_rate)
  const payBasis = String(employee.pay_basis || 'monthly')

  const salaryEarning = payBasis === 'daily' ? toMoney(dailyRate * 18) : toMoney(baseSalary + extraSalary)

  const seedEvents: Array<Omit<EmployeeLedgerPreviewEvent, 'balanceBefore' | 'balanceAfter'>> = [
    {
      id: `${employee.id}-e1`,
      date: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
      type: 'earning',
      amount: salaryEarning || 80,
      reference: 'PRV-EARN-001',
      source: 'preview.salary_engine',
      reason: payBasis === 'daily' ? 'Simulated daily wage earnings' : 'Simulated monthly earnings',
    },
    {
      id: `${employee.id}-e2`,
      date: iso(new Date(today.getFullYear(), today.getMonth(), 5)),
      type: 'earning',
      amount: 120,
      reference: 'PRV-EARN-002',
      source: 'preview.bonus_engine',
      reason: 'Simulated bonus event',
    },
    {
      id: `${employee.id}-p1`,
      date: iso(new Date(today.getFullYear(), today.getMonth(), 10)),
      type: 'payment',
      amount: 300,
      reference: 'PRV-PAY-001',
      source: 'preview.payment_engine',
      reason: 'Simulated advance payment',
    },
    {
      id: `${employee.id}-d1`,
      date: iso(new Date(today.getFullYear(), today.getMonth(), 14)),
      type: 'deduction',
      amount: 50,
      reference: 'PRV-DED-001',
      source: 'preview.deduction_engine',
      reason: 'Simulated deduction',
    },
    {
      id: `${employee.id}-a1`,
      date: iso(new Date(today.getFullYear(), today.getMonth(), 16)),
      type: 'adjustment',
      amount: 20,
      reference: 'PRV-ADJ-001',
      source: 'preview.adjustment_engine',
      reason: 'Simulated adjustment correction',
    },
  ]

  let running = 0
  const events = seedEvents
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((raw) => {
      const event = buildEvent(
        raw.id,
        raw.date,
        raw.type,
        raw.amount,
        raw.reference,
        raw.source,
        raw.reason,
        running,
      )
      running = event.balanceAfter
      return event
    })
    .reverse()

  const totalEarned = toMoney(events.filter((e) => e.type === 'earning' || e.type === 'reversal').reduce((sum, e) => sum + e.amount, 0))
  const totalPaid = toMoney(events.filter((e) => e.type === 'payment').reduce((sum, e) => sum + e.amount, 0))
  const totalDeductions = toMoney(events.filter((e) => e.type === 'deduction' || e.type === 'adjustment').reduce((sum, e) => sum + e.amount, 0))
  const currentBalance = toMoney(totalEarned - totalPaid - totalDeductions)

  return {
    currentBalance,
    totalEarned,
    totalPaid,
    totalDeductions,
    netChange: currentBalance,
    lastUpdated: events[0]?.date || iso(today),
    events,
  }
}
export type EmployeeMonthlyPaymentHistoryItem = {
  id: string
  date: string
  text: string
  amountText?: string
}

export type EmployeeMonthlyPaymentSummary = {
  monthLabel: string
  startedDate: string
  salaryAgreement: number
  tips: number
  overtime: number
  entitledTotal: number
  paidBank: number
  paidCash: number
  paidTotal: number
  remainingBalance: number
  history: EmployeeMonthlyPaymentHistoryItem[]
}

type EmployeeSeed = {
  id: string
  name?: string | null
  start_date?: string | null
  monthly_salary?: number | null
  agreed_extra_salary?: number | null
  daily_rate?: number | null
  pay_basis?: string | null
}

function toMoney(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0
}

function isoDate(year: number, monthIndex: number, day: number): string {
  return new Date(year, monthIndex, day).toISOString().slice(0, 10)
}

export function getEmployeeLedgerPreviewSummary(employee: EmployeeSeed): EmployeeMonthlyPaymentSummary {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const startDate = String(employee.start_date || '').slice(0, 10) || monthStart.toISOString().slice(0, 10)
  const monthLabel = monthStart.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' })

  const salaryBase = toMoney(employee.monthly_salary)
  const salaryExtra = toMoney(employee.agreed_extra_salary)
  const dailyRate = toMoney(employee.daily_rate)
  const payBasis = String(employee.pay_basis || 'monthly')

  const salaryAgreement =
    payBasis === 'daily'
      ? toMoney(dailyRate * 18)
      : toMoney((salaryBase || 1200) + salaryExtra)

  const tips = 120
  const overtime = 100
  const entitledTotal = toMoney(salaryAgreement + tips + overtime)

  const paidBank = 300
  const paidCash = 200
  const paidTotal = toMoney(paidBank + paidCash)

  const remainingBalance = toMoney(entitledTotal - paidTotal)

  const history: EmployeeMonthlyPaymentHistoryItem[] = [
    {
      id: `${employee.id}-h1`,
      date: isoDate(now.getFullYear(), now.getMonth(), 1),
      text: 'Ξεκίνησε εργασία',
    },
    {
      id: `${employee.id}-h2`,
      date: isoDate(now.getFullYear(), now.getMonth(), 5),
      text: 'Tips',
      amountText: '+40€',
    },
    {
      id: `${employee.id}-h3`,
      date: isoDate(now.getFullYear(), now.getMonth(), 10),
      text: 'Πληρωμή μετρητά',
      amountText: '-100€',
    },
    {
      id: `${employee.id}-h4`,
      date: isoDate(now.getFullYear(), now.getMonth(), 15),
      text: 'Υπερωρίες',
      amountText: '+50€',
    },
    {
      id: `${employee.id}-h5`,
      date: isoDate(now.getFullYear(), now.getMonth(), 20),
      text: 'Πληρωμή τράπεζα',
      amountText: '-300€',
    },
  ]

  return {
    monthLabel,
    startedDate: startDate,
    salaryAgreement,
    tips,
    overtime,
    entitledTotal,
    paidBank,
    paidCash,
    paidTotal,
    remainingBalance,
    history,
  }
}

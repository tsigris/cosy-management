type GoalLite = {
  id?: string
  target_amount?: number | null
  current_amount?: number | null
  target_date?: string | null
  created_at?: string | null
}

function yyyyMmDdToDate(s: string) {
  const [y, m, d] = String(s || '').split('-').map((x) => Number(x))
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function daysBetweenInclusive(from: Date, to: Date) {
  const ms = 24 * 60 * 60 * 1000
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.floor((end - start) / ms) + 1
}

function monthsApprox(days: number) {
  return Math.max(1, Math.ceil(days / 30))
}

export function getGoalProgress(g: GoalLite, businessDate?: string | Date) {
  const target = Number(g.target_amount || 0)
  const current = Number(g.current_amount || 0)
  const savedAmount = current
  const targetAmount = target
  const remaining = Math.max(0, targetAmount - savedAmount)

  // businessDate may be a yyyy-mm-dd string or a Date
  let biz: Date
  if (businessDate instanceof Date) biz = businessDate
  else if (typeof businessDate === 'string') {
    const d = yyyyMmDdToDate(businessDate)
    biz = d || new Date()
  } else {
    biz = new Date()
  }

  let hasDate = false
  let targetDateObj: Date | null = null
  if (g.target_date) {
    const td = yyyyMmDdToDate(g.target_date)
    if (td && !Number.isNaN(td.getTime())) {
      hasDate = true
      targetDateObj = td
    }
  }

  const rawDaysLeft = hasDate && targetDateObj ? daysBetweenInclusive(biz, targetDateObj) : null
  const daysLeft = rawDaysLeft === null ? null : Math.max(1, rawDaysLeft)

  const isCompleted = remaining <= 0
  const isOverdue = hasDate && targetDateObj ? biz.getTime() > targetDateObj.getTime() && !isCompleted : false

  const dailyNeeded = isCompleted ? 0 : rawDaysLeft === null ? null : remaining / Math.max(1, rawDaysLeft)
  const perDay = dailyNeeded
  const perMonth = rawDaysLeft === null ? null : remaining / monthsApprox(Math.max(1, rawDaysLeft))

  // expected pace based on created_at
  const created = g.created_at ? yyyyMmDdToDate(String(g.created_at).slice(0, 10)) : null
  const start = created || biz
  let expectedNow: number | null = null
  let deltaFromExpected: number | null = null
  if (hasDate && targetDateObj) {
    const totalDays = Math.max(1, daysBetweenInclusive(start, targetDateObj))
    const elapsedDays = Math.max(1, Math.min(daysBetweenInclusive(start, biz), totalDays))
    const elapsedPct = Math.max(0, Math.min(elapsedDays / totalDays, 1))
    expectedNow = targetAmount * elapsedPct
    deltaFromExpected = current - expectedNow
  }

  const progressPercent = targetAmount > 0 ? Math.min(100, (savedAmount / targetAmount) * 100) : 0

  return {
    savedAmount,
    targetAmount,
    remaining,
    daysLeft: daysLeft,
    rawDaysLeft,
    dailyNeeded,
    progressPercent,
    isCompleted,
    isOverdue,
    // backward-compatible fields used by UI
    hasDate,
    expired: isOverdue,
    perDay,
    perMonth,
    expectedNow,
    deltaFromExpected,
    remainingAmount: remaining,
    remainingValue: remaining,
  }
}

export default getGoalProgress

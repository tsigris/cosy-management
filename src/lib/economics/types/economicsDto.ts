export type EconomicsRouteId = 'home' | 'days' | 'expenses' | 'comparisons' | 'advanced'

export type EconomicsPeriodId = 'month' | 'year' | '30days' | 'all'

export type EconomicsShellDto = {
  storeId: string | null
  activeRoute: EconomicsRouteId
  activePeriod: EconomicsPeriodId
  selectedDate: string | null
}

export type EconomicsNavigationItemDto = {
  id: EconomicsRouteId
  label: string
  href: string
}

export type EconomicsHomeSummaryDto = {
  periodLabel?: string
  todayLabel?: string
  todayRevenue?: number
  todayProfit?: number
  monthRevenue?: number
  monthProfit?: number
  cashRevenue?: number
  cardRevenue?: number
  bestDayLabel?: string
  worstDayLabel?: string
}

export type EconomicsCalendarDayDto = {
  date: string
  label?: string
  revenue?: number
  expenses?: number
  profit?: number
  status?: 'strong' | 'weak' | 'neutral' | 'empty'
  isToday?: boolean
  isSelected?: boolean
  hasAnomaly?: boolean
}

export type EconomicsCalendarSeriesDto = {
  monthLabel?: string
  days: EconomicsCalendarDayDto[]
}

export type EconomicsTransactionDto = {
  id: string
  date: string
  amount: number
  type: string
  category?: string | null
  method?: string | null
  isCredit?: boolean | null
}

export type EconomicsDayDetailDto = {
  date: string
  label?: string
  summary?: EconomicsHomeSummaryDto
  transactions: EconomicsTransactionDto[]
}

export type EconomicsComparisonDto = {
  periodLabel?: string
  previousPeriodLabel?: string
  currentTotal?: number
  previousTotal?: number
  delta?: number
  deltaPct?: number | null
}

export type EconomicsExpenseSearchDto = {
  query: string
  results: Array<{
    id: string
    date: string
    label?: string
    amount: number
    category?: string | null
    method?: string | null
  }>
}
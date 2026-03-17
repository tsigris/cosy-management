const BUSINESS_DAY_CUTOFF_HOUR = 7

export function formatIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function toBusinessDayDate(input: Date, options?: { normalizeToNoon?: boolean }): Date {
  const d = new Date(input)
  if (d.getHours() < BUSINESS_DAY_CUTOFF_HOUR) d.setDate(d.getDate() - 1)

  if (options?.normalizeToNoon) {
    d.setHours(12, 0, 0, 0)
  }

  return d
}

export function toBusinessDayDateNormalized(input: Date): Date {
  return toBusinessDayDate(input, { normalizeToNoon: true })
}

export function formatBusinessDayDate(input: Date): string {
  return toBusinessDayDateNormalized(input).toLocaleDateString('el-GR')
}

export function getBusinessDate(now: Date = new Date()): string {
  return formatIsoDate(toBusinessDayDate(now))
}

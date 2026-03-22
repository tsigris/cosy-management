const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function formatIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getTodayDateISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isDateOnlyString(value: string): boolean {
  return DATE_ONLY_REGEX.test(String(value || '').trim())
}

export function parseLocalDateOnly(dateStr: string): Date {
  const [y, m, d] = String(dateStr || '').split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0)
}

export function parseDateInputSafe(input: string | Date | null | undefined): Date | null {
  if (!input) return null

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : new Date(input)
  }

  const value = String(input).trim()
  if (!value) return null

  if (isDateOnlyString(value)) {
    const parsedDateOnly = parseLocalDateOnly(value)
    return Number.isNaN(parsedDateOnly.getTime()) ? null : parsedDateOnly
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function toBusinessDayDateFromInput(
  input: string | Date | null | undefined,
  options?: { normalizeToNoon?: boolean }
): Date | null {
  const parsed = parseDateInputSafe(input)
  if (!parsed) return null

  if (typeof input === 'string' && isDateOnlyString(input)) {
    if (options?.normalizeToNoon) {
      parsed.setHours(12, 0, 0, 0)
    }
    return parsed
  }

  if (options?.normalizeToNoon) {
    parsed.setHours(12, 0, 0, 0)
  }
  return parsed
}

export function formatBusinessDayDate(input: Date): string {
  const d = new Date(input)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export function getBusinessDate(now: Date = new Date()): string {
  return formatIsoDate(now)
}

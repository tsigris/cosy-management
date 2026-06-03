const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

function normalizeFlagValue(value: string | undefined): string {
  return String(value || '').trim().toLowerCase()
}

export function isEmployeeLedgerPreviewEnabled(): boolean {
  const publicValue = normalizeFlagValue(process.env.NEXT_PUBLIC_EMPLOYEE_LEDGER_PREVIEW)
  const serverValue = normalizeFlagValue(process.env.EMPLOYEE_LEDGER_PREVIEW)
  return TRUE_VALUES.has(publicValue) || TRUE_VALUES.has(serverValue)
}

export const employeeLedgerPreviewEnabled = isEmployeeLedgerPreviewEnabled()
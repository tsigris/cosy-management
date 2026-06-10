export type ZNotesAccessInput = {
  role?: string | null
  can_edit_transactions?: boolean | null
  can_view_history?: boolean | null
}

export type ZNoteSummaryRow = {
  updated_at?: string | null
}

export function canEditZNotes(access: ZNotesAccessInput | null | undefined): boolean {
  if (!access) return false
  return access.role === 'admin' || access.can_edit_transactions === true
}

export function canViewZNoteHistory(access: ZNotesAccessInput | null | undefined): boolean {
  if (!access) return false
  return access.role === 'admin' || access.can_view_history === true
}

export function summarizeZNotes(rows: ZNoteSummaryRow[] | null | undefined): { count: number; lastUpdatedAt: string | null } {
  const safeRows = Array.isArray(rows) ? rows : []
  return {
    count: safeRows.length,
    lastUpdatedAt: safeRows[0]?.updated_at || null,
  }
}

export function optimisticUpdateSucceeded(affectedRows: Array<{ id?: string | number | null }> | null | undefined): boolean {
  return Array.isArray(affectedRows) && affectedRows.length > 0
}

export function buildRevisionPreview(action: 'insert' | 'update' | 'delete', oldText: string | null, newText: string | null): string {
  if (action === 'insert') return `NEW: ${newText || '-'}`
  if (action === 'delete') return `DELETED: ${oldText || '-'}`
  return `OLD: ${oldText || '-'} | NEW: ${newText || '-'}`
}

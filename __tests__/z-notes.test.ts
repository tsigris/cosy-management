import {
  buildRevisionPreview,
  canEditZNotes,
  canViewZNoteHistory,
  optimisticUpdateSucceeded,
  summarizeZNotes,
} from '@/lib/zNotes'

describe('z notes permissions', () => {
  it('allows edit for admin', () => {
    expect(canEditZNotes({ role: 'admin', can_edit_transactions: false })).toBe(true)
  })

  it('allows edit for can_edit_transactions', () => {
    expect(canEditZNotes({ role: 'user', can_edit_transactions: true })).toBe(true)
  })

  it('blocks edit for normal member', () => {
    expect(canEditZNotes({ role: 'user', can_edit_transactions: false })).toBe(false)
  })

  it('allows history for admin or can_view_history', () => {
    expect(canViewZNoteHistory({ role: 'admin', can_view_history: false })).toBe(true)
    expect(canViewZNoteHistory({ role: 'user', can_view_history: true })).toBe(true)
    expect(canViewZNoteHistory({ role: 'user', can_view_history: false })).toBe(false)
  })
})

describe('z notes summary', () => {
  it('returns count and most recent updated_at from first row', () => {
    const summary = summarizeZNotes([
      { updated_at: '2026-06-10T12:00:00.000Z' },
      { updated_at: '2026-06-09T10:00:00.000Z' },
    ])

    expect(summary.count).toBe(2)
    expect(summary.lastUpdatedAt).toBe('2026-06-10T12:00:00.000Z')
  })

  it('handles empty input', () => {
    expect(summarizeZNotes([])).toEqual({ count: 0, lastUpdatedAt: null })
  })
})

describe('z notes optimistic concurrency helper', () => {
  it('detects successful optimistic update', () => {
    expect(optimisticUpdateSucceeded([{ id: 'abc' }])).toBe(true)
  })

  it('detects failed optimistic update', () => {
    expect(optimisticUpdateSucceeded([])).toBe(false)
    expect(optimisticUpdateSucceeded(null)).toBe(false)
  })
})

describe('z note revision preview', () => {
  it('formats insert/update/delete previews', () => {
    expect(buildRevisionPreview('insert', null, 'new value')).toContain('NEW: new value')
    expect(buildRevisionPreview('delete', 'old value', null)).toContain('DELETED: old value')
    expect(buildRevisionPreview('update', 'old', 'new')).toContain('OLD: old | NEW: new')
  })
})

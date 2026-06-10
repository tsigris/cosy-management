'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { getTodayDateISO, parseLocalDateOnly } from '@/lib/businessDate'
import useStoreAccess from '@/hooks/useStoreAccess'
import { canEditZNotes, canViewZNoteHistory, optimisticUpdateSucceeded } from '@/lib/zNotes'

// ✅ ΟΡΙΣΤΙΚΕΣ ΣΤΑΘΕΡΕΣ ΓΙΑ ΑΠΟΛΥΤΗ ΤΑΥΤΙΣΗ ΜΕ ΤΗΝ ΑΝΑΛΥΣΗ
const Z_METHODS = {
  CASH: 'Μετρητά (Z)', // ✅ Επίσημο Ζ (Latin Z)
  CARD: 'Κάρτα', // ✅ POS
  NO_TAX: 'Χωρίς Απόδειξη', // ✅ Clean label στη λίστα
} as const

const Z_NOTES = {
  OFFICIAL: 'Ζ ΤΑΜΕΙΑΚΗΣ',
  OFFICIAL_POS: 'Ζ ΤΑΜΕΙΑΚΗΣ (POS)',
  BLACK: 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ', // ✅ Το "κλειδί" για την Ανάλυση
} as const

const Z_CATEGORY = 'Εσοδα Ζ' as const

type ZNoteType =
  | 'equipment_issue'
  | 'stock_shortage'
  | 'staff_issue'
  | 'customer_complaint'
  | 'cash_difference'
  | 'next_shift_todo'
  | 'general'
  | 'bad_weather'
  | 'heatwave'
  | 'power_outage'
  | 'internet_pos_issue'
  | 'supplier_order'
  | 'inspection'
  | 'incident'
  | 'high_traffic'
  | 'low_traffic'
  | 'revenue_record'

type ZNoteRow = {
  id: string
  note_text: string
  note_type: ZNoteType | null
  created_at: string
  created_by: string
  updated_at: string
  updated_by: string | null
}

type ZRevisionRow = {
  id: string
  action: 'insert' | 'update' | 'delete'
  old_text: string | null
  new_text: string | null
  changed_at: string
  changed_by: string
}

const NOTE_TYPE_OPTIONS: Array<{ value: ZNoteType; label: string }> = [
  { value: 'general',            label: 'Γενική Σημείωση' },
  { value: 'bad_weather',        label: 'Βροχή / Κακοκαιρία' },
  { value: 'heatwave',           label: 'Καύσωνας' },
  { value: 'power_outage',       label: 'Διακοπή Ρεύματος' },
  { value: 'equipment_issue',    label: 'Βλάβη Εξοπλισμού' },
  { value: 'stock_shortage',     label: 'Έλλειψη Προϊόντων' },
  { value: 'staff_issue',        label: 'Πρόβλημα Προσωπικού' },
  { value: 'customer_complaint', label: 'Παράπονο Πελάτη' },
  { value: 'cash_difference',    label: 'Ταμειακή Διαφορά' },
  { value: 'next_shift_todo',    label: 'Εκκρεμότητα Επόμενης Βάρδιας' },
  { value: 'internet_pos_issue', label: 'Πρόβλημα Internet / POS' },
  { value: 'supplier_order',     label: 'Παραγγελία Προμηθευτή' },
  { value: 'inspection',         label: 'Έλεγχος / Επιθεώρηση' },
  { value: 'incident',           label: 'Ατύχημα / Συμβάν' },
  { value: 'high_traffic',       label: 'Πολύ Αυξημένη Κίνηση' },
  { value: 'low_traffic',        label: 'Πολύ Χαμηλή Κίνηση' },
  { value: 'revenue_record',     label: 'Ρεκόρ Τζίρου' },
]

// Record<string, string> (not ZNoteType) so old DB values still render safely
const NOTE_TYPE_LABELS: Record<string, string> = {
  // New categories
  general:            'Γενική Σημείωση',
  bad_weather:        'Βροχή / Κακοκαιρία',
  heatwave:           'Καύσωνας',
  power_outage:       'Διακοπή Ρεύματος',
  equipment_issue:    'Βλάβη Εξοπλισμού',
  stock_shortage:     'Έλλειψη Προϊόντων',
  staff_issue:        'Πρόβλημα Προσωπικού',
  customer_complaint: 'Παράπονο Πελάτη',
  cash_difference:    'Ταμειακή Διαφορά',
  next_shift_todo:    'Εκκρεμότητα Επόμενης Βάρδιας',
  internet_pos_issue: 'Πρόβλημα Internet / POS',
  supplier_order:     'Παραγγελία Προμηθευτή',
  inspection:         'Έλεγχος / Επιθεώρηση',
  incident:           'Ατύχημα / Συμβάν',
  high_traffic:       'Πολύ Αυξημένη Κίνηση',
  low_traffic:        'Πολύ Χαμηλή Κίνηση',
  revenue_record:     'Ρεκόρ Τζίρου',
}

function formatDateTime(input: string | null | undefined): string {
  if (!input) return '--'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return '--'
  return format(d, 'dd/MM/yyyy HH:mm')
}

function formatUserRef(userId: string | null | undefined): string {
  const raw = String(userId || '').trim()
  if (!raw) return 'Άγνωστος'
  return raw.slice(0, 8).toUpperCase()
}

function parseMoneyInput(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  const normalized = String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.')

  if (!normalized) return 0

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function DailyZContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()

  // 1. SaaS ΠΗΓΗ ΑΛΗΘΕΙΑΣ: Το ID από το URL
  const storeId = searchParams.get('store')
  const dateFromQuery = searchParams.get('date')

  const { data: accessData } = useStoreAccess({
    storeId: storeId || undefined,
    fields: 'role, can_edit_transactions, can_view_history',
    autoFetch: !!storeId,
  })

  const [cashZ, setCashZ] = useState('')
  const [posZ, setPosZ] = useState('')
  const [noTax, setNoTax] = useState('')
  const [nightNoteDraft, setNightNoteDraft] = useState('')
  const [noteType, setNoteType] = useState<ZNoteType>('general')
  const [notes, setNotes] = useState<ZNoteRow[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [editingUpdatedAt, setEditingUpdatedAt] = useState<string | null>(null)
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({})
  const [historyByNoteId, setHistoryByNoteId] = useState<Record<string, ZRevisionRow[]>>({})
  const [historyLoadingByNoteId, setHistoryLoadingByNoteId] = useState<Record<string, boolean>>({})

  const [date, setDate] = useState(() => getTodayDateISO())

  const [loading, setLoading] = useState(false)
  const [isAlreadyClosed, setIsAlreadyClosed] = useState(false)
  const [username, setUsername] = useState('Admin')

  const canEditNotes = canEditZNotes(accessData)
  const canViewHistory = canViewZNoteHistory(accessData)

  // ✅ SaaS Guard: Προστασία από απώλεια καταστήματος
  useEffect(() => {
    if (!storeId || storeId === 'null') {
      router.replace('/select-store')
    }
  }, [storeId, router])

  useEffect(() => {
    if (!dateFromQuery) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFromQuery)) return
    setDate(dateFromQuery)
  }, [dateFromQuery])

  const checkExistingZ = useCallback(async () => {
    if (!storeId) return
    const { data } = await supabase
      .from('transactions')
      .select('id')
      .eq('category', Z_CATEGORY)
      .eq('date', date)
      .eq('store_id', storeId)
      .limit(1)

    setIsAlreadyClosed(data && data.length > 0 ? true : false)
  }, [date, storeId])

  useEffect(() => {
    checkExistingZ()
  }, [checkExistingZ])

  useEffect(() => {
    async function fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
        const createdByName = (data?.username || user.email?.split('@')[0] || 'Χρήστης').trim()
        setUsername(createdByName)
      }
    }
    fetchUser()
  }, [])

  const loadNotes = useCallback(async () => {
    if (!storeId || !date) return
    setNotesLoading(true)
    const { data, error } = await supabase
      .from('z_notes')
      .select('id, note_text, note_type, created_at, created_by, updated_at, updated_by')
      .eq('store_id', storeId)
      .eq('business_date', date)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed loading z notes', error)
      setNotes([])
    } else {
      setNotes((data || []) as ZNoteRow[])
    }
    setNotesLoading(false)
  }, [date, storeId, supabase])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  async function insertNightNote(userId: string) {
    const trimmed = nightNoteDraft.trim()
    if (!trimmed || !storeId) return { ok: true as const }

    const { error } = await supabase.from('z_notes').insert({
      store_id: storeId,
      business_date: date,
      note_text: trimmed,
      note_type: noteType,
      created_by: userId,
      updated_by: userId,
    })

    if (error) {
      console.error('Failed inserting z note', error)
      return { ok: false as const, message: error.message }
    }

    setNightNoteDraft('')
    await loadNotes()
    return { ok: true as const }
  }

  async function handleAddNote() {
    if (!canEditNotes) {
      alert('Δεν έχετε δικαίωμα επεξεργασίας σημειώσεων.')
      return
    }
    const trimmed = nightNoteDraft.trim()
    if (!trimmed) return

    setSavingNote(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      alert('Σφάλμα: Δεν βρέθηκε χρήστης')
      setSavingNote(false)
      return
    }

    const result = await insertNightNote(user.id)
    if (!result.ok) {
      alert('Αποτυχία αποθήκευσης σημείωσης: ' + result.message)
    }
    setSavingNote(false)
  }

  function handleStartEdit(note: ZNoteRow) {
    if (!canEditNotes) return
    setEditingNoteId(note.id)
    setEditingText(note.note_text)
    setEditingUpdatedAt(note.updated_at)
  }

  function handleCancelEdit() {
    setEditingNoteId(null)
    setEditingText('')
    setEditingUpdatedAt(null)
  }

  async function handleSaveEdit(noteId: string) {
    if (!canEditNotes || !editingUpdatedAt) return

    const trimmed = editingText.trim()
    if (!trimmed) {
      alert('Η σημείωση δεν μπορεί να είναι κενή.')
      return
    }

    setSavingNote(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      alert('Σφάλμα: Δεν βρέθηκε χρήστης')
      setSavingNote(false)
      return
    }

    const { data, error } = await supabase
      .from('z_notes')
      .update({
        note_text: trimmed,
        updated_by: user.id,
      })
      .eq('id', noteId)
      .eq('updated_at', editingUpdatedAt)
      .select('id')

    if (error) {
      alert('Αποτυχία ενημέρωσης σημείωσης: ' + error.message)
    } else if (!optimisticUpdateSucceeded(data)) {
      alert('Η σημείωση άλλαξε από άλλο χρήστη. Κάντε ανανέωση και ξαναδοκιμάστε.')
    } else {
      handleCancelEdit()
      await loadNotes()
    }

    setSavingNote(false)
  }

  async function handleSoftDelete(note: ZNoteRow) {
    if (!canEditNotes) return
    if (!confirm('Να διαγραφεί η σημείωση;')) return

    setSavingNote(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      alert('Σφάλμα: Δεν βρέθηκε χρήστης')
      setSavingNote(false)
      return
    }

    const { data, error } = await supabase
      .from('z_notes')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        updated_by: user.id,
      })
      .eq('id', note.id)
      .eq('updated_at', note.updated_at)
      .select('id')

    if (error) {
      alert('Αποτυχία διαγραφής σημείωσης: ' + error.message)
    } else if (!optimisticUpdateSucceeded(data)) {
      alert('Η σημείωση άλλαξε από άλλο χρήστη. Κάντε ανανέωση και ξαναδοκιμάστε.')
    } else {
      await loadNotes()
    }
    setSavingNote(false)
  }

  async function handleToggleHistory(noteId: string) {
    if (!canViewHistory) return
    const isOpen = expandedHistory[noteId] === true
    setExpandedHistory((prev) => ({ ...prev, [noteId]: !isOpen }))
    if (isOpen || historyByNoteId[noteId]) return

    setHistoryLoadingByNoteId((prev) => ({ ...prev, [noteId]: true }))
    const { data, error } = await supabase
      .from('z_note_revisions')
      .select('id, action, old_text, new_text, changed_at, changed_by')
      .eq('note_id', noteId)
      .order('changed_at', { ascending: false })

    if (!error) {
      setHistoryByNoteId((prev) => ({ ...prev, [noteId]: (data || []) as ZRevisionRow[] }))
    }
    setHistoryLoadingByNoteId((prev) => ({ ...prev, [noteId]: false }))
  }

  async function handleUnlock() {
    if (!storeId) return
    const confirmUnlock = confirm(
      'ΠΡΟΣΟΧΗ!\nΑυτό θα διαγράψει το τρέχον κλείσιμο Ζ για να εισάγετε νέα ποσά. Θέλετε να συνεχίσετε;'
    )
    if (!confirmUnlock) return

    setLoading(true)

    // ✅ Σβήνουμε ΟΛΕΣ τις εγγραφές του Z κλεισίματος (category + date + store)
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('category', Z_CATEGORY)
      .eq('date', date)
      .eq('store_id', storeId)

    if (!error) {
      setIsAlreadyClosed(false)
      setCashZ('')
      setPosZ('')
      setNoTax('')
      alert('Η ημέρα ξεκλειδώθηκε. Μπορείτε να εισάγετε τα νέα ποσά.')
    } else {
      alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  const totalSales = parseMoneyInput(cashZ) + parseMoneyInput(posZ) + parseMoneyInput(noTax)

  async function handleSaveZ() {
    if (isAlreadyClosed || totalSales <= 0 || !storeId) return
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      alert('Σφάλμα: Δεν βρέθηκε χρήστης')
      setLoading(false)
      return
    }

    const { data: prof } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
    const createdByName = (prof?.username || user.email?.split('@')[0] || 'Χρήστης').trim()

    const cashAmount = parseMoneyInput(cashZ)
    const posAmount = parseMoneyInput(posZ)
    const noTaxAmount = parseMoneyInput(noTax)

    const incomeTransactions = [
      {
        amount: cashAmount,
        method: Z_METHODS.CASH, // ✅ Μετρητά (Z)
        notes: Z_NOTES.OFFICIAL,
        type: 'income',
        date,
        category: Z_CATEGORY,
        created_by_name: createdByName,
        user_id: user.id,
        store_id: storeId,
      },
      {
        amount: posAmount,
        method: Z_METHODS.CARD, // ✅ Κάρτα
        notes: Z_NOTES.OFFICIAL_POS,
        type: 'income',
        date,
        category: Z_CATEGORY,
        created_by_name: createdByName,
        user_id: user.id,
        store_id: storeId,
      },
      {
        amount: noTaxAmount,
        method: Z_METHODS.NO_TAX, // ✅ Χωρίς Απόδειξη (clean label)
        notes: Z_NOTES.BLACK, // ✅ ΧΩΡΙΣ ΣΗΜΑΝΣΗ (κλειδί για Ανάλυση)
        type: 'income',
        date,
        category: Z_CATEGORY, // ✅ ΠΑΝΤΑ Εσοδα Ζ
        created_by_name: createdByName,
        user_id: user.id,
        store_id: storeId,
      },
    ].filter((t) => parseMoneyInput(t.amount) > 0)

    const { error } = await supabase.from('transactions').insert(incomeTransactions)

    if (!error) {
      if (nightNoteDraft.trim()) {
        const noteResult = await insertNightNote(user.id)
        if (!noteResult.ok) {
          alert('Το Ζ αποθηκεύτηκε, αλλά η σημείωση απέτυχε: ' + noteResult.message)
        }
      }
      alert(`Επιτυχές κλείσιμο βάρδιας: ${format(parseLocalDateOnly(date), 'dd/MM')}`)
      router.push(`/?store=${storeId}`)
    } else {
      alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <main style={mainWrapperStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
          {/* ✅ Επιστροφή με διατήρηση καταστήματος */}
          <Link href={`/?store=${storeId}`} style={backBtnStyle}>
            ←
          </Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Κλείσιμο Ζ</h2>
        </div>

        {isAlreadyClosed && (
          <div style={warningBox}>
            <p style={{ margin: '0 0 10px 0' }}>⚠️ Το ταμείο έχει ήδη κλείσει για αυτή την ημερομηνία.</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button onClick={() => router.push(`/analysis?date=${date}&store=${storeId}`)} style={viewBtn}>
                🔎 ΠΡΟΒΟΛΗ
              </button>
              <button onClick={handleUnlock} style={unlockBtn} disabled={loading}>
                🔓 ΞΕΚΛΕΙΔΩΜΑ
              </button>
            </div>
          </div>
        )}

        <div style={userLabelStyle}>
          <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b' }}>
            👤 ΧΡΗΣΤΗΣ: {username.toUpperCase()}
          </span>
        </div>

        <div style={sectionBox}>
          <p style={sectionTitle}>💰 ΕΙΣΠΡΑΞΕΙΣ ΒΑΡΔΙΑΣ</p>

          <div style={fieldBox}>
            <label style={labelStyle}>💵 ΜΕΤΡΗΤΑ (Z)</label>
            <input
              type="number"
              inputMode="decimal"
              value={cashZ}
              onChange={(e) => setCashZ(e.target.value)}
              style={inputStyle}
              disabled={isAlreadyClosed}
              placeholder="0.00"
            />
          </div>

          <div style={fieldBox}>
            <label style={labelStyle}>💳 ΚΑΡΤΑ / POS (Z)</label>
            <input
              type="number"
              inputMode="decimal"
              value={posZ}
              onChange={(e) => setPosZ(e.target.value)}
              style={inputStyle}
              disabled={isAlreadyClosed}
              placeholder="0.00"
            />
          </div>

          <div style={fieldBox}>
            <label style={labelStyle}>🧾 ΧΩΡΙΣ ΑΠΟΔΕΙΞΗ</label>
            <input
              type="number"
              inputMode="decimal"
              value={noTax}
              onChange={(e) => setNoTax(e.target.value)}
              style={inputStyle}
              disabled={isAlreadyClosed}
              placeholder="0.00"
            />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>ΗΜΕΡΟΜΗΝΙΑ ΒΑΡΔΙΑΣ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={dateInputStyle} />
        </div>

        <div style={notesSectionBox}>
          <p style={sectionTitle}>🗒️ ΣΗΜΕΙΩΣΕΙΣ ΒΡΑΔΙΑΣ</p>
          <select
            value={noteType}
            onChange={(e) => setNoteType(e.target.value as ZNoteType)}
            style={noteTypeSelectStyle}
            disabled={!canEditNotes || savingNote}
          >
            {NOTE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <textarea
            value={nightNoteDraft}
            onChange={(e) => setNightNoteDraft(e.target.value)}
            placeholder="Καταχώρησε βλάβες, ελλείψεις, παράπονα ή εκκρεμότητες για την επόμενη βάρδια..."
            style={notesTextareaStyle}
            rows={5}
            disabled={!canEditNotes || savingNote}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleAddNote} style={addNoteBtnStyle} disabled={!canEditNotes || savingNote || !nightNoteDraft.trim()}>
              + Προσθήκη Σημείωσης
            </button>
          </div>

          {!canEditNotes && <p style={noteMutedStyle}>Read-only: μόνο admin ή χρήστες με δικαίωμα επεξεργασίας μπορούν να γράψουν.</p>}

          <div style={{ marginTop: 12 }}>
            <p style={timelineTitleStyle}>Timeline Σημειώσεων ({notes.length})</p>
            {notesLoading ? (
              <p style={noteMutedStyle}>Φόρτωση...</p>
            ) : notes.length === 0 ? (
              <p style={noteMutedStyle}>Δεν υπάρχουν σημειώσεις για αυτή την ημερομηνία.</p>
            ) : (
              notes.map((note) => {
                const isEditing = editingNoteId === note.id
                const historyOpen = expandedHistory[note.id] === true
                const historyRows = historyByNoteId[note.id] || []
                return (
                  <div key={note.id} style={noteCardStyle}>
                    <div style={noteCardHeaderStyle}>
                      <span style={noteTypeChipStyle}>{NOTE_TYPE_LABELS[note.note_type || 'general'] ?? note.note_type ?? 'Γενική Σημείωση'}</span>
                      <span style={noteMetaStyle}>#{formatUserRef(note.created_by)} • {formatDateTime(note.created_at)}</span>
                    </div>

                    {isEditing ? (
                      <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} style={notesTextareaEditStyle} rows={4} />
                    ) : (
                      <p style={noteTextStyle}>{note.note_text}</p>
                    )}

                    <p style={noteMetaStyle}>Τελευταία ενημέρωση: {formatDateTime(note.updated_at)} • #{formatUserRef(note.updated_by || note.created_by)}</p>

                    <div style={noteActionsStyle}>
                      {isEditing ? (
                        <>
                          <button type="button" onClick={() => handleSaveEdit(note.id)} style={noteActionPrimaryStyle} disabled={savingNote}>Αποθήκευση</button>
                          <button type="button" onClick={handleCancelEdit} style={noteActionGhostStyle} disabled={savingNote}>Άκυρο</button>
                        </>
                      ) : (
                        canEditNotes && (
                          <>
                            <button type="button" onClick={() => handleStartEdit(note)} style={noteActionGhostStyle} disabled={savingNote}>Επεξεργασία</button>
                            <button type="button" onClick={() => handleSoftDelete(note)} style={noteActionDangerStyle} disabled={savingNote}>Διαγραφή</button>
                          </>
                        )
                      )}

                      {canViewHistory && !isEditing && (
                        <button type="button" onClick={() => handleToggleHistory(note.id)} style={noteActionGhostStyle}>
                          {historyOpen ? 'Απόκρυψη Ιστορικού' : 'Ιστορικό'}
                        </button>
                      )}
                    </div>

                    {canViewHistory && historyOpen && (
                      <div style={historyWrapStyle}>
                        {historyLoadingByNoteId[note.id] ? (
                          <p style={noteMutedStyle}>Φόρτωση ιστορικού...</p>
                        ) : historyRows.length === 0 ? (
                          <p style={noteMutedStyle}>Δεν υπάρχουν αλλαγές.</p>
                        ) : (
                          historyRows.map((h) => (
                            <div key={h.id} style={historyRowStyle}>
                              <p style={historyActionStyle}>{h.action.toUpperCase()} • #{formatUserRef(h.changed_by)} • {formatDateTime(h.changed_at)}</p>
                              {h.action === 'update' && (
                                <p style={historyTextStyle}>Old: {h.old_text || '—'} | New: {h.new_text || '—'}</p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div style={totalDisplay}>
          <p style={labelStyle}>ΣΥΝΟΛΙΚΟΣ ΤΖΙΡΟΣ</p>
          <h2 style={{ fontSize: '32px', margin: 0, fontWeight: '900', color: '#0f172a' }}>{totalSales.toFixed(2)}€</h2>
        </div>

        <button
          onClick={handleSaveZ}
          disabled={loading || isAlreadyClosed}
          style={{
            ...saveBtn,
            backgroundColor: isAlreadyClosed ? '#cbd5e1' : '#0f172a',
            cursor: isAlreadyClosed ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Επεξεργασία...' : isAlreadyClosed ? 'ΗΜΕΡΑ ΚΛΕΙΣΜΕΝΗ' : 'ΟΡΙΣΤΙΚΟΠΟΙΗΣΗ & ΚΛΕΙΣΙΜΟ'}
        </button>

        {/* ✅ Extra space για άνετο scrolling */}
        <div style={{ height: '80px' }} />
      </div>
    </main>
  )
}

// --- ΣΤΥΛ ΠΟΥ ΔΙΟΡΘΩΝΟΥΝ ΤΟ SCROLLING ΣΤΟΝ ΥΠΟΛΟΓΙΣΤΗ ---
const mainWrapperStyle: any = {
  backgroundColor: '#f8fafc',
  minHeight: '100dvh',
  padding: '16px',
  fontFamily: 'sans-serif',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflowY: 'auto',
}

const cardStyle: any = {
  maxWidth: '500px',
  margin: '0 auto',
  backgroundColor: 'white',
  borderRadius: '28px',
  padding: '24px',
  boxShadow: '0 10px 15px rgba(0,0,0,0.05)',
  marginBottom: '20px',
}

const warningBox = {
  backgroundColor: '#fff1f2',
  color: '#be123c',
  padding: '15px',
  borderRadius: '18px',
  fontSize: '13px',
  fontWeight: '800',
  marginBottom: '20px',
  border: '1px solid #fecaca',
  textAlign: 'center' as const,
}

const viewBtn = {
  backgroundColor: '#1e293b',
  color: 'white',
  border: 'none',
  padding: '10px 15px',
  borderRadius: '10px',
  fontSize: '10px',
  fontWeight: '900',
  cursor: 'pointer',
}

const unlockBtn = {
  backgroundColor: '#be123c',
  color: 'white',
  border: 'none',
  padding: '10px 15px',
  borderRadius: '10px',
  fontSize: '10px',
  fontWeight: '900',
  cursor: 'pointer',
}

const userLabelStyle = {
  marginBottom: '20px',
  padding: '10px',
  backgroundColor: '#f1f5f9',
  borderRadius: '12px',
  textAlign: 'center' as const,
}

const sectionBox = { marginBottom: '20px', padding: '18px', borderRadius: '22px', border: '1px solid #e2e8f0' }

const sectionTitle = {
  fontSize: '10px',
  fontWeight: '900',
  color: '#64748b',
  marginBottom: '15px',
  letterSpacing: '0.5px',
}

const fieldBox = { marginBottom: '15px' }

const labelStyle = {
  fontSize: '10px',
  fontWeight: '900',
  color: '#94a3b8',
  marginBottom: '5px',
  display: 'block',
}

const inputStyle: any = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#1e293b',
  outline: 'none',
  borderBottom: '2px solid #f1f5f9',
  padding: '8px 0',
}

const dateInputStyle = {
  width: '100%',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  fontSize: '16px',
  fontWeight: 'bold' as const,
}

const notesSectionBox: any = {
  marginBottom: '20px',
  padding: '18px',
  borderRadius: '22px',
  border: '1px solid #dbeafe',
  backgroundColor: '#f8fbff',
}

const noteTypeSelectStyle: any = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '10px',
  marginBottom: '10px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#1e293b',
  backgroundColor: '#fff',
}

const notesTextareaStyle: any = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '12px',
  fontSize: '14px',
  lineHeight: 1.4,
  resize: 'vertical',
  marginBottom: '10px',
}

const notesTextareaEditStyle: any = {
  width: '100%',
  border: '1px solid #94a3b8',
  borderRadius: '10px',
  padding: '10px',
  fontSize: '14px',
  lineHeight: 1.4,
  resize: 'vertical',
  marginBottom: '8px',
}

const addNoteBtnStyle: any = {
  backgroundColor: '#0f172a',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  padding: '10px 12px',
  fontSize: '12px',
  fontWeight: 900,
  cursor: 'pointer',
}

const timelineTitleStyle: any = {
  fontSize: '12px',
  fontWeight: 900,
  color: '#334155',
  margin: '0 0 8px 0',
}

const noteCardStyle: any = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '10px',
  backgroundColor: '#fff',
  marginBottom: '8px',
}

const noteCardHeaderStyle: any = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '8px',
  alignItems: 'center',
  flexWrap: 'wrap',
}

const noteTypeChipStyle: any = {
  display: 'inline-block',
  fontSize: '10px',
  fontWeight: 900,
  color: '#1d4ed8',
  backgroundColor: '#dbeafe',
  borderRadius: '999px',
  padding: '4px 8px',
}

const noteMetaStyle: any = {
  fontSize: '10px',
  color: '#64748b',
  margin: 0,
  fontWeight: 700,
}

const noteTextStyle: any = {
  fontSize: '13px',
  color: '#0f172a',
  margin: '8px 0',
  whiteSpace: 'pre-wrap',
}

const noteActionsStyle: any = {
  display: 'flex',
  gap: '6px',
  flexWrap: 'wrap',
  marginTop: '6px',
}

const noteActionPrimaryStyle: any = {
  border: '1px solid #2563eb',
  backgroundColor: '#2563eb',
  color: '#fff',
  borderRadius: '8px',
  padding: '6px 8px',
  fontSize: '11px',
  fontWeight: 800,
  cursor: 'pointer',
}

const noteActionGhostStyle: any = {
  border: '1px solid #cbd5e1',
  backgroundColor: '#fff',
  color: '#334155',
  borderRadius: '8px',
  padding: '6px 8px',
  fontSize: '11px',
  fontWeight: 800,
  cursor: 'pointer',
}

const noteActionDangerStyle: any = {
  border: '1px solid #fecaca',
  backgroundColor: '#fff1f2',
  color: '#b91c1c',
  borderRadius: '8px',
  padding: '6px 8px',
  fontSize: '11px',
  fontWeight: 800,
  cursor: 'pointer',
}

const historyWrapStyle: any = {
  marginTop: '8px',
  paddingTop: '8px',
  borderTop: '1px dashed #cbd5e1',
}

const historyRowStyle: any = {
  marginBottom: '6px',
}

const historyActionStyle: any = {
  margin: 0,
  fontSize: '10px',
  fontWeight: 900,
  color: '#475569',
}

const historyTextStyle: any = {
  margin: '2px 0 0 0',
  fontSize: '11px',
  color: '#334155',
  whiteSpace: 'pre-wrap',
}

const noteMutedStyle: any = {
  fontSize: '11px',
  color: '#64748b',
  margin: '6px 0 0 0',
  fontWeight: 700,
}

const totalDisplay = {
  textAlign: 'center' as const,
  padding: '20px',
  marginBottom: '25px',
  backgroundColor: '#f8fafc',
  borderRadius: '20px',
  border: '1px solid #e2e8f0',
}

const saveBtn: any = {
  width: '100%',
  padding: '20px',
  color: 'white',
  borderRadius: '18px',
  border: 'none',
  fontWeight: '900',
  fontSize: '16px',
}

const backBtnStyle: any = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  background: '#f1f5f9',
  width: '40px',
  height: '40px',
  borderRadius: '12px',
  fontSize: '20px',
  color: '#64748b',
}

export default function DailyZPage() {
  return (
    <Suspense fallback={null}>
      <DailyZContent />
    </Suspense>
  )
}
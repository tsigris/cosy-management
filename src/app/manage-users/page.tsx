'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

type UserRole = 'admin' | 'user'
type ListedRole = 'admin' | 'user' | 'staff'

type StoreUser = {
  user_id: string
  user_email: string | null
  role: ListedRole
  can_view_analysis?: boolean
  can_view_history?: boolean
  can_edit_transactions?: boolean
}

export default function ManageUsersPage() {
  const searchParams = useSearchParams()
  const storeFromQuery = searchParams.get('store')
  const [storeFromStorage, setStoreFromStorage] = useState('')
  const storeId = useMemo(() => (storeFromQuery || storeFromStorage || '').trim(), [storeFromQuery, storeFromStorage])
  const hasStoreId = Boolean(storeId)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setStoreFromStorage(localStorage.getItem('active_store_id') || '')
  }, [])

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [tempPassword, setTempPassword] = useState('')
  const [sendResetAfterCreate, setSendResetAfterCreate] = useState(true)
  const [loadingCreate, setLoadingCreate] = useState(false)
  const [loadingReset, setLoadingReset] = useState(false)
  const [users, setUsers] = useState<StoreUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [usersPage, setUsersPage] = useState(1)
  const [usersPageSize, setUsersPageSize] = useState<number>(10)
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersTotalPages, setUsersTotalPages] = useState(1)
  const actionsDisabled = !hasStoreId || loadingUsers || loadingCreate || loadingReset

  const getAccessToken = async (): Promise<string> => {
    const supabase = getSupabaseBrowser()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  const loadUsers = async (options?: { page?: number; search?: string }) => {
    const effectivePage = options?.page ?? usersPage
    const effectiveSearch = options?.search ?? searchTerm

    if (!storeId) {
      setUsers([])
      setUsersTotal(0)
      setUsersTotalPages(1)
      return
    }

    setLoadingUsers(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error('Πρέπει να είστε συνδεδεμένος.')
        return
      }

      const response = await fetch('/api/admin/list-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Supabase-Auth': token,
        },
        body: JSON.stringify({
          storeId,
          q: effectiveSearch,
          page: effectivePage,
          pageSize: usersPageSize,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Αποτυχία φόρτωσης χρηστών.')
      }

      const rows = Array.isArray(result?.items) ? result.items : []
      setUsers(rows)
      setUsersTotal(typeof result?.total === 'number' ? result.total : 0)
      setUsersTotalPages(typeof result?.totalPages === 'number' ? Math.max(1, result.totalPages) : 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία φόρτωσης χρηστών.'
      toast.error(message)
      setUsers([])
      setUsersTotal(0)
      setUsersTotalPages(1)
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    setUsersPage(1)
  }, [storeId])

  useEffect(() => {
    if (!storeId) {
      setUsers([])
      setUsersTotal(0)
      setUsersTotalPages(1)
      return
    }

    void loadUsers()
  }, [storeId, usersPage, searchTerm, usersPageSize])

  const createUser = async () => {
    if (!storeId) {
      toast.error('Δεν βρέθηκε ενεργό κατάστημα.')
      return
    }

    if (!email.trim()) {
      toast.error('Συμπλήρωσε email.')
      return
    }

    setLoadingCreate(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error('Πρέπει να είστε συνδεδεμένος.')
        return
      }

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Supabase-Auth': token,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          role,
          tempPassword: tempPassword.trim() || undefined,
          storeId,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Αποτυχία δημιουργίας χρήστη.')
      }

      toast.success('Ο χρήστης δημιουργήθηκε και συνδέθηκε με το κατάστημα.')
      await loadUsers({ page: usersPage, search: searchTerm })

      if (sendResetAfterCreate) {
        await sendResetFor(email.trim().toLowerCase())
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία δημιουργίας χρήστη.'
      toast.error(message)
    } finally {
      setLoadingCreate(false)
    }
  }

  const sendResetFor = async (targetEmail: string) => {
    if (!storeId) {
      toast.error('Δεν βρέθηκε ενεργό κατάστημα.')
      return
    }

    const normalizedEmail = targetEmail.trim().toLowerCase()
    if (!normalizedEmail) {
      toast.error('Συμπλήρωσε email.')
      return
    }

    setLoadingReset(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error('Πρέπει να είστε συνδεδεμένος.')
        return
      }

      const response = await fetch('/api/admin/send-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Supabase-Auth': token,
        },
        body: JSON.stringify({
          email: normalizedEmail,
          storeId,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Αποτυχία αποστολής reset.')
      }

      toast.success('Στάλθηκε email για reset password.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία αποστολής reset.'
      toast.error(message)
    } finally {
      setLoadingReset(false)
    }
  }

  const sendReset = async () => {
    await sendResetFor(email)
  }

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    if (!storeId) {
      toast.error('Δεν βρέθηκε ενεργό κατάστημα.')
      return
    }

    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error('Πρέπει να είστε συνδεδεμένος.')
        return
      }

      const response = await fetch('/api/admin/update-user-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Supabase-Auth': token,
        },
        body: JSON.stringify({
          storeId,
          userId,
          role: newRole,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Αποτυχία ενημέρωσης ρόλου.')
      }

      toast.success('Ο ρόλος ενημερώθηκε.')
      await loadUsers({ page: usersPage, search: searchTerm })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία ενημέρωσης ρόλου.'
      toast.error(message)
    }
  }

  const removeUser = async (userId: string) => {
    if (!storeId) {
      toast.error('Δεν βρέθηκε ενεργό κατάστημα.')
      return
    }

    const confirmed = typeof window !== 'undefined' ? window.confirm('Θέλεις σίγουρα να αφαιρέσεις αυτόν τον χρήστη;') : false
    if (!confirmed) return

    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error('Πρέπει να είστε συνδεδεμένος.')
        return
      }

      const response = await fetch('/api/admin/remove-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Supabase-Auth': token,
        },
        body: JSON.stringify({
          storeId,
          userId,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Αποτυχία αφαίρεσης χρήστη.')
      }

      toast.success('Ο χρήστης αφαιρέθηκε από το κατάστημα.')
      await loadUsers({ page: usersPage, search: searchTerm })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία αφαίρεσης χρήστη.'
      toast.error(message)
    }
  }

  const applySearch = () => {
    const normalized = searchInput.trim()
    setUsersPage(1)
    setSearchTerm(normalized)
  }

  const clearSearch = () => {
    setSearchInput('')
    setUsersPage(1)
    setSearchTerm('')
  }

  return (
    <main style={pageStyle}>
      <Toaster position="top-center" richColors />
      <div style={containerStyle}>
        <header style={headerStyle}>
          <h1 style={titleStyle}>Διαχείριση Χρηστών</h1>
          <Link href={storeId ? `/?store=${storeId}` : '/select-store'} style={backStyle}>
            Πίσω
          </Link>
        </header>

        <section style={cardStyle}>
          <p style={helperTextStyle}>Store: {storeId || '—'}</p>

          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@example.com"
            style={inputStyle}
          />

          <label style={labelStyle}>Ρόλος</label>
          <select value={role} onChange={(event) => setRole(event.target.value as UserRole)} style={inputStyle}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          <label style={labelStyle}>Προσωρινός κωδικός (προαιρετικό)</label>
          <input
            type="text"
            value={tempPassword}
            onChange={(event) => setTempPassword(event.target.value)}
            placeholder="Αν μείνει κενό, θα δημιουργηθεί τυχαίος"
            style={inputStyle}
          />

          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={sendResetAfterCreate}
              onChange={(event) => setSendResetAfterCreate(event.target.checked)}
            />
            Στείλε Reset Password μετά τη δημιουργία
          </label>

          <button
            type="button"
            onClick={createUser}
            disabled={loadingCreate || loadingReset || !hasStoreId}
            style={{ ...primaryBtnStyle, opacity: hasStoreId ? 1 : 0.6, cursor: hasStoreId ? 'pointer' : 'not-allowed' }}
          >
            {loadingCreate ? 'ΔΗΜΙΟΥΡΓΙΑ...' : 'ΔΗΜΙΟΥΡΓΙΑ'}
          </button>

          <button
            type="button"
            onClick={sendReset}
            disabled={loadingReset || loadingCreate || !hasStoreId}
            style={{ ...secondaryBtnStyle, opacity: hasStoreId ? 1 : 0.6, cursor: hasStoreId ? 'pointer' : 'not-allowed' }}
          >
            {loadingReset ? 'ΑΠΟΣΤΟΛΗ...' : 'ΣΤΕΙΛΕ RESET'}
          </button>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Λίστα Χρηστών</h2>

          <form
            style={searchRowStyle}
            onSubmit={(event) => {
              event.preventDefault()
              applySearch()
            }}
          >
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Αναζήτηση email…"
              style={searchInputStyle}
              disabled={!hasStoreId}
            />
            <button type="submit" disabled={loadingUsers || !hasStoreId} style={{ ...searchBtnStyle, opacity: loadingUsers || !hasStoreId ? 0.6 : 1, cursor: loadingUsers || !hasStoreId ? 'not-allowed' : 'pointer' }}>
              Αναζήτηση
            </button>
            <button type="button" onClick={clearSearch} disabled={loadingUsers || !hasStoreId} style={{ ...clearBtnStyle, opacity: loadingUsers || !hasStoreId ? 0.6 : 1, cursor: loadingUsers || !hasStoreId ? 'not-allowed' : 'pointer' }}>
              Καθαρισμός
            </button>
          </form>

          <div style={metaRowStyle}>
            <p style={helperTextStyle}>Σύνολο: {usersTotal} χρήστες</p>
            <div style={pageSizeWrapStyle}>
              <label style={pageSizeLabelStyle}>pageSize</label>
              <select
                value={usersPageSize}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setUsersPage(1)
                  setUsersPageSize(next)
                }}
                disabled={!hasStoreId || loadingUsers}
                style={{ ...pageSizeSelectStyle, opacity: !hasStoreId || loadingUsers ? 0.6 : 1, cursor: !hasStoreId || loadingUsers ? 'not-allowed' : 'pointer' }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {!hasStoreId ? (
            <p style={helperTextStyle}>Επιλέξτε κατάστημα</p>
          ) : loadingUsers ? (
            <p style={helperTextStyle}>Φόρτωση χρηστών...</p>
          ) : users.length === 0 ? (
            <p style={helperTextStyle}>Δεν υπάρχουν χρήστες στο κατάστημα.</p>
          ) : (
            <div style={listWrapStyle}>
              {users.map((user) => {
                const isAdmin = user.role === 'admin'
                const displayRole = isAdmin ? 'ADMIN' : 'USER'
                const selectValue: UserRole = user.role === 'admin' ? 'admin' : 'user'

                return (
                  <article key={user.user_id} style={userRowStyle}>
                    <div style={userRowTopStyle}>
                      <div style={userIdentityStyle}>
                        <p style={userEmailStyle}>{user.user_email || user.user_id}</p>
                        {!user.user_email ? <p style={unknownEmailStyle}>Email άγνωστο (παλιή εγγραφή)</p> : null}
                      </div>
                      <span style={{ ...roleBadgeStyle, background: isAdmin ? '#dcfce7' : '#e2e8f0', color: isAdmin ? '#166534' : '#334155' }}>
                        {displayRole}
                      </span>
                    </div>

                    <div style={rowActionsStyle}>
                      <button
                        type="button"
                        style={{ ...rowBtnStyle, opacity: actionsDisabled || !user.user_email ? 0.6 : 1, cursor: actionsDisabled || !user.user_email ? 'not-allowed' : 'pointer' }}
                        disabled={actionsDisabled || !user.user_email}
                        onClick={() => {
                          if (!user.user_email) return
                          void sendResetFor(user.user_email)
                        }}
                      >
                        Reset
                      </button>

                      <select
                        value={selectValue}
                        disabled={actionsDisabled}
                        onChange={(event) => {
                          const nextRole = event.target.value as UserRole
                          void updateUserRole(user.user_id, nextRole)
                        }}
                        style={{ ...rowSelectStyle, opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                      >
                        <option value="user">USER</option>
                        <option value="admin">ADMIN</option>
                      </select>

                      <button
                        type="button"
                        style={{ ...removeBtnStyle, opacity: actionsDisabled ? 0.6 : 1, cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
                        disabled={actionsDisabled}
                        onClick={() => {
                          void removeUser(user.user_id)
                        }}
                      >
                        Αφαίρεση
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          <div style={paginationRowStyle}>
            <button
              type="button"
              onClick={() => setUsersPage((previous) => Math.max(1, previous - 1))}
              disabled={loadingUsers || usersPage <= 1 || !hasStoreId}
              style={{ ...paginationBtnStyle, opacity: loadingUsers || usersPage <= 1 || !hasStoreId ? 0.6 : 1, cursor: loadingUsers || usersPage <= 1 || !hasStoreId ? 'not-allowed' : 'pointer' }}
            >
              Previous
            </button>

            <p style={paginationTextStyle}>Σελίδα {usersPage} από {usersTotalPages}</p>

            <button
              type="button"
              onClick={() => setUsersPage((previous) => Math.min(usersTotalPages, previous + 1))}
              disabled={loadingUsers || usersPage >= usersTotalPages || !hasStoreId}
              style={{ ...paginationBtnStyle, opacity: loadingUsers || usersPage >= usersTotalPages || !hasStoreId ? 0.6 : 1, cursor: loadingUsers || usersPage >= usersTotalPages || !hasStoreId ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  padding: '20px 14px 40px',
}

const containerStyle: React.CSSProperties = {
  maxWidth: '460px',
  margin: '0 auto',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontWeight: 900,
  fontSize: '22px',
}

const backStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#0f172a',
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '8px 12px',
  fontWeight: 700,
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '20px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  marginBottom: '14px',
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontWeight: 900,
  fontSize: '16px',
}

const helperTextStyle: React.CSSProperties = {
  margin: 0,
  color: '#64748b',
  fontWeight: 600,
  fontSize: '12px',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#334155',
  fontWeight: 700,
  marginTop: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '12px',
  fontSize: '14px',
  outline: 'none',
  color: '#0f172a',
}

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#334155',
  marginTop: '6px',
}

const primaryBtnStyle: React.CSSProperties = {
  marginTop: '8px',
  width: '100%',
  border: 'none',
  borderRadius: '12px',
  padding: '12px',
  background: '#0f172a',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '12px',
  background: '#fff',
  color: '#0f172a',
  fontWeight: 800,
  cursor: 'pointer',
}

const listWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
}

const searchRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto auto',
  gap: '8px',
}

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
}

const pageSizeWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
}

const pageSizeLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#475569',
  fontWeight: 700,
}

const pageSizeSelectStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  padding: '6px 8px',
  background: '#fff',
  color: '#0f172a',
  fontWeight: 700,
  fontSize: '12px',
}

const searchInputStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '10px',
  fontSize: '13px',
  outline: 'none',
}

const searchBtnStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '10px',
  padding: '10px 12px',
  background: '#0f172a',
  color: '#fff',
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
}

const clearBtnStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '10px 12px',
  background: '#fff',
  color: '#0f172a',
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
}

const userRowStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  background: '#f8fafc',
}

const userRowTopStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '10px',
}

const userIdentityStyle: React.CSSProperties = {
  minWidth: 0,
}

const userEmailStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontWeight: 700,
  fontSize: '14px',
  wordBreak: 'break-word',
}

const unknownEmailStyle: React.CSSProperties = {
  margin: '4px 0 0 0',
  color: '#b45309',
  fontWeight: 600,
  fontSize: '12px',
}

const roleBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '999px',
  padding: '4px 10px',
  fontSize: '11px',
  fontWeight: 800,
  flexShrink: 0,
}

const rowActionsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '8px',
}

const rowBtnStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#0f172a',
  borderRadius: '10px',
  padding: '9px 8px',
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
}

const rowSelectStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#0f172a',
  borderRadius: '10px',
  padding: '9px 8px',
  fontWeight: 700,
  fontSize: '12px',
  outline: 'none',
}

const removeBtnStyle: React.CSSProperties = {
  border: '1px solid #fecaca',
  background: '#fff1f2',
  color: '#9f1239',
  borderRadius: '10px',
  padding: '9px 8px',
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
}

const paginationRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  gap: '8px',
  marginTop: '6px',
}

const paginationBtnStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '9px 10px',
  background: '#fff',
  color: '#0f172a',
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
}

const paginationTextStyle: React.CSSProperties = {
  margin: 0,
  color: '#334155',
  fontWeight: 700,
  fontSize: '12px',
}

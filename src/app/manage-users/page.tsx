'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'

type UserRole = 'admin' | 'user'

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
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      if (sendResetAfterCreate) {
        await sendReset()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία δημιουργίας χρήστη.'
      toast.error(message)
    } finally {
      setLoadingCreate(false)
    }
  }

  const sendReset = async () => {
    if (!storeId) {
      toast.error('Δεν βρέθηκε ενεργό κατάστημα.')
      return
    }

    if (!email.trim()) {
      toast.error('Συμπλήρωσε email.')
      return
    }

    setLoadingReset(true)
    try {
      const response = await fetch('/api/admin/send-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
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

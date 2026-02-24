'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, Suspense, useCallback } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { ShieldCheck, X } from 'lucide-react'
import ErrorBoundary from '@/components/ErrorBoundary'

type UserRole = 'admin' | 'user'

type StoreUser = {
  user_id: string
  user_email: string | null
  role: 'admin' | 'user' | 'staff'
  can_view_analysis?: boolean
  can_view_history?: boolean
  can_edit_transactions?: boolean
}

function PermissionsContent() {
  const supabase = getSupabaseBrowser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeFromQuery = searchParams.get('store')
  const [storeFromStorage, setStoreFromStorage] = useState('')
  const storeId = useMemo(() => (storeFromQuery || storeFromStorage || '').trim(), [storeFromQuery, storeFromStorage])

  const [users, setUsers] = useState<StoreUser[]>([])
  const [loading, setLoading] = useState(false)
  const [hasToken, setHasToken] = useState(true)
  const [actionLoadingUserId, setActionLoadingUserId] = useState('')
  const [myId, setMyId] = useState('')
  const actionsDisabled = !storeId || loading || !hasToken

  useEffect(() => {
    if (typeof window === 'undefined') return
    setStoreFromStorage(localStorage.getItem('active_store_id') || '')
  }, [])

  const getAccessToken = async (): Promise<string> => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  const getAuthHeaders = (token: string) => ({
    'Content-Type': 'application/json',
    'X-Supabase-Auth': token,
  })

  const fetchAllUsers = useCallback(async (token: string) => {
    if (!storeId) return [] as StoreUser[]

    let page = 1
    let totalPages = 1
    const allUsers: StoreUser[] = []

    while (page <= totalPages) {
      const response = await fetch('/api/admin/list-users', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          storeId,
          q: '',
          page,
          pageSize: 50,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Αποτυχία φόρτωσης χρηστών.')
      }

      const pageItems = Array.isArray(result?.items) ? result.items : []
      allUsers.push(...pageItems)
      totalPages = typeof result?.totalPages === 'number' ? Math.max(1, result.totalPages) : 1
      page += 1
    }

    return allUsers
  }, [storeId])

  const fetchPermissionsData = useCallback(async () => {
    if (!storeId) {
      setUsers([])
      return
    }

    try {
      setLoading(true)
      const token = await getAccessToken()
      setHasToken(Boolean(token))

      if (!token) {
        toast.error('Πρέπει να είστε συνδεδεμένος.')
        setUsers([])
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setMyId(user.id)

      const loadedUsers = await fetchAllUsers(token)
      setUsers(loadedUsers)
    } catch (err: any) {
      toast.error(err?.message || 'Αποτυχία συγχρονισμού')
    } finally {
      setLoading(false)
    }
  }, [fetchAllUsers, router, storeId, supabase])

  useEffect(() => {
    void fetchPermissionsData()
  }, [fetchPermissionsData])

  const sendResetFor = async (targetEmail: string) => {
    if (!storeId) return

    const normalizedEmail = targetEmail.trim().toLowerCase()
    if (!normalizedEmail) {
      toast.error('Συμπλήρωσε email.')
      return
    }

    try {
      const token = await getAccessToken()
      setHasToken(Boolean(token))

      if (!token) {
        toast.error('Πρέπει να είστε συνδεδεμένος.')
        return
      }

      const response = await fetch('/api/admin/send-reset', {
        method: 'POST',
        headers: getAuthHeaders(token),
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
    }
  }

  const updateUserRole = async (userId: string, role: UserRole) => {
    if (!storeId) return

    if (userId === myId && role !== 'admin') {
      toast.error('Δεν μπορείτε να αλλάξετε τον ρόλο του εαυτού σας.')
      return
    }

    try {
      setActionLoadingUserId(userId)

      const token = await getAccessToken()
      setHasToken(Boolean(token))

      if (!token) {
        toast.error('Πρέπει να είστε συνδεδεμένος.')
        return
      }

      const response = await fetch('/api/admin/update-user-role', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          storeId,
          userId,
          role,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Αποτυχία ενημέρωσης ρόλου.')
      }

      toast.success('Ο ρόλος ενημερώθηκε.')
      await fetchPermissionsData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία ενημέρωσης ρόλου.'
      toast.error(message)
    } finally {
      setActionLoadingUserId('')
    }
  }

  const removeUser = async (userId: string) => {
    if (!storeId) return
    if (userId === myId) {
      toast.error('Δεν μπορείτε να αφαιρέσετε τον εαυτό σας.')
      return
    }

    if (!confirm('Οριστική αφαίρεση πρόσβασης;')) return

    try {
      setActionLoadingUserId(userId)

      const token = await getAccessToken()
      setHasToken(Boolean(token))

      if (!token) {
        toast.error('Πρέπει να είστε συνδεδεμένος.')
        return
      }

      const response = await fetch('/api/admin/remove-user', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          storeId,
          userId,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Αποτυχία αφαίρεσης χρήστη.')
      }

      toast.success('Ο χρήστης αφαιρέθηκε')
      await fetchPermissionsData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία αφαίρεσης χρήστη.'
      toast.error(message)
    } finally {
      setActionLoadingUserId('')
    }
  }

  const safeUsers = Array.isArray(users) ? users : []
  const admins = safeUsers.filter((u) => u?.role === 'admin')

  return (
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />
      
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}><ShieldCheck size={24} color="#b45309" /></div>
          <div>
            <h1 style={titleStyle}>Δικαιώματα</h1>
            <p style={subtitleStyle}>ΔΙΑΧΕΙΡΙΣΗ ΠΡΟΣΒΑΣΗΣ</p>
          </div>
        </div>
        <Link href={storeId ? `/?store=${storeId}` : '/select-store'} style={closeBtnStyle}><X size={20} /></Link>
      </header>

      {!storeId ? (
        <div style={loadingTextStyle}>Επιλέξτε κατάστημα</div>
      ) : !hasToken ? (
        <div style={loadingTextStyle}>Πρέπει να είστε συνδεδεμένος.</div>
      ) : loading ? (
        <div style={loadingTextStyle}>ΣΥΓΧΡΟΝΙΣΜΟΣ ΧΡΗΣΤΩΝ...</div>
      ) : (
        <div style={{ paddingBottom: '100px' }}>
          <div style={heroCardStyle}>
            <p style={heroLabel}>ΔΙΚΑΙΩΜΑΤΑ ΚΑΤΑΣΤΗΜΑΤΟΣ</p>
            <h2 style={heroAmountText}>{admins.length}</h2>
            <div style={heroStatsRow}>
              <span style={heroStatValue}>ΕΝΕΡΓΟΙ ADMINS</span>
            </div>
          </div>

          <p style={sectionLabel}>ΔΙΑΧΕΙΡΙΣΤΕΣ ({admins.length})</p>
          {admins.length > 0 ? (
            admins.map((u) => {
              const selectValue: UserRole = u.role === 'admin' ? 'admin' : 'user'
              const disabledByLoad = actionsDisabled || actionLoadingUserId === u.user_id
              const isSelf = u.user_id === myId

              return (
                <article key={u.user_id} style={userCard}>
                  <div style={userTopRow}>
                    <div style={{ flex: 1 }}>
                      <p style={adminNameText}>{(u.user_email || u.user_id)} {u.user_id === myId ? '(ΕΣΕΙΣ)' : ''}</p>
                      {!u.user_email ? <p style={unknownEmailStyle}>Email άγνωστο (παλιή εγγραφή)</p> : null}
                    </div>
                    <span style={adminBadge}>ADMIN</span>
                  </div>
                  <div style={rowActionsStyle}>
                    <button
                      type="button"
                      style={{ ...editBtnStyle, opacity: disabledByLoad || !u.user_email ? 0.6 : 1, cursor: disabledByLoad || !u.user_email ? 'not-allowed' : 'pointer' }}
                      disabled={disabledByLoad || !u.user_email}
                      onClick={() => {
                        if (!u.user_email) return
                        void sendResetFor(u.user_email)
                      }}
                    >
                      Reset
                    </button>
                    <select
                      value={selectValue}
                      disabled={disabledByLoad || isSelf}
                      onChange={(event) => {
                        if (isSelf) {
                          toast.error('Δεν μπορείτε να αλλάξετε τον ρόλο του εαυτού σας.')
                          return
                        }
                        const role = event.target.value as UserRole
                        void updateUserRole(u.user_id, role)
                      }}
                      style={{ ...selectStyle, opacity: disabledByLoad || isSelf ? 0.6 : 1, cursor: disabledByLoad || isSelf ? 'not-allowed' : 'pointer' }}
                    >
                      <option value="user">USER</option>
                      <option value="admin">ADMIN</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (isSelf) {
                          toast.error('Δεν μπορείτε να αφαιρέσετε τον εαυτό σας.')
                          return
                        }
                        void removeUser(u.user_id)
                      }}
                      style={{ ...delBtnStyle, opacity: disabledByLoad || isSelf ? 0.6 : 1, cursor: disabledByLoad || isSelf ? 'not-allowed' : 'pointer' }}
                      disabled={disabledByLoad || isSelf}
                    >
                      Αφαίρεση
                    </button>
                  </div>
                </article>
              )
            })
          ) : (
            <div style={loadingTextStyle}>Δεν βρέθηκαν διαχειριστές</div>
          )}

          <div style={actionGrid}>
            <div style={actionRow}>
              <Link href={storeId ? `/manage-users?store=${storeId}` : '/manage-users'} style={{ ...actionBtn, backgroundColor: colors.accentGreen }}>
                + ΠΡΟΣΘΗΚΗ ΧΕΙΡΙΣΤΗ
              </Link>
            </div>
          </div>

          <Link href={storeId ? `/manage-users?store=${storeId}` : '/manage-users'} style={inviteBtn}>
            ADVANCED VIEW
          </Link>
        </div>
      )}
    </div>
  )
}

export default function PermissionsPage() {
  return (
    <main style={{backgroundColor:'#f8fafc', minHeight:'100vh'}}>
      <ErrorBoundary>
        <Suspense fallback={<div style={loadingTextStyle}>Φόρτωση δικαιωμάτων...</div>}>
          <PermissionsContent />
        </Suspense>
      </ErrorBoundary>
    </main>
  )
}

const containerStyle: any = { maxWidth: '480px', margin: '0 auto', padding: '20px' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const logoBoxStyle: any = { width: '45px', height: '45px', backgroundColor: '#fef3c7', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const titleStyle = { fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a' };
const subtitleStyle = { fontSize: '10px', color: '#94a3b8', fontWeight: '800', margin: 0 };
const closeBtnStyle: any = { padding: '8px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#94a3b8' };
const loadingTextStyle: any = { textAlign: 'center', padding: '100px 0', fontWeight: '800', color: '#cbd5e1' };
const sectionLabel = { fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase' as const };
const adminNameText = { color: 'white', fontWeight: '900', margin: 0, fontSize: '15px' };
const adminBadge = { color: '#4ade80', fontSize: '10px', fontWeight: '900', border: '1px solid #166534', padding: '5px 10px', borderRadius: '10px' };
const userCard: any = { backgroundColor: '#1e293b', padding: '14px', borderRadius: '18px', marginBottom: '10px' };
const userTopRow: any = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' };
const unknownEmailStyle: any = { margin: '4px 0 0 0', color: '#fbbf24', fontWeight: '700', fontSize: '11px' };
const rowActionsStyle: any = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' };
const editBtnStyle: any = { backgroundColor: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '12px' };
const selectStyle: any = { border: '1px solid #cbd5e1', padding: '10px', borderRadius: '12px', fontWeight: '700', fontSize: '12px', backgroundColor: '#fff' };
const delBtnStyle: any = { ...editBtnStyle, backgroundColor: '#fee2e2', color: '#ef4444' };
const inviteBtn: any = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '14px', padding: '12px', backgroundColor: '#fff', color: '#0f172a', borderRadius: '14px', fontWeight: '800', textDecoration: 'none', border: '1px solid #e2e8f0' };

const colors = {
  primaryDark: '#0f172a',
  accentGreen: '#10b981',
}

const heroCardStyle: any = {
  background: colors.primaryDark,
  padding: '30px 20px',
  borderRadius: '28px',
  color: 'white',
  boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
  marginBottom: '30px',
  textAlign: 'center',
}
const heroLabel: any = { fontSize: '10px', fontWeight: '700', opacity: 0.5, letterSpacing: '1px', marginBottom: '10px' }
const heroAmountText: any = { fontSize: '38px', fontWeight: '900', margin: 0 }
const heroStatsRow: any = { display: 'flex', gap: '20px', marginTop: '25px', justifyContent: 'center' }
const heroStatValue = { fontSize: '15px', fontWeight: '800' }

const actionGrid: any = { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }
const actionRow: any = { display: 'flex', gap: '12px' }
const actionBtn: any = {
  flex: 1,
  padding: '18px',
  borderRadius: '18px',
  color: 'white',
  textDecoration: 'none',
  textAlign: 'center',
  fontWeight: '800',
  fontSize: '14px',
  boxShadow: '0 8px 15px rgba(0,0,0,0.08)',
}
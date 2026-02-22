'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { Copy, UserPlus, X } from 'lucide-react'

type InviteRole = 'staff' | 'admin'

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(input: string) {
  const inputBytes = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', inputBytes)
  return bytesToHex(new Uint8Array(hashBuffer))
}

function createTokenHex() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

export default function InvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = useMemo(() => searchParams.get('store'), [searchParams])

  const [checkingAccess, setCheckingAccess] = useState(true)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [role, setRole] = useState<InviteRole>('staff')
  const [email, setEmail] = useState('')
  const [days, setDays] = useState(2)
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    async function validateAccess() {
      if (!storeId) {
        toast.error('Λείπει το αναγνωριστικό καταστήματος')
        router.push('/select-store')
        return
      }

      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        const { data: access, error: accessError } = await supabase
          .from('store_access')
          .select('role')
          .eq('user_id', user.id)
          .eq('store_id', storeId)
          .maybeSingle()

        if (accessError || !access || access.role !== 'admin') {
          toast.error('Δεν έχετε δικαιώματα διαχειριστή!')
          router.push(`/?store=${storeId}`)
          return
        }
      } catch (err) {
        console.error(err)
        toast.error('Σφάλμα ελέγχου δικαιωμάτων')
      } finally {
        setCheckingAccess(false)
      }
    }

    validateAccess()
  }, [router, storeId])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  async function handleCreateInvite() {
    if (!storeId) {
      toast.error('Λείπει το αναγνωριστικό καταστήματος')
      router.push('/select-store')
      return
    }

    setCreatingInvite(true)
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const token = createTokenHex()
      const tokenHash = await sha256Hex(token)
      const safeDays = Number.isFinite(days) ? Math.min(30, Math.max(1, days)) : 2
      const expiresAt = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString()

      const { error } = await supabase.from('store_invites').insert({
        store_id: storeId,
        role,
        email: email.trim() || null,
        token_hash: tokenHash,
        created_by: user.id,
        expires_at: expiresAt
      })

      if (error) throw error

      const createdLink = `${window.location.origin}/accept-invite?token=${token}`
      setInviteLink(createdLink)
      setCopied(false)
      toast.success('Η πρόσκληση δημιουργήθηκε!')
    } catch (err) {
      console.error(err)
      toast.error('Αποτυχία δημιουργίας πρόσκλησης')
    } finally {
      setCreatingInvite(false)
    }
  }

  async function handleCopy() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2500)
      toast.success('Αντιγράφηκε!')
    } catch {
      toast.error('Δεν έγινε αντιγραφή')
    }
  }

  return (
    <main style={pageStyle}>
      <Toaster position="top-center" richColors />

      <div style={containerStyle}>
        <header style={headerStyle}>
          <h1 style={titleStyle}>Πρόσκληση Συνεργάτη</h1>
          <Link href={storeId ? `/?store=${storeId}` : '/select-store'} style={closeBtnStyle}>
            <X size={18} />
          </Link>
        </header>

        <section style={cardStyle}>
          {checkingAccess ? (
            <p style={loadingTextStyle}>Έλεγχος δικαιωμάτων...</p>
          ) : (
            <>
              <label style={labelStyle}>Ρόλος</label>
              <div style={roleRowStyle}>
                <button
                  type="button"
                  onClick={() => setRole('staff')}
                  style={{ ...roleBtnStyle, ...(role === 'staff' ? roleBtnActiveStyle : {}) }}
                >
                  Staff
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  style={{ ...roleBtnStyle, ...(role === 'admin' ? roleBtnActiveStyle : {}) }}
                >
                  Admin
                </button>
              </div>

              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email (προαιρετικό)"
                style={inputStyle}
              />

              <label style={labelStyle}>Λήξη σε μέρες</label>
              <input
                type="number"
                min={1}
                max={30}
                value={days}
                onChange={e => {
                  const parsed = Number(e.target.value)
                  if (Number.isNaN(parsed)) return
                  setDays(Math.min(30, Math.max(1, parsed)))
                }}
                style={inputStyle}
              />

              <button
                type="button"
                onClick={handleCreateInvite}
                disabled={creatingInvite || checkingAccess}
                style={createBtnStyle}
              >
                <UserPlus size={16} />
                {creatingInvite ? 'ΔΗΜΙΟΥΡΓΙΑ...' : 'ΔΗΜΙΟΥΡΓΙΑ ΠΡΟΣΚΛΗΣΗΣ'}
              </button>

              {inviteLink && (
                <div style={resultBoxStyle}>
                  <p style={resultLabelStyle}>Invite link</p>
                  <p style={linkTextStyle}>{inviteLink}</p>
                  <button type="button" onClick={handleCopy} style={copyBtnStyle}>
                    <Copy size={14} />
                    {copied ? 'Αντιγράφηκε' : 'Αντιγραφή'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}

const pageStyle: React.CSSProperties = {
  background: '#f8fafc',
  minHeight: '100vh',
  padding: '20px 14px 40px'
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '460px',
  margin: '0 auto'
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px'
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: 900
}

const closeBtnStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  color: '#64748b',
  background: '#fff',
  textDecoration: 'none'
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '20px',
  padding: '16px'
}

const loadingTextStyle: React.CSSProperties = {
  margin: 0,
  padding: '14px 0',
  color: '#64748b',
  fontWeight: 600,
  textAlign: 'center'
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 700,
  color: '#334155',
  marginBottom: '8px',
  marginTop: '12px'
}

const roleRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px'
}

const roleBtnStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  background: '#fff',
  color: '#334155',
  padding: '10px',
  fontWeight: 700,
  cursor: 'pointer'
}

const roleBtnActiveStyle: React.CSSProperties = {
  border: '1px solid #0f172a',
  background: '#0f172a',
  color: '#fff'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '12px',
  fontSize: '14px',
  outline: 'none',
  color: '#0f172a'
}

const createBtnStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '16px',
  border: 'none',
  borderRadius: '12px',
  padding: '12px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '8px',
  color: '#fff',
  background: '#0f172a',
  fontWeight: 800,
  cursor: 'pointer'
}

const resultBoxStyle: React.CSSProperties = {
  marginTop: '14px',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '12px',
  background: '#f8fafc'
}

const resultLabelStyle: React.CSSProperties = {
  margin: '0 0 6px',
  fontSize: '12px',
  fontWeight: 700,
  color: '#64748b'
}

const linkTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '12px',
  color: '#0f172a',
  wordBreak: 'break-all'
}

const copyBtnStyle: React.CSSProperties = {
  marginTop: '10px',
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  background: '#fff',
  color: '#0f172a',
  padding: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontWeight: 700,
  cursor: 'pointer'
}
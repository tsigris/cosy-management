'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast, Toaster } from 'sonner'

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(value: string) {
  const inputBytes = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', inputBytes)
  return bytesToHex(new Uint8Array(hashBuffer))
}

export default function AcceptInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [screenMessage, setScreenMessage] = useState('Ενεργοποίηση πρόσκλησης...')

  useEffect(() => {
    let isCancelled = false

    async function redeemInvite() {
      if (!token) {
        toast.error('Λείπει το token πρόσκλησης')
        if (!isCancelled) setScreenMessage('Λείπει το token πρόσκλησης')
        return
      }

      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()

        if (!user) {
          const next = encodeURIComponent(`/accept-invite?token=${token || ''}`)
          router.push(`/login?next=${next}`)
          return
        }

        const tokenHash = await sha256Hex(token)
        const { data, error } = await supabase.rpc('redeem_store_invite', { p_token_hash: tokenHash })

        if (error) {
          console.error(error)
          const msg = (error?.message || '').toLowerCase()
          const mappedMessage = msg.includes('expired')
            ? 'Η πρόσκληση έχει λήξει.'
            : msg.includes('already used') || msg.includes('used')
              ? 'Η πρόσκληση έχει ήδη χρησιμοποιηθεί.'
              : 'Το link είναι άκυρο ή έληξε ή έχει ήδη χρησιμοποιηθεί.'

          toast.error(mappedMessage)
          if (!isCancelled) setScreenMessage(mappedMessage)
          return
        }

        const storeId =
          typeof data === 'string' || typeof data === 'number'
            ? String(data)
            : (data as { storeId?: string; store_id?: string } | null)?.storeId ||
              (data as { storeId?: string; store_id?: string } | null)?.store_id ||
              ''

        if (storeId) {
          toast.success('Η πρόσβαση ενεργοποιήθηκε!')
          router.replace(`/?store=${storeId}`)
          return
        }

        toast.error('Το link είναι άκυρο ή έληξε ή έχει ήδη χρησιμοποιηθεί.')
        if (!isCancelled) setScreenMessage('Το link είναι άκυρο ή έληξε ή έχει ήδη χρησιμοποιηθεί.')
      } catch (err) {
        console.error(err)
        toast.error('Σφάλμα ενεργοποίησης πρόσκλησης')
        if (!isCancelled) setScreenMessage('Σφάλμα ενεργοποίησης πρόσκλησης')
      }
    }

    redeemInvite()

    return () => {
      isCancelled = true
    }
  }, [router, token])

  return (
    <main style={pageStyle}>
      <Toaster position="top-center" richColors />
      <p style={messageStyle}>{screenMessage}</p>
    </main>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: '#f8fafc'
}

const messageStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: '18px',
  fontWeight: 700,
  textAlign: 'center'
}

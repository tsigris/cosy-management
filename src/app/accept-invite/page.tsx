'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { toast, Toaster } from 'sonner'

// --- helpers (ίδια λογική με InvitePage: token -> sha256Hex) ---
function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(input: string) {
  const inputBytes = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', inputBytes)
  return bytesToHex(new Uint8Array(hashBuffer))
}

export default function AcceptInvitePage() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [screenMessage, setScreenMessage] = useState('Επαλήθευση πρόσκλησης... Παρακαλώ περιμένετε')

  useEffect(() => {
    let isCancelled = false

    async function acceptInvite() {
      if (!token) {
        toast.error('Λείπει το token πρόσκλησης')
        if (!isCancelled) setScreenMessage('Λείπει το token πρόσκλησης')
        return
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push(`/signup?token=${token}`)
          return
        }

        // ✅ FIX: Το invite αποθηκεύει token_hash = sha256(token)
        // Άρα στέλνουμε hash στο RPC (για να βρει σωστά το invite)
        const tokenHash = await sha256Hex(token)

        // ✅ Στέλνουμε ΚΑΙ τα 2 payload formats για μέγιστη συμβατότητα
        // (αν το RPC περιμένει p_token_hash, θα δουλέψει)
        // (αν περιμένει p_token, του δίνουμε ήδη το hash)
        const { data, error } = await supabase.rpc('accept_store_invite', {
          p_token_hash: tokenHash,
          p_token: tokenHash,
        } as any)

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

    acceptInvite()

    return () => {
      isCancelled = true
    }
  }, [router, token, supabase])

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
  background: '#f8fafc',
}

const messageStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: '18px',
  fontWeight: 700,
  textAlign: 'center',
}
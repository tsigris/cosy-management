'use client'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function InviteContent() {
  const searchParams = useSearchParams()
  const role = searchParams.get('role') || 'user' 
  const [storeId, setStoreId] = useState('')

  useEffect(() => {
    async function getStoreId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setStoreId(user.id)
    }
    getStoreId()
  }, [])

  const inviteLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/register?invite=${storeId}&role=${role}`
    : ''

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px' }}>
      <div style={cardStyle}>
        <h2>📩 Πρόσκληση {role === 'admin' ? 'Διαχειριστή' : 'Χρήστη'}</h2>
        <p>Στείλτε αυτό το link για αυτόματη εγγραφή στην επιχείρησή σας:</p>
        <div style={linkBox}>{inviteLink}</div>
        <button onClick={() => {
          navigator.clipboard.writeText(inviteLink)
          alert('Αντιγράφηκε!')
        }} style={copyBtn}>ΑΝΤΙΓΡΑΦΗ</button>
      </div>
    </main>
  )
}

export default function InvitePage() {
  return <Suspense><InviteContent /></Suspense>
}

// ... Styles (όπως τα είδαμε πριν)
const cardStyle = { background: 'white', padding: '30px', borderRadius: '24px', maxWidth: '400px', margin: '40px auto' };
const linkBox = { background: '#f1f5f9', padding: '15px', borderRadius: '12px', wordBreak: 'break-all' as const, margin: '20px 0' };
const copyBtn = { width: '100%', padding: '16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 'bold' as const };
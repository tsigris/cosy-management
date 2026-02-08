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
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      
      {/* ΚΟΥΜΠΙ ΕΠΙΣΤΡΟΦΗΣ ΣΤΗΝ ΑΡΧΙΚΗ */}
      <div style={{ maxWidth: '400px', margin: '20px auto 0 auto' }}>
        <Link href="/" style={homeBtnStyle}>
          🏠 Επιστροφή στην Αρχική
        </Link>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
          {/* ΚΟΥΜΠΙ ΠΙΣΩ ΣΤΑ ΔΙΚΑΙΩΜΑΤΑ */}
          <Link href="/admin/permissions" style={{ textDecoration: 'none', color: '#64748b', fontSize: '20px' }}>←</Link>
          <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0 }}>
            📩 Πρόσκληση {role === 'admin' ? 'Διαχειριστή' : 'Χρήστη'}
          </h2>
        </div>

        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
          Στείλτε αυτό το link για αυτόματη εγγραφή στην επιχείρησή σας:
        </p>
        
        <div style={linkBox}>{inviteLink}</div>

        <button 
          onClick={() => {
            navigator.clipboard.writeText(inviteLink)
            alert('Το link αντιγράφηκε επιτυχώς!')
          }} 
          style={copyBtn}
        >
          ΑΝΤΙΓΡΑΦΗ
        </button>
      </div>
    </main>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div style={{padding: '50px', textAlign: 'center'}}>Φόρτωση...</div>}>
      <InviteContent />
    </Suspense>
  )
}

// ΕΠΙΠΛΕΟΝ STYLE ΓΙΑ ΤΟ ΚΟΥΜΠΙ ΑΡΧΙΚΗΣ
const homeBtnStyle = {
  display: 'inline-block',
  textDecoration: 'none',
  backgroundColor: '#f1f5f9',
  color: '#475569',
  padding: '10px 16px',
  borderRadius: '12px',
  fontSize: '13px',
  fontWeight: 'bold' as const,
  border: '1px solid #e2e8f0',
  transition: '0.2s'
};

const cardStyle = { background: 'white', padding: '30px', borderRadius: '24px', maxWidth: '400px', margin: '20px auto', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };
const linkBox = { background: '#f1f5f9', padding: '15px', borderRadius: '12px', wordBreak: 'break-all' as const, fontSize: '12px', margin: '20px 0', color: '#334155', border: '1px solid #e2e8f0' };
const copyBtn = { width: '100%', padding: '16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 'bold' as const, cursor: 'pointer' };
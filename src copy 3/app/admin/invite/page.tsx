'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function InviteContent() {
  const searchParams = useSearchParams()
  // Αν το URL δεν έχει ?role=admin, τότε το roleToInvite γίνεται 'user'
  const roleToInvite = searchParams.get('role') === 'admin' ? 'admin' : 'user'
  
  const [storeId, setStoreId] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function getBusinessData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('store_id')
            .eq('id', user.id)
            .single()
            
          if (profile?.store_id) {
            setStoreId(profile.store_id)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    getBusinessData()
  }, [])

  const inviteLink = typeof window !== 'undefined' && storeId
    ? `${window.location.origin}/register?invite=${storeId}&role=${roleToInvite}`
    : ''

  const copyToClipboard = () => {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>
            <span style={{ fontSize: '20px' }}>📩</span>
          </div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '20px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
              Πρόσκληση {roleToInvite === 'admin' ? 'Διαχειριστή' : 'Χρήστη'}
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ΣΥΝΔΕΣΜΟΣ ΕΓΓΡΑΦΗΣ
            </p>
          </div>
        </div>
        <Link href="/admin/permissions" style={backBtnStyle}>✕</Link>
      </div>

      <div style={cardStyle}>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px', lineHeight: '1.5' }}>
          Αντιγράψτε τον παρακάτω σύνδεσμο. Ο συνεργάτης σας θα συνδεθεί ως <b>{roleToInvite === 'admin' ? 'Διαχειριστής' : 'Απλός Χρήστης'}</b>.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontWeight: 'bold' }}>
            Δημιουργία συνδέσμου...
          </div>
        ) : (
          <>
            <div style={linkBoxStyle}>
              {inviteLink || 'Σφάλμα δημιουργίας συνδέσμου'}
            </div>

            <button 
              onClick={copyToClipboard} 
              style={{ ...copyBtnStyle, backgroundColor: copied ? '#10b981' : '#0f172a' }}
            >
              {copied ? 'ΑΝΤΙΓΡΑΦΗΚΕ! ✅' : 'ΑΝΤΙΓΡΑΦΗ ΣΥΝΔΕΣΜΟΥ'}
            </button>
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <Link href="/" style={homeLinkStyle}>
          🏠 Επιστροφή στην Αρχική Σελίδα
        </Link>
      </div>
    </div>
  )
}

// STYLES
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' };
const cardStyle: any = { backgroundColor: 'white', padding: '30px', borderRadius: '28px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' };
const linkBoxStyle: any = { backgroundColor: '#f8fafc', padding: '15px', borderRadius: '14px', fontSize: '12px', color: '#334155', wordBreak: 'break-all', border: '1px solid #e2e8f0', marginBottom: '20px', fontFamily: 'monospace' };
const copyBtnStyle: any = { width: '100%', padding: '18px', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', transition: '0.3s ease' };
const homeLinkStyle: any = { textDecoration: 'none', color: '#64748b', fontSize: '13px', fontWeight: '700' };

export default function InvitePage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div style={{padding: '50px', textAlign: 'center'}}>Φόρτωση...</div>}>
        <InviteContent />
      </Suspense>
    </main>
  )
}
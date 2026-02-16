'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { Copy, Check, X, Mail, Home } from 'lucide-react'

function InviteContent() {
  const searchParams = useSearchParams()
  
  // 1. Παίρνουμε το storeId και το role από το URL
  const storeIdFromUrl = searchParams.get('store')
  const roleToInvite = searchParams.get('role') === 'admin' ? 'admin' : 'user'
  
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Απλώς επιβεβαιώνουμε ότι υπάρχει storeId
    if (!storeIdFromUrl) {
      toast.error("Δεν επιλέχθηκε κατάστημα")
    }
    setLoading(false)
  }, [storeIdFromUrl])

  // 2. Δημιουργία του συνδέσμου βασισμένη στο URL
  const inviteLink = typeof window !== 'undefined' && storeIdFromUrl
    ? `${window.location.origin}/register?invite=${storeIdFromUrl}&role=${roleToInvite}`
    : ''

  const copyToClipboard = () => {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    toast.success("Ο σύνδεσμος αντιγράφηκε!")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={containerNarrow}>
      <Toaster richColors position="top-center" />
      
      {/* HEADER */}
      <div style={headerRowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}><Mail size={22} color="#6366f1" /></div>
          <div>
            <h1 style={titleStyle}>
              Πρόσκληση {roleToInvite === 'admin' ? 'Διαχειριστή' : 'Συνεργάτη'}
            </h1>
            <p style={subtitleStyle}>ΣΥΝΔΕΣΜΟΣ ΕΓΓΡΑΦΗΣ</p>
          </div>
        </div>
        <Link href={`/admin/permissions?store=${storeIdFromUrl}`} style={backBtnStyle}><X size={20} /></Link>
      </div>

      <div style={cardStyle}>
        <p style={descStyle}>
          Στείλτε αυτόν τον σύνδεσμο στον συνεργάτη σας. Μόλις εγγραφεί, θα αποκτήσει αυτόματα πρόσβαση στο κατάστημα ως 
          <b style={{color: '#0f172a'}}> {roleToInvite === 'admin' ? 'ΔΙΑΧΕΙΡΙΣΤΗΣ' : 'ΑΠΛΟΣ ΧΡΗΣΤΗΣ'}</b>.
        </p>

        {loading ? (
          <div style={loadingStyle}>Δημιουργία συνδέσμου...</div>
        ) : (
          <>
            <div style={linkBoxStyle}>
              {inviteLink || 'Σφάλμα δημιουργίας συνδέσμου'}
            </div>

            <button 
              onClick={copyToClipboard} 
              style={{ ...copyBtnStyle, backgroundColor: copied ? '#10b981' : '#0f172a' }}
            >
              {copied ? <><Check size={18} /> ΑΝΤΙΓΡΑΦΗΚΕ!</> : <><Copy size={18} /> ΑΝΤΙΓΡΑΦΗ ΣΥΝΔΕΣΜΟΥ</>}
            </button>
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <Link href={`/?store=${storeIdFromUrl}`} style={homeLinkStyle}>
          <Home size={16} /> Επιστροφή στην Αρχική
        </Link>
      </div>
    </div>
  )
}

// --- STYLES ---
const containerNarrow = { maxWidth: '480px', margin: '0 auto', padding: '20px' };
const headerRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', paddingTop: '10px' };
const logoBoxStyle: any = { width: '45px', height: '45px', backgroundColor: '#e0e7ff', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const titleStyle = { fontWeight: '900', fontSize: '20px', margin: 0, color: '#0f172a' };
const subtitleStyle = { margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', letterSpacing: '1px' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', backgroundColor: '#fff', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid #e2e8f0' };
const cardStyle: any = { backgroundColor: 'white', padding: '30px', borderRadius: '28px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' };
const descStyle = { fontSize: '14px', color: '#64748b', marginBottom: '25px', lineHeight: '1.6', textAlign: 'center' as const };
const linkBoxStyle: any = { backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', fontSize: '12px', color: '#334155', wordBreak: 'break-all', border: '1px solid #e2e8f0', marginBottom: '20px', fontFamily: 'monospace', textAlign: 'center' as const };
const copyBtnStyle: any = { width: '100%', padding: '18px', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: '0.2s' };
const homeLinkStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const loadingStyle = { textAlign: 'center' as const, padding: '20px', color: '#cbd5e1', fontWeight: '800' };

export default function InvitePage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Suspense fallback={null}>
        <InviteContent />
      </Suspense>
    </main>
  )
}
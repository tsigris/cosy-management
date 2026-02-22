'use client'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function InviteContent() {
  const searchParams = useSearchParams()
  // Παίρνουμε τον ρόλο από το URL (π.χ. ?role=admin), αλλιώς default 'user'
  const targetRole = searchParams.get('role') || 'user'
  const urlStoreId = searchParams.get('store');
  
  const [storeId, setStoreId] = useState(urlStoreId || '');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false)
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && storeId) setInviteLink(`${window.location.origin}/register?invite=${storeId}&role=${targetRole}`);
  }, [storeId, targetRole]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Φόρτωση...</div>

  return (
    <main style={containerStyle}>
      <div style={cardStyle}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
          <Link href={`/permissions?store=${storeId}`} style={backBtnStyle}>←</Link>
          <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b', margin: 0 }}>
             Πρόσκληση {targetRole === 'admin' ? 'Διαχειριστή' : 'Υπαλλήλου'}
          </h2>
        </div>

        <div style={{ ...infoBox, backgroundColor: targetRole === 'admin' ? '#fff7ed' : '#eff6ff', borderColor: targetRole === 'admin' ? '#ffedd5' : '#dbeafe' }}>
          <p style={{ margin: 0, fontSize: '14px', color: targetRole === 'admin' ? '#9a3412' : '#64748b', lineHeight: '1.6' }}>
            Στείλτε αυτό το σύνδεσμο. Ο χρήστης θα συνδεθεί αυτόματα στο κατάστημά σας με τον ρόλο: <b>{targetRole.toUpperCase()}</b>.
          </p>
        </div>

        <div style={linkContainer}>
          <div style={linkText}>{inviteLink}</div>
        </div>

        <button onClick={copyToClipboard} style={{ ...copyBtn, backgroundColor: copied ? '#10b981' : (targetRole === 'admin' ? '#f97316' : '#0f172a') }}>
          {copied ? '✅ ΑΝΤΙΓΡΑΦΗΚΕ!' : 'ΑΝΤΙΓΡΑΦΗ ΣΥΝΔΕΣΜΟΥ'}
        </button>
      </div>
    </main>
  )
}

// Χρησιμοποιούμε Suspense γιατί έχουμε useSearchParams
export default function InvitePage() {
  return (
    <Suspense fallback={<div>Φόρτωση...</div>}>
      <InviteContent />
    </Suspense>
  )
}

// STYLES (Προσθήκη στο containerStyle)
const containerStyle = { minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' };
const cardStyle = { maxWidth: '450px', margin: '40px auto', backgroundColor: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' };
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: '#f1f5f9', width: '35px', height: '35px', borderRadius: '10px', fontSize: '18px', color: '#64748b' };
const infoBox = { padding: '15px', borderRadius: '16px', marginBottom: '25px', border: '1px solid' };
const linkContainer = { backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px dashed #cbd5e1', marginBottom: '20px', overflow: 'hidden' };
const linkText = { fontSize: '11px', color: '#1e293b', wordBreak: 'break-all' as const, fontFamily: 'monospace' };
const copyBtn = { width: '100%', padding: '16px', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '900' as const, fontSize: '14px', cursor: 'pointer', transition: '0.3s' };
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function InvitePage() {
  const [storeId, setStoreId] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function getAdminData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setStoreId(user.id)
      }
      setLoading(false)
    }
    getAdminData()
  }, [])

  // Δημιουργία του URL πρόσκλησης
  const inviteLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/register?invite=${storeId}` 
    : ''

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
          <Link href="/" style={backBtnStyle}>←</Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Πρόσκληση Υπαλλήλου</h2>
        </div>

        <div style={infoBox}>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>
            Στείλτε αυτό το σύνδεσμο στον υπάλληλο σας. Μόλις κάνει εγγραφή, θα συνδεθεί αυτόματα με το κατάστημά σας ως <b>User</b>.
          </p>
        </div>

        <div style={linkContainer}>
          <div style={linkText}>{inviteLink}</div>
        </div>

        <button onClick={copyToClipboard} style={{ ...copyBtn, backgroundColor: copied ? '#10b981' : '#0f172a' }}>
          {copied ? '✅ ΑΝΤΙΓΡΑΦΗΚΕ!' : 'ΑΝΤΙΓΡΑΦΗ ΣΥΝΔΕΣΜΟΥ'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '20px' }}>
          Σημείωση: Οι νέοι υπάλληλοι θα έχουν περιορισμένη πρόσβαση μέχρι να τους δώσετε δικαιώματα από τη σελίδα "Δικαιώματα Χρηστών".
        </p>
      </div>
    </main>
  )
}

// STYLES
const containerStyle = { minHeight: '100vh', backgroundColor: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' };
const cardStyle = { maxWidth: '450px', margin: '40px auto', backgroundColor: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' };
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: '#f1f5f9', width: '35px', height: '35px', borderRadius: '10px', fontSize: '18px', color: '#64748b' };
const infoBox = { backgroundColor: '#eff6ff', padding: '15px', borderRadius: '16px', marginBottom: '25px', border: '1px solid #dbeafe' };
const linkContainer = { backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px dashed #cbd5e1', marginBottom: '20px', overflow: 'hidden' };
const linkText = { fontSize: '12px', color: '#1e293b', wordBreak: 'break-all' as const, fontFamily: 'monospace' };
const copyBtn = { width: '100%', padding: '16px', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '900' as const, fontSize: '14px', cursor: 'pointer', transition: '0.3s' };
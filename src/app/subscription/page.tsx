'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { format } from 'date-fns'
import { el } from 'date-fns/locale'

export default function SubscriptionPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(data)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [])

  if (loading) return <div style={{padding: '50px', textAlign: 'center'}}>Φόρτωση...</div>

  const isExpired = new Date(profile?.subscription_expires_at) < new Date()

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
          <Link href="/" style={backBtnStyle}>←</Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Η Συνδρομή μου</h2>
        </div>

        <div style={{ ...statusCard, backgroundColor: isExpired ? '#fee2e2' : '#f0fdf4', borderColor: isExpired ? '#fecaca' : '#bbf7d0' }}>
          <div style={{ fontSize: '12px', fontWeight: '900', color: isExpired ? '#dc2626' : '#166534', marginBottom: '10px' }}>ΚΑΤΑΣΤΑΣΗ ΛΟΓΑΡΙΑΣΜΟΥ</div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>
            {isExpired ? 'ΛΗΞΗ ΠΡΟΣΒΑΣΗΣ' : 'ΕΝΕΡΓΗ ΣΥΝΔΡΟΜΗ'}
          </div>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '10px' }}>
            Λήγει στις: <b>{profile?.subscription_expires_at ? format(new Date(profile.subscription_expires_at), 'dd MMMM yyyy', { locale: el }) : '-'}</b>
          </p>
        </div>

        <div style={infoBox}>
          <h3 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '15px' }}>💎 Προνόμια Paid Tier</h3>
          <ul style={{ paddingLeft: '20px', color: '#475569', lineHeight: '1.8' }}>
            <li>Απεριόριστες κινήσεις εσόδων/εξόδων</li>
            <li>Πλήρης Ανάλυση & Ποσοστά Τζίρου</li>
            <li>Διαχείριση Δικαιωμάτων Υπαλλήλων</li>
            <li>Καρτέλες Προμηθευτών & Χρέη</li>
            <li>Δημιουργία AI Εικόνων & Βίντεο</li>
          </ul>
        </div>

        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>Για ανανέωση ή αλλαγή πακέτου, επικοινωνήστε με την υποστήριξη.</p>
          <button style={supportBtn}>ΕΠΙΚΟΙΝΩΝΙΑ ΜΕ ΤΗΝ ΥΠΟΣΤΗΡΙΞΗ</button>
        </div>

      </div>
    </main>
  )
}

// STYLES
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: 'white', width: '40px', height: '40px', borderRadius: '12px', color: '#64748b', border: '1px solid #e2e8f0' };
const statusCard = { padding: '25px', borderRadius: '24px', border: '2px solid', textAlign: 'center' as const, marginBottom: '20px' };
const infoBox = { backgroundColor: 'white', padding: '25px', borderRadius: '24px', border: '1px solid #e2e8f0' };
const supportBtn = { width: '100%', padding: '18px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '14px', marginTop: '15px', cursor: 'pointer' };
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { format } from 'date-fns'
import { el } from 'date-fns/locale'

function SubscriptionContent() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
          setProfile(data)
        }
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    fetchProfile()
  }, [])

  const handleWhatsAppRenewal = () => {
    const message = `Γεια σας! Επιθυμώ να ανανεώσω τη συνδρομή μου στο Cosy App.\nΚατάστημα: ${profile?.store_name}\nEmail: ${profile?.email}`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/306942216191?text=${encoded}`, '_blank');
  }

  if (loading) return <div style={{padding: '50px', textAlign: 'center', color: '#94a3b8', fontWeight: 'bold'}}>Φόρτωση πλάνου...</div>

  const isExpired = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) < new Date() : true

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* PROFESSIONAL HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>
            <span style={{ fontSize: '20px' }}>💎</span>
          </div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
              Συνδρομή
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ΔΙΑΧΕΙΡΙΣΗ ΠΛΑΝΟΥ
            </p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      {/* STATUS CARD */}
      <div style={{ 
        ...statusCardStyle, 
        backgroundColor: isExpired ? '#fff1f2' : '#f0fdf4', 
        borderColor: isExpired ? '#fecaca' : '#bbf7d0' 
      }}>
        <div style={{ fontSize: '10px', fontWeight: '900', color: isExpired ? '#be123c' : '#15803d', marginBottom: '8px', letterSpacing: '1px' }}>
          ΚΑΤΑΣΤΑΣΗ ΛΟΓΑΡΙΑΣΜΟΥ
        </div>
        <div style={{ fontSize: '26px', fontWeight: '900', color: '#0f172a', marginBottom: '5px' }}>
          {isExpired ? 'ΛΗΞΗ ΠΡΟΣΒΑΣΗΣ' : 'PRO ΠΛΑΝΟ ΕΝΕΡΓΟ'}
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
          {isExpired ? 'Η πρόσβασή σας έχει περιοριστεί' : 'Πλήρης πρόσβαση στις λειτουργίες'}
        </div>
        
        <div style={dateBoxStyle}>
           <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800' }}>ΛΗΞΗ ΣΤΙΣ:</span>
           <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: '900' }}>
             {profile?.subscription_expires_at ? format(new Date(profile.subscription_expires_at), 'dd MMMM yyyy', { locale: el }).toUpperCase() : '---'}
           </span>
        </div>
      </div>

      {/* FEATURES BOX */}
      <div style={featuresCardStyle}>
        <h3 style={{ fontSize: '14px', fontWeight: '900', marginBottom: '20px', color: '#0f172a', textAlign: 'center' }}>
          ΞΕΚΛΕΙΔΩΜΕΝΑ ΠΡΟΝΟΜΙΑ
        </h3>
        
        <div style={featureItem}>
          <span style={iconStyle}>📈</span>
          <div>
            <p style={featureTitle}>Πλήρης Ανάλυση Τζίρου</p>
            <p style={featureSub}>Πρόσβαση σε γραφήματα και ποσοστά %</p>
          </div>
        </div>

        <div style={featureItem}>
          <span style={iconStyle}>🚩</span>
          <div>
            <p style={featureTitle}>Καρτέλες & Χρέη</p>
            <p style={featureSub}>Πλήρης έλεγχος οφειλών προμηθευτών</p>
          </div>
        </div>

        <div style={featureItem}>
          <span style={iconStyle}>👥</span>
          <div>
            <p style={featureTitle}>Διαχείριση Προσωπικού</p>
            <p style={featureSub}>Οργάνωση πληρωμών και δικαιωμάτων</p>
          </div>
        </div>

        <div style={featureItem}>
          <span style={iconStyle}>🚀</span>
          <div>
            <p style={featureTitle}>Απεριόριστες Κινήσεις</p>
            <p style={featureSub}>Καμία περιορισμός στις καταχωρήσεις</p>
          </div>
        </div>
      </div>

      {/* RENEWAL SECTION */}
      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', marginBottom: '15px', padding: '0 20px' }}>
          Για ανανέωση του πλάνου σας ή αλλαγή στοιχείων χρέωσης, η ομάδα υποστήριξης είναι στη διάθεσή σας.
        </p>
        <button onClick={handleWhatsAppRenewal} style={supportBtnStyle}>
          ΑΝΑΝΕΩΣΗ ΣΥΝΔΡΟΜΗΣ 💬
        </button>
      </div>

    </div>
  )
}

// STYLES
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#e0e7ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' };
const statusCardStyle: any = { padding: '30px 20px', borderRadius: '28px', border: '1px solid', textAlign: 'center', marginBottom: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' };
const dateBoxStyle: any = { marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'rgba(255,255,255,0.5)', padding: '12px', borderRadius: '16px' };
const featuresCardStyle: any = { backgroundColor: 'white', padding: '25px', borderRadius: '28px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' };
const featureItem: any = { display: 'flex', alignItems: 'flex-start', gap: '15px', marginBottom: '18px' };
const iconStyle: any = { fontSize: '20px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '12px' };
const featureTitle: any = { fontSize: '14px', fontWeight: '800', color: '#1e293b', margin: 0 };
const featureSub: any = { fontSize: '11px', color: '#64748b', margin: '2px 0 0 0', fontWeight: '600' };
const supportBtnStyle: any = { width: '100%', padding: '18px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' };

export default function SubscriptionPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><SubscriptionContent /></Suspense>
    </main>
  )
}
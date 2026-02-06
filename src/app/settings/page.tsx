'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [showContact, setShowContact] = useState(false)
  const [formData, setFormData] = useState({
    store_name: '',
    company_name: '',
    afm: '',
    phone: '',
    address: '',
    initial_amount: 0,
    email: ''
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setFormData({
          store_name: data.store_name || '',
          company_name: data.company_name || '',
          afm: data.afm || '',
          phone: data.phone || '',
          address: data.address || '',
          initial_amount: data.initial_amount || 0,
          email: user.email || ''
        })
      } else {
        setFormData(prev => ({ ...prev, email: user.email || '' }))
      }
    }
    setLoading(false)
  }

  async function handleSave() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.from('profiles').upsert({ 
        id: user.id, 
        ...formData,
        updated_at: new Date().toISOString()
      })
      if (!error) alert('Οι ρυθμίσεις αποθηκεύτηκαν!')
      else alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  const handleWhatsAppRedirect = () => {
    const message = `Γεια σας, θα ήθελα να διαγράψω την επιχείρηση: ${formData.company_name || formData.store_name || 'Χωρίς Όνομα'}. \nEmail χρήστη: ${formData.email}`;
    const encodedMessage = encodeURIComponent(message);
    // ΕΝΗΜΕΡΩΜΕΝΟ ΤΗΛΕΦΩΝΟ: 6942216191
    window.open(`https://wa.me/306942216191?text=${encodedMessage}`, '_blank');
  }

  return (
    <main style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <button onClick={() => router.back()} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>←</button>
        <h1 style={{ fontSize: '22px', fontWeight: '900', margin: 0 }}>Ρυθμίσεις</h1>
      </div>

      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', marginBottom: '30px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div><label style={labelStyle}>Όνομα εταιρείας</label><input style={inputStyle} value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} /></div>
          <div><label style={labelStyle}>Όνομα επιχείρησης</label><input style={inputStyle} value={formData.store_name} onChange={e => setFormData({...formData, store_name: e.target.value})} /></div>
          <div><label style={labelStyle}>Α.Φ.Μ.</label><input style={inputStyle} value={formData.afm} onChange={e => setFormData({...formData, afm: e.target.value})} /></div>
          <div><label style={labelStyle}>Αρχικό ποσό</label><input type="number" style={inputStyle} value={formData.initial_amount} onChange={e => setFormData({...formData, initial_amount: Number(e.target.value)})} /></div>
        </div>

        <div style={{ marginBottom: '20px' }}><label style={labelStyle}>Τηλέφωνο</label><input style={inputStyle} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
        <div style={{ marginBottom: '25px' }}><label style={labelStyle}>Διεύθυνση</label><textarea style={{ ...inputStyle, height: '80px', resize: 'none' }} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>

        <button onClick={handleSave} disabled={loading} style={saveBtn}>{loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ ΡΥΘΜΙΣΕΩΝ'}</button>
      </div>

      {!showContact ? (
        <div style={{ textAlign: 'center', padding: '10px' }}>
          <button onClick={() => setShowContact(true)} style={{ background: 'none', border: 'none', color: '#ef4444', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
            Για διαγραφή της επιχείρησης, επικοινωνήστε με την υποστήριξη.
          </button>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '24px', border: '1px solid #fee2e2' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', textAlign: 'center', marginBottom: '10px' }}>Επικοινωνία</h2>
          <label style={labelStyle}>Email Χρήστη</label>
          <input style={{ ...inputStyle, marginBottom: '20px', backgroundColor: '#f8fafc' }} value={formData.email} readOnly />

          <button onClick={handleWhatsAppRedirect} style={waBtn}>ΑΠΟΣΤΟΛΗ ΜΕΣΩ WHATSAPP 💬</button>
          
          <div style={supportBox}>
            <p style={{ fontSize: '12px', color: '#854d0e', margin: 0 }}>
              Για άμεση βοήθεια, καλέστε μας στο:<br/>
              <b style={{ fontSize: '16px' }}>6942216191</b>
            </p>
          </div>
          
          <button onClick={() => setShowContact(false)} style={cancelBtn}>Ακύρωση</button>
        </div>
      )}
    </main>
  )
}

const labelStyle = { fontSize: '11px', color: '#94a3b8', fontWeight: '800', marginBottom: '6px', display: 'block', textTransform: 'uppercase' as const };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '16px', outline: 'none' };
const saveBtn = { width: '100%', backgroundColor: '#2563eb', color: 'white', padding: '18px', borderRadius: '14px', border: 'none', fontWeight: '900', fontSize: '16px', cursor: 'pointer' };
const waBtn = { width: '100%', backgroundColor: '#25d366', color: 'white', padding: '16px', borderRadius: '12px', border: 'none', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };
const supportBox = { backgroundColor: '#fefce8', padding: '15px', borderRadius: '12px', marginTop: '20px', textAlign: 'center' as const, border: '1px solid #fef08a' };
const cancelBtn = { width: '100%', background: 'none', border: 'none', color: '#94a3b8', marginTop: '15px', fontSize: '13px', fontWeight: 'bold' as const, cursor: 'pointer' };
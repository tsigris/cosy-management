'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function SettingsContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [showContact, setShowContact] = useState(false)
  
  // --- STATES ΓΙΑ ΑΣΦΑΛΕΙΑ ---
  const [pinEnabled, setPinEnabled] = useState(false)
  const [bioEnabled, setBioEnabled] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [tempPin, setTempPin] = useState('')

  const [formData, setFormData] = useState({
    store_name: '',
    company_name: '',
    username: '', 
    afm: '',
    phone: '',
    address: '',
    initial_amount: 0,
    email: ''
  })

  useEffect(() => {
    fetchProfile()
    // Φόρτωση ρυθμίσεων ασφαλείας από τη συσκευή
    setPinEnabled(localStorage.getItem('fleet_track_pin_enabled') === 'true')
    setBioEnabled(localStorage.getItem('fleet_track_biometrics') === 'true')
  }, [])

  async function fetchProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (data) {
          setFormData({
            store_name: data.store_name || '',
            company_name: data.company_name || '',
            username: data.username || '', 
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
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const handleTogglePin = () => {
    if (!pinEnabled) {
      setShowPinModal(true)
    } else {
      if (confirm('Απενεργοποίηση PIN;')) {
        localStorage.removeItem('fleet_track_pin')
        localStorage.setItem('fleet_track_pin_enabled', 'false')
        setPinEnabled(false)
      }
    }
  }

  const savePin = () => {
    if (tempPin.length !== 4) return alert('Το PIN πρέπει να είναι 4 ψηφία')
    localStorage.setItem('fleet_track_pin', tempPin)
    localStorage.setItem('fleet_track_pin_enabled', 'true')
    setPinEnabled(true)
    setShowPinModal(false)
    setTempPin('')
    alert('Το PIN ενεργοποιήθηκε επιτυχώς!')
  }

  const handleToggleBio = () => {
    const newVal = !bioEnabled
    localStorage.setItem('fleet_track_biometrics', String(newVal))
    setBioEnabled(newVal)
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
      if (!error) alert('Οι αλλαγές αποθηκεύτηκαν επιτυχώς!')
      else alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  const handleWhatsAppRedirect = () => {
    const message = `Γεια σας, θα ήθελα να διαγράψω την επιχείρηση: ${formData.company_name || formData.store_name || 'Χωρίς Όνομα'}. \nEmail χρήστη: ${formData.email}`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/306942216191?text=${encodedMessage}`, '_blank');
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* PROFESSIONAL HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>
            <span style={{ fontSize: '20px' }}>⚙️</span>
          </div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
              Ρυθμίσεις
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ΔΙΑΧΕΙΡΙΣΗ ΠΡΟΦΙΛ & ΑΣΦΑΛΕΙΑΣ
            </p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      <div style={mainCardStyle}>
        
        {/* SECTION: ΑΣΦΑΛΕΙΑ ΣΥΣΚΕΥΗΣ */}
        <p style={sectionLabel}>ΑΣΦΑΛΕΙΑ ΣΥΣΚΕΥΗΣ</p>
        <div style={securityBoxStyle}>
          <div style={settingRow}>
            <div>
              <p style={settingText}>🔐 Χρήση 4ψήφιου PIN</p>
              <p style={settingSubText}>Γρήγορη είσοδος σε αυτή τη συσκευή</p>
            </div>
            <input type="checkbox" checked={pinEnabled} onChange={handleTogglePin} style={checkboxStyle} />
          </div>
          <div style={{...settingRow, marginTop: '15px', borderTop: '1px solid #e2e8f0', paddingTop: '15px'}}>
            <div>
              <p style={settingText}>📸 FaceID / Δακτυλικό Αποτύπωμα</p>
              <p style={settingSubText}>Χρήση βιομετρικών αισθητήρων</p>
            </div>
            <input type="checkbox" checked={bioEnabled} onChange={handleToggleBio} style={checkboxStyle} />
          </div>
        </div>

        <div style={divider} />

        {/* SECTION: ΠΡΟΣΩΠΙΚΑ ΣΤΟΙΧΕΙΑ */}
        <p style={sectionLabel}>ΠΡΟΣΩΠΙΚΑ ΣΤΟΙΧΕΙΑ</p>
        <div style={infoBoxStyle}>
          <label style={labelStyle}>👤 ΤΟ ΟΝΟΜΑ ΣΑΣ (ΥΠΟΓΡΑΦΗ)</label>
          <input 
            style={inputStyle} 
            value={formData.username} 
            onChange={e => setFormData({...formData, username: e.target.value})} 
            placeholder="π.χ. ΓΙΑΝΝΗΣ Π."
          />
          <p style={hintStyle}>Αυτό το όνομα θα συνοδεύει κάθε κίνηση που καταχωρείτε.</p>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={labelStyle}>EMAIL ΛΟΓΑΡΙΑΣΜΟΥ</label>
          <input style={{ ...inputStyle, backgroundColor: '#f1f5f9', color: '#64748b' }} value={formData.email} readOnly />
        </div>

        <div style={divider} />

        {/* SECTION: ΣΤΟΙΧΕΙΑ ΕΠΙΧΕΙΡΗΣΗΣ */}
        <p style={sectionLabel}>ΣΤΟΙΧΕΙΑ ΕΠΙΧΕΙΡΗΣΗΣ</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={labelStyle}>ΟΝΟΜΑ ΕΤΑΙΡΕΙΑΣ</label>
            <input style={inputStyle} value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>ΤΙΤΛΟΣ ΚΑΤ/ΤΟΣ</label>
            <input style={inputStyle} value={formData.store_name} onChange={e => setFormData({...formData, store_name: e.target.value})} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={labelStyle}>Α.Φ.Μ.</label>
            <input style={inputStyle} value={formData.afm} onChange={e => setFormData({...formData, afm: e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>ΑΡΧΙΚΟ ΠΟΣΟ (€)</label>
            <input type="number" style={inputStyle} value={formData.initial_amount} onChange={e => setFormData({...formData, initial_amount: Number(e.target.value)})} />
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={labelStyle}>ΤΗΛΕΦΩΝΟ ΕΠΙΚΟΙΝΩΝΙΑΣ</label>
          <input style={inputStyle} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={labelStyle}>ΔΙΕΥΘΥΝΣΗ</label>
          <textarea style={{ ...inputStyle, height: '70px', resize: 'none', paddingTop: '10px' }} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
        </div>

        <button onClick={handleSave} disabled={loading} style={saveBtnStyle}>
          {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΕΝΗΜΕΡΩΣΗ ΡΥΘΜΙΣΕΩΝ'}
        </button>
      </div>

      {/* PIN MODAL */}
      {showPinModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{ margin: '0 0 10px 0' }}>Ορισμός PIN</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Εισάγετε ένα 4ψήφιο κωδικό για γρήγορη είσοδο.</p>
            <input 
              type="password" 
              inputMode="numeric" 
              maxLength={4} 
              value={tempPin}
              onChange={e => setTempPin(e.target.value.replace(/\D/g, ''))}
              style={{ ...inputStyle, textAlign: 'center', fontSize: '24px', letterSpacing: '10px' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => { setShowPinModal(false); setTempPin(''); }} style={{ ...saveBtnStyle, backgroundColor: '#e2e8f0', color: '#64748b' }}>ΑΚΥΡΟ</button>
              <button onClick={savePin} style={saveBtnStyle}>ΟΡΙΣΜΟΣ</button>
            </div>
          </div>
        </div>
      )}

      {/* SUPPORT & DELETE SECTION */}
      {!showContact ? (
        <button onClick={() => setShowContact(true)} style={deleteLinkStyle}>
          Αίτημα διαγραφής επιχείρησης & υποστήριξη
        </button>
      ) : (
        <div style={supportCardStyle}>
          <h2 style={{ fontSize: '18px', fontWeight: '900', textAlign: 'center', marginBottom: '15px', color: '#991b1b' }}>Υποστήριξη</h2>
          <button onClick={handleWhatsAppRedirect} style={waBtnStyle}>ΕΠΙΚΟΙΝΩΝΙΑ ΜΕΣΩ WHATSAPP 💬</button>
          <div style={supportBoxStyle}>
            <p style={{ fontSize: '12px', color: '#854d0e', margin: 0, fontWeight: '700' }}>
              Γραμμή άμεσης βοήθειας:<br/>
              <span style={{ fontSize: '18px', color: '#422006' }}>6942216191</span>
            </p>
          </div>
          <button onClick={() => setShowContact(false)} style={cancelLinkStyle}>Επιστροφή στις ρυθμίσεις</button>
        </div>
      )}
    </div>
  )
}

// STYLES
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' };
const mainCardStyle: any = { backgroundColor: 'white', padding: '24px', borderRadius: '28px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', marginBottom: '20px' };
const sectionLabel: any = { fontSize: '11px', fontWeight: '900', color: '#0f172a', marginBottom: '15px', letterSpacing: '0.5px' };
const infoBoxStyle: any = { marginBottom: '20px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '16px', border: '1px solid #e0f2fe' };
const labelStyle: any = { fontSize: '10px', color: '#94a3b8', fontWeight: '800', marginBottom: '6px', display: 'block', textTransform: 'uppercase' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: '700', outline: 'none', boxSizing: 'border-box', backgroundColor: '#f8fafc' };
const hintStyle: any = { fontSize: '10px', color: '#0ea5e9', marginTop: '6px', fontWeight: '700' };
const divider: any = { height: '1px', backgroundColor: '#f1f5f9', margin: '25px 0' };
const saveBtnStyle: any = { width: '100%', backgroundColor: '#0f172a', color: 'white', padding: '18px', borderRadius: '16px', border: 'none', fontWeight: '900', fontSize: '15px', cursor: 'pointer' };
const deleteLinkStyle: any = { width: '100%', background: 'none', border: 'none', color: '#ef4444', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', fontWeight: '700', marginTop: '10px' };
const supportCardStyle: any = { backgroundColor: 'white', padding: '25px', borderRadius: '28px', border: '1px solid #fee2e2' };
const waBtnStyle: any = { width: '100%', backgroundColor: '#25d366', color: 'white', padding: '16px', borderRadius: '14px', border: 'none', fontWeight: '900', fontSize: '13px', cursor: 'pointer', marginBottom: '15px' };
const supportBoxStyle: any = { backgroundColor: '#fefce8', padding: '15px', borderRadius: '14px', textAlign: 'center', border: '1px solid #fef08a' };
const cancelLinkStyle: any = { width: '100%', background: 'none', border: 'none', color: '#94a3b8', marginTop: '20px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' };

// --- SECURITY SPECIFIC STYLES ---
const securityBoxStyle: any = { backgroundColor: '#f8fafc', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0' };
const settingRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const settingText: any = { fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: 0 };
const settingSubText: any = { fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' };
const checkboxStyle: any = { width: '20px', height: '20px', cursor: 'pointer' };
const modalOverlay: any = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' };
const modalContent: any = { backgroundColor: 'white', padding: '25px', borderRadius: '24px', width: '100%', maxWidth: '320px', textAlign: 'center' };

export default function SettingsPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><SettingsContent /></Suspense>
    </main>
  )
}
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'

function SettingsContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [showContact, setShowContact] = useState(false)

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
    localStorage.removeItem('fleet_track_pin')
    localStorage.removeItem('fleet_track_pin_enabled')
    localStorage.removeItem('fleet_track_biometrics')
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

  // --- ΣΥΝΑΡΤΗΣΗ ΕΞΑΓΩΓΗΣ EXCEL ΜΕ ΟΝΟΜΑΤΑ ΑΝΤΙ ΓΙΑ IDs ---
  const handleExportAll = async () => {
    setIsExporting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user?.id).single()

      if (!profile?.store_id) throw new Error('Δεν βρέθηκε κατάστημα')

      // 1. Τραβάμε τα δεδομένα από όλους τους πίνακες
      const [trans, sups, assets, emps] = await Promise.all([
        supabase.from('transactions').select('*').eq('store_id', profile.store_id).order('date', { ascending: false }),
        supabase.from('suppliers').select('id, name').eq('store_id', profile.store_id),
        supabase.from('fixed_assets').select('id, name').eq('store_id', profile.store_id),
        supabase.from('employees').select('id, name').eq('store_id', profile.store_id)
      ])

      // 2. Δημιουργούμε "Χάρτες" (Maps) για να βρίσκουμε το όνομα από το ID
      const supplierMap = Object.fromEntries(sups.data?.map(s => [s.id, s.name]) || [])
      const assetMap = Object.fromEntries(assets.data?.map(a => [a.id, a.name]) || [])
      const employeeMap = Object.fromEntries(emps.data?.map(e => [e.id, e.name]) || [])

      // 3. Καθαρίζουμε τα δεδομένα των συναλλαγών για το Excel
      const formattedTransactions = trans.data?.map(t => ({
        'Ημερομηνία': t.date,
        'Ποσό (€)': t.amount,
        'Τύπος': t.type === 'expense' ? 'Έξοδο' : 'Έσοδο',
        'Κατηγορία': t.category,
        'Μέθοδος': t.method,
        'Προμηθευτής': supplierMap[t.supplier_id] || '-',
        'Πάγιο/Λογαριασμός': assetMap[t.fixed_asset_id] || '-',
        'Υπάλληλος': employeeMap[t.employee_id] || '-',
        'Σημειώσεις': t.notes,
        'Καταχώρηση από': t.created_by_name
      })) || []

      const wb = XLSX.utils.book_new()

      // 4. Προσθήκη φύλλων στο Excel
      const wsTrans = XLSX.utils.json_to_sheet(formattedTransactions)
      XLSX.utils.book_append_sheet(wb, wsTrans, "Συναλλαγές")

      if (sups.data && sups.data.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sups.data), "Προμηθευτές")
      }
      if (assets.data && assets.data.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assets.data), "Πάγια")
      }
      if (emps.data && emps.data.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emps.data), "Υπάλληλοι")
      }

      const fileName = `Cosy_Backup_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
      alert('Το Excel δημιουργήθηκε με επιτυχία!')
    } catch (error: any) {
      alert('Σφάλμα εξαγωγής: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  async function handleSave() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error } = await supabase.from('profiles').upsert({ 
          id: user.id, 
          ...formData,
          updated_at: new Date().toISOString()
        })
        if (!error) alert('Οι αλλαγές αποθηκεύτηκαν επιτυχώς!')
        else throw error
      }
    } catch (error: any) {
      alert('Σφάλμα: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleWhatsAppRedirect = () => {
    const message = `Γεια σας, θα ήθελα να διαγράψω την επιχείρηση: ${formData.company_name || formData.store_name || 'Χωρίς Όνομα'}. \nEmail χρήστη: ${formData.email}`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/306942216191?text=${encodedMessage}`, '_blank');
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>⚙️</div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a' }}>Ρυθμίσεις</h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>ΔΙΑΧΕΙΡΙΣΗ ΠΡΟΦΙΛ</p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      <div style={mainCardStyle}>
        
        <p style={sectionLabel}>ΠΡΟΣΩΠΙΚΑ ΣΤΟΙΧΕΙΑ</p>
        <div style={infoBoxStyle}>
          <label style={labelStyle}>👤 ΤΟ ΟΝΟΜΑ ΣΑΣ (ΥΠΟΓΡΑΦΗ)</label>
          <input 
            style={inputStyle} 
            value={formData.username} 
            onChange={e => setFormData({...formData, username: e.target.value})} 
            placeholder="π.χ. ΓΙΑΝΝΗΣ Π."
          />
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={labelStyle}>EMAIL ΛΟΓΑΡΙΑΣΜΟΥ</label>
          <input style={{ ...inputStyle, backgroundColor: '#f1f5f9', color: '#64748b' }} value={formData.email} readOnly />
        </div>

        <div style={divider} />

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

        <button 
          onClick={handleExportAll} 
          disabled={isExporting} 
          style={{ ...saveBtnStyle, backgroundColor: '#059669', marginTop: '12px' }}
        >
          {isExporting ? 'ΠΡΟΕΤΟΙΜΑΣΙΑ...' : '📥 ΕΞΑΓΩΓΗ ΣΕ EXCEL (.xlsx)'}
        </button>
      </div>

      {!showContact ? (
        <button onClick={() => setShowContact(true)} style={deleteLinkStyle}>Υποστήριξη & Διαγραφή Επιχείρησης</button>
      ) : (
        <div style={supportCardStyle}>
          <h2 style={{ fontSize: '18px', fontWeight: '900', textAlign: 'center', marginBottom: '15px', color: '#991b1b' }}>Υποστήριξη</h2>
          <button onClick={handleWhatsAppRedirect} style={waBtnStyle}>ΕΠΙΚΟΙΝΩΝΙΑ ΜΕΣΩ WHATSAPP 💬</button>
          <button onClick={() => setShowContact(false)} style={cancelLinkStyle}>Επιστροφή στις ρυθμίσεις</button>
        </div>
      )}
    </div>
  )
}

// --- STYLES ---
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' };
const mainCardStyle: any = { backgroundColor: 'white', padding: '24px', borderRadius: '28px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', marginBottom: '20px' };
const sectionLabel: any = { fontSize: '11px', fontWeight: '900', color: '#0f172a', marginBottom: '15px' };
const infoBoxStyle: any = { marginBottom: '20px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '16px', border: '1px solid #e0f2fe' };
const labelStyle: any = { fontSize: '10px', color: '#94a3b8', fontWeight: '800', marginBottom: '6px', display: 'block' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: '700', boxSizing: 'border-box', backgroundColor: '#f8fafc' };
const divider: any = { height: '1px', backgroundColor: '#f1f5f9', margin: '25px 0' };
const saveBtnStyle: any = { width: '100%', backgroundColor: '#0f172a', color: 'white', padding: '18px', borderRadius: '16px', border: 'none', fontWeight: '900', cursor: 'pointer' };
const deleteLinkStyle: any = { width: '100%', background: 'none', border: 'none', color: '#ef4444', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', fontWeight: '700', marginTop: '15px' };
const supportCardStyle: any = { backgroundColor: 'white', padding: '25px', borderRadius: '28px', border: '1px solid #fee2e2' };
const waBtnStyle: any = { width: '100%', backgroundColor: '#25d366', color: 'white', padding: '16px', borderRadius: '14px', border: 'none', fontWeight: '900', fontSize: '13px', cursor: 'pointer' };
const cancelLinkStyle: any = { width: '100%', background: 'none', border: 'none', color: '#94a3b8', marginTop: '20px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' };

export default function SettingsPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><SettingsContent /></Suspense>
    </main>
  )
}
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { toast, Toaster } from 'sonner'
import { Settings, X, Download, Save, MessageCircle, Info } from 'lucide-react'

function SettingsContent() {
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [showContact, setShowContact] = useState(false)

  const [exportAllData, setExportAllData] = useState(false)
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  const [formData, setFormData] = useState({
    name: '', // Store Name
    company_name: '',
    afm: '',
    phone: '',
    address: '',
    email: '' // User Email
  })

  const fetchStoreSettings = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      // Παίρνουμε τα στοιχεία απευθείας από τον πίνακα STORES
      const { data: store, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single()

      if (store) {
        setFormData({
          name: store.name || '',
          company_name: store.company_name || '',
          afm: store.afm || '',
          phone: store.phone || '',
          address: store.address || '',
          email: user?.email || ''
        })
      }
    } catch (err) {
      toast.error('Αποτυχία φόρτωσης ρυθμίσεων')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    fetchStoreSettings()
  }, [fetchStoreSettings])

  const handleExportAll = async () => {
    if (!storeId) return toast.error('Δεν βρέθηκε ID καταστήματος')
    setIsExporting(true)
    try {
      let transQuery = supabase.from('transactions').select('*').eq('store_id', storeId)
      
      if (!exportAllData) {
        transQuery = transQuery.gte('date', startDate).lte('date', endDate)
      }

      const [trans, sups, assets, emps] = await Promise.all([
        transQuery.order('date', { ascending: false }),
        supabase.from('suppliers').select('*').eq('store_id', storeId),
        supabase.from('fixed_assets').select('*').eq('store_id', storeId),
        supabase.from('employees').select('*').eq('store_id', storeId)
      ])

      const supplierMap = Object.fromEntries(sups.data?.map(s => [s.id, s.name]) || [])
      const assetMap = Object.fromEntries(assets.data?.map(a => [a.id, a.name]) || [])
      const employeeMap = Object.fromEntries(emps.data?.map(e => [e.id, e.name]) || [])

      const formattedTransactions = trans.data?.map(t => ({
        'Ημερομηνία': t.date,
        'Ποσό (€)': t.amount,
        'Τύπος': t.type === 'expense' ? 'Έξοδο' : 'Έσοδο',
        'Κατηγορία': t.category,
        'Μέθοδος': t.method,
        'Προμηθευτής': supplierMap[t.supplier_id] || '-',
        'Πάγιο': assetMap[t.fixed_asset_id] || '-',
        'Υπάλληλος': employeeMap[t.employee_id] || '-',
        'Σημειώσεις': t.notes
      })) || []

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formattedTransactions), "Συναλλαγές")

      if (exportAllData) {
        if (sups.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sups.data), "Προμηθευτές")
        if (assets.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assets.data), "Πάγια")
        if (emps.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emps.data), "Υπάλληλοι")
      }

      XLSX.writeFile(wb, `Backup_${formData.name}_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Η εξαγωγή ολοκληρώθηκε!')
    } catch (error: any) {
      toast.error('Σφάλμα εξαγωγής')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleSave() {
    if (!storeId) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('stores')
        .update({
          name: formData.name.toUpperCase(),
          company_name: formData.company_name,
          afm: formData.afm,
          phone: formData.phone,
          address: formData.address,
        })
        .eq('id', storeId)

      if (error) throw error
      toast.success('Οι αλλαγές αποθηκεύτηκαν στο κατάστημα!')
    } catch (error: any) {
      toast.error('Σφάλμα κατά την αποθήκευση')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster richColors position="top-center" />
      <div style={containerNarrow}>
        
        <header style={headerRowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}><Settings size={20} color="#64748b" /></div>
            <div>
              <h1 style={titleStyle}>Ρυθμίσεις</h1>
              <p style={subtitleStyle}>{formData.name || 'ΚΑΤΑΣΤΗΜΑ'}</p>
            </div>
          </div>
          <Link href={`/?store=${storeId}`} style={backBtnStyle}><X size={20} /></Link>
        </header>

        <div style={mainCardStyle}>
          <p style={sectionLabel}>ΣΤΟΙΧΕΙΑ ΕΠΙΧΕΙΡΗΣΗΣ</p>
          
          <div style={inputGroup}>
            <label style={labelStyle}>ΤΙΤΛΟΣ ΚΑΤΑΣΤΗΜΑΤΟΣ (ΕΜΦΑΝΙΣΗ)</label>
            <input style={inputStyle} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>ΕΠΩΝΥΜΙΑ ΕΤΑΙΡΕΙΑΣ</label>
            <input style={inputStyle} value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} placeholder="π.χ. ΑΦΟΙ ΠΑΠΑΔΟΠΟΥΛΟΙ Ο.Ε." />
          </div>

          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>Α.Φ.Μ.</label>
              <input style={inputStyle} value={formData.afm} onChange={e => setFormData({...formData, afm: e.target.value})} />
            </div>
            <div>
              <label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label>
              <input style={inputStyle} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>ΔΙΕΥΘΥΝΣΗ</label>
            <textarea style={textareaStyle} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          </div>

          <button onClick={handleSave} disabled={loading} style={saveBtnStyle}>
            <Save size={18} /> {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΕΝΗΜΕΡΩΣΗ ΚΑΤΑΣΤΗΜΑΤΟΣ'}
          </button>

          <div style={divider} />

          <p style={sectionLabel}>ΕΞΑΓΩΓΗ ΔΕΔΟΜΕΝΩΝ (BACKUP)</p>
          
          <div style={checkboxContainer}>
            <input type="checkbox" id="exportAll" checked={exportAllData} onChange={(e) => setExportAllData(e.target.checked)} />
            <label htmlFor="exportAll" style={{ fontSize: '13px', fontWeight: '700' }}>Πλήρες Backup (Όλες οι εγγραφές)</label>
          </div>

          {!exportAllData && (
            <div style={gridStyle}>
              <input type="date" style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
              <input type="date" style={inputStyle} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          )}

          <button onClick={handleExportAll} disabled={isExporting} style={exportBtnStyle}>
            <Download size={18} /> {isExporting ? 'ΕΞΑΓΩΓΗ...' : 'ΛΗΨΗ ΑΡΧΕΙΟΥ EXCEL'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button onClick={() => setShowContact(!showContact)} style={supportToggleStyle}>
                <Info size={14} /> Υποστήριξη & Διαγραφή
            </button>
        </div>

        {showContact && (
          <div style={supportCardStyle}>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '15px' }}>Για προβλήματα ή οριστική διαγραφή του καταστήματος <b>{formData.name}</b>, επικοινωνήστε μαζί μας.</p>
            <button onClick={() => window.open(`https://wa.me/306942216191`, '_blank')} style={waBtnStyle}>
              <MessageCircle size={18} /> WHATSAPP SUPPORT
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// --- STYLES ---
const iphoneWrapper: any = { backgroundColor: '#f8fafc', minHeight: '100dvh', padding: '20px' };
const containerNarrow = { maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' };
const headerRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' };
const titleStyle = { fontWeight: '800', fontSize: '20px', margin: 0, color: '#0f172a' };
const subtitleStyle = { margin: 0, fontSize: '10px', color: '#6366f1', fontWeight: '800' };
const backBtnStyle: any = { backgroundColor: '#fff', padding: '8px', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#94a3b8' };
const mainCardStyle: any = { backgroundColor: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' };
const sectionLabel: any = { fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '15px', letterSpacing: '0.5px' };
const labelStyle: any = { fontSize: '10px', color: '#94a3b8', fontWeight: '800', marginBottom: '6px', display: 'block' };
const inputStyle: any = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: '600', backgroundColor: '#f8fafc' };
const textareaStyle: any = { ...inputStyle, height: '60px', resize: 'none' };
const inputGroup = { marginBottom: '15px' };
const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' };
const divider = { height: '1px', backgroundColor: '#f1f5f9', margin: '25px 0' };
const saveBtnStyle: any = { width: '100%', backgroundColor: '#0f172a', color: 'white', padding: '16px', borderRadius: '14px', border: 'none', fontWeight: '800', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px' };
const exportBtnStyle: any = { ...saveBtnStyle, backgroundColor: '#059669', marginTop: '10px' };
const checkboxContainer: any = { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '10px' };
const supportToggleStyle: any = { background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' };
const supportCardStyle: any = { marginTop: '15px', padding: '20px', backgroundColor: 'white', borderRadius: '20px', border: '1px solid #fee2e2', textAlign: 'center' };
const waBtnStyle: any = { width: '100%', backgroundColor: '#25d366', color: 'white', padding: '14px', borderRadius: '12px', border: 'none', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };

export default function SettingsPage() {
  return <main><Suspense fallback={null}><SettingsContent /></Suspense></main>
}
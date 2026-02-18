'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { toast, Toaster } from 'sonner'
import {
  Settings,
  X,
  Download,
  Save,
  MessageCircle,
  Info,
  Monitor,
  ShieldCheck,
  Building2,
  User2,
  Database,
  Sparkles,
} from 'lucide-react'

function SettingsContent() {
  // --- Personal Profile State ---
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileName, setProfileName] = useState('')
  const [profileSaveLoading, setProfileSaveLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  // Fetch current user's profile
  useEffect(() => {
    ;(async () => {
      setProfileLoading(true)
      setProfileError('')
      setProfileSuccess('')
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError || !user) throw new Error('Δεν βρέθηκε χρήστης')
        setUserId(user.id)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()
        if (profileError) throw profileError
        setProfileName(profile?.username || '')
      } catch (err: any) {
        setProfileError('Σφάλμα φόρτωσης προφίλ')
      } finally {
        setProfileLoading(false)
      }
    })()
  }, [])

  // Save profile username
  const handleProfileSave = async () => {
    if (!userId) return
    setProfileSaveLoading(true)
    setProfileError('')
    setProfileSuccess('')
    try {
      const { error } = await supabase.from('profiles').update({ username: profileName.trim() }).eq('id', userId)
      if (error) throw error
      setProfileSuccess('Το όνομα ενημερώθηκε!')
    } catch (err: any) {
      setProfileError('Σφάλμα αποθήκευσης')
    } finally {
      setProfileSaveLoading(false)
    }
  }

  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [showContact, setShowContact] = useState(false)

  const [exportAllData, setExportAllData] = useState(false)
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  // ✅ Z Toggle state
  const [zEnabled, setZEnabled] = useState<boolean>(true)
  const [zSaving, setZSaving] = useState(false)

  // small status line (purely visual)
  const [lastSavedHint, setLastSavedHint] = useState<string>('')

  const [formData, setFormData] = useState({
    name: '', // Store Name
    company_name: '',
    afm: '',
    phone: '',
    address: '',
    email: '', // User Email
  })

  const fetchStoreSettings = useCallback(async () => {
    if (!storeId) return
    try {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // stores (+ z_enabled)
      const { data: store, error } = await supabase.from('stores').select('*').eq('id', storeId).single()
      if (error) throw error

      if (store) {
        setFormData({
          name: store.name || '',
          company_name: store.company_name || '',
          afm: store.afm || '',
          phone: store.phone || '',
          address: store.address || '',
          email: user?.email || '',
        })

        // default true if null/undefined
        setZEnabled(store?.z_enabled === false ? false : true)
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

  // ✅ instant save for Z toggle
  const handleToggleZ = async () => {
    if (!storeId) return
    const next = !zEnabled
    setZEnabled(next)

    setZSaving(true)
    setLastSavedHint('Αποθήκευση ρύθμισης…')
    try {
      const { error } = await supabase.from('stores').update({ z_enabled: next }).eq('id', storeId)
      if (error) throw error
      toast.success(next ? 'Το Ζ θα εμφανίζεται στην αρχική ✅' : 'Το Ζ αφαιρέθηκε από την αρχική ✅')
      setLastSavedHint('Αποθηκεύτηκε ✅')
      setTimeout(() => setLastSavedHint(''), 2000)
    } catch (e) {
      setZEnabled(!next)
      toast.error('Σφάλμα: δεν αποθηκεύτηκε η ρύθμιση Ζ')
      setLastSavedHint('')
    } finally {
      setZSaving(false)
    }
  }

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
        supabase.from('employees').select('*').eq('store_id', storeId),
      ])

      const supplierMap = Object.fromEntries(sups.data?.map((s: any) => [s.id, s.name]) || [])
      const assetMap = Object.fromEntries(assets.data?.map((a: any) => [a.id, a.name]) || [])
      const employeeMap = Object.fromEntries(emps.data?.map((e: any) => [e.id, e.name]) || [])

      const formattedTransactions =
        trans.data?.map((t: any) => ({
          Ημερομηνία: t.date,
          'Ποσό (€)': t.amount,
          Τύπος: t.type === 'expense' ? 'Έξοδο' : 'Έσοδο',
          Κατηγορία: t.category,
          Μέθοδος: t.method,
          Προμηθευτής: supplierMap[t.supplier_id] || '-',
          Πάγιο: assetMap[t.fixed_asset_id] || '-',
          Υπάλληλος: employeeMap[t.employee_id] || '-',
          Σημειώσεις: t.notes,
        })) || []

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formattedTransactions), 'Συναλλαγές')

      if (exportAllData) {
        if (sups.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sups.data), 'Προμηθευτές')
        if (assets.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assets.data), 'Πάγια')
        if (emps.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emps.data), 'Υπάλληλοι')
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
    setLastSavedHint('Αποθήκευση…')
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
      setLastSavedHint('Αποθηκεύτηκε ✅')
      setTimeout(() => setLastSavedHint(''), 2000)
    } catch (error: any) {
      toast.error('Σφάλμα κατά την αποθήκευση')
      setLastSavedHint('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageWrap}>
      <Toaster richColors position="top-center" />

      <div style={containerNarrow}>
        {/* Premium Header */}
        <div style={topHeader}>
          <div style={topHeaderLeft}>
            <div style={topIcon}>
              <Settings size={20} />
            </div>
            <div>
              <div style={topTitleRow}>
                <h1 style={titleStyle}>Ρυθμίσεις</h1>
                <span style={premiumBadge}>
                  <Sparkles size={12} /> PREMIUM
                </span>
              </div>
              <p style={subtitleStyle}>{formData.name || 'ΚΑΤΑΣΤΗΜΑ'}</p>
            </div>
          </div>

          <div style={topHeaderRight}>
            {lastSavedHint ? <span style={saveHintPill}>{lastSavedHint}</span> : <span style={saveHintGhost}> </span>}
            <Link href={`/?store=${storeId}`} style={backBtnStyle} aria-label="back">
              <X size={20} />
            </Link>
          </div>
        </div>

        {/* --- PERSONAL PROFILE SECTION --- */}
        <section style={sectionCard}>
          <div style={sectionHead}>
            <div style={sectionIcon('#EEF2FF', '#4338CA')}>
              <User2 size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={sectionKicker}>ΠΡΟΣΩΠΙΚΟ</p>
              <h2 style={sectionTitle}>Προφίλ</h2>
            </div>
          </div>

          <div style={contentCard}>
            <div style={inputGroup}>
              <label style={labelStyle}>Το όνομά μου (username)</label>
              <input
                style={{ ...inputStyle, fontSize: '16px' }}
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                disabled={profileLoading || profileSaveLoading}
                placeholder="Το όνομά σας..."
              />
              <p style={fieldHint}>Χρησιμοποιείται για εμφανίσεις/δημιουργό κινήσεων.</p>
            </div>

            <button
              onClick={handleProfileSave}
              disabled={profileLoading || profileSaveLoading}
              style={{ ...primaryBtn, opacity: profileLoading || profileSaveLoading ? 0.75 : 1 }}
            >
              <Save size={18} /> {profileSaveLoading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ ΟΝΟΜΑΤΟΣ'}
            </button>

            {profileError && <div style={msgError}>{profileError}</div>}
            {profileSuccess && <div style={msgSuccess}>{profileSuccess}</div>}
          </div>
        </section>

        {/* --- STORE SETTINGS SECTION --- */}
        <section style={sectionCard}>
          <div style={sectionHead}>
            <div style={sectionIcon('#ECFDF5', '#047857')}>
              <Building2 size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={sectionKicker}>ΕΠΙΧΕΙΡΗΣΗ</p>
              <h2 style={sectionTitle}>Στοιχεία Καταστήματος</h2>
            </div>
          </div>

          <div style={contentCard}>
            <div style={inputGroup}>
              <label style={labelStyle}>ΤΙΤΛΟΣ ΚΑΤΑΣΤΗΜΑΤΟΣ (ΕΜΦΑΝΙΣΗ)</label>
              <input
                style={inputStyle}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div style={inputGroup}>
              <label style={labelStyle}>ΕΠΩΝΥΜΙΑ ΕΤΑΙΡΕΙΑΣ</label>
              <input
                style={inputStyle}
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="π.χ. ΑΦΟΙ ΠΑΠΑΔΟΠΟΥΛΟΙ Ο.Ε."
              />
            </div>

            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Α.Φ.Μ.</label>
                <input style={inputStyle} value={formData.afm} onChange={(e) => setFormData({ ...formData, afm: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label>
                <input style={inputStyle} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>

            <div style={inputGroup}>
              <label style={labelStyle}>ΔΙΕΥΘΥΝΣΗ</label>
              <textarea style={textareaStyle} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>

            {/* ✅ Feature: Z Toggle */}
            <div style={divider} />
            <div style={featureWrap}>
              <div style={featureHead}>
                <div style={sectionIcon('#FFF7ED', '#9A3412')}>
                  <Monitor size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={sectionKicker}>ΕΜΦΑΝΙΣΗ</p>
                  <h3 style={featureTitle}>Dashboard Features</h3>
                </div>
                <span style={chip}>Store</span>
              </div>

              <button
                type="button"
                onClick={handleToggleZ}
                disabled={zSaving || loading}
                style={{
                  ...toggleRowBtn,
                  opacity: zSaving || loading ? 0.75 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={toggleIconBox(zEnabled)}>
                    <ShieldCheck size={18} color={zEnabled ? '#059669' : '#64748b'} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 900, fontSize: 13, color: '#0f172a' }}>Εμφάνιση Ζ στην αρχική</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                      {zEnabled ? 'Το κουμπί Ζ φαίνεται στο Dashboard' : 'Το κουμπί Ζ είναι κρυφό από το Dashboard'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={pill(zEnabled ? '#059669' : '#cbd5e1', zEnabled ? '#059669' : '#64748b')}>
                    {zEnabled ? 'ON' : 'OFF'}
                  </div>
                  <div style={switchOuter(zEnabled)}>
                    <div style={switchInner(zEnabled)} />
                  </div>
                </div>
              </button>

              <p style={fieldHint}>(Όταν είναι OFF, το Ζ εξαφανίζεται από την αρχική.)</p>
            </div>

            <button onClick={handleSave} disabled={loading} style={{ ...primaryBtn, marginTop: 8, opacity: loading ? 0.75 : 1 }}>
              <Save size={18} /> {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΕΝΗΜΕΡΩΣΗ ΚΑΤΑΣΤΗΜΑΤΟΣ'}
            </button>
          </div>
        </section>

        {/* --- BACKUP SECTION --- */}
        <section style={sectionCard}>
          <div style={sectionHead}>
            <div style={sectionIcon('#F1F5F9', '#0F172A')}>
              <Database size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={sectionKicker}>ΔΕΔΟΜΕΝΑ</p>
              <h2 style={sectionTitle}>Backup</h2>
            </div>
          </div>

          <div style={contentCard}>
            <div style={checkboxContainer}>
              <input type="checkbox" id="exportAll" checked={exportAllData} onChange={(e) => setExportAllData(e.target.checked)} />
              <label htmlFor="exportAll" style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                Πλήρες Backup (Όλες οι εγγραφές)
              </label>
            </div>

            {!exportAllData && (
              <div style={gridStyle}>
                <input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <input type="date" style={inputStyle} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            )}

            <button onClick={handleExportAll} disabled={isExporting} style={{ ...successBtn, opacity: isExporting ? 0.75 : 1 }}>
              <Download size={18} /> {isExporting ? 'ΕΞΑΓΩΓΗ...' : 'ΛΗΨΗ ΑΡΧΕΙΟΥ EXCEL'}
            </button>

            <p style={fieldHint}>
              Προτείνεται να κρατάς backup ανά τακτά χρονικά διαστήματα.
            </p>
          </div>
        </section>

        {/* --- SUPPORT --- */}
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <button onClick={() => setShowContact(!showContact)} style={supportToggleStyle}>
            <Info size={14} /> Υποστήριξη & Διαγραφή
          </button>
        </div>

        {showContact && (
          <div style={supportCardStyle}>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '15px', fontWeight: 700 }}>
              Για προβλήματα ή οριστική διαγραφή του καταστήματος <b style={{ color: '#0f172a' }}>{formData.name}</b>, επικοινωνήστε μαζί μας.
            </p>
            <button onClick={() => window.open(`https://wa.me/306942216191`, '_blank')} style={waBtnStyle}>
              <MessageCircle size={18} /> WHATSAPP SUPPORT
            </button>
          </div>
        )}

        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}

/* -------------------- STYLES (Premium) -------------------- */
const pageWrap: any = {
  minHeight: '100dvh',
  padding: '20px',
  background:
    'radial-gradient(1200px 600px at 20% -10%, #eef2ff 0%, rgba(238,242,255,0) 55%), radial-gradient(1200px 600px at 90% 0%, #ecfdf5 0%, rgba(236,253,245,0) 55%), #f8fafc',
}

const containerNarrow: any = { maxWidth: '520px', margin: '0 auto', paddingBottom: '90px' }

const topHeader: any = {
  position: 'sticky',
  top: 12,
  zIndex: 20,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: 14,
  borderRadius: 20,
  border: '1px solid #e2e8f0',
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
  marginBottom: 16,
}

const topHeaderLeft: any = { display: 'flex', alignItems: 'center', gap: 12 }
const topHeaderRight: any = { display: 'flex', alignItems: 'center', gap: 10 }

const topIcon: any = {
  width: 44,
  height: 44,
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#0f172a',
}

const topTitleRow: any = { display: 'flex', alignItems: 'center', gap: 10 }
const titleStyle: any = { fontWeight: '900', fontSize: '18px', margin: 0, color: '#0f172a' }
const subtitleStyle: any = { margin: 0, fontSize: '10px', color: '#6366f1', fontWeight: '900', letterSpacing: '0.6px' }

const premiumBadge: any = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  fontSize: 10,
  fontWeight: 900,
  color: '#0f172a',
}

const backBtnStyle: any = {
  backgroundColor: '#fff',
  padding: '10px',
  borderRadius: '14px',
  border: '1px solid #e2e8f0',
  color: '#94a3b8',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const saveHintPill: any = {
  padding: '8px 10px',
  borderRadius: 999,
  background: '#f1f5f9',
  border: '1px solid #e2e8f0',
  fontSize: 11,
  fontWeight: 900,
  color: '#0f172a',
}
const saveHintGhost: any = { width: 140 }

const sectionCard: any = {
  marginTop: 14,
  borderRadius: 24,
  border: '1px solid #e2e8f0',
  background: 'rgba(255,255,255,0.8)',
  backdropFilter: 'blur(6px)',
  boxShadow: '0 10px 30px rgba(15,23,42,0.05)',
  overflow: 'hidden',
}

const sectionHead: any = {
  padding: 18,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  borderBottom: '1px solid #eef2f7',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.7))',
}

const sectionIcon = (bg: string, color: string): any => ({
  width: 42,
  height: 42,
  borderRadius: 16,
  background: bg,
  border: '1px solid #e2e8f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color,
})

const sectionKicker: any = { margin: 0, fontSize: 10, fontWeight: 900, color: '#64748b', letterSpacing: '0.8px' }
const sectionTitle: any = { margin: 0, fontSize: 15, fontWeight: 900, color: '#0f172a' }

const contentCard: any = { padding: 18 }

const labelStyle: any = { fontSize: '10px', color: '#94a3b8', fontWeight: '900', marginBottom: '6px', display: 'block', letterSpacing: '0.6px' }

const inputStyle: any = {
  width: '100%',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  fontSize: '14px',
  fontWeight: '700',
  backgroundColor: '#f8fafc',
  outline: 'none',
}

const textareaStyle: any = { ...inputStyle, height: '70px', resize: 'none' }
const inputGroup: any = { marginBottom: 14 }
const gridStyle: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }
const divider: any = { height: 1, backgroundColor: '#eef2f7', margin: '18px 0' }

const fieldHint: any = { margin: '8px 0 0 0', fontSize: 11, fontWeight: 700, color: '#64748b' }

const primaryBtn: any = {
  width: '100%',
  backgroundColor: '#0f172a',
  color: 'white',
  padding: '16px',
  borderRadius: '14px',
  border: 'none',
  fontWeight: '900',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  boxShadow: '0 10px 20px rgba(15,23,42,0.18)',
}

const successBtn: any = {
  ...primaryBtn,
  backgroundColor: '#059669',
  boxShadow: '0 10px 20px rgba(5,150,105,0.18)',
}

const msgError: any = { marginTop: 10, color: '#dc2626', fontSize: 13, fontWeight: 800 }
const msgSuccess: any = { marginTop: 10, color: '#059669', fontSize: 13, fontWeight: 900 }

const checkboxContainer: any = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 14,
  padding: 12,
  backgroundColor: '#f8fafc',
  borderRadius: 14,
  border: '1px solid #e2e8f0',
}

const featureWrap: any = {
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  padding: 14,
  background: 'linear-gradient(180deg, #ffffff, #f8fafc)',
}

const featureHead: any = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }
const featureTitle: any = { margin: 0, fontSize: 14, fontWeight: 900, color: '#0f172a' }

const chip: any = {
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  fontSize: 10,
  fontWeight: 900,
  color: '#0f172a',
}

const toggleRowBtn: any = {
  width: '100%',
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  padding: '14px',
  borderRadius: '16px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
}

const toggleIconBox = (on: boolean): any => ({
  width: 38,
  height: 38,
  borderRadius: 14,
  background: on ? '#ecfdf5' : '#f1f5f9',
  border: '1px solid #e2e8f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

const pill = (borderColor: string, textColor: string): any => ({
  padding: '6px 10px',
  borderRadius: 999,
  border: `1px solid ${borderColor}`,
  background: '#ffffff',
  color: textColor,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.5px',
})

const switchOuter = (on: boolean): any => ({
  width: 46,
  height: 26,
  borderRadius: 999,
  background: on ? '#059669' : '#cbd5e1',
  border: '1px solid #e2e8f0',
  padding: 3,
  display: 'flex',
  alignItems: 'center',
  justifyContent: on ? 'flex-end' : 'flex-start',
})

const switchInner = (on: boolean): any => ({
  width: 20,
  height: 20,
  borderRadius: 999,
  background: '#ffffff',
  boxShadow: '0 6px 12px rgba(0,0,0,0.12)',
})

const supportToggleStyle: any = {
  background: 'none',
  border: 'none',
  color: '#94a3b8',
  fontSize: '12px',
  fontWeight: '800',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 10px',
}

const supportCardStyle: any = {
  marginTop: 12,
  padding: 18,
  backgroundColor: 'white',
  borderRadius: 22,
  border: '1px solid #fee2e2',
  textAlign: 'center',
  boxShadow: '0 10px 25px rgba(220,38,38,0.06)',
}

const waBtnStyle: any = {
  width: '100%',
  backgroundColor: '#25d366',
  color: 'white',
  padding: '14px',
  borderRadius: '14px',
  border: 'none',
  fontWeight: '900',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  boxShadow: '0 12px 22px rgba(37,211,102,0.18)',
}

export default function SettingsPage() {
  return (
    <main>
      <Suspense fallback={null}>
        <SettingsContent />
      </Suspense>
    </main>
  )
}
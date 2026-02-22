'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useRef, type Dispatch, type SetStateAction, type ReactNode, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import PermissionGuard from '@/components/PermissionGuard'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { toast, Toaster } from 'sonner'
import {
  Settings as SettingsIcon,
  X,
  Download,
  Save,
  MessageCircle,
  Info,
  Monitor,
  ShieldCheck,
  User2,
  Building2,
  Database,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

type SectionId = 'profile' | 'business' | 'appearance' | 'backup' | 'support'

type NamedEntity = {
  id: string
  name: string
}

type ExportTransactionRow = {
  date: string
  amount: number
  type: string
  category: string | null
  method: string | null
  supplier_id: string | null
  fixed_asset_id: string | null
  employee_id: string | null
  notes: string | null
}

function SectionCard({
  id,
  icon,
  title,
  subtitle,
  children,
  openSection,
  setOpenSection,
  chipRight,
}: {
  id: SectionId
  icon: ReactNode
  title: string
  subtitle: string
  children: ReactNode
  openSection: SectionId | null
  setOpenSection: Dispatch<SetStateAction<SectionId | null>>
  chipRight?: ReactNode
}) {
  const open = openSection === id
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    setTimeout(() => {
      wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }, [open])

  return (
    <div ref={wrapRef} style={sectionCard}>
      <button
        type="button"
        onClick={() => setOpenSection(open ? null : id)}
        style={{
          ...sectionHeaderBtn,
          borderBottomLeftRadius: open ? 0 : 22,
          borderBottomRightRadius: open ? 0 : 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={sectionIconWrap}>{icon}</div>
          <div style={{ textAlign: 'left' }}>
            <div style={sectionTitle}>{title}</div>
            <div style={sectionSub}>{subtitle}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {chipRight}
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      <AnimatedBody open={open}>{children}</AnimatedBody>
    </div>
  )
}

function AnimatedBody({ open, children }: { open: boolean; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [maxH, setMaxH] = useState<number>(0)

  useEffect(() => {
    const el = innerRef.current
    if (!el) return

    const measure = () => {
      const next = el.scrollHeight || 0
      setMaxH(next)
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [children])

  useEffect(() => {
    if (!open) return
    const el = innerRef.current
    if (!el) return
    setMaxH(el.scrollHeight || 0)
  }, [open])

  return (
    <div
      style={{
        maxHeight: open ? maxH + 28 : 0,
        overflow: 'hidden',
        transition: 'max-height 320ms cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <div
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0px)' : 'translateY(-6px)',
          transition: 'opacity 200ms ease, transform 220ms ease',
          padding: open ? 14 : 0,
        }}
      >
        <div ref={innerRef}>{children}</div>
      </div>
    </div>
  )
}

function SettingsContent() {
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  // --- Personal Profile State ---
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileName, setProfileName] = useState('')
  const [profileSaveLoading, setProfileSaveLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  // Store/settings
  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [showContact, setShowContact] = useState(false)

  const [exportAllData, setExportAllData] = useState(false)
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  const [zEnabled, setZEnabled] = useState<boolean>(true)
  const [zSaving, setZSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    afm: '',
    phone: '',
    address: '',
    email: '',
  })

  // ✅ IMPORTANT: no section open by default
  const [openSection, setOpenSection] = useState<SectionId | null>(null)

  // Fetch profile
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
      } catch {
        setProfileError('Σφάλμα φόρτωσης προφίλ')
      } finally {
        setProfileLoading(false)
      }
    })()
  }, [])

  const handleProfileSave = async () => {
    if (!userId) return
    setProfileSaveLoading(true)
    setProfileError('')
    setProfileSuccess('')
    try {
      const { error } = await supabase.from('profiles').update({ username: profileName.trim() }).eq('id', userId)
      if (error) throw error
      setProfileSuccess('Το όνομα ενημερώθηκε!')
      toast.success('Το προφίλ αποθηκεύτηκε ✅')
    } catch {
      setProfileError('Σφάλμα αποθήκευσης')
      toast.error('Σφάλμα αποθήκευσης')
    } finally {
      setProfileSaveLoading(false)
    }
  }

  const fetchStoreSettings = useCallback(async () => {
    if (!storeId) return
    try {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data: store, error } = await supabase.from('stores').select('*').eq('id', storeId).single()
      if (error) throw error

      setFormData({
        name: store?.name || '',
        company_name: store?.company_name || '',
        afm: store?.afm || '',
        phone: store?.phone || '',
        address: store?.address || '',
        email: user?.email || '',
      })

      setZEnabled(store?.z_enabled === false ? false : true)
    } catch {
      toast.error('Αποτυχία φόρτωσης ρυθμίσεων')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    fetchStoreSettings()
  }, [fetchStoreSettings])

  // Toggle Z (instant save)
  const handleToggleZ = async () => {
    if (!storeId) return
    const next = !zEnabled
    setZEnabled(next)
    setZSaving(true)

    try {
      const { error } = await supabase.from('stores').update({ z_enabled: next }).eq('id', storeId)
      if (error) throw error
      toast.success(next ? 'Το Ζ θα εμφανίζεται στην αρχική ✅' : 'Το Ζ αφαιρέθηκε από την αρχική ✅')
    } catch {
      setZEnabled(!next)
      toast.error('Σφάλμα: δεν αποθηκεύτηκε η ρύθμιση Ζ')
    } finally {
      setZSaving(false)
    }
  }

  async function handleSaveStore() {
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
      toast.success('Οι αλλαγές αποθηκεύτηκαν στο κατάστημα ✅')
    } catch {
      toast.error('Σφάλμα κατά την αποθήκευση')
    } finally {
      setLoading(false)
    }
  }

  const handleExportAll = async () => {
    if (!storeId) return toast.error('Δεν βρέθηκε ID καταστήματος')
    setIsExporting(true)
    try {
      let transQuery = supabase.from('transactions').select('*').eq('store_id', storeId)
      if (!exportAllData) transQuery = transQuery.gte('date', startDate).lte('date', endDate)

      const [trans, sups, assets, emps, fixedAssetsLookup] = await Promise.all([
        transQuery.order('date', { ascending: false }),
        supabase.from('suppliers').select('*').eq('store_id', storeId),
        supabase.from('fixed_assets').select('*').eq('store_id', storeId),
        supabase.from('employees').select('*').eq('store_id', storeId),
        supabase.from('fixed_assets').select('id, name').eq('store_id', storeId),
      ])

      const suppliersData = (sups.data ?? []) as NamedEntity[]
      const assetsData = (assets.data ?? []) as NamedEntity[]
      const employeesData = (emps.data ?? []) as NamedEntity[]
      const fixedAssetsData = (fixedAssetsLookup.data ?? []) as NamedEntity[]

      const supplierMap = Object.fromEntries(suppliersData.map((s) => [s.id, s.name]))
      const assetMap = Object.fromEntries(assetsData.map((a) => [a.id, a.name]))
      const employeeMap = Object.fromEntries(employeesData.map((e) => [e.id, e.name]))
      const fixedAssetEmployeeMap = Object.fromEntries(fixedAssetsData.map((a) => [a.id, a.name]))

      const formattedTransactions =
        ((trans.data ?? []) as ExportTransactionRow[]).map((t) => ({
          Ημερομηνία: t.date,
          'Ποσό (€)': t.amount,
          Τύπος: t.type === 'expense' ? 'Έξοδο' : 'Έσοδο',
          Κατηγορία: t.category,
          Μέθοδος: t.method,
          Προμηθευτής: supplierMap[t.supplier_id] || '-',
          Πάγιο: assetMap[t.fixed_asset_id] || '-',
          Υπάλληλος: t.fixed_asset_id
            ? fixedAssetEmployeeMap[t.fixed_asset_id] || '-'
            : employeeMap[t.employee_id] || '-',
          Σημειώσεις: t.notes,
        }))

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(formattedTransactions), 'Συναλλαγές')

      if (exportAllData) {
        if (sups.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sups.data), 'Προμηθευτές')
        if (assets.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assets.data), 'Πάγια')
        if (emps.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emps.data), 'Υπάλληλοι')
      }

      XLSX.writeFile(wb, `Backup_${formData.name}_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Η εξαγωγή ολοκληρώθηκε ✅')
    } catch {
      toast.error('Σφάλμα εξαγωγής')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <PermissionGuard storeId={storeId}>
      {({ isAdmin, isLoading: checkingPermission }) => (
    <div style={pageWrap}>
      <Toaster richColors position="top-center" />

      <div style={container}>
        {/* Top App Header */}
        <div style={topBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={appIcon}>
              <SettingsIcon size={20} />
            </div>
            <div>
              <div style={topTitle}>Ρυθμίσεις</div>
              <div style={topSubtitle}>{(formData.name || 'ΚΑΤΑΣΤΗΜΑ').toUpperCase()}</div>
            </div>
          </div>

          <Link href={`/?store=${storeId}`} style={closeBtn} aria-label="close">
            <X size={20} />
          </Link>
        </div>

        {!checkingPermission && !isAdmin && <div style={readOnlyBannerStyle}>Read-only access</div>}

        {/* Sections */}
        <SectionCard
          id="appearance"
          icon={<Monitor size={18} color="#9A3412" />}
          title="Εμφάνιση"
          subtitle="Dashboard Features & προβολές"
          openSection={openSection}
          setOpenSection={setOpenSection}
          chipRight={<span style={chip}>Store</span>}
        >
          <div style={featureCard}>
            <div style={featureHeaderRow}>
              <div style={featureHeaderLeft}>
                <div style={featureIconOuter}>
                  <Monitor size={22} color="#7c2d12" />
                </div>
                <div>
                  <div style={featureKicker}>ΕΜΦΑΝΙΣΗ</div>
                  <div style={featureTitle}>Dashboard Features</div>
                </div>
              </div>
              <div style={featureChip}>Store</div>
            </div>

            <div style={featureInnerCard}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={shieldPill}>
                  <ShieldCheck size={22} color="#16a34a" />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={featureMainTitle}>Εμφάνιση Ζ στην αρχική</div>
                  <div style={featureMainSub}>
                    {zEnabled ? 'Το κουμπί Z φαίνεται στο Dashboard' : 'Το κουμπί Z είναι κρυφό από το Dashboard'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={onPill(zEnabled)}>{zEnabled ? 'ON' : 'OFF'}</div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleToggleZ}
                      disabled={zSaving || loading}
                      style={{ ...iosSwitch(zEnabled), opacity: zSaving || loading ? 0.7 : 1 }}
                      aria-label="toggle z"
                    >
                      <div style={iosKnob(zEnabled)} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={featureFootNote}>(Όταν είναι OFF, το Z εξαφανίζεται από την αρχική.)</div>
          </div>
        </SectionCard>

        <SectionCard
          id="business"
          icon={<Building2 size={18} color="#0f172a" />}
          title="Επιχείρηση"
          subtitle="Στοιχεία καταστήματος & τιμολόγησης"
          openSection={openSection}
          setOpenSection={setOpenSection}
        >
          <div style={grid2}>
            <div style={field}>
              <label style={label}>ΤΙΤΛΟΣ ΚΑΤΑΣΤΗΜΑΤΟΣ (ΕΜΦΑΝΙΣΗ)</label>
              <input style={input} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>

            <div style={field}>
              <label style={label}>ΤΗΛΕΦΩΝΟ</label>
              <input style={input} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
          </div>

          <div style={field}>
            <label style={label}>ΕΠΩΝΥΜΙΑ ΕΤΑΙΡΕΙΑΣ</label>
            <input
              style={input}
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              placeholder="π.χ. ΑΦΟΙ ΠΑΠΑΔΟΠΟΥΛΟΙ Ο.Ε."
            />
          </div>

          <div style={grid2}>
            <div style={field}>
              <label style={label}>Α.Φ.Μ.</label>
              <input style={input} value={formData.afm} onChange={(e) => setFormData({ ...formData, afm: e.target.value })} />
            </div>
            <div style={field}>
              <label style={label}>EMAIL (LOGGED IN)</label>
              <input style={{ ...input, opacity: 0.8 }} value={formData.email} disabled />
            </div>
          </div>

          <div style={field}>
            <label style={label}>ΔΙΕΥΘΥΝΣΗ</label>
            <textarea style={textarea} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          </div>

          {isAdmin && (
            <button onClick={handleSaveStore} disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
              <Save size={18} /> {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΕΝΗΜΕΡΩΣΗ ΚΑΤΑΣΤΗΜΑΤΟΣ'}
            </button>
          )}
        </SectionCard>

        <SectionCard
          id="profile"
          icon={<User2 size={18} color="#0f172a" />}
          title="Προφίλ"
          subtitle="Όνομα χρήστη & εμφανίσεις"
          openSection={openSection}
          setOpenSection={setOpenSection}
        >
          <div style={field}>
            <label style={label}>Το όνομά μου (username)</label>
            <input
              style={{ ...input, fontSize: '16px' }}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              disabled={profileLoading || profileSaveLoading}
              placeholder="Το όνομά σας..."
            />
          </div>

          {isAdmin && (
            <button
              onClick={handleProfileSave}
              disabled={profileLoading || profileSaveLoading}
              style={{ ...primaryBtn, opacity: profileLoading || profileSaveLoading ? 0.7 : 1 }}
            >
              <Save size={18} /> {profileSaveLoading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ ΟΝΟΜΑΤΟΣ'}
            </button>
          )}

          {profileError && <div style={msgError}>{profileError}</div>}
          {profileSuccess && <div style={msgSuccess}>{profileSuccess}</div>}
        </SectionCard>

        <SectionCard
          id="backup"
          icon={<Database size={18} color="#0f172a" />}
          title="Backup"
          subtitle="Εξαγωγή δεδομένων σε Excel"
          openSection={openSection}
          setOpenSection={setOpenSection}
        >
          <div style={backupCard}>
            <div style={backupRow}>
              <div>
                <div style={backupTitle}>Εξαγωγή δεδομένων</div>
                <div style={backupSub}>Δημιούργησε αρχείο Excel για αποθήκευση/ασφάλεια.</div>
              </div>

              <div style={backupToggleBox}>
                <input type="checkbox" id="exportAll" checked={exportAllData} onChange={(e) => setExportAllData(e.target.checked)} />
                <label htmlFor="exportAll" style={backupToggleLabel}>
                  Πλήρες Backup
                </label>
              </div>
            </div>

            {!exportAllData && (
              <div style={grid2}>
                <div style={field}>
                  <label style={label}>Από</label>
                  <input type="date" style={input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div style={field}>
                  <label style={label}>Έως</label>
                  <input type="date" style={input} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            )}

            <button onClick={handleExportAll} disabled={isExporting} style={{ ...successBtn, opacity: isExporting ? 0.7 : 1 }}>
              <Download size={18} /> {isExporting ? 'ΕΞΑΓΩΓΗ...' : 'ΛΗΨΗ ΑΡΧΕΙΟΥ EXCEL'}
            </button>
          </div>
        </SectionCard>

        <SectionCard
          id="support"
          icon={<Info size={18} color="#0f172a" />}
          title="Υποστήριξη"
          subtitle="Επικοινωνία & διαγραφή"
          openSection={openSection}
          setOpenSection={setOpenSection}
        >
          <button onClick={() => setShowContact(!showContact)} style={supportToggle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={supportIcon}>
                <Info size={16} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={supportTitle}>Υποστήριξη & Διαγραφή</div>
                <div style={supportSub}>Άνοιξε επιλογές επικοινωνίας και ενημέρωση.</div>
              </div>
            </div>
            {showContact ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {showContact && (
            <div style={supportCard}>
              <p style={supportText}>
                Για προβλήματα ή οριστική διαγραφή του καταστήματος <b>{formData.name}</b>, επικοινωνήστε μαζί μας.
              </p>
              <button onClick={() => window.open(`https://wa.me/306942216191`, '_blank')} style={waBtnStyle}>
                <MessageCircle size={18} /> WHATSAPP SUPPORT
              </button>
            </div>
          )}
        </SectionCard>

        <div style={{ height: 24 }} />
      </div>
    </div>
      )}
    </PermissionGuard>
  )
}

/* ---------------- STYLES ---------------- */
const pageWrap: CSSProperties = {
  minHeight: '100dvh',
  background:
    'radial-gradient(1200px 600px at 20% -10%, #eef2ff 0%, rgba(238,242,255,0) 55%), radial-gradient(1200px 600px at 90% 0%, #ecfdf5 0%, rgba(236,253,245,0) 55%), #f8fafc',
  padding: 18,
}

const container: CSSProperties = { maxWidth: 540, margin: '0 auto', paddingBottom: 140 }

const topBar: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 14,
  borderRadius: 22,
  border: '1px solid #e2e8f0',
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 14px 28px rgba(15, 23, 42, 0.06)',
  position: 'sticky',
  top: 12,
  zIndex: 10,
  marginBottom: 12,
}

const appIcon: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 16,
  background: '#fff',
  border: '1px solid #e2e8f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#0f172a',
}

const topTitle: CSSProperties = { fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }
const topSubtitle: CSSProperties = { fontSize: 10, fontWeight: 900, color: '#6366f1', letterSpacing: 0.6 }
const readOnlyBannerStyle: CSSProperties = {
  marginBottom: 12,
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
  color: '#475569',
  fontSize: 12,
  fontWeight: 800,
  textAlign: 'center',
}

const closeBtn: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 16,
  background: '#fff',
  border: '1px solid #e2e8f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#94a3b8',
  textDecoration: 'none',
}

const sectionCard: CSSProperties = {
  marginTop: 12,
  borderRadius: 22,
  border: '1px solid #e2e8f0',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.05)',
  overflow: 'hidden',
}

const sectionHeaderBtn: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: 'none',
  background: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  color: '#0f172a',
  transition: 'all 0.15s ease',
}

const sectionIconWrap: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 16,
  background: '#fff',
  border: '1px solid #e2e8f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const sectionTitle: CSSProperties = { fontSize: 14, fontWeight: 900 }
const sectionSub: CSSProperties = { fontSize: 11, fontWeight: 700, color: '#64748b', marginTop: 2 }
const chip: CSSProperties = { padding: '6px 10px', borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', fontSize: 10, fontWeight: 900, color: '#0f172a' }

const label: CSSProperties = { fontSize: 10, fontWeight: 900, color: '#94a3b8', letterSpacing: 0.6, marginBottom: 6, display: 'block' }
const input: CSSProperties = { width: '100%', padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 800, fontSize: 14, outline: 'none' }
const textarea: CSSProperties = { ...input, height: 72, resize: 'none' }
const field: CSSProperties = { marginBottom: 12 }
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

const primaryBtn: CSSProperties = { width: '100%', background: '#0f172a', color: '#fff', border: 'none', padding: 16, borderRadius: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', boxShadow: '0 12px 18px rgba(15,23,42,0.18)' }
const successBtn: CSSProperties = { ...primaryBtn, background: '#059669', boxShadow: '0 12px 18px rgba(5,150,105,0.18)' }

const msgError: CSSProperties = { marginTop: 10, color: '#dc2626', fontSize: 13, fontWeight: 900 }
const msgSuccess: CSSProperties = { marginTop: 10, color: '#059669', fontSize: 13, fontWeight: 900 }

const featureCard: CSSProperties = { borderRadius: 24, border: '1px solid #e2e8f0', background: '#fff', overflow: 'hidden' }
const featureHeaderRow: CSSProperties = { padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eef2f7' }
const featureHeaderLeft: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12 }
const featureIconOuter: CSSProperties = { width: 58, height: 58, borderRadius: 22, background: '#fff7ed', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const featureKicker: CSSProperties = { fontSize: 12, fontWeight: 900, color: '#64748b', letterSpacing: 0.6 }
const featureTitle: CSSProperties = { fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 2, lineHeight: 1.1 }
const featureChip: CSSProperties = { padding: '9px 16px', borderRadius: 999, border: '1px solid #e2e8f0', fontWeight: 900, background: '#fff' }

const featureInnerCard: CSSProperties = { margin: 14, padding: 16, borderRadius: 22, border: '1px solid #e2e8f0', background: '#fff' }
const shieldPill: CSSProperties = { width: 56, height: 56, borderRadius: 18, background: '#ecfdf5', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const featureMainTitle: CSSProperties = { fontSize: 20, fontWeight: 900, color: '#0f172a' }
const featureMainSub: CSSProperties = { fontSize: 14, fontWeight: 800, color: '#64748b', marginTop: 6 }
const featureFootNote: CSSProperties = { padding: '0 16px 14px', fontSize: 13, fontWeight: 800, color: '#94a3b8' }

const onPill = (on: boolean): CSSProperties => ({
  padding: '9px 14px',
  borderRadius: 999,
  border: `2px solid ${on ? '#86efac' : '#e2e8f0'}`,
  fontWeight: 900,
  background: '#fff',
  color: on ? '#16a34a' : '#64748b',
  minWidth: 58,
  textAlign: 'center',
  fontSize: 14,
})

const iosSwitch = (on: boolean): CSSProperties => ({
  width: 66,
  height: 36,
  borderRadius: 999,
  background: on ? '#16a34a' : '#cbd5e1',
  border: '1px solid #e2e8f0',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: on ? 'flex-end' : 'flex-start',
  cursor: 'pointer',
  boxShadow: on ? '0 14px 24px rgba(22,163,74,0.28)' : 'none',
})

const iosKnob = (): CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: 999,
  background: '#fff',
  boxShadow: '0 10px 18px rgba(15,23,42,0.22)',
})

const backupCard: CSSProperties = { border: '1px solid #e2e8f0', background: '#fff', borderRadius: 18, padding: 14 }
const backupRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }
const backupTitle: CSSProperties = { fontSize: 14, fontWeight: 900, color: '#0f172a' }
const backupSub: CSSProperties = { fontSize: 12, fontWeight: 700, color: '#64748b', marginTop: 4 }
const backupToggleBox: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, border: '1px solid #e2e8f0', background: '#f8fafc' }
const backupToggleLabel: CSSProperties = { fontSize: 12, fontWeight: 900, color: '#0f172a' }

const supportToggle: CSSProperties = { width: '100%', border: '1px solid #e2e8f0', background: '#fff', borderRadius: 18, padding: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }

const supportIcon: CSSProperties = { width: 36, height: 36, borderRadius: 14, background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }
const supportTitle: CSSProperties = { fontSize: 13, fontWeight: 900, color: '#0f172a' }
const supportSub: CSSProperties = { fontSize: 11, fontWeight: 800, color: '#64748b', marginTop: 4 }

const supportCard: CSSProperties = { marginTop: 12, padding: 16, borderRadius: 18, border: '1px solid #fee2e2', background: '#fff', textAlign: 'center' }
const supportText: CSSProperties = { fontSize: 13, fontWeight: 800, color: '#64748b', marginBottom: 14 }

const waBtnStyle: CSSProperties = { width: '100%', backgroundColor: '#25d366', color: 'white', padding: '14px', borderRadius: '14px', border: 'none', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 12px 18px rgba(37,211,102,0.18)' }

export default function SettingsPage() {
  return (
    <main>
      <Suspense fallback={null}>
        <SettingsContent />
      </Suspense>
    </main>
  )
}
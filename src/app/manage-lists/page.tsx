'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast, Toaster } from 'sonner'
import { Users, Wrench, Lightbulb, User, Package, Trash2, Plus, Search } from 'lucide-react'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentRed: '#dc2626',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
}

// Rename 'worker' to 'maintenance' for consistency
type TabKey = 'suppliers' | 'maintenance' | 'utility' | 'staff' | 'other'
const TABS: Array<{
  key: TabKey
  label: string
  icon: any
  subCategory: 'Maintenance' | 'utility' | 'staff' | 'other' | null
}> = [
  { key: 'suppliers', label: 'Προμηθευτές', icon: Users, subCategory: null },
  { key: 'maintenance', label: 'Συντήρηση', icon: Wrench, subCategory: 'Maintenance' }, // Wrench icon for Συντήρηση
  { key: 'utility', label: 'Λογαριασμοί', icon: Lightbulb, subCategory: 'utility' },
  { key: 'staff', label: 'Προσωπικό', icon: User, subCategory: 'staff' },
  { key: 'other', label: 'Λοιπά', icon: Package, subCategory: 'other' },
]

function ManageListsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ✅ storeId from URL searchParams (mobile/vercel stable)
  const urlStoreId = searchParams.get('store')
  const [storeId, setStoreId] = useState<string | null>(urlStoreId)

  const [activeTab, setActiveTab] = useState<TabKey>('suppliers')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])

  const [name, setName] = useState('')
  const [search, setSearch] = useState('')

  const currentTab = useMemo(() => TABS.find(t => t.key === activeTab)!, [activeTab])

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (activeTab === 'suppliers') {
      const base = suppliers
      if (!q) return base
      return base.filter((x: any) => String(x.name || '').toLowerCase().includes(q))
    }

    const base = fixedAssets.filter((x: any) => (x.sub_category || '') === currentTab.subCategory)
    if (!q) return base
    return base.filter((x: any) => String(x.name || '').toLowerCase().includes(q))
  }, [activeTab, suppliers, fixedAssets, search, currentTab.subCategory])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return router.push('/login')
      }

      const activeStoreId =
        urlStoreId ||
        (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null)

      if (!activeStoreId) {
        setLoading(false)
        return toast.error('Δεν βρέθηκε κατάστημα (store)')
      }

      setStoreId(activeStoreId)

      const [sRes, fRes] = await Promise.all([
        supabase
          .from('suppliers')
          .select('id, name, is_active, created_at')
          .eq('store_id', activeStoreId)
          .order('name'),
        supabase
          .from('fixed_assets')
          .select('id, name, sub_category, created_at')
          .eq('store_id', activeStoreId)
          .order('name'),
      ])

      if (sRes.error) throw sRes.error
      if (fRes.error) throw fRes.error

      setSuppliers(sRes.data || [])
      setFixedAssets(fRes.data || [])
    } catch (e: any) {
      toast.error(e?.message || 'Σφάλμα φόρτωσης')
    } finally {
      setLoading(false)
    }
  }, [router, urlStoreId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAdd = async () => {
    const trimmed = name.trim()
    if (!trimmed) return toast.error('Γράψε όνομα')

    const activeStoreId =
      urlStoreId ||
      (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null) ||
      storeId

    if (!activeStoreId) return toast.error('Δεν βρέθηκε κατάστημα (store)')

    try {
      setSaving(true)

      if (activeTab === 'suppliers') {
        // ✅ Save to suppliers
        const { data, error } = await supabase
          .from('suppliers')
          .insert([{ name: trimmed, store_id: activeStoreId }])
          .select('id, name, is_active, created_at')
          .single()

        if (error) throw error
        setSuppliers(prev => [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))))
      } else {
        // ✅ Save to fixed_assets with sub_category

        // Ensure Συντήρηση always uses 'Maintenance' for sub_category
        const subCategoryToSave = activeTab === 'maintenance' ? 'Maintenance' : currentTab.subCategory;
        const { data, error } = await supabase
          .from('fixed_assets')
          .insert([{ name: trimmed, store_id: activeStoreId, sub_category: subCategoryToSave }])
          .select('id, name, sub_category, created_at')
          .single()

        if (error) throw error
        setFixedAssets(prev => [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))))
      }

      setName('')
      toast.success('Προστέθηκε!')
    } catch (e: any) {
      toast.error(e?.message || 'Αποτυχία καταχώρησης')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: any) => {
    const label = String(item?.name || '').trim()
    const ok = confirm(`Να διαγραφεί το "${label}"?`)
    if (!ok) return

    const activeStoreId =
      urlStoreId ||
      (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null) ||
      storeId

    if (!activeStoreId) return toast.error('Δεν βρέθηκε κατάστημα (store)')

    try {
      setSaving(true)

      if (activeTab === 'suppliers') {
        const { error } = await supabase
          .from('suppliers')
          .delete()
          .eq('id', item.id)
          .eq('store_id', activeStoreId)

        if (error) throw error
        setSuppliers(prev => prev.filter(x => x.id !== item.id))
      } else {
        const { error } = await supabase
          .from('fixed_assets')
          .delete()
          .eq('id', item.id)
          .eq('store_id', activeStoreId)

        if (error) throw error
        setFixedAssets(prev => prev.filter(x => x.id !== item.id))
      }

      toast.success('Διαγράφηκε!')
    } catch (e: any) {
      toast.error(e?.message || 'Αποτυχία διαγραφής')
    } finally {
      setSaving(false)
    }
  }

  const backHref = useMemo(() => {
    const s = urlStoreId || storeId || ''
    return s ? `/?store=${s}` : '/'
  }, [storeId, urlStoreId])

  return (
    <div style={pageWrap}>
      <Toaster position="top-center" richColors />

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={logoBoxStyle}>📋</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: colors.primaryDark }}>
                Manage Lists
              </h1>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: colors.secondaryText }}>
                Διαχείριση Προμηθευτών &amp; Παγίων
              </p>
            </div>
          </div>

          <Link href={backHref} style={backBtnStyle}>✕</Link>
        </div>

        {/* TABS */}
        <div style={tabsRow}>
          {TABS.map(t => {
            const ActiveIcon = t.icon
            const active = activeTab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => { setActiveTab(t.key); setSearch('') }}
                style={{
                  ...tabBtn,
                  backgroundColor: active ? colors.primaryDark : colors.white,
                  border: `1px solid ${active ? colors.primaryDark : colors.border}`,
                  color: active ? 'white' : colors.primaryDark,
                }}
              >
                <ActiveIcon size={16} />
                <span style={{ fontSize: 16, fontWeight: 900 }}>{t.label}</span>
              </button>
            )
          })}
        </div>

        <div style={card}>
          {/* ADD */}
          <label style={labelStyle}>ΝΕΑ ΚΑΤΑΧΩΡΗΣΗ</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`Όνομα για "${currentTab.label}"`}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || loading}
              style={{ ...iconBtn, opacity: saving || loading ? 0.7 : 1 }}
              aria-label="Add"
              title="Add"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* SEARCH */}
          <label style={{ ...labelStyle, marginTop: 18 }}>ΑΝΑΖΗΤΗΣΗ</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: colors.secondaryText }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Γράψτε για αναζήτηση..."
              style={{ ...inputStyle, paddingLeft: 38 }}
            />
          </div>

          {/* LIST */}
          <div style={{ marginTop: 18 }}>
            <label style={labelStyle}>ΛΙΣΤΑ</label>

            {loading ? (
              <div style={hintBox}>Φόρτωση...</div>
            ) : visibleItems.length === 0 ? (
              <div style={hintBox}>Δεν υπάρχουν εγγραφές.</div>
            ) : (
              <div style={listWrap}>
                {visibleItems.map((item: any) => (
                  <div key={item.id} style={listRow}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: colors.primaryDark }}>
                        {String(item.name || '').toUpperCase()}
                      </span>

                      {activeTab !== 'suppliers' && (
                        <span style={{ fontSize: 16, fontWeight: 800, color: colors.secondaryText }}>
                          sub_category: {String(item.sub_category === 'Maintenance' ? 'Συντήρηση' : item.sub_category || '')}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={saving}
                      style={{ ...dangerBtn, opacity: saving ? 0.6 : 1 }}
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 14, fontSize: 16, fontWeight: 800, color: colors.secondaryText }}>
          * Για ασφάλεια, η διαγραφή ζητά επιβεβαίωση.
        </div>
      </div>
    </div>
  )
}

// ✅ 16px everywhere for mobile stability
const pageWrap: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100dvh',
  padding: 20,
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  overflowY: 'auto',
  fontSize: 16,
}

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }
const logoBoxStyle: any = {
  width: 42, height: 42,
  backgroundColor: colors.primaryDark,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: 16,
  fontWeight: 900,
}

const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondaryText,
  padding: '10px 12px',
  backgroundColor: 'white',
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 900,
}

const tabsRow: any = { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }

const tabBtn: any = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 12px',
  borderRadius: 14,
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 900,
  userSelect: 'none',
}

const card: any = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: 24,
  padding: 18,
}

const labelStyle: any = {
  fontSize: 16,
  fontWeight: 900,
  color: colors.secondaryText,
  display: 'block',
  marginBottom: 8,
}

const inputStyle: any = {
  width: '100%',
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 800,
  backgroundColor: colors.bgLight,
  boxSizing: 'border-box',
  outline: 'none',
}

const iconBtn: any = {
  width: 52,
  minWidth: 52,
  height: 52,
  borderRadius: 12,
  border: 'none',
  backgroundColor: colors.primaryDark,
  color: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const hintBox: any = {
  padding: 14,
  borderRadius: 14,
  backgroundColor: colors.bgLight,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 800,
  color: colors.secondaryText,
}

const listWrap: any = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const listRow: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 14,
  borderRadius: 16,
  backgroundColor: colors.bgLight,
  border: `1px solid ${colors.border}`,
}

const dangerBtn: any = {
  width: 46,
  minWidth: 46,
  height: 46,
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  backgroundColor: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.accentRed,
}

export default function ManageListsPage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
      <ManageListsInner />
    </Suspense>
  )
}
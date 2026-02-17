'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast, Toaster } from 'sonner'
import { 
  Users, Wrench, Lightbulb, User, Package, Trash2, Plus, 
  Search, Edit2, ChevronLeft, Phone, CreditCard, Hash, Building2, TrendingUp, DollarSign 
} from 'lucide-react'

const colors = {
  primaryDark: '#0f172a',
  secondaryText: '#64748b',
  accentGreen: '#10b981',
  accentRed: '#f43f5e',
  accentBlue: '#6366f1',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  warning: '#fffbeb',
  warningText: '#92400e'
};

const BANKS = ['Εθνική Τράπεζα', 'Eurobank', 'Alpha Bank', 'Viva Wallet', 'Τράπεζα Πειραιώς'];

type TabKey = 'suppliers' | 'revenue' | 'maintenance' | 'utility' | 'staff' | 'other'

const TABS: Array<{ key: TabKey; label: string; icon: any; type: 'expense' | 'income' }> = [
  { key: 'suppliers', label: 'Προμηθευτές', icon: Users, type: 'expense' },
  { key: 'revenue', label: 'Πηγές Εσόδων', icon: DollarSign, type: 'income' }, // ✅ Η ΝΕΑ ΠΡΟΣΘΗΚΗ
  { key: 'maintenance', label: 'Συντήρηση', icon: Wrench, type: 'expense' },
  { key: 'utility', label: 'Λογαριασμοί', icon: Lightbulb, type: 'expense' },
  { key: 'staff', label: 'Προσωπικό', icon: User, type: 'expense' },
  { key: 'other', label: 'Λοιπά', icon: Package, type: 'expense' },
]

function ManageListsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlStoreId = searchParams.get('store')

  const [activeTab, setActiveTab] = useState<TabKey>('suppliers')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [data, setData] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [formData, setFormData] = useState({ name: '', phone: '', vat_number: '', bank_name: '', iban: '', rf_code: '' })
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const activeStoreId = urlStoreId || localStorage.getItem('active_store_id')
      if (!activeStoreId) return

      // Επιλογή πίνακα βάσει Tab
      const isRevenue = activeTab === 'revenue'
      const isSupplier = activeTab === 'suppliers'
      
      let res;
      if (isRevenue) {
        res = await supabase.from('revenue_sources').select('*').eq('store_id', activeStoreId).order('name')
      } else if (isSupplier) {
        res = await supabase.from('suppliers').select('*').eq('store_id', activeStoreId).order('name')
      } else {
        const subCat = activeTab === 'maintenance' ? 'Maintenance' : activeTab === 'utility' ? 'utility' : activeTab === 'staff' ? 'staff' : 'other'
        res = await supabase.from('fixed_assets').select('*').eq('store_id', activeStoreId).eq('sub_category', subCat).order('name')
      }

      const tRes = await supabase.from('transactions').select('amount, supplier_id, fixed_asset_id, revenue_source_id').eq('store_id', activeStoreId)

      setData(res.data || [])
      setTransactions(tRes.data || [])
    } catch (e) {
      toast.error('Σφάλμα φόρτωσης')
    } finally {
      setLoading(false)
    }
  }, [urlStoreId, activeTab])

  useEffect(() => { loadData() }, [loadData])

  // Υπολογισμός Τζίρου ανά οντότητα
  const turnoverTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    transactions.forEach(t => {
      const id = t.supplier_id || t.fixed_asset_id || t.revenue_source_id
      if (id) totals[id] = (totals[id] || 0) + Math.abs(Number(t.amount))
    });
    return totals
  }, [transactions])

  const handleSave = async () => {
    if (!formData.name.trim()) return toast.error('Το όνομα είναι υποχρεωτικό')
    const activeStoreId = urlStoreId || localStorage.getItem('active_store_id')
    
    try {
      const isRevenue = activeTab === 'revenue'
      const isSupplier = activeTab === 'suppliers'
      const table = isRevenue ? 'revenue_sources' : isSupplier ? 'suppliers' : 'fixed_assets'
      
      const payload: any = {
        name: formData.name.trim().toUpperCase(),
        phone: formData.phone,
        vat_number: formData.vat_number,
        bank_name: formData.bank_name,
        iban: formData.iban.toUpperCase(),
        rf_code: formData.rf_code,
        store_id: activeStoreId
      }

      if (!isRevenue && !isSupplier) {
        payload.sub_category = activeTab === 'maintenance' ? 'Maintenance' : activeTab === 'utility' ? 'utility' : activeTab === 'staff' ? 'staff' : 'other'
      }

      const { error } = editingId 
        ? await supabase.from(table).update(payload).eq('id', editingId)
        : await supabase.from(table).insert([payload])

      if (error) throw error
      toast.success('Αποθηκεύτηκε!')
      setIsFormOpen(false); setEditingId(null);
      setFormData({ name: '', phone: '', vat_number: '', bank_name: '', iban: '', rf_code: '' })
      loadData()
    } catch (e: any) { toast.error(e.message) }
  }

  const sortedData = useMemo(() => {
    return data
      .filter(x => x.name?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (turnoverTotals[b.id] || 0) - (turnoverTotals[a.id] || 0))
  }, [data, search, turnoverTotals])

  return (
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />
      <div style={contentWrapper}>
        <header style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Διαχείριση Λιστών</h1>
            <p style={subtitleStyle}>ΟΡΓΑΝΩΣΗ ΕΣΟΔΩΝ & ΕΞΟΔΩΝ</p>
          </div>
          <Link href={`/?store=${urlStoreId}`} style={closeBtn}><ChevronLeft size={20} /></Link>
        </header>

        {/* TABS SELECTOR */}
        <div style={tabsRow}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setExpandedId(null); setIsFormOpen(false) }} style={{
              ...tabBtn,
              backgroundColor: activeTab === t.key ? (t.type === 'income' ? colors.accentGreen : colors.primaryDark) : 'white',
              color: activeTab === t.key ? 'white' : colors.primaryDark
            }}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        <button onClick={() => setIsFormOpen(!isFormOpen)} style={isFormOpen ? cancelBtn : addBtn}>
          {isFormOpen ? 'ΑΚΥΡΩΣΗ' : <><Plus size={16} /> ΝΕΑ ΕΓΓΡΑΦΗ</>}
        </button>

        {isFormOpen && (
          <div style={formCard}>
            <div style={inputGroup}>
              <label style={labelStyle}>ΟΝΟΜΑ / ΕΠΩΝΥΜΙΑ</label>
              <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={inputStyle} placeholder="..." />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={inputGroup}><label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label><input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={inputStyle} /></div>
              <div style={inputGroup}><label style={labelStyle}>ΑΦΜ</label><input value={formData.vat_number} onChange={e => setFormData({...formData, vat_number: e.target.value})} style={inputStyle} /></div>
            </div>

            {activeTab === 'utility' && (
              <div style={inputGroup}><label style={labelStyle}>ΚΩΔΙΚΟΣ RF</label><input value={formData.rf_code} onChange={e => setFormData({...formData, rf_code: e.target.value})} style={inputStyle} /></div>
            )}

            <div style={inputGroup}>
              <label style={labelStyle}>ΤΡΑΠΕΖΑ</label>
              <select value={formData.bank_name} onChange={e => setFormData({...formData, bank_name: e.target.value})} style={inputStyle}>
                <option value="">Επιλέξτε...</option>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div style={inputGroup}><label style={labelStyle}>IBAN</label><input value={formData.iban} onChange={e => setFormData({...formData, iban: e.target.value})} style={inputStyle} placeholder="GR..." /></div>

            <button onClick={handleSave} style={{...saveBtn, backgroundColor: TABS.find(t=>t.key===activeTab)?.type === 'income' ? colors.accentGreen : colors.primaryDark}}>
              {editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΚΑΤΑΧΩΡΗΣΗ'}
            </button>
          </div>
        )}

        <div style={listArea}>
          <div style={rankingHeader}><TrendingUp size={14} /> ΚΑΤΑΤΑΞΗ ΒΑΣΕΙ ΚΙΝΗΣΗΣ</div>
          <div style={{padding: '0 15px'}}><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Αναζήτηση..." style={searchField} /></div>
          
          {loading ? <p style={emptyText}>Φόρτωση...</p> : sortedData.map((s, idx) => (
            <div key={s.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <div style={rowWrapper} onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                <div style={rankNumber}>{idx + 1}</div>
                <div style={{ flex: 1 }}>
                  <p style={rowName}>{s.name.toUpperCase()}</p>
                  <p style={categoryBadge}>{s.bank_name || 'ΜΕΤΡΗΤΑ'} {s.rf_code ? `| RF: ${s.rf_code}` : ''}</p>
                </div>
                <div style={{ textAlign: 'right' }}><p style={turnoverText}>{(turnoverTotals[s.id] || 0).toFixed(2)}€</p></div>
              </div>
              {expandedId === s.id && (
                <div style={actionPanel}>
                  <div style={infoGrid}>
                    <p style={infoText}><strong>IBAN:</strong> {s.iban || '-'}</p>
                    <p style={infoText}><strong>ΑΦΜ:</strong> {s.vat_number || '-'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={() => { setEditingId(s.id); setFormData(s); setIsFormOpen(true); }} style={editBtn}><Edit2 size={14} /> Διόρθωση</button>
                    <button onClick={() => {}} style={delBtn}><Trash2 size={14} /> Διαγραφή</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// STYLES
const containerStyle: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px' };
const contentWrapper: any = { maxWidth: '480px', margin: '0 auto', paddingBottom: '120px' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const titleStyle: any = { fontSize: '22px', fontWeight: '800', color: colors.primaryDark, margin: 0 };
const subtitleStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginTop: '4px' };
const tabsRow: any = { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: '12px', marginBottom: '15px' };
const tabBtn: any = { padding: '10px 14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' };
const closeBtn: any = { padding: '8px', background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, color: colors.primaryDark, display: 'flex' };
const addBtn: any = { width: '100%', backgroundColor: colors.primaryDark, color: 'white', padding: '16px', borderRadius: '16px', fontWeight: '800', border: 'none', marginBottom: '20px', cursor: 'pointer' };
const cancelBtn: any = { ...addBtn, backgroundColor: '#fee2e2', color: colors.accentRed };
const formCard: any = { background: 'white', padding: '24px', borderRadius: '24px', marginBottom: '25px', border: `1px solid ${colors.border}` };
const inputGroup: any = { marginBottom: '15px' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '6px', display: 'block' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '16px', fontWeight: '600', backgroundColor: colors.bgLight };
const searchField: any = { ...inputStyle, marginBottom: '10px' };
const saveBtn: any = { width: '100%', padding: '16px', color: 'white', borderRadius: '16px', border: 'none', fontWeight: '800', cursor: 'pointer' };
const listArea: any = { background: 'white', borderRadius: '24px', border: `1px solid ${colors.border}`, overflow: 'hidden' };
const rankingHeader: any = { padding: '14px 20px', backgroundColor: colors.bgLight, fontSize: '10px', fontWeight: '800', color: colors.secondaryText, display: 'flex', alignItems: 'center', gap: '8px' };
const rowWrapper: any = { display: 'flex', padding: '18px 20px', alignItems: 'center', cursor: 'pointer' };
const rankNumber: any = { width: '30px', fontWeight: '800', color: colors.secondaryText };
const rowName: any = { fontSize: '15px', fontWeight: '800', margin: 0, color: colors.primaryDark };
const categoryBadge: any = { fontSize: '10px', fontWeight: '700', color: colors.secondaryText, margin: 0 };
const turnoverText: any = { fontSize: '16px', fontWeight: '800', color: colors.accentGreen };
const actionPanel: any = { padding: '20px', backgroundColor: '#fcfcfc', borderTop: `1px dashed ${colors.border}` };
const infoGrid: any = { display: 'grid', gap: '8px' };
const infoText: any = { fontSize: '12px', margin: 0, color: colors.primaryDark };
const editBtn: any = { flex: 1, padding: '10px', background: colors.warning, color: colors.warningText, border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' };
const delBtn: any = { flex: 1, padding: '10px', background: '#fee2e2', color: colors.accentRed, border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' };
const emptyText: any = { padding: '40px', textAlign: 'center', color: colors.secondaryText };

export default function ManageListsPage() {
  return <Suspense fallback={null}><ManageListsInner /></Suspense>
}
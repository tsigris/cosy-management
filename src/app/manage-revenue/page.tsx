'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast, Toaster } from 'sonner'
import { 
  TrendingUp, Plus, Edit2, ChevronLeft, Phone, CreditCard, Hash, Building2, Wallet, Trash2 
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

function ManageRevenueContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlStoreId = searchParams.get('store')

  const [sources, setSources] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: '', phone: '', vat_number: '', bank_name: '', iban: ''
  })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      if (!urlStoreId) return

      const [sRes, tRes] = await Promise.all([
        supabase.from('revenue_sources').select('*').eq('store_id', urlStoreId).order('name'),
        supabase.from('transactions').select('amount, revenue_source_id').eq('store_id', urlStoreId).eq('type', 'income')
      ])

      setSources(sRes.data || [])
      setTransactions(tRes.data || [])
    } catch (e) {
      toast.error('Σφάλμα συγχρονισμού')
    } finally {
      setLoading(false)
    }
  }, [urlStoreId])

  useEffect(() => { loadData() }, [loadData])

  const revenueTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.revenue_source_id) {
        totals[t.revenue_source_id] = (totals[t.revenue_source_id] || 0) + Math.abs(Number(t.amount));
      }
    });
    return totals;
  }, [transactions]);

  const sortedSources = useMemo(() => {
    return [...sources].sort((a, b) => (revenueTotals[b.id] || 0) - (revenueTotals[a.id] || 0));
  }, [sources, revenueTotals]);

  const handleSave = async () => {
    if (!formData.name.trim()) return toast.error('Συμπληρώστε το όνομα της πηγής')
    setIsSaving(true)
    try {
      const payload = {
        name: formData.name.trim().toUpperCase(),
        phone: formData.phone,
        vat_number: formData.vat_number,
        bank_name: formData.bank_name,
        iban: formData.iban.toUpperCase(),
        store_id: urlStoreId
      }

      const { error } = editingId 
        ? await supabase.from('revenue_sources').update(payload).eq('id', editingId)
        : await supabase.from('revenue_sources').insert([payload])

      if (error) throw error
      toast.success('Η πηγή εσόδου αποθηκεύτηκε');
      setIsFormOpen(false); setEditingId(null);
      setFormData({ name: '', phone: '', vat_number: '', bank_name: '', iban: '' });
      loadData();
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Διαγραφή αυτής της πηγής εσόδου;')) return;
    try {
      const { error } = await supabase.from('revenue_sources').delete().eq('id', id);
      if (error) throw error;
      toast.success('Διαγράφηκε');
      loadData();
    } catch (e) { toast.error('Σφάλμα διαγραφής'); }
  }

  return (
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />
      <div style={contentWrapper}>
        <header style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Πηγές Εσόδων</h1>
            <p style={subtitleStyle}>MANAGEMENT & CRM</p>
          </div>
          <Link href={`/?store=${urlStoreId}`} style={closeBtn}><ChevronLeft size={20} /></Link>
        </header>

        <button onClick={() => setIsFormOpen(!isFormOpen)} style={isFormOpen ? cancelBtn : addBtn}>
          {isFormOpen ? 'ΑΚΥΡΩΣΗ' : <><Plus size={16} /> ΝΕΑ ΠΗΓΗ ΕΣΟΔΟΥ</>}
        </button>

        {isFormOpen && (
          <div style={formCard}>
            <div style={inputGroup}>
              <label style={labelStyle}><Hash size={12} /> ΟΝΟΜΑ (π.χ. AIRBNB, BOOKING)</label>
              <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={inputStyle} placeholder="Όνομα πηγής..." />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={inputGroup}>
                <label style={labelStyle}><Phone size={12} /> ΤΗΛΕΦΩΝΟ</label>
                <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={inputStyle} />
              </div>
              <div style={inputGroup}>
                <label style={labelStyle}><Tag size={12} /> ΑΦΜ</label>
                <input value={formData.vat_number} onChange={e => setFormData({...formData, vat_number: e.target.value})} style={inputStyle} />
              </div>
            </div>

            <div style={inputGroup}>
              <label style={labelStyle}><Building2 size={12} /> ΤΡΑΠΕΖΑ ΚΑΤΑΘΕΣΗΣ</label>
              <select value={formData.bank_name} onChange={e => setFormData({...formData, bank_name: e.target.value})} style={inputStyle}>
                <option value="">Επιλέξτε Τράπεζα...</option>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div style={inputGroup}>
              <label style={labelStyle}><CreditCard size={12} /> IBAN</label>
              <input value={formData.iban} onChange={e => setFormData({...formData, iban: e.target.value})} style={inputStyle} placeholder="GR..." />
            </div>

            <button onClick={handleSave} disabled={isSaving} style={saveBtn}>
              {isSaving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΚΑΤΑΧΩΡΗΣΗ')}
            </button>
          </div>
        )}

        <div style={listArea}>
          <div style={rankingHeader}><TrendingUp size={14} /> ΚΑΤΑΤΑΞΗ ΒΑΣΕΙ ΕΣΟΔΩΝ</div>
          {loading ? <p style={emptyText}>Φόρτωση...</p> : sortedSources.map((s, idx) => (
            <div key={s.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <div style={rowWrapper} onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                <div style={rankNumber}>{idx + 1}</div>
                <div style={{ flex: 1 }}>
                  <p style={rowName}>{s.name.toUpperCase()}</p>
                  <p style={categoryBadge}>{s.bank_name || 'ΜΕΤΡΗΤΑ'} {s.vat_number ? `| ΑΦΜ: ${s.vat_number}` : ''}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={turnoverText}>{(revenueTotals[s.id] || 0).toFixed(2)}€</p>
                </div>
              </div>
              {expandedId === s.id && (
                <div style={actionPanel}>
                  <div style={infoGrid}>
                    <p style={infoText}><strong>IBAN:</strong> {s.iban || '-'}</p>
                    <p style={infoText}><strong>Τηλ:</strong> {s.phone || '-'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={() => { setEditingId(s.id); setFormData(s); setIsFormOpen(true); }} style={editBtn}><Edit2 size={14} /> Διόρθωση</button>
                    <button onClick={() => handleDelete(s.id)} style={delBtn}><Trash2 size={14} /> Διαγραφή</button>
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

// Χρησιμοποίησε τα ίδια styles από το προηγούμενο Suppliers page...
const containerStyle: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px' };
const contentWrapper: any = { maxWidth: '480px', margin: '0 auto', paddingBottom: '120px' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const titleStyle: any = { fontSize: '22px', fontWeight: '800', color: colors.primaryDark, margin: 0 };
const subtitleStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginTop: '4px' };
const closeBtn: any = { padding: '8px', background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, color: colors.primaryDark, textDecoration: 'none', display: 'flex' };
const addBtn: any = { width: '100%', backgroundColor: colors.primaryDark, color: 'white', padding: '16px', borderRadius: '16px', fontWeight: '800', border: 'none', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const cancelBtn: any = { ...addBtn, backgroundColor: '#fee2e2', color: colors.accentRed };
const formCard: any = { background: 'white', padding: '24px', borderRadius: '24px', marginBottom: '25px', border: `1px solid ${colors.border}` };
const inputGroup: any = { marginBottom: '15px' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '16px', fontWeight: '600', backgroundColor: colors.bgLight };
const saveBtn: any = { width: '100%', padding: '16px', backgroundColor: colors.accentGreen, color: 'white', borderRadius: '16px', border: 'none', fontWeight: '800' };
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
const Tag = ({size, className}: any) => <Hash size={size} />;

export default function ManageRevenuePage() {
  return <Suspense fallback={null}><ManageRevenueContent /></Suspense>
}
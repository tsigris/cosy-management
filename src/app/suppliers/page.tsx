'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation' // Προσθήκη useRouter
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, TrendingUp, Phone, CreditCard, Hash, Tag, Trash2, Edit2, X, ChevronLeft } from 'lucide-react'
import { toast, Toaster } from 'sonner'

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

function SuppliersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // 1. ΤΟ ΚΛΕΙΔΙ: Παίρνουμε το ID από το URL
  const storeIdFromUrl = searchParams.get('store');

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentStoreName, setCurrentStoreName] = useState('Φορτώνει...')

  // Φόρμα Προμηθευτή
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [afm, setAfm] = useState('') 
  const [iban, setIban] = useState('')
  const [category, setCategory] = useState('Εμπορεύματα')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const fetchSuppliersData = useCallback(async () => {
    // Αν δεν υπάρχει ID στο URL, γυρνάμε στην επιλογή
    if (!storeIdFromUrl) {
      toast.error('Δεν βρέθηκε κατάστημα στο URL');
      router.push('/select-store');
      return;
    }

    try {
      setLoading(true)
      
      // Λήψη ονόματος καταστήματος βάσει URL ID
      const { data: storeInfo } = await supabase.from('stores').select('name').eq('id', storeIdFromUrl).single();
      if (storeInfo) setCurrentStoreName(storeInfo.name);

      const [sRes, tRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('store_id', storeIdFromUrl),
        supabase.from('transactions').select('amount, supplier_id').eq('store_id', storeIdFromUrl)
      ]);

      if (sRes.error) throw sRes.error;
      setSuppliers(sRes.data || []);
      setTransactions(tRes.data || []);
    } catch (err: any) {
      toast.error('Σφάλμα φόρτωσης');
    } finally {
      setLoading(false);
    }
  }, [storeIdFromUrl, router])

  useEffect(() => { 
    fetchSuppliersData();
  }, [fetchSuppliersData])

  const resetForm = () => {
    setName(''); setPhone(''); setAfm(''); setIban(''); setCategory('Εμπορεύματα');
    setEditingId(null); setIsFormOpen(false);
  }

  const handleEdit = (s: any) => {
    setName(s.name);
    setPhone(s.phone || '');
    setAfm(s.vat_number || '');
    setIban(s.iban || '');
    setCategory(s.category || 'Εμπορεύματα');
    setEditingId(s.id);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Οριστική διαγραφή προμηθευτή;')) return;
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      toast.success('Ο προμηθευτής διαγράφηκε');
      fetchSuppliersData();
    } catch (err: any) {
      toast.error('Σφάλμα κατά τη διαγραφή');
    }
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Συμπληρώστε το όνομα');
    // Χρησιμοποιούμε ΠΑΝΤΑ το ID από το URL για την αποθήκευση
    if (!storeIdFromUrl) return toast.error('Σφάλμα ID καταστήματος');

    setIsSaving(true);
    try {
      const supplierData = {
        name: name.trim(),
        phone: phone.trim(),
        vat_number: afm.trim(),
        iban: iban.trim(),
        category: category,
        store_id: storeIdFromUrl // ΕΔΩ ΕΙΝΑΙ Η ΑΣΦΑΛΕΙΑ
      };

      const { error } = editingId
        ? await supabase.from('suppliers').update(supplierData).eq('id', editingId)
        : await supabase.from('suppliers').insert([{ ...supplierData, is_active: true }]);

      if (error) throw error;
      
      toast.success(editingId ? 'Ενημερώθηκε!' : 'Καταχωρήθηκε επιτυχώς!');
      resetForm(); 
      fetchSuppliersData();
    } catch (error: any) { 
      toast.error(error.message); 
    } finally { 
      setIsSaving(false); 
    }
  }

  const getSupplierTurnover = (id: string) => transactions.filter(t => t.supplier_id === id).reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const sortedSuppliers = [...suppliers].sort((a, b) => getSupplierTurnover(b.id) - getSupplierTurnover(a.id));

  if (loading) return <div style={loadingStyle}>ΣΥΓΧΡΟΝΙΣΜΟΣ {currentStoreName.toUpperCase()}...</div>

  return (
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />
      <div style={contentWrapper}>
        
        <header style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Προμηθευτές</h1>
            <p style={subtitleStyle}>ΕΝΕΡΓΟ: <span style={{color: colors.accentBlue}}>{currentStoreName.toUpperCase()}</span></p>
          </div>
          {/* Επιστροφή στο Dashboard διατηρώντας το ID στο URL */}
          <Link href={`/?store=${storeIdFromUrl}`} style={closeBtn}><ChevronLeft size={20} /></Link>
        </header>

        <button onClick={() => { editingId ? resetForm() : setIsFormOpen(!isFormOpen) }} style={isFormOpen ? cancelBtn : addBtn}>
          {isFormOpen ? 'ΑΚΥΡΩΣΗ' : <><Plus size={16} /> ΝΕΟΣ ΠΡΟΜΗΘΕΥΤΗΣ</>}
        </button>

        {isFormOpen && (
          <div style={formCard}>
            <div style={inputGroup}>
              <label style={labelStyle}><Hash size={12} /> ΕΠΩΝΥΜΙΑ / ΟΝΟΜΑ</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="π.χ. COCA COLA" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={inputGroup}>
                <label style={labelStyle}><Phone size={12} /> ΤΗΛΕΦΩΝΟ</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="210..." />
              </div>
              <div style={inputGroup}>
                <label style={labelStyle}><Tag size={12} /> ΑΦΜ</label>
                <input value={afm} onChange={(e) => setAfm(e.target.value)} style={inputStyle} placeholder="000000000" />
              </div>
            </div>

            <div style={inputGroup}>
              <label style={labelStyle}><CreditCard size={12} /> IBAN</label>
              <input value={iban} onChange={(e) => setIban(e.target.value)} style={inputStyle} placeholder="GR..." />
            </div>

            <div style={inputGroup}>
              <label style={labelStyle}>ΚΑΤΗΓΟΡΙΑ</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                <option value="Εμπορεύματα">Εμπορεύματα</option>
                <option value="Αναλώσιμα">Αναλώσιμα</option>
                <option value="Υπηρεσίες">Υπηρεσίες</option>
                <option value="Άλλο">Άλλο</option>
              </select>
            </div>

            <button onClick={handleSave} disabled={isSaving} style={saveBtn}>
              {isSaving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : (editingId ? 'ΑΠΟΘΗΚΕΥΣΗ ΑΛΛΑΓΩΝ' : 'ΚΑΤΑΧΩΡΗΣΗ')}
            </button>
          </div>
        )}

        <div style={listArea}>
          <div style={rankingHeader}><TrendingUp size={14} /> ΚΑΤΑΤΑΞΗ ΤΖΙΡΟΥ ({currentStoreName})</div>
          {sortedSuppliers.length === 0 ? (
            <p style={emptyText}>Δεν βρέθηκαν προμηθευτές στο {currentStoreName}</p>
          ) : (
            sortedSuppliers.map((s, idx) => (
              <div key={s.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                <div style={rowWrapper} onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                  <div style={rankNumber}>{idx + 1}</div>
                  <div style={{ flex: 1 }}>
                    <p style={rowName}>{s.name.toUpperCase()}</p>
                    <p style={categoryBadge}>{s.category}</p>
                  </div>
                  <p style={turnoverText}>{getSupplierTurnover(s.id).toFixed(2)}€</p>
                </div>

                {expandedId === s.id && (
                  <div style={actionPanel}>
                    <div style={infoGrid}>
                      <p style={infoText}><strong>Τηλ:</strong> {s.phone || '-'}</p>
                      <p style={infoText}><strong>ΑΦΜ:</strong> {s.vat_number || '-'}</p>
                      <p style={infoText}><strong style={{display:'block'}}>IBAN:</strong> {s.iban || '-'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button onClick={() => handleEdit(s)} style={editBtn}><Edit2 size={14} /> Επεξεργασία</button>
                      <button onClick={() => handleDelete(s.id)} style={delBtn}><Trash2 size={14} /> Διαγραφή</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// --- STYLES (Πλήρη) ---
const containerStyle: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', fontFamily: 'inherit' };
const contentWrapper: any = { maxWidth: '480px', margin: '0 auto' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const titleStyle: any = { fontSize: '22px', fontWeight: '800', color: colors.primaryDark, margin: 0 };
const subtitleStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginTop: '4px' };
const closeBtn: any = { padding: '8px', background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, color: colors.primaryDark, textDecoration: 'none', display:'flex', alignItems:'center' };
const addBtn: any = { width: '100%', backgroundColor: colors.primaryDark, color: 'white', padding: '16px', borderRadius: '16px', fontWeight: '800', border: 'none', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' };
const cancelBtn: any = { ...addBtn, backgroundColor: '#fee2e2', color: colors.accentRed };
const formCard: any = { background: 'white', padding: '24px', borderRadius: '24px', marginBottom: '25px', border: `1px solid ${colors.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' };
const inputGroup: any = { marginBottom: '15px' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '14px', fontWeight: '600', outline: 'none', backgroundColor: colors.bgLight };
const saveBtn: any = { width: '100%', padding: '16px', backgroundColor: colors.accentGreen, color: 'white', borderRadius: '16px', border: 'none', fontWeight: '800', fontSize: '14px', cursor: 'pointer', marginTop: '10px' };
const listArea: any = { background: 'white', borderRadius: '24px', border: `1px solid ${colors.border}`, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' };
const rankingHeader: any = { padding: '14px 20px', backgroundColor: colors.bgLight, fontSize: '10px', fontWeight: '800', color: colors.secondaryText, display: 'flex', alignItems: 'center', gap: '8px' };
const rowWrapper: any = { display: 'flex', padding: '18px 20px', alignItems: 'center', cursor: 'pointer' };
const rankNumber: any = { width: '30px', fontWeight: '800', color: colors.secondaryText, fontSize: '14px' };
const rowName: any = { fontSize: '15px', fontWeight: '800', margin: 0, color: colors.primaryDark };
const categoryBadge: any = { fontSize: '10px', fontWeight: '700', color: colors.secondaryText, margin: 0 };
const turnoverText: any = { fontSize: '16px', fontWeight: '800', color: colors.accentGreen };
const actionPanel: any = { padding: '20px', backgroundColor: '#fcfcfc', borderTop: `1px dashed ${colors.border}` };
const infoGrid: any = { display: 'grid', gap: '8px' };
const infoText: any = { fontSize: '12px', margin: 0, color: colors.primaryDark };
const editBtn: any = { flex: 1, padding: '10px', background: colors.warning, color: colors.warningText, border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' };
const delBtn: any = { flex: 1, padding: '10px', background: '#fee2e2', color: colors.accentRed, border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer' };
const loadingStyle: any = { display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: colors.secondaryText, letterSpacing: '1px', background: colors.bgLight };
const emptyText: any = { padding: '40px', textAlign: 'center', color: colors.secondaryText, fontSize: '13px', fontWeight: '600' };

export default function SuppliersPage() {
  return <main><Suspense fallback={null}><SuppliersContent /></Suspense></main>
}
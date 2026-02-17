'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { toast, Toaster } from 'sonner';
import { Camera, X, Plus, Search, Landmark, Banknote, Factory, Building2 } from 'lucide-react';
import { Suspense } from 'react';

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentRed: '#dc2626',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  warning: '#fffbeb',
  warningText: '#92400e',
};

// --- MODAL ΓΙΑ ΝΕΟ ΠΡΟΜΗΘΕΥΤΗ ---
function SupplierFormModal({ open, onClose, onCreated, storeId }: { open: boolean, onClose: () => void, onCreated: (supplier: any) => void, storeId: string }) {
  const [name, setName] = useState('');
  const [afm, setAfm] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Όνομα υποχρεωτικό');
    setLoading(true);
    try {
      const { data, error } = await supabase.from('suppliers').insert([
        {
          name: name.trim().toUpperCase(),
          vat_number: afm.trim() || null,
          phone: phone.trim() || null,
          store_id: storeId,
          is_active: true
        }
      ]).select().single();
      if (error) throw error;
      toast.success('Ο προμηθευτής δημιουργήθηκε!');
      onCreated(data);
      onClose();
      setName(''); setAfm(''); setPhone('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div style={modalOverlay}>
      <div style={modalCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Νέος Προμηθευτής</h2>
          <button onClick={onClose} style={modalCloseBtn}><X size={18} /></button>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Όνομα *" style={inputStyle} autoFocus />
        <input value={afm} onChange={e => setAfm(e.target.value)} placeholder="ΑΦΜ" style={{ ...inputStyle, marginTop: 10 }} />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Τηλέφωνο" style={{ ...inputStyle, marginTop: 10 }} />
        <button onClick={handleCreate} disabled={loading} style={{ ...smartSaveBtn, backgroundColor: colors.accentGreen, marginTop: 18 }}>
          {loading ? 'Αποθήκευση...' : 'Αποθήκευση'}
        </button>
      </div>
    </div>
  );
}

// --- ΚΥΡΙΑ ΦΟΡΜΑ ΕΞΟΔΟΥ ---
function AddExpenseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const storeId = searchParams.get('store') || '';
  const editId = searchParams.get('editId');
  const urlSupId = searchParams.get('supId');
  const urlAssetId = searchParams.get('assetId');
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Μετρητά');
  const [notes, setNotes] = useState('');
  const [isCredit, setIsCredit] = useState(false);
  const [isAgainstDebt, setIsAgainstDebt] = useState(searchParams.get('mode') === 'debt');
  const [noInvoice, setNoInvoice] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState('Χρήστης');
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [fixedAssets, setFixedAssets] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  // --- ΝΕΟ: Ημερήσια στατιστικά ---
  const [dayStats, setDayStats] = useState<{ income: number; expenses: number }>({ income: 0, expenses: 0 });

  useEffect(() => {
    if (!storeId || storeId === 'null') {
      router.replace('/select-store');
      return;
    }
  }, [storeId, router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadFormData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      const { data: profile } = await supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle();
      if (profile) setCurrentUsername(profile.username || 'Admin');

      const { data: sData } = await supabase.from('suppliers').select('id, name').eq('store_id', storeId).order('name');
      const { data: fData } = await supabase.from('fixed_assets').select('id, name').eq('store_id', storeId).order('name');
      // --- Φέρε όλες τις συναλλαγές της ημέρας για το storeId ---
      const { data: txs } = await supabase
        .from('transactions')
        .select('amount, type, is_credit')
        .eq('store_id', storeId)
        .eq('date', selectedDate);
      let income = 0, expenses = 0;
      if (txs) {
        for (const t of txs) {
          if (t.type === 'income') income += Math.abs(Number(t.amount)) || 0;
          else expenses += Math.abs(Number(t.amount)) || 0;
        }
      }
      setDayStats({ income, expenses });

      console.log("DEBUG_SUPPLIERS:", sData);
      setSuppliers(sData || []);
      setFixedAssets(fData || []);

      if (editId) {
        const { data: tx } = await supabase.from('transactions').select('*').eq('id', editId).maybeSingle();
        if (tx) {
          setAmount(Math.abs(tx.amount).toString());
          setMethod(tx.method);
          setNotes(tx.notes || '');
          setIsCredit(tx.is_credit || false);
          setIsAgainstDebt(tx.type === 'debt_payment');
          setSelectedSup(tx.supplier_id || '');
          setSelectedFixed(tx.fixed_asset_id || '');
          if (tx.supplier_id && sData) {
            const found = sData.find(s => s.id === tx.supplier_id);
            if (found) setSearchTerm(found.name);
          }
        }
      } else {
        if (urlAssetId) setSelectedFixed(urlAssetId);
        if (urlSupId && sData) {
          const found = sData.find(s => s.id === urlSupId);
          if (found) { setSearchTerm(found.name); setSelectedSup(found.id); }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [storeId, editId, urlAssetId, urlSupId, router, selectedDate]);

  useEffect(() => { loadFormData(); }, [loadFormData]);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return toast.error('Συμπληρώστε το ποσό');
    if (!selectedSup && !selectedFixed) return toast.error('Επιλέξτε Προμηθευτή ή Πάγιο');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      let invoice_image = undefined;
      // --- IMAGE STORAGE ---
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${storeId}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('invoices').upload(filePath, imageFile);
        if (uploadError) throw uploadError;
        invoice_image = filePath;
      }
      const payload: any = {
        amount: Math.abs(Number(amount)),
        method: isCredit ? 'Πίστωση' : method,
        is_credit: isCredit,
        type: isAgainstDebt ? 'debt_payment' : 'expense',
        date: selectedDate,
        user_id: session?.user.id,
        store_id: storeId,
        supplier_id: selectedSup || null,
        fixed_asset_id: selectedFixed || null,
        category: isAgainstDebt ? 'Εξόφληση Χρέους' : (selectedFixed ? 'Πάγια' : 'Εμπορεύματα'),
        created_by_name: currentUsername,
        notes: noInvoice ? (notes ? `${notes} (ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ)` : 'ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ') : notes,
        invoice_image
      };

      const { error } = editId ? await supabase.from('transactions').update(payload).eq('id', editId) : await supabase.from('transactions').insert([payload]);
      if (error) throw error;

      toast.success('Επιτυχής καταχώρηση!');
      router.refresh();
      router.push(`/?date=${selectedDate}&store=${storeId}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierSelect = (id: string) => {
    setSelectedSup(id);
    setSelectedFixed('');
    const sup = suppliers.find(s => s.id === id);
    setSearchTerm(sup ? sup.name : '');
    setShowDropdown(false);
  };

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return [];
    return suppliers.filter((s) => s.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, suppliers]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <SupplierFormModal
        open={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onCreated={sup => {
          setSuppliers(prev => [...prev, sup]);
          handleSupplierSelect(sup.id);
        }}
        storeId={storeId}
      />

      <div style={{ maxWidth: 500, margin: '0 auto', paddingBottom: 120 }}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <div style={logoBoxStyle}>💸</div>
            <div>
              <h1 style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>{editId ? 'Διόρθωση' : 'Έξοδο'}</h1>
              <p style={{ margin: 0, fontSize: 11, color: colors.secondaryText, fontWeight: 700 }}>
                {new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' }).toUpperCase()}
              </p>
            </div>
          </div>
          <Link href={`/?store=${storeId}&date=${selectedDate}`} style={backBtnStyle}><X size={20} /></Link>
        </div>

        <div style={formCard}>
          <div onClick={() => setNoInvoice(!noInvoice)} style={{ ...noInvoiceToggle, backgroundColor: noInvoice ? colors.warning : colors.bgLight, border: `1px solid ${noInvoice ? colors.accentRed : colors.border}` }}>
            <div style={{ ...checkboxBox, backgroundColor: noInvoice ? colors.accentRed : 'white', border: `2px solid ${noInvoice ? colors.accentRed : colors.secondaryText}` }}>{noInvoice && '✓'}</div>
            <span style={{ fontSize: 13, fontWeight: 800, color: noInvoice ? colors.accentRed : colors.primaryDark }}>ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ</span>
          </div>

          <label style={labelStyle}>ΠΟΣΟ (€)</label>
          <input type="number" inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />

          {/* UI BUTTONS: Μετρητά / Τράπεζα */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => { setMethod('Μετρητά'); setIsCredit(false); }}
              style={{
                ...methodBtn,
                backgroundColor: method === 'Μετρητά' && !isCredit ? colors.primaryDark : colors.white,
                color: method === 'Μετρητά' && !isCredit ? 'white' : colors.secondaryText,
              }}
            >
              <Banknote size={16} /> Μετρητά
            </button>
            <button
              type="button"
              onClick={() => { setMethod('Τράπεζα'); setIsCredit(false); }}
              style={{
                ...methodBtn,
                backgroundColor: method === 'Τράπεζα' && !isCredit ? colors.primaryDark : colors.white,
                color: method === 'Τράπεζα' && !isCredit ? 'white' : colors.secondaryText,
              }}
            >
              <Landmark size={16} /> Τράπεζα
            </button>
          </div>

          <div style={creditPanel}>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={isCredit} onChange={e => { setIsCredit(e.target.checked); if (e.target.checked) setIsAgainstDebt(false); }} id="credit" style={checkboxStyle} />
              <label htmlFor="credit" style={checkLabel}>ΕΠΙ ΠΙΣΤΩΣΕΙ (ΝΕΟ ΧΡΕΟΣ)</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={isAgainstDebt} onChange={e => { setIsAgainstDebt(e.target.checked); if (e.target.checked) setIsCredit(false); }} id="against" style={checkboxStyle} />
              <label htmlFor="against" style={{ ...checkLabel, color: isAgainstDebt ? colors.accentBlue : colors.primaryDark }}>ΕΝΑΝΤΙ ΠΑΛΑΙΟΥ ΧΡΕΟΥ</label>
            </div>
          </div>

          {/* --- CATEGORY SELECTOR --- */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 18, justifyContent: 'center' }}>
            <button type="button" onClick={() => setExpenseCategory('suppliers')} style={{ background: expenseCategory === 'suppliers' ? colors.primaryDark : colors.bgLight, color: expenseCategory === 'suppliers' ? colors.white : colors.primaryDark, borderRadius: 12, border: 'none', fontSize: 16, padding: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🛒</span> Εμπορεύματα
            </button>
            <button type="button" onClick={() => setExpenseCategory('worker')} style={{ background: expenseCategory === 'worker' ? colors.primaryDark : colors.bgLight, color: expenseCategory === 'worker' ? colors.white : colors.primaryDark, borderRadius: 12, border: 'none', fontSize: 16, padding: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🛠️</span> Μάστορες
            </button>
            <button type="button" onClick={() => setExpenseCategory('utility')} style={{ background: expenseCategory === 'utility' ? colors.primaryDark : colors.bgLight, color: expenseCategory === 'utility' ? colors.white : colors.primaryDark, borderRadius: 12, border: 'none', fontSize: 16, padding: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>💡</span> Λογαριασμοί
            </button>
            <button type="button" onClick={() => setExpenseCategory('other')} style={{ background: expenseCategory === 'other' ? colors.primaryDark : colors.bgLight, color: expenseCategory === 'other' ? colors.white : colors.primaryDark, borderRadius: 12, border: 'none', fontSize: 16, padding: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📦</span> Λοιπά
            </button>
          </div>
          {/* --- DYNAMIC DROPDOWN --- */}
          <label style={{ ...labelStyle, marginTop: 20 }}>Επιλογή {expenseCategory === 'suppliers' ? 'Προμηθευτή' : expenseCategory === 'worker' ? 'Μάστορα' : expenseCategory === 'utility' ? 'Λογαριασμού' : 'Λοιπού'}</label>
          <select
            value={selectedItem}
            onChange={e => setSelectedItem(e.target.value)}
            style={{ ...inputStyle, marginBottom: 10 }}
          >
            <option value="">Επιλέξτε...</option>
            {expenseCategory === 'suppliers'
              ? suppliers.map(s => <option key={s.id} value={s.id}>{s.name?.toUpperCase()}</option>)
              : filteredFixedAssets.map(f => <option key={f.id} value={f.id}>{f.name?.toUpperCase()}</option>)}
          </select>

          <label style={{ ...labelStyle, marginTop: 20 }}>ΣΗΜΕΙΩΣΕΙΣ</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: 60 }} />

          <div style={{ marginTop: 25 }}>
            <button onClick={handleSave} disabled={loading} style={{ ...smartSaveBtn, backgroundColor: colors.accentRed }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{loading ? 'ΣΥΓΧΡΟΝΙΣΜΟΣ...' : 'ΚΑΤΑΧΩΡΗΣΗ ΕΞΟΔΟΥ'}</span>
            </button>
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: colors.secondaryText, fontWeight: 700 }}>
              ΚΑΘΑΡΟ ΤΑΜΕΙΟ: <span style={{ color: dayStats.income - dayStats.expenses >= 0 ? colors.accentGreen : colors.accentRed }}>
                {(dayStats.income - dayStats.expenses).toFixed(2)}€
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- STYLES ---
const smartSaveBtn: any = { width: '100%', padding: '16px', color: 'white', border: 'none', borderRadius: '16px', cursor: 'pointer' };
const autocompleteDropdown: any = { position: 'absolute', top: '105%', left: 0, right: 0, backgroundColor: 'white', border: `1px solid ${colors.border}`, borderRadius: '14px', zIndex: 1000, maxHeight: 200, overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '16px' };
const dropdownRow = { padding: '12px 15px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', borderBottom: `1px solid ${colors.bgLight}` };
const iphoneWrapper: any = { backgroundColor: '#f8fafc', minHeight: '100vh', width: '100%', padding: '20px', paddingBottom: '140px', touchAction: 'pan-y', display: 'block', overflowY: 'auto' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 };
const logoBoxStyle: any = { width: 42, height: 42, backgroundColor: colors.primaryDark, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20 };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, padding: '8px 12px', backgroundColor: 'white', borderRadius: 10, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const formCard: any = { backgroundColor: 'white', padding: 20, borderRadius: 24, border: `1px solid ${colors.border}`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' };
const labelStyle = { fontSize: '11px', fontWeight: 800, color: colors.secondaryText, display: 'block', marginBottom: 5 };
const inputStyle: any = { width: '100%', padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, fontSize: '16px', fontWeight: 600, backgroundColor: colors.bgLight, boxSizing: 'border-box', outline: 'none' };
const methodBtn: any = { flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
const noInvoiceToggle = { display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, cursor: 'pointer', marginBottom: 15 };
const checkboxBox = { width: 18, height: 18, borderRadius: 5, border: '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10 };
const creditPanel = { backgroundColor: colors.bgLight, padding: 16, borderRadius: 14, border: `1px solid ${colors.border}`, marginTop: 20 };
const checkboxStyle = { width: 18, height: 18 };
const checkLabel = { fontSize: 11, fontWeight: 700, color: colors.primaryDark };
const plusBtn = { width: 48, height: 48, backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const imageUploadContainer = { width: '100%', backgroundColor: colors.bgLight, borderRadius: 14, border: `2px dashed ${colors.border}`, overflow: 'hidden' };
const uploadPlaceholder = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: 30, cursor: 'pointer' };
const imagePreviewStyle = { width: '100%', height: 120, objectFit: 'cover' as const };
const removeImageBtn: any = { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const modalOverlay: any = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 };
const modalCard: any = { backgroundColor: 'white', padding: 28, borderRadius: 22, width: '100%', maxWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' };
const modalCloseBtn: any = { background: 'none', border: 'none', color: colors.secondaryText, cursor: 'pointer', borderRadius: 8, padding: 4 };

export default function AddExpensePage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '100px 0' }}>Φόρτωση...</div>}>
      <AddExpenseForm />
    </Suspense>
  );
}
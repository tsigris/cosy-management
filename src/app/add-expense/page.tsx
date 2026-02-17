
'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { toast, Toaster } from 'sonner';
import { Camera, X, Plus, Search, Landmark, Banknote, Factory, Building2 } from 'lucide-react';

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

function SupplierFormModal({ open, onClose, onCreated, storeId }: { open: boolean, onClose: () => void, onCreated: (supplier: any) => void, storeId: string }) {
  const [name, setName] = useState('');
  const [afm, setAfm] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Όνομα υποχρεωτικό');
    setLoading(true);
    try {
      // Map afm state to vat_number column in DB
      const { data, error } = await supabase.from('suppliers').insert([
        {
          name: name.trim(),
          vat_number: afm.trim() || null,
          phone: phone.trim() || null,
          store_id: storeId
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
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSup, setSelectedSup] = useState('');
  const [selectedFixed, setSelectedFixed] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);

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
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle();
      if (profile) setCurrentUsername(profile.username || 'Admin');
      const [sRes, fRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('store_id', storeId).neq('is_active', false).order('name'),
        supabase.from('fixed_assets').select('id, name').eq('store_id', storeId).order('name'),
      ]);
      if (sRes.data) setSuppliers(sRes.data);
      if (fRes.data) setFixedAssets(fRes.data);
      if (editId) {
        const { data: tx } = await supabase.from('transactions').select('*').eq('id', editId).single();
        if (tx) {
          setAmount(Math.abs(tx.amount).toString());
          setMethod(tx.method);
          setNotes(tx.notes || '');
          setIsCredit(tx.is_credit || false);
          setIsAgainstDebt(tx.type === 'debt_payment');
          setSelectedSup(tx.supplier_id || '');
          setSelectedFixed(tx.fixed_asset_id || '');
          if (tx.supplier_id && sRes.data) {
            const found = sRes.data.find((s: any) => s.id === tx.supplier_id);
            if (found) setSearchTerm(found.name);
          }
          if (tx.invoice_image) {
            const { data: publicUrl } = supabase.storage.from('invoices').getPublicUrl(tx.invoice_image);
            setImagePreview(publicUrl.publicUrl);
          }
        }
      } else {
        if (urlAssetId) setSelectedFixed(urlAssetId);
        if (urlSupId && sRes.data) {
          const found = sRes.data.find((s: any) => s.id === urlSupId);
          if (found) { setSearchTerm(found.name); setSelectedSup(found.id); }
        }
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, [storeId, editId, urlAssetId, urlSupId, router]);

  useEffect(() => { loadFormData(); }, [loadFormData]);

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return suppliers;
    return suppliers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, suppliers]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return toast.error('Συμπληρώστε το ποσό');
    if (!selectedSup && !selectedFixed) return toast.error('Επιλέξτε Προμηθευτή ή Πάγιο');
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload: any = {
        amount: -Math.abs(Number(amount)),
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
      };
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${storeId}/${fileName}`;
        await supabase.storage.from('invoices').upload(filePath, imageFile);
        payload.invoice_image = filePath;
      }
      const { error } = editId
        ? await supabase.from('transactions').update(payload).eq('id', editId)
        : await supabase.from('transactions').insert([payload]);
      if (error) throw error;
      toast.success('Επιτυχής καταχώρηση!');
      router.push(`/?date=${selectedDate}&store=${storeId}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Supplier Combobox Logic ---
  const handleSupplierSelect = (id: string) => {
    setSelectedSup(id);
    setSelectedFixed('');
    const sup = suppliers.find(s => s.id === id);
    setSearchTerm(sup ? sup.name : '');
    setShowDropdown(false);
  };

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <SupplierFormModal open={showSupplierModal} onClose={() => setShowSupplierModal(false)} onCreated={sup => { setSuppliers(prev => [...prev, sup]); handleSupplierSelect(sup.id); }} storeId={storeId} />
      <div style={{ maxWidth: 500, margin: '0 auto', paddingBottom: 120 }}>
        {/* HEADER */}
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
          <Link href={`/?store=${storeId}`} style={backBtnStyle}><X size={20} /></Link>
        </div>

        <div style={formCard}>
          {/* ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ */}
          <div onClick={() => setNoInvoice(!noInvoice)} style={{ ...noInvoiceToggle, backgroundColor: noInvoice ? colors.warning : colors.bgLight, border: `1px solid ${noInvoice ? colors.accentRed : colors.border}` }}>
            <div style={{ ...checkboxBox, backgroundColor: noInvoice ? colors.accentRed : 'white', border: `2px solid ${noInvoice ? colors.accentRed : colors.secondaryText}` }}>{noInvoice && '✓'}</div>
            <span style={{ fontSize: 13, fontWeight: 800, color: noInvoice ? colors.accentRed : colors.primaryDark }}>ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ</span>
          </div>

          <label style={{ ...labelStyle, marginTop: 20 }}>ΠΟΣΟ (€)</label>
          <input type="number" inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />

          <label style={{ ...labelStyle, marginTop: 20 }}>ΜΕΘΟΔΟΣ ΠΛΗΡΩΜΗΣ</label>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="button" onClick={() => { setMethod('Μετρητά'); setIsCredit(false); }} style={{ ...methodBtn, backgroundColor: method === 'Μετρητά' && !isCredit ? colors.primaryDark : colors.white, color: method === 'Μετρητά' && !isCredit ? 'white' : colors.secondaryText }}><Banknote size={16} /> Μετρητά</button>
            <button type="button" onClick={() => { setMethod('Τράπεζα'); setIsCredit(false); }} style={{ ...methodBtn, backgroundColor: method === 'Τράπεζα' && !isCredit ? colors.primaryDark : colors.white, color: method === 'Τράπεζα' && !isCredit ? 'white' : colors.secondaryText }}><Landmark size={16} /> Τράπεζα</button>
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

          {/* ΠΡΟΜΗΘΕΥΤΗΣ - COMBOBOX */}
          <label style={{ ...labelStyle, marginTop: 20 }}><Factory size={12} /> ΠΡΟΜΗΘΕΥΤΗΣ</label>
          <select
            value={selectedSup}
            onChange={e => handleSupplierSelect(e.target.value)}
            style={{ ...inputStyle, marginBottom: 10 }}
          >
            <option value="">Επιλέξτε από τη λίστα...</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
          </select>

          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  placeholder="Αναζήτηση προμηθευτή..."
                  value={searchTerm}
                  onFocus={() => setShowDropdown(true)}
                  onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); setSelectedSup(''); setSelectedFixed(''); }}
                  style={{ ...inputStyle, paddingRight: 40, border: selectedSup ? `2px solid ${colors.accentGreen}` : `1px solid ${colors.border}` }}
                />
                <Search size={18} style={{ position: 'absolute', right: 12, top: 16, color: colors.secondaryText }} />
              </div>
              <button type="button" onClick={() => setShowSupplierModal(true)} style={plusBtn}><Plus size={24} /></button>
            </div>
            {showDropdown && searchTerm && filteredSuppliers.length > 0 && (
              <div style={autocompleteDropdown}>
                {filteredSuppliers.map(s => (
                  <div key={s.id} style={dropdownRow} onClick={() => handleSupplierSelect(s.id)}>{s.name}</div>
                ))}
              </div>
            )}
          </div>

          <label style={{ ...labelStyle, marginTop: 20 }}><Building2 size={12} /> ΠΑΓΙΟ / ΛΟΓΑΡΙΑΣΜΟΣ</label>
          <select value={selectedFixed} onChange={e => { setSelectedFixed(e.target.value); if (e.target.value) { setSelectedSup(''); setSearchTerm(''); } }} style={inputStyle}>
            <option value="">Επιλογή...</option>
            {fixedAssets.map(f => <option key={f.id} value={f.id}>{f.name.toUpperCase()}</option>)}
          </select>

          <label style={{ ...labelStyle, marginTop: 20 }}>ΣΗΜΕΙΩΣΕΙΣ</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: 60 }} />

          {/* ΦΩΤΟΓΡΑΦΙΑ */}
          {!editId && !noInvoice && (
            <div style={{ marginTop: 20 }}>
              <label style={labelStyle}>📸 ΦΩΤΟΓΡΑΦΙΑ</label>
              <div style={imageUploadContainer}>
                {imagePreview ? (
                  <div style={{ position: 'relative', width: '100%', height: 120 }}>
                    <img src={imagePreview} alt="Preview" style={imagePreviewStyle} />
                    <button onClick={() => { setImagePreview(null); setImageFile(null); }} style={removeImageBtn}><X size={14} /></button>
                  </div>
                ) : (
                  <label style={uploadPlaceholder}>
                    <Camera size={32} color={colors.secondaryText} />
                    <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 25 }}>
            <button onClick={handleSave} disabled={loading} style={{ ...smartSaveBtn, backgroundColor: colors.accentRed }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>
                {loading ? 'ΣΥΓΧΡΟΝΙΣΜΟΣ...' : 'ΚΑΤΑΧΩΡΗΣΗ ΕΞΟΔΟΥ'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- STYLES ---
const smartSaveBtn: any = { width: '100%', padding: '16px', color: 'white', border: 'none', borderRadius: '16px', cursor: 'pointer' };
const autocompleteDropdown: any = { position: 'absolute', top: '105%', left: 0, right: 0, backgroundColor: 'white', border: `1px solid ${colors.border}`, borderRadius: '14px', zIndex: 1000, maxHeight: 200, overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' };
const dropdownRow = { padding: '12px 15px', fontSize: 14, fontWeight: 700, cursor: 'pointer', borderBottom: `1px solid ${colors.bgLight}` };
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: 20, overflowY: 'auto' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 };
const logoBoxStyle: any = { width: 42, height: 42, backgroundColor: colors.primaryDark, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20 };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, padding: '8px 12px', backgroundColor: 'white', borderRadius: 10, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const formCard: any = { backgroundColor: 'white', padding: 20, borderRadius: 24, border: `1px solid ${colors.border}`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' };
const labelStyle = { fontSize: 10, fontWeight: 800, color: colors.secondaryText, display: 'block', marginBottom: 5 };
const inputStyle: any = { width: '100%', padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, fontSize: 14, fontWeight: 600, backgroundColor: colors.bgLight, boxSizing: 'border-box', outline: 'none' };
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
  return <AddExpenseForm />;
}
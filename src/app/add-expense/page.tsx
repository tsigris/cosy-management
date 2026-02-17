'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { ChevronLeft, Camera, X, Plus, Search, Landmark, Banknote, Factory, Building2 } from 'lucide-react'

// --- ΘΕΜΑ ΧΡΩΜΑΤΩΝ ---
const colors = {
  primaryDark: '#1e293b', 
  secondaryText: '#64748b', 
  accentRed: '#dc2626',   
  accentBlue: '#2563eb',  
  accentGreen: '#059669',
  bgLight: '#f8fafc',     
  border: '#e2e8f0',      
  white: '#ffffff'
};

function AddExpenseForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // --- SaaS & URL PARAMS ---
  const storeId = searchParams.get('store')
  const editId = searchParams.get('editId')
  const urlSupId = searchParams.get('supId')
  const urlAssetId = searchParams.get('assetId')
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  // --- STATE ---
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [notes, setNotes] = useState('')
  const [isCredit, setIsCredit] = useState(false) 
  const [isAgainstDebt, setIsAgainstDebt] = useState(searchParams.get('mode') === 'debt')
  const [noInvoice, setNoInvoice] = useState(false)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [currentUsername, setCurrentUsername] = useState('Χρήστης')
  const [loading, setLoading] = useState(true)

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])
  
  // --- SEARCH & DROPDOWN STATE ---
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedSup, setSelectedSup] = useState('')
  const [selectedFixed, setSelectedFixed] = useState('')

  // Κλείσιμο dropdown όταν κάνεις κλικ αλλού
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // --- ΦΟΡΤΩΣΗ ΔΕΔΟΜΕΝΩΝ ---
  const loadFormData = useCallback(async () => {
    if (!storeId || storeId === 'null') {
        router.replace('/select-store');
        return;
    }

    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const { data: profile } = await supabase.from('profiles').select('username').eq('id', session?.user.id).maybeSingle();
      if (profile) setCurrentUsername(profile.username || 'Admin');

      const [sRes, fRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('store_id', storeId).neq('is_active', false).order('name'),
        supabase.from('fixed_assets').select('id, name').eq('store_id', storeId).order('name')
      ]);

      if (sRes.data) setSuppliers(sRes.data);
      if (fRes.data) setFixedAssets(fRes.data);

      if (editId) {
        // Edit Mode
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
        // New Mode
        if (urlAssetId) setSelectedFixed(urlAssetId);
        if (urlSupId && sRes.data) {
            const found = sRes.data.find((s: any) => s.id === urlSupId);
            if (found) { setSearchTerm(found.name); setSelectedSup(found.id); }
        }
      }
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }, [storeId, editId, urlAssetId, urlSupId, router])

  useEffect(() => { loadFormData() }, [loadFormData])

  // --- LOGIC ---
  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return []
    return suppliers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [searchTerm, suppliers])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return toast.error('Συμπληρώστε το ποσό')
    if (!selectedSup && !selectedFixed) return toast.error('Επιλέξτε Προμηθευτή ή Πάγιο')
    
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

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
        employee_id: null, 
        category: isAgainstDebt ? 'Εξόφληση Χρέους' : (selectedFixed ? 'Πάγια' : 'Εμπορεύματα'),
        created_by_name: currentUsername,
        notes: noInvoice ? (notes ? `${notes} (ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ)` : 'ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ') : notes,
      }

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${storeId}/${fileName}`;
        await supabase.storage.from('invoices').upload(filePath, imageFile);
        payload.invoice_image = filePath;
      }

      const { error } = editId 
        ? await supabase.from('transactions').update(payload).eq('id', editId)
        : await supabase.from('transactions').insert([payload])

      if (error) throw error
      toast.success('Επιτυχής καταχώρηση!')
      router.push(`/?date=${selectedDate}&store=${storeId}`)
    } catch (error: any) { 
        toast.error(error.message); 
    } finally {
        setLoading(false);
    }
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '120px' }}>
        
        {/* HEADER */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>💸</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '22px', margin: 0 }}>{editId ? 'Διόρθωση' : 'Έξοδο'}</h1>
              <p style={{ margin: 0, fontSize: '11px', color: colors.secondaryText, fontWeight: '700' }}>
                {new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' }).toUpperCase()}
              </p>
            </div>
          </div>
          <Link href={`/?store=${storeId}`} style={backBtnStyle}><X size={20} /></Link>
        </div>

        <div style={formCard}>
          {/* TOGGLE: ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ */}
          <div onClick={() => setNoInvoice(!noInvoice)} style={{ ...noInvoiceToggle, backgroundColor: noInvoice ? '#fee2e2' : colors.bgLight, border: `1px solid ${noInvoice ? colors.accentRed : colors.border}` }}>
            <div style={{ ...checkboxBox, backgroundColor: noInvoice ? colors.accentRed : 'white', border: `2px solid ${noInvoice ? colors.accentRed : colors.secondaryText}` }}>{noInvoice && '✓'}</div>
            <span style={{ fontSize: '13px', fontWeight: '800', color: noInvoice ? colors.accentRed : colors.primaryDark }}>ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ (Μαύρα)</span>
          </div>

          <label style={{ ...labelStyle, marginTop: '20px' }}>ΠΟΣΟ (€)</label>
          <input type="number" inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />

          <label style={{ ...labelStyle, marginTop: '20px' }}>ΜΕΘΟΔΟΣ ΠΛΗΡΩΜΗΣ</label>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={() => {setMethod('Μετρητά'); setIsCredit(false);}} style={{ ...methodBtn, backgroundColor: method === 'Μετρητά' && !isCredit ? colors.primaryDark : colors.white, color: method === 'Μετρητά' && !isCredit ? 'white' : colors.secondaryText }}><Banknote size={16} /> Μετρητά</button>
            <button type="button" onClick={() => {setMethod('Τράπεζα'); setIsCredit(false);}} style={{ ...methodBtn, backgroundColor: method === 'Τράπεζα' && !isCredit ? colors.primaryDark : colors.white, color: method === 'Τράπεζα' && !isCredit ? 'white' : colors.secondaryText }}><Landmark size={16} /> Τράπεζα</button>
          </div>

          <div style={creditPanel}>
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={isCredit} onChange={e => {setIsCredit(e.target.checked); if(e.target.checked) setIsAgainstDebt(false)}} id="credit" style={checkboxStyle} />
              <label htmlFor="credit" style={checkLabel}>ΕΠΙ ΠΙΣΤΩΣΕΙ (ΝΕΟ ΧΡΕΟΣ)</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" checked={isAgainstDebt} onChange={e => {setIsAgainstDebt(e.target.checked); if(e.target.checked) setIsCredit(false)}} id="against" style={checkboxStyle} />
              <label htmlFor="against" style={{...checkLabel, color: isAgainstDebt ? colors.accentBlue : colors.primaryDark }}>ΕΝΑΝΤΙ ΠΑΛΑΙΟΥ ΧΡΕΟΥ</label>
            </div>
          </div>

          {/* ΠΡΟΜΗΘΕΥΤΗΣ - LIST & SEARCH */}
          <label style={{ ...labelStyle, marginTop: '20px' }}><Factory size={12} /> ΠΡΟΜΗΘΕΥΤΗΣ</label>
          <select 
            value={selectedSup} 
            onChange={e => {
                const id = e.target.value;
                setSelectedSup(id);
                setSelectedFixed('');
                if(id) {
                    const sup = suppliers.find(s => s.id === id);
                    setSearchTerm(sup ? sup.name : '');
                } else {
                    setSearchTerm('');
                }
            }} 
            style={{...inputStyle, marginBottom: '10px'}}
          >
            <option value="">Επιλέξτε από τη λίστα...</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
          </select>

          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '16px', color: colors.secondaryText }} />
                <input 
                  type="text" 
                  placeholder="ή αναζητήστε..." 
                  value={searchTerm} 
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => {setSearchTerm(e.target.value); setShowDropdown(true); setSelectedSup(''); setSelectedFixed('');}}
                  style={{...inputStyle, paddingLeft: '40px', border: selectedSup ? `2px solid ${colors.accentGreen}` : `1px solid ${colors.border}`}}
                />
              </div>
              <button type="button" onClick={() => router.push(`/suppliers?store=${storeId}`)} style={plusBtn}><Plus size={24} /></button>
            </div>
            {showDropdown && searchTerm && filteredSuppliers.length > 0 && (
              <div style={autocompleteDropdown}>
                {filteredSuppliers.map(s => (
                  <div key={s.id} style={dropdownRow} onClick={() => { setSelectedSup(s.id); setSearchTerm(s.name); setShowDropdown(false); }}>{s.name}</div>
                ))}
              </div>
            )}
          </div>

          <label style={{ ...labelStyle, marginTop: '20px' }}><Building2 size={12} /> ΠΑΓΙΟ / ΛΟΓΑΡΙΑΣΜΟΣ</label>
          <select value={selectedFixed} onChange={e => {setSelectedFixed(e.target.value); if(e.target.value) {setSelectedSup(''); setSearchTerm('');}}} style={inputStyle}>
            <option value="">Επιλογή...</option>
            {fixedAssets.map(f => <option key={f.id} value={f.id}>{f.name.toUpperCase()}</option>)}
          </select>

          <label style={{ ...labelStyle, marginTop: '20px' }}>ΣΗΜΕΙΩΣΕΙΣ</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: '60px' }} />

          {/* ΦΩΤΟΓΡΑΦΙΑ (Αυτό έλειπε) */}
          {!editId && !noInvoice && (
            <div style={{ marginTop: '20px' }}>
              <label style={labelStyle}>📸 ΦΩΤΟΓΡΑΦΙΑ</label>
              <div style={imageUploadContainer}>
                {imagePreview ? (
                  <div style={{ position: 'relative', width: '100%', height: '120px' }}>
                    <img src={imagePreview} alt="Preview" style={imagePreviewStyle} />
                    <button onClick={() => {setImagePreview(null); setImageFile(null);}} style={removeImageBtn}><X size={14} /></button>
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

          <div style={{ marginTop: '25px' }}>
            <button onClick={handleSave} disabled={loading} style={{...smartSaveBtn, backgroundColor: colors.accentRed}}>
                <span style={{ fontSize: '15px', fontWeight: '800' }}>
                  {loading ? 'ΣΥΓΧΡΟΝΙΣΜΟΣ...' : 'ΚΑΤΑΧΩΡΗΣΗ ΕΞΟΔΟΥ'}
                </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- ΟΛΑ ΤΑ STYLES ---
const smartSaveBtn: any = { width: '100%', padding: '16px', color: 'white', border: 'none', borderRadius: '16px', cursor: 'pointer' };
const autocompleteDropdown: any = { position: 'absolute', top: '105%', left: 0, right: 0, backgroundColor: 'white', border: `1px solid ${colors.border}`, borderRadius: '14px', zIndex: 1000, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' };
const dropdownRow = { padding: '12px 15px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', borderBottom: `1px solid ${colors.bgLight}` };
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', overflowY: 'auto' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: colors.primaryDark, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, padding: '8px 12px', backgroundColor: 'white', borderRadius: '10px', border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const formCard: any = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', border: `1px solid ${colors.border}`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, display: 'block', marginBottom: '5px' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '14px', fontWeight: '600', backgroundColor: colors.bgLight, boxSizing: 'border-box', outline: 'none' };
const methodBtn: any = { flex: 1, padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const noInvoiceToggle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '12px', cursor: 'pointer', marginBottom: '15px' };
const checkboxBox = { width: '18px', height: '18px', borderRadius: '5px', border: '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px' };
const creditPanel = { backgroundColor: colors.bgLight, padding: '16px', borderRadius: '14px', border: `1px solid ${colors.border}`, marginTop: '20px' };
const checkboxStyle = { width: '18px', height: '18px' };
const checkLabel = { fontSize: '11px', fontWeight: '700', color: colors.primaryDark };
const plusBtn = { width: '48px', height: '48px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const imageUploadContainer = { width: '100%', backgroundColor: colors.bgLight, borderRadius: '14px', border: `2px dashed ${colors.border}`, overflow: 'hidden' };
const uploadPlaceholder = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '30px', cursor: 'pointer' };
const imagePreviewStyle = { width: '100%', height: '120px', objectFit: 'cover' as const };
const removeImageBtn: any = { position: 'absolute', top: '5px', right: '5px', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

export default function AddExpensePage() { 
  return (
    <Suspense fallback={null}>
      <AddExpenseForm />
    </Suspense>
  ) 
}
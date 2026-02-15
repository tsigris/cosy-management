'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'

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

  const urlSupId = searchParams.get('supId')
  const urlAssetId = searchParams.get('assetId')
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [notes, setNotes] = useState('')
  const [isCredit, setIsCredit] = useState(false) 
  const [isAgainstDebt, setIsAgainstDebt] = useState(searchParams.get('mode') === 'debt')
  const [noInvoice, setNoInvoice] = useState(false)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const [currentUsername, setCurrentUsername] = useState('Χρήστης')
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])
  
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedSup, setSelectedSup] = useState(urlSupId || '')
  const [selectedFixed, setSelectedFixed] = useState(urlAssetId || '')

  const [isSupModalOpen, setIsSupModalOpen] = useState(false)
  const [newSupName, setNewSupName] = useState('')
  const [newSupAfm, setNewSupAfm] = useState('')

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const loadFormData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: profile } = await supabase.from('profiles').select('username, store_id').eq('id', session?.user.id).maybeSingle()
      
      if (profile) {
        setCurrentUsername(profile.username || 'Admin')
        setStoreId(profile.store_id)
        
        const [sRes, fRes] = await Promise.all([
          supabase.from('suppliers').select('*').eq('store_id', profile.store_id).neq('is_active', false).order('name'),
          supabase.from('fixed_assets').select('id, name').eq('store_id', profile.store_id).order('name')
        ])
        if (sRes.data) setSuppliers(sRes.data)
        if (fRes.data) setFixedAssets(fRes.data)

        if (urlSupId && sRes.data) {
          const found = sRes.data.find((s: any) => s.id === urlSupId)
          if (found) setSearchTerm(found.name)
        }
      }
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }, [urlSupId])

  useEffect(() => { loadFormData() }, [loadFormData])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return []
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [searchTerm, suppliers])

  async function handleQuickAddSupplier() {
    if (!newSupName) return toast.error('Δώστε όνομα προμηθευτή');
    try {
      const { data, error } = await supabase.from('suppliers').insert([
        { name: newSupName, vat_number: newSupAfm, category: 'Εμπορεύματα', store_id: storeId, is_active: true }
      ]).select().single();
      if (error) throw error;
      setSuppliers([...suppliers, data].sort((a,b) => a.name.localeCompare(b.name)));
      setSelectedSup(data.id);
      setSearchTerm(data.name);
      setIsSupModalOpen(false);
      toast.success('Προστέθηκε!');
    } catch (err: any) { toast.error('Σφάλμα'); }
  }

  async function handleSave() {
    if (!amount || Number(amount) <= 0) return alert('Συμπληρώστε το ποσό')
    if (!selectedSup && !selectedFixed) return alert('Επιλέξτε Προμηθευτή ή Πάγιο')
    setLoading(true)
    setIsUploading(true)

    try {
      let imageUrl = null
      if (imageFile && storeId && !noInvoice) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${storeId}/${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('invoices').upload(fileName, imageFile)
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(fileName)
        imageUrl = urlData.publicUrl
      }

      const { data: { session } } = await supabase.auth.getSession()
      const finalNotes = noInvoice ? (notes ? `${notes} (ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ)` : 'ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ') : notes;

      const payload = {
        amount: Number(amount),
        method: isCredit ? 'Πίστωση' : method,
        is_credit: isCredit,
        type: isAgainstDebt ? 'debt_payment' : 'expense',
        date: selectedDate,
        user_id: session?.user.id,
        store_id: storeId,
        supplier_id: selectedSup || null,
        fixed_asset_id: selectedFixed || null,
        category: isAgainstDebt ? 'Εξόφληση Χρέους' : (selectedSup ? 'Εμπορεύματα' : (selectedFixed ? 'Πάγια' : 'Λοιπά')),
        created_by_name: currentUsername,
        notes: finalNotes,
        image_url: imageUrl
      }

      const { error } = await supabase.from('transactions').insert([payload])
      if (error) throw error
      router.push(`/?date=${selectedDate}`)
      router.refresh()
    } catch (error: any) { 
      alert(error.message); setLoading(false); setIsUploading(false);
    }
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '120px' }}>
        
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>💸</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '22px', margin: 0 }}>{isAgainstDebt ? 'Εξόφληση' : 'Νέο Έξοδο'}</h1>
              <p style={{ margin: 0, fontSize: '11px', color: colors.secondaryText, fontWeight: '600' }}>{new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' }).toUpperCase()}</p>
            </div>
          </div>
          <Link href="/" style={backBtnStyle}>✕</Link>
        </div>

        <div style={formCard}>
          <label style={labelStyle}>ΠΟΣΟ (€)</label>
          <input type="number" inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />

          <div onClick={() => setNoInvoice(!noInvoice)} style={{ ...noInvoiceToggle, backgroundColor: noInvoice ? '#fee2e2' : colors.bgLight, border: `1px solid ${noInvoice ? colors.accentRed : colors.border}` }}>
            <div style={{ ...checkboxBox, backgroundColor: noInvoice ? colors.accentRed : 'white', border: `2px solid ${noInvoice ? colors.accentRed : colors.secondaryText}` }}>{noInvoice && '✓'}</div>
            <span style={{ fontSize: '13px', fontWeight: '800', color: noInvoice ? colors.accentRed : colors.primaryDark }}>ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ (Μαύρα)</span>
          </div>

          <label style={{ ...labelStyle, marginTop: '20px' }}>ΜΕΘΟΔΟΣ ΠΛΗΡΩΜΗΣ</label>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={() => {setMethod('Μετρητά'); setIsCredit(false);}} style={{ ...methodBtn, backgroundColor: method === 'Μετρητά' && !isCredit ? colors.primaryDark : colors.white, color: method === 'Μετρητά' && !isCredit ? 'white' : colors.secondaryText }}>💵 Μετρητά</button>
            <button type="button" onClick={() => {setMethod('Τράπεζα'); setIsCredit(false);}} style={{ ...methodBtn, backgroundColor: method === 'Τράπεζα' && !isCredit ? colors.primaryDark : colors.white, color: method === 'Τράπεζα' && !isCredit ? 'white' : colors.secondaryText }}>🏛️ Τράπεζα</button>
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

          <label style={{ ...labelStyle, marginTop: '20px' }}>🏭 ΠΡΟΜΗΘΕΥΤΗΣ (ΑΥΤΟΜΑΤΗ ΑΝΑΖΗΤΗΣΗ)</label>
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                placeholder="Γράψτε τα πρώτα γράμματα..." 
                value={searchTerm} 
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => {
                    setSearchTerm(e.target.value); 
                    setShowDropdown(true); 
                    // ✅ ΔΙΟΡΘΩΣΗ 1: Μηδενισμός επιλογής αν ο χρήστης γράφει κάτι νέο
                    setSelectedSup('');
                }}
                style={{...inputStyle, border: selectedSup ? `2px solid ${colors.accentGreen}` : `1px solid ${colors.border}`}}
              />
              <button type="button" onClick={() => setIsSupModalOpen(true)} style={plusBtn}>+</button>
            </div>
            
            {showDropdown && searchTerm && (
              <div style={autocompleteDropdown}>
                {filteredSuppliers.map(s => (
                  <div 
                    key={s.id} 
                    style={dropdownRow} 
                    onClick={() => { 
                        setSelectedSup(s.id); 
                        setSearchTerm(s.name); 
                        // ✅ ΔΙΟΡΘΩΣΗ 2: Κλείσιμο dropdown μετά την επιλογή
                        setShowDropdown(false); 
                        setSelectedFixed(''); 
                    }}
                  >
                    {s.name}
                  </div>
                ))}
                {filteredSuppliers.length === 0 && (
                  <div style={{...dropdownRow, color: colors.secondaryText, fontStyle: 'italic'}}>Δεν βρέθηκε προμηθευτής</div>
                )}
              </div>
            )}
          </div>

          <label style={{ ...labelStyle, marginTop: '20px' }}>🏢 ΠΑΓΙΟ / ΛΟΓΑΡΙΑΣΜΟΣ</label>
          <select value={selectedFixed} onChange={e => {setSelectedFixed(e.target.value); if(e.target.value) {setSelectedSup(''); setSearchTerm('');}}} style={inputStyle}>
            <option value="">Επιλογή από λίστα...</option>
            {fixedAssets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          <label style={{ ...labelStyle, marginTop: '20px' }}>ΣΗΜΕΙΩΣΕΙΣ</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: '70px' }} placeholder="..." />

          {!noInvoice && (
            <div style={{ marginTop: '20px' }}>
              <label style={labelStyle}>📸 ΦΩΤΟΓΡΑΦΙΑ ΤΙΜΟΛΟΓΙΟΥ</label>
              <div style={imageUploadContainer}>
                {imagePreview ? (
                  <div style={{ position: 'relative', width: '100%', height: '120px' }}>
                    <img src={imagePreview} alt="Preview" style={imagePreviewStyle} />
                    <button onClick={() => {setImageFile(null); setImagePreview(null);}} style={removeImageBtn}>✕</button>
                  </div>
                ) : (
                  <label style={uploadPlaceholder}>
                    <span style={{ fontSize: '20px' }}>📷</span>
                    <span style={{ fontSize: '11px', fontWeight: '800' }}>ΛΗΨΗ ΦΩΤΟΓΡΑΦΙΑΣ</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
            </div>
          )}

          <button onClick={handleSave} disabled={loading || isUploading} style={saveBtn}>{isUploading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΟΛΟΚΛΗΡΩΣΗ'}</button>
        </div>
      </div>

      {isSupModalOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <h2 style={{margin: '0 0 20px', fontSize: '18px', fontWeight: '800'}}>Νέος Προμηθευτής</h2>
            <input value={newSupName} onChange={e => setNewSupName(e.target.value)} style={{...inputStyle, marginBottom:'15px'}} placeholder="Όνομα" />
            <div style={{display: 'flex', gap: '10px'}}>
              <button onClick={() => setIsSupModalOpen(false)} style={{...saveBtn, backgroundColor: colors.secondaryText, marginTop:0}}>ΑΚΥΡΟ</button>
              <button onClick={handleQuickAddSupplier} style={{...saveBtn, backgroundColor: colors.accentGreen, marginTop:0}}>ΠΡΟΣΘΗΚΗ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const autocompleteDropdown: any = {
  position: 'absolute', top: '105%', left: 0, right: 0,
  backgroundColor: 'white', border: `1px solid ${colors.border}`,
  borderRadius: '14px', zIndex: 1000, 
  maxHeight: '250px', overflowY: 'auto', 
  boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
  padding: '8px 0'
};
const dropdownRow = { padding: '14px 20px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', borderBottom: `1px solid ${colors.bgLight}` };

const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', overflowY: 'auto', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const logoBoxStyle: any = { width: '48px', height: '48px', backgroundColor: colors.primaryDark, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '22px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` };
const formCard: any = { backgroundColor: colors.white, padding: '24px', borderRadius: '24px', border: `1px solid ${colors.border}`, marginBottom: '25px' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '6px', display: 'block' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '15px', fontWeight: '600', backgroundColor: colors.bgLight, boxSizing: 'border-box' };
const methodBtn: any = { flex: 1, padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, cursor: 'pointer', fontWeight: '700', fontSize: '13px' };
const noInvoiceToggle = { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', padding: '12px', borderRadius: '12px', cursor: 'pointer' };
const checkboxBox = { width: '20px', height: '20px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px' };
const creditPanel = { backgroundColor: colors.bgLight, padding: '16px', borderRadius: '14px', border: `1px solid ${colors.border}`, marginTop: '20px' };
const checkboxStyle = { width: '18px', height: '18px' };
const checkLabel = { fontSize: '11px', fontWeight: '700', color: colors.primaryDark };
const plusBtn = { width: '48px', height: '48px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '12px', fontSize: '20px', fontWeight: 'bold' };
const saveBtn: any = { width: '100%', padding: '16px', backgroundColor: colors.accentRed, color: 'white', border: 'none', borderRadius: '14px', fontWeight: '700', fontSize: '15px', marginTop: '25px' };
const imageUploadContainer = { width: '100%', backgroundColor: colors.bgLight, borderRadius: '14px', border: `2px dashed ${colors.border}`, overflow: 'hidden' };
const uploadPlaceholder = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '20px', cursor: 'pointer', gap: '5px', color: colors.secondaryText };
const imagePreviewStyle = { width: '100%', height: '120px', objectFit: 'cover' as const };
const removeImageBtn: any = { position: 'absolute', top: '5px', right: '5px', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px' };
const modalOverlay: any = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' };
const modalCard = { backgroundColor: 'white', padding: '24px', borderRadius: '24px', width: '100%', maxWidth: '400px' };

export default function AddExpensePage() { return <Suspense fallback={<div>Φόρτωση...</div>}><AddExpenseForm /></Suspense> }
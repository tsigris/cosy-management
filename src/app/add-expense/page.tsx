'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
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

  const urlSupId = searchParams.get('supId')
  const urlAssetId = searchParams.get('assetId')
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [notes, setNotes] = useState('')
  const [isCredit, setIsCredit] = useState(false) 
  const [isAgainstDebt, setIsAgainstDebt] = useState(searchParams.get('mode') === 'debt')
  const [currentUsername, setCurrentUsername] = useState('Χρήστης')
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedSup, setSelectedSup] = useState(urlSupId || '')
  const [selectedFixed, setSelectedFixed] = useState(urlAssetId || '')

  // States για το Modal Νέου Προμηθευτή
  const [isSupModalOpen, setIsSupModalOpen] = useState(false)
  const [newSupName, setNewSupName] = useState('')
  const [newSupPhone, setNewSupPhone] = useState('')

  const loadFormData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: profile } = await supabase.from('profiles').select('username, store_id').eq('id', session?.user.id).maybeSingle()
      
      if (profile) {
        setCurrentUsername(profile.username || 'Admin')
        setStoreId(profile.store_id)
        
        const [sRes, fRes] = await Promise.all([
          supabase.from('suppliers').select('id, name').eq('store_id', profile.store_id).order('name'),
          supabase.from('fixed_assets').select('id, name').eq('store_id', profile.store_id).order('name')
        ])
        if (sRes.data) setSuppliers(sRes.data)
        if (fRes.data) setFixedAssets(fRes.data)
      }
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadFormData() }, [loadFormData])

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // ΛΕΙΤΟΥΡΓΙΑ ΓΡΗΓΟΡΗΣ ΠΡΟΣΘΗΚΗΣ ΠΡΟΜΗΘΕΥΤΗ
  async function handleQuickAddSupplier() {
    if (!newSupName) return toast.error('Δώστε όνομα προμηθευτή');
    if (!storeId) return toast.error('Σφάλμα καταστήματος');

    try {
      const { data, error } = await supabase.from('suppliers').insert([
        { name: newSupName, phone: newSupPhone, store_id: storeId, category: 'Εμπορεύματα' }
      ]).select().single();

      if (error) throw error;

      setSuppliers([...suppliers, data].sort((a,b) => a.name.localeCompare(b.name)));
      setSelectedSup(data.id);
      setSearchTerm(data.name);
      setIsSupModalOpen(false);
      setNewSupName(''); setNewSupPhone('');
      toast.success('Ο προμηθευτής προστέθηκε!');
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleSave() {
    if (!amount || Number(amount) <= 0) return alert('Συμπληρώστε το ποσό')
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
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
        notes
      }
      const { error } = await supabase.from('transactions').insert([payload])
      if (error) throw error
      router.push(`/?date=${selectedDate}`)
      router.refresh()
    } catch (error: any) { alert(error.message); setLoading(false); }
  }

  return (
    <main style={{ backgroundColor: colors.bgLight, minHeight: '100vh', padding: '16px 16px 100px 16px', overflowY: 'auto' }}>
      <Toaster position="top-center" richColors />
      
      <div style={formCardStyle}>
        
        <div style={headerRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ ...logoBoxStyle, backgroundColor: '#fef2f2' }}>💸</div>
            <div>
              <h1 style={titleStyle}>{isAgainstDebt ? 'Εξόφληση Χρέους' : 'Νέο Έξοδο'}</h1>
              <p style={dateSubtitle}>{new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' }).toUpperCase()}</p>
            </div>
          </div>
          <Link href="/" style={backBtnStyle}>✕</Link>
        </div>

        {/* ΜΕΘΟΔΟΣ ΠΛΗΡΩΜΗΣ ΜΕ ΕΙΚΟΝΙΔΙΑ */}
        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}>ΜΕΘΟΔΟΣ ΠΛΗΡΩΜΗΣ</label>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={() => {setMethod('Μετρητά'); setIsCredit(false);}} style={{ ...methodBtn, backgroundColor: method === 'Μετρητά' && !isCredit ? colors.primaryDark : colors.white, color: method === 'Μετρητά' && !isCredit ? 'white' : colors.secondaryText }}>
              <span style={{fontSize: '20px'}}>💵</span><span>Μετρητά</span>
            </button>
            <button type="button" onClick={() => {setMethod('Τράπεζα'); setIsCredit(false);}} style={{ ...methodBtn, backgroundColor: method === 'Τράπεζα' && !isCredit ? colors.primaryDark : colors.white, color: method === 'Τράπεζα' && !isCredit ? 'white' : colors.secondaryText }}>
              <span style={{fontSize: '20px'}}>🏛️</span><span>Τράπεζα</span>
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>ΠΟΣΟ (€)</label>
          <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
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

        {/* ΑΝΑΖΗΤΗΣΗ & DROPDOWN ΠΡΟΜΗΘΕΥΤΗ */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>🏭 ΑΝΑΖΗΤΗΣΗ ΠΡΟΜΗΘΕΥΤΗ</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type="text" placeholder="Αναζήτηση..." value={searchTerm} 
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => {setSearchTerm(e.target.value); setShowDropdown(true);}}
                style={{ ...inputStyle, paddingRight: '45px' }} 
              />
              <span style={searchIconRight}>🔍</span>
              {showDropdown && searchTerm && (
                <div style={dropdownList}>
                  {filteredSuppliers.map(s => (
                    <div key={s.id} onClick={() => { setSelectedSup(s.id); setSearchTerm(s.name); setShowDropdown(false); }} style={dropdownItem}>{s.name}</div>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={() => setIsSupModalOpen(true)} style={plusBtn}>+</button>
          </div>

          <label style={labelStyle}>🏭 ΛΙΣΤΑ ΠΡΟΜΗΘΕΥΤΩΝ</label>
          <select value={selectedSup} onChange={e => { setSelectedSup(e.target.value); setSelectedFixed(''); setSearchTerm(suppliers.find(s=>s.id===e.target.value)?.name || ''); }} style={inputStyle}>
            <option value="">— Επιλογή —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>🏢 ΠΑΓΙΟ / ΛΟΓΑΡΙΑΣΜΟΣ</label>
          <select value={selectedFixed} onChange={e => {setSelectedFixed(e.target.value); setSelectedSup(''); setSearchTerm('');}} style={inputStyle}>
            <option value="">— Επιλογή —</option>
            {fixedAssets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: '80px' }} placeholder="Περιγραφή..." />
        </div>

        <button onClick={handleSave} disabled={loading} style={saveBtn}>
          {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΟΛΟΚΛΗΡΩΣΗ'}
        </button>
        <div style={{ height: '40px' }}></div>
      </div>

      {/* MODAL ΓΙΑ ΝΕΟ ΠΡΟΜΗΘΕΥΤΗ */}
      {isSupModalOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <h2 style={{margin: '0 0 20px', fontSize: '18px', fontWeight: '800'}}>Νέος Προμηθευτής</h2>
            <label style={labelStyle}>ΕΠΩΝΥΜΙΑ</label>
            <input value={newSupName} onChange={e => setNewSupName(e.target.value)} style={inputStyle} placeholder="Όνομα..." />
            <div style={{height: '15px'}}></div>
            <label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label>
            <input value={newSupPhone} onChange={e => setNewSupPhone(e.target.value)} style={inputStyle} placeholder="210..." />
            
            <div style={{display: 'flex', gap: '10px', marginTop: '25px'}}>
              <button onClick={() => setIsSupModalOpen(false)} style={{...saveBtn, backgroundColor: colors.secondaryText, flex: 1}}>ΑΚΥΡΟ</button>
              <button onClick={handleQuickAddSupplier} style={{...saveBtn, backgroundColor: colors.accentGreen, flex: 2}}>ΠΡΟΣΘΗΚΗ</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// --- STYLES ---
const formCardStyle = { maxWidth: '500px', margin: '0 auto', backgroundColor: colors.white, borderRadius: '28px', padding: '24px' };
const headerRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' };
const titleStyle = { fontWeight: '800', fontSize: '18px', margin: 0, color: colors.primaryDark };
const dateSubtitle = { margin: 0, fontSize: '10px', color: colors.secondaryText, fontWeight: '700' };
const logoBoxStyle = { width: '45px', height: '45px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' };
const backBtnStyle = { textDecoration: 'none', color: colors.secondaryText, width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgLight, borderRadius: '12px' };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '8px', display: 'block' };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '14px', border: `1px solid ${colors.border}`, fontSize: '15px', fontWeight: '700', outline: 'none', backgroundColor: colors.bgLight, boxSizing: 'border-box' as const };
const methodBtn: any = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px', borderRadius: '18px', border: `1px solid ${colors.border}`, cursor: 'pointer', fontWeight: '700' };
const creditPanel = { backgroundColor: colors.bgLight, padding: '16px', borderRadius: '18px', marginBottom: '20px' };
const checkboxStyle = { width: '20px', height: '20px' };
const checkLabel = { fontSize: '12px', fontWeight: '700', color: colors.primaryDark };
const searchIconRight = { position: 'absolute' as const, right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: colors.secondaryText, pointerEvents: 'none' as const };
const plusBtn = { width: '48px', height: '48px', backgroundColor: colors.accentBlue, color: 'white', border: 'none', borderRadius: '14px', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer' };
const saveBtn = { width: '100%', padding: '18px', color: 'white', border: 'none', borderRadius: '18px', fontWeight: '800', fontSize: '16px', backgroundColor: colors.accentRed };
const dropdownList = { position: 'absolute' as const, top: '100%', left: 0, right: 0, backgroundColor: 'white', border: `1px solid ${colors.border}`, borderRadius: '12px', marginTop: '4px', zIndex: 100, maxHeight: '200px', overflowY: 'auto' as const, boxShadow: '0 8px 20px rgba(0,0,0,0.1)' };
const dropdownItem = { padding: '14px', borderBottom: `1px solid ${colors.border}`, fontSize: '14px', fontWeight: '700', cursor: 'pointer', color: colors.primaryDark };
const modalOverlay: any = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' };
const modalCard = { backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' };

export default function AddExpensePage() { return <Suspense><AddExpenseForm /></Suspense> }
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Plus, X, CreditCard, CheckCircle2 } from 'lucide-react'
import { toast, Toaster } from 'sonner'

// SaaS Helper: Έλεγχος αν το ID είναι σωστό UUID
const isValidUUID = (id: any) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return id && id !== 'null' && regex.test(id);
}

function FixedAssetsContent() {
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!isValidUUID(storeId)) return;
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('fixed_assets')
        .select('*')
        .eq('store_id', storeId)
        .order('name')
      if (error) throw error
      setAssets(data || [])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [storeId])

  useEffect(() => {
    if (isValidUUID(storeId)) fetchData()
    else setLoading(false)
  }, [fetchData, storeId])

  const handleSave = async () => {
    // SaaS Guard: Αν το ID είναι NULL, ακυρώνουμε την εγγραφή αμέσως
    if (!isValidUUID(storeId)) {
      return toast.error("Κρίσιμο σφάλμα SaaS: Το ID του καταστήματος λείπει.");
    }

    if (!name.trim()) return toast.error('Δώστε ένα όνομα');
    
    setIsSaving(true)
    try {
      const { error } = await supabase.from('fixed_assets').insert([{ 
        name: name.trim().toUpperCase(), 
        store_id: storeId // Ρητή ανάθεση του ID
      }])
      
      if (error) throw error
      
      toast.success('Αποθηκεύτηκε επιτυχώς!');
      setName('');
      setIsFormOpen(false);
      fetchData(); 
    } catch (err: any) {
      toast.error("Σφάλμα SaaS: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Toaster position="top-center" richColors />
      
      {/* SaaS Context Status */}
      <div style={{ 
        padding: '12px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px',
        backgroundColor: isValidUUID(storeId) ? '#dcfce7' : '#fee2e2',
        border: `2px solid ${isValidUUID(storeId) ? '#22c55e' : '#ef4444'}`
      }}>
        <CheckCircle2 color={isValidUUID(storeId) ? "#22c55e" : "#ef4444"} size={20} />
        <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
          {isValidUUID(storeId) ? `STORE ACTIVE: ${storeId}` : "ΣΦΑΛΜΑ ΣΥΝΔΕΣΗΣ: ΕΠΙΛΕΞΤΕ ΚΑΤΑΣΤΗΜΑ"}
        </div>
      </div>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '45px', height: '45px', backgroundColor: '#0f172a', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🔌</div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Πάγια</h1>
        </div>
        <Link href={`/?store=${storeId}`} style={{ color: '#64748b' }}><X size={20} /></Link>
      </header>

      <button onClick={() => setIsFormOpen(!isFormOpen)} style={addBtnStyle}>
        {isFormOpen ? 'ΑΚΥΡΩΣΗ' : <><Plus size={18} /> ΝΕΟ ΠΑΓΙΟ</>}
      </button>

      {isFormOpen && (
        <div style={formCardStyle}>
          <input 
            value={name} onChange={e => setName(e.target.value)} 
            style={inputStyle} placeholder="Όνομα π.χ. ΕΝΟΙΚΙΟ" autoFocus 
          />
          <button onClick={handleSave} disabled={isSaving || !isValidUUID(storeId)} style={saveBtnStyle}>
            {isSaving ? 'ΚΑΤΑΧΩΡΗΣΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ'}
          </button>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {loading ? <p style={{textAlign:'center'}}>Φόρτωση...</p> : assets.length === 0 ? (
          <div style={emptyCardStyle}><p>Δεν βρέθηκαν πάγια.</p></div>
        ) : (
          assets.map(asset => (
            <div key={asset.id} style={assetCardStyle}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 5px 0' }}>{asset.name}</h3>
                <Link href={`/add-expense?store=${storeId}&assetId=${asset.id}`} style={payLinkStyle}>
                  <CreditCard size={14} /> ΠΛΗΡΩΜΗ →
                </Link>
              </div>
              <button onClick={async () => { await supabase.from('fixed_assets').delete().eq('id', asset.id); fetchData(); }} style={delBtnStyle}>
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// STYLES
const addBtnStyle: any = { width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const formCardStyle: any = { marginTop: '15px', padding: '15px', backgroundColor: 'white', borderRadius: '15px', border: '1px solid #e2e8f0' };
const inputStyle: any = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '10px', boxSizing: 'border-box' };
const saveBtnStyle: any = { width: '100%', padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' };
const assetCardStyle: any = { display: 'flex', justifyContent: 'space-between', padding: '15px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '10px' };
const payLinkStyle: any = { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 'bold', color: '#10b981', textDecoration: 'none' };
const delBtnStyle: any = { background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer' };
const emptyCardStyle: any = { textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '15px', color: '#64748b' };

export default function FixedAssetsPage() { return <Suspense fallback={null}><FixedAssetsContent /></Suspense> }
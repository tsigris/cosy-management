'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Edit2, History, Plus, X, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast, Toaster } from 'sonner'

const isValidUUID = (id: any) => {
  if (!id || id === 'null' || id === 'undefined') return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(id);
}

function FixedAssetsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const fetchAssets = useCallback(async () => {
    if (!isValidUUID(storeId)) {
      setLoading(false);
      return;
    }
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
    if (isValidUUID(storeId)) fetchAssets()
    else setLoading(false)
  }, [fetchAssets, storeId])

  const handleSave = async () => {
    // ΕΛΕΓΧΟΣ ΕΚΤΑΚΤΗΣ ΑΝΑΓΚΗΣ
    if (!isValidUUID(storeId)) {
      alert("ΚΡΙΣΙΜΟ ΣΦΑΛΜΑ: Το ID του καταστήματος λείπει από το URL! Η αποθήκευση ακυρώθηκε.");
      return;
    }

    if (!name.trim()) return toast.error('Δώστε ένα όνομα');
    
    setIsSaving(true)
    try {
      const payload = { 
        name: name.trim().toUpperCase(), 
        store_id: storeId 
      }
      
      console.log("SENDING PAYLOAD:", payload); // Δες το στο console του browser

      const { error } = await supabase.from('fixed_assets').insert([payload])
      
      if (error) throw error
      
      toast.success('Αποθηκεύτηκε επιτυχώς!');
      setName(''); setIsFormOpen(false);
      fetchAssets(); 
    } catch (err: any) {
      toast.error("Αποτυχία: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Toaster position="top-center" richColors />
      
      {/* DEBUG PANEL - ΘΑ ΤΟ ΒΓΑΛΟΥΜΕ ΜΟΛΙΣ ΔΟΥΛΕΨΕΙ */}
      <div style={{ 
        padding: '12px', 
        borderRadius: '12px', 
        marginBottom: '20px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        backgroundColor: isValidUUID(storeId) ? '#dcfce7' : '#fee2e2',
        border: `2px solid ${isValidUUID(storeId) ? '#22c55e' : '#ef4444'}`
      }}>
        {isValidUUID(storeId) ? <CheckCircle2 color="#22c55e" /> : <AlertCircle color="#ef4444" />}
        <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
          {isValidUUID(storeId) ? `STORE ACTIVE: ${storeId}` : "ΣΦΑΛΜΑ: ΤΟ STORE ID ΕΙΝΑΙ NULL!"}
        </div>
      </div>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '45px', height: '45px', backgroundColor: '#0f172a', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🔌</div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Πάγια</h1>
        </div>
        <Link href={`/?store=${storeId}`} style={{ width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <X size={20} color="#64748b" />
        </Link>
      </header>

      <button 
        onClick={() => setIsFormOpen(!isFormOpen)} 
        style={{ width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', borderRadius: '16px', fontWeight: '800', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      >
        {isFormOpen ? 'ΑΚΥΡΩΣΗ' : <><Plus size={18} /> ΝΕΟ ΠΑΓΙΟ</>}
      </button>

      {isFormOpen && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '22px', border: '1px solid #e2e8f0', marginTop: '15px' }}>
          <label style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '6px', display: 'block' }}>ΟΝΟΜΑΣΙΑ ΠΑΓΙΟΥ</label>
          <input 
            value={name} 
            onChange={e => setName(e.target.value)} 
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '600', boxSizing: 'border-box', outline: 'none' }} 
            placeholder="π.χ. ΔΕΗ..." 
          />
          <button 
            onClick={handleSave} 
            disabled={isSaving || !isValidUUID(storeId)} 
            style={{ width: '100%', padding: '16px', backgroundColor: isValidUUID(storeId) ? '#0f172a' : '#94a3b8', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '800', marginTop: '15px', cursor: 'pointer' }}
          >
            {isSaving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΚΑΤΑΧΩΡΗΣΗ'}
          </button>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {loading ? <p style={{textAlign:'center'}}>Φόρτωση...</p> : assets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '22px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontWeight: '700', color: '#64748b' }}>Δεν βρέθηκαν πάγια.</p>
          </div>
        ) : assets.map(asset => (
          <div key={asset.id} style={{ backgroundColor: 'white', padding: '18px', borderRadius: '22px', border: '1px solid #e2e8f0', marginBottom: '12px', display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '0 0 5px 0' }}>{asset.name}</h3>
              <Link href={`/add-expense?store=${storeId}&assetId=${asset.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', padding: '8px 12px', backgroundColor: '#f0fdf4', color: '#10b981', borderRadius: '10px', fontSize: '11px', fontWeight: '800', textDecoration: 'none', border: '1px solid #bbf7d0' }}>
                <CreditCard size={14} /> ΠΛΗΡΩΜΗ →
              </Link>
            </div>
            <button onClick={async () => { await supabase.from('fixed_assets').delete().eq('id', asset.id); fetchAssets(); }} style={{ padding: '10px', color: '#f43f5e', border: 'none', background: 'none' }}><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FixedAssetsPage() { return <Suspense fallback={null}><FixedAssetsContent /></Suspense> }
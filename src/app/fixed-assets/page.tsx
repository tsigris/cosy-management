'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Edit2, History, Plus, X, CreditCard, ChevronLeft, AlertTriangle } from 'lucide-react'
import { toast, Toaster } from 'sonner'

const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  success: '#10b981',
  danger: '#f43f5e',
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  warning: '#f59e0b',
  indigo: '#6366f1'
}

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
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!isValidUUID(storeId)) return;

    try {
      setLoading(true)
      
      // 1. Φέρνουμε μόνο τα πάγια που έχει δημιουργήσει ο χρήστης
      const { data: assetsData, error: assetsErr } = await supabase
        .from('fixed_assets')
        .select('*')
        .eq('store_id', storeId)
        .order('name')

      if (assetsErr) throw assetsErr
      
      const currentAssets = assetsData || []

      // 2. Φέρνουμε συναλλαγές για τα σύνολα
      const { data: transData } = await supabase
        .from('transactions')
        .select('amount, fixed_asset_id')
        .eq('store_id', storeId)
        .not('fixed_asset_id', 'is', null)

      const enriched = currentAssets.map(asset => ({
        ...asset,
        total: transData?.filter(t => t.fixed_asset_id === asset.id)
                        .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0) || 0
      }))

      setAssets(enriched)
    } catch (err) { 
      console.error(err) 
    } finally { 
      setLoading(false) 
    }
  }, [storeId])

  useEffect(() => {
    if (!isValidUUID(storeId)) {
      // Περιμένουμε το storeId να γίνει έγκυρο
    } else {
      fetchData()
    }
  }, [fetchData, storeId])

  const handleSave = async () => {
    if (!isValidUUID(storeId)) {
      toast.error("Σφάλμα αναγνώρισης καταστήματος.");
      return;
    }

    if (!name.trim()) return toast.error('Δώστε ένα όνομα');
    
    setIsSaving(true)
    try {
      const payload = { name: name.trim().toUpperCase(), store_id: storeId }
      
      const { error } = editingId 
        ? await supabase.from('fixed_assets').update(payload).eq('id', editingId)
        : await supabase.from('fixed_assets').insert([payload])
      
      if (error) throw error
      
      toast.success('Αποθηκεύτηκε!');
      setName(''); setEditingId(null); setIsFormOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error("Σφάλμα: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Οριστική διαγραφή παγίου;')) return
    try {
      await supabase.from('fixed_assets').delete().eq('id', id)
      fetchData()
    } catch (err) {
      toast.error('Σφάλμα διαγραφής')
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', minHeight: '100vh', backgroundColor: colors.background }}>
      <Toaster position="top-center" richColors />
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '45px', height: '45px', backgroundColor: colors.primary, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🔌</div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: colors.primary, margin: 0 }}>Πάγια</h1>
            <p style={{ fontSize: '10px', color: colors.secondary, fontWeight: '700', margin: 0 }}>ΔΙΑΧΕΙΡΙΣΗ ΛΟΓΑΡΙΑΣΜΩΝ</p>
          </div>
        </div>
        <Link href={isValidUUID(storeId) ? `/?store=${storeId}` : '/select-store'} style={{ width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px' }}>
          <X size={20} color={colors.secondary} />
        </Link>
      </header>

      <button onClick={() => { setIsFormOpen(!isFormOpen); setEditingId(null); setName(''); }} style={{ width: '100%', padding: '16px', backgroundColor: colors.primary, color: 'white', borderRadius: '16px', fontWeight: '800', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        {isFormOpen ? 'ΑΚΥΡΩΣΗ' : <><Plus size={18} /> ΝΕΟ ΠΑΓΙΟ</>}
      </button>

      {isFormOpen && (
        <div style={{ backgroundColor: colors.surface, padding: '20px', borderRadius: '22px', border: `1px solid ${colors.border}`, marginTop: '15px' }}>
          <label style={{ fontSize: '10px', fontWeight: '800', color: colors.secondary, marginBottom: '6px', display: 'block' }}>ΟΝΟΜΑΣΙΑ ΠΑΓΙΟΥ</label>
          <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, backgroundColor: colors.background, fontWeight: '600', boxSizing: 'border-box', outline: 'none' }} placeholder="π.χ. ΔΕΗ, ΕΝΟΙΚΙΟ..." />
          <button onClick={handleSave} disabled={isSaving} style={{ width: '100%', padding: '16px', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '14px', fontWeight: '800', marginTop: '15px', cursor: 'pointer' }}>
            {isSaving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΚΑΤΑΧΩΡΗΣΗ'}
          </button>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {loading ? (
          <p style={{textAlign:'center', color: colors.secondary}}>Φόρτωση...</p>
        ) : assets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', backgroundColor: colors.surface, borderRadius: '22px', border: `1px solid ${colors.border}` }}>
            <p style={{ fontWeight: '700', color: colors.secondary, margin: 0 }}>Δεν βρέθηκαν πάγια.</p>
            <p style={{ fontSize: '12px', color: colors.secondary }}>Πατήστε το κουμπί παραπάνω για να προσθέσετε το πρώτο σας πάγιο.</p>
          </div>
        ) : (
          assets.map(asset => (
            <div key={asset.id} style={{ backgroundColor: colors.surface, padding: '18px', borderRadius: '22px', border: `1px solid ${colors.border}`, marginBottom: '12px', display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: colors.primary, margin: '0 0 5px 0' }}>{asset.name}</h3>
                <p style={{ fontSize: '13px', fontWeight: '700', color: colors.danger, margin: 0 }}>Σύνολο: -{asset.total.toFixed(2)}€</p>
                <Link href={`/add-expense?store=${storeId}&assetId=${asset.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', padding: '8px 12px', backgroundColor: '#f0fdf4', color: colors.success, borderRadius: '10px', fontSize: '11px', fontWeight: '800', textDecoration: 'none', border: '1px solid #bbf7d0' }}>
                  <CreditCard size={14} /> ΠΛΗΡΩΜΗ →
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => { setEditingId(asset.id); setName(asset.name); setIsFormOpen(true); }} style={{ width: '34px', height: '34px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Edit2 size={16} color={colors.warning} /></button>
                <Link href={`/fixed-assets/history?store=${storeId}&id=${asset.id}&name=${asset.name}`} style={{ width: '34px', height: '34px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><History size={16} color={colors.indigo} /></Link>
                <button onClick={() => handleDelete(asset.id)} style={{ width: '34px', height: '34px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 size={16} color={colors.danger} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function FixedAssetsPage() {
  return <Suspense fallback={null}><FixedAssetsContent /></Suspense>
}
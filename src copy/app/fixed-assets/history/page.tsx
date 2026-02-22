'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Trash2, Edit2, History, Plus, X, CreditCard, ChevronLeft } from 'lucide-react'
import { toast, Toaster } from 'sonner'

const DEFAULT_ASSETS = ['ΔΕΗ / ΡΕΥΜΑ', 'ΕΝΟΙΚΙΟ', 'ΝΕΡΟ / ΕΥΔΑΠ', 'ΛΟΓΙΣΤΗΣ', 'ΤΗΛΕΦΩΝΙΑ / INTERNET', 'ΕΦΟΡΙΑ', 'ΕΦΚΑ', 'ΜΙΣΘΟΔΟΣΙΑ']

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

const isValidUUID = (id: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

function FixedAssetsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdFromUrl = searchParams.get('store')

  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!storeIdFromUrl || !isValidUUID(storeIdFromUrl)) return;

    try {
      setLoading(true)
      
      // 1. Φέρνουμε τα πάγια
      const { data: assetsData, error: assetsErr } = await supabase
        .from('fixed_assets')
        .select('*')
        .eq('store_id', storeIdFromUrl)
        .order('name')

      if (assetsErr) throw assetsErr

      let currentAssets = assetsData || []

      // 2. Auto-create αν είναι άδεια η λίστα
      if (currentAssets.length === 0) {
        const { data: inserted } = await supabase
          .from('fixed_assets')
          .insert(DEFAULT_ASSETS.map(n => ({ name: n, store_id: storeIdFromUrl })))
          .select()
        if (inserted) currentAssets = inserted
      }

      // 3. Φέρνουμε συναλλαγές για τα σύνολα
      const { data: transData } = await supabase
        .from('transactions')
        .select('amount, fixed_asset_id')
        .eq('store_id', storeIdFromUrl)
        .not('fixed_asset_id', 'is', null)

      const enriched = currentAssets.map(asset => {
        const total = transData
          ?.filter(t => t.fixed_asset_id === asset.id)
          .reduce((sum, curr) => sum + Math.abs(Number(curr.amount) || 0), 0) || 0
        return { ...asset, total }
      })

      setAssets(enriched)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [storeIdFromUrl])

  useEffect(() => {
    if (!storeIdFromUrl || !isValidUUID(storeIdFromUrl)) {
      router.replace('/select-store')
    } else {
      fetchData()
    }
  }, [fetchData, storeIdFromUrl, router])

  const handleSave = async () => {
    const storeId = storeIdFromUrl
    if (!name.trim() || !storeId || !isValidUUID(storeId)) return toast.error('Δώστε όνομα')
    setIsSaving(true)
    try {
      const payload = { name: name.trim().toUpperCase(), store_id: storeId }
      const { error } = editingId 
        ? await supabase.from('fixed_assets').update(payload).eq('id', editingId).eq('store_id', storeId)
        : await supabase.from('fixed_assets').insert([payload])
      
      if (error) throw error
      toast.success('Αποθηκεύτηκε!')
      setName(''); setEditingId(null); setIsFormOpen(false);
      fetchData()
    } catch (err: any) { toast.error(err.message) } finally { setIsSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Οριστική διαγραφή;')) return
    const storeId = storeIdFromUrl
    if (!storeId || !isValidUUID(storeId)) {
      toast.error('Λείπει έγκυρο κατάστημα')
      return
    }
    try {
      const { error } = await supabase.from('fixed_assets').delete().eq('id', id).eq('store_id', storeId)
      if (error) throw error
      fetchData()
    } catch (err) { toast.error('Σφάλμα διαγραφής') }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', backgroundColor: colors.background, minHeight: '100vh' }}>
      <Toaster position="top-center" richColors />
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '45px', height: '45px', backgroundColor: colors.primary, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🔌</div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: colors.primary, margin: 0 }}>Πάγια</h1>
            <p style={{ fontSize: '10px', color: colors.secondary, fontWeight: '700', margin: 0 }}>ΔΙΑΧΕΙΡΙΣΗ ΛΟΓΑΡΙΑΣΜΩΝ</p>
          </div>
        </div>
        <Link href={`/?store=${storeIdFromUrl}`} style={{ width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px' }}><X size={20} /></Link>
      </header>

      <button onClick={() => { setIsFormOpen(!isFormOpen); setEditingId(null); setName(''); }} style={{ width: '100%', padding: '16px', backgroundColor: colors.primary, color: 'white', borderRadius: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none', cursor: 'pointer' }}>
        {isFormOpen ? 'ΑΚΥΡΩΣΗ' : <><Plus size={18} /> ΝΕΟ ΠΑΓΙΟ</>}
      </button>

      {isFormOpen && (
        <div style={{ backgroundColor: colors.surface, padding: '20px', borderRadius: '22px', border: `1px solid ${colors.border}`, marginTop: '15px' }}>
          <label style={{ fontSize: '10px', fontWeight: '800', color: colors.secondary, marginBottom: '6px', display: 'block' }}>ΟΝΟΜΑΣΙΑ</label>
          <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, backgroundColor: colors.background, fontWeight: '600', boxSizing: 'border-box', outline: 'none' }} placeholder="π.χ. ΔΕΗ..." />
          <button onClick={handleSave} disabled={isSaving} style={{ width: '100%', padding: '16px', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '14px', fontWeight: '800', marginTop: '15px', cursor: 'pointer' }}>
            {isSaving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΚΑΤΑΧΩΡΗΣΗ'}
          </button>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {loading ? <p style={{textAlign:'center', color: colors.secondary}}>Φόρτωση...</p> : assets.map(asset => (
          <div key={asset.id} style={{ backgroundColor: colors.surface, padding: '18px', borderRadius: '22px', border: `1px solid ${colors.border}`, marginBottom: '12px', display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: colors.primary, margin: '0 0 5px 0' }}>{asset.name}</h3>
              <p style={{ fontSize: '13px', fontWeight: '700', color: colors.danger, margin: 0 }}>Σύνολο: -{asset.total.toFixed(2)}€</p>
              <Link href={`/add-expense?store=${storeIdFromUrl}&assetId=${asset.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', padding: '8px 12px', backgroundColor: '#f0fdf4', color: colors.success, borderRadius: '10px', fontSize: '11px', fontWeight: '800', textDecoration: 'none', border: '1px solid #bbf7d0' }}>
                <CreditCard size={14} /> ΠΛΗΡΩΜΗ →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => { setEditingId(asset.id); setName(asset.name); setIsFormOpen(true); }} style={{ width: '34px', height: '34px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Edit2 size={16} color={colors.warning} /></button>
              <Link href={`/fixed-assets/history?store=${storeIdFromUrl}&id=${asset.id}&name=${asset.name}`} style={{ width: '34px', height: '34px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><History size={16} color={colors.indigo} /></Link>
              <button onClick={() => handleDelete(asset.id)} style={{ width: '34px', height: '34px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 size={16} color={colors.danger} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FixedAssetsPage() {
  return (
    <Suspense fallback={<div style={{padding:'50px', textAlign:'center'}}>Φόρτωση...</div>}>
      <FixedAssetsContent />
    </Suspense>
  )
}
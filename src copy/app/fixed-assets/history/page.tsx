'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Trash2, Edit2, History, Plus, X, CreditCard } from 'lucide-react'
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

function FixedAssetsContent() {
  const [assets, setAssets] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string | null>(null)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', session.user.id).single()
      if (profile?.store_id) {
        setStoreId(profile.store_id)
        const [aRes, tRes] = await Promise.all([
          supabase.from('fixed_assets').select('*').eq('store_id', profile.store_id).order('name'),
          supabase.from('transactions').select('amount, fixed_asset_id').eq('store_id', profile.store_id)
        ])
        setAssets(aRes.data || [])
        setTransactions(tRes.data || [])
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const getTotalSpent = (id: string) => {
    return transactions
      .filter(t => t.fixed_asset_id === id)
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  }

  const handleSave = async () => {
    if (!name || !storeId) return toast.error('Συμπληρώστε το όνομα')
    setIsSaving(true)
    try {
      const payload = { name, description, store_id: storeId }
      const { error } = editingId 
        ? await supabase.from('fixed_assets').update(payload).eq('id', editingId)
        : await supabase.from('fixed_assets').insert([payload])
      
      if (error) throw error
      toast.success(editingId ? 'Ενημερώθηκε' : 'Προστέθηκε')
      setName(''); setDescription(''); setEditingId(null); setIsFormOpen(false);
      fetchData()
    } catch (err: any) { toast.error(err.message) } finally { setIsSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Οριστική διαγραφή παγίου;')) return
    try {
      await supabase.from('fixed_assets').delete().eq('id', id)
      fetchData()
    } catch (err) { toast.error('Σφάλμα διαγραφής') }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Φόρτωση...</div>

  return (
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />
      
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBox}>🔌</div>
          <div>
            <h1 style={titleStyle}>Πάγια & Λογαριασμοί</h1>
            <p style={subtitleStyle}>ΔΙΑΧΕΙΡΙΣΗ ΕΞΟΔΩΝ ({assets.length})</p>
          </div>
        </div>
        <Link href="/" style={closeBtn}><X size={20} /></Link>
      </header>

      <button onClick={() => setIsFormOpen(!isFormOpen)} style={addBtn}>
        {isFormOpen ? 'ΑΚΥΡΩΣΗ' : <><Plus size={18} /> ΝΕΟ ΠΑΓΙΟ / ΛΟΓΑΡΙΑΣΜΟΣ</>}
      </button>

      {isFormOpen && (
        <div style={formCard}>
          <label style={labelStyle}>ΟΝΟΜΑΣΙΑ</label>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="π.χ. ΔΕΗ, ΕΝΟΙΚΙΟ..." />
          <div style={{marginTop: '15px'}}>
            <label style={labelStyle}>ΠΕΡΙΓΡΑΦΗ / ΚΩΔΙΚΟΣ</label>
            <input value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} placeholder="Προαιρετικά..." />
          </div>
          <button onClick={handleSave} disabled={isSaving} style={saveBtn}>
            {isSaving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΚΑΤΑΧΩΡΗΣΗ'}
          </button>
        </div>
      )}

      <div style={{ marginTop: '25px' }}>
        {assets.map(asset => (
          <div key={asset.id} style={assetCard}>
            <div style={{ flex: 1 }}>
              <h3 style={assetNameStyle}>{asset.name.toUpperCase()}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={labelMicro}>ΣΥΝΟΛΟ ΕΞΟΔΩΝ</span>
                <span style={totalAmountStyle}>-{getTotalSpent(asset.id).toFixed(2)}€</span>
              </div>
              
              {asset.description && (
                <div style={descBox}>
                   <span style={{fontWeight:'800', color: colors.indigo, fontSize:'10px'}}>INFO: </span> 
                   {asset.description}
                </div>
              )}
              
              {/* ΔΙΟΡΘΩΜΕΝΟ URL ΓΙΑ ΤΟ ΦΑΚΕΛΟ add-expense */}
              <Link href={`/add-expense?assetId=${asset.id}`} style={payBtn}>
                <CreditCard size={14} /> ΚΑΤΑΧΩΡΗΣΗ ΠΛΗΡΩΜΗΣ →
              </Link>
            </div>

            <div style={sideActions}>
              <button onClick={() => { setEditingId(asset.id); setName(asset.name); setDescription(asset.description || ''); setIsFormOpen(true); }} style={iconBtn}><Edit2 size={16} color={colors.warning} /></button>
              <Link href={`/fixed-assets/history?id=${asset.id}&name=${asset.name}`} style={iconBtn}><History size={16} color={colors.indigo} /></Link>
              <button onClick={() => handleDelete(asset.id)} style={iconBtn}><Trash2 size={16} color={colors.danger} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// STYLES
const containerStyle: any = { maxWidth: '500px', margin: '0 auto', padding: '20px', paddingBottom: '100px' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const logoBox: any = { width: '45px', height: '45px', backgroundColor: colors.primary, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' };
const titleStyle: any = { fontSize: '20px', fontWeight: '800', color: colors.primary, margin: 0 };
const subtitleStyle: any = { fontSize: '10px', color: colors.secondary, fontWeight: '700', margin: 0, letterSpacing: '1px' };
const closeBtn: any = { width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.secondary };
const addBtn: any = { width: '100%', padding: '16px', backgroundColor: colors.primary, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '20px' };
const formCard: any = { backgroundColor: colors.surface, padding: '20px', borderRadius: '22px', border: `1px solid ${colors.border}`, marginBottom: '25px' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, backgroundColor: colors.background, fontWeight: '600', fontSize: '14px', boxSizing: 'border-box' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondary, marginBottom: '6px', display: 'block' };
const saveBtn: any = { width: '100%', padding: '16px', backgroundColor: colors.success, color: 'white', border: 'none', borderRadius: '14px', fontWeight: '800', marginTop: '15px' };
const assetCard: any = { backgroundColor: colors.surface, padding: '20px', borderRadius: '24px', border: `1px solid ${colors.border}`, marginBottom: '15px', display: 'flex', gap: '15px' };
const assetNameStyle: any = { fontSize: '15px', fontWeight: '800', color: colors.primary, margin: '0 0 8px 0' };
const labelMicro: any = { fontSize: '9px', fontWeight: '800', color: colors.secondary };
const totalAmountStyle: any = { fontSize: '14px', fontWeight: '800', color: colors.danger };
const descBox: any = { marginTop: '10px', padding: '8px 12px', backgroundColor: colors.background, borderRadius: '10px', fontSize: '11px', fontWeight: '600', color: colors.secondary, border: `1px solid ${colors.border}` };
const payBtn: any = { display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '15px', padding: '8px 14px', backgroundColor: '#ecfdf5', color: colors.success, borderRadius: '10px', fontSize: '11px', fontWeight: '800', textDecoration: 'none', border: `1px solid ${colors.success}33` };
const sideActions: any = { display: 'flex', flexDirection: 'column', gap: '8px' };
const iconBtn: any = { width: '38px', height: '38px', backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

export default function FixedAssetsPage() {
  return <main style={{ backgroundColor: colors.background, minHeight: '100vh' }}><Suspense fallback={null}><FixedAssetsContent /></Suspense></main>
}
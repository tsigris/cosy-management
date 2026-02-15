'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast, Toaster } from 'sonner'

const DEFAULT_ASSETS = [
  'ΔΕΗ / Ρεύμα', 'Ενοίκιο', 'Νερό / ΕΥΔΑΠ', 'Λογιστής', 
  'Τηλεφωνία / Internet', 'Εφορία', 'ΕΦΚΑ', 'ΕΦΚΑ Υπαλλήλων'
]

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff'
};

function FixedAssetsContent() {
  const router = useRouter()
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRf, setNewRf] = useState('') 
  const [editingId, setEditingId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user.id).single()
      
      if (profile?.store_id) {
        const sId = profile.store_id
        setStoreId(sId)

        let { data: assetsData } = await supabase.from('fixed_assets').select('*').eq('store_id', sId).order('name')
        
        if (assetsData && assetsData.length === 0) {
          await supabase.from('fixed_assets').insert(
            DEFAULT_ASSETS.map(name => ({ name, store_id: sId }))
          )
          const { data: newData } = await supabase.from('fixed_assets').select('*').eq('store_id', sId).order('name')
          assetsData = newData
        }

        const { data: transData } = await supabase.from('transactions')
            .select('amount, fixed_asset_id')
            .eq('store_id', sId)

        if (assetsData) {
          const enriched = assetsData.map(asset => {
            const total = transData
              ?.filter(t => t.fixed_asset_id === asset.id)
              .reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0) || 0
            return { ...asset, total }
          })
          setAssets(enriched)
        }
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  async function handleSave() {
    if (!newName.trim()) return
    setLoading(true)

    try {
      const payload = { name: newName, rf_code: newRf, store_id: storeId }
      if (editingId) {
        await supabase.from('fixed_assets').update(payload).eq('id', editingId)
      } else {
        await supabase.from('fixed_assets').insert([payload])
      }
      setNewName(''); setNewRf(''); setEditingId(null); setIsAdding(false)
      fetchAssets()
      toast.success('Αποθηκεύτηκε επιτυχώς')
    } catch (err) { toast.error('Σφάλμα αποθήκευσης') } finally { setLoading(false) }
  }

  async function handleDelete(id: string) {
    if (confirm('Διαγραφή παγίου; Το ιστορικό του στις κινήσεις θα παραμείνει.')) {
      await supabase.from('fixed_assets').delete().eq('id', id)
      fetchAssets()
    }
  }

  const handleCopy = (e: React.MouseEvent, rf: string) => {
    e.stopPropagation() 
    navigator.clipboard.writeText(rf)
    toast.success('Ο κωδικός RF αντιγράφηκε!')
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '120px' }}>
        
        <div style={headerWrapper}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>🔌</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '24px', margin: 0, color: colors.primaryDark }}>Πάγια</h1>
              <p style={subHeaderStyle}>ΔΙΑΧΕΙΡΙΣΗ ΛΟΓΑΡΙΑΣΜΩΝ</p>
            </div>
          </div>
          <Link href="/" style={backBtnStyle}>✕</Link>
        </div>

        <button onClick={() => { setIsAdding(!isAdding); setEditingId(null); setNewName(''); setNewRf('') }} style={isAdding ? cancelBtn : addBtn}>
          {isAdding ? 'ΑΚΥΡΩΣΗ' : '+ ΝΕΟ ΠΑΓΙΟ / ΛΟΓΑΡΙΑΣΜΟΣ'}
        </button>

        {isAdding && (
          <div style={{...formCard, borderColor: editingId ? '#f59e0b' : colors.primaryDark}}>
            <p style={labelStyle}>ΟΝΟΜΑ ΠΑΓΙΟΥ</p>
            <input 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              placeholder="π.χ. ΔΕΗ, Ενοίκιο..." 
              style={inputStyle} 
            />
            
            <p style={labelStyle}>ΚΩΔΙΚΟΣ ΠΛΗΡΩΜΗΣ (RF)</p>
            <input 
              value={newRf} 
              onChange={e => setNewRf(e.target.value)} 
              placeholder="RF00 0000..." 
              style={inputStyle} 
            />
            
            <button onClick={handleSave} style={{...saveBtn, backgroundColor: editingId ? '#f59e0b' : colors.primaryDark}}>
               {editingId ? 'ΕΝΗΜΕΡΩΣΗ ΑΛΛΑΓΩΝ' : 'ΠΡΟΣΘΗΚΗ ΣΤΗ ΛΙΣΤΑ'}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
          {loading ? (
             <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Φόρτωση...</div>
          ) : assets.map(asset => (
            <div key={asset.id} style={assetCard}>
              <div style={{ flex: 1 }}>
                <div 
                  onClick={() => router.push(`/fixed-assets/history?id=${asset.id}&name=${asset.name}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: '800', color: colors.primaryDark, fontSize: '15px' }}>{asset.name.toUpperCase()}</div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                     <span style={badgeStyle}>ΣΥΝΟΛΟ ΕΞΟΔΩΝ</span>
                     <span style={{ fontSize: '14px', color: colors.accentRed, fontWeight: '900' }}>
                       -{asset.total.toFixed(2)}€
                     </span>
                  </div>
                </div>

                {asset.rf_code && asset.rf_code.trim() !== '' && (
                  <div 
                    onClick={(e) => handleCopy(e, asset.rf_code)}
                    style={rfBadgeStyle}
                  >
                    <span style={{ fontSize: '10px', fontWeight: '900' }}>RF: {asset.rf_code}</span>
                    <span style={{ marginLeft: '6px' }}>📋</span>
                  </div>
                )}

                {/* ΔΙΟΡΘΩΣΗ: ΑΛΛΑΓΗ ΑΠΟ /expenses/add ΣΕ /add-expense */}
                <button 
                  onClick={() => router.push(`/add-expense?assetId=${asset.id}`)}
                  style={payBtnStyle}
                >
                  ΚΑΤΑΧΩΡΗΣΗ ΠΛΗΡΩΜΗΣ →
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: '10px' }}>
                <button onClick={() => { setEditingId(asset.id); setNewName(asset.name); setNewRf(asset.rf_code || ''); setIsAdding(true); }} style={editBtnSmall}>✎</button>
                <button onClick={() => handleDelete(asset.id)} style={delBtnSmall}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// STYLES
const iphoneWrapper: any = { 
  backgroundColor: colors.bgLight, 
  minHeight: '100dvh', 
  padding: '20px', 
  overflowY: 'auto', 
  position: 'absolute', 
  top: 0, 
  left: 0, 
  right: 0, 
  bottom: 0 
};
const headerWrapper: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '15px' };
const subHeaderStyle: any = { margin: '2px 0 0', fontSize: '10px', color: colors.secondaryText, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' };
const logoBoxStyle: any = { width: '48px', height: '48px', backgroundColor: colors.primaryDark, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '22px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` };
const assetCard: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px', backgroundColor: 'white', borderRadius: '22px', border: `1px solid ${colors.border}` };
const addBtn: any = { width: '100%', padding: '16px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '13px', cursor: 'pointer', marginBottom: '20px' };
const cancelBtn: any = { ...addBtn, backgroundColor: colors.white, color: colors.secondaryText, border: `1px solid ${colors.border}` };
const formCard: any = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', border: '2px solid', marginBottom: '20px' };
const labelStyle: any = { fontSize: '10px', fontWeight: '900', color: colors.secondaryText, marginBottom: '8px', textTransform: 'uppercase' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '14px', border: `1px solid ${colors.border}`, marginBottom: '15px', boxSizing: 'border-box', fontWeight: 'bold', fontSize: '16px', backgroundColor: colors.bgLight, outline: 'none' };
const saveBtn: any = { width: '100%', padding: '16px', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '900', fontSize: '15px', cursor: 'pointer' };
const badgeStyle: any = { fontSize: '9px', fontWeight: '800', backgroundColor: colors.bgLight, padding: '4px 8px', borderRadius: '6px', color: colors.secondaryText };
const rfBadgeStyle: any = { display: 'inline-flex', alignItems: 'center', padding: '6px 10px', backgroundColor: '#eff6ff', borderRadius: '8px', color: '#2563eb', border: '1px solid #dbeafe', marginTop: '6px', cursor: 'pointer' };
const payBtnStyle: any = { display: 'inline-block', marginTop: '12px', fontSize: '10px', fontWeight: '900', color: colors.accentGreen, textDecoration: 'none', backgroundColor: '#f0fdf4', padding: '8px 12px', borderRadius: '10px', border: '1px solid #bbf7d0', cursor: 'pointer' };
const editBtnSmall: any = { backgroundColor: '#fef3c7', color: '#d97706', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px' };
const delBtnSmall: any = { backgroundColor: '#fee2e2', color: colors.accentRed, border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px' };

export default function FixedAssetsPage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><FixedAssetsContent /></Suspense></main>
}
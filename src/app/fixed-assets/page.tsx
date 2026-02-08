'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const DEFAULT_ASSETS = [
  'ΔΕΗ / Ρεύμα', 'Ενοίκιο', 'Νερό / ΕΥΔΑΠ', 'Λογιστής', 
  'Τηλεφωνία / Internet', 'Εφορία', 'ΕΦΚΑ', 'ΕΦΚΑ Υπαλλήλων'
]

function FixedAssetsContent() {
  const router = useRouter()
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)

  useEffect(() => { fetchAssets() }, [])

  async function fetchAssets() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user.id).single()
      
      if (profile?.store_id) {
        const sId = profile.store_id
        setStoreId(sId)

        // 1. Φέρνουμε τα πάγια του καταστήματος
        let { data: assetsData } = await supabase.from('fixed_assets').select('*').eq('store_id', sId).order('name')
        
        // 2. Αν είναι νέο κατάστημα, βάζουμε τα Default
        if (assetsData && assetsData.length === 0) {
          await supabase.from('fixed_assets').insert(
            DEFAULT_ASSETS.map(name => ({ name, store_id: sId }))
          )
          const { data: newData } = await supabase.from('fixed_assets').select('*').eq('store_id', sId).order('name')
          assetsData = newData
        }

        // 3. Φέρνουμε τις συναλλαγές για υπολογισμό συνόλων
        const { data: transData } = await supabase.from('transactions')
            .select('amount, fixed_asset_id')
            .eq('store_id', sId)
            .eq('category', 'Πάγια')

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
  }

  async function handleSave() {
    if (!newName.trim()) return
    setLoading(true)

    try {
      if (editingId) {
        await supabase.from('fixed_assets').update({ name: newName }).eq('id', editingId)
      } else {
        await supabase.from('fixed_assets').insert([{ name: newName, store_id: storeId }])
      }
      setNewName(''); setEditingId(null); setIsAdding(false)
      fetchAssets()
    } catch (err) { alert('Σφάλμα αποθήκευσης') } finally { setLoading(false) }
  }

  async function handleDelete(id: string) {
    if (confirm('Διαγραφή παγίου; Το ιστορικό του στις κινήσεις θα παραμείνει ως "Πάγια".')) {
      await supabase.from('fixed_assets').delete().eq('id', id)
      fetchAssets()
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* PROFESSIONAL GRAPHIC HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>
            <span style={{ fontSize: '20px' }}>🔌</span>
          </div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
              Πάγια
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ΔΙΑΧΕΙΡΙΣΗ ΕΞΟΠΛΙΣΜΟΥ
            </p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      <button onClick={() => { setIsAdding(!isAdding); setEditingId(null); setNewName('') }} style={isAdding ? cancelBtn : addBtn}>
        {isAdding ? 'ΑΚΥΡΩΣΗ' : '+ ΝΕΟ ΠΑΓΙΟ / ΛΟΓΑΡΙΑΣΜΟΣ'}
      </button>

      {isAdding && (
        <div style={{...formCard, borderColor: editingId ? '#f59e0b' : '#0f172a'}}>
          <p style={labelStyle}>{editingId ? 'ΔΙΟΡΘΩΣΗ ΟΝΟΜΑΤΟΣ' : 'ΟΝΟΜΑ ΠΑΓΙΟΥ / ΛΟΓΑΡΙΑΣΜΟΥ'}</p>
          <input 
            value={newName} 
            onChange={e => setNewName(e.target.value)} 
            placeholder="π.χ. ΔΕΗ, Ενοίκιο..." 
            style={inputStyle} 
            autoFocus
          />
          <button onClick={handleSave} style={{...saveBtn, backgroundColor: editingId ? '#f59e0b' : '#0f172a'}}>
             {editingId ? 'ΕΝΗΜΕΡΩΣΗ ΑΛΛΑΓΩΝ' : 'ΠΡΟΣΘΗΚΗ ΣΤΗ ΛΙΣΤΑ'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Καταγεγραμμένα Πάγια ({assets.length})</p>
        
        {loading ? (
           <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Φόρτωση...</div>
        ) : assets.map(asset => (
          <div key={asset.id} style={assetCard}>
            <div 
              onClick={() => router.push(`/fixed-assets/history?id=${asset.id}&name=${asset.name}`)}
              style={{ flex: 1, cursor: 'pointer' }}
            >
              <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '15px' }}>{asset.name.toUpperCase()}</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                 <span style={badgeStyle}>ΣΥΝΟΛΟ ΕΞΟΔΩΝ</span>
                 <span style={{ fontSize: '14px', color: '#dc2626', fontWeight: '900' }}>
                   -{asset.total.toFixed(2)}€
                 </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => { setEditingId(asset.id); setNewName(asset.name); setIsAdding(true); window.scrollTo(0,0); }} style={editBtnSmall}>✎</button>
              <button onClick={() => handleDelete(asset.id)} style={delBtnSmall}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// STYLES
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' };
const assetCard: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'white', borderRadius: '22px', border: '1px solid #f1f5f9' };
const addBtn: any = { width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '13px', cursor: 'pointer', marginBottom: '20px' };
const cancelBtn: any = { ...addBtn, backgroundColor: '#f1f5f9', color: '#64748b' };
const formCard: any = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', border: '2px solid', marginBottom: '20px' };
const labelStyle: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '15px', boxSizing: 'border-box', fontWeight: 'bold', fontSize: '16px', backgroundColor: '#f8fafc', outline: 'none' };
const saveBtn: any = { width: '100%', padding: '16px', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '900', fontSize: '15px', cursor: 'pointer' };
const badgeStyle: any = { fontSize: '9px', fontWeight: '800', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', color: '#64748b' };
const editBtnSmall: any = { backgroundColor: '#fef3c7', color: '#d97706', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px' };
const delBtnSmall: any = { backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px' };

export default function FixedAssetsPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><FixedAssetsContent /></Suspense>
    </main>
  )
}
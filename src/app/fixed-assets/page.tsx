'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const DEFAULT_ASSETS = [
  'ΔΕΗ / Ρεύμα', 'Ενοίκιο', 'Νερό / ΕΥΔΑΠ', 'Λογιστής', 
  'Τηλεφωνία / Internet', 'Εφορία', 'ΕΦΚΑ', 'ΕΦΚΑ Υπαλλήλων'
]

export default function FixedAssetsPage() {
  const router = useRouter()
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => { fetchAssets() }, [])

  async function fetchAssets() {
    setLoading(true)
    
    // 1. Παίρνουμε το user session για το store_id
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user?.id).single()
    const store_id = profile?.store_id

    // 2. Φέρνουμε τα πάγια
    let { data: assetsData } = await supabase.from('fixed_assets').select('*').order('name')
    
    // Αν είναι νέο κατάστημα, βάζουμε τα Default
    if (assetsData && assetsData.length === 0 && store_id) {
      await supabase.from('fixed_assets').insert(
        DEFAULT_ASSETS.map(name => ({ name, store_id }))
      )
      const { data: newData } = await supabase.from('fixed_assets').select('*').order('name')
      assetsData = newData
    }

    // 3. Φέρνουμε τις συναλλαγές για υπολογισμό συνόλων
    const { data: transData } = await supabase.from('transactions').select('amount, fixed_asset_id').eq('category', 'Πάγια')

    if (assetsData) {
      const enriched = assetsData.map(asset => {
        const total = transData
          ?.filter(t => t.fixed_asset_id === asset.id)
          .reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0) || 0
        return { ...asset, total }
      })
      setAssets(enriched)
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!newName.trim()) return
    
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user?.id).single()

    const payload = { name: newName, store_id: profile?.store_id }

    if (editingId) {
      await supabase.from('fixed_assets').update({ name: newName }).eq('id', editingId)
    } else {
      await supabase.from('fixed_assets').insert([payload])
    }

    setNewName('')
    setEditingId(null)
    setIsAdding(false)
    fetchAssets()
  }

  async function handleDelete(id: string) {
    if (confirm('Διαγραφή παγίου και του ιστορικού του;')) {
      await supabase.from('fixed_assets').delete().eq('id', id)
      fetchAssets()
    }
  }

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>← ΠΙΣΩ</Link>
            <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Πάγια</h1>
          </div>
          <button onClick={() => { setIsAdding(!isAdding); setEditingId(null); setNewName('') }} style={isAdding ? cancelBtn : addBtn}>
            {isAdding ? 'ΑΚΥΡΟ' : '+ ΝΕΟ'}
          </button>
        </div>

        {isAdding && (
          <div style={{...formCard, borderColor: editingId ? '#f59e0b' : '#2563eb'}}>
            <p style={labelStyle}>
              {editingId ? 'ΔΙΟΡΘΩΣΗ ΟΝΟΜΑΤΟΣ' : 'ΟΝΟΜΑ ΠΑΓΙΟΥ / ΛΟΓΑΡΙΑΣΜΟΥ'}
            </p>
            <input 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              placeholder="π.χ. ΔΕΗ, Ενοίκιο..." 
              style={inputStyle} 
              autoFocus
            />
            <button onClick={handleSave} style={{...saveBtn, backgroundColor: editingId ? '#f59e0b' : '#10b981'}}>
               {editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΠΡΟΣΘΗΚΗ ΠΑΓΙΟΥ'}
            </button>
          </div>
        )}

        {/* LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
             <p style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 'bold' }}>Φόρτωση...</p>
          ) : assets.map(asset => (
            <div key={asset.id} style={assetCard}>
              <div 
                onClick={() => router.push(`/fixed-assets/history?id=${asset.id}&name=${asset.name}`)}
                style={{ flex: 1, cursor: 'pointer' }}
              >
                <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '16px' }}>{asset.name}</div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                   <span style={badgeStyle}>ΠΑΓΙΟ ΕΞΟΔΟ</span>
                   <span style={{ fontSize: '14px', color: '#dc2626', fontWeight: '900' }}>
                     -{asset.total.toFixed(2)}€
                   </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  onClick={() => { setEditingId(asset.id); setNewName(asset.name); setIsAdding(true); }} 
                  style={editBtnSmall}
                >✎</button>
                <button onClick={() => handleDelete(asset.id)} style={delBtnSmall}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

// STYLES
const assetCard = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px', backgroundColor: 'white', borderRadius: '22px', border: '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const addBtn = { padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' };
const cancelBtn = { padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' };
const formCard = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', border: '2px solid', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
const labelStyle = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' as const };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '15px', boxSizing: 'border-box' as const, fontWeight: 'bold', fontSize: '16px', backgroundColor: '#f8fafc' };
const saveBtn = { width: '100%', padding: '16px', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '900', fontSize: '15px', cursor: 'pointer' };
const badgeStyle = { fontSize: '9px', fontWeight: '800', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', color: '#64748b', textTransform: 'uppercase' as const };
const editBtnSmall = { backgroundColor: '#fef3c7', color: '#d97706', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px' };
const delBtnSmall = { backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px' };
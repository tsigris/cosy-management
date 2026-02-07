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
    let { data: assetsData } = await supabase.from('fixed_assets').select('*').order('name')
    
    if (assetsData && assetsData.length === 0) {
      await supabase.from('fixed_assets').insert(DEFAULT_ASSETS.map(name => ({ name })))
      const { data: newData } = await supabase.from('fixed_assets').select('*').order('name')
      assetsData = newData
    }

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
    
    if (editingId) {
      await supabase.from('fixed_assets').update({ name: newName }).eq('id', editingId)
    } else {
      await supabase.from('fixed_assets').insert([{ name: newName }])
    }

    setNewName('')
    setEditingId(null)
    setIsAdding(false)
    fetchAssets()
  }

  async function handleDelete(id: string) {
    if (confirm('Διαγραφή παγίου;')) {
      await supabase.from('fixed_assets').delete().eq('id', id)
      fetchAssets()
    }
  }

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>← ΠΙΣΩ</Link>
            <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Πάγια</h1>
          </div>
          <button onClick={() => { setIsAdding(!isAdding); setEditingId(null); setNewName('') }} style={addBtn}>
            {isAdding ? 'ΑΚΥΡΟ' : '+ ΝΕΟ'}
          </button>
        </div>

        {isAdding && (
          <div style={formCard}>
            <p style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px' }}>
              {editingId ? 'ΔΙΟΡΘΩΣΗ ΟΝΟΜΑΤΟΣ' : 'ΟΝΟΜΑ ΠΑΓΙΟΥ'}
            </p>
            <input 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              placeholder="π.χ. Δημοτικά Τέλη..." 
              style={inputStyle} 
              autoFocus
            />
            <button onClick={handleSave} style={saveBtn}>ΑΠΟΘΗΚΕΥΣΗ</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {assets.map(asset => (
            <div key={asset.id} style={assetCard}>
              {/* Αριστερό μέρος: Όνομα και Ποσό (Πατώντας εδώ πάει στο ιστορικό) */}
              <div 
                onClick={() => router.push(`/fixed-assets/history?id=${asset.id}&name=${asset.name}`)}
                style={{ flex: 1, cursor: 'pointer' }}
              >
                <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '16px' }}>{asset.name}</div>
                <div style={{ fontWeight: '900', color: '#ef4444', fontSize: '17px', marginTop: '4px' }}>
                  -{asset.total.toFixed(2)}€
                </div>
              </div>

              {/* Δεξί μέρος: Κουμπιά (Δεν επηρεάζονται από το κλικ του ιστορικού) */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => { setEditingId(asset.id); setNewName(asset.name); setIsAdding(true); }} 
                  style={editBtnSmall}
                >
                  ✎
                </button>
                <button onClick={() => handleDelete(asset.id)} style={delBtnSmall}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

// STYLES
const assetCard = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px', backgroundColor: 'white', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const addBtn = { padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '12px' };
const formCard = { backgroundColor: 'white', padding: '20px', borderRadius: '18px', border: '1px solid #e2e8f0', marginBottom: '20px' };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '15px', boxSizing: 'border-box' as const, fontWeight: 'bold' };
const saveBtn = { width: '100%', padding: '14px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900' };
const editBtnSmall = { backgroundColor: '#eff6ff', color: '#2563eb', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '16px' };
const delBtnSmall = { backgroundColor: '#fef2f2', color: '#ef4444', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '16px' };
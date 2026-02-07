'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const DEFAULT_ASSETS = [
  'ΔΕΗ / Ρεύμα', 'Ενοίκιο', 'Νερό / ΕΥΔΑΠ', 'Λογιστής', 
  'Τηλεφωνία / Internet', 'Εφορία', 'ΕΦΚΑ', 'ΕΦΚΑ Υπαλλήλων'
]

export default function FixedAssetsPage() {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => { fetchAssets() }, [])

  async function fetchAssets() {
    setLoading(true)
    // Φέρνουμε τα πάγια
    let { data: assetsData } = await supabase.from('fixed_assets').select('*').order('name')
    
    // Αν είναι άδεια η λίστα, δημιούργησε τα προεπιλεγμένα
    if (assetsData && assetsData.length === 0) {
      await supabase.from('fixed_assets').insert(DEFAULT_ASSETS.map(name => ({ name })))
      const { data: newData } = await supabase.from('fixed_assets').select('*').order('name')
      assetsData = newData
    }

    // Φέρνουμε τις συναλλαγές για να βγάλουμε τα σύνολα
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

  async function handleAdd() {
    if (!newName.trim()) return
    const { error } = await supabase.from('fixed_assets').insert([{ name: newName.trim() }])
    if (!error) {
      setNewName('')
      setIsAdding(false)
      fetchAssets()
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault() // Για να μην ανοίξει το Link
    if (confirm('Διαγραφή παγίου και ιστορικού;')) {
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
          <button onClick={() => setIsAdding(!isAdding)} style={addBtn}>
            {isAdding ? 'ΑΚΥΡΟ' : '+ ΝΕΟ'}
          </button>
        </div>

        {isAdding && (
          <div style={formCard}>
            <input 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              placeholder="Όνομα παγίου..." 
              style={inputStyle} 
            />
            <button onClick={handleAdd} style={saveBtn}>ΠΡΟΣΘΗΚΗ</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {assets.map(asset => (
            <Link 
              key={asset.id} 
              href={`/fixed-assets/history?id=${asset.id}&name=${asset.name}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={assetCard}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '16px' }}>{asset.name}</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '800', marginTop: '4px' }}>ΣΥΝΟΛΟ ΕΞΟΔΩΝ</div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ fontWeight: '900', color: '#ef4444', fontSize: '17px' }}>
                    {asset.total > 0 ? `-${asset.total.toFixed(2)}€` : '0.00€'}
                  </div>
                  <button onClick={(e) => handleDelete(asset.id, e)} style={delBtnSmall}>🗑️</button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}

// STYLES
const assetCard = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'white', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const addBtn = { padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '12px' };
const formCard = { backgroundColor: 'white', padding: '15px', borderRadius: '18px', border: '1px solid #e2e8f0', marginBottom: '20px' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '10px', boxSizing: 'border-box' as const };
const saveBtn = { width: '100%', padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '900' };
const delBtnSmall = { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '5px' };
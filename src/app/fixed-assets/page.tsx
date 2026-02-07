'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function FixedAssetsPage() {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => { fetchAssets() }, [])

  async function fetchAssets() {
    setLoading(true)
    const { data } = await supabase.from('fixed_assets').select('*').order('name')
    if (data) setAssets(data)
    setLoading(false)
  }

  async function handleSave() {
    if (!newName.trim()) return
    const { error } = editingId 
      ? await supabase.from('fixed_assets').update({ name: newName }).eq('id', editingId)
      : await supabase.from('fixed_assets').insert([{ name: newName }])
    
    if (!error) {
      setNewName('')
      setEditingId(null)
      setIsAdding(false)
      fetchAssets()
    }
  }

  async function handleDelete(id: string) {
    if (confirm('Διαγραφή παγίου;')) {
      await supabase.from('fixed_assets').delete().eq('id', id)
      fetchAssets()
    }
  }

  return (
    <main style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#64748b' }}>← Πίσω</Link>
        <h1 style={{ fontSize: '22px', fontWeight: '900' }}>Διαχείριση Παγίων</h1>
        <button onClick={() => setIsAdding(!isAdding)} style={addBtnStyle}>+</button>
      </div>

      {isAdding && (
        <div style={formStyle}>
          <input 
            value={newName} 
            onChange={e => setNewName(e.target.value)} 
            placeholder="Όνομα Παγίου (π.χ. ΔΕΗ)" 
            style={inputStyle} 
          />
          <button onClick={handleSave} style={saveBtnStyle}>Αποθήκευση</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {assets.map(asset => (
          <div key={asset.id} style={cardStyle}>
            <span style={{ fontWeight: 'bold' }}>{asset.name}</span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => {setEditingId(asset.id); setNewName(asset.name); setIsAdding(true)}} style={editBtn}>✎</button>
              <button onClick={() => handleDelete(asset.id)} style={deleteBtn}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

// STYLES
const cardStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', marginBottom: '10px' };
const addBtnStyle = { width: '40px', height: '40px', borderRadius: '20px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontSize: '24px', cursor: 'pointer' };
const saveBtnStyle = { width: '100%', padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' };
const formStyle = { backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', marginBottom: '20px' };
const editBtn = { border: 'none', background: '#fef3c7', padding: '8px', borderRadius: '6px', cursor: 'pointer' };
const deleteBtn = { border: 'none', background: '#fee2e2', padding: '8px', borderRadius: '6px', cursor: 'pointer' };
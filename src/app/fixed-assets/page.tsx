'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// Η λίστα με τα προκαθορισμένα πάγια που ζήτησες
const DEFAULT_ASSETS = [
  'ΔΕΗ / Ρεύμα',
  'Ενοίκιο',
  'Νερό / ΕΥΔΑΠ',
  'Λογιστής',
  'Τηλεφωνία / Internet',
  'Εφορία',
  'ΕΦΚΑ',
  'ΕΦΚΑ Υπαλλήλων'
]

export default function FixedAssetsPage() {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => { fetchAssets() }, [])

  async function fetchAssets() {
    setLoading(true)
    
    // 1. Φέρνουμε τα υπάρχοντα πάγια
    let { data, error } = await supabase.from('fixed_assets').select('*').order('name')
    
    // 2. Αν η λίστα είναι άδεια (νέος χρήστης), τα δημιουργούμε αυτόματα
    if (data && data.length === 0) {
      const initialAssets = DEFAULT_ASSETS.map(name => ({ name }))
      const { data: insertedData, error: insertError } = await supabase
        .from('fixed_assets')
        .insert(initialAssets)
        .select()
      
      if (!insertError && insertedData) {
        data = insertedData
      }
    }

    if (data) setAssets(data)
    setLoading(false)
  }

  async function handleSave() {
    if (!newName.trim()) return
    setLoading(true)
    
    const { error } = editingId 
      ? await supabase.from('fixed_assets').update({ name: newName }).eq('id', editingId)
      : await supabase.from('fixed_assets').insert([{ name: newName }])
    
    if (!error) {
      setNewName('')
      setEditingId(null)
      setIsAdding(false)
      fetchAssets()
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (confirm('Προσοχή! Η διαγραφή του παγίου δεν θα διαγράψει τις παλιές συναλλαγές, αλλά θα αφαιρέσει την κατηγορία. Σίγουρα;')) {
      await supabase.from('fixed_assets').delete().eq('id', id)
      fetchAssets()
    }
  }

  return (
    <main style={{ padding: '16px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 'bold' }}>← Πίσω</Link>
        <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Διαχείριση Παγίων</h1>
        <button onClick={() => { setIsAdding(!isAdding); setEditingId(null); setNewName(''); }} style={addBtnStyle}>+</button>
      </div>

      {/* ΦΟΡΜΑ ΠΡΟΣΘΗΚΗΣ/ΕΠΕΞΕΡΓΑΣΙΑΣ */}
      {isAdding && (
        <div style={formCardStyle}>
          <p style={labelStyle}>{editingId ? 'ΕΠΕΞΕΡΓΑΣΙΑ ΟΝΟΜΑΤΟΣ' : 'ΠΡΟΣΘΗΚΗ ΝΕΟΥ ΠΑΓΙΟΥ'}</p>
          <input 
            value={newName} 
            onChange={e => setNewName(e.target.value)} 
            placeholder="π.χ. Δημοτικά Τέλη" 
            style={inputStyle} 
            autoFocus
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSave} style={saveBtnStyle}>Αποθήκευση</button>
            <button onClick={() => setIsAdding(false)} style={cancelBtnStyle}>Άκυρο</button>
          </div>
        </div>
      )}

      {/* ΛΙΣΤΑ ΠΑΓΙΩΝ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading && <p style={{ textAlign: 'center', color: '#64748b' }}>Φόρτωση...</p>}
        
        {!loading && assets.map(asset => (
          <div key={asset.id} style={cardStyle}>
            <span style={{ fontWeight: '800', color: '#334155' }}>{asset.name}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => {setEditingId(asset.id); setNewName(asset.name); setIsAdding(true)}} style={editBtn}>✎</button>
              <button onClick={() => handleDelete(asset.id)} style={deleteBtn}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

// STYLES - ΕΠΑΓΓΕΛΜΑΤΙΚΟ LOOK
const cardStyle = { 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  padding: '18px', 
  backgroundColor: 'white', 
  borderRadius: '16px', 
  border: '1px solid #e2e8f0',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
};

const inputStyle = { 
  width: '100%', 
  padding: '14px', 
  borderRadius: '12px', 
  border: '1px solid #cbd5e1', 
  marginBottom: '15px',
  fontSize: '16px',
  fontWeight: 'bold',
  boxSizing: 'border-box' as const
};

const addBtnStyle = { 
  width: '45px', 
  height: '45px', 
  borderRadius: '50%', 
  border: 'none', 
  backgroundColor: '#2563eb', 
  color: 'white', 
  fontSize: '28px', 
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)'
};

const saveBtnStyle = { flex: 1, padding: '14px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' };
const cancelBtnStyle = { flex: 1, padding: '14px', backgroundColor: '#94a3b8', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' };
const formCardStyle = { backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: '2px solid #e2e8f0', marginBottom: '20px' };
const labelStyle = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' as const };
const editBtn = { border: 'none', background: '#eff6ff', color: '#2563eb', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' };
const deleteBtn = { border: 'none', background: '#fef2f2', color: '#ef4444', padding: '10px', borderRadius: '10px', cursor: 'pointer' };
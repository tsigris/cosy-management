'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function SuppliersContent() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({ name: '', phone: '', vat_number: '' })

  useEffect(() => { fetchInitialData() }, [])

  async function fetchInitialData() {
    setLoading(true)
    const { data: sups } = await supabase.from('suppliers').select('*').order('name')
    const { data: trans } = await supabase.from('transactions').select('*').order('date', { ascending: false })
    if (sups) setSuppliers(sups)
    if (trans) setTransactions(trans)
    setLoading(false)
  }

  const getTurnover = (id: string) => {
    return transactions
      .filter(t => t.supplier_id === id)
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  }

  async function handleSave() {
    if (!formData.name.trim()) return alert('Το όνομα είναι υποχρεωτικό!')
    setLoading(true)
    const payload = { 
        name: formData.name.trim(), 
        phone: formData.phone.trim() || null, 
        vat_number: formData.vat_number.trim() || null 
    }
    const { error } = editingId 
      ? await supabase.from('suppliers').update(payload).eq('id', editingId)
      : await supabase.from('suppliers').insert([payload])

    if (!error) {
      setEditingId(null); setFormData({name:'', phone:'', vat_number:''}); setIsAdding(false); fetchInitialData();
    } else {
      alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '15px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => router.push('/')} style={backBtnStyle}>←</button>
        <h2 style={{ fontWeight: '900', margin: 0 }}>Προμηθευτές</h2>
        <button onClick={() => { setIsAdding(!isAdding); setEditingId(null); }} style={addBtnStyle}>
          {isAdding ? 'Άκυρο' : '+ Νέος'}
        </button>
      </div>

      {isAdding && (
        <div style={formBoxStyle}>
          <label style={labelStyle}>ΟΝΟΜΑ ΠΡΟΜΗΘΕΥΤΗ *</label>
          <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={inputStyle} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{flex:1}}><label style={labelStyle}>ΤΗΛΕΦΩΝΟ</label><input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={inputStyle} /></div>
            <div style={{flex:1}}><label style={labelStyle}>Α.Φ.Μ.</label><input value={formData.vat_number} onChange={e => setFormData({...formData, vat_number: e.target.value})} style={inputStyle} /></div>
          </div>
          <button onClick={handleSave} style={saveBtnStyle}>{editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΑΠΟΘΗΚΕΥΣΗ'}</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {suppliers.map(s => {
          const isSelected = selectedSupplierId === s.id
          const sTrans = transactions.filter(t => t.supplier_id === s.id)

          return (
            <div key={s.id} style={cardContainer}>
              <div onClick={() => setSelectedSupplierId(isSelected ? null : s.id)} style={supplierCardStyle}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '800', fontSize: '16px' }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>ΣΥΝ. ΤΖΙΡΟΣ: {getTurnover(s.id).toFixed(2)}€</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={(e) => { e.stopPropagation(); setFormData({name:s.name, phone:s.phone||'', vat_number:s.vat_number||''}); setEditingId(s.id); setIsAdding(true); }} style={iconBtn}>✎</button>
                  <button onClick={(e) => { e.stopPropagation(); if(confirm('Διαγραφή;')) supabase.from('suppliers').delete().eq('id', s.id).then(() => fetchInitialData()); }} style={iconBtnDel}>🗑️</button>
                </div>
              </div>

              {isSelected && (
                <div style={detailsBox}>
                  <p style={{ fontSize: '10px', fontWeight: '900', color: '#64748b', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>ΙΣΤΟΡΙΚΟ ΣΥΝΑΛΛΑΓΩΝ</p>
                  {sTrans.length === 0 ? <p style={{fontSize:'12px', color:'#94a3b8'}}>Καμία συναλλαγή.</p> : sTrans.map(t => (
                    <div key={t.id} style={transRow}>
                      <span style={{fontSize:'12px', fontWeight:'700'}}>{new Date(t.date).toLocaleDateString('el-GR')}</span>
                      <span style={{fontSize:'12px', color: t.is_credit ? '#ea580c' : '#1e293b'}}>{t.is_credit ? 'ΠΙΣΤΩΣΗ' : t.method}</span>
                      <span style={{fontSize:'13px', fontWeight:'900'}}>{Number(t.amount).toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SuppliersPage() {
  return (<Suspense fallback={<div>Φόρτωση...</div>}><SuppliersContent /></Suspense>)
}

// STYLES
const backBtnStyle = { border:'none', background:'#f1f5f9', width:'40px', height:'40px', borderRadius:'12px', fontSize:'20px', cursor:'pointer' };
const addBtnStyle = { backgroundColor:'#2563eb', color:'white', border:'none', padding:'10px 18px', borderRadius:'12px', fontWeight:'bold', cursor:'pointer' };
const formBoxStyle = { padding:'20px', border:'2px solid #2563eb', borderRadius:'20px', marginBottom:'25px', backgroundColor:'#f8fafc' };
const inputStyle = { width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0', marginBottom:'10px', boxSizing:'border-box' as const };
const labelStyle = { fontSize:'11px', fontWeight:'bold', color:'#94a3b8', display:'block', marginBottom:'5px' };
const saveBtnStyle = { width:'100%', padding:'15px', backgroundColor:'#16a34a', color:'white', border:'none', borderRadius:'12px', fontWeight:'bold', cursor:'pointer' };
const cardContainer = { border:'1px solid #f1f5f9', borderRadius:'15px', overflow:'hidden' };
const supplierCardStyle = { padding:'15px', backgroundColor:'white', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' };
const iconBtn = { background:'#f1f5f9', border:'none', borderRadius:'8px', width:'35px', height:'35px', cursor:'pointer' };
const iconBtnDel = { background:'#fee2e2', border:'none', borderRadius:'8px', width:'35px', height:'35px', cursor:'pointer' };
const detailsBox = { padding:'15px', backgroundColor:'#f9fafb', borderTop:'1px solid #f1f5f9' };
const transRow = { display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px dashed #e2e8f0' };
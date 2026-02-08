'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  
  // State για τη φόρμα
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [afm, setAfm] = useState('') // Εδώ το λέμε afm, αλλά στη βάση θα το στείλουμε ως vat_number
  const [category, setCategory] = useState('Εμπορεύματα')
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showTransactions, setShowTransactions] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    // Φέρνουμε τους προμηθευτές
    const { data: sData, error: sError } = await supabase
      .from('suppliers')
      .select('*')
      .order('name')
    
    // Φέρνουμε τις συναλλαγές
    const { data: tData, error: tError } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })

    if (sData) setSuppliers(sData)
    if (tData) setTransactions(tData)
    
    if (sError) console.error('Error fetching suppliers:', sError)
  }

  const getSupplierTurnover = (supplierId: string) => {
    return transactions
      .filter(t => t.supplier_id === supplierId)
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  }

  // --- Η ΔΙΟΡΘΩΜΕΝΗ ΣΥΝΑΡΤΗΣΗ ΑΠΟΘΗΚΕΥΣΗΣ ---
  async function handleSave() {
    if (!name) return alert('Δώσε όνομα')
    setLoading(true)

    try {
      // 1. Βρίσκουμε τον χρήστη
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        alert('Δεν βρέθηκε συνδεδεμένος χρήστης!')
        return
      }

      // 2. Βρίσκουμε το store_id του
      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .single()

      if (!profile?.store_id) {
        alert('Δεν βρέθηκε κατάστημα στο προφίλ!')
        return
      }

      // 3. Ετοιμάζουμε τα δεδομένα (ΔΙΟΡΘΩΣΗ: vat_number αντί για afm)
      const supplierData = { 
        name, 
        phone, 
        vat_number: afm, // <--- Στέλνουμε το 'afm' στη στήλη 'vat_number'
        category,
        store_id: profile.store_id // <--- Στέλνουμε και το store_id
      }

      if (editingId) {
        // Update
        const { error } = await supabase
          .from('suppliers')
          .update(supplierData)
          .eq('id', editingId)
        
        if (error) throw error
        setEditingId(null)

      } else {
        // Insert
        const { error } = await supabase
          .from('suppliers')
          .insert([supplierData])
        
        if (error) throw error
      }

      // 4. Καθαρισμός
      resetForm()
      fetchData()

    } catch (error: any) {
      console.error('Error saving:', error)
      alert('Σφάλμα: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setName(''); setPhone(''); setAfm(''); setCategory('Εμπορεύματα');
    setEditingId(null); setIsFormOpen(false);
  }

  // --- Η ΔΙΟΡΘΩΜΕΝΗ ΣΥΝΑΡΤΗΣΗ ΕΠΕΞΕΡΓΑΣΙΑΣ ---
  const handleEdit = (s: any) => {
    setEditingId(s.id); 
    setName(s.name); 
    setPhone(s.phone || '');
    setAfm(s.vat_number || ''); // <--- ΔΙΟΡΘΩΣΗ: Διαβάζουμε το vat_number από τη βάση
    setCategory(s.category || 'Εμπορεύματα');
    setIsFormOpen(true);
    window.scrollTo(0, 0);
  }

  const getPaymentIcon = (method: string) => {
    if (method === 'Μετρητά') return '💵'
    if (method === 'Κάρτα' || method === 'POS') return '💳'
    if (method === 'Τράπεζα') return '🏦'
    return '💰'
  }

  return (
    <main style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '14px' }}>← ΠΙΣΩ</Link>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#1e293b' }}>Προμηθευτές</h2>
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)} 
          style={isFormOpen ? cancelBtn : addBtn}
        >
          {isFormOpen ? 'ΑΚΥΡΟ' : '+ ΝΕΟΣ'}
        </button>
      </div>

      {isFormOpen && (
        <div style={{ ...formCard, borderColor: editingId ? '#f59e0b' : '#2563eb' }}>
          <p style={labelStyle}>ΕΠΩΝΥΜΙΑ ΠΡΟΜΗΘΕΥΤΗ</p>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="π.χ. Fiat Κουλουράς" />

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <div style={{ flex: 1 }}><p style={labelStyle}>ΤΗΛΕΦΩΝΟ</p><input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} /></div>
            <div style={{ flex: 1 }}><p style={labelStyle}>Α.Φ.Μ.</p><input value={afm} onChange={(e) => setAfm(e.target.value)} style={inputStyle} /></div>
          </div>

          <p style={{ ...labelStyle, marginTop: '16px' }}>ΚΑΤΗΓΟΡΙΑ ΕΞΟΔΩΝ</p>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            <option value="Εμπορεύματα">🛒 Εμπορεύματα</option>
            <option value="Πάγια">🏢 Πάγια / Λογαριασμοί</option>
            <option value="Προσωπικό">👥 Προσωπικό (Μισθοδοσία)</option>
            <option value="Λοιπά">📦 Λοιπά Έξοδα</option>
          </select>

          <button onClick={handleSave} disabled={loading} style={{ ...saveBtn, backgroundColor: editingId ? '#f59e0b' : '#10b981' }}>
            {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : (editingId ? 'ΑΠΟΘΗΚΕΥΣΗ ΑΛΛΑΓΩΝ' : 'ΠΡΟΣΘΗΚΗ ΠΡΟΜΗΘΕΥΤΗ')}
          </button>
        </div>
      )}

      <div style={{ marginTop: '12px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase' }}>ΛΙΣΤΑ ΣΥΝΕΡΓΑΤΩΝ ({suppliers.length})</p>
        {suppliers.map(s => (
          <div key={s.id} style={{ marginBottom: '12px' }}>
            <div style={supplierItem}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setShowTransactions(showTransactions === s.id ? null : s.id)}>
                <p style={{ fontWeight: '800', margin: 0, fontSize: '15px', color: '#1e293b' }}>{s.name}</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                   <span style={badgeStyle}>{s.category || 'Εμπορεύματα'}</span>
                   <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Τζίρος: {getSupplierTurnover(s.id).toFixed(2)}€</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => handleEdit(s)} style={editBtn}>✎</button>
                <button onClick={(e) => { e.stopPropagation(); if(confirm('Διαγραφή;')) { supabase.from('suppliers').delete().eq('id', s.id).then(() => fetchData()); } }} style={deleteBtn}>🗑️</button>
              </div>
            </div>

            {showTransactions === s.id && (
              <div style={transList}>
                <p style={{ fontSize: '10px', fontWeight: '900', color: '#64748b', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>ΙΣΤΟΡΙΚΟ ΣΥΝΑΛΛΑΓΩΝ</p>
                {transactions.filter(t => t.supplier_id === s.id).length > 0 ? (
                  transactions.filter(t => t.supplier_id === s.id).map(t => (
                    <div key={t.id} style={transItem}>
                      <span style={{ color: '#64748b' }}>{t.date.split('T')[0]}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }} title={t.method}>{getPaymentIcon(t.method)}</span>
                        <span style={{ fontWeight: '800', color: '#1e293b' }}>{Number(t.amount).toFixed(2)}€</span>
                      </div>
                    </div>
                  ))
                ) : <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>Δεν υπάρχουν κινήσεις</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}

// Στυλ (ίδια με πριν)
const addBtn = { padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' };
const cancelBtn = { padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' };
const formCard = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', border: '2px solid', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
const labelStyle = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' as const };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '15px', fontWeight: 'bold', boxSizing: 'border-box' as const };
const saveBtn = { width: '100%', padding: '16px', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', marginTop: '20px' };
const supplierItem = { backgroundColor: 'white', padding: '16px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const badgeStyle = { fontSize: '9px', fontWeight: '800', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', color: '#64748b', textTransform: 'uppercase' as const };
const editBtn = { background: '#fef3c7', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px' };
const deleteBtn = { background: '#fee2e2', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px' };
const transList = { backgroundColor: 'white', padding: '16px', borderRadius: '0 0 20px 20px', marginTop: '-10px', border: '1px solid #f1f5f9', borderTop: 'none' };
const transItem = { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0', borderBottom: '1px dotted #e2e8f0' };
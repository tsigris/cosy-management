'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AddExpensePage() {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [notes, setNotes] = useState('')
  const [invoiceNum, setInvoiceNum] = useState('')
  const [isCredit, setIsCredit] = useState(false) // ΕΠΙ ΠΙΣΤΩΣΕΙ (ΝΕΟ ΧΡΕΟΣ)
  const [isAgainstDebt, setIsAgainstDebt] = useState(false) // ΕΝΑΝΤΙ ΠΑΛΑΙΟΥ ΧΡΕΟΥ

  const [employees, setEmployees] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  
  const [selectedEmp, setSelectedEmp] = useState('')
  const [selectedSup, setSelectedSup] = useState('')
  const [selectedFixed, setSelectedFixed] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: e } = await supabase.from('employees').select('*').order('full_name')
      const { data: s } = await supabase.from('suppliers').select('*').order('name')
      if (e) setEmployees(e)
      if (s) setSuppliers(s)
    }
    loadData()
  }, [])

  async function handleSave() {
    if (!amount || Number(amount) <= 0) return alert('Συμπληρώστε το ποσό')

    let category = 'Λοιπά'
    if (selectedSup) category = 'Εμπορεύματα'
    else if (selectedEmp) category = 'Προσωπικό'
    else if (selectedFixed) category = 'Πάγια'

    // ΛΟΓΙΚΗ ΕΝΑΝΤΙ ΠΑΛΑΙΟΥ ΧΡΕΟΥ:
    // Αν είναι έναντι χρέους, το is_credit παραμένει false (για να μειωθεί το ταμείο) 
    // αλλά προσθέτουμε ειδικό flag ή αρνητική εγγραφή για την καρτέλα αν χρειάζεται.
    const payload = {
      amount: Number(amount),
      method: isCredit ? 'Πίστωση' : method,
      notes: isAgainstDebt ? `ΕΞΟΦΛΗΣΗ ΧΡΕΟΥ: ${notes}` : notes,
      invoice_number: invoiceNum,
      is_credit: isCredit, // Αν είναι true, δεν πειράζει το ταμείο ημέρας αλλά αυξάνει την καρτέλα
      type: isAgainstDebt ? 'debt_payment' : 'expense', // Διαχωρισμός τύπου για την ανάλυση
      date: new Date().toISOString().split('T')[0],
      employee_id: selectedEmp || null,
      supplier_id: selectedSup || null,
      category: isAgainstDebt ? 'Εξόφληση Χρέους' : category
    }

    const { error } = await supabase.from('transactions').insert([payload])
    if (!error) {
        router.push('/')
        router.refresh()
    } else {
        alert(error.message)
    }
  }

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: 'white', borderRadius: '28px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
          <Link href="/" style={{ textDecoration: 'none', fontSize: '24px', color: '#64748b' }}>←</Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Νέο Έξοδο</h2>
        </div>

        {/* ΠΟΣΟ - ΜΕΘΟΔΟΣ - ΠΑΡΑΣΤΑΤΙΚΟ */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1.5 }}>
            <label style={labelStyle}>ΠΟΣΟ (€)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>ΜΕΘΟΔΟΣ</label>
            <select value={method} onChange={e => setMethod(e.target.value)} style={inputStyle} disabled={isCredit}>
              <option value="Μετρητά">Μετρητά</option>
              <option value="Τράπεζα">Τράπεζα</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>ΠΑΡΑΣΤΑΤΙΚΟ</label>
            <input value={invoiceNum} onChange={e => setInvoiceNum(e.target.value)} style={inputStyle} placeholder="Αρ." />
          </div>
        </div>

        {/* ΕΠΙΛΟΓΕΣ ΧΡΕΟΥΣ - ΟΠΩΣ ΣΤΗ ΦΩΤΟΓΡΑΦΙΑ */}
        <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '15px', marginBottom: '20px', border: '1px solid #f1f5f9' }}>
          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" checked={isCredit} onChange={e => {setIsCredit(e.target.checked); if(e.target.checked) setIsAgainstDebt(false)}} id="credit" style={checkboxStyle} />
            <label htmlFor="credit" style={checkLabel}>ΕΠΙ ΠΙΣΤΩΣΕΙ (ΝΕΟ ΧΡΕΟΣ)</label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" checked={isAgainstDebt} onChange={e => {setIsAgainstDebt(e.target.checked); if(e.target.checked) setIsCredit(false)}} id="against" style={checkboxStyle} />
            <label htmlFor="against" style={checkLabel}>ΕΝΑΝΤΙ ΠΑΛΑΙΟΥ ΧΡΕΟΥ</label>
          </div>
        </div>

        {/* ΣΕΙΡΑ: 1. ΠΡΟΜΗΘΕΥΤΗΣ, 2. ΥΠΑΛΛΗΛΟΣ, 3. ΠΑΓΙΟ */}
        
        {/* ΠΡΟΜΗΘΕΥΤΗΣ */}
        <div style={selectGroup}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <label style={labelStyle}>ΠΡΟΜΗΘΕΥΤΗΣ</label>
            <Link href="/suppliers" style={addBtn}>+</Link>
          </div>
          <select value={selectedSup} onChange={e => {setSelectedSup(e.target.value); setSelectedEmp(''); setSelectedFixed('')}} style={inputStyle}>
            <option value="">— Επιλέξτε —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* ΥΠΑΛΛΗΛΟΣ */}
        <div style={selectGroup}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <label style={labelStyle}>ΥΠΑΛΛΗΛΟΣ</label>
            <Link href="/employees" style={addBtn}>+</Link>
          </div>
          <select value={selectedEmp} onChange={e => {setSelectedEmp(e.target.value); setSelectedSup(''); setSelectedFixed('')}} style={inputStyle}>
            <option value="">— Επιλέξτε —</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>

        {/* ΠΑΓΙΟ */}
        <div style={selectGroup}>
          <label style={labelStyle}>ΠΑΓΙΟ (ΔΕΗ, ΕΝΟΙΚΙΟ ΚΛΠ)</label>
          <select value={selectedFixed} onChange={e => {setSelectedFixed(e.target.value); setSelectedEmp(''); setSelectedSup('')}} style={inputStyle}>
            <option value="">— Επιλέξτε —</option>
            <option value="ΔΕΗ">ΔΕΗ / Ρεύμα</option>
            <option value="ΕΥΔΑΠ">ΕΥΔΑΠ / Νερό</option>
            <option value="Ενοίκιο">Ενοίκιο</option>
            <option value="Τηλεφωνία">Τηλεφωνία / Internet</option>
            <option value="Λοιπά">Λοιπά Πάγια</option>
          </select>
        </div>

        {/* ΣΗΜΕΙΩΣΕΙΣ */}
        <div style={{ marginBottom: '25px' }}>
          <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ / ΠΕΡΙΓΡΑΦΗ</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: '80px', paddingTop: '10px' }} placeholder="π.χ. Αρ. Τιμολογίου..." />
        </div>

        <button onClick={handleSave} style={saveBtn}>ΑΠΟΘΗΚΕΥΣΗ ΕΞΟΔΟΥ</button>
        <button onClick={() => router.push('/')} style={cancelBtn}>ΑΚΥΡΩΣΗ</button>

      </div>
    </main>
  )
}

// STYLES
const labelStyle = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 'bold', backgroundColor: '#f8fafc', boxSizing: 'border-box' as const };
const selectGroup = { marginBottom: '18px' };
const addBtn = { textDecoration: 'none', backgroundColor: '#eff6ff', color: '#2563eb', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', fontWeight: 'bold', fontSize: '18px' };
const saveBtn = { width: '100%', padding: '18px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)' };
const cancelBtn = { width: '100%', padding: '14px', backgroundColor: 'transparent', color: '#64748b', border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '14px', marginTop: '10px', cursor: 'pointer' };
const checkboxStyle = { width: '18px', height: '18px', cursor: 'pointer' };
const checkLabel = { fontSize: '13px', fontWeight: '800', color: '#1e293b', cursor: 'pointer' };
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AnalysisPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [initialAmount, setInitialAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('initial_amount').eq('id', user.id).single()
      if (profile) setInitialAmount(profile.initial_amount || 0)

      const { data: trans } = await supabase.from('transactions').select('*, suppliers(name)')
      if (trans) setTransactions(trans)
    }
    setLoading(false)
  }

  // ΦΙΛΤΡΑΡΙΣΜΑ
  const filtered = transactions.filter(t => {
    const tDate = t.date // Χρησιμοποιεί την ημερομηνία της κίνησης
    const matchesSearch = 
      (t.notes?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (t.suppliers?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (t.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    
    const matchesStart = startDate ? tDate >= startDate : true
    const matchesEnd = endDate ? tDate <= endDate : true
    
    return matchesSearch && matchesStart && matchesEnd
  })

  // ΥΠΟΛΟΓΙΣΜΟΙ
  const stats = filtered.reduce((acc, t) => {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') {
      acc.income += amt
    } else {
      acc.expenses += amt
      if (t.category === 'Μισθοδοσία' || t.category === 'Προσωπικό') acc.payroll += amt
      if (t.category === 'Εμπορεύματα' || t.category === 'Αγορές') acc.inventory += amt
      if (t.category === 'Πάγια' || t.category === 'Λογαριασμοί') acc.fixed += amt
    }
    return acc
  }, { income: 0, expenses: 0, payroll: 0, inventory: 0, fixed: 0 })

  const payrollPercent = stats.income > 0 ? ((stats.payroll / stats.income) * 100).toFixed(1) : '0'

  return (
    <main style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        <Link href="/" style={{ color: '#2563eb', fontWeight: 'bold', textDecoration: 'none', display: 'block', marginBottom: '15px' }}>← Πίσω στο Ταμείο</Link>

        {/* ΦΙΛΤΡΑ ΑΝΑΖΗΤΗΣΗΣ */}
        <div style={filterCard}>
          <input 
            placeholder="🔍 Αναζήτηση (π.χ. ΔΕΗ, Εμπορεύματα...)" 
            style={inputStyle} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <input type="date" style={dateInput} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <input type="date" style={dateInput} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* ΚΥΡΙΑ ΣΤΑΤΙΣΤΙΚΑ */}
        <div style={mainCard}>
          <p style={labelStyle}>ΣΥΝΟΛΙΚΟΣ ΤΖΙΡΟΣ</p>
          <h2 style={{ fontSize: '32px', margin: 0, fontWeight: '900' }}>{stats.income.toFixed(2)}€</h2>
          <div style={divider} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <p style={labelSmall}>ΕΞΟΔΑ</p>
              <p style={{ color: '#ef4444', fontWeight: '800' }}>-{stats.expenses.toFixed(2)}€</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={labelSmall}>ΚΑΘΑΡΟ</p>
              <p style={{ color: '#10b981', fontWeight: '800' }}>{(stats.income - stats.expenses).toFixed(2)}€</p>
            </div>
          </div>
        </div>

        {/* ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΑΝΑΛΥΣΗ */}
        <div style={whiteCard}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#1e293b' }}>ΑΝΑΛΥΣΗ ΚΑΤΗΓΟΡΙΩΝ & KPI</h4>
          
          <div style={metricRow}>
             <span>👥 Προσωπικό (Μισθοδοσία):</span>
             <b>{stats.payroll.toFixed(2)}€ <small style={{color: '#6366f1'}}>({payrollPercent}%)</small></b>
          </div>
          <div style={metricRow}>
             <span>🛒 Εμπορεύματα:</span>
             <b>{stats.inventory.toFixed(2)}€</b>
          </div>
          <div style={metricRow}>
             <span>🏢 Πάγια / Λογαριασμοί:</span>
             <b>{stats.fixed.toFixed(2)}€</b>
          </div>
          <div style={metricRow}>
             <span>📦 Λοιπά Έξοδα:</span>
             <b>{(stats.expenses - (stats.payroll + stats.inventory + stats.fixed)).toFixed(2)}€</b>
          </div>
        </div>

        {/* ΛΙΣΤΑ ΑΠΟΤΕΛΕΣΜΑΤΩΝ ΑΝΑΖΗΤΗΣΗΣ */}
        <div style={{ marginTop: '20px' }}>
           <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '10px' }}>ΑΠΟΤΕΛΕΣΜΑΤΑ ΑΝΑΖΗΤΗΣΗΣ ({filtered.length})</p>
           {filtered.slice(0, 10).map(t => (
             <div key={t.id} style={listItem}>
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px' }}>{t.suppliers?.name || t.notes || t.category}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>{t.date} • {t.method}</p>
                </div>
                <p style={{ fontWeight: '900', color: t.type === 'income' ? '#10b981' : '#ef4444' }}>
                  {t.type === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€
                </p>
             </div>
           ))}
        </div>

      </div>
    </main>
  )
}

// STYLES
const filterCard = { backgroundColor: 'white', padding: '15px', borderRadius: '18px', marginBottom: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' };
const mainCard = { backgroundColor: '#1e293b', padding: '25px', borderRadius: '25px', color: 'white', marginBottom: '15px' };
const whiteCard = { backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px' };
const dateInput = { flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px' };
const labelStyle = { fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '1px', marginBottom: '5px' };
const labelSmall = { fontSize: '9px', fontWeight: 'bold', color: '#94a3b8' };
const divider = { height: '1px', backgroundColor: '#334155', margin: '15px 0' };
const metricRow = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' };
const listItem = { backgroundColor: 'white', padding: '12px 15px', borderRadius: '15px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9' };
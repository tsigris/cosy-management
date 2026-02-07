'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AnalysisPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [period, setPeriod] = useState('Μήνας')

  useEffect(() => { fetchData() }, [period])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, suppliers(name, category)')
    if (data) setTransactions(data)
    setLoading(false)
  }

  const filtered = transactions.filter(t => {
    const now = new Date()
    const tDate = new Date(t.date)
    const matchesSearch = (t.suppliers?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (t.notes?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    
    let matchesPeriod = true
    if (period === 'Ημέρα') matchesPeriod = tDate.toDateString() === now.toDateString()
    if (period === 'Μήνας') matchesPeriod = tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()
    
    return matchesSearch && matchesPeriod
  })

  const stats = filtered.reduce((acc, t) => {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') {
      acc.income += amt
    } else {
      acc.expenses += amt
      const cat = t.suppliers?.category || t.category
      if (cat === 'Προσωπικό' || cat === 'Μισθοδοσία') acc.payroll += amt
      else if (cat === 'Εμπορεύματα') acc.inventory += amt
      else if (cat === 'Πάγια') acc.fixed += amt
      else acc.others += amt
    }
    return acc
  }, { income: 0, expenses: 0, payroll: 0, inventory: 0, fixed: 0, others: 0 })

  // Συνάρτηση υπολογισμού ποσοστού %
  const getPercent = (value: number) => {
    return stats.income > 0 ? ((value / stats.income) * 100).toFixed(1) : '0.0'
  }

  return (
    <main style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '450px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <Link href="/" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '14px' }}>
            ← ΠΙΣΩ
          </Link>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#1e293b' }}>Ανάλυση</h2>
          <div style={{ width: '45px' }}></div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
           <input placeholder="🔍 Αναζήτηση..." style={inputStyle} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           <select value={period} onChange={(e) => setPeriod(e.target.value)} style={selectStyle}>
              <option value="Ημέρα">Ημέρα</option>
              <option value="Μήνας">Μήνας</option>
           </select>
        </div>

        {/* ΚΕΝΤΡΙΚΗ ΚΑΡΤΑ ΤΖΙΡΟΥ */}
        <div style={mainCard}>
          <p style={labelSmall}>ΣΥΝΟΛΙΚΟΣ ΤΖΙΡΟΣ</p>
          <h2 style={{ fontSize: '36px', margin: 0, fontWeight: '900' }}>{stats.income.toFixed(2)}€</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', borderTop: '1px solid #374151', paddingTop: '15px' }}>
            <span style={{ color: '#f87171', fontWeight: 'bold' }}>ΕΞΟΔΑ: -{stats.expenses.toFixed(2)}€ <small>({getPercent(stats.expenses)}%)</small></span>
            <span style={{ color: '#4ade80', fontWeight: 'bold' }}>ΚΑΘΑΡΟ: {(stats.income - stats.expenses).toFixed(2)}€</span>
          </div>
        </div>

        {/* ΑΝΑΛΥΣΗ ΚΑΤΗΓΟΡΙΩΝ ΜΕ ΠΟΣΟΣΤΑ ΠΑΝΤΟΥ */}
        <div style={whiteCard}>
          <p style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b', marginBottom: '15px' }}>ΑΠΟΔΟΣΗ ΚΑΤΗΓΟΡΙΩΝ (% ΕΠΙ ΤΖΙΡΟΥ)</p>
          
          <div style={row}>
            <span>👥 Προσωπικό (Μισθοδοσία):</span>
            <b>{stats.payroll.toFixed(2)}€ <small style={percentLabel}>({getPercent(stats.payroll)}%)</small></b>
          </div>
          <div style={row}>
            <span>🛒 Εμπορεύματα (COGS):</span>
            <b>{stats.inventory.toFixed(2)}€ <small style={percentLabel}>({getPercent(stats.inventory)}%)</small></b>
          </div>
          <div style={row}>
            <span>🏢 Πάγια / Λογαριασμοί:</span>
            <b>{stats.fixed.toFixed(2)}€ <small style={percentLabel}>({getPercent(stats.fixed)}%)</small></b>
          </div>
          <div style={row}>
            <span>📦 Λοιπά Έξοδα:</span>
            <b>{stats.others.toFixed(2)}€ <small style={percentLabel}>({getPercent(stats.others)}%)</small></b>
          </div>
        </div>
      </div>
    </main>
  )
}

// Στυλ για τα ποσοστά
const percentLabel = { color: '#6366f1', fontSize: '11px', marginLeft: '5px' };

const inputStyle = { flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: 'white' };
const selectStyle = { padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold', backgroundColor: 'white' };
const mainCard = { backgroundColor: '#1e293b', padding: '25px', borderRadius: '28px', color: 'white', marginBottom: '15px' };
const whiteCard = { backgroundColor: 'white', padding: '20px', borderRadius: '25px', border: '1px solid #f1f5f9' };
const labelSmall = { fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '1px' };
const row = { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f8fafc', fontSize: '14px' };
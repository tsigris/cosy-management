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

  const getPercent = (value: number) => {
    return stats.income > 0 ? ((value / stats.income) * 100).toFixed(1) : '0'
  }

  // Υπολογισμός Καθαρού Κέρδους %
  const netProfit = stats.income - stats.expenses
  const profitMargin = stats.income > 0 ? ((netProfit / stats.income) * 100).toFixed(1) : '0'

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '450px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <Link href="/" style={{ textDecoration: 'none', color: '#64748b', fontWeight: '900', fontSize: '13px' }}>
             ← ΑΡΧΙΚΗ
          </Link>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>Οικονομική Ανάλυση</h2>
          <div style={{ width: '45px' }}></div>
        </div>

        {/* CONTROLS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
           <input placeholder="🔍 Αναζήτηση..." style={inputStyle} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           <select value={period} onChange={(e) => setPeriod(e.target.value)} style={selectStyle}>
              <option value="Ημέρα">Σήμερα</option>
              <option value="Μήνας">Μήνας</option>
           </select>
        </div>

        {/* ΚΕΝΤΡΙΚΗ ΚΑΡΤΑ (DASHBOARD) */}
        <div style={mainCard}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <p style={labelSmall}>ΣΥΝΟΛΙΚΟΣ ΤΖΙΡΟΣ ({period})</p>
            <h2 style={{ fontSize: '42px', margin: '5px 0', fontWeight: '900', color: 'white' }}>{stats.income.toFixed(2)}€</h2>
            <div style={{ display: 'inline-block', backgroundColor: '#334155', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
               Περιθώριο Κέρδους: {profitMargin}%
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '15px' }}>
            <div style={{ textAlign: 'left' }}>
              <p style={labelSmall}>ΕΞΟΔΑ</p>
              <p style={{ color: '#f87171', fontWeight: '900', fontSize: '18px', margin: 0 }}>-{stats.expenses.toFixed(2)}€</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={labelSmall}>ΚΑΘΑΡΟ ΠΛΕΟΝΑΣΜΑ</p>
              <p style={{ color: '#4ade80', fontWeight: '900', fontSize: '18px', margin: 0 }}>{netProfit.toFixed(2)}€</p>
            </div>
          </div>
        </div>

        {/* ΑΝΑΛΥΣΗ ΚΑΤΗΓΟΡΙΩΝ ΜΕ PROGRESS BARS */}
        <div style={whiteCard}>
          <p style={{ fontWeight: '900', fontSize: '12px', color: '#64748b', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Κατανομή Εξόδων (% επί του τζίρου)
          </p>
          
          <CategoryRow label="👥 Προσωπικό" value={stats.payroll} percent={getPercent(stats.payroll)} color="#6366f1" />
          <CategoryRow label="🛒 Εμπορεύματα" value={stats.inventory} percent={getPercent(stats.inventory)} color="#f59e0b" />
          <CategoryRow label="🏢 Πάγια / Λογαριασμοί" value={stats.fixed} percent={getPercent(stats.fixed)} color="#ec4899" />
          <CategoryRow label="📦 Λοιπά Έξοδα" value={stats.others} percent={getPercent(stats.others)} color="#94a3b8" />
        </div>

        {/* FOOTER INFO */}
        <p style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '20px', fontWeight: 'bold' }}>
          Η ανάλυση βασίζεται σε {filtered.length} καταγεγραμμένες κινήσεις.
        </p>
      </div>
    </main>
  )
}

// Sub-component για τις γραμμές ανάλυσης
function CategoryRow({ label, value, percent, color }: any) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '800', marginBottom: '6px', color: '#1e293b' }}>
        <span>{label}</span>
        <span>{value.toFixed(2)}€ <small style={{ color: '#94a3b8', fontWeight: 'bold' }}>({percent}%)</small></span>
      </div>
      <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(Number(percent), 100)}%`, height: '100%', backgroundColor: color, borderRadius: '10px', transition: 'width 0.5s ease-out' }}></div>
      </div>
    </div>
  )
}



// STYLES
const inputStyle = { flex: 1, padding: '12px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 'bold' };
const selectStyle = { padding: '12px', borderRadius: '14px', border: '1px solid #e2e8f0', fontWeight: '900', backgroundColor: 'white', color: '#1e293b' };
const mainCard = { backgroundColor: '#0f172a', padding: '25px', borderRadius: '30px', color: 'white', marginBottom: '15px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' };
const whiteCard = { backgroundColor: 'white', padding: '24px', borderRadius: '28px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
const labelSmall = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' as const };
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ProfessionalAnalysisPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [filterCat, setFilterCat] = useState('all') // Αντί για αναζήτηση κειμένου

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('transactions').select('*')
    if (data) setTransactions(data)
    setLoading(false)
  }

  // Λογική Φιλτραρίσματος
  const now = new Date()
  const filtered = transactions.filter(t => {
    const tDate = new Date(t.date)
    const matchesPeriod = period === 'month' 
      ? (tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear())
      : (tDate.getFullYear() === now.getFullYear())
    
    const matchesCat = filterCat === 'all' || t.category === filterCat
    return matchesPeriod && matchesCat
  })

  // Στατιστικά
  const income = filtered.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0)
  const expenses = filtered.filter(t => t.type === 'expense' || t.type === 'debt_payment').reduce((acc, t) => acc + Number(t.amount), 0)
  const profit = income - expenses
  const margin = income > 0 ? (profit / income) * 100 : 0
  const estimatedVAT = (income - expenses) * 0.24 // Μια πρόχειρη εκτίμηση

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <Link href="/" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 'bold', fontSize: '14px' }}>← ΑΡΧΙΚΗ</Link>
          <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Οικονομική Ανάλυση</h1>
        </div>

        {/* ΕΞΥΠΝΑ ΦΙΛΤΡΑ (Αντικαθιστούν την Αναζήτηση) */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={filterSelect}>
            <option value="month">Μήνας</option>
            <option value="year">Έτος</option>
          </select>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...filterSelect, flex: 2 }}>
            <option value="all">Όλες οι Κατηγορίες</option>
            <option value="Εμπορεύματα">Εμπορεύματα</option>
            <option value="Προσωπικό">Προσωπικό</option>
            <option value="Πάγια">Πάγια</option>
          </select>
        </div>

        {/* MAIN SCOREBOARD */}
        <div style={mainCardStyle}>
          <p style={labelStyle}>ΣΥΝΟΛΙΚΟΣ ΤΖΙΡΟΣ ({period === 'month' ? 'ΜΗΝΑΣ' : 'ΕΤΟΣ'})</p>
          <h2 style={amountStyle}>{income.toFixed(2)}€</h2>
          
          <div style={badgeContainer}>
             <div style={marginBadge}>Περιθώριο Κέρδους: {margin.toFixed(1)}%</div>
          </div>

          <div style={statsGrid}>
            <div>
              <p style={labelStyle}>ΕΞΟΔΑ</p>
              <p style={{ color: '#f87171', fontWeight: '900', margin: 0 }}>-{expenses.toFixed(2)}€</p>
            </div>
            <div style={{ width: '1px', backgroundColor: '#334155' }}></div>
            <div>
              <p style={labelStyle}>ΚΑΘΑΡΟ ΠΛΕΟΝΑΣΜΑ</p>
              <p style={{ color: '#4ade80', fontWeight: '900', margin: 0 }}>{profit.toFixed(2)}€</p>
            </div>
          </div>
        </div>

        {/* VAT ESTIMATION (ΝΕΟ) */}
        <div style={vatCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>🧾 Εκτίμηση ΦΠΑ προς απόδοση</span>
            <span style={{ fontWeight: '900', color: '#ef4444' }}>~{estimatedVAT > 0 ? estimatedVAT.toFixed(2) : '0.00'}€</span>
          </div>
        </div>

        {/* ΚΑΤΑΝΟΜΗ ΕΞΟΔΩΝ */}
        <div style={whiteCard}>
          <h3 style={cardTitle}>ΚΑΤΑΝΟΜΗ ΕΞΟΔΩΝ (% ΕΠΙ ΤΟΥ ΤΖΙΡΟΥ)</h3>
          
          <CategoryRow label="Προσωπικό" icon="👥" val={expensesByCat(filtered, 'Προσωπικό')} total={income} color="#3b82f6" />
          <CategoryRow label="Εμπορεύματα" icon="🛒" val={expensesByCat(filtered, 'Εμπορεύματα')} total={income} color="#fb923c" />
          <CategoryRow label="Πάγια / Λογαριασμοί" icon="🏦" val={expensesByCat(filtered, 'Πάγια')} total={income} color="#8b5cf6" />
          <CategoryRow label="Λοιπά Έξοδα" icon="📦" val={expensesByCat(filtered, 'Λοιπά')} total={income} color="#94a3b8" />
        </div>

        <p style={footerNote}>Η ανάλυση βασίζεται σε {filtered.length} καταγεγραμμένες κινήσεις.</p>
      </div>
    </main>
  )
}

// Helper Components & Logic
function expensesByCat(trans: any[], cat: string) {
  return trans.filter(t => t.category === cat).reduce((acc, t) => acc + Number(t.amount), 0)
}

function CategoryRow({ label, icon, val, total, color }: any) {
  const perc = total > 0 ? (val / total) * 100 : 0
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px' }}>
        <span style={{ fontWeight: '700', color: '#334155' }}>{icon} {label}</span>
        <span style={{ fontWeight: '800' }}>{val.toFixed(2)}€ <span style={{ color: '#94a3b8', fontWeight: '600', fontSize: '11px' }}>({perc.toFixed(1)}%)</span></span>
      </div>
      <div style={barBg}><div style={{ ...barFill, width: `${Math.min(perc, 100)}%`, backgroundColor: color }}></div></div>
    </div>
  )
}

// STYLES
const filterSelect = { padding: '12px', borderRadius: '14px', border: '1px solid #e2e8f0', backgroundColor: 'white', fontWeight: '800', fontSize: '13px', color: '#1e293b', outline: 'none' };
const mainCardStyle = { backgroundColor: '#0f172a', padding: '25px', borderRadius: '28px', color: 'white', textAlign: 'center' as const, marginBottom: '15px' };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.5px', marginBottom: '8px' };
const amountStyle = { fontSize: '38px', fontWeight: '900', margin: '5px 0' };
const badgeContainer = { display: 'flex', justifyContent: 'center', marginBottom: '20px' };
const marginBadge = { backgroundColor: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' };
const statsGrid = { display: 'flex', justifyContent: 'center', gap: '25px', borderTop: '1px solid #1e293b', paddingTop: '15px' };
const whiteCard = { backgroundColor: 'white', padding: '22px', borderRadius: '24px', border: '1px solid #f1f5f9', marginBottom: '15px' };
const vatCard = { backgroundColor: '#fff7ed', padding: '16px', borderRadius: '18px', border: '1px solid #ffedd5', marginBottom: '15px' };
const cardTitle = { fontSize: '11px', fontWeight: '900', color: '#64748b', marginBottom: '20px', letterSpacing: '0.5px' };
const barBg = { width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' };
const barFill = { height: '100%', borderRadius: '10px', transition: 'width 0.6s ease' };
const footerNote = { textAlign: 'center' as const, fontSize: '11px', color: '#94a3b8', fontWeight: '600', marginTop: '20px' };
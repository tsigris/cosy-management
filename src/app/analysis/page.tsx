'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AnalysisPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('Ημέρα')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('transactions').select('*')
    if (data) setTransactions(data)
    setLoading(false)
  }

  const filterByPeriod = (t: any) => {
    const now = new Date()
    const tDate = new Date(t.date_recorded)
    if (period === 'Ημέρα') return tDate.toDateString() === now.toDateString()
    if (period === 'Εβδομάδα') {
      const oneWeekAgo = new Date(); oneWeekAgo.setDate(now.getDate() - 7)
      return tDate >= oneWeekAgo
    }
    if (period === 'Μήνας') return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()
    if (period === 'Έτος') return tDate.getFullYear() === now.getFullYear()
    return true
  }

  const filtered = transactions.filter(filterByPeriod)

  const stats = filtered.reduce((acc, t) => {
    const amt = Number(t.amount) || 0
    const isCard = t.method === 'Κάρτα' || t.method === 'POS'

    if (t.type === 'income') {
      if (isCard) acc.incomeCard += amt
      else acc.incomeCash += amt
    } else if (t.type === 'expense') {
      if (t.is_credit) acc.credits += amt
      else {
        if (isCard) acc.expenseCard += amt
        else acc.expenseCash += amt
        if (t.is_debt_payment) acc.debtPayments += amt
      }
    }
    return acc
  }, { incomeCash: 0, incomeCard: 0, expenseCash: 0, expenseCard: 0, credits: 0, debtPayments: 0 })

  const totalIncome = stats.incomeCash + stats.incomeCard
  const totalCashInPocket = stats.incomeCash - stats.expenseCash

  // ΥΠΟΛΟΓΙΣΜΟΣ ΠΟΣΟΣΤΩΝ %
  const cashPercentage = totalIncome > 0 ? Math.round((stats.incomeCash / totalIncome) * 100) : 0
  const cardPercentage = totalIncome > 0 ? Math.round((stats.incomeCard / totalIncome) * 100) : 0

  return (
    <main style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '450px', margin: '0 auto', paddingBottom: '60px' }}>
        
        {/* Nav & Period Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <Link href="/" style={{ color: '#2563eb', fontWeight: 'bold', textDecoration: 'none', fontSize: '14px' }}>← ΠΙΣΩ</Link>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontWeight: 'bold', backgroundColor: 'white' }}>
            {['Ημέρα', 'Εβδομάδα', 'Μήνας', 'Έτος', 'Όλα'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* ΚΑΡΤΑ ΜΕΤΡΗΤΑ */}
        <div style={{ backgroundColor: '#111827', padding: '24px', borderRadius: '28px', color: 'white', marginBottom: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.15)' }}>
          <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#9ca3af', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' }}>ΜΕΤΡΗΤΑ ΣΤΟ ΣΥΡΤΑΡΙ</p>
          <h2 style={{ fontSize: '36px', fontWeight: '800', margin: 0 }}>{totalCashInPocket.toFixed(2)}€</h2>
          <div style={{ display: 'flex', gap: '15px', marginTop: '15px', borderTop: '1px solid #374151', paddingTop: '15px' }}>
             <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 'bold' }}>+ {stats.incomeCash.toFixed(2)}€</span>
             <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 'bold' }}>- {stats.expenseCash.toFixed(2)}€</span>
          </div>
        </div>

        {/* ΚΑΡΤΑ POS */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '28px', border: '1px solid #f1f5f9', marginBottom: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' }}>ΚΙΝΗΣΗ ΚΑΡΤΩΝ (POS)</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: '#2563eb', fontSize: '28px', fontWeight: '800', margin: 0 }}>{stats.incomeCard.toFixed(2)}€</h3>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>ΕΞΟΔΑ: {stats.expenseCard.toFixed(2)}€</span>
          </div>
        </div>

        {/* ΚΑΡΤΑ ΠΙΣΤΩΣΕΩΝ */}
        <div style={{ backgroundColor: '#fffaf5', padding: '24px', borderRadius: '28px', border: '1px solid #fff2e5', marginBottom: '24px' }}>
          <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#c2410c', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' }}>ΥΠΟΛΟΙΠΟ ΠΙΣΤΩΣΕΩΝ</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', margin: 0 }}>{stats.credits.toFixed(2)}€</h3>
            <span style={{ color: '#16a34a', fontSize: '11px', fontWeight: 'bold' }}>ΠΛΗΡΩΜΕΣ: -{stats.debtPayments.toFixed(2)}€</span>
          </div>
        </div>

        {/* ΣΥΝΟΛΟ ΕΣΟΔΩΝ ΜΕ ΠΟΣΟΣΤΑ % */}
        <div style={{ padding: '0 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>ΣΥΝΟΛΟ ΕΣΟΔΩΝ:</span>
                <span style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b' }}>{totalIncome.toFixed(2)}€</span>
            </div>
            
            {/* ΜΠΑΡΑ ΠΡΟΟΔΟΥ */}
            <div style={{ height: '10px', backgroundColor: '#e2e8f0', borderRadius: '20px', overflow: 'hidden', display: 'flex', marginBottom: '12px' }}>
                <div style={{ width: `${cashPercentage}%`, backgroundColor: '#111827', transition: 'width 0.5s ease' }}></div>
                <div style={{ width: `${cardPercentage}%`, backgroundColor: '#2563eb', transition: 'width 0.5s ease' }}></div>
            </div>

            {/* ΛΕΖΑΝΤΑ ΜΕ ΠΟΣΟΣΤΑ % */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>
                <span style={{ color: '#111827' }}>● ΜΕΤΡΗΤΑ: {cashPercentage}%</span>
                <span style={{ color: '#2563eb' }}>● ΚΑΡΤΑ / VISA: {cardPercentage}%</span>
            </div>
        </div>

        {/* ΕΠΙΚΑΙΡΟΠΟΙΗΣΗ */}
        <button 
          onClick={fetchData} 
          style={{ width: '100%', marginTop: '40px', padding: '18px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '18px', color: '#64748b', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}
        >
          {loading ? 'ΦΟΡΤΩΣΗ...' : '🔄 ΕΠΙΚΑΙΡΟΠΟΙΗΣΗ'}
        </button>
      </div>
    </main>
  )
}
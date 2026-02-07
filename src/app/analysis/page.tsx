'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AnalysisPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [initialAmount, setInitialAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('Ημέρα')

  useEffect(() => { 
    fetchData() 
  }, [period])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // 1. Λήψη Αρχικού Ποσού από το Προφίλ
      const { data: profile } = await supabase
        .from('profiles')
        .select('initial_amount')
        .eq('id', user.id)
        .single()
      
      if (profile) setInitialAmount(profile.initial_amount || 0)

      // 2. Λήψη όλων των κινήσεων (το φιλτράρισμα γίνεται μετά στην JS για ευκολία)
      const { data: trans } = await supabase
        .from('transactions')
        .select('*')
      
      if (trans) setTransactions(trans)
    }
    setLoading(false)
  }

  const filterByPeriod = (t: any) => {
    const now = new Date()
    // Χρησιμοποιούμε το πεδίο 'date' που έχουμε στη βάση
    const tDate = new Date(t.date) 
    
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
    const isCard = t.method === 'Κάρτα' || t.method === 'Τράπεζα'

    if (t.type === 'income') {
      if (isCard) acc.incomeCard += amt
      else acc.incomeCash += amt
    } else if (t.type === 'expense') {
      if (t.is_credit) {
        acc.credits += amt // Χρέος προς προμηθευτή
      } else {
        if (isCard) acc.expenseCard += amt
        else acc.expenseCash += amt
        
        // Αν είναι πληρωμή χρέους (δεν υπολογίζεται ως νέο έξοδο στο συρτάρι αν έγινε με πίστωση)
        if (t.is_debt_payment) acc.debtPayments += amt
      }
    }
    return acc
  }, { incomeCash: 0, incomeCard: 0, expenseCash: 0, expenseCard: 0, credits: 0, debtPayments: 0 })

  const totalIncome = stats.incomeCash + stats.incomeCard
  // ΤΑΜΕΙΟ = Αρχικό + Έσοδα Μετρητά - Έξοδα Μετρητά
  const totalCashInPocket = initialAmount + stats.incomeCash - stats.expenseCash

  const cashPercentage = totalIncome > 0 ? Math.round((stats.incomeCash / totalIncome) * 100) : 0
  const cardPercentage = totalIncome > 0 ? Math.round((stats.incomeCard / totalIncome) * 100) : 0

  return (
    <main style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '450px', margin: '0 auto', paddingBottom: '60px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <Link href="/" style={{ color: '#2563eb', fontWeight: 'bold', textDecoration: 'none', fontSize: '14px' }}>← ΠΙΣΩ</Link>
          <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0 }}>Ανάλυση</h2>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} style={selectStyle}>
            {['Ημέρα', 'Εβδομάδα', 'Μήνας', 'Έτος', 'Όλα'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* ΜΕΤΡΗΤΑ ΣΤΟ ΣΥΡΤΑΡΙ */}
        <div style={darkCard}>
          <p style={labelStyleLight}>ΜΕΤΡΗΤΑ ΣΤΟ ΣΥΡΤΑΡΙ</p>
          <h2 style={{ fontSize: '36px', fontWeight: '800', margin: 0 }}>{totalCashInPocket.toFixed(2)}€</h2>
          <div style={statsRow}>
             <span style={{ color: '#4ade80' }}>+ {stats.incomeCash.toFixed(2)}€</span>
             <span style={{ color: '#f87171' }}>- {stats.expenseCash.toFixed(2)}€</span>
          </div>
          <p style={{ fontSize: '10px', marginTop: '10px', opacity: 0.6 }}>Περιλαμβάνει αρχικό ποσό: {initialAmount}€</p>
        </div>

        {/* ΚΙΝΗΣΗ ΚΑΡΤΩΝ */}
        <div style={whiteCard}>
          <p style={labelStyleDark}>ΚΙΝΗΣΗ ΚΑΡΤΩΝ (POS / ΤΡΑΠΕΖΑ)</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: '#2563eb', fontSize: '28px', fontWeight: '800', margin: 0 }}>{stats.incomeCard.toFixed(2)}€</h3>
            <span style={subNote}>ΕΞΟΔΑ: {stats.expenseCard.toFixed(2)}€</span>
          </div>
        </div>

        {/* ΚΑΡΤΑ ΠΙΣΤΩΣΕΩΝ */}
        <div style={orangeCard}>
          <p style={labelStyleOrange}>ΥΠΟΛΟΙΠΟ ΠΙΣΤΩΣΕΩΝ (ΧΡΕΗ)</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', margin: 0 }}>{stats.credits.toFixed(2)}€</h3>
            <span style={{ color: '#16a34a', fontSize: '11px', fontWeight: 'bold' }}>ΠΛΗΡΩΜΕΣ: -{stats.debtPayments.toFixed(2)}€</span>
          </div>
        </div>

        {/* ΣΥΝΟΛΟ ΕΣΟΔΩΝ */}
        <div style={{ padding: '0 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>ΣΥΝΟΛΟ ΕΣΟΔΩΝ:</span>
                <span style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b' }}>{totalIncome.toFixed(2)}€</span>
            </div>
            
            <div style={progressBar}>
                <div style={{ width: `${cashPercentage}%`, backgroundColor: '#111827', transition: 'width 0.5s' }}></div>
                <div style={{ width: `${cardPercentage}%`, backgroundColor: '#2563eb', transition: 'width 0.5s' }}></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '800' }}>
                <span style={{ color: '#111827' }}>● ΜΕΤΡΗΤΑ: {cashPercentage}%</span>
                <span style={{ color: '#2563eb' }}>● ΚΑΡΤΑ / VISA: {cardPercentage}%</span>
            </div>
        </div>

        <button onClick={fetchData} disabled={loading} style={refreshBtn}>
          {loading ? 'ΦΟΡΤΩΣΗ...' : '🔄 ΕΠΙΚΑΙΡΟΠΟΙΗΣΗ ΣΤΑΤΙΣΤΙΚΩΝ'}
        </button>
      </div>
    </main>
  )
}

// STYLES
const selectStyle = { padding: '8px 12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontWeight: 'bold' as const, backgroundColor: 'white' };
const darkCard = { backgroundColor: '#111827', padding: '24px', borderRadius: '28px', color: 'white', marginBottom: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' };
const whiteCard = { backgroundColor: 'white', padding: '24px', borderRadius: '28px', border: '1px solid #f1f5f9', marginBottom: '16px' };
const orangeCard = { backgroundColor: '#fffaf5', padding: '24px', borderRadius: '28px', border: '1px solid #fff2e5', marginBottom: '24px' };
const labelStyleLight = { fontSize: '10px', fontWeight: 'bold' as const, color: '#9ca3af', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' as const };
const labelStyleDark = { fontSize: '10px', fontWeight: 'bold' as const, color: '#64748b', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' as const };
const labelStyleOrange = { fontSize: '10px', fontWeight: 'bold' as const, color: '#c2410c', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' as const };
const statsRow = { display: 'flex', gap: '15px', marginTop: '15px', borderTop: '1px solid #374151', paddingTop: '15px' };
const subNote = { fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' as const };
const progressBar = { height: '10px', backgroundColor: '#e2e8f0', borderRadius: '20px', overflow: 'hidden', display: 'flex', marginBottom: '12px' };
const refreshBtn = { width: '100%', marginTop: '40px', padding: '18px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '18px', color: '#64748b', fontWeight: 'bold' as const, fontSize: '13px', cursor: 'pointer' };
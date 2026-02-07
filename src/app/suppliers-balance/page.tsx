'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function BalanceContent() {
  const router = useRouter()
  const [debtors, setDebtors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDebts() {
      setLoading(true)
      
      // 1. Φέρνουμε όλους τους προμηθευτές
      const { data: sups } = await supabase.from('suppliers').select('*').order('name')
      
      // 2. Φέρνουμε όλες τις κινήσεις που αφορούν πιστώσεις ή πληρωμές χρεών
      const { data: trans } = await supabase
        .from('transactions')
        .select('*')
        .or('is_credit.eq.true,is_debt_payment.eq.true')

      if (sups && trans) {
        const results = sups.map(s => {
          const sTrans = trans.filter(t => t.supplier_id === s.id)
          
          // Υπολογισμός Πιστώσεων (Νέα χρέη)
          const totalCredits = sTrans
            .filter(t => t.is_credit === true)
            .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
          
          // Υπολογισμός Πληρωμών (Έναντι παλαιού χρέους)
          const totalPayments = sTrans
            .filter(t => t.is_debt_payment === true)
            .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

          const currentBalance = totalCredits - totalPayments

          return { ...s, currentBalance }
        })
        // ΦΙΛΤΡΟ: Κρατάμε ΜΟΝΟ όσους έχουν υπόλοιπο μεγαλύτερο από 0
        .filter(item => item.currentBalance > 0)

        setDebtors(results)
      }
      setLoading(false)
    }
    fetchDebts()
  }, [])

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <button onClick={() => router.push('/')} style={backBtnStyle}>←</button>
        <div>
          <h2 style={{ fontWeight: '900', margin: 0, fontSize: '22px' }}>Καρτέλες Οφειλών</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Έμποροι με υπόλοιπο επί πίστωση</p>
        </div>
      </div>

      {/* ΛΙΣΤΑ ΟΦΕΙΛΕΤΩΝ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8' }}>Υπολογισμός υπολοίπων...</p>
        ) : debtors.length === 0 ? (
          <div style={emptyStateStyle}>
            <span style={{ fontSize: '40px' }}>🎉</span>
            <p style={{ fontWeight: 'bold', margin: '10px 0 0 0' }}>Κανένα χρέος!</p>
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>Όλες οι πιστώσεις έχουν εξοφληθεί.</p>
          </div>
        ) : debtors.map(s => (
          <div key={s.id} style={debtCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={labelStyle}>ΠΡΟΜΗΘΕΥΤΗΣ</span>
                <div style={{ fontWeight: '800', fontSize: '18px', color: '#1e293b', marginTop: '2px' }}>{s.name}</div>
                {s.phone && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>📞 {s.phone}</div>}
              </div>
              <div style={badgeStyle}>ΕΠΙ ΠΙΣΤΩΣΕΙ</div>
            </div>

            <div style={balanceBoxStyle}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#c2410c' }}>ΥΠΟΛΟΙΠΟ ΠΡΟΣ ΕΞΟΦΛΗΣΗ</span>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#ea580c' }}>
                {s.currentBalance.toFixed(2)}€
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SuppliersBalancePage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px' }}>Φόρτωση...</div>}>
      <BalanceContent />
    </Suspense>
  )
}

// STYLES
const backBtnStyle = { border: 'none', background: '#f1f5f9', width: '45px', height: '45px', borderRadius: '15px', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const debtCardStyle = { backgroundColor: 'white', padding: '20px', borderRadius: '25px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.5px' };
const balanceBoxStyle = { marginTop: '15px', padding: '15px', backgroundColor: '#fff7ed', borderRadius: '18px', border: '1px solid #ffedd5', textAlign: 'center' as const };
const badgeStyle = { backgroundColor: '#fee2e2', color: '#ef4444', padding: '5px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: '900' };
const emptyStateStyle = { textAlign: 'center' as const, padding: '40px', backgroundColor: '#f0fdf4', borderRadius: '25px', border: '1px solid #dcfce7' };
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function BalancesContent() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBalances()
  }, [])

  async function fetchBalances() {
    setLoading(true)
    const { data: sups } = await supabase.from('suppliers').select('*').order('name')
    const { data: trans } = await supabase.from('transactions').select('*')

    if (sups && trans) {
      const balanceList = sups.map(s => {
        const sTrans = trans.filter(t => t.supplier_id === s.id)
        // Υπολογισμός Πιστώσεων (Νέα Χρέη)
        const totalCredit = sTrans.filter(t => t.is_credit).reduce((acc, t) => acc + Number(t.amount), 0)
        // Υπολογισμός Πληρωμών (Έναντι - type: debt_payment)
        const totalPaid = sTrans.filter(t => t.type === 'debt_payment').reduce((acc, t) => acc + Number(t.amount), 0)
        return { ...s, balance: totalCredit - totalPaid }
      }).filter(s => s.balance > 0)

      setData(balanceList)
    }
    setLoading(false)
  }

  const totalDebt = data.reduce((acc, s) => acc + s.balance, 0)

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
        <Link href="/" style={backBtnStyle}>←</Link>
        <h2 style={{ fontWeight: '900', fontSize: '22px', color: '#1e293b', margin: 0 }}>Καρτέλες (Οφειλές)</h2>
      </div>

      <div style={totalCardStyle}>
        <p style={{ margin: 0, fontSize: '10px', fontWeight: '800', color: '#94a3b8', letterSpacing: '1px' }}>ΣΥΝΟΛΙΚΟ ΑΝΟΙΧΤΟ ΥΠΟΛΟΙΠΟ</p>
        <p style={{ margin: '5px 0 0 0', fontSize: '32px', fontWeight: '900', color: '#fb923c' }}>
          {totalDebt.toFixed(2)}€
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>ΑΝΑΛΥΣΗ ΑΝΑ ΠΡΟΜΗΘΕΥΤΗ ({data.length})</p>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Φόρτωση...</div>
        ) : data.length > 0 ? (
          data.map(s => (
            <div key={s.id} style={supplierCardStyle}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '800', margin: 0, fontSize: '16px', color: '#1e293b' }}>{s.name}</p>
                <span style={badgeStyle}>{s.category || 'Προμηθευτής'}</span>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: '900', fontSize: '18px', color: '#ea580c', margin: 0 }}>{s.balance.toFixed(2)}€</p>
                {/* ΔΙΟΡΘΩΜΕΝΟ ΚΟΥΜΠΙ */}
                <button 
                  onClick={() => router.push(`/add-expense?supId=${s.id}&againstDebt=true`)}
                  style={payBtnStyle}
                >
                  ΕΞΟΦΛΗΣΗ
                </button>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>
            <p style={{ fontSize: '40px' }}>✅</p>
            <p style={{ fontWeight: '800' }}>Δεν υπάρχουν εκκρεμείς οφειλές</p>
          </div>
        )}
      </div>
    </div>
  )
}

// STYLES
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: 'white', width: '40px', height: '40px', borderRadius: '12px', fontSize: '20px', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: 'bold' as const };
const totalCardStyle = { backgroundColor: '#0f172a', padding: '25px', borderRadius: '24px', marginBottom: '25px', textAlign: 'center' as const, color: 'white', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' };
const supplierCardStyle = { backgroundColor: 'white', padding: '18px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const payBtnStyle = { backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '11px', fontWeight: '900' as const, marginTop: '8px', cursor: 'pointer' };
const badgeStyle = { fontSize: '9px', fontWeight: '800' as const, backgroundColor: '#fff7ed', color: '#c2410c', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' as const, marginTop: '5px', display: 'inline-block' };

export default function SuppliersBalancePage() {
  return (<Suspense fallback={<div>Φόρτωση...</div>}><BalancesContent /></Suspense>)
}
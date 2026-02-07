'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
        const totalCredit = sTrans.filter(t => t.is_credit).reduce((acc, t) => acc + Number(t.amount), 0)
        const totalPaid = sTrans.filter(t => t.is_debt_payment).reduce((acc, t) => acc + Number(t.amount), 0)
        return { ...s, balance: totalCredit - totalPaid }
      }).filter(s => s.balance > 0)

      setData(balanceList)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '15px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
        <button onClick={() => router.push('/')} style={{ border:'none', background:'#f1f5f9', width:'40px', height:'40px', borderRadius:'12px', fontSize:'20px', cursor:'pointer' }}>←</button>
        <h2 style={{ fontWeight: '900', margin: 0 }}>Καρτέλες (Οφειλές)</h2>
      </div>

      <div style={{ backgroundColor:'#fff7ed', padding:'20px', borderRadius:'20px', marginBottom:'20px', border:'1px solid #ffedd5', textAlign:'center' }}>
        <p style={{margin:0, fontSize:'12px', fontWeight:'700'}}>ΣΥΝΟΛΙΚΟ ΧΡΕΟΣ ΠΡΟΜΗΘΕΥΤΩΝ</p>
        <p style={{margin:0, fontSize:'24px', fontWeight:'900', color:'#ea580c'}}>
          {data.reduce((acc, s) => acc + s.balance, 0).toFixed(2)}€
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? <p>Φόρτωση...</p> : data.map(s => (
          <div key={s.id} style={{ backgroundColor:'white', padding:'18px', borderRadius:'20px', display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #f1f5f9' }}>
            <div>
              <p style={{ fontWeight: '800', margin: 0, fontSize: '16px' }}>{s.name}</p>
              <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', margin: '4px 0 0 0' }}>ΑΝΟΙΧΤΟ ΥΠΟΛΟΙΠΟ</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontWeight: '900', fontSize: '18px', color: '#ea580c', margin: 0 }}>{s.balance.toFixed(2)}€</p>
              {/* ΤΟ ΔΙΟΡΘΩΜΕΝΟ ΚΟΥΜΠΙ ΠΟΥ ΣΤΕΛΝΕΙ ΤΑ ΣΤΟΙΧΕΙΑ ΑΥΤΟΜΑΤΑ */}
              <button 
                onClick={() => router.push(`/add-expense?supplier_id=${s.id}&type=payment`)}
                style={{ backgroundColor:'#1e40af', color:'white', border:'none', padding:'8px 16px', borderRadius:'10px', fontSize:'12px', fontWeight:'800', marginTop:'8px', cursor:'pointer' }}
              >
                ΕΞΟΦΛΗΣΗ
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SuppliersBalancePage() {
  return (<Suspense fallback={<div>Φόρτωση...</div>}><BalancesContent /></Suspense>)
}
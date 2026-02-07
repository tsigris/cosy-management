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
    // Φέρνουμε προμηθευτές και όλες τις συναλλαγές τους
    const { data: sups } = await supabase.from('suppliers').select('*').order('name')
    const { data: trans } = await supabase.from('transactions').select('*')

    if (sups && trans) {
      const balanceList = sups.map(s => {
        const sTrans = trans.filter(t => t.supplier_id === s.id)
        
        // Υπολογισμός υπολοίπου: Πιστώσεις (+) μείον Πληρωμές έναντι (-)
        const totalCredit = sTrans.filter(t => t.is_credit).reduce((acc, t) => acc + Number(t.amount), 0)
        const totalPaid = sTrans.filter(t => t.is_debt_payment).reduce((acc, t) => acc + Number(t.amount), 0)
        const balance = totalCredit - totalPaid

        return { ...s, balance }
      }).filter(s => s.balance > 0) // ΔΕΙΧΝΕΙ ΜΟΝΟ ΟΣΟΥΣ ΕΧΟΥΝ ΥΠΟΛΟΙΠΟ > 0

      setData(balanceList)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '15px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
        <button onClick={() => router.push('/')} style={backBtnStyle}>←</button>
        <h2 style={{ fontWeight: '900', margin: 0 }}>Καρτέλες (Οφειλές)</h2>
      </div>

      <div style={infoBox}>
        <p style={{margin:0, fontSize:'12px', fontWeight:'700'}}>ΣΥΝΟΛΙΚΟ ΧΡΕΟΣ ΠΡΟΜΗΘΕΥΤΩΝ</p>
        <p style={{margin:0, fontSize:'24px', fontWeight:'900', color:'#ea580c'}}>
          {data.reduce((acc, s) => acc + s.balance, 0).toFixed(2)}€
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? <p>Φόρτωση...</p> : data.length === 0 ? <p>Δεν υπάρχουν εκκρεμή χρέη.</p> : data.map(s => (
          <div key={s.id} style={cardStyle}>
            <div>
              <p style={{ fontWeight: '800', margin: 0, fontSize: '16px' }}>{s.name}</p>
              <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', margin: '4px 0 0 0' }}>ΑΝΟΙΧΤΟ ΥΠΟΛΟΙΠΟ</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontWeight: '900', fontSize: '18px', color: '#ea580c', margin: 0 }}>{s.balance.toFixed(2)}€</p>
              <button 
                onClick={() => router.push(`/add-expense?supplier_id=${s.id}&type=payment`)}
                style={payBtnStyle}
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

// STYLES
const backBtnStyle = { border:'none', background:'#f1f5f9', width:'40px', height:'40px', borderRadius:'12px', fontSize:'20px', cursor:'pointer' };
const infoBox = { backgroundColor:'#fff7ed', padding:'20px', borderRadius:'20px', marginBottom:'20px', border:'1px solid #ffedd5', textAlign:'center' as const };
const cardStyle = { backgroundColor:'white', padding:'18px', borderRadius:'20px', display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #f1f5f9' };
const payBtnStyle = { backgroundColor:'#1e40af', color:'white', border:'none', padding:'6px 12px', borderRadius:'8px', fontSize:'11px', fontWeight:'800', marginTop:'8px', cursor:'pointer' };
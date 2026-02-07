'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function BalanceContent() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function calculateBalances() {
      setLoading(true)
      // Φέρνουμε όλους τους προμηθευτές και όλες τις συναλλαγές τους
      const { data: sups } = await supabase.from('suppliers').select('*').order('name')
      const { data: trans } = await supabase.from('transactions').select('*').not('supplier_id', 'is', null)

      if (sups && trans) {
        const report = sups.map(s => {
          const sTrans = trans.filter(t => t.supplier_id === s.id)
          
          // Τζίρος: Όλα τα έξοδα (μετρητά + πιστώσεις)
          const turnover = sTrans.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
          
          // Πιστώσεις (Χρέη που δημιουργήθηκαν)
          const credits = sTrans.filter(t => t.is_credit).reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
          
          // Πληρωμές έναντι παλαιού χρέους
          const payments = sTrans.filter(t => t.is_debt_payment).reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

          return { ...s, turnover, balance: credits - payments }
        })
        setData(report)
      }
      setLoading(false)
    }
    calculateBalances()
  }, [])

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
        <button onClick={() => router.push('/')} style={backBtnStyle}>←</button>
        <h2 style={{ fontWeight: '900', margin: 0 }}>Καρτέλες Προμηθευτών</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {loading ? <p>Υπολογισμός...</p> : data.map(s => (
          <div key={s.id} style={cardStyle}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '10px' }}>
              <span style={{ fontWeight: '800', fontSize: '18px', color: '#1e293b' }}>{s.name}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={labelStyle}>ΣΥΝΟΛΙΚΟΣ ΤΖΙΡΟΣ</span>
              <span style={{ fontWeight: '700' }}>{s.turnover.toFixed(2)}€</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: s.balance > 0 ? '#fff7ed' : '#f0fdf4', borderRadius: '12px' }}>
              <span style={{ ...labelStyle, color: s.balance > 0 ? '#c2410c' : '#15803d' }}>ΥΠΟΛΟΙΠΟ ΟΦΕΙΛΗΣ</span>
              <span style={{ fontWeight: '900', fontSize: '18px', color: s.balance > 0 ? '#ea580c' : '#16a34a' }}>
                {s.balance.toFixed(2)}€
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SuppliersBalancePage() {
  return (
    <Suspense fallback={<div>Φόρτωση...</div>}>
      <BalanceContent />
    </Suspense>
  )
}

const backBtnStyle = { border: 'none', background: '#f1f5f9', width: '40px', height: '40px', borderRadius: '12px', fontSize: '20px', cursor: 'pointer' };
const cardStyle = { backgroundColor: 'white', padding: '18px', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const labelStyle = { fontSize: '11px', fontWeight: '800', color: '#94a3b8' };
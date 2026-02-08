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
  const [permissions, setPermissions] = useState({ role: 'user', store_id: null as string | null })

  useEffect(() => {
    checkAccessAndFetch()
  }, [])

  async function checkAccessAndFetch() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, can_view_analysis, store_id')
          .eq('id', user.id)
          .single()

        if (profile) {
          if (profile.role !== 'admin' && !profile.can_view_analysis) {
            alert("Δεν έχετε πρόσβαση στις καρτέλες οφειλών.")
            router.push('/')
            return
          }
          setPermissions({ role: profile.role, store_id: profile.store_id })
          await fetchBalances(profile.store_id)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchBalances(storeId: string) {
    // Φιλτράρουμε αυστηρά βάσει storeId
    const [supsRes, transRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('store_id', storeId).order('name'),
      supabase.from('transactions').select('*').eq('store_id', storeId)
    ])

    if (supsRes.data && transRes.data) {
      const trans = transRes.data
      const balanceList = supsRes.data.map(s => {
        const sTrans = trans.filter(t => t.supplier_id === s.id)
        // Υπολογισμός χρέους (is_credit) μείον πληρωμές (debt_payment)
        const totalCredit = sTrans.filter(t => t.is_credit).reduce((acc, t) => acc + Number(t.amount), 0)
        const totalPaid = sTrans.filter(t => t.type === 'debt_payment').reduce((acc, t) => acc + Number(t.amount), 0)
        return { ...s, balance: totalCredit - totalPaid }
      }).filter(s => s.balance > 0) // Δείχνουμε μόνο όσους χρωστάμε

      setData(balanceList)
    }
  }

  const totalDebt = data.reduce((acc, s) => acc + s.balance, 0)

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      {/* PROFESSIONAL GRAPHIC HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>
            <span style={{ fontSize: '20px' }}>🚩</span>
          </div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '20px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
              Καρτέλες (Χρέη)
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ΥΠΟΛΟΙΠΑ ΠΡΟΜΗΘΕΥΤΩΝ
            </p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      {/* ΣΥΝΟΛΙΚΟ ΧΡΕΟΣ */}
      <div style={totalCardStyle}>
        <p style={{ margin: 0, fontSize: '10px', fontWeight: '800', color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' }}>Συνολικό Ανοιχτό Υπόλοιπο</p>
        <p style={{ margin: '8px 0 0 0', fontSize: '36px', fontWeight: '900', color: '#fb923c' }}>
          {totalDebt.toFixed(2)}€
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Ανάλυση ανά προμηθευτή ({data.length})</p>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Υπολογισμός υπολοίπων...</div>
        ) : data.length > 0 ? (
          data.map(s => (
            <div key={s.id} style={supplierCardStyle}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '800', margin: 0, fontSize: '16px', color: '#1e293b' }}>{s.name.toUpperCase()}</p>
                <span style={badgeStyle}>{s.category || 'Εμπορεύματα'}</span>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: '900', fontSize: '18px', color: '#ea580c', margin: 0 }}>{s.balance.toFixed(2)}€</p>
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
          <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '28px', border: '1px dashed #e2e8f0' }}>
            <p style={{ fontSize: '40px', margin: '0 0 10px 0' }}>✅</p>
            <p style={{ fontWeight: '800', color: '#1e293b', margin: 0 }}>Κανένα ανοιχτό υπόλοιπο</p>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px' }}>Όλοι οι προμηθευτές είναι εξοφλημένοι.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// STYLES
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#ffedd5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' };
const totalCardStyle: any = { backgroundColor: '#0f172a', padding: '30px', borderRadius: '28px', marginBottom: '25px', textAlign: 'center', color: 'white', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' };
const supplierCardStyle: any = { backgroundColor: 'white', padding: '18px', borderRadius: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9' };
const payBtnStyle: any = { backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '11px', fontWeight: '900', marginTop: '8px', cursor: 'pointer' };
const badgeStyle: any = { fontSize: '9px', fontWeight: '800', backgroundColor: '#f1f5f9', color: '#64748b', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase', marginTop: '6px', display: 'inline-block' };

export default function SuppliersBalancePage() {
  return (<Suspense fallback={<div>Φόρτωση...</div>}><BalancesContent /></Suspense>)
}
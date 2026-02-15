'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// --- ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΠΑΛΕΤΑ ---
const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentOrange: '#f97316', // Για τα χρέη
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  accentBlue: '#2563eb'
};

function BalancesContent() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all')

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', session.user.id).single()
      
      if (profile?.store_id) {
        const [supsRes, transRes] = await Promise.all([
          supabase.from('suppliers').select('*').eq('store_id', profile.store_id).order('name'),
          supabase.from('transactions').select('*').eq('store_id', profile.store_id)
        ])

        if (supsRes.data && transRes.data) {
          const trans = transRes.data
          const balanceList = supsRes.data.map(s => {
            const sTrans = trans.filter(t => t.supplier_id === s.id)
            const totalCredit = sTrans.filter(t => t.is_credit).reduce((acc, t) => acc + Number(t.amount), 0)
            const totalPaid = sTrans.filter(t => t.type === 'debt_payment').reduce((acc, t) => acc + Number(t.amount), 0)
            return { ...s, balance: totalCredit - totalPaid }
          }).filter(s => s.balance > 0)

          setData(balanceList)
        }
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchBalances() }, [fetchBalances])

  // Φιλτράρισμα και υπολογισμός βάσει επιλογής
  const filteredData = useMemo(() => {
    if (selectedSupplierId === 'all') return data;
    return data.filter(s => s.id === selectedSupplierId);
  }, [selectedSupplierId, data]);

  const totalDebtDisplay = filteredData.reduce((acc, s) => acc + s.balance, 0);

  return (
    <div style={iphoneWrapper}>
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>🚩</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '20px', margin: 0, color: colors.primaryDark }}>Καρτέλες (Χρέη)</h1>
              <p style={{ margin: 0, fontSize: '10px', color: colors.secondaryText, fontWeight: '700', letterSpacing: '1px' }}>ΥΠΟΛΟΙΠΑ ΠΡΟΜΗΘΕΥΤΩΝ</p>
            </div>
          </div>
          <Link href="/" style={backBtnStyle}>✕</Link>
        </div>

        {/* ΦΙΛΤΡΟ ΠΡΟΜΗΘΕΥΤΗ */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>ΕΠΙΛΟΓΗ ΠΡΟΜΗΘΕΥΤΗ</label>
          <select 
            value={selectedSupplierId} 
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            style={selectStyle}
          >
            <option value="all">📊 ΓΕΝΙΚΟ ΣΥΝΟΛΟ</option>
            {data.map(s => (
              <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* ΣΥΝΟΛΙΚΟ ΧΡΕΟΣ (ΔΥΝΑΜΙΚΟ) */}
        <div style={totalCardStyle}>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#fed7aa', letterSpacing: '1px' }}>
            {selectedSupplierId === 'all' ? 'ΣΥΝΟΛΙΚΟ ΑΝΟΙΧΤΟ ΥΠΟΛΟΙΠΟ' : 'ΥΠΟΛΟΙΠΟ ΠΡΟΜΗΘΕΥΤΗ'}
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '38px', fontWeight: '900', color: '#ffffff' }}>
            {totalDebtDisplay.toFixed(2)}€
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ΑΝΑΛΥΣΗ ({filteredData.length})
          </p>
          
          {loading ? (
            <p style={{ textAlign: 'center', padding: '40px', color: colors.secondaryText, fontWeight: '600' }}>Υπολογισμός υπολοίπων...</p>
          ) : filteredData.length > 0 ? (
            filteredData.map(s => (
              <div key={s.id} style={supplierCardStyle}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '700', margin: 0, fontSize: '16px', color: colors.primaryDark }}>{s.name.toUpperCase()}</p>
                  <span style={badgeStyle}>{s.category || 'Εμπορεύματα'}</span>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: '800', fontSize: '18px', color: colors.accentOrange, margin: 0 }}>{s.balance.toFixed(2)}€</p>
                  <button 
                    onClick={() => router.push(`/expenses/add?supId=${s.id}&mode=debt`)}
                    style={payBtnStyle}
                  >
                    ΕΞΟΦΛΗΣΗ
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={emptyStateStyle}>
              <p style={{ fontSize: '40px', margin: '0 0 10px 0' }}>✅</p>
              <p style={{ fontWeight: '800', color: colors.primaryDark, margin: 0 }}>Κανένα ανοιχτό υπόλοιπο</p>
              <p style={{ fontSize: '12px', color: colors.secondaryText, marginTop: '5px' }}>Όλα είναι εξοφλημένα για την επιλογή σας.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// STYLES
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#ffedd5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', fontWeight: 'bold', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` };
const totalCardStyle: any = { backgroundColor: colors.primaryDark, padding: '30px 20px', borderRadius: '24px', marginBottom: '25px', textAlign: 'center', color: 'white', boxShadow: '0 10px 25px rgba(30, 41, 59, 0.2)' };
const supplierCardStyle: any = { backgroundColor: colors.white, padding: '18px 20px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${colors.border}`, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' };
const payBtnStyle: any = { backgroundColor: colors.accentBlue, color: 'white', border: 'none', padding: '10px 16px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', marginTop: '10px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)' };
const badgeStyle: any = { fontSize: '9px', fontWeight: '800', backgroundColor: colors.bgLight, color: colors.secondaryText, padding: '4px 8px', borderRadius: '6px', marginTop: '6px', display: 'inline-block', border: `1px solid ${colors.border}` };
const emptyStateStyle: any = { textAlign: 'center', padding: '60px 20px', background: colors.white, borderRadius: '24px', border: `1px dashed ${colors.border}` };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '8px', display: 'block', textTransform: 'uppercase' };
const selectStyle: any = { width: '100%', padding: '14px', borderRadius: '14px', border: `1px solid ${colors.border}`, fontSize: '15px', fontWeight: '700', backgroundColor: colors.white, outline: 'none', appearance: 'none' };

export default function SuppliersBalancePage() {
  return (<Suspense fallback={<div>Φόρτωση...</div>}><BalancesContent /></Suspense>)
}
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function PayEmployeeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const empId = searchParams.get('id')
  const empName = searchParams.get('name')

  const [bankAmount, setBankAmount] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [userData, setUserData] = useState({ store_id: '', username: '' })

  useEffect(() => {
    async function getUserProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('store_id, username').eq('id', user.id).single()
        if (profile) setUserData({ store_id: profile.store_id, username: profile.username || 'Admin' })
      }
    }
    getUserProfile()
  }, [])

  async function handlePayment() {
    const total = (Number(bankAmount) || 0) + (Number(cashAmount) || 0)
    if (total <= 0) return alert('Παρακαλώ εισάγετε ένα ποσό πληρωμής.')
    
    setLoading(true)
    const transactions = []

    if (Number(bankAmount) > 0) {
      transactions.push({
        amount: Number(bankAmount),
        type: 'expense',
        category: 'Προσωπικό',
        method: 'Τράπεζα',
        date,
        employee_id: empId,
        store_id: userData.store_id,
        created_by_name: userData.username,
        notes: `Πληρωμή: ${empName} (Τράπεζα)`
      })
    }

    if (Number(cashAmount) > 0) {
      transactions.push({
        amount: Number(cashAmount),
        type: 'expense',
        category: 'Προσωπικό',
        method: 'Μετρητά',
        date,
        employee_id: empId,
        store_id: userData.store_id,
        created_by_name: userData.username,
        notes: `Πληρωμή: ${empName} (Μετρητά)`
      })
    }

    const { error } = await supabase.from('transactions').insert(transactions)

    if (!error) {
      router.push('/employees')
    } else {
      alert('Σφάλμα: ' + error.message)
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* PROFESSIONAL HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>
            <span style={{ fontSize: '20px' }}>💸</span>
          </div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '20px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
              Πληρωμή
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ΚΑΤΑΧΩΡΗΣΗ ΜΙΣΘΟΔΟΣΙΑΣ
            </p>
          </div>
        </div>
        <Link href="/employees" style={backBtnStyle}>✕</Link>
      </div>

      <div style={formCardStyle}>
        {/* EMPLOYEE INFO */}
        <div style={infoBoxStyle}>
          <p style={labelStyle}>ΥΠΑΛΛΗΛΟΣ</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#1e293b' }}>{empName}</p>
        </div>

        {/* BANK AMOUNT */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ ...labelStyle, color: '#2563eb' }}>🏦 ΠΟΣΟ ΤΡΑΠΕΖΑΣ (€)</p>
          <input 
            type="number" 
            value={bankAmount} 
            onChange={e => setBankAmount(e.target.value)} 
            style={{ ...amountInput, borderColor: '#dbeafe', color: '#1d4ed8' }} 
            placeholder="0.00" 
          />
        </div>

        {/* CASH AMOUNT */}
        <div style={{ marginBottom: '25px' }}>
          <p style={{ ...labelStyle, color: '#16a34a' }}>💵 ΠΟΣΟ ΜΕΤΡΗΤΩΝ (€)</p>
          <input 
            type="number" 
            value={cashAmount} 
            onChange={e => setCashAmount(e.target.value)} 
            style={{ ...amountInput, borderColor: '#dcfce7', color: '#15803d' }} 
            placeholder="0.00" 
          />
        </div>

        {/* TOTAL PREVIEW */}
        <div style={totalDisplayCard}>
            <p style={{ margin: 0, fontSize: '10px', fontWeight: '900', color: '#94a3b8', letterSpacing: '1px' }}>ΣΥΝΟΛΙΚΗ ΠΛΗΡΩΜΗ</p>
            <h2 style={{ margin: '5px 0 0', fontSize: '32px', fontWeight: '900', color: '#0f172a' }}>
                {((Number(bankAmount) || 0) + (Number(cashAmount) || 0)).toLocaleString('el-GR')}€
            </h2>
        </div>

        {/* DATE PICKER */}
        <div style={{ marginBottom: '30px' }}>
          <p style={labelStyle}>ΗΜΕΡΟΜΗΝΙΑ ΠΛΗΡΩΜΗΣ</p>
          <div style={dateWrapper}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={dateInputStyle} />
            <span style={{ fontSize: '18px' }}>📅</span>
          </div>
        </div>

        <button onClick={handlePayment} disabled={loading} style={saveBtnStyle}>
          {loading ? 'ΚΑΤΑΧΩΡΗΣΗ...' : 'ΕΠΙΒΕΒΑΙΩΣΗ ΠΛΗΡΩΜΗΣ'}
        </button>
      </div>

    </div>
  )
}

// STYLES
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' };
const formCardStyle: any = { backgroundColor: 'white', padding: '24px', borderRadius: '28px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' };
const infoBoxStyle: any = { padding: '15px', backgroundColor: '#f8fafc', borderRadius: '16px', marginBottom: '25px', border: '1px solid #f1f5f9' };
const labelStyle: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.5px' };
const amountInput: any = { width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid', fontSize: '24px', fontWeight: '900', textAlign: 'center', outline: 'none', backgroundColor: '#fcfcfc', boxSizing: 'border-box' };
const totalDisplayCard: any = { padding: '20px', backgroundColor: '#f1f5f9', borderRadius: '20px', textAlign: 'center', marginBottom: '25px', border: '1px solid #e2e8f0' };
const dateWrapper: any = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e2e8f0' };
const dateInputStyle: any = { border: 'none', outline: 'none', fontSize: '15px', fontWeight: '800', color: '#1e293b', width: '100%', cursor: 'pointer' };
const saveBtnStyle: any = { width: '100%', padding: '20px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '18px', fontWeight: '900', fontSize: '15px', cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' };

export default function PayEmployeePage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><PayEmployeeContent /></Suspense>
    </main>
  )
}
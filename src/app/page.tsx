'use client'
// Διασφαλίζει ότι η σελίδα θα λειτουργεί δυναμικά στο Vercel
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Παίρνουμε την ημερομηνία από το URL ή βάζουμε τη σημερινή
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTransactions() {
      setLoading(true)
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('date_recorded', selectedDate)
        .order('created_at', { ascending: false })
      
      if (data) setTransactions(data)
      setLoading(false)
    }
    fetchTransactions()
  }, [selectedDate])

  // Υπολογισμός συνόλων
  const totals = transactions.reduce((acc, t) => {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') acc.income += amt
    else acc.expense += amt
    return acc
  }, { income: 0, expense: 0 })

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontWeight: '900', fontSize: '28px', marginBottom: '20px', color: '#1e293b' }}>ΚΑΤΑΣΤΗΜΑ</h1>

      {/* ΚΑΡΤΕΣ ΣΤΑΤΙΣΤΙΚΩΝ */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}>
          <p style={labelStyle}>ΕΣΟΔΑ ΗΜΕΡΑΣ</p>
          <p style={{ color: '#16a34a', fontSize: '24px', fontWeight: '900', margin: 0 }}>{totals.income.toFixed(2)}€</p>
        </div>
        <div style={cardStyle}>
          <p style={labelStyle}>ΕΞΟΔΑ ΗΜΕΡΑΣ</p>
          <p style={{ color: '#dc2626', fontSize: '24px', fontWeight: '900', margin: 0 }}>{totals.expense.toFixed(2)}€</p>
        </div>
      </div>

      {/* ΚΟΥΜΠΙΑ ΕΝΕΡΓΕΙΑΣ */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
        <Link href={`/add-income?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#7da07d' }}>+ ΕΣΟΔΑ</Link>
        <Link href={`/add-expense?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#c45a4a' }}>- ΕΞΟΔΑ</Link>
      </div>

      {/* ΕΠΙΛΟΓΕΑΣ ΗΜΕΡΟΜΗΝΙΑΣ (ΕΠΑΝΑΦΟΡΑ) */}
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="date" 
          value={selectedDate} 
          onChange={(e) => router.push(`/?date=${e.target.value}`)}
          style={{ 
            width: '100%', 
            padding: '15px', 
            borderRadius: '15px', 
            border: '1px solid #e2e8f0', 
            fontSize: '18px', 
            fontWeight: 'bold', 
            textAlign: 'center',
            backgroundColor: 'white',
            outline: 'none'
          }}
        />
      </div>

      {/* ΛΙΣΤΑ ΠΡΟΣΦΑΤΩΝ ΚΙΝΗΣΕΩΝ */}
      <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '15px', textTransform: 'uppercase' }}>Πρόσφατες Κινήσεις</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', padding: '20px' }}>Φόρτωση...</p>
        ) : transactions.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '20px' }}>Δεν υπάρχουν κινήσεις για σήμερα.</p>
        ) : (
          transactions.map(t => (
            <div key={t.id} style={itemStyle}>
              <div>
                <p style={{ fontWeight: '800', margin: 0, color: '#1e293b' }}>
                  {t.type === 'income' ? '💰 ' + (t.notes || 'ΕΙΣΠΡΑΞΗ') : '💸 ' + (t.category || 'ΕΞΟΔΟ')}
                </p>
                <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', margin: '4px 0 0 0', fontWeight: 'bold' }}>{t.method}</p>
              </div>
              <p style={{ fontWeight: '900', fontSize: '16px', margin: 0, color: t.type === 'income' ? '#16a34a' : '#dc2626' }}>
                {t.type === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Η κύρια σελίδα που περιλαμβάνει το Suspense Boundary για το Vercel
export default function HomePage() {
  return (
    <main style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '20px' }}>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px' }}>Φόρτωση Dashboard...</div>}>
        <DashboardContent />
      </Suspense>
    </main>
  )
}

// STYLES
const cardStyle = { flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '25px', textAlign: 'center' as const, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' as const };
const btnStyle = { flex: 1, padding: '20px', borderRadius: '20px', color: 'white', textDecoration: 'none', textAlign: 'center' as const, fontWeight: 'bold', fontSize: '18px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const itemStyle = { backgroundColor: 'white', padding: '15px', borderRadius: '20px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
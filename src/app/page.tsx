'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Διαχείριση ημερομηνίας από το URL
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTransactions()
  }, [selectedDate])

  async function fetchTransactions() {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', `${selectedDate}T00:00:00`)
      .lte('date', `${selectedDate}T23:59:59`)
      .order('created_at', { ascending: false })
    
    if (data) setTransactions(data)
    setLoading(false)
  }

  // Συνάρτηση Διαγραφής
  async function handleDelete(id: string) {
    if (!confirm('Θέλετε σίγουρα να διαγράψετε αυτή την κίνηση;')) return
    
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (!error) {
      setTransactions(transactions.filter(t => t.id !== id))
    } else {
      alert('Σφάλμα κατά τη διαγραφή: ' + error.message)
    }
  }

  const totals = transactions.reduce((acc, t) => {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') acc.income += amt
    else acc.expense += amt
    return acc
  }, { income: 0, expense: 0 })

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '10px' }}>
        <h1 style={{ fontWeight: '900', fontSize: '28px', margin: 0, color: '#1e293b' }}>ΚΑΤΑΣΤΗΜΑ</h1>
        <Link href="/suppliers" style={{ 
          backgroundColor: '#f1f5f9', 
          padding: '10px', 
          borderRadius: '12px', 
          textDecoration: 'none',
          fontSize: '20px',
          border: '1px solid #e2e8f0'
        }}>⚙️</Link>
      </div>

      {/* ΣΤΑΤΙΣΤΙΚΑ */}
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

      {/* ΚΟΥΜΠΙΑ ΠΡΟΣΘΗΚΗΣ */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
        <Link href={`/add-income?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#7da07d' }}>+ ΕΣΟΔΑ</Link>
        <Link href={`/add-expense?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#c45a4a' }}>- ΕΞΟΔΑ</Link>
      </div>

      {/* ΕΠΙΛΟΓΕΑΣ ΗΜΕΡΟΜΗΝΙΑΣ */}
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="date" 
          value={selectedDate} 
          onChange={(e) => router.push(`/?date=${e.target.value}`)}
          style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}
        />
      </div>

      {/* ΛΙΣΤΑ ΚΙΝΗΣΕΩΝ */}
      <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '15px', textTransform: 'uppercase' }}>Κινήσεις Ημέρας</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <p style={{ textAlign: 'center' }}>Φόρτωση...</p>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Δεν υπάρχουν κινήσεις.</div>
        ) : (
          transactions.map(t => (
            <div key={t.id} style={itemStyle}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '800', margin: 0 }}>
                  {t.type === 'income' ? '💰 ' + (t.notes || 'ΕΙΣΠΡΑΞΗ') : '💸 ' + (t.category || 'ΕΞΟΔΟ')}
                </p>
                <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', margin: '4px 0 0 0', fontWeight: 'bold' }}>{t.method}</p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <p style={{ fontWeight: '900', fontSize: '16px', color: t.type === 'income' ? '#16a34a' : '#dc2626', margin: 0 }}>
                  {t.type === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€
                </p>
                <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <main style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '20px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <DashboardContent />
      </Suspense>
    </main>
  )
}

const cardStyle = { flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '25px', textAlign: 'center' as const };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '5px' };
const btnStyle = { flex: 1, padding: '20px', borderRadius: '20px', color: 'white', textDecoration: 'none', textAlign: 'center' as const, fontWeight: 'bold', fontSize: '18px' };
const itemStyle = { backgroundColor: 'white', padding: '15px', borderRadius: '20px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
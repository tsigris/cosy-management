'use client'
// 1. Απαραίτητο για να μην χτυπάει το Vercel
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SettingsMenu from '@/components/SettingsMenu'
import Link from 'next/link'

// 2. Το κυρίως περιεχόμενο (Dashboard)
function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Διαβάζουμε την ημερομηνία από το URL ή βάζουμε τη σημερινή
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [displayTitle, setDisplayTitle] = useState('ΚΑΤΑΣΤΗΜΑ')

  // Φόρτωση δεδομένων κάθε φορά που αλλάζει η ημερομηνία
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      // Παίρνουμε όνομα καταστήματος και κινήσεις ταυτόχρονα
      await Promise.all([
        fetchStoreName(session.user.id),
        fetchTransactions(selectedDate)
      ])
      setLoading(false)
    }
    loadData()
  }, [selectedDate, router])

  async function fetchStoreName(userId: string) {
    const { data } = await supabase.from('profiles').select('store_name').eq('id', userId).single()
    if (data?.store_name) setDisplayTitle(data.store_name)
  }

  async function fetchTransactions(date: string) {
    const { data } = await supabase
      .from('transactions')
      .select('*, suppliers(name), employees(full_name)')
      .eq('date_recorded', date) // Φιλτράρισμα βάσει της ημερομηνίας
      .order('created_at', { ascending: false })

    if (data) setTransactions(data)
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή κίνησης;')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) fetchTransactions(selectedDate)
  }

  // Υπολογισμός συνόλων
  const totals = transactions.reduce((acc, t) => {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') acc.income += amt
    else acc.expense += amt
    return acc
  }, { income: 0, expense: 0 })

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
          {displayTitle}
        </h1>
        <SettingsMenu />
      </div>

      {/* ΣΥΝΟΛΑ ΗΜΕΡΑΣ */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <div style={statsCard}>
          <p style={statsLabel}>ΕΣΟΔΑ ΗΜΕΡΑΣ</p>
          <p style={{ ...statsValue, color: '#16a34a' }}>{totals.income.toFixed(2)}€</p>
        </div>
        <div style={statsCard}>
          <p style={statsLabel}>ΕΞΟΔΑ ΗΜΕΡΑΣ</p>
          <p style={{ ...statsValue, color: '#ef4444' }}>{totals.expense.toFixed(2)}€</p>
        </div>
      </div>

      {/* ΚΟΥΜΠΙΑ ΕΝΕΡΓΕΙΩΝ (Στέλνουν και την ημερομηνία!) */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '25px' }}>
        <Link href={`/add-income?date=${selectedDate}`} style={mainActionBtn('#6da36d')}>+ ΕΣΟΔΑ</Link>
        <Link href={`/add-expense?date=${selectedDate}`} style={mainActionBtn('#c64d43')}>- ΕΞΟΔΑ</Link>
      </div>

      {/* ΕΠΙΛΟΓΕΑΣ ΗΜΕΡΟΜΗΝΙΑΣ (ΤΟ ΠΡΟΣΘΕΣΑΜΕ ΞΑΝΑ) */}
      <div style={{ marginBottom: '25px', backgroundColor: 'white', padding: '10px', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
        <input 
          type="date" 
          value={selectedDate} 
          onChange={(e) => router.push(`/?date=${e.target.value}`)}
          style={{ width: '100%', border: 'none', fontSize: '18px', fontWeight: 'bold', color: '#334155', textAlign: 'center', outline: 'none' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Κινήσεις {selectedDate.split('-').reverse().join('/')}</p>
      </div>

      {/* ΛΙΣΤΑ ΚΙΝΗΣΕΩΝ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '20px' }}>Φόρτωση...</p>
        ) : transactions.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '20px', fontSize: '14px' }}>Καμία κίνηση για αυτή τη μέρα.</p>
        ) : (
          transactions.map((t) => (
            <div key={t.id} style={transactionCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>
                     {t.category === 'Μισθοδοσία' ? (t.employees?.full_name || 'Μισθοδοσία') : (t.suppliers?.name || t.category || (t.type === 'income' ? 'Είσπραξη' : 'Έξοδο'))}
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
                    {t.method} • {t.notes || ''}
                  </p>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <p style={{ margin: 0, fontWeight: '900', fontSize: '16px', color: t.type === 'income' ? '#16a34a' : '#ef4444' }}>
                    {t.type === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€
                  </p>
                  <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.3 }}>🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// 3. Η σελίδα με το Suspense (ΑΠΑΡΑΙΤΗΤΟ για Vercel)
export default function HomePage() {
  return (
    <Suspense fallback={<p style={{ textAlign: 'center', padding: '50px' }}>Φόρτωση εφαρμογής...</p>}>
      <DashboardContent />
    </Suspense>
  )
}

// STYLES
const statsCard = { flex: 1, backgroundColor: '#ffffff', padding: '18px', borderRadius: '24px', border: '1px solid #f1f5f9', textAlign: 'center' as const, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const statsLabel = { fontSize: '9px', fontWeight: '800', color: '#94a3b8', margin: '0 0 4px 0' };
const statsValue = { fontSize: '22px', fontWeight: '900', margin: 0 };
const mainActionBtn = (bg: string) => ({ flex: 1, backgroundColor: bg, color: 'white', padding: '20px', borderRadius: '20px', textDecoration: 'none', textAlign: 'center' as const, fontWeight: '900', fontSize: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' });
const transactionCard = { backgroundColor: '#ffffff', padding: '18px', borderRadius: '22px', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' };
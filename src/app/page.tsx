'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SettingsMenu from '@/components/SettingsMenu'
import Link from 'next/link'

export default function HomePage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totals, setTotals] = useState({ income: 0, expense: 0 })
  const [displayTitle, setDisplayTitle] = useState('ΚΑΤΑΣΤΗΜΑ') // Προεπιλεγμένος τίτλος

  useEffect(() => {
    const checkUserAndData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
      } else {
        // Τραβάμε το όνομα του καταστήματος και τις κινήσεις ταυτόχρονα
        await Promise.all([
          fetchStoreName(session.user.id),
          fetchDailyTransactions()
        ])
      }
    }
    checkUserAndData()
  }, [router])

  // Λειτουργία για το δυναμικό όνομα καταστήματος
  async function fetchStoreName(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('store_name')
      .eq('id', userId)
      .single()
    
    if (data?.store_name) {
      setDisplayTitle(data.store_name)
    }
  }

  async function fetchDailyTransactions() {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, suppliers(name), employees(full_name)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      setTransactions(data)
      const today = new Date().toISOString().split('T')[0]
      const daily = data.filter(t => t.created_at.startsWith(today)).reduce((acc, t) => {
        if (t.type === 'income') acc.income += Number(t.amount)
        else acc.expense += Number(t.amount)
        return acc
      }, { income: 0, expense: 0 })
      setTotals(daily)
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή κίνησης;')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) fetchDailyTransactions()
  }

  return (
    <main style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      {/* HEADER: Ο ΔΥΝΑΜΙΚΟΣ ΤΙΤΛΟΣ ΑΡΙΣΤΕΡΑ - ΜΕΝΟΥ ΔΕΞΙΑ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
          {displayTitle}
        </h1>
        <SettingsMenu />
      </div>

      {/* ΣΥΝΟΛΑ ΗΜΕΡΑΣ */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '25px' }}>
        <div style={statsCard}>
          <p style={statsLabel}>ΕΣΟΔΑ ΗΜΕΡΑΣ</p>
          <p style={{ ...statsValue, color: '#16a34a' }}>{totals.income.toFixed(2)}€</p>
        </div>
        <div style={statsCard}>
          <p style={statsLabel}>ΕΞΟΔΑ ΗΜΕΡΑΣ</p>
          <p style={{ ...statsValue, color: '#ef4444' }}>{totals.expense.toFixed(2)}€</p>
        </div>
      </div>

      {/* ΚΥΡΙΑ ΚΟΥΜΠΙΑ ΠΡΟΣΘΕΣΗΣ */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '30px' }}>
        <Link href="/add-income" style={mainActionBtn('#6da36d')}>+ ΕΣΟΔΑ</Link>
        <Link href="/add-expense" style={mainActionBtn('#c64d43')}>- ΕΞΟΔΑ</Link>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Πρόσφατες Κινήσεις</p>
      </div>

      {/* ΛΙΣΤΑ ΚΙΝΗΣΕΩΝ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '20px' }}>Φόρτωση...</p>
        ) : transactions.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '20px', fontSize: '14px' }}>Δεν υπάρχουν κινήσεις για σήμερα.</p>
        ) : (
          transactions.map((t) => (
            <div key={t.id} style={transactionCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>
                     {t.category === 'Μισθοδοσία' ? (t.employees?.full_name || 'Μισθοδοσία') : (t.suppliers?.name || t.category)}
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
                    {t.method} • {new Date(t.created_at).toLocaleTimeString('el-GR', {hour:'2-digit', minute:'2-digit'})}
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
    </main>
  )
}

// STYLES
const statsCard = { flex: 1, backgroundColor: '#ffffff', padding: '18px', borderRadius: '24px', border: '1px solid #f1f5f9', textAlign: 'center' as const, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const statsLabel = { fontSize: '9px', fontWeight: '800', color: '#94a3b8', margin: '0 0 4px 0' };
const statsValue = { fontSize: '22px', fontWeight: '900', margin: 0 };
const mainActionBtn = (bg: string) => ({ flex: 1, backgroundColor: bg, color: 'white', padding: '20px', borderRadius: '20px', textDecoration: 'none', textAlign: 'center' as const, fontWeight: '900', fontSize: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' });
const transactionCard = { backgroundColor: '#ffffff', padding: '18px', borderRadius: '22px', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' };
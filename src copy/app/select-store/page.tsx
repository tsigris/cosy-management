'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SelectStorePage() {
  const [userStores, setUserStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function fetchStoresData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      // Φέρνουμε τα καταστήματα από τον ΝΕΟ πίνακα store_access
      const { data: access, error } = await supabase
        .from('store_access')
        .select('store_id, stores(id, name)')
        .eq('user_id', session.user.id)

      if (error || !access || access.length === 0) {
        setLoading(false)
        return
      }

      // Για κάθε κατάστημα, υπολογίζουμε στατιστικά μήνα
      const storesWithStats = await Promise.all(access.map(async (item: any) => {
        const store = item.stores
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        const { data: trans } = await supabase
          .from('transactions')
          .select('amount, type')
          .eq('store_id', store.id)
          .gte('date', firstDay)

        const income = trans?.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0) || 0
        const expenses = trans?.filter(t => t.type === 'expense' || t.type === 'debt_payment').reduce((acc, curr) => acc + curr.amount, 0) || 0
        
        return { 
          id: store.id, 
          name: store.name, 
          income, 
          expenses, 
          profit: income - expenses 
        }
      }))

      setUserStores(storesWithStats)
      setLoading(false)
    }
    fetchStoresData()
  }, [router])

  const handleSelect = (storeId: string) => {
    // Αποθηκεύουμε το "ενεργό" κατάστημα για τη συγκεκριμένη συσκευή
    localStorage.setItem('active_store_id', storeId)
    router.push('/') // Μετάβαση στην αρχική
  }

  if (loading) return <div style={centerStyle}>Φόρτωση δεδομένων...</div>

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100dvh' }}>
      <h1 style={{ textAlign: 'center', fontWeight: '800', fontSize: '24px', marginBottom: '5px' }}>Τα Καταστήματά μου</h1>
      <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', marginBottom: '30px' }}>Σύνοψη Φεβρουαρίου 2026</p>

      {userStores.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Δεν βρέθηκαν καταστήματα συνδεδεμένα με το λογαριασμό σας.</p>
        </div>
      )}

      {userStores.map(store => (
        <div key={store.id} onClick={() => handleSelect(store.id)} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>{store.name.toUpperCase()}</h2>
            <div style={arrowStyle}>→</div>
          </div>
          
          <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '15px 0' }} />
          
          <div style={statRow}>
            <span style={labelStyle}>📈 Έσοδα Μήνα</span>
            <span style={{ fontWeight: '700', color: '#059669' }}>{store.income.toFixed(2)} €</span>
          </div>
          
          <div style={statRow}>
            <span style={labelStyle}>📉 Έξοδα Μήνα</span>
            <span style={{ fontWeight: '700', color: '#dc2626' }}>{store.expenses.toFixed(2)} €</span>
          </div>

          <div style={{ ...statRow, marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
            <span style={{ fontWeight: '800' }}>🔄 Καθαρό Κέρδος</span>
            <span style={{ fontWeight: '900', fontSize: '16px' }}>{store.profit.toFixed(2)} €</span>
          </div>
        </div>
      ))}

      <button onClick={() => router.push('/stores/new')} style={addBtnStyle}>
        + Προσθήκη Νέου Καταστήματος
      </button>
    </div>
  )
}

// STYLES
const centerStyle: any = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontWeight: '600' };
const cardStyle: any = { backgroundColor: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '15px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
const statRow = { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' };
const labelStyle = { color: '#64748b', fontSize: '14px', fontWeight: '600' };
const arrowStyle = { backgroundColor: '#1e293b', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' };
const addBtnStyle: any = { width: '100%', padding: '16px', border: '2px dashed #cbd5e1', backgroundColor: 'transparent', color: '#64748b', borderRadius: '15px', fontWeight: '700', marginTop: '20px', cursor: 'pointer' };
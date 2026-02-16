'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LogOut, Plus, ArrowRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react'

export default function SelectStorePage() {
  const [userStores, setUserStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.clear() 
    window.location.href = '/login'
  }

  useEffect(() => {
    async function fetchStoresData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      // Παίρνουμε τα καταστήματα στα οποία έχει πρόσβαση ο χρήστης
      const { data: access, error } = await supabase
        .from('store_access')
        .select('store_id, stores(id, name)')
        .eq('user_id', session.user.id)

      if (error || !access || access.length === 0) {
        setLoading(false)
        return
      }

      const storesWithStats = await Promise.all(access.map(async (item: any) => {
        const store = item.stores
        if (!store) return null;

        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        const { data: trans } = await supabase
          .from('transactions')
          .select('amount, type')
          .eq('store_id', store.id)
          .gte('date', firstDay)

        const income = trans?.filter(t => t.type === 'income').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0
        const expenses = trans?.filter(t => t.type === 'expense' || t.type === 'debt_payment').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0
        
        return { 
          id: store.id, 
          name: store.name, 
          income, 
          expenses, 
          profit: income - expenses 
        }
      }))

      setUserStores(storesWithStats.filter(s => s !== null))
      setLoading(false)
    }
    fetchStoresData()
  }, [router])

  const handleSelect = (storeId: string) => {
    // 1. Ενημερώνουμε το localStorage ως δευτερεύουσα πηγή
    localStorage.setItem('active_store_id', storeId)
    
    // 2. Στέλνουμε το ID στο URL (Η ΚΥΡΙΑ ΠΗΓΗ ΑΛΗΘΕΙΑΣ)
    // Χρησιμοποιούμε window.location για να κάνουμε ένα γρήγορο "σκληρό" refresh 
    // ώστε να καθαρίσουν όλα τα παλιά states του προηγούμενου μαγαζιού
    window.location.href = `/?store=${storeId}`;
  }

  if (loading) return <div style={centerStyle}>ΑΝΑΚΤΗΣΗ ΚΑΤΑΣΤΗΜΑΤΩΝ...</div>

  return (
    <div style={containerStyle}>
      <header style={{ marginBottom: '30px', textAlign: 'center' }}>
        <h1 style={{ fontWeight: '900', fontSize: '28px', color: '#0f172a', margin: 0 }}>Τα Καταστήματά μου</h1>
        <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '600', marginTop: '5px' }}>Σύνοψη Φεβρουαρίου 2026</p>
      </header>

      {userStores.length === 0 && !loading && (
        <div style={emptyStateStyle}>
          <p style={{ fontWeight: '700', color: '#64748b' }}>Δεν βρέθηκαν καταστήματα στο λογαριασμό σας.</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: '15px' }}>
        {userStores.map(store => (
          <div key={store.id} onClick={() => handleSelect(store.id)} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{store.name.toUpperCase()}</h2>
              <div style={arrowCircle}><ArrowRight size={16} /></div>
            </div>
            
            <div style={statsGrid}>
              <div style={statBox}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#059669', marginBottom: '4px' }}>
                  <TrendingUp size={14} /> <span style={statLabel}>ΕΣΟΔΑ</span>
                </div>
                <span style={statValue}>{store.income.toFixed(2)} €</span>
              </div>
              
              <div style={statBox}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#dc2626', marginBottom: '4px' }}>
                  <TrendingDown size={14} /> <span style={statLabel}>ΕΞΟΔΑ</span>
                </div>
                <span style={statValue}>{store.expenses.toFixed(2)} €</span>
              </div>
            </div>

            <div style={profitRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={18} color="#6366f1" />
                <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '14px' }}>ΚΑΘΑΡΟ ΚΕΡΔΟΣ</span>
              </div>
              <span style={{ fontWeight: '900', fontSize: '18px', color: '#0f172a' }}>{store.profit.toFixed(2)} €</span>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => router.push('/stores/new')} style={addBtnStyle}>
        <Plus size={20} /> ΠΡΟΣΘΗΚΗ ΝΕΟΥ ΚΑΤΑΣΤΗΜΑΤΟΣ
      </button>

      <button onClick={handleLogout} style={logoutBtnStyle}>
        <LogOut size={16} /> ΑΠΟΣΥΝΔΕΣΗ ΧΡΗΣΤΗ
      </button>
    </div>
  )
}

// STYLES
const containerStyle: any = { padding: '30px 20px', backgroundColor: '#f8fafc', minHeight: '100dvh', paddingBottom: '60px' };
const centerStyle: any = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontWeight: '800', color: '#94a3b8', letterSpacing: '1px' };
const cardStyle: any = { backgroundColor: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' };
const statsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
const statBox = { padding: '12px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' };
const statLabel = { fontSize: '10px', fontWeight: '800' };
const statValue = { fontSize: '15px', fontWeight: '900', color: '#1e293b' };
const profitRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed #e2e8f0' };
const arrowCircle = { width: '32px', height: '32px', backgroundColor: '#0f172a', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const addBtnStyle: any = { width: '100%', padding: '18px', border: '2px dashed #cbd5e1', backgroundColor: 'transparent', color: '#64748b', borderRadius: '20px', fontWeight: '800', marginTop: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };
const logoutBtnStyle: any = { backgroundColor: '#fff', color: '#f43f5e', border: '1px solid #fee2e2', padding: '14px', borderRadius: '16px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', width: '100%', marginTop: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const emptyStateStyle: any = { textAlign: 'center', padding: '50px 20px', backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0' };
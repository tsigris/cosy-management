'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [expandedTx, setExpandedTx] = useState<string | null>(null) // State για το ποια κίνηση είναι ανοιχτή
  
  const [storeName, setStoreName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cachedStoreName') || 'Cosy App'
    }
    return 'Cosy App'
  })
  
  const [permissions, setPermissions] = useState({
    role: 'user',
    can_view_history: false,
    can_view_analysis: false,
    enable_payroll: false
  })

  useEffect(() => {
    async function fetchAppData() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const [profileRes, transRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('transactions')
            .select('*, suppliers(name), fixed_assets(name)')
            .gte('date', `${selectedDate}T00:00:00`)
            .lte('date', `${selectedDate}T23:59:59`)
            .order('created_at', { ascending: false })
        ])

        if (profileRes.data) {
          const profile = profileRes.data
          const name = profile.store_name || 'Cosy App'
          setStoreName(name)
          if (typeof window !== 'undefined') localStorage.setItem('cachedStoreName', name)

          setPermissions({
            role: profile.role || 'user',
            can_view_history: profile.can_view_history || false,
            can_view_analysis: profile.can_view_analysis || false,
            enable_payroll: profile.enable_payroll || false
          })

          let data = transRes.data || []
          if (profile.role !== 'admin') {
            data = data.filter(t => t.user_id === user.id)
          }
          setTransactions(data)
        }
      }
      setLoading(false)
    }
    fetchAppData()
  }, [selectedDate])

  const totals = transactions.reduce((acc, t) => {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') acc.inc += amt
    else if (t.type === 'expense' && !t.is_credit && t.category !== 'pocket') acc.exp += amt
    return acc
  }, { inc: 0, exp: 0 })

  const isAdmin = permissions.role === 'admin'

  const handleDelete = async (id: string) => {
    if (confirm('Θέλετε να διαγράψετε αυτή την κίνηση;')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (!error) {
        setTransactions(prev => prev.filter(t => t.id !== id))
        setExpandedTx(null)
      }
    }
  }

  const handleEdit = (t: any) => {
    const targetPage = t.type === 'income' ? 'add-income' : 'add-expense'
    router.push(`/${targetPage}?editId=${t.id}&date=${selectedDate}`)
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', position: 'relative' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '10px' }}>
        <h1 style={{ fontWeight: '900', fontSize: '24px', margin: 0, color: '#0f172a' }}>
          {storeName.toUpperCase()}
        </h1>
        
        <div style={{ position: 'relative', zIndex: 1001 }}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={menuBtnStyle}>⋮</button>
          {isMenuOpen && (
            <div style={dropdownStyle}>
              <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
              {isAdmin && (
                <>
                  <Link href="/suppliers" style={menuItem}>🛒 Προμηθευτές</Link>
                  <Link href="/fixed-assets" style={menuItem}>🔌 Πάγια</Link>
                  <Link href="/employees" style={menuItem}>👥 Υπάλληλοι</Link>
                  <Link href="/suppliers-balance" style={menuItem}>🚩 Καρτέλες (Χρέη)</Link>
                </>
              )}
              <Link href="/analysis" style={menuItem}>📈 Ανάλυση</Link>
              <div style={divider} />
              <button onClick={() => supabase.auth.signOut().then(() => window.location.href='/login')} style={logoutBtnStyle}>ΑΠΟΣΥΝΔΕΣΗ 🚪</button>
            </div>
          )}
        </div>
      </div>

      {/* STAT CARDS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}>
            <p style={labelStyle}>{isAdmin ? 'ΕΣΟΔΑ ΗΜΕΡΑΣ' : 'ΔΙΚΑ ΜΟΥ ΕΣΟΔΑ'}</p>
            <p style={{ color: '#16a34a', fontSize: '24px', fontWeight: '900', margin: 0 }}>{totals.inc.toFixed(2)}€</p>
        </div>
        <div style={cardStyle}>
            <p style={labelStyle}>{isAdmin ? 'ΕΞΟΔΑ ΗΜΕΡΑΣ' : 'ΔΙΚΑ ΜΟΥ ΕΞΟΔΑ'}</p>
            <p style={{ color: '#dc2626', fontSize: '24px', fontWeight: '900', margin: 0 }}>{totals.exp.toFixed(2)}€</p>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', position: 'relative', zIndex: 10 }}>
        <Link href={`/add-income?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#10b981', display: 'block' }}>+ ΕΣΟΔΑ</Link>
        <Link href={`/add-expense?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#ef4444', display: 'block' }}>- ΕΞΟΔΑ</Link>
      </div>

      {isAdmin && (
        <Link href="/daily-z" style={zBtnStyle}>📟 ΚΛΕΙΣΙΜΟ ΤΑΜΕΙΟΥ (Ζ)</Link>
      )}

      <div style={{ marginBottom: '25px' }} />

      {/* TRANSACTIONS LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>
          {isAdmin ? 'Κινήσεις Καταστήματος' : 'Οι Καταχωρήσεις μου'}
        </p>
        
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Φόρτωση...</div>
        ) : (
          transactions.filter(t => t.category !== 'Εσοδα Ζ' && t.category !== 'pocket').map(t => (
            <div key={t.id} style={{ marginBottom: '5px' }}>
              {/* ΤΟ ΚΥΡΙΩΣ ΣΤΟΙΧΕΙΟ ΤΗΣ ΚΙΝΗΣΗΣ */}
              <div 
                onClick={() => isAdmin && setExpandedTx(expandedTx === t.id ? null : t.id)}
                style={{ 
                  ...itemStyle, 
                  cursor: isAdmin ? 'pointer' : 'default',
                  borderRadius: expandedTx === t.id ? '20px 20px 0 0' : '20px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '800', margin: 0, fontSize: '15px', color: '#1e293b' }}>
                    {t.type === 'income' ? '💰 ' + (t.notes || 'ΕΙΣΠΡΑΞΗ') : (
                        t.is_credit ? '🚩 ΠΙΣΤΩΣΗ: ' + t.suppliers?.name : 
                        t.category === 'Πάγια' ? '🔌 ' + t.fixed_assets?.name :
                        '💸 ' + (t.suppliers?.name || t.category)
                    )}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <span style={subLabelStyle}>{t.method}</span>
                    <span style={userBadge}>👤 {t.created_by_name}</span>
                  </div>
                </div>
                <p style={{ fontWeight: '900', fontSize: '16px', color: t.is_credit ? '#94a3b8' : (t.type === 'income' ? '#16a34a' : '#dc2626'), margin: 0 }}>
                  {t.type === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€
                </p>
              </div>

              {/* ΤΟ PANEL ΕΝΕΡΓΕΙΩΝ (ΕΜΦΑΝΙΖΕΤΑΙ ΜΟΝΟ ΑΝ ΠΑΤΗΘΕΙ & ΕΙΝΑΙ ADMIN) */}
              {isAdmin && expandedTx === t.id && (
                <div style={actionPanelStyle}>
                  <button onClick={() => handleEdit(t)} style={actionBtnEdit}>ΕΠΕΞΕΡΓΑΣΙΑ ✎</button>
                  <button onClick={() => handleDelete(t.id)} style={actionBtnDelete}>ΔΙΑΓΡΑΦΗ 🗑️</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// STYLES
const menuBtnStyle = { backgroundColor: 'white', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '12px', fontSize: '20px', color: '#64748b' };
const dropdownStyle = { position: 'absolute' as const, top: '50px', right: '0', backgroundColor: 'white', minWidth: '220px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', padding: '12px', zIndex: 1100, border: '1px solid #f1f5f9' };
const menuItem = { display: 'block', padding: '12px', textDecoration: 'none', color: '#334155', fontWeight: '700' as const, fontSize: '14px', borderRadius: '10px' };
const logoutBtnStyle = { ...menuItem, color: '#ef4444', border: 'none', background: '#fee2e2', width: '100%', cursor: 'pointer', textAlign: 'left' as const, marginTop: '5px' };
const menuSectionLabel = { fontSize: '9px', fontWeight: '800' as const, color: '#94a3b8', marginBottom: '8px', paddingLeft: '12px', marginTop: '8px' };
const divider = { height: '1px', backgroundColor: '#f1f5f9', margin: '8px 0' };
const cardStyle = { flex: 1, backgroundColor: 'white', padding: '18px', borderRadius: '22px', textAlign: 'center' as const, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '4px' };
const btnStyle = { flex: 1, padding: '18px', borderRadius: '18px', color: 'white', textDecoration: 'none', textAlign: 'center' as const, fontWeight: '800', fontSize: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const zBtnStyle = { display: 'block', padding: '16px', borderRadius: '18px', backgroundColor: '#0f172a', color: 'white', textDecoration: 'none', textAlign: 'center' as const, fontWeight: '900', fontSize: '14px', marginTop: '10px' };
const itemStyle = { backgroundColor: 'white', padding: '15px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const subLabelStyle = { fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' as const, fontWeight: 'bold' };
const userBadge = { fontSize: '9px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' };

// ACTION PANEL STYLES (Φωτογραφία 2)
const actionPanelStyle = { 
  backgroundColor: 'white', 
  padding: '10px 15px 15px', 
  borderRadius: '0 0 20px 20px', 
  border: '1px solid #f1f5f9', 
  borderTop: 'none',
  display: 'flex', 
  gap: '10px' 
};
const actionBtnEdit = { 
  flex: 1, 
  background: '#fef3c7', 
  color: '#92400e', 
  border: 'none', 
  padding: '12px', 
  borderRadius: '12px', 
  fontWeight: '800', 
  fontSize: '12px', 
  cursor: 'pointer' 
};
const actionBtnDelete = { 
  flex: 1, 
  background: '#fee2e2', 
  color: '#991b1b', 
  border: 'none', 
  padding: '12px', 
  borderRadius: '12px', 
  fontWeight: '800', 
  fontSize: '12px', 
  cursor: 'pointer' 
};

export default function HomePage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div style={{textAlign:'center', padding:'50px'}}>Cosy App...</div>}>
        <DashboardContent />
      </Suspense>
    </main>
  )
}
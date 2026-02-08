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
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [isZExpanded, setIsZExpanded] = useState(false)
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null)
  
  const [storeName, setStoreName] = useState('Cosy App')
  const [permissions, setPermissions] = useState({ 
    role: 'user', 
    store_id: null as string | null,
    can_view_analysis: false,
    can_view_history: false // Προσθήκη
  })

  useEffect(() => {
    async function fetchAppData() {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
          if (profile) {
            setStoreName(profile.store_name || 'Cosy App')
            setPermissions({ 
              role: profile.role || 'user', 
              store_id: profile.store_id,
              can_view_analysis: profile.can_view_analysis || false,
              can_view_history: profile.can_view_history || false
            })

            const { data: transData } = await supabase.from('transactions')
              .select('*, suppliers(name), fixed_assets(name), employees(full_name)')
              .eq('store_id', profile.store_id)
              .gte('date', `${selectedDate}T00:00:00`)
              .lte('date', `${selectedDate}T23:59:59`)
              .order('created_at', { ascending: false })

            if (transData) {
              // ΔΙΟΡΘΩΣΗ: Αν έχει δικαίωμα can_view_history, βλέπει τα πάντα του καταστήματος
              const canSeeEverything = profile.role === 'admin' || profile.can_view_history;
              setTransactions(canSeeEverything ? transData : transData.filter(t => t.user_id === user.id))
            }
          }
        }
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    fetchAppData()
  }, [selectedDate])

  const handleDateChange = (newDate: string) => {
    router.push(`/?date=${newDate}`)
    setExpandedTx(null)
    setIsZExpanded(false)
    setExpandedEmpId(null)
  }

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    handleDateChange(d.toISOString().split('T')[0])
  }

  // ΟΜΑΔΟΠΟΙΗΣΕΙΣ
  const zEntries = transactions.filter(t => t.category === 'Εσοδα Ζ')
  const zTotal = zEntries.reduce((acc, t) => acc + Number(t.amount), 0)
  const salaryEntries = transactions.filter(t => t.category === 'Προσωπικό')
  const groupedSalaries = salaryEntries.reduce((acc: any, t) => {
    const empId = t.employee_id || 'unknown';
    if (!acc[empId]) { acc[empId] = { name: t.employees?.full_name || 'Προσωπικό', total: 0, items: [] } }
    acc[empId].total += Math.abs(Number(t.amount))
    acc[empId].items.push(t)
    return acc
  }, {})

  const regularEntries = transactions.filter(t => t.category !== 'Εσοδα Ζ' && t.category !== 'Προσωπικό' && t.category !== 'pocket')
  const totalInc = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0)
  const totalExp = transactions.filter(t => t.type === 'expense' && !t.is_credit && t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0)
  const isAdmin = permissions.role === 'admin'

  const handleDelete = async (id: string) => {
    if (confirm('Διαγραφή κίνησης;')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (!error) { setTransactions(prev => prev.filter(t => t.id !== id)); setExpandedTx(null); }
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', position: 'relative' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}><span style={{ fontSize: '20px' }}>📈</span></div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a' }}>{storeName}</h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#475569', fontWeight: '900', textTransform: 'uppercase' }}>Business Dashboard</p>
          </div>
        </div>
        
        <div style={{ position: 'relative', zIndex: 1001 }}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={menuBtnStyle}>⋮</button>
          {isMenuOpen && (
            <div style={dropdownStyle}>
              <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
              {/* ΔΙΟΡΘΩΣΗ: Πρόσβαση σε όλους τους χρήστες του καταστήματος */}
              <Link href="/suppliers" style={menuItem} onClick={() => setIsMenuOpen(false)}>🛒 Προμηθευτές</Link>
              <Link href="/fixed-assets" style={menuItem} onClick={() => setIsMenuOpen(false)}>🔌 Πάγια</Link>
              {isAdmin && <Link href="/employees" style={menuItem} onClick={() => setIsMenuOpen(false)}>👥 Υπάλληλοι</Link>}
              {isAdmin && <Link href="/suppliers-balance" style={menuItem} onClick={() => setIsMenuOpen(false)}>🚩 Καρτέλες (Χρέη)</Link>}
              
              {(isAdmin || permissions.can_view_analysis) && (
                <Link href="/analysis" style={menuItem} onClick={() => setIsMenuOpen(false)}>📈 Ανάλυση</Link>
              )}
              <div style={divider} />
              <p style={menuSectionLabel}>ΕΦΑΡΜΟΓΗ</p>
              {isAdmin && <Link href="/admin/permissions" style={menuItem} onClick={() => setIsMenuOpen(false)}>🔐 Δικαιώματα</Link>}
              <Link href="/subscription" style={menuItem} onClick={() => setIsMenuOpen(false)}>💳 Συνδρομή</Link>
              <Link href="/settings" style={menuItem} onClick={() => setIsMenuOpen(false)}>⚙️ Ρυθμίσεις</Link>
              <div style={divider} />
              <button onClick={() => supabase.auth.signOut().then(() => window.location.href='/login')} style={logoutBtnStyle}>ΑΠΟΣΥΝΔΕΣΗ 🚪</button>
            </div>
          )}
        </div>
      </div>

      {/* DATE SELECTOR */}
      <div style={dateBarStyle}>
        <button onClick={() => shiftDate(-1)} style={dateArrowStyle}>←</button>
        <div style={{ position: 'relative', flex: 1, textAlign: 'center' }}>
          <input type="date" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} style={dateInputStyle} />
          <span style={dateDisplayStyle}>
            {selectedDate === new Date().toISOString().split('T')[0] ? 'ΣΗΜΕΡΑ' : new Date(selectedDate).toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}
          </span>
        </div>
        <button onClick={() => shiftDate(1)} style={dateArrowStyle}>→</button>
      </div>

      {/* STATS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}><p style={labelStyle}>ΕΣΟΔΑ ΗΜΕΡΑΣ</p><p style={{ color: '#16a34a', fontSize: '24px', fontWeight: '900', margin: 0 }}>{totalInc.toFixed(2)}€</p></div>
        <div style={cardStyle}>
          <p style={labelStyle}>ΕΞΟΔΑ ΗΜΕΡΑΣ</p>
          <p style={{ color: '#dc2626', fontSize: '24px', fontWeight: '900', margin: 0 }}>{totalExp.toFixed(2)}€</p>
        </div>
      </div>

      {/* ACTIONS */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <Link href={`/add-income?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#10b981' }}>+ ΕΣΟΔΑ</Link>
        <Link href={`/add-expense?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#ef4444' }}>- ΕΞΟΔΑ</Link>
      </div>

      {/* LIST SECTION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
        {loading ? <div style={{ textAlign: 'center', padding: '20px', color: '#475569', fontWeight: '800' }}>ΦΟΡΤΩΣΗ...</div> : (
          <>
            {/* Ζ ΟΜΑΔΟΠΟΙΗΣΗ */}
            {zTotal > 0 && (
              <div style={{ marginBottom: '5px' }}>
                <div onClick={() => isAdmin && setIsZExpanded(!isZExpanded)} style={zItemHeader}>
                  <div style={{ flex: 1 }}><p style={{ fontWeight: '900', margin: 0, fontSize: '15px' }}>📟 ΣΥΝΟΛΟ Ζ</p><span style={{ fontSize: '10px', opacity: 0.8 }}>{zEntries.length} Εγγραφές</span></div>
                  <p style={{ fontWeight: '900', fontSize: '18px', margin: 0 }}>+{zTotal.toFixed(2)}€</p>
                </div>
                {isZExpanded && (
                  <div style={zBreakdownPanel}>
                    {zEntries.map(z => (
                      <div key={z.id} style={zSubItem}>
                        <div style={{ flex: 1 }}><p style={{ fontWeight: '800', margin: 0, fontSize: '13px' }}>{z.method}</p></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><p style={{ fontWeight: '900', fontSize: '14px', margin: 0 }}>{Number(z.amount).toFixed(2)}€</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ΛΙΣΤΑ ΚΙΝΗΣΕΩΝ */}
            {regularEntries.map(t => (
              <div key={t.id} style={itemStyle}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '900', margin: 0, fontSize: '15px', color: '#1e293b' }}>
                    {t.type === 'income' ? '💰 ' + (t.notes || 'ΕΣΟΔΟ') : (t.suppliers?.name || t.category.toUpperCase())}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <span style={subLabelStyle}>{t.method}</span>
                    <span style={userBadge}>👤 {t.created_by_name?.toUpperCase()}</span>
                  </div>
                </div>
                <p style={{ fontWeight: '950', fontSize: '17px', color: t.type === 'income' ? '#16a34a' : '#dc2626', margin: 0 }}>
                  {t.type === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€
                </p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// STYLES - ΔΙΟΡΘΩΜΕΝΑ ΓΙΑ ΜΕΓΑΛΗ ΑΝΤΙΘΕΣΗ
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#0f172a', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const dateBarStyle: any = { display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '12px', borderRadius: '20px', marginBottom: '20px', border: '1px solid #e2e8f0' };
const dateArrowStyle: any = { background: 'none', border: 'none', fontSize: '18px', color: '#0f172a', fontWeight: '900', cursor: 'pointer' };
const dateInputStyle: any = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' };
const dateDisplayStyle: any = { fontSize: '14px', fontWeight: '950', color: '#0f172a' };
const menuBtnStyle: any = { backgroundColor: 'white', border: '1px solid #cbd5e1', width: '40px', height: '40px', borderRadius: '12px', fontSize: '20px', color: '#1e293b', cursor: 'pointer' };
const dropdownStyle: any = { position: 'absolute', top: '55px', right: '0', backgroundColor: 'white', minWidth: '220px', borderRadius: '22px', boxShadow: '0 15px 35px rgba(0,0,0,0.2)', padding: '12px', zIndex: 1100, border: '1px solid #e2e8f0' };
const menuItem: any = { display: 'block', padding: '14px', textDecoration: 'none', color: '#0f172a', fontWeight: '900', fontSize: '14px' };
const logoutBtnStyle: any = { ...menuItem, color: '#ef4444', border: 'none', background: '#fee2e2', width: '100%', cursor: 'pointer', textAlign: 'left', marginTop: '10px', borderRadius: '12px' };
const menuSectionLabel: any = { fontSize: '10px', fontWeight: '950', color: '#475569', marginBottom: '8px', paddingLeft: '12px', marginTop: '10px' };
const divider: any = { height: '1px', backgroundColor: '#f1f5f9', margin: '8px 0' };
const cardStyle: any = { flex: 1, backgroundColor: 'white', padding: '18px', borderRadius: '24px', textAlign: 'center', border: '1px solid #f1f5f9' };
const labelStyle: any = { fontSize: '10px', fontWeight: '950', color: '#475569', marginBottom: '5px' };
const btnStyle: any = { flex: 1, padding: '18px', borderRadius: '20px', color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '950', fontSize: '14px' };
const itemStyle: any = { backgroundColor: 'white', padding: '18px', borderRadius: '22px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const zItemHeader: any = { ...itemStyle, backgroundColor: '#0f172a', color: 'white' };
const subLabelStyle: any = { fontSize: '11px', color: '#334155', textTransform: 'uppercase', fontWeight: '950' };
const userBadge: any = { fontSize: '10px', backgroundColor: '#e2e8f0', color: '#0f172a', padding: '3px 8px', borderRadius: '8px', fontWeight: '950' };
const zBreakdownPanel: any = { backgroundColor: 'white', padding: '10px 18px', borderRadius: '0 0 22px 22px', border: '2px solid #0f172a', borderTop: 'none' };
const zSubItem: any = { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9' };

export default function HomePage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><DashboardContent /></Suspense>
    </main>
  )
}
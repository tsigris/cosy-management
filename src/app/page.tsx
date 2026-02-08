'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Ημερομηνία από το URL ή σημερινή
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [isZExpanded, setIsZExpanded] = useState(false)
  
  const [storeName, setStoreName] = useState('Cosy App')
  const [permissions, setPermissions] = useState({ role: 'user', store_id: null as string | null })

  useEffect(() => {
    async function fetchAppData() {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
          if (profile) {
            setStoreName(profile.store_name || 'Cosy App')
            setPermissions({ role: profile.role || 'user', store_id: profile.store_id })

            const { data: transData } = await supabase.from('transactions')
              .select('*, suppliers(name), fixed_assets(name)')
              .eq('store_id', profile.store_id)
              .gte('date', `${selectedDate}T00:00:00`)
              .lte('date', `${selectedDate}T23:59:59`)
              .order('created_at', { ascending: false })

            if (transData) {
              setTransactions(profile.role === 'admin' ? transData : transData.filter(t => t.user_id === user.id))
            }
          }
        }
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    fetchAppData()
  }, [selectedDate])

  // Συναρτήσεις για αλλαγή ημερομηνίας
  const handleDateChange = (newDate: string) => {
    router.push(`/?date=${newDate}`)
    setExpandedTx(null)
    setIsZExpanded(false)
  }

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    handleDateChange(d.toISOString().split('T')[0])
  }

  // Υπολογισμοί Ζ και Συνόλων
  const zEntries = transactions.filter(t => t.category === 'Εσοδα Ζ')
  const regularEntries = transactions.filter(t => t.category !== 'Εσοδα Ζ' && t.category !== 'pocket')
  const zTotal = zEntries.reduce((acc, t) => acc + Number(t.amount), 0)

  const totals = transactions.reduce((acc, t) => {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') acc.inc += amt
    else if (t.type === 'expense' && !t.is_credit && t.category !== 'pocket') acc.exp += amt
    return acc
  }, { inc: 0, exp: 0 })

  const isAdmin = permissions.role === 'admin'

  const handleDelete = async (id: string) => {
    if (confirm('Διαγραφή κίνησης;')) {
      await supabase.from('transactions').delete().eq('id', id)
      setTransactions(prev => prev.filter(t => t.id !== id))
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', position: 'relative' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingTop: '10px' }}>
        <h1 style={{ fontWeight: '900', fontSize: '24px', margin: 0, color: '#0f172a' }}>{storeName.toUpperCase()}</h1>
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
                </>
              )}
              <Link href="/analysis" style={menuItem}>📈 Ανάλυση</Link>
              <div style={divider} />
              <button onClick={() => supabase.auth.signOut().then(() => window.location.href='/login')} style={logoutBtnStyle}>ΑΠΟΣΥΝΔΕΣΗ 🚪</button>
            </div>
          )}
        </div>
      </div>

      {/* DATE SELECTOR - ΤΟ ΝΕΟ ΗΜΕΡΟΛΟΓΙΟ */}
      <div style={dateBarStyle}>
        <button onClick={() => shiftDate(-1)} style={dateArrowStyle}>←</button>
        <div style={{ position: 'relative', flex: 1, textAlign: 'center' }}>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => handleDateChange(e.target.value)}
            style={dateInputStyle}
          />
          <span style={dateDisplayStyle}>
            {selectedDate === new Date().toISOString().split('T')[0] ? 'ΣΗΜΕΡΑ' : new Date(selectedDate).toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}
          </span>
        </div>
        <button onClick={() => shiftDate(1)} style={dateArrowStyle}>→</button>
      </div>

      {/* STATS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}>
          <p style={labelStyle}>ΕΣΟΔΑ ΗΜΕΡΑΣ</p>
          <p style={{ color: '#16a34a', fontSize: '22px', fontWeight: '900', margin: 0 }}>{totals.inc.toFixed(2)}€</p>
        </div>
        <div style={cardStyle}>
          <p style={labelStyle}>ΕΞΟΔΑ ΗΜΕΡΑΣ</p>
          <p style={{ color: '#dc2626', fontSize: '22px', fontWeight: '900', margin: 0 }}>{totals.exp.toFixed(2)}€</p>
        </div>
      </div>

      {/* ACTIONS */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <Link href={`/add-income?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#10b981', display: 'block' }}>+ ΕΣΟΔΑ</Link>
        <Link href={`/add-expense?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#ef4444', display: 'block' }}>- ΕΞΟΔΑ</Link>
      </div>

      {isAdmin && <Link href="/daily-z" style={zBtnStyle}>📟 ΚΛΕΙΣΙΜΟ ΤΑΜΕΙΟΥ (Ζ)</Link>}

      <div style={{ marginBottom: '25px' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Κινήσεις {selectedDate === new Date().toISOString().split('T')[0] ? 'Ημέρας' : 'Ημερομηνίας'}</p>

        {loading ? <div style={{ textAlign: 'center', padding: '20px' }}>Φόρτωση...</div> : (
          <>
            {/* ΟΜΑΔΟΠΟΙΗΜΕΝΟ Ζ */}
            {zTotal > 0 && (
              <div style={{ marginBottom: '5px' }}>
                <div 
                  onClick={() => isAdmin && setIsZExpanded(!isZExpanded)}
                  style={{ ...itemStyle, backgroundColor: '#0f172a', color: 'white', borderRadius: isZExpanded ? '20px 20px 0 0' : '20px', cursor: isAdmin ? 'pointer' : 'default' }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '800', margin: 0, fontSize: '15px' }}>📟 ΚΛΕΙΣΙΜΟ ΤΑΜΕΙΟΥ (ΣΥΝΟΛΟ Ζ)</p>
                    <span style={{ fontSize: '10px', opacity: 0.7 }}>{zEntries.length} Καταχωρήσεις</span>
                  </div>
                  <p style={{ fontWeight: '900', fontSize: '18px', margin: 0 }}>+{zTotal.toFixed(2)}€</p>
                </div>

                {isZExpanded && (
                  <div style={zBreakdownPanel}>
                    {zEntries.map(z => (
                      <div key={z.id} style={zSubItem}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: '700', margin: 0, fontSize: '13px' }}>{z.method} (Ζ)</p>
                          <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>
                            Ποσοστό: {((Number(z.amount) / zTotal) * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <p style={{ fontWeight: '800', fontSize: '14px', margin: 0 }}>{Number(z.amount).toFixed(2)}€</p>
                          <button onClick={() => handleDelete(z.id)} style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer' }}>🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ΛΟΙΠΕΣ ΚΙΝΗΣΕΙΣ */}
            {regularEntries.length === 0 && zTotal === 0 ? (
               <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', background: 'white', borderRadius: '20px', border: '1px dashed #e2e8f0' }}>Δεν υπάρχουν κινήσεις.</div>
            ) : (
              regularEntries.map(t => (
                <div key={t.id} style={{ marginBottom: '5px' }}>
                  <div 
                    onClick={() => isAdmin && setExpandedTx(expandedTx === t.id ? null : t.id)}
                    style={{ ...itemStyle, borderRadius: expandedTx === t.id ? '20px 20px 0 0' : '20px', borderBottom: expandedTx === t.id ? 'none' : '1px solid #f1f5f9' }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '800', margin: 0, fontSize: '15px' }}>
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
                    <p style={{ fontWeight: '900', fontSize: '16px', color: t.type === 'income' ? '#16a34a' : '#dc2626', margin: 0 }}>
                      {t.type === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€
                    </p>
                  </div>
                  {isAdmin && expandedTx === t.id && (
                    <div style={actionPanelStyle}>
                      <button onClick={() => router.push(`/${t.type === 'income' ? 'add-income' : 'add-expense'}?editId=${t.id}`)} style={actionBtnEdit}>ΕΠΕΞΕΡΓΑΣΙΑ ✎</button>
                      <button onClick={() => handleDelete(t.id)} style={actionBtnDelete}>ΔΙΑΓΡΑΦΗ 🗑️</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}

// STYLES
const dateBarStyle = { display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '10px 15px', borderRadius: '20px', marginBottom: '20px', border: '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const dateArrowStyle = { background: 'none', border: 'none', fontSize: '18px', color: '#0f172a', fontWeight: '900', cursor: 'pointer', padding: '0 10px' };
const dateInputStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' };
const dateDisplayStyle = { fontSize: '13px', fontWeight: '900', color: '#0f172a', letterSpacing: '0.5px' };

const menuBtnStyle = { backgroundColor: 'white', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '12px', fontSize: '20px' };
const dropdownStyle = { position: 'absolute' as const, top: '50px', right: '0', backgroundColor: 'white', minWidth: '220px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', padding: '12px', zIndex: 1100, border: '1px solid #f1f5f9' };
const menuItem = { display: 'block', padding: '12px', textDecoration: 'none', color: '#334155', fontWeight: '700' as const, fontSize: '14px' };
const logoutBtnStyle = { ...menuItem, color: '#ef4444', border: 'none', background: '#fee2e2', width: '100%', cursor: 'pointer', textAlign: 'left' as const, borderRadius: '10px' };
const menuSectionLabel = { fontSize: '9px', fontWeight: '800' as const, color: '#94a3b8', marginBottom: '8px', paddingLeft: '12px' };
const divider = { height: '1px', backgroundColor: '#f1f5f9', margin: '8px 0' };
const cardStyle = { flex: 1, backgroundColor: 'white', padding: '15px', borderRadius: '22px', textAlign: 'center' as const, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' };
const labelStyle = { fontSize: '9px', fontWeight: '800', color: '#94a3b8', marginBottom: '4px' };
const btnStyle = { flex: 1, padding: '16px', borderRadius: '18px', color: 'white', textDecoration: 'none', textAlign: 'center' as const, fontWeight: '800', fontSize: '14px' };
const zBtnStyle = { display: 'block', padding: '16px', borderRadius: '18px', backgroundColor: '#0f172a', color: 'white', textDecoration: 'none', textAlign: 'center' as const, fontWeight: '900', fontSize: '13px', marginTop: '10px' };
const itemStyle = { backgroundColor: 'white', padding: '15px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const subLabelStyle = { fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' as const, fontWeight: 'bold' };
const userBadge = { fontSize: '9px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' };
const actionPanelStyle = { backgroundColor: 'white', padding: '10px 15px 15px', borderRadius: '0 0 20px 20px', border: '1px solid #f1f5f9', borderTop: 'none', display: 'flex', gap: '10px' };
const zBreakdownPanel = { backgroundColor: 'white', padding: '5px 15px 15px', borderRadius: '0 0 20px 20px', border: '2px solid #0f172a', borderTop: 'none' };
const zSubItem = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' };
const actionBtnEdit = { flex: 1, background: '#fef3c7', color: '#92400e', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' };
const actionBtnDelete = { flex: 1, background: '#fee2e2', color: '#991b1b', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' };

export default function HomePage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><DashboardContent /></Suspense>
    </main>
  )
}
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
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null) // State για την ομαδοποίηση υπαλλήλων
  
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

            // Φέρνουμε και το όνομα του υπαλλήλου από τη σχέση employees
            const { data: transData } = await supabase.from('transactions')
              .select('*, suppliers(name), fixed_assets(name), employees(full_name)')
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

  const handleDateChange = (newDate: string) => {
    router.push(`/?date=${newDate}`)
    setExpandedTx(null)
    setIsZExpanded(false)
    setExpandedEmpId(null)
  }

  // --- ΛΟΓΙΚΗ ΟΜΑΔΟΠΟΙΗΣΗΣ ---
  
  // 1. Ομαδοποίηση Ζ
  const zEntries = transactions.filter(t => t.category === 'Εσοδα Ζ')
  const zTotal = zEntries.reduce((acc, t) => acc + Number(t.amount), 0)

  // 2. Ομαδοποίηση Πληρωμών Προσωπικού
  const salaryEntries = transactions.filter(t => t.category === 'Προσωπικό')
  const groupedSalaries = salaryEntries.reduce((acc: any, t) => {
    const empId = t.employee_id || 'unknown';
    if (!acc[empId]) {
      acc[empId] = {
        name: t.employees?.full_name || 'Προσωπικό',
        total: 0,
        items: []
      }
    }
    acc[empId].total += Math.abs(Number(t.amount))
    acc[empId].items.push(t)
    return acc
  }, {})

  // 3. Λοιπές Κινήσεις (όχι Ζ, όχι Προσωπικό, όχι Pocket)
  const regularEntries = transactions.filter(t => 
    t.category !== 'Εσοδα Ζ' && 
    t.category !== 'Προσωπικό' && 
    t.category !== 'pocket'
  )

  const totalInc = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0)
  const totalExp = transactions.filter(t => t.type === 'expense' && !t.is_credit && t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0)
  const expenseRatio = totalInc > 0 ? (totalExp / totalInc) * 100 : 0
  const isAdmin = permissions.role === 'admin'

  const handleDelete = async (id: string) => {
    if (confirm('Διαγραφή κίνησης;')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (!error) {
        setTransactions(prev => prev.filter(t => t.id !== id))
        setExpandedTx(null)
      }
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
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Business Dashboard</p>
          </div>
        </div>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={menuBtnStyle}>⋮</button>
      </div>

      {/* DATE SELECTOR */}
      <div style={dateBarStyle}>
        <div style={{ position: 'relative', flex: 1, textAlign: 'center' }}>
          <input type="date" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} style={dateInputStyle} />
          <span style={dateDisplayStyle}>
            {selectedDate === new Date().toISOString().split('T')[0] ? 'ΣΗΜΕΡΑ' : new Date(selectedDate).toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}
          </span>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}>
          <p style={labelStyle}>ΕΣΟΔΑ ΗΜΕΡΑΣ</p>
          <p style={{ color: '#16a34a', fontSize: '22px', fontWeight: '900', margin: 0 }}>{totalInc.toFixed(2)}€</p>
        </div>
        <div style={cardStyle}>
          <p style={labelStyle}>ΕΞΟΔΑ ΗΜΕΡΑΣ</p>
          <p style={{ color: '#dc2626', fontSize: '22px', fontWeight: '900', margin: 0 }}>{totalExp.toFixed(2)}€</p>
          <p style={{ fontSize: '9px', fontWeight: '900', color: expenseRatio > 70 ? '#ef4444' : '#64748b', marginTop: '4px' }}>{expenseRatio.toFixed(1)}% ΤΟΥ ΤΖΙΡΟΥ</p>
        </div>
      </div>

      {/* ACTIONS */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <Link href={`/add-income?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#10b981', display: 'block' }}>+ ΕΣΟΔΑ</Link>
        <Link href={`/add-expense?date=${selectedDate}`} style={{ ...btnStyle, backgroundColor: '#ef4444', display: 'block' }}>- ΕΞΟΔΑ</Link>
      </div>
      {isAdmin && <Link href="/daily-z" style={zBtnStyle}>📟 ΚΛΕΙΣΙΜΟ ΤΑΜΕΙΟΥ (Ζ)</Link>}

      <div style={{ marginBottom: '25px' }} />

      {/* LIST SECTION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Κινήσεις Ημερομηνίας</p>
        
        {loading ? <div style={{ textAlign: 'center', padding: '20px' }}>Φόρτωση...</div> : (
          <>
            {/* 1. GROUPED DAILY Z */}
            {zTotal > 0 && (
              <div style={{ marginBottom: '5px' }}>
                <div onClick={() => isAdmin && setIsZExpanded(!isZExpanded)} style={{ ...itemStyle, backgroundColor: '#0f172a', color: 'white', borderRadius: isZExpanded ? '20px 20px 0 0' : '20px', cursor: isAdmin ? 'pointer' : 'default' }}>
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
                          <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>Ποσοστό: {((Number(z.amount) / zTotal) * 100).toFixed(1)}%</p>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <p style={{ fontWeight: '800', fontSize: '14px', margin: 0 }}>{Number(z.amount).toFixed(2)}€</p>
                          <button onClick={() => handleDelete(z.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. GROUPED EMPLOYEE PAYMENTS - Η ΝΕΑ ΛΟΓΙΚΗ ΣΟΥ */}
            {Object.keys(groupedSalaries).map(empId => {
              const group = groupedSalaries[empId];
              const isExpanded = expandedEmpId === empId;
              return (
                <div key={empId} style={{ marginBottom: '5px' }}>
                  <div 
                    onClick={() => isAdmin && setExpandedEmpId(isExpanded ? null : empId)}
                    style={{ ...itemStyle, backgroundColor: '#eff6ff', borderRadius: isExpanded ? '20px 20px 0 0' : '20px', border: '1px solid #dbeafe', cursor: isAdmin ? 'pointer' : 'default' }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '800', margin: 0, fontSize: '15px', color: '#1e40af' }}>👤 ΠΛΗΡΩΜΗ: {group.name.toUpperCase()}</p>
                      <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 'bold' }}>{group.items.length} Πληρωμές</span>
                    </div>
                    <p style={{ fontWeight: '900', fontSize: '18px', color: '#dc2626', margin: 0 }}>-{group.total.toFixed(2)}€</p>
                  </div>
                  {isExpanded && (
                    <div style={{ ...zBreakdownPanel, border: '1px solid #dbeafe', borderTop: 'none' }}>
                      {group.items.map((t: any) => (
                        <div key={t.id} style={zSubItem}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: '700', margin: 0, fontSize: '13px' }}>{t.method}</p>
                            <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>Ποσοστό: {((Math.abs(Number(t.amount)) / group.total) * 100).toFixed(1)}%</p>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <p style={{ fontWeight: '800', fontSize: '14px', margin: 0 }}>{Math.abs(Number(t.amount)).toFixed(2)}€</p>
                            <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 3. REGULAR ENTRIES */}
            {regularEntries.map(t => (
              <div key={t.id} style={{ marginBottom: '5px' }}>
                <div onClick={() => isAdmin && setExpandedTx(expandedTx === t.id ? null : t.id)} style={{ ...itemStyle, borderRadius: expandedTx === t.id ? '20px 20px 0 0' : '20px', borderBottom: expandedTx === t.id ? 'none' : '1px solid #f1f5f9' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '800', margin: 0, fontSize: '15px' }}>
                      {t.type === 'income' ? '💰 ' + (t.notes || 'ΕΙΣΠΡΑΞΗ') : (
                        t.is_credit ? '🚩 ΠΙΣΤΩΣΗ: ' + (t.suppliers?.name || 'Προμηθευτής') : 
                        t.category === 'Πάγια' ? '🔌 ' + (t.fixed_assets?.name || 'Πάγιο') : '💸 ' + (t.suppliers?.name || t.category)
                      )}
                    </p>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}><span style={subLabelStyle}>{t.method}</span><span style={userBadge}>👤 {t.created_by_name}</span></div>
                  </div>
                  <p style={{ fontWeight: '900', fontSize: '16px', color: t.type === 'income' ? '#16a34a' : '#dc2626', margin: 0 }}>{t.type === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€</p>
                </div>
                {isAdmin && expandedTx === t.id && (
                  <div style={actionPanelStyle}>
                    <button onClick={() => router.push(`/${t.type === 'income' ? 'add-income' : 'add-expense'}?editId=${t.id}`)} style={actionBtnEdit}>ΕΠΕΞΕΡΓΑΣΙΑ ✎</button>
                    <button onClick={() => handleDelete(t.id)} style={actionBtnDelete}>ΔΙΑΓΡΑΦΗ 🗑️</button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ΣΤΥΛ (Διατηρούνται ίδια με προηγουμένως για ομοιομορφία)
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#0f172a', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(15, 23, 42, 0.15)' };
const dateBarStyle: any = { display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '10px 15px', borderRadius: '20px', marginBottom: '20px', border: '1px solid #f1f5f9' };
const dateInputStyle: any = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' };
const dateDisplayStyle: any = { fontSize: '13px', fontWeight: '900', color: '#0f172a' };
const menuBtnStyle: any = { backgroundColor: 'white', border: '1px solid #e2e8f0', width: '40px', height: '40px', borderRadius: '12px', fontSize: '20px', color: '#64748b', cursor: 'pointer' };
const cardStyle: any = { flex: 1, backgroundColor: 'white', padding: '15px', borderRadius: '22px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' };
const labelStyle: any = { fontSize: '9px', fontWeight: '800', color: '#94a3b8', marginBottom: '4px' };
const btnStyle: any = { flex: 1, padding: '16px', borderRadius: '18px', color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '800', fontSize: '14px' };
const zBtnStyle: any = { display: 'block', padding: '16px', borderRadius: '18px', backgroundColor: '#0f172a', color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '900', fontSize: '13px', marginTop: '10px' };
const itemStyle: any = { backgroundColor: 'white', padding: '15px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const subLabelStyle: any = { fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' };
const userBadge: any = { fontSize: '9px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' };
const actionPanelStyle: any = { backgroundColor: 'white', padding: '10px 15px 15px', borderRadius: '0 0 20px 20px', border: '1px solid #f1f5f9', borderTop: 'none', display: 'flex', gap: '10px' };
const zBreakdownPanel: any = { backgroundColor: 'white', padding: '5px 15px 15px', borderRadius: '0 0 20px 20px', border: '2px solid #0f172a', borderTop: 'none' };
const zSubItem: any = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' };
const actionBtnEdit: any = { flex: 1, background: '#fef3c7', color: '#92400e', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' };
const actionBtnDelete: any = { flex: 1, background: '#fee2e2', color: '#991b1b', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' };

export default function HomePage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><DashboardContent /></Suspense>
    </main>
  )
}
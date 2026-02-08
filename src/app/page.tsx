'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 1. ΣΩΣΤΟΣ ΥΠΟΛΟΓΙΣΜΟΣ ΤΟΠΙΚΗΣ ΗΜΕΡΟΜΗΝΙΑΣ (Business Day Logic - Αλλαγή στις 07:00)
  // Αποφεύγουμε το toISOString() που μπερδεύει τις ζώνες ώρας
  const getBusinessDate = () => {
    const now = new Date()
    // Αν είναι πριν τις 07:00 το πρωί, θεωρούμε ότι είναι η προηγούμενη μέρα
    if (now.getHours() < 7) {
      now.setDate(now.getDate() - 1)
    }
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [businessToday, setBusinessToday] = useState(getBusinessDate())
  const selectedDate = searchParams.get('date') || businessToday
  
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
    can_view_history: false
  })

  // Βοηθητική συνάρτηση για τη μορφοποίηση της τοπικής ώρας (π.μ. / μ.μ.)
  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString('el-GR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch (e) { return '--:--' }
  }

  // ΑΥΤΟΜΑΤΟΣ ΕΛΕΓΧΟΣ ΓΙΑ ΑΛΛΑΓΗ ΗΜΕΡΑΣ (Κάθε 30 δευτερόλεπτα)
  useEffect(() => {
    const timer = setInterval(() => {
      const currentBD = getBusinessDate()
      if (currentBD !== businessToday) {
        setBusinessToday(currentBD)
        // Αν ο χρήστης δεν έχει επιλέξει manual ημερομηνία, ανανεώνουμε τη σελίδα
        if (!searchParams.get('date')) {
          router.refresh()
        }
      }
    }, 30000)
    return () => clearInterval(timer)
  }, [businessToday, searchParams, router])

  const fetchAppData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user

      if (!user) {
        setLoading(false)
        return
      }
      
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
          .eq('date', selectedDate) 
          .order('created_at', { ascending: false })

        setTransactions(transData || [])
      }
    } catch (err) { 
      console.error(err) 
    } finally { 
      setLoading(false) 
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAppData()
    const channel = supabase
      .channel('realtime-transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchAppData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedDate, fetchAppData])

  const getPaymentIcon = (method: string) => {
    const m = method?.toLowerCase() || '';
    if (m.includes('μετρητά')) return '💵';
    if (m.includes('κάρτα') || m.includes('pos') || m.includes('τράπεζα')) return '💳';
    if (m.includes('πίστωση')) return '🚩';
    return '📝';
  }

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    router.push(`/?date=${year}-${month}-${day}`)
    setIsMenuOpen(false); setExpandedTx(null); setIsZExpanded(false); setExpandedEmpId(null);
  }

  const zEntries = transactions.filter(t => t.category === 'Εσοδα Ζ')
  const zTotal = zEntries.reduce((acc, t) => acc + Number(t.amount), 0)

  const salaryEntries = transactions.filter(t => t.category === 'Προσωπικό')
  const groupedSalaries = salaryEntries.reduce((acc: any, t) => {
    const empId = t.employee_id || 'unknown';
    if (!acc[empId]) { acc[empId] = { name: t.employees?.full_name || 'Προσωπικό', total: 0, items: [] } }
    acc[empId].total += Math.abs(Number(t.amount))
    acc[empId].items.push(t)
    return acc;
  }, {})

  const regularEntries = transactions.filter(t => t.category !== 'Εσοδα Ζ' && t.category !== 'Προσωπικό' && t.category !== 'pocket')
  const totalInc = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0)
  const totalExp = transactions.filter(t => t.type === 'expense' && !t.is_credit && t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0)
  const isAdmin = permissions.role === 'admin'

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (confirm('Οριστική διαγραφή αυτής της κίνησης;')) {
      await supabase.from('transactions').delete().eq('id', id)
    }
  }

  return (
    <div style={iphoneWrapper}>
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>📈</div>
            <div>
              <h1 style={{ fontWeight: '900', fontSize: '24px', margin: 0, color: '#0f172a' }}>{storeName}</h1>
              <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: '800', letterSpacing: '1px' }}>BUSINESS DASHBOARD</p>
            </div>
          </div>
          
          <div style={{ position: 'relative' }}>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={menuBtnStyle}>⋮</button>
            {isMenuOpen && (
              <div style={dropdownStyle}>
                <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
                <Link href="/suppliers" style={menuItem} onClick={() => setIsMenuOpen(false)}>🛒 Προμηθευτές</Link>
                <Link href="/fixed-assets" style={menuItem} onClick={() => setIsMenuOpen(false)}>🔌 Πάγια</Link>
                {isAdmin && (
                  <>
                    <Link href="/employees" style={menuItem} onClick={() => setIsMenuOpen(false)}>👥 Υπάλληλοι</Link>
                    <Link href="/suppliers-balance" style={menuItem} onClick={() => setIsMenuOpen(false)}>🚩 Καρτέλες (Χρέη)</Link>
                  </>
                )}
                {(isAdmin || permissions.can_view_analysis) && <Link href="/analysis" style={menuItem} onClick={() => setIsMenuOpen(false)}>📊 Ανάλυση</Link>}
                <div style={divider} />
                <p style={menuSectionLabel}>ΕΦΑΡΜΟΓΗ</p>
                <Link href="/help" style={menuItem} onClick={() => setIsMenuOpen(false)}>❓ Οδηγίες Χρήσης</Link>
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
          <button onClick={() => shiftDate(-1)} style={arrowStyle}>←</button>
          <div style={{ flex: 1, textAlign: 'center', fontWeight: '900', color: '#0f172a', fontSize: '15px' }}>
            {selectedDate === businessToday ? 'ΒΑΡΔΙΑ ΣΗΜΕΡΑ' : new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' }).toUpperCase()}
          </div>
          <button onClick={() => shiftDate(1)} style={arrowStyle}>→</button>
        </div>

        {/* STATS */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
          <div style={cardStyle}><p style={cardLabel}>ΕΣΟΔΑ</p><p style={{ color: '#10b981', fontSize: '26px', fontWeight: '900', margin: 0 }}>{totalInc.toFixed(2)}€</p></div>
          <div style={cardStyle}><p style={cardLabel}>ΕΞΟΔΑ</p><p style={{ color: '#ef4444', fontSize: '26px', fontWeight: '900', margin: 0 }}>{totalExp.toFixed(2)}€</p></div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <Link href={`/add-income?date=${selectedDate}`} style={{ ...actionBtn, backgroundColor: '#10b981' }}>+ ΕΣΟΔΑ</Link>
          <Link href={`/add-expense?date=${selectedDate}`} style={{ ...actionBtn, backgroundColor: '#ef4444' }}>- ΕΞΟΔΑ</Link>
        </div>
        {isAdmin && <Link href="/daily-z" style={zBtnStyle}>📟 ΚΛΕΙΣΙΜΟ ΤΑΜΕΙΟΥ (Ζ)</Link>}

        {/* LIST SECTION */}
        <div style={{ marginTop: '35px' }}>
          <p style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', marginBottom: '15px', letterSpacing: '1px' }}>ΚΙΝΗΣΕΙΣ ΗΜΕΡΑΣ</p>
          
          {loading ? <p style={{ textAlign: 'center', fontWeight: '800', color: '#94a3b8', padding: '20px' }}>Φόρτωση...</p> : (
            <>
              {/* 1. Ζ ΟΜΑΔΟΠΟΙΗΣΗ */}
              {zTotal > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div onClick={() => isAdmin && setIsZExpanded(!isZExpanded)} style={zItemHeader}>
                    <div style={{ flex: 1 }}><p style={{ fontWeight: '900', margin: 0, fontSize: '15px' }}>📟 ΣΥΝΟΛΟ Ζ</p></div>
                    <p style={{ fontWeight: '900', fontSize: '18px', margin: 0 }}>+{zTotal.toFixed(2)}€</p>
                  </div>
                  {isZExpanded && (
                    <div style={zBreakdownPanel}>
                      {zEntries.map(z => (
                        <div key={z.id} style={zSubItem}>
                          <div style={{ flex: 1 }}>
                             <p style={{ fontWeight: '800', margin: 0, fontSize: '13px', color: '#475569' }}>
                               {getPaymentIcon(z.method)} {z.method.toUpperCase()}
                             </p>
                             <span style={timeBadge}>🕒 {formatTime(z.created_at)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                             <p style={{ fontWeight: '900', fontSize: '14px', margin: 0, color: '#1e293b' }}>{Number(z.amount).toFixed(2)}€</p>
                             {isAdmin && <button onClick={() => handleDelete(z.id)} style={iconBtnSmallRed}>🗑️</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 2. ΥΠΑΛΛΗΛΟΙ ΟΜΑΔΟΠΟΙΗΣΗ */}
              {Object.keys(groupedSalaries).map(empId => {
                const group = groupedSalaries[empId];
                const isExpanded = expandedEmpId === empId;
                return (
                  <div key={empId} style={{ marginBottom: '10px' }}>
                    <div onClick={() => isAdmin && setExpandedEmpId(isExpanded ? null : empId)} style={salaryItemHeader}>
                      <div style={{ flex: 1 }}><p style={{ fontWeight: '900', margin: 0, fontSize: '15px', color: '#1e40af' }}>👤 {group.name.toUpperCase()}</p></div>
                      <p style={{ fontWeight: '900', fontSize: '18px', color: '#dc2626', margin: 0 }}>-{group.total.toFixed(2)}€</p>
                    </div>
                    {isExpanded && (
                      <div style={salaryBreakdownPanel}>
                        {group.items.map((t: any) => (
                          <div key={t.id} style={zSubItem}>
                            <div style={{ flex: 1 }}>
                               <p style={{ fontWeight: '800', margin: 0, fontSize: '13px', color: '#475569' }}>
                                 {getPaymentIcon(t.method)} {t.method.toUpperCase()}
                               </p>
                               <span style={timeBadge}>🕒 {formatTime(t.created_at)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <p style={{ fontWeight: '900', fontSize: '14px', margin: 0, color: '#1e293b' }}>{Math.abs(Number(t.amount)).toFixed(2)}€</p>
                              {isAdmin && <button onClick={() => handleDelete(t.id)} style={iconBtnSmallRed}>🗑️</button>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 3. ΛΟΙΠΕΣ ΚΙΝΗΣΕΙΣ */}
              {regularEntries.map(t => (
                <div key={t.id} style={{ marginBottom: '10px' }}>
                  <div onClick={() => isAdmin && setExpandedTx(expandedTx === t.id ? null : t.id)} style={itemCard}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '800', margin: 0, fontSize: '17px', color: '#1e293b' }}>
                          {t.suppliers?.name || t.category.toUpperCase()}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '800' }}>
                          {getPaymentIcon(t.method)} {t.method.toUpperCase()}
                        </span>
                        <span style={userBadge}>👤 {t.created_by_name?.split(' ')[0].toUpperCase()}</span>
                        <span style={timeBadge}>🕒 {formatTime(t.created_at)}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: '950', fontSize: '19px', color: t.type === 'income' ? '#10b981' : '#ef4444', margin: 0 }}>
                        {t.type === 'income' ? '+' : '-'}{Math.abs(Number(t.amount)).toFixed(2)}€
                      </p>
                    </div>
                  </div>
                  {isAdmin && expandedTx === t.id && (
                    <div style={actionPanel}>
                      <button onClick={() => router.push(`/${t.type === 'income' ? 'add-income' : 'add-expense'}?editId=${t.id}`)} style={editBtn}>
                        ΕΠΕΞΕΡΓΑΣΙΑ ✎
                      </button>
                      <button onClick={() => handleDelete(t.id)} style={deleteBtn}>
                        ΔΙΑΓΡΑΦΗ 🗑️
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {transactions.length === 0 && !loading && (
                <p style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontWeight: '700' }}>Καμία κίνηση για αυτή τη βάρδια.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// PREMIUM STYLES
const iphoneWrapper: any = { backgroundColor: '#f8fafc', minHeight: '100dvh', padding: '20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const logoBoxStyle: any = { width: '48px', height: '48px', backgroundColor: '#0f172a', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '22px', boxShadow: '0 8px 16px rgba(15, 23, 42, 0.1)' };
const menuBtnStyle: any = { width: '42px', height: '42px', borderRadius: '14px', border: '1px solid #e2e8f0', background: 'white', fontSize: '22px', cursor: 'pointer', color: '#1e293b' };
const dropdownStyle: any = { position: 'absolute' as any, top: '55px', right: 0, background: 'white', minWidth: '240px', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', padding: '12px', zIndex: 1000, border: '1px solid #f1f5f9', maxHeight: '80vh', overflowY: 'auto' };
const menuItem: any = { display: 'block', padding: '14px', textDecoration: 'none', color: '#1e293b', fontWeight: '700', fontSize: '15px', borderRadius: '12px' };
const menuSectionLabel: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', paddingLeft: '14px', marginTop: '12px', marginBottom: '6px', letterSpacing: '1px' };
const logoutBtnStyle: any = { ...menuItem, width: '100%', textAlign: 'left', background: '#fee2e2', color: '#ef4444', border: 'none', marginTop: '10px', fontWeight: '900' };
const divider: any = { height: '1px', backgroundColor: '#f1f5f9', margin: '10px 0' };
const dateBarStyle: any = { display: 'flex', alignItems: 'center', background: 'white', padding: '12px', borderRadius: '18px', marginBottom: '25px', border: '1px solid #f1f5f9' };
const arrowStyle: any = { background: 'none', border: 'none', fontSize: '20px', fontWeight: '900', color: '#0f172a', cursor: 'pointer', padding: '0 10px' };
const cardStyle: any = { flex: 1, background: 'white', padding: '22px 15px', borderRadius: '28px', textAlign: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.03)', border: '1px solid #f8fafc' };
const cardLabel: any = { fontSize: '11px', fontWeight: '900', color: '#64748b', marginBottom: '6px' };
const actionBtn: any = { flex: 1, padding: '18px', borderRadius: '20px', color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '900', fontSize: '15px' };
const zBtnStyle: any = { display: 'block', padding: '18px', borderRadius: '20px', backgroundColor: '#0f172a', color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '900', fontSize: '15px', marginTop: '12px' };
const itemCard: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '20px', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' };
const zItemHeader: any = { ...itemCard, background: '#0f172a', color: 'white', border: 'none' };
const salaryItemHeader: any = { ...itemCard, background: '#eff6ff', border: '1px solid #dbeafe' };
const zBreakdownPanel: any = { backgroundColor: 'white', padding: '15px 20px', borderRadius: '0 0 24px 24px', border: '1px solid #f1f5f9', borderTop: 'none', marginTop: '-15px', marginBottom: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' };
const salaryBreakdownPanel: any = { backgroundColor: 'white', padding: '15px 20px', borderRadius: '0 0 24px 24px', border: '1px solid #dbeafe', borderTop: 'none', marginTop: '-15px', marginBottom: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' };
const zSubItem: any = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' };
const userBadge: any = { fontSize: '10px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '8px', fontWeight: '800' };
const actionPanel: any = { backgroundColor: 'white', padding: '10px 20px 20px', borderRadius: '0 0 24px 24px', border: '1px solid #f1f5f9', borderTop: 'none', display: 'flex', gap: '10px', marginTop: '-15px', marginBottom: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' };
const editBtn: any = { flex: 1, background: '#fef3c7', color: '#92400e', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' };
const deleteBtn: any = { flex: 1, background: '#fee2e2', color: '#991b1b', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' };
const iconBtnSmallRed: any = { background: '#fee2e2', border: 'none', padding: '5px 8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' };

const timeBadge: any = { 
  fontSize: '10px', 
  backgroundColor: '#eff6ff', 
  color: '#3b82f6', 
  padding: '2px 8px', 
  borderRadius: '8px', 
  fontWeight: '800',
  display: 'inline-flex',
  alignItems: 'center',
  marginTop: '2px'
};

export default function HomePage() { return <main><Suspense fallback={<div>Φόρτωση...</div>}><DashboardContent /></Suspense></main> }
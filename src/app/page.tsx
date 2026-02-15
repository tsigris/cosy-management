'use client'

// 1. ΕΠΙΒΟΛΗ DYNAMIC ΓΙΑ ΤΟ VERCEL BUILD
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

// --- ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΠΑΛΕΤΑ ΧΡΩΜΑΤΩΝ ---
const colors = {
  primaryDark: '#1e293b',
  primaryText: '#334155',
  secondaryText: '#64748b',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  cardBg: '#ffffff',
  border: '#e2e8f0',
  hoverBg: '#f1f5f9',
}

// 2. ΤΟ COMPONENT ΜΕ ΟΛΗ ΤΗ ΛΟΓΙΚΗ
function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const getBusinessDate = () => {
    const now = new Date()
    if (now.getHours() < 7) now.setDate(now.getDate() - 1)
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
  const [storeId, setStoreId] = useState<string | null>(null)
  const [permissions, setPermissions] = useState({
    role: 'user',
    store_id: null as string | null,
    can_view_analysis: false,
    can_view_history: false,
  })

  const isAdmin = permissions.role === 'admin'

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString('el-GR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return '--:--'
    }
  }

  const fetchAppData = useCallback(async () => {
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 7000)
      )
      const authPromise = supabase.auth.getSession()
      const sessionRes: any = await Promise.race([authPromise, timeout])

      const session = sessionRes.data?.session

      // --- ΛΟΓΙΚΗ ΑΝΑΓΝΩΡΙΣΗΣ ΠΑΛΙΟΥ ΧΡΗΣΤΗ (PIN/BIOMETRICS) ---
      if (!session) {
        const hasPin = localStorage.getItem('fleet_track_pin_enabled') === 'true'
        const hasBio = localStorage.getItem('fleet_track_biometrics') === 'true'

        if (hasPin || hasBio) router.push('/login?mode=fast')
        else router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile) {
        setStoreName(profile.store_name || 'Cosy App')

        const nextPermissions = {
          role: profile.role || 'user',
          store_id: profile.store_id,
          can_view_analysis: profile.can_view_analysis || false,
          can_view_history: profile.can_view_history || false,
        }

        setPermissions(nextPermissions)
        setStoreId(profile.store_id || null)

        const { data: transData } = await supabase
          .from('transactions')
          .select('*, suppliers(name), fixed_assets(name), employees(full_name)')
          .eq('store_id', profile.store_id)
          .eq('date', selectedDate)
          .order('created_at', { ascending: false })

        setTransactions(transData || [])
      }
    } catch (err) {
      console.error('Fetch Error:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedDate, router])

  // Wake-up / focus refresh + midnight businessDate swap
  useEffect(() => {
    const handleWakeUp = () => {
      if (document.visibilityState === 'visible') {
        const currentBD = getBusinessDate()
        if (currentBD !== businessToday) {
          window.location.reload()
        } else {
          fetchAppData()
        }
      }
    }

    fetchAppData()

    document.addEventListener('visibilitychange', handleWakeUp)
    window.addEventListener('focus', handleWakeUp)

    const timer = setInterval(() => {
      if (getBusinessDate() !== businessToday) window.location.reload()
    }, 30000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.push('/login')
    })

    return () => {
      document.removeEventListener('visibilitychange', handleWakeUp)
      window.removeEventListener('focus', handleWakeUp)
      clearInterval(timer)
      subscription.unsubscribe()
    }
  }, [fetchAppData, businessToday, router])

  // ✅ Realtime subscription: listen to all changes in transactions, filtered by store_id + selectedDate
  useEffect(() => {
    if (!storeId) return

    const channel = supabase
      .channel(`realtime-dashboard-${storeId}-${selectedDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          // Αν θες να είμαστε πιο “έξυπνοι”, μπορούμε να κοιτάμε payload.new/date
          // και να κάνουμε fetch μόνο όταν αφορά τη selectedDate.
          // Για αξιοπιστία: κάνουμε fetch και μετά “κλειδώνει” από το query (.eq('date', selectedDate)).
          fetchAppData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId, selectedDate, fetchAppData])

  const getPaymentIcon = (method: string) => {
    const m = method?.toLowerCase() || ''
    if (m.includes('μετρητά')) return '💵'
    if (m.includes('κάρτα') || m.includes('pos') || m.includes('τράπεζα')) return '💳'
    if (m.includes('πίστωση')) return '🚩'
    return '📝'
  }

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    router.push(`/?date=${year}-${month}-${day}`)
    setIsMenuOpen(false)
    setExpandedTx(null)
    setIsZExpanded(false)
    setExpandedEmpId(null)
  }

  // --- ΛΟΓΙΚΗ ΥΠΟΛΟΓΙΣΜΩΝ / ΟΜΑΔΟΠΟΙΗΣΗΣ ---
  const zEntries = useMemo(
    () => transactions.filter((t) => t.category === 'Εσοδα Ζ'),
    [transactions]
  )
  const zTotal = useMemo(
    () => zEntries.reduce((acc, t) => acc + Number(t.amount), 0),
    [zEntries]
  )

  const salaryEntries = useMemo(
    () => transactions.filter((t) => t.category === 'Προσωπικό'),
    [transactions]
  )
  const groupedSalaries = useMemo(() => {
    return salaryEntries.reduce((acc: any, t: any) => {
      const empId = t.employee_id || 'unknown'
      if (!acc[empId]) {
        acc[empId] = {
          name: t.employees?.full_name || 'Προσωπικό',
          total: 0,
          items: [],
        }
      }
      acc[empId].total += Math.abs(Number(t.amount))
      acc[empId].items.push(t)
      return acc
    }, {})
  }, [salaryEntries])

  const regularEntries = useMemo(
    () =>
      transactions.filter(
        (t) => t.category !== 'Εσοδα Ζ' && t.category !== 'Προσωπικό' && t.category !== 'pocket'
      ),
    [transactions]
  )

  // ✅ 1) ΔΙΟΡΘΩΣΗ TOTAL INCOME: όλα τα income (συμπεριλαμβάνει και "Εσοδα Ζ")
  const totalInc = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'income')
        .reduce((acc, t) => acc + Number(t.amount), 0),
    [transactions]
  )

  const totalExp = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'expense' && !t.is_credit && t.category !== 'pocket')
        .reduce((acc, t) => acc + Number(t.amount), 0),
    [transactions]
  )

  const handleDelete = async (id: string) => {
    if (!isAdmin) return
    if (confirm('Οριστική διαγραφή;')) {
      await supabase.from('transactions').delete().eq('id', id)
      // Δεν είναι απαραίτητο λόγω realtime, αλλά κρατάμε και manual για άμεσο update
      fetchAppData()
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('supabase.auth.token')
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
        }}
      >
        <p style={{ fontWeight: 'bold', color: '#64748b' }}>Φορτώνεται...</p>
      </div>
    )
  }

  return (
    <div style={iphoneWrapper}>
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>📈</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '24px', margin: 0, color: colors.primaryDark }}>{storeName}</h1>
              <p style={{ margin: 0, fontSize: '11px', color: colors.secondaryText, fontWeight: '600', letterSpacing: '1px' }}>
                BUSINESS DASHBOARD
              </p>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={menuBtnStyle}>
              ⋮
            </button>
            {isMenuOpen && (
              <div style={dropdownStyle}>
                <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
                <Link href="/suppliers" style={menuItem} onClick={() => setIsMenuOpen(false)}>
                  🛒 Προμηθευτές
                </Link>
                <Link href="/fixed-assets" style={menuItem} onClick={() => setIsMenuOpen(false)}>
                  🔌 Πάγια
                </Link>
                {isAdmin && (
                  <>
                    <Link href="/employees" style={menuItem} onClick={() => setIsMenuOpen(false)}>
                      👥 Υπάλληλοι
                    </Link>
                    <Link href="/suppliers-balance" style={menuItem} onClick={() => setIsMenuOpen(false)}>
                      🚩 Καρτέλες (Χρέη)
                    </Link>
                  </>
                )}
                {(isAdmin || permissions.can_view_analysis) && (
                  <Link href="/analysis" style={menuItem} onClick={() => setIsMenuOpen(false)}>
                    📊 Ανάλυση
                  </Link>
                )}
                <div style={divider} />
                <p style={menuSectionLabel}>ΕΦΑΡΜΟΓΗ</p>
                <Link href="/help" style={menuItem} onClick={() => setIsMenuOpen(false)}>
                  ❓ Οδηγίες Χρήσης
                </Link>
                {isAdmin && (
                  <Link href="/admin/permissions" style={menuItem} onClick={() => setIsMenuOpen(false)}>
                    🔐 Δικαιώματα
                  </Link>
                )}
                <Link href="/subscription" style={menuItem} onClick={() => setIsMenuOpen(false)}>
                  💳 Συνδρομή
                </Link>
                <Link href="/settings" style={menuItem} onClick={() => setIsMenuOpen(false)}>
                  ⚙️ Ρυθμίσεις
                </Link>
                <div style={divider} />
                <button onClick={handleLogout} style={logoutBtnStyle}>
                  ΑΠΟΣΥΝΔΕΣΗ 🚪
                </button>
              </div>
            )}
          </div>
        </div>

        {/* DATE SELECTOR */}
        <div style={dateBarStyle}>
          <button onClick={() => shiftDate(-1)} style={arrowStyle}>
            ←
          </button>
          <div style={{ flex: 1, textAlign: 'center', fontWeight: '800', color: colors.primaryDark, fontSize: '16px' }}>
            {new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' }).toUpperCase()}
          </div>
          <button onClick={() => shiftDate(1)} style={arrowStyle}>
            →
          </button>
        </div>

        {/* STATS */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
          <div style={cardStyle}>
            <p style={cardLabel}>ΕΣΟΔΑ</p>
            <p style={{ color: colors.accentGreen, fontSize: '26px', fontWeight: '800', margin: 0 }}>{totalInc.toFixed(2)}€</p>
          </div>
          <div style={cardStyle}>
            <p style={cardLabel}>ΕΞΟΔΑ</p>
            <p style={{ color: colors.accentRed, fontSize: '26px', fontWeight: '800', margin: 0 }}>{totalExp.toFixed(2)}€</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <Link href={`/add-income?date=${selectedDate}`} style={{ ...actionBtn, backgroundColor: colors.accentGreen }}>
            + ΕΣΟΔΑ
          </Link>
          <Link href={`/add-expense?date=${selectedDate}`} style={{ ...actionBtn, backgroundColor: colors.accentRed }}>
            - ΕΞΟΔΑ
          </Link>
        </div>
        {isAdmin && (
          <Link href="/daily-z" style={zBtnStyle}>
            📟 ΚΛΕΙΣΙΜΟ ΤΑΜΕΙΟΥ (Ζ)
          </Link>
        )}

        {/* LIST */}
        <div style={{ marginTop: '35px' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: colors.secondaryText, marginBottom: '15px', letterSpacing: '1px' }}>
            ΚΙΝΗΣΕΙΣ ΗΜΕΡΑΣ
          </p>

          {/* 2) ΕΣΟΔΑ Ζ ΟΜΑΔΟΠΟΙΗΜΕΝΑ ΠΑΝΩ-ΠΑΝΩ */}
          {zEntries.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div
                onClick={() => setIsZExpanded(!isZExpanded)}
                style={{ ...zItemHeader, cursor: 'pointer' }}
                role="button"
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '700', margin: 0, fontSize: '15px' }}>📟 ΣΥΝΟΛΟ Ζ</p>
                </div>
                <p style={{ fontWeight: '800', fontSize: '18px', margin: 0 }}>+{zTotal.toFixed(2)}€</p>
              </div>

              {isZExpanded && (
                <div style={zBreakdownPanel}>
                  {zEntries.map((z) => (
                    <div key={z.id} style={zSubItem}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: '600', margin: 0, fontSize: '14px', color: colors.primaryText }}>
                          {getPaymentIcon(z.method)} {String(z.method || '').toUpperCase()}
                        </p>
                        <span style={timeBadge}>🕒 {formatTime(z.created_at)}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <p style={{ fontWeight: '700', fontSize: '15px', margin: 0, color: colors.primaryDark }}>
                          {Number(z.amount).toFixed(2)}€
                        </p>
                        {isAdmin && (
                          <button onClick={() => handleDelete(z.id)} style={iconBtnSmallRed} title="Διαγραφή">
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ΥΠΑΛΛΗΛΟΙ */}
          {Object.keys(groupedSalaries).map((empId) => {
            const group = groupedSalaries[empId]
            const isExpanded = expandedEmpId === empId
            return (
              <div key={empId} style={{ marginBottom: '10px' }}>
                <div
                  onClick={() => isAdmin && setExpandedEmpId(isExpanded ? null : empId)}
                  style={{ ...salaryItemHeader, cursor: isAdmin ? 'pointer' : 'default' }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '700', margin: 0, fontSize: '15px', color: '#1e40af' }}>
                      👤 {String(group.name || '').toUpperCase()}
                    </p>
                  </div>
                  <p style={{ fontWeight: '800', fontSize: '18px', color: colors.accentRed, margin: 0 }}>
                    -{group.total.toFixed(2)}€
                  </p>
                </div>

                {isExpanded && (
                  <div style={salaryBreakdownPanel}>
                    {group.items.map((t: any) => (
                      <div key={t.id} style={zSubItem}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: '600', margin: 0, fontSize: '14px', color: colors.primaryText }}>
                            {getPaymentIcon(t.method)} {String(t.method || '').toUpperCase()}
                          </p>
                          <span style={timeBadge}>🕒 {formatTime(t.created_at)}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <p style={{ fontWeight: '700', fontSize: '15px', margin: 0, color: colors.primaryDark }}>
                            {Math.abs(Number(t.amount)).toFixed(2)}€
                          </p>
                          {isAdmin && (
                            <button onClick={() => handleDelete(t.id)} style={iconBtnSmallRed} title="Διαγραφή">
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* ΛΟΙΠΕΣ ΚΙΝΗΣΕΙΣ */}
          {regularEntries.map((t) => (
            <div key={t.id} style={{ marginBottom: '10px' }}>
              <div
                onClick={() => isAdmin && setExpandedTx(expandedTx === t.id ? null : t.id)}
                style={{ ...itemCard, cursor: isAdmin ? 'pointer' : 'default' }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '700', margin: 0, fontSize: '16px', color: colors.primaryDark }}>
                    {t.suppliers?.name || String(t.category || '').toUpperCase()}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: colors.secondaryText, fontWeight: '600' }}>
                      {getPaymentIcon(t.method)} {String(t.method || '').toUpperCase()}
                    </span>
                    <span style={userBadge}>👤 {String(t.created_by_name || '').split(' ')[0]?.toUpperCase()}</span>
                    <span style={timeBadge}>🕒 {formatTime(t.created_at)}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <p
                    style={{
                      fontWeight: '800',
                      fontSize: '18px',
                      color: t.type === 'income' ? colors.accentGreen : colors.accentRed,
                      margin: 0,
                    }}
                  >
                    {t.type === 'income' ? '+' : '-'}
                    {Math.abs(Number(t.amount)).toFixed(2)}€
                  </p>
                </div>
              </div>

              {isAdmin && expandedTx === t.id && (
                <div style={actionPanel}>
                  <button
                    onClick={() => router.push(`/${t.type === 'income' ? 'add-income' : 'add-expense'}?editId=${t.id}`)}
                    style={editBtn}
                  >
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
            <p style={{ textAlign: 'center', padding: '40px', color: colors.secondaryText, fontWeight: '600' }}>Καμία κίνηση.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// 3. ΤΟ ΚΕΝΤΡΙΚΟ EXPORT ΜΕ SUSPENSE ΓΙΑ ΤΟ VERCEL
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
          Φόρτωση...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}

// --- PROFESSIONAL STYLES ---
const iphoneWrapper: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100dvh',
  padding: '20px',
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
}

const logoBoxStyle: any = {
  width: '48px',
  height: '48px',
  backgroundColor: colors.primaryDark,
  borderRadius: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: '22px',
  boxShadow: '0 4px 10px rgba(30, 41, 59, 0.15)',
}

const menuBtnStyle: any = {
  width: '42px',
  height: '42px',
  borderRadius: '12px',
  border: `1px solid ${colors.border}`,
  background: colors.cardBg,
  fontSize: '20px',
  cursor: 'pointer',
  color: colors.primaryDark,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
}

const dropdownStyle: any = {
  position: 'absolute' as any,
  top: '50px',
  right: 0,
  background: colors.cardBg,
  minWidth: '220px',
  borderRadius: '16px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
  padding: '8px',
  zIndex: 1000,
  border: `1px solid ${colors.border}`,
}

const menuItem: any = {
  display: 'block',
  padding: '10px 14px',
  textDecoration: 'none',
  color: colors.primaryDark,
  fontWeight: '600',
  fontSize: '14px',
  borderRadius: '10px',
}

const menuSectionLabel: any = {
  fontSize: '10px',
  fontWeight: '800',
  color: colors.secondaryText,
  paddingLeft: '14px',
  marginTop: '8px',
  marginBottom: '4px',
  letterSpacing: '1px',
}

const logoutBtnStyle: any = {
  ...menuItem,
  width: '100%',
  textAlign: 'left',
  background: '#fee2e2',
  color: colors.accentRed,
  border: 'none',
  marginTop: '8px',
  fontWeight: '700',
}

const divider: any = { height: '1px', backgroundColor: colors.border, margin: '6px 0' }

const dateBarStyle: any = {
  display: 'flex',
  alignItems: 'center',
  background: colors.cardBg,
  padding: '10px',
  borderRadius: '16px',
  marginBottom: '25px',
  border: `1px solid ${colors.border}`,
  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
}

const arrowStyle: any = {
  background: 'none',
  border: 'none',
  fontSize: '18px',
  fontWeight: '800',
  color: colors.primaryDark,
  cursor: 'pointer',
  padding: '0 12px',
}

const cardStyle: any = {
  flex: 1,
  background: colors.cardBg,
  padding: '20px 15px',
  borderRadius: '20px',
  textAlign: 'center',
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  border: `1px solid ${colors.border}`,
}

const cardLabel: any = {
  fontSize: '11px',
  fontWeight: '700',
  color: colors.secondaryText,
  marginBottom: '8px',
  letterSpacing: '0.5px',
}

const actionBtn: any = {
  flex: 1,
  padding: '16px',
  borderRadius: '18px',
  color: 'white',
  textDecoration: 'none',
  textAlign: 'center',
  fontWeight: '700',
  fontSize: '14px',
  boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
  display: 'block',
}

const zBtnStyle: any = {
  display: 'block',
  padding: '16px',
  borderRadius: '18px',
  backgroundColor: colors.primaryDark,
  color: 'white',
  textDecoration: 'none',
  textAlign: 'center',
  fontWeight: '700',
  fontSize: '14px',
  marginTop: '12px',
  boxShadow: '0 4px 12px rgba(30, 41, 59, 0.2)',
}

const itemCard: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: colors.cardBg,
  padding: '18px',
  borderRadius: '18px',
  border: `1px solid ${colors.border}`,
  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
  marginBottom: '10px',
}

const zItemHeader: any = {
  ...itemCard,
  background: colors.primaryDark,
  color: 'white',
  border: 'none',
  boxShadow: '0 4px 12px rgba(30, 41, 59, 0.15)',
}

const salaryItemHeader: any = { ...itemCard, background: '#eff6ff', border: '1px solid #bfdbfe' }

const zBreakdownPanel: any = {
  backgroundColor: colors.cardBg,
  padding: '15px 18px',
  borderRadius: '0 0 18px 18px',
  border: `1px solid ${colors.border}`,
  borderTop: 'none',
  marginTop: '-15px',
  marginBottom: '15px',
}

const salaryBreakdownPanel: any = { ...zBreakdownPanel, border: '1px solid #bfdbfe', borderTop: 'none' }

const zSubItem: any = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: `1px solid ${colors.border}`,
}

const userBadge: any = {
  fontSize: '10px',
  backgroundColor: colors.hoverBg,
  color: colors.secondaryText,
  padding: '3px 8px',
  borderRadius: '6px',
  fontWeight: '700',
  border: `1px solid ${colors.border}`,
}

const actionPanel: any = {
  backgroundColor: colors.cardBg,
  padding: '12px 18px 18px',
  borderRadius: '0 0 18px 18px',
  border: `1px solid ${colors.border}`,
  borderTop: 'none',
  display: 'flex',
  gap: '10px',
  marginTop: '-15px',
  marginBottom: '15px',
}

const editBtn: any = {
  flex: 1,
  background: '#fffbeb',
  color: '#b45309',
  border: '1px solid #fcd34d',
  padding: '10px',
  borderRadius: '10px',
  fontWeight: '700',
  fontSize: '12px',
}

const deleteBtn: any = {
  flex: 1,
  background: '#fef2f2',
  color: colors.accentRed,
  border: '1px solid #fecaca',
  padding: '10px',
  borderRadius: '10px',
  fontWeight: '700',
  fontSize: '12px',
}

const iconBtnSmallRed: any = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  padding: '6px 10px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '12px',
  color: colors.accentRed,
}

const timeBadge: any = {
  fontSize: '10px',
  backgroundColor: '#f0f9ff',
  color: '#0369a1',
  padding: '3px 8px',
  borderRadius: '6px',
  fontWeight: '700',
  display: 'inline-flex',
  alignItems: 'center',
  border: '1px solid #bae6fd',
}
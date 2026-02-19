'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LogOut, Plus, ArrowRight, TrendingUp, TrendingDown, Wallet, Store } from 'lucide-react'
import { toast, Toaster } from 'sonner'

export default function SelectStorePage() {
  const [userStores, setUserStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [accessWarning, setAccessWarning] = useState('')
  const router = useRouter()

  // ✅ Stripe-like "LIVE" datetime label (auto updates)
  const [liveDateTime, setLiveDateTime] = useState<string>('')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ✅ helper: "πριν Χ λεπτά"
  const formatRelativeMinutes = (isoDate?: string | null) => {
    if (!isoDate) return '—'
    const d = new Date(isoDate)
    if (Number.isNaN(d.getTime())) return '—'
    const diffMs = Date.now() - d.getTime()
    const mins = Math.max(0, Math.floor(diffMs / 60000))
    if (mins < 1) return 'μόλις τώρα'
    if (mins < 60) return `πριν ${mins} λεπτά`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `πριν ${hours} ώρες`
    const days = Math.floor(hours / 24)
    return `πριν ${days} μέρες`
  }

  // ✅ Stripe-like LIVE label content
  const buildStripeLiveLabel = () => {
    const now = new Date()

    // e.g. "ΤΡΙ, 17 ΦΕΒ 2026"
    const datePart = now
      .toLocaleDateString('el-GR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
      .toUpperCase()

    // e.g. "01:06"
    const timePart = now.toLocaleTimeString('el-GR', {
      hour: '2-digit',
      minute: '2-digit'
    })

    return `${datePart} • ${timePart}`
  }

  // ✅ live clock (updates every minute)
  useEffect(() => {
    const tick = () => setLiveDateTime(buildStripeLiveLabel())
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  const fetchStoresData = useCallback(async () => {
    try {
      setLoading(true)
      setAccessWarning('')

      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      const userId = session.user.id

      // Auto-heal owner access: αν ο χρήστης είναι owner αλλά λείπει από store_access,
      // προσπαθούμε να τον προσθέσουμε ως admin.
      const { data: ownedStores, error: ownedStoresError } = await supabase
        .from('stores')
        .select('id, name')
        .eq('owner_id', userId)

      if (ownedStoresError) {
        throw ownedStoresError
      }

      const { data: myAccessBeforeRepair, error: beforeRepairError } = await supabase
        .from('store_access')
        .select('store_id')
        .eq('user_id', userId)

      if (beforeRepairError) {
        throw beforeRepairError
      }

      const existingAccessStoreIds = new Set((myAccessBeforeRepair || []).map((row: any) => String(row.store_id)))
      const missingOwnedStores = (ownedStores || []).filter((store: any) => !existingAccessStoreIds.has(String(store.id)))

      if (missingOwnedStores.length > 0) {
        const repairRows = missingOwnedStores.map((store: any) => ({
          store_id: store.id,
          user_id: userId,
          role: 'admin',
        }))

        const { error: repairError } = await supabase
          .from('store_access')
          .upsert(repairRows, { onConflict: 'store_id,user_id' })

        if (repairError) {
          console.error('Owner access auto-repair failed:', repairError)
          setAccessWarning('Δεν έγινε αυτόματη επιδιόρθωση δικαιωμάτων. Επικοινωνήστε με διαχειριστή για επαναφορά πρόσβασης.')
        } else {
          toast.success('Επαναφέρθηκαν δικαιώματα owner σε καταστήματα που έλειπαν ✅')
        }
      }

      // 1) Ανάκτηση προσβάσεων
      const { data: access, error } = await supabase
        .from('store_access')
        .select('store_id, stores(id, name)')
        .eq('user_id', userId)

      if (error) throw error
      if (!access || access.length === 0) {
        setUserStores([])
        setAccessWarning('Δεν έχετε δικαιώματα πρόσβασης σε κανένα κατάστημα (store_access).')
        return
      }

      // 2) Υπολογισμός στατιστικών μήνα
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10) // YYYY-MM-DD

      const storesWithStats = await Promise.all(
        access.map(async (item: any) => {
          const store = item.stores
          if (!store) return null

          // ✅ summary κινήσεων για κάρτα
          const { data: trans, error: transErr } = await supabase
            .from('transactions')
            .select('amount, type, date')
            .eq('store_id', store.id)
            .gte('date', firstDay)
            .order('date', { ascending: false })
            .limit(300)

          if (transErr) console.error('Transactions fetch error:', transErr)

          const income =
            trans
              ?.filter((t: any) => t.type === 'income')
              .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0) || 0

          const expenses =
            trans
              ?.filter((t: any) => t.type === 'expense' || t.type === 'debt_payment')
              .reduce((acc: number, curr: any) => acc + Math.abs(Number(curr.amount) || 0), 0) || 0

          const lastUpdated = trans?.[0]?.date || null // επειδή order desc

          return {
            id: store.id,
            name: store.name,
            income,
            expenses,
            profit: income - expenses,
            lastUpdated
          }
        })
      )

      setUserStores(storesWithStats.filter(Boolean))
    } catch (err: any) {
      console.error('Fetch error:', err)
      toast.error('Πρόβλημα κατά την ανάκτηση των καταστημάτων')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchStoresData()
  }, [fetchStoresData])

  // ✅ Global summary (all stores)
  const globalStats = useMemo(() => {
    const income = userStores.reduce((acc: number, s: any) => acc + (Number(s.income) || 0), 0)
    const expenses = userStores.reduce((acc: number, s: any) => acc + (Number(s.expenses) || 0), 0)
    const profit = income - expenses
    return { income, expenses, profit }
  }, [userStores])

  const handleSelect = (storeId: string) => {
    // ✅ Hard refresh για να καθαρίζει εντελώς state/data
    window.location.href = `/?store=${storeId}`
  }

  if (loading)
    return (
      <div style={centerStyle}>
        <div style={{ textAlign: 'center' }}>
          <Store className="animate-pulse" size={40} color="#6366f1" style={{ marginBottom: '15px' }} />
          <p>ΑΝΑΚΤΗΣΗ ΚΑΤΑΣΤΗΜΑΤΩΝ...</p>
        </div>
      </div>
    )

  return (
    <div style={containerStyle}>
      <Toaster richColors position="top-center" />

      <header style={{ marginBottom: '18px', textAlign: 'center' }}>
        <h1 style={{ fontWeight: '900', fontSize: '28px', color: '#0f172a', margin: 0 }}>Τα Καταστήματά μου</h1>

        {/* ✅ Stripe-like LIVE label */}
        <div style={liveRow}>
          <span style={livePill}>
            <span style={liveDot} />
            LIVE
          </span>
          <span style={liveText}>{liveDateTime}</span>
        </div>
      </header>

      {/* ✅ GLOBAL SUMMARY CARD */}
      {userStores.length > 0 && (
        <div style={heroCard}>
          <p style={heroLabel}>ΣΥΝΟΛΟ ΜΗΝΑ (ΟΛΑ ΤΑ ΚΑΤΑΣΤΗΜΑΤΑ)</p>
          <div style={heroValue}>
            {globalStats.profit >= 0 ? '' : '-'}
            {Math.abs(globalStats.profit).toFixed(2)} €
          </div>

          <div style={heroDivider} />

          <div style={heroRow}>
            <div style={{ textAlign: 'left' }}>
              <div style={heroMiniLabel}>ΕΣΟΔΑ</div>
              <div style={{ ...heroMiniValue, color: '#10b981' }}>{globalStats.income.toFixed(2)} €</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={heroMiniLabel}>ΕΞΟΔΑ</div>
              <div style={{ ...heroMiniValue, color: '#f43f5e' }}>{globalStats.expenses.toFixed(2)} €</div>
            </div>
          </div>
        </div>
      )}

      {userStores.length === 0 ? (
        <>
          {accessWarning && (
            <div style={warningBoxStyle}>
              <p style={warningTitleStyle}>Προειδοποίηση πρόσβασης</p>
              <p style={warningTextStyle}>{accessWarning}</p>
            </div>
          )}

          <div style={emptyStateStyle}>
            <Store size={40} color="#cbd5e1" style={{ margin: '0 auto 15px' }} />
            <p style={{ fontWeight: '700', color: '#64748b' }}>Δεν βρέθηκαν καταστήματα.</p>
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>Δημιουργήστε το πρώτο σας κατάστημα για να ξεκινήσετε.</p>
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {userStores.map((store: any) => (
            <div key={store.id} onClick={() => handleSelect(store.id)} style={cardStyle} className="store-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{store.name}</h2>
                  <p style={lastUpdatedStyle}>Τελευταία ενημέρωση: {formatRelativeMinutes(store.lastUpdated)}</p>
                </div>

                <div style={arrowCircle}>
                  <ArrowRight size={16} />
                </div>
              </div>

              <div style={statsGrid}>
                <div style={statBox}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#059669', marginBottom: '4px' }}>
                    <TrendingUp size={14} /> <span style={statLabel}>ΕΣΟΔΑ</span>
                  </div>
                  <span style={statValue}>{Number(store.income).toFixed(2)} €</span>
                </div>

                <div style={statBox}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#dc2626', marginBottom: '4px' }}>
                    <TrendingDown size={14} /> <span style={statLabel}>ΕΞΟΔΑ</span>
                  </div>
                  <span style={statValue}>{Number(store.expenses).toFixed(2)} €</span>
                </div>
              </div>

              <div style={profitRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wallet size={18} color="#6366f1" />
                  <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '14px' }}>ΚΑΘΑΡΟ ΚΕΡΔΟΣ</span>
                </div>

                <span
                  style={{
                    fontWeight: '900',
                    fontSize: '18px',
                    color: Number(store.profit) >= 0 ? '#0f172a' : '#dc2626'
                  }}
                >
                  {Number(store.profit).toFixed(2)} €
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => router.push('/stores/new')} style={addBtnStyle}>
        <Plus size={20} /> ΠΡΟΣΘΗΚΗ ΝΕΟΥ ΚΑΤΑΣΤΗΜΑΤΟΣ
      </button>

      <button onClick={handleLogout} style={logoutBtnStyle}>
        <LogOut size={16} /> ΑΠΟΣΥΝΔΕΣΗ ΧΡΗΣΤΗ
      </button>
    </div>
  )
}

// --- STYLES ---
const containerStyle: any = { padding: '30px 20px', backgroundColor: '#f8fafc', minHeight: '100dvh', paddingBottom: '60px' }
const centerStyle: any = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontWeight: '800', color: '#94a3b8', letterSpacing: '1px' }

// ✅ Stripe-like live row
const liveRow: any = { marginTop: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }
const livePill: any = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 10px',
  borderRadius: '999px',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  fontSize: '11px',
  fontWeight: '900',
  color: '#0f172a',
  letterSpacing: '0.06em'
}
const liveDot: any = { width: '8px', height: '8px', borderRadius: '999px', backgroundColor: '#10b981', boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.15)' }
const liveText: any = { fontSize: '12px', fontWeight: '800', color: '#64748b', letterSpacing: '0.02em' }

const heroCard: any = {
  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
  borderRadius: '26px',
  padding: '18px',
  color: 'white',
  marginBottom: '18px',
  boxShadow: '0 12px 30px rgba(0,0,0,0.14)'
}
const heroLabel: any = { margin: 0, fontSize: '10px', fontWeight: '900', letterSpacing: '1px', opacity: 0.75 }
const heroValue: any = { marginTop: '6px', fontSize: '26px', fontWeight: '900' }
const heroDivider: any = { height: '1px', backgroundColor: 'rgba(255,255,255,0.12)', marginTop: '12px' }
const heroRow: any = { display: 'flex', justifyContent: 'space-between', marginTop: '12px' }
const heroMiniLabel: any = { fontSize: '10px', fontWeight: '900', opacity: 0.7 }
const heroMiniValue: any = { fontSize: '14px', fontWeight: '900' }

const cardStyle: any = { backgroundColor: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }
const statsGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }
const statBox: any = { padding: '12px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }
const statLabel: any = { fontSize: '10px', fontWeight: '800' }
const statValue: any = { fontSize: '15px', fontWeight: '900', color: '#1e293b' }
const profitRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed #e2e8f0' }
const arrowCircle: any = { width: '32px', height: '32px', backgroundColor: '#0f172a', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const lastUpdatedStyle: any = { margin: '6px 0 0', fontSize: '11px', fontWeight: 800, color: '#64748b' }

const addBtnStyle: any = {
  width: '100%',
  padding: '18px',
  border: '2px dashed #cbd5e1',
  backgroundColor: 'transparent',
  color: '#64748b',
  borderRadius: '20px',
  fontWeight: '800',
  marginTop: '20px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px'
}
const logoutBtnStyle: any = {
  backgroundColor: '#fff',
  color: '#f43f5e',
  border: '1px solid #fee2e2',
  padding: '14px',
  borderRadius: '16px',
  fontWeight: '800',
  fontSize: '13px',
  cursor: 'pointer',
  width: '100%',
  marginTop: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px'
}
const emptyStateStyle: any = { textAlign: 'center', padding: '50px 20px', backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0' }
const warningBoxStyle: any = {
  marginBottom: '12px',
  padding: '14px',
  backgroundColor: '#fff7ed',
  border: '1px solid #fed7aa',
  borderRadius: '16px',
}
const warningTitleStyle: any = {
  margin: '0 0 6px 0',
  color: '#9a3412',
  fontSize: '12px',
  fontWeight: '900',
}
const warningTextStyle: any = {
  margin: 0,
  color: '#c2410c',
  fontSize: '12px',
  fontWeight: '700',
}
'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { clearSessionCache, supabase } from '@/lib/supabase'
import { refreshStoresCache, type StoreCard } from '@/lib/stores'
import { useRouter } from 'next/navigation'
import { LogOut, Plus, ArrowRight, TrendingUp, TrendingDown, Wallet, Store } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import ErrorBoundary from '@/components/ErrorBoundary'

function SelectStorePage() {
  const [userStores, setUserStores] = useState<StoreCard[]>([])
  const [loading, setLoading] = useState(true)
  const [accessWarning, setAccessWarning] = useState('')
  const [showRetryButton, setShowRetryButton] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const hasAutoRedirected = useRef(false)
  const router = useRouter()

  const [liveDateTime, setLiveDateTime] = useState<string>('')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    clearSessionCache()
    window.location.href = '/login'
  }

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

  const buildStripeLiveLabel = () => {
    const now = new Date()
    const datePart = now.toLocaleDateString('el-GR', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    }).toUpperCase()
    const timePart = now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
    return `${datePart} • ${timePart}`
  }

  useEffect(() => {
    const tick = () => setLiveDateTime(buildStripeLiveLabel())
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  const handleSelect = useCallback((storeId: string) => {
    window.location.href = `/?store=${storeId}`
  }, [])

  const maybeAutoRedirectSingleStore = useCallback((stores: StoreCard[]) => {
    if (hasAutoRedirected.current) return false
    if (stores.length !== 1) return false
    hasAutoRedirected.current = true
    handleSelect(stores[0].id)
    return true
  }, [handleSelect])

  useEffect(() => {
    let isMounted = true

    const loadStores = async () => {
      try {
        setLoading(true)
        setAccessWarning('')

        // --- RETRY LOGIC ΓΙΑ MOBILE (SAFARI/IPHONE) ---
        let { data: { session } } = await supabase.auth.getSession()

        // Αν δεν βρει session με την πρώτη, περίμενε 600ms και ξαναδοκίμασε
        if (!session) {
          await new Promise(r => setTimeout(r, 600))
          const retry = await supabase.auth.getSession()
          session = retry.data.session
        }

        if (!session) {
          if (isMounted) router.replace('/login')
          return
        }
        // ----------------------------------------------

        const fresh = await refreshStoresCache(session.user.id)
        if (!isMounted) return

        const safeStores = Array.isArray(fresh?.stores) ? fresh.stores : []
        setUserStores(safeStores)
        setAccessWarning(fresh.accessWarning || '')
        setShowRetryButton(false)
        maybeAutoRedirectSingleStore(safeStores)
      } catch (err: any) {
        console.error('Fetch error:', err)
        if (isMounted) {
          toast.error('Πρόβλημα κατά την ανάκτηση των καταστημάτων')
          setShowRetryButton(true)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void loadStores()
    return () => { isMounted = false }
  }, [router, maybeAutoRedirectSingleStore, retryNonce])

  const globalStats = useMemo(() => {
    const safeStores = Array.isArray(userStores) ? userStores : []
    const income = safeStores.reduce((acc, s) => acc + (Number(s?.income) || 0), 0)
    const expenses = safeStores.reduce((acc, s) => acc + (Number(s?.expenses) || 0), 0)
    return { income, expenses, profit: income - expenses }
  }, [userStores])

  if (loading) return <div style={containerStyle}><p style={{textAlign:'center', fontWeight:'800', color:'#64748b'}}>Φόρτωση καταστημάτων...</p></div>

  return (
    <div style={containerStyle}>
      <Toaster richColors position="top-center" />
      <header style={{ marginBottom: '18px', textAlign: 'center' }}>
        <h1 style={{ fontWeight: '900', fontSize: '28px', color: '#0f172a', margin: 0 }}>Τα Καταστήματά μου</h1>
        <div style={liveRow}>
          <span style={livePill}><span style={liveDot} />LIVE</span>
          <span style={liveText}>{liveDateTime}</span>
        </div>
      </header>

      {userStores.length > 0 && (
        <div style={heroCard}>
          <p style={heroLabel}>ΣΥΝΟΛΟ ΜΗΝΑ (ΟΛΑ ΤΑ ΚΑΤΑΣΤΗΜΑΤΑ)</p>
          <div style={heroValue}>{globalStats.profit.toFixed(2)} €</div>
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
        <div style={emptyStateStyle}>
          <Store size={40} color="#cbd5e1" style={{ margin: '0 auto 15px' }} />
          <p style={{ fontWeight: '700', color: '#64748b' }}>Δεν βρέθηκαν καταστήματα.</p>
          {showRetryButton && (
             <button onClick={() => setRetryNonce(n => n + 1)} style={retryBtnStyle}>Δοκιμάστε ξανά</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {userStores.map((store) => (
            <div key={store.id} onClick={() => handleSelect(store.id)} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{store.name}</h2>
                  <p style={lastUpdatedStyle}>Ενημέρωση: {formatRelativeMinutes(store.lastUpdated)}</p>
                </div>
                <div style={arrowCircle}><ArrowRight size={16} /></div>
              </div>
              <div style={statsGrid}>
                <div style={statBox}><span style={statLabel}>ΕΣΟΔΑ</span><br/><span style={statValue}>{Number(store.income).toFixed(2)} €</span></div>
                <div style={statBox}><span style={statLabel}>ΕΞΟΔΑ</span><br/><span style={statValue}>{Number(store.expenses).toFixed(2)} €</span></div>
              </div>
              <div style={profitRow}>
                <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '14px' }}>ΚΑΘΑΡΟ ΚΕΡΔΟΣ</span>
                <span style={{ fontWeight: '900', fontSize: '18px', color: Number(store.profit) >= 0 ? '#0f172a' : '#dc2626' }}>{Number(store.profit).toFixed(2)} €</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => router.push('/stores/new')} style={addBtnStyle}><Plus size={20} /> ΠΡΟΣΘΗΚΗ ΝΕΟΥ</button>
      <button onClick={handleLogout} style={logoutBtnStyle}><LogOut size={16} /> ΑΠΟΣΥΝΔΕΣΗ</button>
    </div>
  )
}

// --- STYLES (Keep existing styles from your version) ---
const containerStyle: any = { padding: '30px 20px', backgroundColor: '#f8fafc', minHeight: '100dvh' }
const liveRow: any = { marginTop: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }
const livePill: any = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '900' }
const liveDot: any = { width: '8px', height: '8px', borderRadius: '999px', backgroundColor: '#10b981' }
const liveText: any = { fontSize: '12px', fontWeight: '800', color: '#64748b' }
const heroCard: any = { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: '26px', padding: '18px', color: 'white', marginBottom: '18px' }
const heroLabel: any = { margin: 0, fontSize: '10px', fontWeight: '900', opacity: 0.75 }
const heroValue: any = { marginTop: '6px', fontSize: '26px', fontWeight: '900' }
const heroDivider: any = { height: '1px', backgroundColor: 'rgba(255,255,255,0.12)', marginTop: '12px' }
const heroRow: any = { display: 'flex', justifyContent: 'space-between', marginTop: '12px' }
const heroMiniLabel: any = { fontSize: '10px', fontWeight: '900', opacity: 0.7 }
const heroMiniValue: any = { fontSize: '14px', fontWeight: '900' }
const cardStyle: any = { backgroundColor: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0', cursor: 'pointer' }
const statsGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }
const statBox: any = { padding: '12px', backgroundColor: '#f8fafc', borderRadius: '16px' }
const statLabel: any = { fontSize: '10px', fontWeight: '800', color:'#64748b' }
const statValue: any = { fontSize: '15px', fontWeight: '900', color: '#1e293b' }
const profitRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed #e2e8f0' }
const arrowCircle: any = { width: '32px', height: '32px', backgroundColor: '#0f172a', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const lastUpdatedStyle: any = { margin: '6px 0 0', fontSize: '11px', fontWeight: 800, color: '#64748b' }
const addBtnStyle: any = { width: '100%', padding: '18px', border: '2px dashed #cbd5e1', backgroundColor: 'transparent', color: '#64748b', borderRadius: '20px', fontWeight: '800', marginTop: '20px' }
const logoutBtnStyle: any = { backgroundColor: '#fff', color: '#f43f5e', border: '1px solid #fee2e2', padding: '14px', borderRadius: '16px', fontWeight: '800', width: '100%', marginTop: '40px' }
const emptyStateStyle: any = { textAlign: 'center', padding: '50px 20px', backgroundColor: 'white', borderRadius: '24px' }
const retryBtnStyle: any = { marginTop: '14px', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', cursor: 'pointer' }

export default SelectStorePage;
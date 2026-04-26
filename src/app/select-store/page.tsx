'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Plus, ArrowRight, RefreshCw, Store as StoreIcon, ArrowLeftRight } from 'lucide-react'
import { toast, Toaster } from 'sonner'

import { getSupabase } from '@/lib/supabase'
import { fetchStoresForUser, type StoreCard } from '@/lib/stores'
import { formatDateDMY } from '@/lib/formatters'
import TransferFundsModal from '@/components/TransferFundsModal'

function SelectStorePage() {
  const supabase = getSupabase()

  const [userStores, setUserStores] = useState<StoreCard[]>([])
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferLoading, setTransferLoading] = useState(false)

  const [loading, setLoading] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)
  const [showRetryButton, setShowRetryButton] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  const router = useRouter()

  const [liveDateTime, setLiveDateTime] = useState<string>('')

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch {}
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
    const datePart = formatDateDMY(now)
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

  // Refactored: fetchStores function for refresh
  const fetchStores = async () => {
    try {
      setLoading(true)
      setShowRetryButton(false)
      setIsRetrying(false)

      // 1) Session (με retry για mobile browsers)
      let { data: s1 } = await supabase.auth.getSession()
      let session = s1.session

      if (!session) {
        setIsRetrying(true)
        await new Promise((r) => setTimeout(r, 900))
        const s2 = await supabase.auth.getSession()
        session = s2.data.session
      }

      if (!session) {
        // extra nudge
        await supabase.auth.getUser()
        const s3 = await supabase.auth.getSession()
        session = s3.data.session
      }

      if (!session) {
        toast.error('Δεν βρέθηκε ενεργή σύνδεση. Επιστροφή στο Login.')
        router.replace('/login')
        return
      }

      if (!session?.user?.id) {
        toast.error('Δεν βρέθηκε ενεργός χρήστης. Επιστροφή στο Login.')
        router.replace('/login')
        return
      }

      // 2) Φέρνουμε stores (με retry για RLS/replication delay)
      let stores = await fetchStoresForUser(session.user.id)

      // Αν δεν βρει τίποτα, κάνουμε ένα μικρό retry μετά από λίγο
      if (!stores || stores.length === 0) {
        setIsRetrying(true)
        await new Promise((r) => setTimeout(r, 1200))
        stores = await fetchStoresForUser(session.user.id)
      }

      setUserStores(stores || [])
      setIsRetrying(false)
      setShowRetryButton(false)

    } catch (err: any) {
      console.error('Fetch error:', err)
      toast.error('Πρόβλημα σύνδεσης με τη βάση δεδομένων')
      setShowRetryButton(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchStores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, retryNonce, supabase])

  // Μεταφορά Κεφαλαίου
  const handleTransferFunds = async (
    fromId: string,
    toId: string,
    amount: number,
    description: string,
    onRefresh?: () => Promise<void>
  ) => {
    setTransferLoading(true)
    try {
      const { error } = await supabase.rpc('transfer_funds', {
        p_from_store_id: fromId,
        p_to_store_id: toId,
        p_amount: amount,
        p_description: description || 'Μεταφορά Κεφαλαίου',
      })
      if (error) {
        toast.error('Αποτυχία μεταφοράς: ' + (error.message || 'Άγνωστο σφάλμα'))
        return
      }
      toast.success('Η μεταφορά ολοκληρώθηκε!')
      setShowTransferModal(false)
      if (onRefresh) await onRefresh()
    } catch (err: any) {
      toast.error('Αποτυχία μεταφοράς: ' + (err?.message || 'Άγνωστο σφάλμα'))
    } finally {
      setTransferLoading(false)
    }
  }

  const globalStats = useMemo(() => {
    const safe = Array.isArray(userStores) ? userStores : []
    const income = safe.reduce((acc, s) => acc + (Number(s?.income) || 0), 0)
    const expenses = safe.reduce((acc, s) => acc + (Number(s?.expenses) || 0), 0)
    return { income, expenses, profit: income + expenses }
  }, [userStores])

  if (loading) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60vh',
            gap: '15px',
          }}
        >
          <RefreshCw className="animate-spin" size={32} color="#6366f1" />
          <p style={{ fontWeight: '800', color: '#0f172a', fontSize: '18px' }}>
            {isRetrying ? 'Συγχρονισμός πρόσβασης...' : 'Φόρτωση δεδομένων...'}
          </p>
          <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
            Παρακαλώ περιμένετε, ελέγχουμε τα δικαιώματα πρόσβασής σας.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <Toaster richColors position="top-center" />

      <header style={{ marginBottom: '18px', textAlign: 'center' }}>
        <h1 style={{ fontWeight: '900', fontSize: '28px', color: '#0f172a', margin: 0 }}>Τα Καταστήματά μου</h1>
        <div style={liveRow}>
          <span style={livePill}>
            <span style={liveDot} />
            LIVE
          </span>
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
          <StoreIcon size={40} color="#cbd5e1" style={{ margin: '0 auto 15px' }} />
          <p style={{ fontWeight: '700', color: '#64748b', fontSize: '18px' }}>Δεν βρέθηκαν καταστήματα.</p>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '5px' }}>
            Δεν βρέθηκε σύνδεση του λογαριασμού σας με κάποιο κατάστημα.
          </p>

          <button onClick={() => setRetryNonce((n) => n + 1)} style={retryBtnStyle}>
            ΑΝΑΝΕΩΣΗ ΠΡΟΣΒΑΣΗΣ
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {userStores.map((store) => (
            <div key={store.id} onClick={() => handleSelect(store.id)} style={cardStyle} className="store-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{store.name}</h2>
                  <p style={lastUpdatedStyle}>Ενημέρωση: {formatRelativeMinutes(store.lastUpdated)}</p>
                </div>
                <div style={arrowCircle}>
                  <ArrowRight size={16} />
                </div>
              </div>

              <div style={statsGrid}>
                <div style={statBox}>
                  <span style={statLabel}>ΕΣΟΔΑ</span>
                  <br />
                  <span style={{ ...statValue, color: '#059669' }}>{(Number(store.income) || 0).toFixed(2)} €</span>
                </div>
                <div style={statBox}>
                  <span style={statLabel}>ΕΞΟΔΑ</span>
                  <br />
                  <span style={{ ...statValue, color: '#dc2626' }}>{(Number(store.expenses) || 0).toFixed(2)} €</span>
                </div>
              </div>

              <div style={profitRow}>
                <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '14px' }}>ΚΑΘΑΡΟ ΚΕΡΔΟΣ</span>
                <span
                  style={{
                    fontWeight: '900',
                    fontSize: '18px',
                    color: (Number(store.profit) || 0) >= 0 ? '#0f172a' : '#dc2626',
                  }}
                >
                  {(Number(store.profit) || 0).toFixed(2)} €
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showRetryButton && (
        <button onClick={() => setRetryNonce((n) => n + 1)} style={retryBtnStyle}>
          ΑΝΑΝΕΩΣΗ
        </button>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          onClick={() => setShowTransferModal(true)}
          style={{
            ...addBtnStyle,
            width: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed #334155',
            background: '#1e293b',
            color: '#f1f5f9',
            fontWeight: 800,
            fontSize: 16,
            gap: 8,
          }}
        >
          <ArrowLeftRight size={20} /> Μεταφορά Κεφαλαίου
        </button>

        <button onClick={() => router.push('/stores/new')} style={{ ...addBtnStyle, width: '50%' }}>
          <Plus size={20} /> Προσθήκη Νέου Καταστήματος
        </button>
      </div>

      <TransferFundsModal
        open={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        stores={userStores.map((s) => ({ id: s.id, name: s.name }))}
        onTransfer={async (fromId, toId, amount, description) =>
          handleTransferFunds(fromId, toId, amount, description, fetchStores)
        }
        loading={transferLoading}
        onRefresh={fetchStores}
      />

      <button onClick={handleLogout} style={logoutBtnStyle}>
        <LogOut size={16} /> ΑΠΟΣΥΝΔΕΣΗ ΧΡΗΣΤΗ
      </button>
    </div>
  )
}

// --- STYLES ---
const containerStyle: any = { padding: '30px 20px', backgroundColor: '#f8fafc', minHeight: '100dvh' }
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
}
const liveDot: any = { width: '8px', height: '8px', borderRadius: '999px', backgroundColor: '#10b981' }
const liveText: any = { fontSize: '12px', fontWeight: '800', color: '#64748b' }
const heroCard: any = {
  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
  borderRadius: '26px',
  padding: '18px',
  color: 'white',
  marginBottom: '18px',
  boxShadow: '0 8px 20px rgba(15, 23, 42, 0.15)',
}
const heroLabel: any = { margin: 0, fontSize: '10px', fontWeight: '900', opacity: 0.75 }
const heroValue: any = { marginTop: '6px', fontSize: '26px', fontWeight: '900' }
const heroDivider: any = { height: '1px', backgroundColor: 'rgba(255,255,255,0.12)', marginTop: '12px' }
const heroRow: any = { display: 'flex', justifyContent: 'space-between', marginTop: '12px' }
const heroMiniLabel: any = { fontSize: '10px', fontWeight: '900', opacity: 0.7 }
const heroMiniValue: any = { fontSize: '14px', fontWeight: '900' }
const cardStyle: any = {
  backgroundColor: 'white',
  padding: '24px',
  borderRadius: '24px',
  border: '1px solid #e2e8f0',
  cursor: 'pointer',
  marginBottom: '5px',
}
const statsGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }
const statBox: any = { padding: '12px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }
const statLabel: any = { fontSize: '10px', fontWeight: '800', color: '#94a3b8' }
const statValue: any = { fontSize: '15px', fontWeight: '900' }
const profitRow: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '15px',
  paddingTop: '15px',
  borderTop: '1px dashed #e2e8f0',
}
const arrowCircle: any = {
  width: '32px',
  height: '32px',
  backgroundColor: '#0f172a',
  color: 'white',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
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
}
const logoutBtnStyle: any = {
  backgroundColor: '#fff',
  color: '#f43f5e',
  border: '1px solid #fee2e2',
  padding: '14px',
  borderRadius: '16px',
  fontWeight: '800',
  width: '100%',
  marginTop: '40px',
  cursor: 'pointer',
}
const emptyStateStyle: any = {
  textAlign: 'center',
  padding: '50px 20px',
  backgroundColor: 'white',
  borderRadius: '24px',
  border: '1px solid #e2e8f0',
}
const retryBtnStyle: any = {
  marginTop: '18px',
  padding: '12px 20px',
  borderRadius: '14px',
  border: '1px solid #0f172a',
  backgroundColor: '#0f172a',
  color: '#fff',
  fontWeight: '800',
  fontSize: '13px',
  cursor: 'pointer',
}

export default SelectStorePage
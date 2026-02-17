'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, parseISO, startOfYear, endOfYear } from 'date-fns'
import { toast, Toaster } from 'sonner'

// --- MODERN PREMIUM PALETTE ---
const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  success: '#10b981',
  danger: '#f43f5e',
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  indigo: '#6366f1'
}

function AnalysisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store') // ✅ SaaS context from URL

  const [transactions, setTransactions] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'income' | 'expenses'>('expenses')

  const [selectedFilter, setSelectedFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'))

  // ✅ SaaS guard (very beginning)
  useEffect(() => {
    if (!storeId || storeId === 'null') {
      router.replace('/select-store')
    }
  }, [storeId, router])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      if (!storeId || storeId === 'null') {
        setLoading(false)
        return
      }

      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (!session) return router.push('/login')

      const transactionsQuery = supabase
        .from('transactions')
        .select('*, suppliers(name), fixed_assets(name)')
        .eq('store_id', storeId)
        .order('date', { ascending: false })

      const suppliersQuery = supabase
        .from('suppliers')
        .select('id, name')
        .eq('store_id', storeId)
        .order('name')

      const assetsQuery = supabase
        .from('fixed_assets')
        .select('id, name')
        .eq('store_id', storeId)
        .order('name')

      const [transRes, supsRes, assetsRes] = await Promise.all([transactionsQuery, suppliersQuery, assetsQuery])

      if (transRes.data) setTransactions(transRes.data)
      if (supsRes.data) setSuppliers(supsRes.data)
      if (assetsRes.data) setFixedAssets(assetsRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [router, storeId])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleDelete(id: string) {
    if (!confirm('Οριστική διαγραφή αυτής της κίνησης;')) return
    try {
      if (!storeId || storeId === 'null') {
        router.replace('/select-store')
        return
      }

      const { error } = await supabase.from('transactions').delete().eq('id', id).eq('store_id', storeId)
      if (error) throw error

      toast.success('Η κίνηση διαγράφηκε')
      loadData()
    } catch (err) {
      toast.error('Σφάλμα κατά τη διαγραφή')
    }
  }

  async function handleViewImage(fullUrl: string) {
    try {
      const urlParts = fullUrl.split('/storage/v1/object/public/invoices/')
      const filePath = urlParts[1]
      const { data } = await supabase.storage.from('invoices').createSignedUrl(filePath, 60)
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } catch (err) {
      toast.error('Σφάλμα προβολής')
    }
  }

  const stats = useMemo(() => {
    if (!storeId || storeId === 'null') {
      return {
        currentTotal: 0,
        allIncome: 0,
        allExpenses: 0,
        netResult: 0,
        profitMargin: 0,
        finalDisplayData: [] as any[]
      }
    }

    // 🔒 δεδομένα είναι ήδη ανά store από το loadData, αλλά κρατάμε safety filter
    let currentData = transactions
      .filter((t) => t.store_id === storeId)
      .filter((t) => t.date >= startDate && t.date <= endDate)

    if (selectedFilter !== 'all') {
      currentData = currentData.filter((t) => t.supplier_id === selectedFilter || t.fixed_asset_id === selectedFilter)
    }

    const allIncome = currentData.filter((t) => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0)

    const allExpenses = currentData
      .filter((t) => t.type === 'expense' || t.category === 'pocket' || t.type === 'debt_payment')
      .reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0)

    const netResult = allIncome - allExpenses
    const profitMargin = allIncome > 0 ? (netResult / allIncome) * 100 : 0

    const finalDisplayData = currentData.filter((t) =>
      view === 'income' ? t.type === 'income' : t.type === 'expense' || t.category === 'pocket' || t.type === 'debt_payment'
    )

    return {
      currentTotal: view === 'income' ? allIncome : allExpenses,
      allIncome,
      allExpenses,
      netResult,
      profitMargin,
      finalDisplayData
    }
  }, [transactions, startDate, endDate, view, selectedFilter, storeId])

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: ${colors.background}; }
        .row-item { transition: all 0.2s ease; }
        .row-item:active { transform: scale(0.98); }
      `
        }}
      />

      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '120px' }}>
        {/* HEADER */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>📊</div>
            <div>
              <h1 style={titleStyle}>Ανάλυση</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <p style={subLabelStyle}>ΔΙΑΧΕΙΡΙΣΗ ΚΙΝΗΣΕΩΝ</p>
                <div style={statusDot} />
              </div>
            </div>
          </div>

          {/* ✅ Back preserves store context */}
          <Link href={`/?store=${storeId}`} style={backBtnStyle}>
            ✕
          </Link>
        </div>

        {/* FILTERS CARD */}
        <div style={filterCard}>
          <label style={dateLabel}>ΦΙΛΤΡΟ ΣΥΝΕΡΓΑΤΗ / ΠΑΓΙΟΥ</label>
          <select value={selectedFilter} onChange={(e) => setSelectedFilter(e.target.value)} style={selectInputStyle}>
            <option value="all">🔍 ΟΛΑ ΤΑ ΔΕΔΟΜΕΝΑ</option>
            <optgroup label="ΠΡΟΜΗΘΕΥΤΕΣ">
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {String(s.name || '').toUpperCase()}
                </option>
              ))}
            </optgroup>
            <optgroup label="ΠΑΓΙΑ">
              {fixedAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {String(a.name || '').toUpperCase()}
                </option>
              ))}
            </optgroup>
          </select>

          <div style={tabContainer}>
            <button
              onClick={() => setView('income')}
              style={{
                ...tabBtn,
                backgroundColor: view === 'income' ? colors.success : 'transparent',
                color: view === 'income' ? 'white' : colors.secondary
              }}
            >
              ΕΣΟΔΑ
            </button>
            <button
              onClick={() => setView('expenses')}
              style={{
                ...tabBtn,
                backgroundColor: view === 'expenses' ? colors.danger : 'transparent',
                color: view === 'expenses' ? 'white' : colors.secondary
              }}
            >
              ΕΞΟΔΑ
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={dateLabel}>ΑΠΟ</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={dateInput} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={dateLabel}>ΕΩΣ</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={dateInput} />
            </div>
          </div>
        </div>

        {/* HERO STATS */}
        <div
          style={{
            ...heroCard,
            background:
              view === 'income'
                ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                : 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)',
            padding: '25px 20px'
          }}
        >
          <p style={labelMicro}>ΣΥΝΟΛΟ ΠΕΡΙΟΔΟΥ</p>
          <h2 style={heroAmount}>{stats.currentTotal.toLocaleString('el-GR')}€</h2>

          <div style={{ ...heroDivider, margin: '15px 0' }} />

          {/* ΣΥΓΚΡΙΣΗ ΕΣΟΔΑ VS ΕΞΟΔΑ ΜΕΣΑ ΣΤΟ CARD */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '9px', fontWeight: '800', opacity: 0.6, margin: 0, letterSpacing: '0.5px' }}>ΕΣΟΔΑ</p>
              <p style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: '#10b981' }}>
                {stats.allIncome.toLocaleString('el-GR')}€
              </p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '9px', fontWeight: '800', opacity: 0.6, margin: 0, letterSpacing: '0.5px' }}>ΚΕΡΔΟΣ %</p>
              <p style={{ fontSize: '15px', fontWeight: '800', margin: 0 }}>{stats.profitMargin.toFixed(1)}%</p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '9px', fontWeight: '800', opacity: 0.6, margin: 0, letterSpacing: '0.5px' }}>ΕΞΟΔΑ</p>
              <p style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: '#f43f5e' }}>
                {stats.allExpenses.toLocaleString('el-GR')}€
              </p>
            </div>
          </div>

          {/* ΑΠΟΤΕΛΕΣΜΑ */}
          <div
            style={{
              marginTop: '15px',
              padding: '8px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '800'
            }}
          >
            ΑΠΟΤΕΛΕΣΜΑ:{' '}
            <span style={{ color: stats.netResult >= 0 ? '#10b981' : '#f87171' }}>
              {stats.netResult >= 0 ? '+' : ''}
              {stats.netResult.toLocaleString('el-GR')}€
            </span>
          </div>

          <p style={{ margin: '10px 0 0 0', fontSize: '10px', fontWeight: 700, opacity: 0.7 }}>
            {stats.finalDisplayData.length} Κινήσεις βρέθηκαν
          </p>
        </div>

        {/* TRANSACTIONS LIST */}
        <div style={{ marginTop: '20px' }}>
          <p style={listHeaderTitle}>Κινήσεις στη λίστα</p>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Φόρτωση...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.finalDisplayData.map((item: any) => (
                <div key={item.id} style={itemCard} className="row-item">
                  <div style={{ flex: 1 }}>
                    <p style={itemTitleStyle}>
                      {item.suppliers?.name || item.fixed_assets?.name || item.notes || item.category || 'Συναλλαγή'}
                      {String(item.notes || '').toUpperCase().includes('ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ') && <span style={blackBadge}>ΜΑΥΡΑ</span>}
                    </p>

                    <div style={itemMeta}>
                      <span>📅 {format(parseISO(item.date), 'dd/MM/yyyy')}</span>
                      <span>• {item.method}</span>
                    </div>

                    <div style={actionRow}>
                      {/* ✅ Edit keeps SaaS context */}
                      <button
                        onClick={() =>
                          router.push(`/${item.type === 'income' ? 'add-income' : 'add-expense'}?editId=${item.id}&store=${storeId}`)
                        }
                        style={actionBtn}
                      >
                        ✎ Διόρθωση
                      </button>

                      <button onClick={() => handleDelete(item.id)} style={{ ...actionBtn, color: colors.danger }}>
                        🗑️ Διαγραφή
                      </button>

                      {item.image_url && (
                        <button onClick={() => handleViewImage(item.image_url)} style={{ ...actionBtn, color: colors.indigo }}>
                          🖼️ Φωτο
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <p style={{ ...amountText, color: item.type === 'income' ? colors.success : colors.danger }}>
                      {item.type === 'income' ? '+' : '-'}
                      {Math.abs(item.amount).toFixed(2)}€
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- MODERN STYLES ---
const iphoneWrapper: any = {
  backgroundColor: colors.background,
   minHeight: '100%',
  padding: '20px',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflowY: 'auto'
}
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }
const titleStyle: any = { fontWeight: '800', fontSize: '20px', margin: 0, color: colors.primary, letterSpacing: '-0.5px' }
const subLabelStyle: any = { margin: 0, fontSize: '10px', color: colors.secondary, fontWeight: '700', letterSpacing: '1px' }
const statusDot: any = { width: '6px', height: '6px', backgroundColor: colors.success, borderRadius: '50%' }
const logoBoxStyle: any = {
  width: '42px',
  height: '42px',
  backgroundColor: colors.surface,
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
  border: `1px solid ${colors.border}`
}
const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondary,
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.surface,
  borderRadius: '10px',
  border: `1px solid ${colors.border}`,
  fontWeight: 'bold'
}

const filterCard: any = {
  backgroundColor: colors.surface,
  padding: '20px',
   borderRadius: '12px',
  border: `1px solid ${colors.border}`,
  marginBottom: '20px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
}
const selectInputStyle: any = {
  width: '100%',
  padding: '14px',
   borderRadius: '12px',
  border: `1px solid ${colors.border}`,
  fontSize: '14px',
  fontWeight: '700',
  backgroundColor: colors.background,
  color: colors.primary,
  marginBottom: '20px',
  outline: 'none'
}
const dateLabel: any = { fontSize: '10px', fontWeight: '800', color: colors.secondary, marginBottom: '6px', display: 'block', letterSpacing: '0.5px' }
const dateInput: any = {
  width: '100%',
  padding: '12px',
  borderRadius: '12px',
  border: `1px solid ${colors.border}`,
  fontSize: '13px',
  fontWeight: '700',
  backgroundColor: colors.background,
  color: colors.primary
}

const tabContainer: any = { display: 'flex', backgroundColor: colors.background, borderRadius: '14px', padding: '4px', marginBottom: '20px' }
const tabBtn: any = { flex: 1, border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }

const heroCard: any = { padding: '30px 20px', borderRadius: '28px', color: 'white', textAlign: 'center', marginBottom: '30px', boxShadow: '0 15px 30px rgba(0,0,0,0.15)' }
const heroAmount: any = { fontSize: '38px', fontWeight: '800', margin: '5px 0', letterSpacing: '-1.5px' }
const labelMicro: any = { fontSize: '10px', fontWeight: '700', opacity: 0.6, letterSpacing: '1px' }
const heroDivider: any = { height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '15px 40px' }

const listHeaderTitle: any = { fontSize: '11px', fontWeight: '800', color: colors.secondary, marginBottom: '15px', letterSpacing: '1px', paddingLeft: '5px' }
const itemCard: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: colors.surface,
  padding: '18px',
  borderRadius: '20px',
  border: `1px solid ${colors.border}`,
  boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
}
const itemTitleStyle: any = { fontWeight: '700', fontSize: '15px', margin: 0, color: colors.primary }
const itemMeta: any = { fontSize: '12px', color: colors.secondary, fontWeight: '600', marginTop: '4px', display: 'flex', gap: '8px' }
const actionRow: any = { display: 'flex', gap: '15px', marginTop: '12px' }
const actionBtn: any = { background: 'none', border: 'none', padding: 0, fontSize: '11px', fontWeight: '700', color: colors.secondary, cursor: 'pointer', textDecoration: 'underline' }
const amountText: any = { fontWeight: '800', fontSize: '17px', margin: 0, letterSpacing: '-0.5px' }
const blackBadge: any = { fontSize: '9px', backgroundColor: '#fff1f2', color: colors.danger, padding: '3px 8px', borderRadius: '6px', fontWeight: '800', marginLeft: '10px' }

export default function AnalysisPage() {
  return (
    <main>
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <AnalysisContent />
      </Suspense>
    </main>
  )
}
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, parseISO, startOfYear, endOfYear } from 'date-fns'
import { el } from 'date-fns/locale'
import { toast, Toaster } from 'sonner'

function AnalysisContent() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'income' | 'expenses'>('expenses')
  
  const [selectedFilter, setSelectedFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'))

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', session.user.id).single()
      
      if (profile?.store_id) {
        const sId = profile.store_id
        const [transRes, supsRes, assetsRes] = await Promise.all([
          supabase.from('transactions').select('*, suppliers(name), fixed_assets(name)').eq('store_id', sId).order('date', { ascending: false }),
          supabase.from('suppliers').select('id, name').eq('store_id', sId).order('name'),
          supabase.from('fixed_assets').select('id, name').eq('store_id', sId).order('name')
        ])

        if (transRes.data) setTransactions(transRes.data)
        if (supsRes.data) setSuppliers(supsRes.data)
        if (assetsRes.data) setFixedAssets(assetsRes.data)
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(id: string) {
    if (!confirm('Οριστική διαγραφή αυτής της κίνησης;')) return
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
      toast.success('Η κίνηση διαγράφηκε')
      loadData()
    } catch (err) { toast.error('Σφάλμα κατά τη διαγραφή') }
  }

  async function handleViewImage(fullUrl: string) {
    try {
      const urlParts = fullUrl.split('/storage/v1/object/public/invoices/');
      const filePath = urlParts[1];
      const { data, error } = await supabase.storage.from('invoices').createSignedUrl(filePath, 60);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (err) { toast.error("Σφάλμα προβολής"); }
  }

  const stats = useMemo(() => {
    let currentData = transactions.filter(t => t.date >= startDate && t.date <= endDate)

    if (selectedFilter !== 'all') {
      currentData = currentData.filter(t => t.supplier_id === selectedFilter || t.fixed_asset_id === selectedFilter)
    }

    const incomeTransactions = currentData.filter(t => t.type === 'income')
    const incomeTotal = incomeTransactions.reduce((acc, t) => acc + Number(t.amount), 0)

    const expenseTransactions = currentData.filter(t => t.type === 'expense' || t.category === 'pocket' || t.type === 'debt_payment')
    const offTheBooksTotal = expenseTransactions.filter(t => t.notes?.toUpperCase().includes('ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ')).reduce((acc, t) => acc + Number(t.amount), 0)
    const officialTotal = expenseTransactions.filter(t => !t.notes?.toUpperCase().includes('ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ')).reduce((acc, t) => acc + Number(t.amount), 0)
    
    const finalDisplayData = currentData.filter(t => 
      view === 'income' ? t.type === 'income' : (t.type === 'expense' || t.category === 'pocket' || t.type === 'debt_payment')
    )

    return { 
        currentTotal: view === 'income' ? incomeTotal : (officialTotal + offTheBooksTotal),
        officialTotal, offTheBooksTotal, finalDisplayData
    }
  }, [transactions, startDate, endDate, view, selectedFilter])

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '120px' }}>
        
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>📊</div>
            <div>
              <h1 style={{ fontWeight: '900', fontSize: '18px', margin: 0 }}>Ανάλυση</h1>
              <p style={subLabelStyle}>ΔΙΑΧΕΙΡΙΣΗ ΚΙΝΗΣΕΩΝ</p>
            </div>
          </div>
          <Link href="/" style={backBtnStyle}>✕</Link>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={dateLabel}>ΦΙΛΤΡΟ ΣΥΝΕΡΓΑΤΗ / ΠΑΓΙΟΥ</label>
          <select value={selectedFilter} onChange={e => setSelectedFilter(e.target.value)} style={selectInputStyle}>
            <option value="all">🔍 ΟΛΑ ΤΑ ΔΕΔΟΜΕΝΑ</option>
            <optgroup label="ΠΡΟΜΗΘΕΥΤΕΣ">
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
            </optgroup>
            <optgroup label="ΠΑΓΙΑ">
              {fixedAssets.map(a => <option key={a.id} value={a.id}>{a.name.toUpperCase()}</option>)}
            </optgroup>
          </select>
        </div>

        <div style={tabContainer}>
          <button onClick={() => setView('income')} style={{...tabBtn, backgroundColor: view === 'income' ? '#10b981' : 'transparent', color: view === 'income' ? 'white' : '#64748b'}}>ΕΣΟΔΑ</button>
          <button onClick={() => setView('expenses')} style={{...tabBtn, backgroundColor: view === 'expenses' ? '#ef4444' : 'transparent', color: view === 'expenses' ? 'white' : '#64748b'}}>ΕΞΟΔΑ</button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}><label style={dateLabel}>ΑΠΟ</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={dateInput} /></div>
          <div style={{ flex: 1 }}><label style={dateLabel}>ΕΩΣ</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={dateInput} /></div>
        </div>

        <div style={{...heroCard, backgroundColor: view === 'income' ? '#0f172a' : '#450a0a'}}>
          <p style={labelMicro}>ΣΥΝΟΛΟ ΠΕΡΙΟΔΟΥ</p>
          <h2 style={{ fontSize: '38px', fontWeight: '900', margin: '5px 0' }}>{stats.currentTotal.toLocaleString('el-GR')}€</h2>
        </div>

        <div style={listWrapper}>
          <p style={listTitle}>Κινήσεις ({stats.finalDisplayData.length})</p>
          {loading ? <p style={{textAlign:'center', padding:'20px'}}>Φόρτωση...</p> : (
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  {stats.finalDisplayData.map((item: any) => (
                    <div key={item.id} style={rowStyle}>
                      <div style={{ flex: 1 }}>
                        <p style={itemTitleStyle}>
                          {item.suppliers?.name || item.fixed_assets?.name || item.notes || item.category}
                          {item.notes?.includes('ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ') && <span style={blackBadge}>ΜΑΥΡΑ</span>}
                        </p>
                        <span style={itemSubStyle}>
                          {format(parseISO(item.date), 'dd/MM/yyyy')} • {item.method}
                        </span>
                        
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                          <button onClick={() => router.push(`/${item.type === 'income' ? 'income' : 'expenses'}/add?editId=${item.id}`)} style={actionLinkStyle}>✎ Διόρθωση</button>
                          <button onClick={() => handleDelete(item.id)} style={{...actionLinkStyle, color: '#ef4444'}}>🗑️ Διαγραφή</button>
                          {item.image_url && <button onClick={() => handleViewImage(item.image_url)} style={actionLinkStyle}>🖼️ Φωτο</button>}
                        </div>
                      </div>
                      <p style={{ fontWeight: '900', fontSize: '16px', color: item.type === 'income' ? '#10b981' : '#ef4444', margin: 0 }}>
                        {item.type === 'income' ? '+' : '-'}{item.amount.toFixed(2)}€
                      </p>
                    </div>
                  ))}
              </div>
          )}
        </div>
      </div>
    </div>
  )
}

// STYLES
const iphoneWrapper: any = { backgroundColor: '#f8fafc', minHeight: '100dvh', padding: '20px', overflowY: 'auto', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, WebkitOverflowScrolling: 'touch' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const subLabelStyle = { margin: 0, fontSize: '9px', color: '#94a3b8', fontWeight: '800', letterSpacing: '1px' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold' };
const tabContainer: any = { display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '16px', padding: '4px', marginBottom: '20px' };
const tabBtn: any = { flex: 1, border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' };
const dateLabel: any = { fontSize: '9px', fontWeight: '900', color: '#94a3b8', marginBottom: '4px', display: 'block' };
const dateInput: any = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '800' };
const selectInputStyle: any = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: '800', backgroundColor: 'white', outline: 'none' };
const heroCard: any = { padding: '30px 20px', borderRadius: '30px', color: 'white', textAlign: 'center', marginBottom: '25px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' };
const labelMicro: any = { fontSize: '9px', fontWeight: '900', opacity: 0.5 };
const listWrapper: any = { backgroundColor: 'white', padding: '20px', borderRadius: '28px', border: '1px solid #f1f5f9' };
const listTitle: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '15px' };
const rowStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 0', borderBottom: '1px solid #f8fafc' };
const itemTitleStyle = { fontWeight: '800', fontSize: '14px', margin: 0, color: '#1e293b' };
const itemSubStyle = { fontSize: '11px', color: '#94a3b8', fontWeight: '700' };
const actionLinkStyle: any = { background: 'none', border: 'none', padding: 0, fontSize: '10px', fontWeight: '800', color: '#64748b', cursor: 'pointer', textDecoration: 'underline' };
const blackBadge: any = { fontSize: '8px', backgroundColor: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '6px', fontWeight: '900', marginLeft: '8px' };

export default function AnalysisPage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><AnalysisContent /></Suspense></main>
}
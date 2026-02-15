'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, parseISO, addHours, subHours } from 'date-fns'
import { el } from 'date-fns/locale'
import { toast, Toaster } from 'sonner'

function AnalysisContent() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'income' | 'expenses'>('income') 
  
  const initialDate = format(subHours(new Date(), 7), 'yyyy-MM-dd')
  const [startDate, setStartDate] = useState(initialDate)
  const [endDate, setEndDate] = useState(initialDate)

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', session.user.id).single()
      if (profile?.store_id) {
        const { data: transData } = await supabase.from('transactions')
          .select('*, suppliers(name)')
          .eq('store_id', profile.store_id)
          .order('created_at', { ascending: false })
        if (transData) setTransactions(transData)
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  // ✅ ΝΕΑ ΣΥΝΑΡΤΗΣΗ ΓΙΑ ΑΣΦΑΛΗ ΠΡΟΒΟΛΗ ΦΩΤΟΓΡΑΦΙΑΣ
  async function handleViewImage(fullUrl: string) {
    try {
      // Εξάγουμε το σχετικό path (π.χ. "store_id/filename.jpg") από το πλήρες URL
      const urlParts = fullUrl.split('/storage/v1/object/public/invoices/');
      const filePath = urlParts[1];

      if (!filePath) {
        return toast.error("Δεν βρέθηκε η διαδρομή του αρχείου");
      }

      // Ζητάμε Signed URL από το Supabase
      const { data, error } = await supabase.storage
        .from('invoices')
        .createSignedUrl(filePath, 60);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      toast.error("Σφάλμα πρόσβασης στο τιμολόγιο");
      console.error(err);
    }
  }

  const stats = useMemo(() => {
    const startLimit = `${startDate}T07:00:00`
    const nextDay = format(addHours(parseISO(endDate), 24), 'yyyy-MM-dd')
    const endLimit = `${nextDay}T06:59:59`

    const currentData = transactions.filter(t => {
      const targetDate = t.created_at || t.date
      return targetDate >= startLimit && targetDate <= endLimit
    })

    const incomeTransactions = currentData.filter(t => t.type === 'income')
    const incomeTotal = incomeTransactions.reduce((acc, t) => acc + Number(t.amount), 0)

    const expenseTransactions = currentData.filter(t => t.type === 'expense' || t.category === 'pocket')
    const offTheBooksTotal = expenseTransactions.filter(t => t.notes?.toUpperCase().includes('ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ')).reduce((acc, t) => acc + Number(t.amount), 0)
    const officialTotal = expenseTransactions.filter(t => !t.notes?.toUpperCase().includes('ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ')).reduce((acc, t) => acc + Number(t.amount), 0)
    
    const zGroups: any = {}
    const listData: any[] = []

    currentData.forEach(t => {
        if (view === 'income' && t.type === 'income') {
            if (t.category === 'Εσοδα Ζ') {
                if (!zGroups[t.date]) zGroups[t.date] = { id: 'z-'+t.date, isZ: true, date: t.date, amount: 0, details: [] }
                zGroups[t.date].amount += Number(t.amount)
                zGroups[t.date].details.push(t)
            } else { listData.push(t) }
        } else if (view === 'expenses' && (t.type === 'expense' || t.category === 'pocket')) {
            listData.push(t)
        }
    })

    const finalDisplayData = [...listData, ...Object.values(zGroups)].sort((a,b) => (b.created_at || b.date).localeCompare(a.created_at || a.date))

    return { 
        currentTotal: view === 'income' ? incomeTotal : (officialTotal + offTheBooksTotal),
        officialTotal, offTheBooksTotal, finalDisplayData,
        incomeCash: incomeTransactions.filter(t => t.method?.includes('Μετρητά')).reduce((acc, t) => acc + Number(t.amount), 0),
        incomeCard: incomeTransactions.filter(t => t.method?.includes('Κάρτα') || t.method?.includes('POS')).reduce((acc, t) => acc + Number(t.amount), 0)
    }
  }, [transactions, startDate, endDate, view])

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', paddingBottom: '100px' }}>
      <Toaster position="top-center" richColors />
      
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>📊</div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '18px', margin: 0 }}>Ανάλυση</h1>
            <p style={{ margin: 0, fontSize: '9px', color: '#94a3b8', fontWeight: '800' }}>ΒΑΡΔΙΑ: 07:00 - 06:59</p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
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
        {view === 'expenses' && (
          <div style={percGrid}>
            <div style={percBox}><span style={percLabel}>ΜΕ ΤΙΜΟΛΟΓΙΟ</span><span style={percValue}>{stats.officialTotal.toFixed(0)}€</span></div>
            <div style={percBox}><span style={{...percLabel, color:'#fca5a5'}}>ΜΑΥΡΑ</span><span style={{...percValue, color:'#fca5a5'}}>{stats.offTheBooksTotal.toFixed(0)}€</span></div>
          </div>
        )}
      </div>

      <div style={listWrapper}>
        <p style={listTitle}>Κινήσεις</p>
        {loading ? <p style={{textAlign:'center', padding:'20px'}}>Φόρτωση...</p> : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                {stats.finalDisplayData.map((item: any) => (
                  <div key={item.id} style={item.isZ ? zRowStyle : rowStyle}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '800', fontSize: '14px', margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.isZ ? '📟 ΚΛΕΙΣΙΜΟ Ζ' : (item.suppliers?.name || item.notes || item.category)}
                        {item.notes?.includes('ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ') && <span style={blackBadge}>ΜΑΥΡΑ</span>}
                        
                        {/* ✅ ΕΝΗΜΕΡΩΜΕΝΟ ΚΟΥΜΠΙ ΠΡΟΒΟΛΗΣ */}
                        {item.image_url && (
                          <button 
                            onClick={() => handleViewImage(item.image_url)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '16px' }}
                            title="Προβολή Τιμολογίου"
                          >
                            🖼️
                          </button>
                        )}
                      </p>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>
                        {format(parseISO(item.date), 'dd MMM', { locale: el })} {item.isZ ? '' : `• ${item.method}`}
                      </span>
                    </div>
                    <p style={{ fontWeight: '900', fontSize: '16px', color: view === 'income' ? '#10b981' : '#ef4444', margin: 0 }}>
                      {view === 'income' ? '+' : '-'}{item.amount.toFixed(2)}€
                    </p>
                  </div>
                ))}
            </div>
        )}
      </div>
    </div>
  )
}

// STYLES
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold' };
const tabContainer: any = { display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '16px', padding: '4px', marginBottom: '20px' };
const tabBtn: any = { flex: 1, border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '900', fontSize: '12px' };
const dateLabel: any = { fontSize: '9px', fontWeight: '900', color: '#94a3b8', marginBottom: '4px', display: 'block' };
const dateInput: any = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '800' };
const heroCard: any = { padding: '30px 20px', borderRadius: '30px', color: 'white', textAlign: 'center', marginBottom: '25px' };
const labelMicro: any = { fontSize: '9px', fontWeight: '900', opacity: 0.5 };
const percGrid: any = { display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' };
const percBox: any = { display: 'flex', flexDirection: 'column' };
const percLabel: any = { fontSize: '7px', fontWeight: '900', opacity: 0.6 };
const percValue: any = { fontSize: '12px', fontWeight: '900' };
const listWrapper: any = { backgroundColor: 'white', padding: '22px', borderRadius: '28px', border: '1px solid #f1f5f9' };
const listTitle: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '15px' };
const rowStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f8fafc' };
const zRowStyle: any = { ...rowStyle, backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '15px', margin: '6px 0', borderBottom: 'none' };
const blackBadge: any = { fontSize: '8px', backgroundColor: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '6px', fontWeight: '900' };

export default function AnalysisPage() {
  return <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}><Suspense fallback={<div>Φόρτωση...</div>}><AnalysisContent /></Suspense></main>
}
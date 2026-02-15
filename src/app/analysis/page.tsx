'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, parseISO, addHours, subHours } from 'date-fns'
import { el } from 'date-fns/locale'

function AnalysisContent() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'income' | 'expenses'>('income') 
  
  // Προεπιλογή: Σήμερα (αλλά με βάση τη λογική των 7 π.μ.)
  // Αν είναι 03:00 π.μ., το subHours(7) θα μας δείξει την προηγούμενη ημερολογιακή μέρα
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

  const stats = useMemo(() => {
    // ΟΡΙΣΜΟΣ ΟΡΙΩΝ: Από τις 07:00 της startDate έως τις 06:59 της επομένης από την endDate
    const startLimit = `${startDate}T07:00:00`
    const nextDay = format(addHours(parseISO(endDate), 24), 'yyyy-MM-dd')
    const endLimit = `${nextDay}T06:59:59`

    const currentData = transactions.filter(t => {
      const targetDate = t.created_at || t.date // Χρησιμοποιούμε created_at για ακρίβεια ώρας
      return targetDate >= startLimit && targetDate <= endLimit
    })

    const incomeTransactions = currentData.filter(t => t.type === 'income')
    const incomeTotal = incomeTransactions.reduce((acc, t) => acc + Number(t.amount), 0)
    const expenseTotal = currentData.filter(t => t.type === 'expense' && t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0)
    
    const zGroups: any = {}
    const listData: any[] = []

    currentData.forEach(t => {
        if (view === 'income' && t.type === 'income') {
            if (t.category === 'Εσοδα Ζ') {
                // Ομαδοποίηση ανά ημερομηνία βάρδιας (date)
                if (!zGroups[t.date]) zGroups[t.date] = { id: 'z-'+t.date, isZ: true, date: t.date, amount: 0, details: [] }
                zGroups[t.date].amount += Number(t.amount)
                zGroups[t.date].details.push(t)
            } else { listData.push(t) }
        } else if (view === 'expenses' && (t.type === 'expense' || t.category === 'pocket')) {
            listData.push(t)
        }
    })

    const finalDisplayData = [...listData, ...Object.values(zGroups)].sort((a,b) => {
      const dateA = a.created_at || a.date
      const dateB = b.created_at || b.date
      return dateB.localeCompare(dateA)
    })

    return { 
        currentTotal: view === 'income' ? incomeTotal : expenseTotal,
        finalDisplayData,
        incomeCash: incomeTransactions.filter(t => t.method?.includes('Μετρητά')).reduce((acc, t) => acc + Number(t.amount), 0),
        incomeCard: incomeTransactions.filter(t => t.method?.includes('Κάρτα') || t.method?.includes('POS')).reduce((acc, t) => acc + Number(t.amount), 0)
    }
  }, [transactions, startDate, endDate, view])

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', paddingBottom: '100px' }}>
      
      {/* HEADER */}
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

      {/* VIEW SELECTOR */}
      <div style={tabContainer}>
        <button onClick={() => setView('income')} style={{...tabBtn, backgroundColor: view === 'income' ? '#10b981' : 'transparent', color: view === 'income' ? 'white' : '#64748b'}}>ΕΣΟΔΑ</button>
        <button onClick={() => setView('expenses')} style={{...tabBtn, backgroundColor: view === 'expenses' ? '#ef4444' : 'transparent', color: view === 'expenses' ? 'white' : '#64748b'}}>ΕΞΟΔΑ</button>
      </div>

      {/* ΔΙΠΛΟ ΗΜΕΡΟΛΟΓΙΟ */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <label style={dateLabel}>ΑΠΟ (ΒΑΡΔΙΑ)</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={dateInput} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={dateLabel}>ΕΩΣ (ΒΑΡΔΙΑ)</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={dateInput} />
        </div>
      </div>

      {/* HERO CARD */}
      <div style={{...heroCard, backgroundColor: view === 'income' ? '#0f172a' : '#450a0a'}}>
        <p style={labelMicro}>ΤΖΙΡΟΣ ΕΠΙΛΕΓΜΕΝΩΝ ΒΑΡΔΙΩΝ</p>
        <h2 style={{ fontSize: '38px', fontWeight: '900', margin: '5px 0' }}>{stats.currentTotal.toLocaleString('el-GR')}€</h2>
        {view === 'income' && stats.currentTotal > 0 && (
            <div style={percGrid}>
                <div style={percBox}><span style={percLabel}>ΜΕΤΡΗΤΑ</span><span style={percValue}>{stats.incomeCash.toFixed(0)}€</span></div>
                <div style={percBox}><span style={percLabel}>ΚΑΡΤΑ/POS</span><span style={percValue}>{stats.incomeCard.toFixed(0)}€</span></div>
            </div>
        )}
      </div>

      {/* LIST */}
      <div style={listWrapper}>
        <p style={listTitle}>Κινήσεις Βάρδιας</p>
        {loading ? <p style={{textAlign:'center', padding:'20px'}}>Φόρτωση...</p> : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                {stats.finalDisplayData.map((item: any) => (
                  <div key={item.id} style={item.isZ ? zRowStyle : rowStyle}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '800', fontSize: '14px', margin: 0, color: '#1e293b' }}>
                        {item.isZ ? '📟 ΚΛΕΙΣΙΜΟ Ζ (ΟΜΑΔΟΠΟΙΗΜΕΝΟ)' : (item.suppliers?.name || item.notes || item.category)}
                      </p>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>
                        {format(parseISO(item.date), 'dd MMM', { locale: el })} {item.isZ ? '' : `• ${item.method}`}
                      </span>
                      {item.isZ && (
                        <div style={{fontSize: '10px', color: '#64748b', marginTop: '4px', fontWeight: '700'}}>
                           {item.details.map((d:any) => `${d.method.replace(' (Ζ)','')}: ${d.amount}€`).join(' | ')}
                        </div>
                      )}
                    </div>
                    <p style={{ fontWeight: '900', fontSize: '16px', color: view === 'income' ? '#10b981' : '#ef4444', margin: 0 }}>
                      {view === 'income' ? '+' : '-'}{item.amount.toFixed(2)}€
                    </p>
                  </div>
                ))}
                {stats.finalDisplayData.length === 0 && <p style={{textAlign:'center', padding:'30px', color:'#94a3b8'}}>Δεν βρέθηκαν κινήσεις.</p>}
            </div>
        )}
      </div>
    </div>
  )
}

// STYLES (Παραμένουν ίδια)
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '10px' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold' };
const tabContainer: any = { display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '16px', padding: '4px', marginBottom: '20px' };
const tabBtn: any = { flex: 1, border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' };
const dateLabel: any = { fontSize: '9px', fontWeight: '900', color: '#94a3b8', paddingLeft: '5px', marginBottom: '4px', display: 'block' };
const dateInput: any = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '800' };
const heroCard: any = { padding: '30px 20px', borderRadius: '30px', color: 'white', textAlign: 'center', marginBottom: '25px' };
const labelMicro: any = { fontSize: '9px', fontWeight: '900', opacity: 0.5, letterSpacing: '1px' };
const percGrid: any = { display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' };
const percBox: any = { display: 'flex', flexDirection: 'column', gap: '2px' };
const percLabel: any = { fontSize: '7px', fontWeight: '900', opacity: 0.6 };
const percValue: any = { fontSize: '12px', fontWeight: '900' };
const listWrapper: any = { backgroundColor: 'white', padding: '22px', borderRadius: '28px', border: '1px solid #f1f5f9' };
const listTitle: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '15px', textTransform: 'uppercase' };
const rowStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f8fafc' };
const zRowStyle: any = { ...rowStyle, backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '15px', margin: '6px 0', borderBottom: 'none' };

export default function AnalysisPage() {
  return <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}><Suspense fallback={<div>Φόρτωση...</div>}><AnalysisContent /></Suspense></main>
}
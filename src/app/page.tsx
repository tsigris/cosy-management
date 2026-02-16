'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NextLink from 'next/link'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { el } from 'date-fns/locale'
import { Toaster, toast } from 'sonner'

// --- MODERN PREMIUM PALETTE ---
const colors = {
  primaryDark: '#0f172a', 
  secondaryText: '#64748b', 
  accentRed: '#f43f5e',   
  accentBlue: '#6366f1',  
  accentGreen: '#10b981',
  bgLight: '#f8fafc',     
  border: '#e2e8f0',      
  white: '#ffffff',
  warning: '#fffbeb',
  warningText: '#92400e'
};

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // 1. ΛΗΨΗ ID ΑΠΟ URL (Query Param)
  const storeIdFromUrl = searchParams.get('store')
  
  const getBusinessDate = () => {
    const now = new Date()
    if (now.getHours() < 7) now.setDate(now.getDate() - 1)
    return format(now, 'yyyy-MM-dd')
  }

  const selectedDate = searchParams.get('date') || getBusinessDate()
  
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [storeName, setStoreName] = useState('Φορτώνει...')
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTx, setExpandedTx] = useState<string | null>(null) 

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      // 2. ΠΡΟΤΕΡΑΙΟΤΗΤΑ ΣΤΟ URL ID, ΜΕΤΑ ΣΤΟ LOCALSTORAGE
      const activeStoreId = storeIdFromUrl || localStorage.getItem('active_store_id');
      
      if (!activeStoreId || activeStoreId === 'undefined') {
        router.push('/select-store');
        return;
      }

      // Συγχρονισμός αν το βρήκαμε μόνο στο URL
      if (storeIdFromUrl && localStorage.getItem('active_store_id') !== storeIdFromUrl) {
        localStorage.setItem('active_store_id', storeIdFromUrl);
      }

      // Λήψη προφίλ για έλεγχο admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        setIsAdmin(profile.role === 'admin' || profile.role === 'superadmin');

        // Λήψη ονόματος καταστήματος
        const { data: storeData } = await supabase
          .from('stores')
          .select('name')
          .eq('id', activeStoreId)
          .single();
        
        setStoreName(storeData?.name || 'Κατάστημα');

        // Φόρτωση κινήσεων
        const { data: tx, error: txError } = await supabase
          .from('transactions')
          .select('*, suppliers(name), fixed_assets(name)')
          .eq('store_id', activeStoreId)
          .eq('date', selectedDate)
          .order('created_at', { ascending: false });

        if (txError) throw txError;
        setTransactions(tx || []);
      }
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, router, storeIdFromUrl]);

  useEffect(() => { loadDashboard() }, [loadDashboard])

  const handleDelete = async (id: string) => {
    if (!confirm('Οριστική διαγραφή αυτής της κίνησης;')) return
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
      setTransactions(prev => prev.filter(t => t.id !== id))
      setExpandedTx(null)
      toast.success('Η κίνηση διαγράφηκε');
    } catch (err) {
      toast.error('Σφάλμα κατά τη διαγραφή');
    }
  }

  const totals = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0)
    const expense = transactions.filter(t => (t.type === 'expense' || t.category === 'Προσωπικό' || t.category === 'Εξόφληση Χρέους') && t.is_credit !== true).reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0)
    return { income, expense, balance: income - expense }
  }, [transactions])

  const changeDate = (days: number) => {
    const current = parseISO(selectedDate)
    const next = days > 0 ? addDays(current, 1) : subDays(current, 1)
    // ΔΙΑΤΗΡΗΣΗ ΤΟΥ STORE ID ΣΤΟ URL ΚΑΤΑ ΤΗΝ ΑΛΛΑΓΗ ΗΜΕΡΟΜΗΝΙΑΣ
    router.push(`/?date=${format(next, 'yyyy-MM-dd')}&store=${storeIdFromUrl || ''}`)
    setExpandedTx(null)
  }

  const handleSwitchStore = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('/select-store');
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: ${colors.bgLight}; margin: 0; }
      `}} />

      <header style={headerStyle}>
        <div style={brandArea}>
          <div style={logoBox}>C</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={storeTitleText}>{storeName.toUpperCase()}</h1>
                <button onClick={handleSwitchStore} style={switchBtnStyle}>ΑΛΛΑΓΗ</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={dashboardSub}>BUSINESS DASHBOARD</span>
              <div style={statusDot} />
            </div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <button style={menuToggle} onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <div style={hamburgerLine} />
            <div style={{ ...hamburgerLine, width: '12px', marginBottom: 0 }} />
          </button>

          {isMenuOpen && (
            <div style={dropdownStyle}>
              <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
              {isAdmin && (
                  <>
                    {/* ΠΡΟΣΘΗΚΗ ΤΟΥ ID ΣΕ ΟΛΑ ΤΑ LINKS ΤΟΥ ΜΕΝΟΥ */}
                    <NextLink href={`/suppliers?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>🛒 Προμηθευτές</NextLink>
                    <NextLink href={`/fixed-assets?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>🔌 Πάγια</NextLink>
                    <NextLink href={`/employees?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>👥 Υπάλληλοι</NextLink>
                    <NextLink href={`/suppliers-balance?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>🚩 Καρτέλες (Χρέη)</NextLink>
                    <NextLink href={`/permissions?store=${storeIdFromUrl}`} style={{...menuItem, color: colors.accentBlue}} onClick={() => setIsMenuOpen(false)}>🔑 Δικαιώματα (Admin)</NextLink>
                  </>
              )}
              <NextLink href={`/analysis?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>📊 Ανάλυση</NextLink>
              
              <div style={menuDivider} />
              <p style={menuSectionLabel}>ΕΦΑΡΜΟΓΗ</p>
              <NextLink href="/help" style={menuItem} onClick={() => setIsMenuOpen(false)}>❓ Οδηγίες</NextLink>
              <button onClick={() => { localStorage.clear(); supabase.auth.signOut().then(() => window.location.href='/login'); }} style={logoutBtnStyle}>ΑΠΟΣΥΝΔΕΣΗ 🚪</button>
            </div>
          )}
        </div>
      </header>

      <div style={dateCard}>
        <button onClick={() => changeDate(-1)} style={dateNavBtn}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <p style={dateText}>{format(parseISO(selectedDate), 'EEEE, d MMMM', { locale: el }).toUpperCase()}</p>
        </div>
        <button onClick={() => changeDate(1)} style={dateNavBtn}>›</button>
      </div>

      <div style={heroCardStyle}>
          <p style={heroLabel}>ΔΙΑΘΕΣΙΜΟ ΥΠΟΛΟΙΠΟ ΗΜΕΡΑΣ</p>
          <h2 style={heroAmountText}>{totals.balance.toFixed(2)}€</h2>
          <div style={heroStatsRow}>
              <div style={heroStatItem}>
                  <span style={statCircle(colors.accentGreen)}>↓</span>
                  <span style={heroStatValue}>{totals.income.toFixed(2)}€</span>
              </div>
              <div style={heroStatItem}>
                  <span style={statCircle(colors.accentRed)}>↑</span>
                  <span style={heroStatValue}>{totals.expense.toFixed(2)}€</span>
              </div>
          </div>
      </div>

      <div style={actionGrid}>
        {/* ΠΡΟΣΘΗΚΗ ΤΟΥ ID ΣΤΑ ΚΟΥΜΠΙΑ ΔΡΑΣΗΣ */}
        <NextLink href={`/add-income?date=${selectedDate}&store=${storeIdFromUrl}`} style={{ ...actionBtn, backgroundColor: colors.accentGreen }}>+ Έσοδο</NextLink>
        <NextLink href={`/add-expense?date=${selectedDate}&store=${storeIdFromUrl}`} style={{ ...actionBtn, backgroundColor: colors.accentRed }}>- Έξοδο</NextLink>
        <NextLink href={`/daily-z?store=${storeIdFromUrl}`} style={{ ...actionBtn, backgroundColor: colors.primaryDark }}>📟 Z</NextLink>
      </div>

      <div style={listContainer}>
        <p style={listHeader}>ΚΙΝΗΣΕΙΣ ΗΜΕΡΑΣ</p>
        {loading ? (
          <p style={{textAlign:'center', padding:'20px', fontWeight: '700', color: colors.secondaryText}}>Ενημέρωση...</p>
        ) : (
          transactions.length === 0 ? (
            <p style={{textAlign:'center', padding:'30px', color: colors.secondaryText, fontSize:'14px', fontWeight: '600'}}>Δεν υπάρχουν κινήσεις</p>
          ) : (
            transactions.map(t => (
              <div key={t.id} style={{ marginBottom: '12px' }}>
                <div 
                  style={{
                    ...txRow,
                    borderBottom: expandedTx === t.id ? `1px dashed ${colors.border}` : `1px solid ${colors.bgLight}`,
                    borderRadius: expandedTx === t.id ? '20px 20px 0 0' : '20px'
                  }} 
                  onClick={() => setExpandedTx(expandedTx === t.id ? null : t.id)}
                >
                  <div style={txIconContainer(t.type === 'income')}>
                    {t.type === 'income' ? '↙' : '↗'}
                  </div>
                  <div style={{ flex: 1, marginLeft: '12px' }}>
                    <p style={txTitle}>
                      {t.suppliers?.name || t.fixed_assets?.name || t.category || 'Συναλλαγή'}
                      {t.is_credit && <span style={{fontSize: '9px', marginLeft: '5px', color: colors.accentBlue, fontWeight: '800'}}>(ΠΙΣΤΩΣΗ)</span>}
                    </p>
                    <p style={txMeta}>{t.method} • {format(parseISO(t.created_at), 'HH:mm')}</p>
                  </div>
                  <p style={{ ...txAmount, color: t.type === 'income' ? colors.accentGreen : colors.accentRed }}>
                    {t.type === 'income' ? '+' : '-'}{Math.abs(t.amount).toFixed(2)}€
                  </p>
                </div>

                {expandedTx === t.id && (
                  <div style={actionPanel}>
                    <button 
                      onClick={() => router.push(`/${t.type === 'income' ? 'add-income' : 'add-expense'}?editId=${t.id}&store=${storeIdFromUrl}`)}
                      style={editRowBtn}
                    >
                      ✎ Επεξεργασία
                    </button>
                    <button 
                      onClick={() => handleDelete(t.id)}
                      style={deleteRowBtn}
                    >
                      🗑 Διαγραφή
                    </button>
                  </div>
                )}
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}

// --- STYLES ---
const iphoneWrapper: any = { minHeight: '100dvh', padding: '20px', paddingBottom: '100px', boxSizing: 'border-box' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const brandArea = { display: 'flex', alignItems: 'center', gap: '12px' };
const logoBox = { width: '40px', height: '40px', backgroundColor: colors.primaryDark, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color:'white', fontSize: '18px', fontWeight:'800' };
const storeTitleText = { fontSize: '16px', fontWeight: '800', margin: 0, color: colors.primaryDark };
const switchBtnStyle: any = { fontSize: '8px', fontWeight: '800', color: colors.accentBlue, backgroundColor: '#eef2ff', border: 'none', padding: '4px 6px', borderRadius: '6px', cursor: 'pointer' };
const dashboardSub = { fontSize: '9px', fontWeight: '800', color: colors.secondaryText, letterSpacing: '1px' };
const statusDot = { width: '6px', height: '6px', backgroundColor: colors.accentGreen, borderRadius: '50%' };
const menuToggle: any = { background: 'white', border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '8px', cursor: 'pointer' };
const hamburgerLine = { width: '18px', height: '2px', backgroundColor: colors.primaryDark, marginBottom: '4px', borderRadius: '2px' };
const dropdownStyle: any = { position: 'absolute', top: '50px', right: 0, background: 'white', minWidth: '220px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', padding: '8px', zIndex: 2000, border: `1px solid ${colors.border}` };
const menuItem: any = { display: 'block', padding: '12px 14px', textDecoration: 'none', color: colors.primaryDark, fontWeight: '700', fontSize: '14px', borderRadius: '10px' };
const menuSectionLabel = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, padding: '8px 14px 4px', letterSpacing: '0.5px' };
const menuDivider = { height: '1px', backgroundColor: colors.border, margin: '6px 0' };
const logoutBtnStyle: any = { ...menuItem, width: '100%', textAlign: 'left', background: '#fff1f2', color: colors.accentRed, border: 'none', marginTop: '8px', cursor: 'pointer' };
const dateCard: any = { backgroundColor: 'white', padding: '12px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', border: `1px solid ${colors.border}` };
const dateText = { fontSize: '13px', fontWeight: '800', color: colors.primaryDark, margin: 0 };
const dateNavBtn = { background: 'none', border: 'none', fontSize: '22px', color: colors.secondaryText, cursor: 'pointer', fontWeight:'bold' };
const heroCardStyle: any = { background: colors.primaryDark, padding: '28px', borderRadius: '24px', color: 'white', boxShadow: '0 15px 35px rgba(15, 23, 42, 0.25)', marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' };
const heroLabel: any = { fontSize: '10px', fontWeight: '700', opacity: 0.6, letterSpacing: '1px', marginBottom: '8px' };
const heroAmountText: any = { fontSize: '34px', fontWeight: '800', margin: 0, letterSpacing: '-1px' };
const heroStatsRow: any = { display: 'flex', gap: '16px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', justifyContent: 'center', width: '100%' };
const heroStatItem: any = { display: 'flex', alignItems: 'center', gap: '8px' };
const heroStatValue = { fontSize: '14px', fontWeight: '700' };
const statCircle = (bg: string): any => ({ width: '22px', height: '22px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight:'bold' });
const actionGrid = { display: 'flex', gap: '10px', marginBottom: '30px' };
const actionBtn: any = { flex: 1, padding: '16px', borderRadius: '16px', color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '800', fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const listContainer = { backgroundColor: 'transparent', padding: '0' };
const listHeader = { fontSize: '11px', fontWeight: '800', color: colors.secondaryText, marginBottom: '16px', letterSpacing: '0.5px' };
const txRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'white', cursor: 'pointer', border: `1px solid ${colors.border}`, borderBottom: 'none' };
const txIconContainer = (isInc: boolean): any => ({ width: '40px', height: '40px', borderRadius: '12px', background: isInc ? '#ecfdf5' : '#fff1f2', color: isInc ? colors.accentGreen : colors.accentRed, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' });
const txTitle = { fontWeight: '700', fontSize: '14px', margin: 0, color: colors.primaryDark };
const txMeta = { fontSize: '11px', color: colors.secondaryText, margin: 0, fontWeight: '600' };
const txAmount = { fontWeight: '800', fontSize: '15px' };
const actionPanel: any = { display: 'flex', gap: '8px', padding: '12px', backgroundColor: 'white', border: `1px solid ${colors.border}`, borderTop: 'none', borderRadius: '0 0 20px 20px' };
const editRowBtn: any = { flex: 1, padding: '10px', backgroundColor: colors.warning, color: colors.warningText, border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' };
const deleteRowBtn: any = { flex: 1, padding: '10px', backgroundColor: '#fee2e2', color: colors.accentRed, border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' };

export default function DashboardPage() {
  return <Suspense fallback={null}><DashboardContent /></Suspense>
}
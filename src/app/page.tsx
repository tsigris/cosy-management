
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NextLink from 'next/link'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { el } from 'date-fns/locale'
import { Toaster, toast } from 'sonner'
import {
  TrendingUp,
  TrendingDown,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

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

  const storeIdFromUrl = searchParams.get('store')

  const getBusinessDate = () => {
    const now = new Date()
    if (now.getHours() < 7) now.setDate(now.getDate() - 1)
    return format(now, 'yyyy-MM-dd')
  }

  const selectedDate = searchParams.get('date') || getBusinessDate()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isStoreAdmin, setIsStoreAdmin] = useState(false)
  const [canViewAnalysis, setCanViewAnalysis] = useState(false)
  const [storeName, setStoreName] = useState('Φορτώνει...')
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    if (!storeIdFromUrl) {
      router.replace('/select-store');
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      // Fetch store name
      const { data: storeData } = await supabase
        .from('stores')
        .select('name')
        .eq('id', storeIdFromUrl)
        .maybeSingle();
      if (storeData) setStoreName(storeData.name);

      // Fetch transactions
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('*, suppliers(name), fixed_assets(name)')
        .eq('store_id', storeIdFromUrl)
        .eq('date', selectedDate)
        .order('created_at', { ascending: false });
      if (txError) throw txError;
      setTransactions(tx || []);

      // Fetch store_access for RBAC
      const { data: access } = await supabase
        .from('store_access')
        .select('role, can_view_analysis')
        .eq('user_id', session.user.id)
        .eq('store_id', storeIdFromUrl)
        .maybeSingle();

      if (access) {
        setIsStoreAdmin(access.role === 'admin');
        setCanViewAnalysis(access.role === 'admin' || access.can_view_analysis === true);
      } else {
        setIsStoreAdmin(false);
        setCanViewAnalysis(false);
      }

    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, router, storeIdFromUrl]);

  useEffect(() => { loadDashboard() }, [loadDashboard])

  const handleDelete = async (id: string) => {
    if (!confirm('Οριστική διαγραφή αυτής της κίνησης;')) return
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('store_id', storeIdFromUrl);

      if (error) throw error
      setTransactions(prev => prev.filter(t => t.id !== id))
      setExpandedTx(null)
      toast.success('Η κίνηση διαγράφηκε');
    } catch (err) {
      toast.error('Σφάλμα κατά τη διαγραφή');
    }
  }

  const totals = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

    const expense = transactions
      .filter(t => (t.type === 'expense' || t.type === 'debt_payment') && t.is_credit !== true)
      .reduce((acc, t) => acc + (Math.abs(Number(t.amount)) || 0), 0)

    return { income, expense, balance: income - expense }
  }, [transactions])

  const changeDate = (days: number) => {
    const current = parseISO(selectedDate)
    const next = days > 0 ? addDays(current, 1) : subDays(current, 1)
    router.push(`/?date=${format(next, 'yyyy-MM-dd')}&store=${storeIdFromUrl}`)
    setExpandedTx(null)
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      
      <header style={headerStyle}>
        <div style={brandArea}>
          <div style={logoBox}>{storeName?.charAt(0) || '?'}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={storeTitleText}>{storeName?.toUpperCase() || 'ΦΟΡΤΩΣΗ...'}</h1>
                <NextLink href="/select-store" style={switchBtnStyle}>ΑΛΛΑΓΗ</NextLink>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={dashboardSub}>BUSINESS DASHBOARD</span>
              <div style={statusDot} />
            </div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <button style={menuToggle} onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {isMenuOpen && (
            <div style={dropdownStyle}>
              {/* Management Section: Only for Store Admins */}
              {isStoreAdmin && (
                <>
                  <p style={menuSectionLabel}>ΔΙΑΧΕΙΡΙΣΗ</p>
                  <NextLink href={`/suppliers?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>🛒 Προμηθευτές</NextLink>
                  <NextLink href={`/fixed-assets?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>🔌 Πάγια</NextLink>
                  <NextLink href={`/employees?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>👥 Υπάλληλοι</NextLink>
                  <NextLink href={`/suppliers-balance?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>🚩 Καρτέλες (Χρέη)</NextLink>
                  <NextLink href={`/permissions?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>🔑 Δικαιώματα</NextLink>
                </>
              )}
              {/* Analysis Link: Only for those with permission */}
              {canViewAnalysis && (
                <NextLink href={`/analysis?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>📊 Ανάλυση</NextLink>
              )}

              <div style={menuDivider} />

              <p style={menuSectionLabel}>ΥΠΟΣΤΗΡΙΞΗ & ΡΥΘΜΙΣΕΙΣ</p>
              <NextLink href={`/settings?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>⚙️ Ρυθμίσεις</NextLink>
              <NextLink href={`/instructions?store=${storeIdFromUrl}`} style={menuItem} onClick={() => setIsMenuOpen(false)}>📖 Οδηγίες Χρήσης</NextLink>

              <div style={menuDivider} />
              <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} style={logoutBtnStyle}>
                ΑΠΟΣΥΝΔΕΣΗ 🚪
              </button>
            </div>
          )}
        </div>
      </header>

      <div style={dateCard}>
        <button onClick={() => changeDate(-1)} style={dateNavBtn}><ChevronLeft size={24} /></button>
        <div style={{ textAlign: 'center' }}>
          <p style={dateText}>{format(parseISO(selectedDate), 'EEEE, d MMMM', { locale: el }).toUpperCase()}</p>
        </div>
        <button onClick={() => changeDate(1)} style={dateNavBtn}><ChevronRight size={24} /></button>
      </div>

      <div style={heroCardStyle}>
          <p style={heroLabel}>ΔΙΑΘΕΣΙΜΟ ΥΠΟΛΟΙΠΟ ΗΜΕΡΑΣ</p>
          <h2 style={heroAmountText}>{totals.balance.toFixed(2)}€</h2>
          <div style={heroStatsRow}>
              <div style={heroStatItem}>
                  <div style={statCircle(colors.accentGreen)}><TrendingUp size={12} /></div>
                  <span style={heroStatValue}>{totals.income.toFixed(2)}€</span>
              </div>
              <div style={heroStatItem}>
                  <div style={statCircle(colors.accentRed)}><TrendingDown size={12} /></div>
                  <span style={heroStatValue}>{totals.expense.toFixed(2)}€</span>
              </div>
          </div>
      </div>

      <div style={actionGrid}>
        <NextLink href={`/add-income?date=${selectedDate}&store=${storeIdFromUrl}`} style={{ ...actionBtn, backgroundColor: colors.accentGreen }}>+ Έσοδο</NextLink>
        <NextLink href={`/add-expense?date=${selectedDate}&store=${storeIdFromUrl}`} style={{ ...actionBtn, backgroundColor: colors.accentRed }}>- Έξοδο</NextLink>
        <NextLink href={`/daily-z?store=${storeIdFromUrl}`} style={{ ...actionBtn, backgroundColor: colors.primaryDark }}>📟 Z</NextLink>
      </div>

      <div style={listContainer}>
        <p style={listHeader}>ΚΙΝΗΣΕΙΣ ΗΜΕΡΑΣ ({transactions.length})</p>
        {loading ? (
          <div style={{textAlign:'center', padding:'40px'}}><div style={spinnerStyle}></div></div>
        ) : transactions.length === 0 ? (
          <div style={emptyStateStyle}>Δεν υπάρχουν κινήσεις</div>
        ) : (
          transactions.map(t => (
            <div key={t.id} style={{ marginBottom: '12px' }}>
              <div 
                style={{
                  ...txRow,
                  borderRadius: expandedTx === t.id ? '20px 20px 0 0' : '20px',
                  borderBottom: expandedTx === t.id ? `1px dashed ${colors.border}` : `1px solid ${colors.border}`
                }} 
                onClick={() => setExpandedTx(expandedTx === t.id ? null : t.id)}
              >
                <div style={txIconContainer(t.type === 'income')}>
                  {t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                </div>
                <div style={{ flex: 1, marginLeft: '12px' }}>
                  <p style={txTitle}>
                    {t.suppliers?.name || t.fixed_assets?.name || t.category || 'Συναλλαγή'}
                    {t.is_credit && <span style={creditBadgeStyle}>ΠΙΣΤΩΣΗ</span>}
                  </p>
                  <p style={txMeta}>{t.method} • {t.created_at ? format(parseISO(t.created_at), 'HH:mm') : '--:--'}</p>
                </div>
                <p style={{ ...txAmount, color: t.type === 'income' ? colors.accentGreen : colors.accentRed }}>
                  {t.type === 'income' ? '+' : '-'}{Math.abs(Number(t.amount) || 0).toFixed(2)}€
                </p>
              </div>

              {expandedTx === t.id && (
                <div style={actionPanel}>
                  <button onClick={() => router.push(`/add-${t.type === 'income' ? 'income' : 'expense'}?editId=${t.id}&store=${storeIdFromUrl}`)} style={editRowBtn}>Επεξεργασία</button>
                  <button onClick={() => handleDelete(t.id)} style={deleteRowBtn}>Διαγραφή</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', paddingBottom: '100px' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const brandArea = { display: 'flex', alignItems: 'center', gap: '12px' };
const logoBox = { width: '42px', height: '42px', backgroundColor: colors.primaryDark, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color:'white', fontSize: '18px', fontWeight:'800' };
const storeTitleText = { fontSize: '16px', fontWeight: '800', margin: 0, color: colors.primaryDark };
const switchBtnStyle: any = { fontSize: '9px', fontWeight: '800', color: colors.accentBlue, backgroundColor: '#eef2ff', border: 'none', padding: '4px 8px', borderRadius: '8px', cursor: 'pointer', textDecoration: 'none' };
const dashboardSub = { fontSize: '9px', fontWeight: '800', color: colors.secondaryText, letterSpacing: '0.5px' };
const statusDot = { width: '6px', height: '6px', backgroundColor: colors.accentGreen, borderRadius: '50%' };
const menuToggle: any = { background: 'white', border: `1px solid ${colors.border}`, borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: colors.primaryDark };
const dropdownStyle: any = { position: 'absolute', top: '50px', right: 0, background: 'white', minWidth: '220px', borderRadius: '18px', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', padding: '10px', zIndex: 100, border: `1px solid ${colors.border}` };
const menuItem: any = { display: 'block', padding: '12px 15px', textDecoration: 'none', color: colors.primaryDark, fontWeight: '700', fontSize: '14px', borderRadius: '12px' };
const menuSectionLabel = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, padding: '8px 15px 5px' };
const menuDivider = { height: '1px', backgroundColor: colors.border, margin: '8px 0' };
const logoutBtnStyle: any = { width: '100%', textAlign: 'left', padding: '12px 15px', background: '#fff1f2', color: colors.accentRed, border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' };
const dateCard: any = { backgroundColor: 'white', padding: '10px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', border: `1px solid ${colors.border}` };
const dateText = { fontSize: '13px', fontWeight: '800', color: colors.primaryDark, margin: 0 };
const dateNavBtn = { background: 'none', border: 'none', color: colors.secondaryText, cursor: 'pointer', display: 'flex', alignItems: 'center' };
const heroCardStyle: any = { background: colors.primaryDark, padding: '30px 20px', borderRadius: '28px', color: 'white', boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)', marginBottom: '30px', textAlign: 'center' };
const heroLabel: any = { fontSize: '10px', fontWeight: '700', opacity: 0.5, letterSpacing: '1px', marginBottom: '10px' };
const heroAmountText: any = { fontSize: '38px', fontWeight: '900', margin: 0 };
const heroStatsRow: any = { display: 'flex', gap: '20px', marginTop: '25px', justifyContent: 'center' };
const heroStatItem: any = { display: 'flex', alignItems: 'center', gap: '8px' };
const heroStatValue = { fontSize: '15px', fontWeight: '800' };
const statCircle = (bg: string): any => ({ width: '24px', height: '24px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' });
const actionGrid = { display: 'flex', gap: '12px', marginBottom: '30px' };
const actionBtn: any = { flex: 1, padding: '18px', borderRadius: '18px', color: 'white', textDecoration: 'none', textAlign: 'center', fontWeight: '800', fontSize: '14px', boxShadow: '0 8px 15px rgba(0,0,0,0.08)' };
const listContainer = { backgroundColor: 'transparent' };
const listHeader = { fontSize: '11px', fontWeight: '900', color: colors.secondaryText, marginBottom: '15px', letterSpacing: '0.5px' };
const txRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'white', border: `1px solid ${colors.border}`, cursor: 'pointer' };
const txIconContainer = (isInc: boolean): any => ({ width: '42px', height: '42px', borderRadius: '12px', background: isInc ? '#f0fdf4' : '#fef2f2', color: isInc ? colors.accentGreen : colors.accentRed, display: 'flex', alignItems: 'center', justifyContent: 'center' });
const txTitle = { fontWeight: '800', fontSize: '14px', margin: 0, color: colors.primaryDark };
const txMeta = { fontSize: '11px', color: colors.secondaryText, margin: 0, fontWeight: '600' };
const txAmount = { fontWeight: '900', fontSize: '16px' };
const creditBadgeStyle = { fontSize: '8px', marginLeft: '6px', color: colors.accentBlue, background: '#eef2ff', padding: '2px 5px', borderRadius: '4px' };
const actionPanel: any = { display: 'flex', gap: '10px', padding: '15px', backgroundColor: 'white', border: `1px solid ${colors.border}`, borderTop: 'none', borderRadius: '0 0 20px 20px' };
const editRowBtn: any = { flex: 1, padding: '10px', backgroundColor: colors.bgLight, color: colors.primaryDark, border: `1px solid ${colors.border}`, borderRadius: '10px', fontWeight: '700', fontSize: '12px' };
const deleteRowBtn: any = { flex: 1, padding: '10px', backgroundColor: '#fee2e2', color: colors.accentRed, border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '12px' };
const emptyStateStyle: any = { textAlign: 'center', padding: '40px 20px', color: colors.secondaryText, fontWeight: '600', fontSize: '13px' };
const spinnerStyle: any = { width: '24px', height: '24px', border: '3px solid #f3f3f3', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' };

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}
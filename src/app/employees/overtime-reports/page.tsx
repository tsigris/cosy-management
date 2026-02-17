'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { Trash2, ChevronLeft, BarChart3, Clock } from 'lucide-react'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff'
};

function OvertimeReportsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all')

  const fetchReports = useCallback(async () => {
    if (!storeId) {
      router.replace('/select-store')
      return
    }

    setLoading(true)
    try {
      // ✅ Σύνδεση με fixed_assets (name) αντί για employees
      let query = supabase
        .from('employee_overtimes')
        .select(`
          *,
          fixed_assets (
            name
          )
        `)
        .eq('store_id', storeId)
        .order('date', { ascending: false });

      if (filter === 'pending') query = query.eq('is_paid', false);
      if (filter === 'paid') query = query.eq('is_paid', true);

      const { data, error } = await query;
      
      if (error) throw error;
      if (data) setReports(data);
    } catch (err: any) {
      console.error(err);
      toast.error('Σφάλμα φόρτωσης αναφορών');
    } finally {
      setLoading(false);
    }
  }, [filter, storeId, router])

  useEffect(() => { 
    fetchReports() 
  }, [fetchReports])

  async function deleteEntry(id: string) {
    if(!confirm('Οριστική διαγραφή αυτής της καταγραφής;')) return;
    const { error } = await supabase.from('employee_overtimes').delete().eq('id', id);
    if(!error) {
      toast.success('Διαγράφηκε επιτυχώς');
      fetchReports();
    } else {
      toast.error('Αποτυχία διαγραφής');
    }
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '80px' }}>
        
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}><BarChart3 size={20} color="#b45309" /></div>
            <div>
              <h1 style={{ fontWeight: '900', fontSize: '18px', margin: 0, color: colors.primaryDark }}>Αναφορές Υπερωριών</h1>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: colors.secondaryText }}>ΙΣΤΟΡΙΚΟ & ΕΚΚΑΘΑΡΙΣΗ</p>
            </div>
          </div>
          <Link href={`/employees?store=${storeId}`} style={backBtnStyle}><ChevronLeft size={20} /></Link>
        </div>

        {/* ΦΙΛΤΡΑ (16px για mobile stability) */}
        <div style={filterBar}>
          <button onClick={() => setFilter('all')} style={filter === 'all' ? activeFilter : inactiveFilter}>ΟΛΕΣ</button>
          <button onClick={() => setFilter('pending')} style={filter === 'pending' ? activeFilter : inactiveFilter}>ΕΚΚΡΕΜΕΙΣ</button>
          <button onClick={() => setFilter('paid')} style={filter === 'paid' ? activeFilter : inactiveFilter}>ΠΛΗΡΩΜΕΝΕΣ</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}><div style={spinnerStyle}></div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reports.map((report) => (
              <div key={report.id} style={reportCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <p style={empName}>
                      {report.fixed_assets?.name ? report.fixed_assets.name.toUpperCase() : 'ΑΓΝΩΣΤΟΣ ΥΠΑΛΛΗΛΟΣ'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                       <span style={reportDate}>{new Date(report.date).toLocaleDateString('el-GR')}</span>
                       <span style={hoursBadge}><Clock size={10} /> {report.hours} Ώρες</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ 
                      ...statusBadge, 
                      backgroundColor: report.is_paid ? '#ecfdf5' : '#fff7ed',
                      color: report.is_paid ? colors.accentGreen : '#c2410c',
                      border: `1px solid ${report.is_paid ? '#bbf7d0' : '#ffedd5'}`
                    }}>
                      {report.is_paid ? 'ΠΛΗΡΩΘΗΚΕ ✓' : 'ΕΚΚΡΕΜΕΙ'}
                    </span>
                    {!report.is_paid && (
                      <button onClick={() => deleteEntry(report.id)} style={deleteBtn}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {reports.length === 0 && (
              <div style={emptyState}>
                <p style={{ margin: 0, fontWeight: '800' }}>Δεν βρέθηκαν καταγραφές</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// STYLES
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflowY: 'auto' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` };

const filterBar: any = { display: 'flex', gap: '8px', marginBottom: '20px', backgroundColor: colors.white, padding: '6px', borderRadius: '14px', border: `1px solid ${colors.border}` };
const activeFilter: any = { flex: 1, padding: '12px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: '900' };
const inactiveFilter: any = { flex: 1, padding: '12px', backgroundColor: 'transparent', color: colors.secondaryText, border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: '800' };

const reportCard: any = { backgroundColor: colors.white, padding: '16px', borderRadius: '20px', border: `1px solid ${colors.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' };
const empName: any = { margin: 0, fontWeight: '900', fontSize: '15px', color: colors.primaryDark };
const reportDate: any = { fontSize: '12px', color: colors.secondaryText, fontWeight: '700' };
const hoursBadge: any = { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800', color: colors.accentBlue, backgroundColor: '#eff6ff', padding: '3px 8px', borderRadius: '6px' };

const statusBadge: any = { fontSize: '10px', fontWeight: '900', padding: '5px 10px', borderRadius: '8px', letterSpacing: '0.5px' };
const deleteBtn: any = { background: '#fef2f2', border: 'none', padding: '8px', borderRadius: '10px', color: colors.accentRed, cursor: 'pointer', display: 'flex', alignItems: 'center' };
const emptyState: any = { textAlign: 'center', padding: '40px', color: colors.secondaryText, backgroundColor: colors.white, borderRadius: '20px', border: `1px dashed ${colors.border}` };
const spinnerStyle: any = { width: '24px', height: '24px', border: '3px solid #f3f3f3', borderTop: `3px solid ${colors.accentBlue}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' };

export default function OvertimeReportsPage() {
  return (
    <main>
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <OvertimeReportsContent />
      </Suspense>
    </main>
  )
}
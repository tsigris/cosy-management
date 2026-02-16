'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  slate100: '#f1f5f9'
};

function OvertimeReportsContent() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all')

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      // Multi-tenant: get activeStoreId from localStorage
      const activeStoreId = typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null;
      if (!activeStoreId) return setLoading(false);
      const MAIN_STORE_ID = 'e50a8803-a262-4303-9e90-c116c965e683';
      let query = supabase
        .from('employee_overtimes')
        .select(`*, employees (full_name)`)
        .order('date', { ascending: false });

      if (activeStoreId === MAIN_STORE_ID) {
        // Main store: allow records with store_id null or main
        query = query.or(`store_id.eq.${activeStoreId},store_id.is.null`);
      } else {
        // Other stores: strict filter, no nulls
        query = query.eq('store_id', activeStoreId);
      }
      if (filter === 'pending') query = query.eq('is_paid', false);
      if (filter === 'paid') query = query.eq('is_paid', true);
      const { data, error } = await query;
      if (data) setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter])

  useEffect(() => { fetchReports() }, [fetchReports])

  async function deleteEntry(id: string) {
    if(!confirm('Διαγραφή αυτής της καταγραφής;')) return;
    const { error } = await supabase.from('employee_overtimes').delete().eq('id', id);
    if(!error) fetchReports();
  }

  return (
    <div style={iphoneWrapper}>
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '50px' }}>
        
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>📊</div>
            <h1 style={{ fontWeight: '800', fontSize: '18px', margin: 0 }}>Αναφορές Υπερωριών</h1>
          </div>
          <Link href="/employees" style={backBtnStyle}>✕</Link>
        </div>

        {/* ΦΙΛΤΡΑ */}
        <div style={filterBar}>
          <button onClick={() => setFilter('all')} style={filter === 'all' ? activeFilter : inactiveFilter}>ΟΛΕΣ</button>
          <button onClick={() => setFilter('pending')} style={filter === 'pending' ? activeFilter : inactiveFilter}>ΕΚΚΡΕΜΕΙΣ</button>
          <button onClick={() => setFilter('paid')} style={filter === 'paid' ? activeFilter : inactiveFilter}>ΠΛΗΡΩΜΕΝΕΣ</button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: colors.secondaryText }}>Φόρτωση...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {reports.map((report) => (
              <div key={report.id} style={reportCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={empName}>{report.employees?.full_name?.toUpperCase()}</p>
                    <p style={reportDate}>{new Date(report.date).toLocaleDateString('el-GR')} • {report.hours} Ώρες</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ 
                      ...statusBadge, 
                      backgroundColor: report.is_paid ? '#ecfdf5' : '#fff7ed',
                      color: report.is_paid ? colors.accentGreen : '#c2410c'
                    }}>
                      {report.is_paid ? 'ΠΛΗΡΩΘΗΚΕ ✓' : 'ΕΚΚΡΕΜΕΙ ⏳'}
                    </span>
                    {!report.is_paid && (
                      <button onClick={() => deleteEntry(report.id)} style={deleteBtn}>🗑️</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {reports.length === 0 && (
              <p style={{ textAlign: 'center', color: colors.secondaryText, marginTop: '20px' }}>Δεν βρέθηκαν καταγραφές.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// STYLES
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflowY: 'auto' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` };
const filterBar: any = { display: 'flex', gap: '8px', marginBottom: '20px', backgroundColor: colors.white, padding: '5px', borderRadius: '12px', border: `1px solid ${colors.border}` };
const activeFilter: any = { flex: 1, padding: '8px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '8px', fontSize: '10px', fontWeight: '800' };
const inactiveFilter: any = { flex: 1, padding: '8px', backgroundColor: 'transparent', color: colors.secondaryText, border: 'none', borderRadius: '8px', fontSize: '10px', fontWeight: '700' };
const reportCard: any = { backgroundColor: colors.white, padding: '16px', borderRadius: '18px', border: `1px solid ${colors.border}` };
const empName: any = { margin: 0, fontWeight: '800', fontSize: '14px', color: colors.primaryDark };
const reportDate: any = { margin: '4px 0 0', fontSize: '11px', color: colors.secondaryText, fontWeight: '600' };
const statusBadge: any = { fontSize: '9px', fontWeight: '900', padding: '4px 8px', borderRadius: '6px', display: 'inline-block' };
const deleteBtn: any = { background: 'none', border: 'none', marginLeft: '10px', cursor: 'pointer', opacity: 0.5 };

export default function OvertimeReportsPage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><OvertimeReportsContent /></Suspense></main>
}
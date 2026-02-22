'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  accentOrange: '#ea580c',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  slate100: '#f1f5f9',
}

type OvertimeRow = {
  id: string
  date: string
  hours: number
  employee_id: string
  is_paid: boolean | null
}

type EmployeeRow = {
  id: string
  name: string
}

function OvertimeReportContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store_id') || searchParams.get('store')

  const [loading, setLoading] = useState(true)
  const [overtimes, setOvertimes] = useState<OvertimeRow[]>([])
  const [employees, setEmployees] = useState<EmployeeRow[]>([])

  useEffect(() => {
    if (!storeId || storeId === 'null') {
      router.replace('/select-store')
    }
  }, [storeId, router])

  useEffect(() => {
    const STYLE_ID = 'overtime-report-print-css'
    if (document.getElementById(STYLE_ID)) return

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.innerHTML = `
@media print {
  @page { size: A4; margin: 12mm; }

  html, body {
    background: #ffffff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .no-print { display: none !important; }

  [data-print-root="true"] {
    position: static !important;
    overflow: visible !important;
    min-height: auto !important;
    background: #ffffff !important;
    padding: 0 !important;
  }

  [data-print-root="true"] * {
    box-shadow: none !important;
  }

  [data-print-row="true"] {
    border: 1px solid #e2e8f0 !important;
    background: #ffffff !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
`

    document.head.appendChild(style)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)

    try {
      if (!storeId || storeId === 'null') {
        setLoading(false)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/login')
        return
      }

      const [otRes, empRes] = await Promise.all([
        supabase
          .from('employee_overtimes')
          .select('id, date, hours, employee_id, is_paid')
          .eq('store_id', storeId)
          .order('date', { ascending: false }),
        supabase
          .from('fixed_assets')
          .select('id, name')
          .eq('store_id', storeId)
          .eq('sub_category', 'staff')
          .order('name', { ascending: true }),
      ])

      if (otRes.data) setOvertimes(otRes.data as OvertimeRow[])
      if (empRes.data) setEmployees(empRes.data as EmployeeRow[])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [storeId, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const employeeNameMap = useMemo(() => {
    const map = new Map<string, string>()
    employees.forEach((employee) => {
      map.set(employee.id, employee.name)
    })
    return map
  }, [employees])

  const totalHours = useMemo(
    () => overtimes.reduce((sum, row) => sum + Number(row.hours || 0), 0),
    [overtimes],
  )

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  return (
    <div style={iphoneWrapper} data-print-root="true">
      <div style={containerStyle}>
        <div style={headerStyle} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>📄</div>
            <h1 style={titleStyle}>Αναφορά Υπερωριών</h1>
          </div>

          <Link href={`/employees?store=${storeId}`} style={backBtnStyle}>
            ✕
          </Link>
        </div>

        <div style={actionsCardStyle} className="no-print">
          <button onClick={handlePrint} style={printButtonStyle}>
            Εκτύπωση σε PDF
          </button>
        </div>

        {loading ? (
          <p style={loadingTextStyle}>Φόρτωση υπερωριών...</p>
        ) : overtimes.length === 0 ? (
          <div style={emptyCardStyle}>
            <p style={emptyTitleStyle}>Δεν υπάρχουν υπερωρίες</p>
            <p style={emptySubStyle}>Δεν βρέθηκαν εγγραφές για το επιλεγμένο κατάστημα.</p>
          </div>
        ) : (
          <div style={listStyle}>
            {overtimes.map((row) => (
              <div key={row.id} style={cardStyle} data-print-row="true">
                <div style={rowLineStyle}>
                  <span style={labelStyle}>Ημερομηνία</span>
                  <span style={valueStyle}>{new Date(row.date).toLocaleDateString('el-GR')}</span>
                </div>

                <div style={rowLineStyle}>
                  <span style={labelStyle}>Όνομα Υπαλλήλου</span>
                  <span style={valueStyle}>{employeeNameMap.get(row.employee_id) || 'Άγνωστος υπάλληλος'}</span>
                </div>

                <div style={rowLineStyle}>
                  <span style={labelStyle}>Ώρες</span>
                  <span style={hoursValueStyle}>{Number(row.hours || 0).toLocaleString('el-GR')} ώρες</span>
                </div>

                <div style={rowLineStyle}>
                  <span style={labelStyle}>Κατάσταση</span>
                  <span
                    style={{
                      ...statusBadgeStyle,
                      backgroundColor: row.is_paid ? '#dcfce7' : '#ffedd5',
                      color: row.is_paid ? colors.accentGreen : colors.accentOrange,
                    }}
                  >
                    {row.is_paid ? 'ΠΛΗΡΩΘΗΚΕ' : 'ΕΚΚΡΕΜΕΙ'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div style={footerStyle}>
            <span style={footerLabelStyle}>Σύνολο Ωρών</span>
            <span style={footerValueStyle}>{totalHours.toLocaleString('el-GR')} ώρες</span>
          </div>
        )}
      </div>
    </div>
  )
}

const iphoneWrapper: React.CSSProperties = {
  backgroundColor: colors.bgLight,
  minHeight: '100dvh',
  padding: '20px',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflowY: 'auto',
}

const containerStyle: React.CSSProperties = {
  maxWidth: '520px',
  margin: '0 auto',
  paddingBottom: '40px',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
}

const logoBoxStyle: React.CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  backgroundColor: '#dbeafe',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 800,
  color: colors.primaryDark,
}

const backBtnStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: colors.secondaryText,
  width: '38px',
  height: '38px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.white,
  borderRadius: '12px',
  border: `1px solid ${colors.border}`,
  fontWeight: 800,
}

const actionsCardStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: '16px',
  padding: '12px',
  marginBottom: '16px',
}

const printButtonStyle: React.CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: '12px',
  backgroundColor: colors.primaryDark,
  color: colors.white,
  fontWeight: 800,
  fontSize: '13px',
  padding: '12px',
  cursor: 'pointer',
}

const loadingTextStyle: React.CSSProperties = {
  textAlign: 'center',
  color: colors.secondaryText,
  fontWeight: 600,
}

const emptyCardStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: '16px',
  padding: '18px',
  textAlign: 'center',
}

const emptyTitleStyle: React.CSSProperties = {
  margin: 0,
  color: colors.primaryDark,
  fontWeight: 800,
}

const emptySubStyle: React.CSSProperties = {
  margin: '8px 0 0 0',
  color: colors.secondaryText,
  fontSize: '13px',
  fontWeight: 600,
}

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
}

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: '16px',
  padding: '14px',
}

const rowLineStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  padding: '4px 0',
}

const labelStyle: React.CSSProperties = {
  color: colors.secondaryText,
  fontSize: '12px',
  fontWeight: 700,
}

const valueStyle: React.CSSProperties = {
  color: colors.primaryDark,
  fontSize: '13px',
  fontWeight: 700,
  textAlign: 'right',
}

const hoursValueStyle: React.CSSProperties = {
  color: colors.accentGreen,
  fontSize: '13px',
  fontWeight: 800,
  textAlign: 'right',
}

const statusBadgeStyle: React.CSSProperties = {
  borderRadius: '999px',
  padding: '5px 10px',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.3px',
}

const footerStyle: React.CSSProperties = {
  marginTop: '14px',
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: '16px',
  padding: '14px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const footerLabelStyle: React.CSSProperties = {
  color: colors.secondaryText,
  fontSize: '12px',
  fontWeight: 700,
}

const footerValueStyle: React.CSSProperties = {
  color: colors.primaryDark,
  fontSize: '14px',
  fontWeight: 800,
}

export default function OvertimeReportPage() {
  return (
    <main>
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <OvertimeReportContent />
      </Suspense>
    </main>
  )
}

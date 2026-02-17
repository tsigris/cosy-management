'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Toaster, toast } from 'sonner'

// ΧΡΩΜΑΤΑ ΕΦΑΡΜΟΓΗΣ
const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
}

type StaffAsset = {
  id: string
  name: string | null
  // πρόσθεσε εδώ ό,τι άλλο πεδίο χρειάζεσαι να δείξεις
}

function EmployeesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const storeId = searchParams.get('store')

  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<StaffAsset[]>([])
  const [q, setQ] = useState('')

  const loadStaff = useCallback(async () => {
    if (!storeId) {
      router.replace('/select-store')
      return
    }

    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const res = await supabase
        .from('fixed_assets')
        .select('id, name')
        .eq('sub_category', 'staff')
        .eq('store_id', storeId) // <-- αν ΔΕΝ υπάρχει store_id στον πίνακα fixed_assets, βγάλ' το
        .order('name', { ascending: true })

      if (res.error) throw res.error
      setStaff((res.data as StaffAsset[]) || [])
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Σφάλμα φόρτωσης προσωπικού')
      setStaff([])
    } finally {
      setLoading(false)
    }
  }, [router, storeId])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return staff
    return staff.filter(s => (s.name || '').toLowerCase().includes(needle))
  }, [q, staff])

  return (
    <div style={pageWrap}>
      <Toaster position="top-center" richColors />

      <div style={container}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={logoBoxStyle}>👥</div>
            <div>
              <h1 style={{ margin: 0, fontWeight: 900, fontSize: 18, color: colors.primaryDark }}>
                Προσωπικό
              </h1>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: colors.secondaryText }}>
                Από fixed_assets (sub_category: staff)
              </p>
            </div>
          </div>

          <Link href={`/?store=${storeId || ''}`} style={backBtnStyle}>
            ✕
          </Link>
        </div>

        <div style={searchRow}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Αναζήτηση υπαλλήλου..."
            style={searchInput}
          />
          <button
            onClick={loadStaff}
            disabled={loading}
            style={{ ...refreshBtn, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '...' : '↻'}
          </button>
        </div>

        <div style={listWrap}>
          {loading ? (
            <div style={skeletonCard}>Φόρτωση...</div>
          ) : filtered.length === 0 ? (
            <div style={emptyCard}>
              <p style={{ margin: 0, fontWeight: 900, color: colors.primaryDark }}>Δεν βρέθηκε προσωπικό</p>
              <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 700, color: colors.secondaryText }}>
                Έλεγξε ότι υπάρχουν εγγραφές στο fixed_assets με sub_category = staff.
              </p>
            </div>
          ) : (
            filtered.map((emp) => {
              const empName = (emp.name || 'ΧΩΡΙΣ ΟΝΟΜΑ').trim()

              // Στέλνουμε στο pay page (ή όπου το θες) το id + name
              // Αν το “pay” route σου είναι αλλού, άλλαξε το link εδώ.
              const href = `/employees/pay?store=${storeId}&id=${emp.id}&name=${encodeURIComponent(empName)}`

              return (
                <Link key={emp.id} href={href} style={cardLink}>
                  <div style={card}>
                    <div style={avatar}>{empName.slice(0, 1).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <p style={cardTitle}>{empName}</p>
                      <p style={cardSub}>Προσωπικό (fixed_assets)</p>
                    </div>
                    <div style={chevron}>›</div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default function EmployeesPage() {
  return (
    <main>
      <Suspense fallback={null}>
        <EmployeesContent />
      </Suspense>
    </main>
  )
}

// STYLES
const pageWrap: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: 20 }
const container: any = { maxWidth: 520, margin: '0 auto', paddingBottom: 90 }

const headerStyle: any = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 14,
}

const logoBoxStyle: any = {
  width: 42,
  height: 42,
  backgroundColor: '#e0f2fe',
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
}

const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondaryText,
  width: 38,
  height: 38,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.white,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
}

const searchRow: any = { display: 'flex', gap: 10, marginBottom: 12 }
const searchInput: any = {
  flex: 1,
  padding: '12px 12px',
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  fontSize: 16, // anti-zoom mobile
  fontWeight: 800,
  boxSizing: 'border-box',
}

const refreshBtn: any = {
  width: 48,
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  fontSize: 16,
  fontWeight: 900,
  cursor: 'pointer',
}

const listWrap: any = { display: 'flex', flexDirection: 'column', gap: 10 }

const cardLink: any = { textDecoration: 'none' }

const card: any = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: 18,
  padding: 14,
}

const avatar: any = {
  width: 40,
  height: 40,
  borderRadius: 14,
  backgroundColor: '#f1f5f9',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
  color: colors.primaryDark,
}

const cardTitle: any = {
  margin: 0,
  fontSize: 14,
  fontWeight: 900,
  color: colors.primaryDark,
}

const cardSub: any = {
  margin: '4px 0 0',
  fontSize: 11,
  fontWeight: 800,
  color: colors.secondaryText,
}

const chevron: any = { fontSize: 22, fontWeight: 900, color: colors.secondaryText }

const skeletonCard: any = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: 18,
  padding: 16,
  fontWeight: 900,
  color: colors.secondaryText,
  textAlign: 'center',
}

const emptyCard: any = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: 18,
  padding: 16,
}
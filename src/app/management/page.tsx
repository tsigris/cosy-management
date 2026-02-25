'use client'

import React, { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PermissionGuard from '@/components/PermissionGuard'
import {
  Users,
  Landmark,
  Target,
  ChevronRight,
  ListTree,
  ShieldCheck,
  Store,
  Wallet,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

/* ---------------- CONFIG ---------------- */

const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  indigo: '#6366f1',
  background: '#f8fafc',
  border: '#e2e8f0',
  surface: '#ffffff',
}

/* ---------------- CONTENT ---------------- */

function ManagementContent() {
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')
  const [economicsOpen, setEconomicsOpen] = useState(false)

  const withStore = (path: string) => {
    if (!storeId) return path
    return `${path}?store=${storeId}`
  }

  const economicsLinks = useMemo(
    () => [
      { label: 'Ταμειακή ροή', subLabel: 'Cashflow', path: '/economics/cashflow' },
      { label: 'Δαπάνες', subLabel: 'Expenses', path: '/economics/expenses' },
      { label: 'Πιστώσεις', subLabel: 'Credits', path: '/economics/credits' },
      { label: 'Αναφορές', subLabel: 'Reports', path: '/economics/reports' },
      { label: 'Προγραμματισμένες Πληρωμές', subLabel: 'Scheduled Payments', path: '/economics/scheduled-payments' },
    ],
    []
  )

  return (
    <PermissionGuard storeId={storeId}>
      {({ isAdmin }) => (
        <div style={container}>
          <div style={header}>
            <h1 style={headerTitle}>Διαχείριση</h1>
            <p style={headerSub}>Κεντρικός έλεγχος καταστήματος</p>
          </div>

          <div style={content}>
            {/* Οργάνωση Επιχείρησης */}
            <div style={section}>
              <h2 style={sectionTitle}>Οργάνωση Επιχείρησης</h2>
              <div style={grid}>
                <Link href={withStore('/manage-lists')} style={card}>
                  <div style={{ ...iconBox, backgroundColor: `${'#10b981'}15`, color: '#10b981' }}>
                    <ListTree size={20} />
                  </div>
                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={label}>Μητρώο & Συνεργάτες</span>
                      <span style={subLabelStyle}>Προμηθευτές, Πηγές Εσόδων, Λογαριασμοί, κ.α.</span>
                    </div>
                    <ChevronRight size={16} color={colors.secondary} />
                  </div>
                </Link>

                <Link href={withStore('/employees')} style={card}>
                  <div style={{ ...iconBox, backgroundColor: `${'#6366f1'}15`, color: '#6366f1' }}>
                    <Users size={20} />
                  </div>
                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={label}>Προσωπικό</span>
                      <span style={subLabelStyle}>Διαχείριση ομάδας και πληρωμών</span>
                    </div>
                    <ChevronRight size={16} color={colors.secondary} />
                  </div>
                </Link>
              </div>
            </div>

            {/* Οικονομικός Έλεγχος */}
            <div style={section}>
              <h2 style={sectionTitle}>Οικονομικός Έλεγχος</h2>
              <div style={grid}>
                <Link href={withStore('/settlements')} style={card}>
                  <div style={{ ...iconBox, backgroundColor: `${'#f59e0b'}15`, color: '#f59e0b' }}>
                    <Landmark size={20} />
                  </div>
                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={label}>Δάνεια & Ρυθμίσεις</span>
                      <span style={subLabelStyle}>Παρακολούθηση δόσεων και διακανονισμών</span>
                    </div>
                    <ChevronRight size={16} color={colors.secondary} />
                  </div>
                </Link>

                <Link href={withStore('/goals')} style={card}>
                  <div style={{ ...iconBox, backgroundColor: `${'#7c3aed'}15`, color: '#7c3aed' }}>
                    <Target size={20} />
                  </div>
                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={label}>Στόχοι & Κουμπαράδες</span>
                      <span style={subLabelStyle}>Αποταμίευση για εξοπλισμό και ανάγκες</span>
                    </div>
                    <ChevronRight size={16} color={colors.secondary} />
                  </div>
                </Link>

                {/* Οικονομικό Κέντρο (dropdown card) */}
                <button
                  type="button"
                  onClick={() => setEconomicsOpen((v) => !v)}
                  style={{
                    ...cardBtn,
                    borderBottomLeftRadius: economicsOpen ? 0 : 20,
                    borderBottomRightRadius: economicsOpen ? 0 : 20,
                  }}
                  aria-expanded={economicsOpen}
                >
                  <div style={{ ...iconBox, backgroundColor: `${colors.primary}15`, color: colors.primary }}>
                    <Wallet size={20} />
                  </div>

                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                      <span style={label}>Οικονομικό Κέντρο</span>
                      <span style={subLabelStyle}>Cashflow, Δαπάνες, Πιστώσεις, Αναφορές, Πληρωμές</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {economicsOpen ? <ChevronUp size={18} color={colors.secondary} /> : <ChevronDown size={18} color={colors.secondary} />}
                    </div>
                  </div>
                </button>

                {economicsOpen && (
                  <div style={dropdownWrap}>
                    {economicsLinks.map((l) => (
                      <Link key={l.path} href={withStore(l.path)} style={dropdownItem}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={dropdownLabel}>{l.label}</span>
                          <span style={dropdownSubLabel}>{l.subLabel}</span>
                        </div>
                        <ChevronRight size={16} color={colors.secondary} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Σύστημα & Βοήθεια */}
            <div style={section}>
              <h2 style={sectionTitle}>Σύστημα & Βοήθεια</h2>
              <div style={grid}>
                {isAdmin && (
                  <Link href={withStore('/admin/permissions')} style={card}>
                    <div style={{ ...iconBox, backgroundColor: `${'#64748b'}15`, color: '#64748b' }}>
                      <ShieldCheck size={20} />
                    </div>
                    <div style={labelWrap}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={label}>Δικαιώματα Πρόσβασης</span>
                        <span style={subLabelStyle}>Διαχείριση ρόλων Admin & User</span>
                      </div>
                      <ChevronRight size={16} color={colors.secondary} />
                    </div>
                  </Link>
                )}

                <Link href={withStore('/help')} style={card}>
                  <div style={{ ...iconBox, backgroundColor: `${'#475569'}15`, color: '#475569' }}>
                    <Info size={20} />
                  </div>
                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={label}>Οδηγίες Χρήσης</span>
                      <span style={subLabelStyle}>Αναλυτικό manual εφαρμογής</span>
                    </div>
                    <ChevronRight size={16} color={colors.secondary} />
                  </div>
                </Link>

                <Link href={withStore('/select-store')} style={card}>
                  <div style={{ ...iconBox, backgroundColor: `${colors.primary}15`, color: colors.primary }}>
                    <Store size={20} />
                  </div>
                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={label}>Αλλαγή Καταστήματος</span>
                      <span style={subLabelStyle}>Επιλογή διαφορετικού business unit</span>
                    </div>
                    <ChevronRight size={16} color={colors.secondary} />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </PermissionGuard>
  )
}

export default function ManagementPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Φόρτωση...</div>}>
      <ManagementContent />
    </Suspense>
  )
}

/* ---------------- STYLES ---------------- */

const container: React.CSSProperties = {
  background: colors.background,
  minHeight: '100vh',
  paddingBottom: '110px',
}

const header: React.CSSProperties = {
  padding: '40px 20px 24px 20px',
  background: colors.surface,
  borderBottom: `1px solid ${colors.border}`,
}

const headerTitle: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: 900,
  color: colors.primary,
  margin: 0,
  letterSpacing: '-0.02em',
}

const headerSub: React.CSSProperties = {
  fontSize: '15px',
  color: colors.secondary,
  marginTop: '4px',
  fontWeight: 600,
}

const content: React.CSSProperties = {
  padding: '24px 16px',
  maxWidth: '600px',
  margin: '0 auto',
}

const section: React.CSSProperties = { marginBottom: '32px' }

const sectionTitle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 800,
  color: colors.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '14px',
  marginLeft: '4px',
}

const grid: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '10px' }

const card: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '18px',
  background: colors.surface,
  borderRadius: '20px',
  textDecoration: 'none',
  border: `1px solid ${colors.border}`,
  transition: 'all 0.2s ease',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
}

const cardBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '18px',
  background: colors.surface,
  borderRadius: '20px',
  border: `1px solid ${colors.border}`,
  transition: 'all 0.2s ease',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
}

const iconBox: React.CSSProperties = {
  width: '46px',
  height: '46px',
  borderRadius: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: '16px',
  flexShrink: 0,
}

const labelWrap: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }

const label: React.CSSProperties = { fontSize: '16px', fontWeight: 800, color: colors.primary, lineHeight: 1.2 }

const subLabelStyle: React.CSSProperties = { fontSize: '12px', color: colors.secondary, fontWeight: 500, marginTop: '2px' }

const dropdownWrap: React.CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderTop: 'none',
  borderRadius: '0 0 20px 20px',
  background: colors.surface,
  overflow: 'hidden',
  marginTop: -10,
}

const dropdownItem: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 18px',
  textDecoration: 'none',
  color: colors.primary,
  borderTop: `1px solid ${colors.border}`,
}

const dropdownLabel: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 900,
  color: colors.primary,
}

const dropdownSubLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: colors.secondary,
  marginTop: 2,
}
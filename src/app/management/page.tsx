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
  Home,
} from 'lucide-react'

/* ---------------- CONFIG ---------------- */

// Accent colors only (do not use for neutrals)
const colors = {
  indigo: '#6366f1',
  green: '#10b981',
  orange: '#f59e0b',
  purple: '#7c3aed',
  gray: '#64748b',
  slate: '#475569',
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
      { label: 'Έσοδα', subLabel: 'Income', path: '/economics/income' },
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
            <div style={headerRow}>
              <div>
                <h1 style={headerTitle}>Διαχείριση</h1>
                <p style={headerSub}>Κεντρικός έλεγχος καταστήματος</p>
              </div>

              <Link href={withStore('/')} style={homeBtn} aria-label="Αρχική">
                <Home size={18} />
                Αρχική
              </Link>
            </div>
          </div>

          <div style={content}>
            {/* Οργάνωση Επιχείρησης */}
            <div style={section}>
              <h2 style={sectionTitle}>Οργάνωση Επιχείρησης</h2>
              <div style={grid}>

                <Link href={withStore('/manage-lists')} style={card}>
                  <div style={{ ...iconBox, backgroundColor: `${colors.green}15`, color: colors.green }}>
                    <ListTree size={20} />
                  </div>
                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={label}>Μητρώο & Συνεργάτες</span>
                      <span style={subLabelStyle}>Προμηθευτές, Πηγές Εσόδων, Λογαριασμοί, κ.α.</span>
                    </div>
                    <ChevronRight size={16} color="var(--muted)" />
                  </div>
                </Link>

                <Link href={withStore('/employees')} style={card}>
                  <div style={{ ...iconBox, backgroundColor: `${colors.indigo}15`, color: colors.indigo }}>
                    <Users size={20} />
                  </div>
                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={label}>Προσωπικό</span>
                      <span style={subLabelStyle}>Διαχείριση ομάδας και πληρωμών</span>
                    </div>
                    <ChevronRight size={16} color="var(--muted)" />
                  </div>
                </Link>
              </div>
            </div>

            {/* Οικονομικός Έλεγχος */}
            <div style={section}>
              <h2 style={sectionTitle}>Οικονομικός Έλεγχος</h2>
              <div style={grid}>
                <Link href={withStore('/settlements')} style={card}>
                  <div style={{ ...iconBox, backgroundColor: `${colors.orange}15`, color: colors.orange }}>
                    <Landmark size={20} />
                  </div>
                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={label}>Δάνεια & Ρυθμίσεις</span>
                      <span style={subLabelStyle}>Παρακολούθηση δόσεων και διακανονισμών</span>
                    </div>
                    <ChevronRight size={16} color="var(--muted)" />
                  </div>
                </Link>

                <Link href={withStore('/goals')} style={card}>
                  <div style={{ ...iconBox, backgroundColor: `${colors.purple}15`, color: colors.purple }}>
                    <Target size={20} />
                  </div>
                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={label}>Στόχοι & Κουμπαράδες</span>
                      <span style={subLabelStyle}>Αποταμίευση για εξοπλισμό και ανάγκες</span>
                    </div>
                    <ChevronRight size={16} color="var(--muted)" />
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
                  <div
                    style={{
                      ...iconBox,
                      backgroundColor: 'var(--surfaceSolid)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                  >
                    <Wallet size={20} />
                  </div>

                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                      <span style={label}>Οικονομικό Κέντρο</span>
                      <span style={subLabelStyle}>Έσοδα, Cashflow, Δαπάνες, Πιστώσεις, Αναφορές, Πληρωμές</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {economicsOpen ? (
                        <ChevronUp size={18} color="var(--muted)" />
                      ) : (
                        <ChevronDown size={18} color="var(--muted)" />
                      )}
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
                        <ChevronRight size={16} color="var(--muted)" />
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
                    <div style={{ ...iconBox, backgroundColor: `${colors.gray}15`, color: colors.gray }}>
                      <ShieldCheck size={20} />
                    </div>
                    <div style={labelWrap}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={label}>Δικαιώματα Πρόσβασης</span>
                        <span style={subLabelStyle}>Διαχείριση ρόλων Admin & User</span>
                      </div>
                      <ChevronRight size={16} color="var(--muted)" />
                    </div>
                  </Link>
                )}

                <Link href={withStore('/help')} style={card}>
                  <div style={{ ...iconBox, backgroundColor: `${colors.slate}15`, color: colors.slate }}>
                    <Info size={20} />
                  </div>
                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={label}>Οδηγίες Χρήσης</span>
                      <span style={subLabelStyle}>Αναλυτικό manual εφαρμογής</span>
                    </div>
                    <ChevronRight size={16} color="var(--muted)" />
                  </div>
                </Link>

                <Link href={withStore('/select-store')} style={card}>
                  <div style={{ ...iconBox, backgroundColor: 'var(--surfaceSolid)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <Store size={20} />
                  </div>
                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={label}>Αλλαγή Καταστήματος</span>
                      <span style={subLabelStyle}>Επιλογή διαφορετικού business unit</span>
                    </div>
                    <ChevronRight size={16} color="var(--muted)" />
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
  background: 'var(--bg)',
  color: 'var(--text)',
  minHeight: '100vh',
  paddingBottom: '110px',
}

const header: React.CSSProperties = {
  padding: '34px 20px 22px 20px',
  background: 'var(--surfaceSolid)',
  borderBottom: '1px solid var(--border)',
}

const headerRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
}

const homeBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--surfaceSolid)',
  color: 'var(--text)',
  textDecoration: 'none',
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: 'nowrap',
  boxShadow: 'var(--shadow)',
}

const headerTitle: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: 900,
  color: 'var(--text)',
  margin: 0,
  letterSpacing: '-0.02em',
}

const headerSub: React.CSSProperties = {
  fontSize: '15px',
  color: 'var(--muted)',
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
  color: 'var(--muted)',
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
  background: 'var(--surface)',
  borderRadius: '20px',
  textDecoration: 'none',
  border: '1px solid var(--border)',
  transition: 'all 0.2s ease',
  boxShadow: 'var(--shadow)',
}

const cardBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '18px',
  background: 'var(--surface)',
  borderRadius: '20px',
  border: '1px solid var(--border)',
  transition: 'all 0.2s ease',
  boxShadow: 'var(--shadow)',
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

const label: React.CSSProperties = { fontSize: '16px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }

const subLabelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--muted)', fontWeight: 500, marginTop: '2px' }

const dropdownWrap: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderTop: 'none',
  borderRadius: '0 0 20px 20px',
  background: 'var(--surface)',
  overflow: 'hidden',
  marginTop: -10,
}

const dropdownItem: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 18px',
  textDecoration: 'none',
  color: 'var(--text)',
  borderTop: '1px solid var(--border)',
}

const dropdownLabel: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 900,
  color: 'var(--text)',
}

const dropdownSubLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--muted)',
  marginTop: 2,
}
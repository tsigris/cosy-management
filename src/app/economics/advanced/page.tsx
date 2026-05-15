'use client'

import React, { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import EconomicsShell from '@/components/economics/shell/EconomicsShell'
import { AsyncBoundary, LoadingSkeleton } from '@/components/economics/primitives'
import { economicsColorTokens, economicsSpacing } from '@/components/economics/primitives/tokens'

type LegacyLinkItem = {
  label: string
  sublabel: string
  href: string
}

const LEGACY_REPORTS: LegacyLinkItem[] = [
  { label: 'Έσοδα', sublabel: 'Αναλυτικά έσοδα ανά ημέρα', href: '/economics/income' },
  { label: 'Ταμειακή Ροή', sublabel: 'Ταμειακές κινήσεις', href: '/economics/cashflow' },
  { label: 'Πιστώσεις', sublabel: 'Πιστωτικές εγγραφές', href: '/economics/credits' },
  { label: 'Αναφορές', sublabel: 'Σύνθετες αναφορές', href: '/economics/reports' },
  { label: 'Πληρωμές', sublabel: 'Προγραμματισμένες πληρωμές', href: '/economics/scheduled-payments' },
  { label: 'Κέρδος', sublabel: 'Ανάλυση κερδοφορίας', href: '/economics/profit' },
  { label: 'Μισθοδοσία %', sublabel: 'Ποσοστό μισθοδοσίας', href: '/economics/payroll-percent' },
]

function LegacyLinkList() {
  const searchParams = useSearchParams()

  const withQuery = (href: string) => {
    const qs = searchParams?.toString()
    return qs ? `${href}?${qs}` : href
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: economicsSpacing.sm,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: economicsColorTokens.muted,
          marginBottom: economicsSpacing.xs,
        }}
      >
        Κλασικές Αναφορές
      </div>

      {LEGACY_REPORTS.map((item) => (
        <Link
          key={item.href}
          href={withQuery(item.href)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${economicsSpacing.md}px ${economicsSpacing.md}px`,
            borderRadius: 14,
            border: `1px solid ${economicsColorTokens.border}`,
            background: economicsColorTokens.surface,
            textDecoration: 'none',
            gap: economicsSpacing.sm,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: economicsColorTokens.text,
                lineHeight: 1.3,
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: economicsColorTokens.muted,
                marginTop: 2,
              }}
            >
              {item.sublabel}
            </div>
          </div>
          <div
            style={{
              fontSize: 18,
              color: economicsColorTokens.muted,
              flexShrink: 0,
            }}
          >
            →
          </div>
        </Link>
      ))}
    </div>
  )
}

/**
 * /economics/advanced — demoted legacy reports hub.
 *
 * Old report surfaces are kept alive here.
 * The primary workflow is Home → Days → Expenses.
 * Advanced is for operators who need legacy detail.
 */
export default function EconomicsAdvancedPage() {
  return (
    <EconomicsShell showBottomNav={true}>
      <Suspense fallback={<LoadingSkeleton lines={5} label="Φόρτωση αναφορών" />}>
        <AsyncBoundary area="advanced">
          <LegacyLinkList />
        </AsyncBoundary>
      </Suspense>
    </EconomicsShell>
  )
}

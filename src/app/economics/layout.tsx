'use client'

import { EconomicsRouteProviders } from '@/components/economics/shell/EconomicsRouteProviders'

export default function EconomicsLayout({ children }: { children: React.ReactNode }) {
  return <EconomicsRouteProviders>{children}</EconomicsRouteProviders>
}

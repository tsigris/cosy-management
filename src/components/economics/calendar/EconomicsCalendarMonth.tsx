'use client'

import React, { useCallback } from 'react'
import type { EconomicsCalendarSeriesDto, EconomicsDayDetailDto } from '@/lib/economics/types/economicsDto'
import { EconomicsCalendarGrid } from './EconomicsCalendarGrid'
import { EconomicsDayDrawer, DAY_DRAWER_ID } from './EconomicsDayDrawer'
import { AsyncBoundary } from '@/components/economics/primitives/AsyncBoundary'
import { LoadingSkeleton } from '@/components/economics/primitives/LoadingSkeleton'
import { EmptyState } from '@/components/economics/primitives/EmptyState'
import { useSelectedDay } from '@/components/economics/shell/SelectedDayProvider'
import { useBottomSheet } from '@/components/economics/shell/DrawerProvider'
import { economicsColorTokens, economicsSpacing } from '@/components/economics/primitives/tokens'

type EconomicsCalendarMonthProps = {
  series: EconomicsCalendarSeriesDto | null
  dayDetail: EconomicsDayDetailDto | null
  calendarLoading?: boolean
  detailLoading?: boolean
}

export function EconomicsCalendarMonth({
  series,
  dayDetail,
  calendarLoading = false,
  detailLoading = false,
}: EconomicsCalendarMonthProps) {
  const { selectedDay, setSelectedDay } = useSelectedDay()
  const { openDrawer } = useBottomSheet()

  // Selecting a day opens the drawer. Calendar remains interactive.
  const handleSelectDay = useCallback(
    (date: string) => {
      setSelectedDay(date)
      openDrawer(DAY_DRAWER_ID)
    },
    [setSelectedDay, openDrawer],
  )

  return (
    <div style={{ width: '100%' }}>
      {/* Month header */}
      {series?.monthLabel && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: economicsColorTokens.text,
            marginBottom: economicsSpacing.md,
            paddingLeft: 2,
          }}
        >
          {series.monthLabel}
        </div>
      )}

      {/* Calendar grid — isolated async boundary.
          Drawer and detail failures do NOT crash the calendar. */}
      <AsyncBoundary area="calendar">
        {calendarLoading ? (
          <LoadingSkeleton lines={5} label="Φόρτωση ημερολογίου" />
        ) : !series || series.days.length === 0 ? (
          <EmptyState
            title="Δεν υπάρχουν δεδομένα"
            description="Δεν βρέθηκαν ημέρες για αυτή την περίοδο."
          />
        ) : (
          <EconomicsCalendarGrid
            days={series.days}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
          />
        )}
      </AsyncBoundary>

      {/* Drawer — rendered outside the calendar's async boundary.
          Drawer failures remain isolated from calendar interactivity. */}
      <EconomicsDayDrawer
        selectedDay={selectedDay}
        detail={dayDetail}
        loading={detailLoading}
      />
    </div>
  )
}

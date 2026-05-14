import type { EconomicsCalendarSeriesDto } from '@/lib/economics/types/economicsDto'

export function mapCalendarSeries(dto: EconomicsCalendarSeriesDto) {
  return {
    ...dto,
    days: dto.days.map((day) => ({ ...day })),
  }
}

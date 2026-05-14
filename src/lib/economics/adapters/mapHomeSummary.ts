import type { EconomicsHomeSummaryDto } from '@/lib/economics/types/economicsDto'

export function mapHomeSummary(dto: EconomicsHomeSummaryDto) {
  return { ...dto }
}

import type { EconomicsComparisonDto } from '@/lib/economics/types/economicsDto'

export function mapComparisonSummary(dto: EconomicsComparisonDto) {
  return { ...dto }
}

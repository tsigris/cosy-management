import type { EconomicsExpenseSearchDto } from '@/lib/economics/types/economicsDto'

export function mapExpenseSearch(dto: EconomicsExpenseSearchDto) {
  return {
    ...dto,
    results: dto.results.map((item) => ({ ...item })),
  }
}

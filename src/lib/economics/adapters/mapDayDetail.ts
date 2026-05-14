import type { EconomicsDayDetailDto } from '@/lib/economics/types/economicsDto'

export function mapDayDetail(dto: EconomicsDayDetailDto) {
  return {
    ...dto,
    transactions: dto.transactions.map((transaction) => ({ ...transaction })),
  }
}

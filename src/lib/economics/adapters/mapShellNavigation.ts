import type {
  EconomicsNavigationItemDto,
  EconomicsRouteId,
} from '@/lib/economics/types/economicsDto'
import type { EconomicsNavItemViewModel } from '@/lib/economics/types/economicsViewModel'

export function mapShellNavigation(
  items: EconomicsNavigationItemDto[],
  activeRoute: EconomicsRouteId,
): EconomicsNavItemViewModel[] {
  return items.map((item) => ({
    ...item,
    active: item.id === activeRoute,
  }))
}

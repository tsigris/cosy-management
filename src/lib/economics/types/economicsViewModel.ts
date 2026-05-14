import type {
  EconomicsRouteId,
  EconomicsNavigationItemDto,
} from './economicsDto'

export type EconomicsNavItemViewModel = EconomicsNavigationItemDto & {
  active: boolean
}

export type EconomicsShellViewModel = {
  storeLabel: string
  activeRoute: EconomicsRouteId
  navItems: EconomicsNavItemViewModel[]
}

export type EconomicsSurfaceState = {
  title: string
  subtitle?: string
}

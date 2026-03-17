/**
 * Canonical store resolution helpers.
 *
 * Rule (enforced throughout the app):
 *   1. URL query param `?store=` takes absolute priority.
 *   2. `localStorage.active_store_id` is the fallback only when the URL param is absent.
 *   3. localStorage can NEVER override an explicit URL store.
 */

type SearchParamsLike = { get(key: string): string | null }

/**
 * Returns the store id from the URL `?store=` query param.
 * Returns null when the param is absent or blank.
 */
export function getUrlStoreId(searchParams: SearchParamsLike): string | null {
  const id = searchParams.get('store')
  return id ? id.trim() || null : null
}

/**
 * Returns the active store id from localStorage.
 * SSR-safe: returns null when called on the server.
 */
export function getStoredActiveStoreId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('active_store_id')?.trim() || null
}

/**
 * Canonical resolution: URL param first, localStorage only as fallback.
 * SSR-safe: on the server only the URL param contributes.
 */
export function resolveActiveStoreId(searchParams: SearchParamsLike): string | null {
  return getUrlStoreId(searchParams) ?? getStoredActiveStoreId()
}

/**
 * Writes the given store id to localStorage.
 * Call this when the URL has an explicit store to keep localStorage in sync.
 * SSR-safe: no-op on the server.
 */
export function syncStoreToStorage(storeId: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('active_store_id', storeId)
  } catch {
    // localStorage may be unavailable (e.g. private-browsing quota)
  }
}

/**
 * Removes the stored active store from localStorage.
 * Call on logout to clear tenant context.
 * SSR-safe: no-op on the server.
 */
export function clearStoredActiveStoreId(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('active_store_id')
}

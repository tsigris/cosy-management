'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getCurrentStoreId, fetchProductsByStore, fetchSuppliersByStore } from '@/lib/productsModule'
import { toast, Toaster } from 'sonner'
import { ChevronLeft, Search } from 'lucide-react'

type SupplierPriceLite = {
  supplierName: string
  lastPrice: number | null
  lastPriceDate: string | null
  priceDiff: number | null
}

type ProductCompareCard = {
  productId: string
  productName: string
  category: string | null
  suppliers: SupplierPriceLite[]
  cheapest: number | null
  highest: number | null
  spread: number | null
}

const colors = {
  primaryDark: '#0f172a',
  secondaryText: '#64748b',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
}

function PriceComparisonContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = getCurrentStoreId(searchParams)

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [cards, setCards] = useState<ProductCompareCard[]>([])
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (!storeId) router.replace('/select-store')
  }, [storeId, router])

  const load = useCallback(async () => {
    if (!storeId) return
    try {
      setLoading(true)

      const [productsResult, suppliersList] = await Promise.all([
        fetchProductsByStore(supabase, storeId, { search, limit: 200, offset: 0 }),
        fetchSuppliersByStore(supabase, storeId),
      ])

      setSuppliers(suppliersList.map((s) => ({ id: s.id, name: s.name })))

      const productIds = productsResult.items.map((p) => p.id)
      if (productIds.length === 0) {
        setCards([])
        return
      }

      const { data: supplierProducts, error: supplierProductsError } = await supabase
        .from('supplier_products')
        .select('product_id,supplier_id,last_price,last_price_date')
        .eq('store_id', storeId)
        .in('product_id', productIds)
        .eq('is_active', true)

      if (supplierProductsError) throw supplierProductsError

      const { data: priceHistory, error: historyError } = await supabase
        .from('product_price_history')
        .select('product_id,supplier_id,invoice_date,price_diff')
        .eq('store_id', storeId)
        .in('product_id', productIds)
        .order('invoice_date', { ascending: false })
        .limit(5000)

      if (historyError) throw historyError

      const supplierNameById = new Map(suppliersList.map((s) => [s.id, s.name]))
      const latestDiffKey = new Map<string, number | null>()

      for (const row of priceHistory || []) {
        const productId = String((row as any).product_id || '')
        const supplierId = String((row as any).supplier_id || '')
        if (!productId || !supplierId) continue
        const key = `${productId}::${supplierId}`
        if (latestDiffKey.has(key)) continue
        const diff = (row as any).price_diff
        latestDiffKey.set(key, typeof diff === 'number' ? diff : null)
      }

      const grouped = new Map<string, SupplierPriceLite[]>()
      for (const row of supplierProducts || []) {
        const productId = String((row as any).product_id || '')
        const supplierId = String((row as any).supplier_id || '')
        if (!productId || !supplierId) continue

        if (supplierFilter !== 'all' && supplierId !== supplierFilter) continue

        const key = `${productId}::${supplierId}`
        const list = grouped.get(productId) || []
        list.push({
          supplierName: supplierNameById.get(supplierId) || '—',
          lastPrice: typeof (row as any).last_price === 'number' ? (row as any).last_price : null,
          lastPriceDate: typeof (row as any).last_price_date === 'string' ? (row as any).last_price_date : null,
          priceDiff: latestDiffKey.get(key) ?? null,
        })
        grouped.set(productId, list)
      }

      const nextCards: ProductCompareCard[] = productsResult.items
        .map((product) => {
          const productSuppliers = grouped.get(product.id) || []
          const prices = productSuppliers
            .map((s) => s.lastPrice)
            .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
          const cheapest = prices.length > 0 ? Math.min(...prices) : null
          const highest = prices.length > 0 ? Math.max(...prices) : null
          const spread = cheapest !== null && highest !== null ? highest - cheapest : null

          return {
            productId: product.id,
            productName: product.name,
            category: product.category,
            suppliers: productSuppliers.sort((a, b) => (a.lastPrice ?? Number.MAX_SAFE_INTEGER) - (b.lastPrice ?? Number.MAX_SAFE_INTEGER)),
            cheapest,
            highest,
            spread,
          }
        })
        .filter((c) => c.suppliers.length > 0)

      setCards(nextCards)
    } catch (error) {
      console.error('[price-comparison] load failed', error)
      toast.error('Αποτυχία φόρτωσης σύγκρισης τιμών')
      setCards([])
    } finally {
      setLoading(false)
    }
  }, [storeId, supabase, search, supplierFilter])

  useEffect(() => {
    void load()
  }, [load])

  const supplierOptions = useMemo(
    () => [{ id: 'all', name: 'Όλοι' }, ...suppliers],
    [suppliers],
  )

  if (!storeId) return null

  return (
    <div style={wrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 80 }}>
        <header style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Σύγκριση Τιμών</h1>
            <p style={subtitleStyle}>Ανά προϊόν / προμηθευτή</p>
          </div>
          <Link href={`/?store=${storeId}`} style={backBtnStyle}>
            <ChevronLeft size={20} />
          </Link>
        </header>

        <div style={filterCard}>
          <label style={labelStyle}><Search size={14} /> Αναζήτηση προϊόντος</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} placeholder="π.χ. Γάλα" />
          <label style={{ ...labelStyle, marginTop: 10 }}>Φίλτρο προμηθευτή</label>
          <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} style={inputStyle}>
            {supplierOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={card}>Φόρτωση...</div>
        ) : cards.length === 0 ? (
          <div style={card}>Δεν βρέθηκαν αποτελέσματα.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cards.map((cardRow) => (
              <div key={cardRow.productId} style={card}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{cardRow.productName}</p>
                <p style={{ margin: '4px 0 10px 0', fontSize: 12, fontWeight: 700, color: colors.secondaryText }}>{cardRow.category || '—'}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cardRow.suppliers.map((s, idx) => {
                    const badge = s.priceDiff === null ? null : s.priceDiff > 0 ? 'Αύξηση' : s.priceDiff < 0 ? 'Μείωση' : null
                    return (
                      <div key={`${cardRow.productId}-${idx}`} style={innerCard}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 900 }}>{s.supplierName}</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: 12, fontWeight: 700 }}>Τιμή: {s.lastPrice !== null ? `${s.lastPrice.toFixed(2)}€` : '—'}</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: 12, fontWeight: 700, color: colors.secondaryText }}>Ημ/νία: {s.lastPriceDate || '—'}</p>
                        {badge && (
                          <span style={{ ...badgeStyle, backgroundColor: badge === 'Αύξηση' ? '#fee2e2' : '#dcfce7', color: badge === 'Αύξηση' ? '#b91c1c' : '#166534' }}>
                            {badge}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <Stat label="Φθηνότερο" value={cardRow.cheapest !== null ? `${cardRow.cheapest.toFixed(2)}€` : '—'} />
                  <Stat label="Ακριβότερο" value={cardRow.highest !== null ? `${cardRow.highest.toFixed(2)}€` : '—'} />
                  <Stat label="Spread" value={cardRow.spread !== null ? `${cardRow.spread.toFixed(2)}€` : '—'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, padding: 8, backgroundColor: '#f8fafc' }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: colors.secondaryText }}>{label}</p>
      <p style={{ margin: '4px 0 0 0', fontSize: 13, fontWeight: 900 }}>{value}</p>
    </div>
  )
}

export default function PriceComparisonPage() {
  return (
    <Suspense fallback={null}>
      <PriceComparisonContent />
    </Suspense>
  )
}

const wrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: 20 }
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }
const titleStyle = { margin: 0, fontWeight: 900, fontSize: 24, color: colors.primaryDark }
const subtitleStyle = { margin: '4px 0 0 0', fontWeight: 700, fontSize: 12, color: colors.secondaryText }
const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondaryText,
  width: 40,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  backgroundColor: colors.white,
}
const filterCard: any = { backgroundColor: colors.white, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, marginBottom: 12 }
const labelStyle: any = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, color: colors.secondaryText, marginBottom: 6 }
const inputStyle: any = { width: '100%', border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, fontSize: 16, fontWeight: 700, backgroundColor: '#f8fafc' }
const card: any = { backgroundColor: colors.white, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 12 }
const innerCard: any = { border: `1px solid ${colors.border}`, borderRadius: 10, padding: 8, backgroundColor: '#f8fafc' }
const badgeStyle: any = { marginTop: 6, display: 'inline-block', borderRadius: 999, padding: '4px 8px', fontWeight: 800, fontSize: 11 }

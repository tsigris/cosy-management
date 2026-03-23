'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { fetchProductsByStore, getCurrentStoreId, type ProductListItem } from '@/lib/productsModule'
import { toast, Toaster } from 'sonner'
import { ChevronLeft, Package2, Search, Filter } from 'lucide-react'

const colors = {
  primaryDark: '#0f172a',
  secondaryText: '#64748b',
  accentBlue: '#2563eb',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
}

const PAGE_SIZE = 20

function ProductsContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = getCurrentStoreId(searchParams)

  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [items, setItems] = useState<ProductListItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    if (!storeId) router.replace('/select-store')
  }, [storeId, router])

  const load = useCallback(
    async (mode: 'reset' | 'more') => {
      if (!storeId) return
      try {
        if (mode === 'reset') {
          setLoading(true)
          setOffset(0)
        } else {
          setLoadingMore(true)
        }

        const nextOffset = mode === 'reset' ? 0 : offset
        const result = await fetchProductsByStore(supabase, storeId, {
          search,
          category,
          limit: PAGE_SIZE,
          offset: nextOffset,
        })

        setTotal(result.total)
        if (mode === 'reset') {
          setItems(result.items)
          setOffset(result.items.length)
        } else {
          setItems((prev) => [...prev, ...result.items])
          setOffset(nextOffset + result.items.length)
        }
      } catch (error) {
        console.error('[products] load failed', error)
        toast.error('Αποτυχία φόρτωσης προϊόντων')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [storeId, supabase, search, category, offset],
  )

  const loadCategories = useCallback(async () => {
    if (!storeId) return
    try {
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .eq('store_id', storeId)
        .eq('is_active', true)
      if (error) throw error
      const unique = Array.from(
        new Set(
          (data || [])
            .map((r: any) => String(r.category || '').trim())
            .filter((v) => v.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, 'el-GR'))
      setCategories(unique)
    } catch (error) {
      console.error('[products] loadCategories failed', error)
    }
  }, [storeId, supabase])

  useEffect(() => {
    void load('reset')
  }, [load])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  const canLoadMore = useMemo(() => items.length < total, [items.length, total])

  if (!storeId) return null

  return (
    <div style={wrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 80 }}>
        <header style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Προϊόντα</h1>
            <p style={subtitleStyle}>Σύνολο: {total}</p>
          </div>
          <Link href={`/?store=${storeId}`} style={backBtnStyle}>
            <ChevronLeft size={20} />
          </Link>
        </header>

        <div style={filterCard}>
          <label style={labelStyle}>
            <Search size={14} /> Αναζήτηση
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Όνομα προϊόντος"
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: 10 }}>
            <Filter size={14} /> Κατηγορία
          </label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            <option value="all">Όλες</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={emptyState}>Φόρτωση...</div>
        ) : items.length === 0 ? (
          <div style={emptyState}>Δεν βρέθηκαν προϊόντα.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item) => (
              <Link key={item.id} href={`/products/${item.id}?store=${storeId}`} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <p style={nameStyle}>{item.name}</p>
                    <p style={metaStyle}>{item.brand || '—'} • {item.category || '—'} • {item.unit || '—'}</p>
                    <p style={metaStyle}>Barcode: {item.baseBarcode || '—'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={priceStyle}>{item.latestPrice !== null ? `${item.latestPrice.toFixed(2)}€` : '—'}</p>
                    <p style={metaStyle}>{item.latestPriceDate || 'Χωρίς τιμή'}</p>
                    <p style={pillStyle}>{item.supplierCount} προμηθευτές</p>
                  </div>
                </div>
              </Link>
            ))}

            {canLoadMore && (
              <button
                type="button"
                onClick={() => void load('more')}
                disabled={loadingMore}
                style={loadMoreBtn}
              >
                {loadingMore ? 'Φόρτωση...' : 'Φόρτωσε περισσότερα'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsContent />
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
const filterCard: any = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: 16,
  padding: 12,
  marginBottom: 12,
}
const labelStyle: any = { display: 'flex', gap: 6, alignItems: 'center', fontWeight: 800, fontSize: 11, color: colors.secondaryText, marginBottom: 6 }
const inputStyle: any = {
  width: '100%',
  padding: 14,
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 700,
  backgroundColor: '#f8fafc',
}
const emptyState: any = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: 16,
  padding: 18,
  textAlign: 'center',
  color: colors.secondaryText,
  fontWeight: 800,
}
const cardStyle: any = {
  textDecoration: 'none',
  color: colors.primaryDark,
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: 14,
  padding: 12,
}
const nameStyle = { margin: 0, fontWeight: 900, fontSize: 16 }
const metaStyle = { margin: '4px 0 0 0', fontWeight: 700, fontSize: 12, color: colors.secondaryText }
const priceStyle = { margin: 0, fontWeight: 900, fontSize: 18, color: colors.primaryDark }
const pillStyle: any = {
  marginTop: 6,
  display: 'inline-block',
  padding: '4px 8px',
  borderRadius: 999,
  backgroundColor: '#eff6ff',
  color: '#1d4ed8',
  fontWeight: 800,
  fontSize: 11,
}
const loadMoreBtn: any = {
  width: '100%',
  border: 'none',
  borderRadius: 12,
  backgroundColor: colors.primaryDark,
  color: 'white',
  padding: 14,
  fontSize: 15,
  fontWeight: 900,
}

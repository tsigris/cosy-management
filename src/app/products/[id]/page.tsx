'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { fetchProductDetails, getCurrentStoreId, type ProductDetailsResult } from '@/lib/productsModule'
import { toast, Toaster } from 'sonner'
import { ChevronLeft } from 'lucide-react'

const colors = {
  primaryDark: '#0f172a',
  secondaryText: '#64748b',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
}

function ProductDetailsContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams<{ id: string }>()

  const storeId = getCurrentStoreId(searchParams)
  const productId = typeof params?.id === 'string' ? params.id : ''

  const [loading, setLoading] = useState(true)
  const [details, setDetails] = useState<ProductDetailsResult | null>(null)

  useEffect(() => {
    if (!storeId) router.replace('/select-store')
  }, [storeId, router])

  const load = useCallback(async () => {
    if (!storeId || !productId) return
    try {
      setLoading(true)
      const result = await fetchProductDetails(supabase, storeId, productId)
      setDetails(result)
    } catch (error) {
      console.error('[product-details] load failed', error)
      toast.error('Αποτυχία φόρτωσης προϊόντος')
      setDetails(null)
    } finally {
      setLoading(false)
    }
  }, [supabase, storeId, productId])

  useEffect(() => {
    void load()
  }, [load])

  if (!storeId) return null

  return (
    <div style={wrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 80 }}>
        <header style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Λεπτομέρειες Προϊόντος</h1>
            <p style={subtitleStyle}>{details?.product.name || '—'}</p>
          </div>
          <Link href={`/products?store=${storeId}`} style={backBtnStyle}>
            <ChevronLeft size={20} />
          </Link>
        </header>

        {loading ? (
          <div style={card}>Φόρτωση...</div>
        ) : !details ? (
          <div style={card}>Το προϊόν δεν βρέθηκε.</div>
        ) : (
          <>
            <div style={card}>
              <p style={sectionTitle}>{details.product.name}</p>
              <p style={line}>Brand: {details.product.brand || '—'}</p>
              <p style={line}>Κατηγορία: {details.product.category || '—'}</p>
              <p style={line}>Μονάδα: {details.product.unit || '—'}</p>
              <p style={line}>Barcode: {details.product.baseBarcode || '—'}</p>
            </div>

            <div style={card}>
              <p style={sectionTitle}>Τρέχουσες Τιμές ανά Προμηθευτή</p>
              {details.currentSupplierPrices.length === 0 ? (
                <p style={muted}>Δεν υπάρχουν mappings.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {details.currentSupplierPrices.map((row) => (
                    <div key={row.supplierProductId} style={innerCard}>
                      <p style={lineStrong}>{row.supplierName}</p>
                      <p style={line}>Προϊόν προμηθευτή: {row.supplierProductName || '—'}</p>
                      <p style={line}>Barcode key: {row.supplierBarcodeKey || '—'}</p>
                      <p style={line}>Τελευταία τιμή: {row.lastPrice !== null ? `${row.lastPrice.toFixed(2)}€` : '—'}</p>
                      <p style={line}>Ημ/νία: {row.lastPriceDate || '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={card}>
              <p style={sectionTitle}>Ιστορικό Τιμών</p>
              {details.priceHistory.length === 0 ? (
                <p style={muted}>Δεν υπάρχουν τιμές ιστορικού.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {details.priceHistory.map((h) => (
                    <div key={h.id} style={innerCard}>
                      <p style={lineStrong}>{h.invoiceDate} • {h.supplierName}</p>
                      <p style={line}>Τιμή: {h.price.toFixed(2)}€</p>
                      <p style={line}>Προηγούμενη: {h.previousPrice !== null ? `${h.previousPrice.toFixed(2)}€` : '—'}</p>
                      <p style={line}>Διαφορά: {h.priceDiff !== null ? `${h.priceDiff.toFixed(2)}€` : '—'}</p>
                      <p style={line}>Source: {h.source}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={card}>
              <p style={sectionTitle}>AI Matching Memory</p>
              {details.matchMemory.length === 0 ? (
                <p style={muted}>Δεν υπάρχουν entries.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {details.matchMemory.map((m) => (
                    <div key={m.id} style={innerCard}>
                      <p style={line}>raw_text: {m.rawText}</p>
                      <p style={line}>raw_barcode: {m.rawBarcode || '—'}</p>
                      <p style={line}>matched: {m.matchedProductName || '—'}</p>
                      <p style={line}>usage_count: {m.usageCount}</p>
                      <p style={line}>confidence: {m.confidence !== null ? m.confidence.toFixed(2) : '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ProductDetailsPage() {
  return (
    <Suspense fallback={null}>
      <ProductDetailsContent />
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
const card: any = { backgroundColor: colors.white, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, marginBottom: 10 }
const innerCard: any = { border: `1px solid ${colors.border}`, borderRadius: 12, padding: 10, backgroundColor: '#f8fafc' }
const sectionTitle = { margin: '0 0 10px 0', fontSize: 14, fontWeight: 900, color: colors.primaryDark }
const line = { margin: '3px 0 0 0', fontSize: 12, fontWeight: 700, color: colors.secondaryText }
const lineStrong = { margin: 0, fontSize: 13, fontWeight: 900, color: colors.primaryDark }
const muted = { margin: 0, fontSize: 12, fontWeight: 700, color: colors.secondaryText }

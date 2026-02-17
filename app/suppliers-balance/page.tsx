'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { ChevronLeft, Receipt, CreditCard, Filter, Hash, Landmark } from 'lucide-react'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentOrange: '#f97316',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  accentBlue: '#2563eb',
  accentRed: '#dc2626',
}

const isValidUUID = (id: any) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof id === 'string' && regex.test(id)
}

const normalize = (v: any) => String(v ?? '').trim().toLowerCase()

// Badge/Label mapping (includes Maintenance category)
const getEntityBadge = (entity: any) => {
  // Suppliers are always goods
  if (entity?.entityType === 'supplier') {
    return { text: 'ΕΜΠΟΡΕΥΜΑΤΑ', bg: '#f1f5f9', color: colors.secondaryText }
  }

  // Assets: map sub_category (or category fallback) to labels
  const sub = normalize(entity?.sub_category)
  const cat = normalize(entity?.category) // fallback if you ever store it here

  const isMaintenance = sub === 'maintenance' || cat === 'maintenance'
  const isUtility = sub === 'utility' || cat === 'utility'

  if (isMaintenance) {
    return { text: 'ΣΥΝΤΗΡΗΣΗ', bg: '#fef3c7', color: '#b45309' }
  }
  if (isUtility) {
    return { text: 'ΛΟΓΑΡΙΑΣΜΟΣ', bg: '#f1f5f9', color: colors.secondaryText }
  }

  // Other asset types
  return { text: 'ΛΟΙΠΑ', bg: '#f1f5f9', color: colors.secondaryText }
}

function BalancesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdFromUrl = searchParams.get('store')

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all')

  const fetchBalances = useCallback(async () => {
    if (!storeIdFromUrl || !isValidUUID(storeIdFromUrl)) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Φέρνουμε Προμηθευτές, Πάγια (για Συντήρηση/Λογαριασμούς) και όλες τις Συναλλαγές
      const [supsRes, assetsRes, transRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('store_id', storeIdFromUrl),
        supabase.from('fixed_assets').select('*').eq('store_id', storeIdFromUrl),
        supabase.from('transactions').select('*').eq('store_id', storeIdFromUrl),
      ])

      if (supsRes.error) throw supsRes.error
      if (assetsRes.error) throw assetsRes.error
      if (transRes.error) throw transRes.error

      const suppliers = (supsRes.data || []).map((s) => ({ ...s, entityType: 'supplier' }))

      /**
       * ✅ UPDATE DATA FETCHING:
       * Συμπεριλαμβάνουμε όλες τις εγγραφές με sub_category === 'Maintenance'
       * (και κρατάμε utility/other όπως πριν).
       * Επιπλέον: κάνουμε case-insensitive/defensive match.
       */
      const assets = (assetsRes.data || [])
        .filter((a) => {
          const sub = normalize(a?.sub_category)
          const cat = normalize(a?.category) // fallback, αν υπάρχει
          return (
            sub === 'maintenance' ||
            sub === 'utility' ||
            sub === 'other' ||
            cat === 'maintenance' ||
            cat === 'utility' ||
            cat === 'other'
          )
        })
        .map((a) => ({ ...a, entityType: 'asset' }))

      const allEntities = [...suppliers, ...assets]
      const transactions = transRes.data || []

      const balanceList = allEntities
        .map((entity) => {
          const isSup = entity.entityType === 'supplier'

          // Βρίσκουμε συναλλαγές είτε από supplier_id είτε από fixed_asset_id
          const entityTrans = transactions.filter((t) =>
            isSup ? t.supplier_id === entity.id : t.fixed_asset_id === entity.id
          )

          const totalCredit = entityTrans
            .filter((t) => t.is_credit === true)
            .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

          const totalPaid = entityTrans
            .filter((t) => t.type === 'debt_payment')
            .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

          return {
            ...entity,
            balance: totalCredit - totalPaid,
          }
        })
        .filter((e) => Math.abs(e.balance) > 0.1) // Μόνο όσα έχουν υπόλοιπο
        .sort((a, b) => b.balance - a.balance)

      setData(balanceList)
    } catch (err: any) {
      console.error(err)
      toast.error('Σφάλμα κατά τον υπολογισμό υπολοίπων')
    } finally {
      setLoading(false)
    }
  }, [storeIdFromUrl])

  useEffect(() => {
    if (!storeIdFromUrl || !isValidUUID(storeIdFromUrl)) {
      router.replace('/select-store')
    } else {
      fetchBalances()
    }
  }, [fetchBalances, storeIdFromUrl, router])

  const filteredData = useMemo(() => {
    if (selectedEntityId === 'all') return data
    return data.filter((s) => s.id === selectedEntityId)
  }, [selectedEntityId, data])

  /**
   * ✅ TOTAL CALCULATION:
   * Το "Συνολικό Ανοιχτό Υπόλοιπο" αθροίζει ΟΛΑ τα balances (suppliers + Maintenance + utilities + other)
   */
  const totalDebtDisplay = filteredData.reduce((acc, s) => acc + (Number(s.balance) || 0), 0)

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '120px' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>
              <Receipt size={22} color="#f97316" />
            </div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '20px', margin: 0, color: colors.primaryDark }}>Καρτέλες</h1>
              <p style={{ margin: 0, fontSize: '10px', color: colors.secondaryText, fontWeight: '700', letterSpacing: '1px' }}>
                ΥΠΟΛΟΙΠΑ & ΟΦΕΙΛΕΣ
              </p>
            </div>
          </div>
          <Link href={`/?store=${storeIdFromUrl}`} style={backBtnStyle}>
            <ChevronLeft size={20} />
          </Link>
        </div>

        {/* SELECT FILTER */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ position: 'relative' }}>
            <Filter size={16} style={{ position: 'absolute', left: '12px', top: '16px', color: colors.secondaryText }} />
            <select value={selectedEntityId} onChange={(e) => setSelectedEntityId(e.target.value)} style={selectStyle}>
              <option value="all">ΟΛΕΣ ΟΙ ΟΦΕΙΛΕΣ</option>
              {data.map((s) => (
                <option key={s.id} value={s.id}>
                  {String(s.name || '').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TOTAL DEBT CARD */}
        <div style={totalCardStyle}>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#fed7aa', letterSpacing: '1px' }}>
            ΣΥΝΟΛΙΚΟ ΑΝΟΙΧΤΟ ΥΠΟΛΟΙΠΟ
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '38px', fontWeight: '900', color: '#ffffff' }}>
            {totalDebtDisplay.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€
          </p>
        </div>

        {/* LIST AREA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>Υπολογισμός...</div>
          ) : filteredData.length > 0 ? (
            filteredData.map((s) => {
              /**
               * ✅ UI LABELS / CATEGORY MAPPING:
               * Για τεχνικούς/συντήρηση (fixed_assets sub_category Maintenance), το badge γράφει πάντα "ΣΥΝΤΗΡΗΣΗ".
               */
              const badge = getEntityBadge(s)

              return (
                <div key={s.id} style={supplierCardStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontWeight: '800', margin: 0, fontSize: '15px', color: colors.primaryDark }}>
                        {String(s.name || '').toUpperCase()}
                      </p>

                      <span
                        style={{
                          ...badgeStyle,
                          backgroundColor: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {badge.text}
                      </span>
                    </div>

                    {/* RF & ΤΡΑΠΕΖΑ ΠΕΔΙΑ */}
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {s.rf_code && (
                        <div style={infoRow}>
                          <Hash size={12} /> <span style={infoText}>RF: {s.rf_code}</span>
                        </div>
                      )}
                      {s.bank_name && (
                        <div style={infoRow}>
                          <Landmark size={12} /> <span style={infoText}>{String(s.bank_name).toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: 'right',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                    }}
                  >
                    <p style={{ fontWeight: '900', fontSize: '18px', color: colors.accentOrange, margin: 0 }}>
                      {(Number(s.balance) || 0).toFixed(2)}€
                    </p>
                    <button
                      onClick={() =>
                        router.push(
                          `/add-expense?store=${storeIdFromUrl}&${s.entityType === 'supplier' ? 'supId' : 'assetId'}=${s.id}&mode=debt`
                        )
                      }
                      style={payBtnStyle}
                    >
                      <CreditCard size={14} /> ΕΞΟΦΛΗΣΗ
                    </button>
                  </div>
                </div>
              )
            })
          ) : (
            <div style={emptyStateStyle}>Δεν υπάρχουν εκκρεμότητες</div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- STYLES ---
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', position: 'relative' }
const logoBoxStyle: any = {
  width: '45px',
  height: '45px',
  backgroundColor: '#fff7ed',
  borderRadius: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondaryText,
  backgroundColor: colors.white,
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '12px',
  border: `1px solid ${colors.border}`,
}
const totalCardStyle: any = {
  backgroundColor: colors.primaryDark,
  padding: '30px 20px',
  borderRadius: '24px',
  marginBottom: '30px',
  textAlign: 'center',
  color: 'white',
}
const supplierCardStyle: any = {
  backgroundColor: colors.white,
  padding: '18px',
  borderRadius: '20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'stretch',
  border: `1px solid ${colors.border}`,
}
const payBtnStyle: any = {
  backgroundColor: '#eff6ff',
  color: colors.accentBlue,
  border: `1px solid #dbeafe`,
  padding: '8px 12px',
  borderRadius: '10px',
  fontSize: '10px',
  fontWeight: '900',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
}
const badgeStyle: any = {
  fontSize: '9px',
  fontWeight: '800',
  padding: '4px 8px',
  borderRadius: '6px',
  marginTop: '6px',
  display: 'inline-block',
  textTransform: 'uppercase',
}
const infoRow: any = { display: 'flex', alignItems: 'center', gap: '6px', color: colors.secondaryText }
const infoText: any = { fontSize: '11px', fontWeight: '700' }
const emptyStateStyle: any = {
  textAlign: 'center',
  padding: '60px 20px',
  background: colors.white,
  borderRadius: '24px',
  border: `2px dashed ${colors.border}`,
  color: colors.secondaryText,
  fontWeight: '700',
}
const selectStyle: any = {
  width: '100%',
  padding: '14px 14px 14px 40px',
  borderRadius: '14px',
  border: `1px solid ${colors.border}`,
  fontSize: '13px',
  fontWeight: '700',
  backgroundColor: colors.white,
  outline: 'none',
  color: colors.primaryDark,
  appearance: 'none',
}

export default function SuppliersBalancePage() {
  return (
    <main style={{ backgroundColor: colors.bgLight, minHeight: '100vh' }}>
      <Suspense fallback={<div style={{ padding: '50px', textAlign: 'center' }}>Φόρτωση...</div>}>
        <BalancesContent />
      </Suspense>
    </main>
  )
}
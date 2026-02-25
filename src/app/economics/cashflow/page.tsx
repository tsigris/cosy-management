'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'next/navigation'
import EconomicsTabs from '@/components/EconomicsTabs'
import { getSupabase } from '@/lib/supabase'

type IncomeTransaction = {
  id: string
  amount: number
  category: string
  date: string
  notes: string | null
}

export default function EconomicsCashflowPage() {
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')?.trim() || ''

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [transactions, setTransactions] = useState<IncomeTransaction[]>([])

  useEffect(() => {
    let isCancelled = false

    const loadIncomeTransactions = async () => {
      if (!storeId) {
        if (!isCancelled) {
          setTransactions([])
          setErrorMessage('Δεν βρέθηκε store στο URL.')
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setErrorMessage('')

      try {
        const supabase = getSupabase()
        const { data, error } = await supabase
          .from('transactions')
          .select('id, amount, category, date, notes')
          .eq('store_id', storeId)
          .eq('type', 'income')
          .order('date', { ascending: false })
          .limit(50)

        if (error) throw error

        const mapped: IncomeTransaction[] = (data ?? []).map((row) => ({
          id: String(row.id),
          amount: Number(row.amount) || 0,
          category: String(row.category || 'Χωρίς κατηγορία'),
          date: String(row.date || ''),
          notes: row.notes ? String(row.notes) : null,
        }))

        if (!isCancelled) setTransactions(mapped)
      } catch (error) {
        console.error('Cashflow income fetch failed:', error)
        if (!isCancelled) {
          setTransactions([])
          setErrorMessage('Αποτυχία φόρτωσης εσόδων. Προσπάθησε ξανά.')
        }
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    void loadIncomeTransactions()

    return () => {
      isCancelled = true
    }
  }, [storeId])

  const totalIncome = useMemo(
    () => transactions.reduce((sum, tx) => sum + tx.amount, 0),
    [transactions]
  )

  const amountFormatter = useMemo(
    () => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }),
    []
  )

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('el-GR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    []
  )

  const formatDate = (dateValue: string) => {
    const [year, month, day] = dateValue.split('-').map(Number)
    if (!year || !month || !day) return '-'
    return dateFormatter.format(new Date(year, month - 1, day))
  }

  return (
    <main style={pageWrap}>
      <div style={container}>
        <div style={headerCard}>
          <h1 style={title}>Οικονομικό Κέντρο</h1>
          <p style={subtitle}>Ταμειακή ροή</p>
        </div>

        <EconomicsTabs />

        <section style={card}>
          <h2 style={cardTitle}>Σύνολο εσόδων</h2>
          <p style={totalAmount}>{loading ? 'Φόρτωση...' : amountFormatter.format(totalIncome)}</p>
        </section>

        <section style={card}>
          <h2 style={cardTitle}>Τελευταίες εισπράξεις</h2>

          {loading && <p style={mutedText}>Φόρτωση κινήσεων...</p>}

          {!loading && errorMessage && <p style={errorText}>{errorMessage}</p>}

          {!loading && !errorMessage && transactions.length === 0 && (
            <p style={mutedText}>Δεν υπάρχουν έσοδα για το επιλεγμένο κατάστημα.</p>
          )}

          {!loading && !errorMessage && transactions.length > 0 && (
            <div style={listWrap}>
              {transactions.map((tx) => (
                <article key={tx.id} style={txItem}>
                  <div style={txTopRow}>
                    <p style={txAmount}>{amountFormatter.format(tx.amount)}</p>
                    <p style={txDate}>{formatDate(tx.date)}</p>
                  </div>

                  <p style={txCategory}>{tx.category}</p>

                  {tx.notes && <p style={txNotes}>{tx.notes}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

const pageWrap: CSSProperties = {
  minHeight: '100dvh',
  background:
    'radial-gradient(1200px 600px at 20% -10%, #eef2ff 0%, rgba(238,242,255,0) 55%), radial-gradient(1200px 600px at 90% 0%, #ecfdf5 0%, rgba(236,253,245,0) 55%), #f8fafc',
  padding: 18,
}

const container: CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  paddingBottom: 120,
}

const headerCard: CSSProperties = {
  borderRadius: 22,
  border: '1px solid #e2e8f0',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.05)',
  padding: 16,
  marginBottom: 12,
}

const title: CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 24,
  fontWeight: 900,
}

const subtitle: CSSProperties = {
  margin: '6px 0 0 0',
  color: '#64748b',
  fontSize: 13,
  fontWeight: 800,
}

const card: CSSProperties = {
  marginTop: 12,
  borderRadius: 22,
  border: '1px solid #e2e8f0',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.05)',
  padding: 18,
}

const cardTitle: CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 18,
  fontWeight: 900,
}

const totalAmount: CSSProperties = {
  margin: '10px 0 0 0',
  color: '#0f172a',
  fontSize: 30,
  fontWeight: 900,
  lineHeight: 1.15,
}

const listWrap: CSSProperties = {
  marginTop: 12,
  display: 'grid',
  gap: 10,
}

const txItem: CSSProperties = {
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  padding: 12,
}

const txTopRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

const txAmount: CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 18,
  fontWeight: 900,
}

const txDate: CSSProperties = {
  margin: 0,
  color: '#64748b',
  fontSize: 12,
  fontWeight: 800,
}

const txCategory: CSSProperties = {
  margin: '8px 0 0 0',
  color: '#0f172a',
  fontSize: 13,
  fontWeight: 800,
}

const txNotes: CSSProperties = {
  margin: '6px 0 0 0',
  color: '#475569',
  fontSize: 12,
  lineHeight: 1.45,
}

const mutedText: CSSProperties = {
  margin: '12px 0 0 0',
  color: '#64748b',
  fontSize: 13,
  fontWeight: 700,
}

const errorText: CSSProperties = {
  margin: '12px 0 0 0',
  color: '#b91c1c',
  fontSize: 13,
  fontWeight: 800,
}
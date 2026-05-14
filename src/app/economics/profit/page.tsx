"use client"
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, Suspense, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'
import EconomicsContainer from '@/components/economics/EconomicsContainer'
import { toast, Toaster } from 'sonner'
import EconomicsPeriodFilter from '@/components/economics/EconomicsPeriodFilter'
import {
  aggregateCanonicalFinancialMetrics,
  buildCanonicalMonthlySeries,
  type CanonicalFinancialRow,
} from '@/lib/canonicalFinancialMetrics'
import { getCanonicalPeriodRange } from '@/lib/financialPeriods'

const isValidUUID = (id: any) => {
	const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
	return typeof id === 'string' && regex.test(id)
}

function prettyMonthLabel(ym: string) {
	const [y, m] = ym.split('-').map(Number)
	if (!y || !m) return ym
	const dt = new Date(y, m - 1, 1)
	return new Intl.DateTimeFormat('el-GR', { month: 'short', year: 'numeric' }).format(dt)
}

export default function ProfitPage() {
	return (
		<main style={{ minHeight: '100vh' }}>
			<Suspense fallback={<div style={{ padding: 50, textAlign: 'center' }}>Φόρτωση...</div>}>
				<ProfitContent />
			</Suspense>
		</main>
	)
}

function ProfitContent() {
	const supabase = getSupabase()
	const router = useRouter()
	const searchParams = useSearchParams()
	const storeIdFromUrl = searchParams.get('store')
	const hasValidStore = !!storeIdFromUrl && isValidUUID(storeIdFromUrl)

	const [loading, setLoading] = useState(true)
	const [transactions, setTransactions] = useState<any[]>([])
	const [period, setPeriod] = useState<'month' | 'year' | '30days' | 'all'>('month')
	const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

	useEffect(() => {
		if (!hasValidStore) {
			router.replace('/select-store')
		}
	}, [hasValidStore, router])

	const range = useMemo(
		() => getCanonicalPeriodRange({ period, selectedYear }),
		[period, selectedYear],
	)

	const load = useCallback(async () => {
		if (!storeIdFromUrl || !hasValidStore) return

		const transactionSelect = 'id, store_id, date, created_at, type, amount, category, method, payment_method, notes, is_credit'

		try {
			setLoading(true)

			const transRes = await supabase
				.from('transactions')
				.select(transactionSelect)
				.eq('store_id', storeIdFromUrl)
				.gte('date', range.from)
				.lte('date', range.to)
			if (transRes.error) throw transRes.error
			const txs = (transRes.data || []).filter((t: any) => t.is_deleted !== true)
			setTransactions(txs)
		} catch (err) {
			const error = err as { message?: string; details?: string; hint?: string }
			console.error('Profit transactions query failed', {
				message: error?.message,
				details: error?.details,
				hint: error?.hint,
				query: {
					table: 'transactions',
					select: transactionSelect,
					filters: {
						store_id: storeIdFromUrl,
						period,
						selectedYear,
					},
				},
			})
			toast.error('Σφάλμα φόρτωσης report κέρδους')
			setTransactions([])
		} finally {
			setLoading(false)
		}
	}, [storeIdFromUrl, hasValidStore, range.from, range.to, supabase])

	useEffect(() => {
		if (!hasValidStore) return
		void load()
	}, [hasValidStore, load])

	if (!hasValidStore) {
		return null
	}

	const yearOptions = useMemo(() => {
		const currentYear = new Date().getFullYear()
		return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]
	}, [])

	useEffect(() => {
		if (yearOptions.includes(selectedYear)) return
		setSelectedYear(yearOptions[0])
	}, [yearOptions, selectedYear])

	const canonicalRows = useMemo(() => transactions as CanonicalFinancialRow[], [transactions])
	const summary = useMemo(
		() => aggregateCanonicalFinancialMetrics(canonicalRows, { range }),
		[canonicalRows, range],
	)
	const totalRevenue = summary.totalRevenue
	const totalExpenses = summary.totalExpenses
	const totalProfit = summary.profit

	const byMonth = useMemo(
		() =>
			buildCanonicalMonthlySeries(canonicalRows, range)
				.map((row) => ({ month: row.ym, revenue: row.revenue, expenses: row.expenses, profit: row.profit }))
				.sort((a, b) => String(b.month).localeCompare(String(a.month))),
		[canonicalRows, range],
	)

	const card: any = { background: 'var(--surface)', padding: 14, borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', marginBottom: 12 }
	const viewBtn: any = { flex: 1, minWidth: 90, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', fontWeight: 900 }

	const amountFmt = (n: number) => n.toLocaleString('el-GR', { minimumFractionDigits: 2 }) + '€'

	const [isMobile, setIsMobile] = useState<boolean>(false)

	useEffect(() => {
		const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768)
		check()
		window.addEventListener('resize', check)
		return () => window.removeEventListener('resize', check)
	}, [])

	return (
		<div style={{ background: 'var(--bg-grad)', minHeight: '100vh', padding: 20 }}>
			<Toaster position="top-center" richColors />
			<EconomicsContainer>
				<EconomicsHeaderNav title="Οικονομικό Κέντρο" subtitle="ΚΕΡΔΟΣ" />

				<EconomicsPeriodFilter
					period={period}
					onPeriodChange={(p) => setPeriod(p)}
					selectedYear={selectedYear}
					onYearChange={(y) => setSelectedYear(y)}
					yearOptions={yearOptions}
				/>

				{/* Summary cards */}
				<div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
					<div style={{ ...card, flex: 1 }}>
						<div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)' }}>Συνολικά Έσοδα</div>
						<div style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>{loading ? '—' : amountFmt(totalRevenue)}</div>
					</div>
					<div style={{ ...card, flex: 1 }}>
						<div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)' }}>Συνολικά Έξοδα</div>
						<div style={{ fontSize: 18, fontWeight: 900, color: '#f97316' }}>{loading ? '—' : amountFmt(totalExpenses)}</div>
					</div>
					<div style={{ ...card, flex: 1 }}>
						<div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)' }}>Συνολικό Κέρδος</div>
						<div style={{ fontSize: 18, fontWeight: 900, color: totalProfit >= 0 ? '#10b981' : '#dc2626' }}>{loading ? '—' : amountFmt(totalProfit)}</div>
					</div>
				</div>

				{/* Monthly table */}
				<div style={card}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
						<div>
							<h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Μηνιαίο Κέρδος / Ζημία</h2>
							<div style={{ fontSize: 12, color: 'var(--muted)' }}>Μήνας • Έσοδα • Έξοδα • Κέρδος</div>
						</div>
					</div>

					{loading ? (
						<div>Φόρτωση...</div>
					) : byMonth.length === 0 ? (
						<div style={{ color: 'var(--muted)' }}>Δεν υπάρχουν δεδομένα για την επιλεγμένη περίοδο.</div>
					) : isMobile ? (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
							{byMonth.map((r) => (
								<div key={r.month} style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
									<div style={{ fontWeight: 900, marginBottom: 8 }}>{prettyMonthLabel(r.month)}</div>
									<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
										<div style={{ color: 'var(--muted)' }}>Έσοδα</div>
										<div style={{ fontWeight: 900 }}>{amountFmt(r.revenue)}</div>
									</div>
									<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
										<div style={{ color: 'var(--muted)' }}>Έξοδα</div>
										<div style={{ fontWeight: 900 }}>{amountFmt(r.expenses)}</div>
									</div>
									<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
										<div style={{ color: 'var(--muted)' }}>Κέρδος</div>
										<div style={{ fontWeight: 900, color: r.profit >= 0 ? '#10b981' : '#dc2626' }}>{amountFmt(r.profit)}</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
							<div style={{ display: 'flex', fontWeight: 900, color: 'var(--muted)', padding: '6px 0' }}>
								<div style={{ flex: 2, minWidth: 160 }}>Μήνας</div>
								<div style={{ flex: 1, textAlign: 'right', minWidth: 120 }}>Έσοδα</div>
								<div style={{ flex: 1, textAlign: 'right', minWidth: 120 }}>Έξοδα</div>
								<div style={{ flex: 1, textAlign: 'right', minWidth: 120 }}>Κέρδος</div>
							</div>

							{byMonth.map((r) => (
								<div key={r.month} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
									<div style={{ flex: 2, minWidth: 160 }}>{prettyMonthLabel(r.month)}</div>
									<div style={{ flex: 1, textAlign: 'right', minWidth: 120, fontWeight: 900 }}>{amountFmt(r.revenue)}</div>
									<div style={{ flex: 1, textAlign: 'right', minWidth: 120, fontWeight: 900 }}>{amountFmt(r.expenses)}</div>
									<div style={{ flex: 1, textAlign: 'right', minWidth: 120, fontWeight: 900, color: r.profit >= 0 ? '#10b981' : '#dc2626' }}>{amountFmt(r.profit)}</div>
								</div>
							))}
						</div>
					)}
				</div>
			</EconomicsContainer>
		</div>
	)
}

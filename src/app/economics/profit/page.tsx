"use client"
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, Suspense, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'
import EconomicsContainer from '@/components/economics/EconomicsContainer'
import { toast, Toaster } from 'sonner'
import EconomicsPeriodFilter from '@/components/economics/EconomicsPeriodFilter'

const isValidUUID = (id: any) => {
	const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
	return typeof id === 'string' && regex.test(id)
}

function getTxDate(t: any) {
	if (!t) return null
	const raw = t?.date ?? t?.created_at
	if (!raw) return null
	const d = new Date(raw)
	return isNaN(d.getTime()) ? null : d
}

function monthKeyFromDate(d: Date) {
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	return `${y}-${m}`
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

	const incomeTypes = ['income', 'income_collection', 'debt_received']
	const expenseTypes = ['expense', 'debt_payment', 'salary_advance']

	const load = useCallback(async () => {
		if (!storeIdFromUrl || !hasValidStore) return

		const transactionSelect = 'id, store_id, date, created_at, type, amount, is_deleted'

		try {
			setLoading(true)

			let q = supabase
				.from('transactions')
				.select(transactionSelect)
				.eq('store_id', storeIdFromUrl)

			if (period !== 'all') {
				const toDateKey = (d: Date) => {
					const y = d.getFullYear()
					const m = String(d.getMonth() + 1).padStart(2, '0')
					const day = String(d.getDate()).padStart(2, '0')
					return `${y}-${m}-${day}`
				}

				let fromDate = '1970-01-01'
				if (period === 'month') {
					const now = new Date()
					fromDate = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0))
				} else if (period === 'year') {
					fromDate = toDateKey(new Date(selectedYear, 0, 1, 0, 0, 0, 0))
				} else if (period === '30days') {
					const d = new Date()
					d.setDate(d.getDate() - 30)
					d.setHours(0, 0, 0, 0)
					fromDate = toDateKey(d)
				}

				q = q.gte('date', fromDate).lte('date', '9999-12-31')
			}

			const transRes = await q
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
	}, [storeIdFromUrl, hasValidStore, supabase, period, selectedYear])

	useEffect(() => {
		if (!hasValidStore) return
		void load()
	}, [hasValidStore, load])

	if (!hasValidStore) {
		return null
	}

	const yearOptions = useMemo(() => {
		const s = new Set<number>()
		for (const t of transactions) {
			const d = getTxDate(t)
			if (d) s.add(d.getFullYear())
		}
		if (!s.size) s.add(new Date().getFullYear())
		return Array.from(s).sort((a, b) => b - a)
	}, [transactions])

	useEffect(() => {
		if (yearOptions.includes(selectedYear)) return
		setSelectedYear(yearOptions[0])
	}, [yearOptions, selectedYear])

	// period helpers
	const getStartOfMonth = useCallback(() => {
		const now = new Date()
		return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
	}, [])

	const getStartOfYear = useCallback(() => {
		return new Date(selectedYear, 0, 1, 0, 0, 0, 0)
	}, [selectedYear])

	const getLast30Days = useCallback(() => {
		const d = new Date()
		d.setDate(d.getDate() - 30)
		d.setHours(0, 0, 0, 0)
		return d
	}, [])

	const filteredTx = useMemo(() => {
		return transactions.filter((tx) => {
			if (!tx) return false
			const d = getTxDate(tx)
			if (!d) return false
			if (period === 'all') return true
			if (period === 'month') return d >= getStartOfMonth()
			if (period === 'year') return d >= getStartOfYear()
			if (period === '30days') return d >= getLast30Days()
			return true
		})
	}, [transactions, period, getStartOfMonth, getStartOfYear, getLast30Days])

	const totalRevenue = useMemo(
		() => filteredTx.filter((t) => incomeTypes.includes(String(t?.type || ''))).reduce((a, t) => a + Number(t?.amount ?? 0), 0),
		[filteredTx],
	)
	const totalExpenses = useMemo(
		() => filteredTx.filter((t) => expenseTypes.includes(String(t?.type || ''))).reduce((a, t) => a + Math.abs(Number(t?.amount ?? 0)), 0),
		[filteredTx],
	)
	const totalProfit = useMemo(() => totalRevenue - totalExpenses, [totalRevenue, totalExpenses])

	const byMonth = useMemo(() => {
		const map: Record<string, { revenue: number; expenses: number }> = {}
		for (const t of filteredTx) {
			if (!t) continue
			const d = getTxDate(t)
			const k = d ? monthKeyFromDate(d) : 'unknown'
			if (!map[k]) map[k] = { revenue: 0, expenses: 0 }
			if (incomeTypes.includes(String(t?.type || ''))) map[k].revenue += Number(t?.amount ?? 0)
			if (expenseTypes.includes(String(t?.type || ''))) map[k].expenses += Math.abs(Number(t?.amount ?? 0))
		}
		const rows = Object.entries(map).map(([key, v]) => ({ month: key, revenue: v.revenue, expenses: v.expenses, profit: v.revenue - v.expenses }))
		return rows.sort((a, b) => String(b.month).localeCompare(String(a.month)))
	}, [filteredTx])

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

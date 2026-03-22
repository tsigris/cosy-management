"use client"

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'
import EconomicsPeriodFilter from '@/components/economics/EconomicsPeriodFilter'
import { getSupabase } from '@/lib/supabase'
import { formatIsoDate, getTodayDateISO, parseLocalDateOnly } from '@/lib/businessDate'
import { getEmployees } from '@/lib/employees'
import { formatDateEl } from '@/lib/formatters'

type ScheduledPayment = {
	id: string
	title: string
	amount: number
	category: string
	due_date: string // YYYY-MM-DD
	source: string
	notes?: string | null
	status?: string | null
	is_paid?: boolean | null
	transaction_id?: string | null
}

type ThemeName = 'light' | 'dark'

function addDays(d: Date, days: number) {
	const r = new Date(d)
	r.setDate(r.getDate() + days)
	return r
}

function toISODate(d: Date) {
	return formatIsoDate(d)
}

export default function EconomicsScheduledPaymentsPage() {
	const searchParams = useSearchParams()
	const storeId = searchParams.get('store')?.trim() || ''

	const [theme, setTheme] = useState<ThemeName>('light')
	useEffect(() => {
		try {
			const saved = window.localStorage.getItem('cosy_theme')
			if (saved === 'light' || saved === 'dark') {
				setTheme(saved)
				return
			}
			const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
			setTheme(prefersDark ? 'dark' : 'light')
		} catch {}
	}, [])

	const [loading, setLoading] = useState(true)
	const [items, setItems] = useState<ScheduledPayment[]>([])
	const [filter, setFilter] = useState<'all' | 'salaries' | 'tax' | 'suppliers' | 'bills' | 'settlements_loans'>('all')
	const [period, setPeriod] = useState<'month' | 'year' | '30days' | 'all'>('30days')
	const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
	const [isMobile, setIsMobile] = useState(false)

	useEffect(() => {
		const onResize = () => setIsMobile(window.innerWidth < 768)
		onResize()
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	}, [])

	const today = useMemo(() => {
		const d = parseLocalDateOnly(getTodayDateISO())
		d.setHours(0, 0, 0, 0)
		return d
	}, [])

	const toDate = useMemo(() => addDays(today, 30), [today])
	const toDateStr = useMemo(() => toISODate(toDate), [toDate])
	const todayStr = useMemo(() => toISODate(today), [today])

	useEffect(() => {
		let cancelled = false

		const load = async () => {
			if (!storeId) {
				setItems([])
				setLoading(false)
				return
			}

			setLoading(true)
			const supabase = getSupabase()

			const results: ScheduledPayment[] = []

			try {
				// 1) Employees (salaries) - compute next payment date from possible fields (safe fallbacks)
				const employees = await getEmployees(storeId)

				if (Array.isArray(employees)) {
					for (const e of employees as any) {
						const salary = Number(e.salary) || Number(e.monthly_salary) || 0
						const payDay = Number(e.pay_day) || Number(e.salary_day) || Number(e.payment_day) || 1
						if (!payDay || salary === 0) continue

						const now = new Date()
						const thisMonthDate = new Date(now.getFullYear(), now.getMonth(), Math.min(payDay, 28))
						let next = thisMonthDate
						if (next < today) {
							// next month
							next = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(payDay, 28))
						}

						// only include if within +30 days window
						if (new Date(toISODate(next)) > toDate) continue

						const sp: ScheduledPayment = {
							id: `emp-${e.id}`,
							title: e.name ? `Μισθός: ${e.name}` : 'Μισθοί προσωπικού',
							amount: salary,
							category: 'Μισθοί προσωπικού',
							due_date: toISODate(next),
							source: 'employees',
							notes: null,
						}
						results.push(sp)
					}
				}

				// 2) tax_installments (if exists)
				try {
					const { data: taxes, error: taxErr } = await supabase
						.from('tax_installments')
						.select('*')
						.eq('store_id', storeId)
						.lte('due_date', toDateStr)
						.limit(500)

					if (!taxErr && Array.isArray(taxes)) {
						for (const t of taxes as any) {
							if (!t.due_date) continue
							results.push({
								id: `tax-${t.id}`,
								title: t.description || 'Δόση Εφορίας',
								amount: Number(t.amount) || 0,
								category: 'Δόσεις Εφορίας / Ρύθμισης',
								due_date: String(t.due_date).slice(0, 10),
								source: 'tax_installments',
								notes: null,
								status: t.status ?? null,
								is_paid: typeof t.is_paid === 'boolean' ? t.is_paid : null,
								transaction_id: t.transaction_id ?? null,
							})
						}
					}
				} catch (e) {
					// ignore missing table
				}

				// 3) expenses with due_date (suppliers / bills / others)
				try {
					const { data: expenses, error: expErr } = await supabase
						.from('expenses')
						.select('*')
						.eq('store_id', storeId)
						.lte('due_date', toDateStr)
						.limit(800)

					if (!expErr && Array.isArray(expenses)) {
						for (const ex of expenses as any) {
							if (!ex.due_date) continue
							const cat = ex.supplier_id ? 'Προμηθευτές' : ex.category || 'Λοιπές υποχρεώσεις'
							const titleLower = (ex.title || '').toLowerCase()
							const maybeBill = titleLower.includes('λογ') || titleLower.includes('λογια') || titleLower.includes('λογαρι')
							const category = ex.supplier_id ? 'Προμηθευτές' : maybeBill ? 'Λογαριασμοί' : cat
							results.push({
								id: `exp-${ex.id}`,
								title: ex.title || 'Πληρωμή',
								amount: Number(ex.amount) || 0,
								category,
								due_date: String(ex.due_date).slice(0, 10),
								source: 'expenses',
								notes: ex.notes || null,
								status: ex.status ?? null,
								is_paid: typeof ex.is_paid === 'boolean' ? ex.is_paid : null,
								transaction_id: ex.transaction_id ?? null,
							})
						}
					}
				} catch (e) {
					// ignore
				}

				// 4) transactions that may have due_date / obligations (some projects store obligations here)
				try {
					const { data: txs, error: txErr } = await supabase
						.from('transactions')
						.select('*')
						.eq('store_id', storeId)
						.lte('due_date', toDateStr)
						.limit(800)

					if (!txErr && Array.isArray(txs)) {
						for (const t of txs as any) {
							if (!t.due_date) continue
							const cat = t.supplier_id ? 'Προμηθευτές' : t.type === 'expense' ? 'Λοιπά' : 'Λοιπά'
							results.push({
								id: `tx-${t.id}`,
								title: t.description || t.notes || 'Πληρωμή',
								amount: Number(t.amount) || 0,
								category: cat,
								due_date: String(t.due_date).slice(0, 10),
								source: 'transactions',
								notes: t.notes || null,
								status: t.status ?? null,
								is_paid: typeof t.is_paid === 'boolean' ? t.is_paid : null,
								transaction_id: t.transaction_id ?? null,
							})
						}
					}
				} catch (e) {
					// ignore
				}

				// 5) settlements/installments (pending only, installments as source of truth)
				try {
					const [{ data: settlements, error: settlementsErr }, { data: installments, error: installmentsErr }] = await Promise.all([
						supabase.from('settlements').select('id, name, type, rf_code, store_id').eq('store_id', storeId).limit(2000),
						supabase
							.from('installments')
							.select('id, settlement_id, installment_number, due_date, amount, status, transaction_id, store_id')
							.eq('store_id', storeId)
							.eq('status', 'pending')
							.is('transaction_id', null)
							.lte('due_date', toDateStr)
							.limit(3000),
					])

					if (!settlementsErr && !installmentsErr && Array.isArray(installments)) {
						const settlementMap = new Map(
							(Array.isArray(settlements) ? settlements : []).map((s: any) => [String(s.id), s]),
						)

						for (const inst of installments as any) {
							if (!inst?.due_date) continue
							const settlement = settlementMap.get(String(inst.settlement_id || ''))
							const settlementType = String(settlement?.type || '').toLowerCase()
							const isLoan = settlementType === 'loan'
							const settlementName = String(settlement?.name || '').trim() || '—'
							const titlePrefix = isLoan ? 'Δάνειο' : 'Ρύθμιση'
							results.push({
								id: `inst-${inst.id}`,
								title: `${titlePrefix}: ${settlementName}`,
								amount: Number(inst.amount) || 0,
								category: isLoan ? 'Δάνεια' : 'Ρυθμίσεις',
								due_date: String(inst.due_date).slice(0, 10),
								source: 'installments',
								notes: String(settlement?.rf_code || '').trim() || settlementName,
								status: String(inst.status || ''),
								transaction_id: inst.transaction_id ?? null,
							})
						}
					}
				} catch (e) {
					// ignore
				}

				if (!cancelled) {
					// limit to window: include overdue and up to +30 days
					const filtered = results.filter((r) => {
						if (!r.due_date) return false
						const d = parseLocalDateOnly(r.due_date)
						d.setHours(0, 0, 0, 0)
						return d <= toDate
					})

					// avoid thousands
					const uniq = Object.values(
						filtered.reduce((acc: Record<string, ScheduledPayment>, cur) => {
							acc[cur.id] = cur
							return acc
						}, {}),
					)

					setItems(uniq.slice(0, 1000))
				}
			} catch (e) {
				console.error('Scheduled payments load failed', e)
				if (!cancelled) setItems([])
			} finally {
				if (!cancelled) setLoading(false)
			}
		}

		void load()

		return () => {
			cancelled = true
		}
	}, [storeId, toDateStr, today])

	const computeStatus = (iso: string) => {
		const [y, m, d] = (iso || '').split('-').map(Number)
		if (!y || !m || !d) return 'ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΟ'
		const dd = new Date(y, m - 1, d)
		dd.setHours(0, 0, 0, 0)
		const diff = Math.floor((dd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
		if (diff < 0) return 'ΛΗΞΙΠΡΟΘΕΣΜΟ'
		if (diff === 0) return 'ΣΗΜΕΡΑ'
		if (diff === 1) return 'ΑΥΡΙΟ'
		if (diff <= 7) return 'ΑΥΤΗ ΤΗΝ ΕΒΔΟΜΑΔΑ'
		// next calendar month
		const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
		if (dd.getFullYear() === nextMonth.getFullYear() && dd.getMonth() === nextMonth.getMonth()) return 'ΕΠΟΜΕΝΟ ΜΗΝΑ'
		return 'ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΟ'
	}

	const normalizePaymentStatus = (row: ScheduledPayment) => String(row.status || '').trim().toLowerCase()

	const isPaidPayment = (row: ScheduledPayment) => {
		const status = normalizePaymentStatus(row)
		if (status) return status === 'paid'
		if (typeof row.is_paid === 'boolean') return row.is_paid === true
		if (row.transaction_id) return true
		return false
	}

	const isPendingPayment = (row: ScheduledPayment) => {
		const status = normalizePaymentStatus(row)
		if (status) return status === 'pending'
		if (typeof row.is_paid === 'boolean') return row.is_paid === false
		if (row.transaction_id) return false
		return !isPaidPayment(row)
	}

	const filteredItems = useMemo(() => {
		return items.filter((it) => {
			if (filter === 'all') return true
			if (filter === 'salaries') return it.category === 'Μισθοί προσωπικού'
			if (filter === 'tax') return it.category === 'Δόσεις Εφορίας / Ρύθμισης'
			if (filter === 'suppliers') return it.category === 'Προμηθευτές'
			if (filter === 'bills') return it.category === 'Λογαριασμοί'
			if (filter === 'settlements_loans') return it.category === 'Ρυθμίσεις' || it.category === 'Δάνεια'
			return true
		})
	}, [items, filter])

	const pendingItems = useMemo(() => filteredItems.filter((it) => isPendingPayment(it)), [filteredItems])

	// Summary cards
	const summary = useMemo(() => {
		let overdueAmt = 0
		let overdueCount = 0
		let todayAmt = 0
		let todayCount = 0
		let next7Amt = 0
		let next7Count = 0
		let totalAmt = 0
		let totalCount = 0

		for (const it of pendingItems) {
			const status = computeStatus(it.due_date)
			const amt = Number(it.amount) || 0
			totalAmt += amt
			totalCount += 1
			if (status === 'ΛΗΞΙΠΡΟΘΕΣΜΟ') {
				overdueAmt += amt
				overdueCount++
			}
			if (status === 'ΣΗΜΕΡΑ') {
				todayAmt += amt
				todayCount++
			}
			if (status === 'ΑΥΤΗ ΤΗΝ ΕΒΔΟΜΑΔΑ' || status === 'ΑΥΡΙΟ') {
				next7Amt += amt
				next7Count++
			}
		}

		return { overdueAmt, overdueCount, todayAmt, todayCount, next7Amt, next7Count, totalAmt, totalCount }
	}, [pendingItems])

	const amountFormatter = useMemo(() => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }), [])

	const yearOptions = useMemo(() => {
		const s = new Set<number>()
		for (const it of items) {
			if (!it.due_date) continue
			const d = parseLocalDateOnly(it.due_date)
			if (!isNaN(d.getTime())) s.add(d.getFullYear())
		}
		if (!s.size) s.add(new Date().getFullYear())
		return Array.from(s).sort((a, b) => b - a)
	}, [items])

	useEffect(() => {
		if (!yearOptions || !yearOptions.length) return
		const current = new Date().getFullYear()
		setSelectedYear(yearOptions.includes(current) ? current : yearOptions[0])
	}, [yearOptions])

	return (
		<div>
			<EconomicsHeaderNav title="Οικονομικό Κέντρο" subtitle="Προγραμματισμένες Πληρωμές" />
			<div style={{ padding: '0 12px 24px' }}>
				<EconomicsPeriodFilter period={period} onPeriodChange={(p) => setPeriod(p)} selectedYear={selectedYear} onYearChange={(y) => setSelectedYear(y)} yearOptions={yearOptions} />

				<div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
					<div style={{ flex: '1 1 180px', minWidth: 160, padding: 14, borderRadius: 12, background: 'var(--surfaceSolid)', boxShadow: 'var(--shadow)' }}>
						<div style={{ fontSize: 12, color: 'var(--muted)' }}>Ληξιπρόθεσμα</div>
						<div style={{ fontWeight: 800, marginTop: 6 }}>{amountFormatter.format(summary.overdueAmt)}</div>
						<div style={{ fontSize: 12, color: 'var(--muted)' }}>{summary.overdueCount} πληρωμές</div>
					</div>

					<div style={{ flex: '1 1 180px', minWidth: 160, padding: 14, borderRadius: 12, background: 'var(--surfaceSolid)', boxShadow: 'var(--shadow)' }}>
						<div style={{ fontSize: 12, color: 'var(--muted)' }}>Σήμερα</div>
						<div style={{ fontWeight: 800, marginTop: 6 }}>{amountFormatter.format(summary.todayAmt)}</div>
						<div style={{ fontSize: 12, color: 'var(--muted)' }}>{summary.todayCount} πληρωμές</div>
					</div>

					<div style={{ flex: '1 1 180px', minWidth: 160, padding: 14, borderRadius: 12, background: 'var(--surfaceSolid)', boxShadow: 'var(--shadow)' }}>
						<div style={{ fontSize: 12, color: 'var(--muted)' }}>Επόμενες 7 ημέρες</div>
						<div style={{ fontWeight: 800, marginTop: 6 }}>{amountFormatter.format(summary.next7Amt)}</div>
						<div style={{ fontSize: 12, color: 'var(--muted)' }}>{summary.next7Count} πληρωμές</div>
					</div>

					<div style={{ flex: '1 1 180px', minWidth: 160, padding: 14, borderRadius: 12, background: 'var(--surfaceSolid)', boxShadow: 'var(--shadow)' }}>
						<div style={{ fontSize: 12, color: 'var(--muted)' }}>Σύνολο προγραμματισμένων</div>
						<div style={{ fontWeight: 800, marginTop: 6 }}>{amountFormatter.format(summary.totalAmt)}</div>
						<div style={{ fontSize: 12, color: 'var(--muted)' }}>{summary.totalCount} πληρωμές</div>
					</div>
				</div>

				<div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					<button onClick={() => setFilter('all')} style={{ padding: '8px 12px', borderRadius: 999, border: filter === 'all' ? '1px solid var(--text)' : '1px solid var(--border)', background: filter === 'all' ? 'var(--text)' : 'var(--surfaceSolid)', color: filter === 'all' ? 'var(--surfaceSolid)' : 'var(--text)' }}>Όλες</button>
					<button onClick={() => setFilter('salaries')} style={{ padding: '8px 12px', borderRadius: 999, border: filter === 'salaries' ? '1px solid var(--text)' : '1px solid var(--border)' }}>Μισθοί</button>
					<button onClick={() => setFilter('tax')} style={{ padding: '8px 12px', borderRadius: 999, border: filter === 'tax' ? '1px solid var(--text)' : '1px solid var(--border)' }}>Εφορία</button>
					<button onClick={() => setFilter('suppliers')} style={{ padding: '8px 12px', borderRadius: 999, border: filter === 'suppliers' ? '1px solid var(--text)' : '1px solid var(--border)' }}>Προμηθευτές</button>
					<button onClick={() => setFilter('bills')} style={{ padding: '8px 12px', borderRadius: 999, border: filter === 'bills' ? '1px solid var(--text)' : '1px solid var(--border)' }}>Λογαριασμοί</button>
					<button onClick={() => setFilter('settlements_loans')} style={{ padding: '8px 12px', borderRadius: 999, border: filter === 'settlements_loans' ? '1px solid var(--text)' : '1px solid var(--border)' }}>Ρυθμίσεις/Δάνεια</button>
				</div>

				<div style={{ marginTop: 18 }}>
					{loading ? (
						<div>Φόρτωση...</div>
					) : pendingItems.length === 0 ? (
						<div style={{ color: 'var(--muted)' }}>Κανένα προγραμματισμένο στοιχείο.</div>
					) : (
						// Grouping: ΛΗΞΙΠΡΟΘΕΣΜΟ, ΣΗΜΕΡΑ, ΑΥΡΙΟ, ΑΥΤΗ ΤΗΝ ΕΒΔΟΜΑΔΑ, ΕΠΟΜΕΝΕΣ ΠΛΗΡΩΜΕΣ
						<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
							{['ΛΗΞΙΠΡΟΘΕΣΜΟ', 'ΣΗΜΕΡΑ', 'ΑΥΡΙΟ', 'ΑΥΤΗ ΤΗΝ ΕΒΔΟΜΑΔΑ', 'ΕΠΟΜΕΝΕΣ ΠΛΗΡΩΜΕΣ'].map((section) => {
								const group = pendingItems.filter((it) => {
									const status = computeStatus(it.due_date)
									if (section === 'ΕΠΟΜΕΝΕΣ ΠΛΗΡΩΜΕΣ') return status === 'ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΟ' || status === 'ΕΠΟΜΕΝΟ ΜΗΝΑ'
									return status === section
								})
								if (!group.length) return null
								return (
									<div key={section}>
										<div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{section}</div>
										<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
											{group.map((g) => (
												<div key={g.id} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 10 : 12, padding: 12, borderRadius: 12, background: 'var(--surface)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
													{isMobile ? (
														<>
															<div style={{ fontWeight: 800, lineHeight: 1.25, wordBreak: 'break-word' }}>{g.title}</div>
															<div style={{ fontSize: 13, color: 'var(--muted)' }}>{g.category}</div>
															<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
																<div style={{ fontWeight: 800 }}>{amountFormatter.format(g.amount)}</div>
																<div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDateEl(g.due_date, '-')}</div>
															</div>
															<div>
																<span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, border: '1px solid var(--border)', fontSize: 12, fontWeight: 700 }}>Εκκρεμεί</span>
															</div>
															<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
																<button style={{ padding: '6px 10px', borderRadius: 8 }}>✏ Επεξεργασία</button>
																<button style={{ padding: '6px 10px', borderRadius: 8 }}>➡ Μεταφορά</button>
															</div>
														</>
													) : (
														<>
															<div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
																<div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.title}</div>
																<div style={{ fontSize: 13, color: 'var(--muted)' }}>{g.category}</div>
															</div>
															<div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
																<div style={{ textAlign: 'right' }}>
																	<div style={{ fontWeight: 800 }}>{amountFormatter.format(g.amount)}</div>
																	<div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDateEl(g.due_date, '-')}</div>
																</div>
																<span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, border: '1px solid var(--border)', fontSize: 12, fontWeight: 700 }}>Εκκρεμεί</span>
																<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
																	<button style={{ padding: '6px 10px', borderRadius: 8 }}>✏ Επεξεργασία</button>
																	<button style={{ padding: '6px 10px', borderRadius: 8 }}>➡ Μεταφορά</button>
																</div>
															</div>
														</>
													)}
												</div>
											))}
										</div>
									</div>
								)
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}


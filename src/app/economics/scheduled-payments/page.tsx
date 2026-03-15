("use client")

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'
import EconomicsTabs from '@/components/EconomicsTabs'
import { getSupabase } from '@/lib/supabase'

type ScheduledPayment = {
	id: string
	title: string
	amount: number
	category: string
	due_date: string // YYYY-MM-DD
	source: string
	notes?: string | null
}

type ThemeName = 'light' | 'dark'

function addDays(d: Date, days: number) {
	const r = new Date(d)
	r.setDate(r.getDate() + days)
	return r
}

function toISODate(d: Date) {
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
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
	const [filter, setFilter] = useState<'all' | 'salaries' | 'tax' | 'suppliers' | 'bills'>('all')

	const today = useMemo(() => {
		const d = new Date()
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
				// 1) Employees (salaries) - compute next payment date from pay_day_of_month
				const { data: employees, error: empErr } = await supabase
					.from('employees')
					.select('id, name, salary, pay_day_of_month')
					.eq('store_id', storeId)
					.limit(500)

				if (!empErr && Array.isArray(employees)) {
					for (const e of employees as any) {
						const salary = Number(e.salary) || 0
						const payDay = Number(e.pay_day_of_month) || 0
						if (!payDay || salary === 0) continue

						const now = new Date()
						const thisMonthDate = new Date(now.getFullYear(), now.getMonth(), Math.min(payDay, 28))
						let next = thisMonthDate
						if (next < today) {
							// next month
							next = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(payDay, 28))
						}

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
						.select('id, amount, due_date, description')
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
							})
						}
					}
				} catch (e) {
					// ignore missing table
				}

				// 3) expenses with due_date (suppliers / bills / others)
				const { data: expenses, error: expErr } = await supabase
					.from('expenses')
					.select('id, title, amount, due_date, supplier_id, category, notes')
					.eq('store_id', storeId)
					.lte('due_date', toDateStr)
					.limit(800)

				if (!expErr && Array.isArray(expenses)) {
					for (const ex of expenses as any) {
						if (!ex.due_date) continue
						const cat = ex.supplier_id ? 'Προμηθευτές' : ex.category || 'Λοιπές υποχρεώσεις'
						const maybeBill = (ex.title || '').toLowerCase().includes('λογια') || (ex.title || '').toLowerCase().includes('λογια')
						const category = ex.supplier_id ? 'Προμηθευτές' : maybeBill ? 'Λογαριασμοί' : cat
						results.push({
							id: `exp-${ex.id}`,
							title: ex.title || 'Πληρωμή',
							amount: Number(ex.amount) || 0,
							category,
							due_date: String(ex.due_date).slice(0, 10),
							source: 'expenses',
							notes: ex.notes || null,
						})
					}
				}

				if (!cancelled) {
					// limit to window: include overdue and up to +30 days
					const filtered = results.filter((r) => {
						if (!r.due_date) return false
						const d = new Date(r.due_date)
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

	const dateFormatter = useMemo(
		() => new Intl.DateTimeFormat('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
		[],
	)

	const formatDate = (iso: string) => {
		if (!iso) return '-'
		const [y, m, d] = iso.split('-').map(Number)
		if (!y || !m || !d) return '-'
		return dateFormatter.format(new Date(y, m - 1, d))
	}

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

	const filteredItems = useMemo(() => {
		return items.filter((it) => {
			if (filter === 'all') return true
			if (filter === 'salaries') return it.category === 'Μισθοί προσωπικού'
			if (filter === 'tax') return it.category === 'Δόσεις Εφορίας / Ρύθμισης'
			if (filter === 'suppliers') return it.category === 'Προμηθευτές'
			if (filter === 'bills') return it.category === 'Λογαριασμοί'
			return true
		})
	}, [items, filter])

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

		for (const it of filteredItems) {
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
	}, [filteredItems])

	const amountFormatter = useMemo(() => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }), [])

	return (
		<div>
			<EconomicsHeaderNav title="Οικονομικό Κέντρο" subtitle="Προγραμματισμένες Πληρωμές" theme={theme} setTheme={setTheme} />
			<div style={{ padding: '0 12px 24px' }}>
				<EconomicsTabs />

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
				</div>

				<div style={{ marginTop: 18 }}>
					{loading ? (
						<div>Φόρτωση...</div>
					) : filteredItems.length === 0 ? (
						<div style={{ color: 'var(--muted)' }}>Κανένα προγραμματισμένο στοιχείο.</div>
					) : (
						// Grouping: ΣΗΜΕΡΑ, ΑΥΡΙΟ, ΑΥΤΗ ΤΗΝ ΕΒΔΟΜΑΔΑ, ΕΠΟΜΕΝΕΣ ΠΛΗΡΩΜΕΣ
						<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
							{['ΣΗΜΕΡΑ', 'ΑΥΡΙΟ', 'ΑΥΤΗ ΤΗΝ ΕΒΔΟΜΑΔΑ', 'ΕΠΟΜΕΝΕΣ ΠΛΗΡΩΜΕΣ', 'ΛΗΞΙΠΡΟΘΕΣΜΟ'].map((section) => {
								const group = filteredItems.filter((it) => {
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
												<div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
													<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
														<div style={{ fontWeight: 800 }}>{g.title}</div>
														<div style={{ fontSize: 13, color: 'var(--muted)' }}>{g.category}</div>
													</div>
													<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
														<div style={{ textAlign: 'right' }}>
															<div style={{ fontWeight: 800 }}>{amountFormatter.format(g.amount)}</div>
															<div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDate(g.due_date)}</div>
														</div>
														<div style={{ display: 'flex', gap: 8 }}>
															<button style={{ padding: '6px 10px', borderRadius: 8 }}>✔ Πληρώθηκε</button>
															<button style={{ padding: '6px 10px', borderRadius: 8 }}>✏ Επεξεργασία</button>
															<button style={{ padding: '6px 10px', borderRadius: 8 }}>➡ Μεταφορά</button>
														</div>
													</div>
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


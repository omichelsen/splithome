import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { fetchExpensesForMonth, fetchSummary } from './lib/expenses'
import type { ExpenseSummary } from './lib/expenses'
import {
	RECENT_WINDOW_DAYS,
	filterByEarliestDate,
	formatMonthLabel,
	mergeExpenses,
	monthKeyOf,
	monthOptions,
	monthStart,
	monthsInRange,
	previousMonthKey,
	recentCutoff,
	toDateString,
} from './lib/pagination'
import type { ExpenseCursor } from './lib/pagination'
import type { Expense, ExpenseInsert, Filter } from './lib/types'
import BalanceSummary from './components/BalanceSummary'
import ExpenseList from './components/ExpenseList'
import AddExpenseModal from './components/AddExpenseModal'
import './App.css'

function ExpenseListSkeleton() {
	return (
		<ul
			className="expense-list skeleton-list"
			aria-busy="true"
			aria-label="Loading expenses"
		>
			{Array.from({ length: 5 }).map((_, index) => (
				<li className="expense-item skeleton-expense" key={index}>
					<div className="expense-main">
						<div className="expense-left">
							<span className="skeleton-line skeleton-desc" />
							<span className="skeleton-line skeleton-meta" />
						</div>
						<div className="expense-right">
							<span className="skeleton-line skeleton-total" />
							<div className="expense-shares">
								<span className="skeleton-line skeleton-chip" />
								<span className="skeleton-line skeleton-chip skeleton-chip-short" />
							</div>
							<span className="skeleton-line skeleton-delete" />
						</div>
					</div>
				</li>
			))}
		</ul>
	)
}

/** Expenses per calendar month ('YYYY-MM'), newest month first. Months
 * are fetched once and cached, so going back and forth never refetches. */
type MonthCache = Record<string, Expense[]>

export default function App() {
	const [months, setMonths] = useState<MonthCache>({})
	const [visibleKeys, setVisibleKeys] = useState<string[]>([])
	const [mode, setMode] = useState<'recent' | 'month'>('recent')
	/** Whether a month is fully loaded. The oldest month of the recent
	 * window starts out partial (it begins at the 90-day cutoff). */
	const [monthComplete, setMonthComplete] = useState<Record<string, boolean>>(
		{}
	)
	/** Earliest date shown in recent mode. Starts at the 90-day cutoff
	 * and moves back as "Load more" extends the loaded range, so rows
	 * it fetched are actually shown. */
	const [earliestVisibleDate, setEarliestVisibleDate] = useState('')
	const [summary, setSummary] = useState<ExpenseSummary | null>(null)
	const [summaryLoading, setSummaryLoading] = useState(true)
	const [listLoading, setListLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [showModal, setShowModal] = useState(false)
	const [filter, setFilter] = useState<Filter>('all')
	const [monthInput, setMonthInput] = useState('')
	const [error, setError] = useState('')
	// The month picker cannot jump past the current month. Read once, in
	// a state initializer, so render stays pure.
	const [currentMonth] = useState(() => toDateString(new Date()).slice(0, 7))

	// The realtime handler is registered once on mount, so it reads the
	// latest months/visibleKeys/mode through this ref instead of closing
	// over the first render's state.
	const stateRef = useRef({ months, visibleKeys, mode })
	useEffect(() => {
		stateRef.current = { months, visibleKeys, mode }
	})

	/** Fetch one month and store it. `merge` keeps rows already cached
	 * for the month (used when completing a partially loaded month);
	 * otherwise the fetch replaces the month's rows, so a deleted row
	 * disappears on refetch. */
	async function loadMonth(
		key: string,
		options: {
			since?: string
			cursor?: ExpenseCursor
			merge?: boolean
		} = {}
	): Promise<void> {
		const rows = await fetchExpensesForMonth(key, options)
		setMonths((prev) => ({
			...prev,
			[key]: options.merge ? mergeExpenses(prev[key] ?? [], rows) : rows,
		}))
	}

	async function loadSummary(): Promise<void> {
		try {
			const { summary: result } = await fetchSummary()
			setSummary(result)
		} catch {
			setError('Could not load the balance. Check your Supabase config.')
		} finally {
			setSummaryLoading(false)
		}
	}

	/** Load the last 90 days: the months overlapping the window, with
	 * the oldest one starting at the cutoff. */
	async function loadRecent(): Promise<void> {
		setListLoading(true)
		const today = new Date()
		const cutoff = recentCutoff(today)
		const keys = monthsInRange(cutoff, toDateString(today))
		setEarliestVisibleDate(cutoff)
		setVisibleKeys(keys)
		setMode('recent')
		try {
			await Promise.all(
				keys.map((key, index) =>
					loadMonth(key, {
						since: index === keys.length - 1 ? cutoff : undefined,
					})
				)
			)
			// Every month is complete except the oldest, which starts at
			// the cutoff — the first "Load more" completes it.
			setMonthComplete((prev) => {
				const next = { ...prev }
				keys.forEach((key, index) => {
					next[key] = index !== keys.length - 1
				})
				return next
			})
		} catch {
			setError('Could not load expenses. Check your Supabase config.')
		} finally {
			setListLoading(false)
		}
	}

	/** A realtime change moves the headline totals, and it touches at
	 * most one month's rows: refresh the summary, and refetch that month
	 * if it is already loaded. A change to a month not loaded yet shows
	 * up when that month is. */
	async function handleRealtimeChange(payload: {
		new?: Record<string, unknown>
		old?: Record<string, unknown>
	}): Promise<void> {
		await loadSummary()
		const { months: cached, visibleKeys: keys } = stateRef.current
		const row = payload.new ?? payload.old
		const date = typeof row?.date === 'string' ? row.date : undefined
		if (date) {
			const key = monthKeyOf(date)
			if (key in cached) {
				await loadMonth(key).catch(() => {
					setError('Could not refresh expenses.')
				})
				// The refetch loads the whole month, so it is complete now.
				setMonthComplete((prev) => ({ ...prev, [key]: true }))
			}
			return
		}
		// DELETE payloads carry only the row id by default: find the
		// cached month holding it and refetch that month.
		const id = row?.id
		if (id !== undefined) {
			const key = keys.find((monthKey) =>
				(cached[monthKey] ?? []).some(
					(expense) => String(expense.id) === String(id)
				)
			)
			if (key) {
				await loadMonth(key).catch(() => {
					setError('Could not refresh expenses.')
				})
				setMonthComplete((prev) => ({ ...prev, [key]: true }))
			}
		}
	}

	// Fetch the recent window and the summary on mount, then stay in
	// sync via realtime.
	useEffect(() => {
		void loadSummary()
		void loadRecent()

		const channel = supabase
			.channel('expenses-changes')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'expenses' },
				(payload) => {
					void handleRealtimeChange(payload)
				}
			)
			.subscribe()

		return () => {
			void supabase.removeChannel(channel)
		}
	}, [])

	async function handleAdd(expenseData: ExpenseInsert): Promise<void> {
		const { error } = await supabase.from('expenses').insert([expenseData])
		if (error) throw new Error(error.message)
		// Realtime subscription refreshes the summary and the month
	}

	async function handleDelete(id: Expense['id']): Promise<void> {
		if (!confirm('Delete this expense?')) return
		const { error } = await supabase.from('expenses').delete().eq('id', id)
		if (error) setError('Could not delete expense.')
	}

	/** Oldest expense currently shown, across all visible months — the
	 * keyset cursor for "Load more". Based on loaded rows, not the payer
	 * filter, so loading more while filtered cannot skip rows. */
	function oldestLoadedExpense(): Expense | null {
		for (let index = visibleKeys.length - 1; index >= 0; index--) {
			const rows = months[visibleKeys[index]] ?? []
			if (rows.length > 0) return rows[rows.length - 1]
		}
		return null
	}

	async function handleLoadMore(): Promise<void> {
		if (loadingMore) return
		const oldestKey = visibleKeys[visibleKeys.length - 1]
		if (!oldestKey) return
		setLoadingMore(true)
		try {
			if (!monthComplete[oldestKey]) {
				// Complete the oldest (partial) month: fetch only rows
				// older than the oldest one shown.
				const oldest = oldestLoadedExpense()
				await loadMonth(oldestKey, {
					merge: true,
					cursor: oldest
						? {
								date: oldest.date,
								createdAt: oldest.created_at,
								id: oldest.id,
							}
						: undefined,
				})
				setMonthComplete((prev) => ({ ...prev, [oldestKey]: true }))
				// The completed month is now fully shown, back to its
				// first day — not just back to the 90-day cutoff.
				setEarliestVisibleDate(monthStart(oldestKey))
			} else {
				// Fetch the previous calendar month in full.
				const prevKey = previousMonthKey(oldestKey)
				await loadMonth(prevKey)
				setMonthComplete((prev) => ({ ...prev, [prevKey]: true }))
				setVisibleKeys((prev) => [...prev, prevKey])
				setEarliestVisibleDate(monthStart(prevKey))
			}
		} catch {
			setError('Could not load older expenses.')
		} finally {
			setLoadingMore(false)
		}
	}

	/** Jump straight to one month, loading just that month. A month
	 * picked from the recent window may only be partially loaded, so it
	 * is fetched in full when needed. */
	async function handleMonthPick(value: string): Promise<void> {
		if (!value) return
		setMonthInput(value)
		setMode('month')
		setVisibleKeys([value])
		if (!monthComplete[value]) {
			setListLoading(true)
			try {
				await loadMonth(value)
				setMonthComplete((prev) => ({ ...prev, [value]: true }))
			} catch {
				setError('Could not load expenses for that month.')
			} finally {
				setListLoading(false)
			}
		}
	}

	function handleBackToRecent(): void {
		const today = new Date()
		const cutoff = recentCutoff(today)
		setEarliestVisibleDate(cutoff)
		setMode('recent')
		setMonthInput('')
		setVisibleKeys(monthsInRange(cutoff, toDateString(today)))
	}

	/** Is there anything older to load? The summary knows the oldest
	 * expense date; once the oldest loaded month is complete and is the
	 * month of that date, there is nothing left. */
	const hasMore = (() => {
		if (!summary || summary.oldestDate === null) return false
		const oldestKey = visibleKeys[visibleKeys.length - 1]
		if (!oldestKey) return false
		if (!monthComplete[oldestKey]) return true
		return oldestKey > monthKeyOf(summary.oldestDate)
	})()

	const visibleExpenses = visibleKeys.flatMap((key) => months[key] ?? [])
	// In recent mode the list stops at the earliest date actually
	// loaded — the 90-day cutoff at first, then further back as "Load
	// more" extends it. Filtering on the fixed cutoff hid rows Load
	// More had fetched, so the list looked unchanged after clicking it.
	const inWindowExpenses =
		mode === 'recent' && earliestVisibleDate
			? filterByEarliestDate(visibleExpenses, earliestVisibleDate)
			: visibleExpenses
	const filtered =
		filter === 'all'
			? inWindowExpenses
			: inWindowExpenses.filter((expense) => expense.paid_by === filter)

	return (
		<div className="app">
			<header className="app-header">
				<div className="header-content">
					<div className="header-title">
						<h1>SplitHome</h1>
						<span className="header-sub">Ole & Yewleh expenses tracker</span>
					</div>
					<button className="add-btn" onClick={() => setShowModal(true)}>
						+ Add expense
					</button>
				</div>
			</header>

			<main className="app-main">
				{error && (
					<div className="error-banner">
						{error}
						<button onClick={() => setError('')}>✕</button>
					</div>
				)}

				<BalanceSummary
					balance={summary?.balance ?? 0}
					totalExpenses={summary?.totalSpent ?? 0}
					expenseCount={summary?.expenseCount ?? 0}
					loading={summaryLoading}
				/>

				<div className="list-section">
					<div className="list-header">
						<h2>Expenses</h2>
						<div className="filter-tabs">
							{(['all', 'ole', 'yewleh'] as const).map((f) => (
								<button
									key={f}
									className={`filter-tab ${filter === f ? 'active' : ''}`}
									onClick={() => setFilter(f)}
								>
									{f === 'all'
										? 'All'
										: f === 'ole'
											? 'Paid by Ole'
											: 'Paid by Yewleh'}
								</button>
							))}
						</div>
					</div>

					<div className="month-controls">
						{mode === 'recent' ? (
							<span className="month-label">
								Last {RECENT_WINDOW_DAYS} days
							</span>
						) : (
							<button className="month-back" onClick={handleBackToRecent}>
								← Last {RECENT_WINDOW_DAYS} days
							</button>
						)}
						<label className="month-picker">
							<span>Jump to month</span>
							<select
								value={monthInput}
								onChange={(event) => void handleMonthPick(event.target.value)}
								aria-label="Jump to month"
							>
								<option value="">Choose a month…</option>
								{monthOptions(summary?.oldestDate ?? null, currentMonth).map(
									(key) => (
										<option key={key} value={key}>
											{formatMonthLabel(key)}
										</option>
									)
								)}
							</select>
						</label>
					</div>

					{listLoading ? (
						<ExpenseListSkeleton />
					) : (
						<ExpenseList
							expenses={filtered}
							onDelete={handleDelete}
							emptyMessage={
								mode === 'month' &&
								inWindowExpenses.length === 0 &&
								visibleKeys.length > 0
									? `No expenses in ${formatMonthLabel(visibleKeys[0])}.`
									: undefined
							}
						/>
					)}

					{!listLoading && hasMore && (
						<button
							className="load-more-btn"
							onClick={() => void handleLoadMore()}
							disabled={loadingMore}
						>
							{loadingMore ? 'Loading…' : 'Load older expenses'}
						</button>
					)}
					{!listLoading &&
						!hasMore &&
						summary &&
						summary.oldestDate !== null &&
						visibleKeys.length > 0 && (
							<p className="loaded-through">
								Showing back to{' '}
								{formatMonthLabel(monthKeyOf(summary.oldestDate))} — that is all
								of them.
							</p>
						)}
				</div>
			</main>

			{showModal && (
				<AddExpenseModal
					onAdd={handleAdd}
					onClose={() => setShowModal(false)}
				/>
			)}
		</div>
	)
}

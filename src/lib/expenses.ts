/**
 * Supabase queries for expenses. Two ideas keep loading fast as the
 * history grows to years of transactions:
 *
 * 1. The headline balance and totals come from the server as ONE row
 *    (`get_expense_summary`, defined in schema.sql), not from
 *    downloading every expense and summing client-side.
 * 2. The list is fetched a month at a time (`fetchExpensesForMonth`),
 *    so the page only downloads the months actually shown.
 */

import { supabase } from './supabase'
import { computeBalance, toNumber } from './balance'
import { buildKeysetOr, monthEnd, monthStart } from './pagination'
import type { ExpenseCursor } from './pagination'
import type { Expense } from './types'

/** Headline totals over ALL expenses, from the server. */
export interface ExpenseSummary {
	balance: number
	totalSpent: number
	expenseCount: number
	/** Date of the oldest expense, or null when there are none. */
	oldestDate: string | null
}

/**
 * Fetch the headline totals. Returns `fromFallback: true` when the
 * `get_expense_summary` RPC is not (yet) in the Supabase project and the
 * totals were computed from the amount/paid_by/split_ratio columns
 * instead — the app keeps working until schema.sql is applied in the
 * Supabase SQL editor, at the cost of one full-column download. The
 * fallback is transitional; once the function exists it is never used.
 * Throws when neither path can load the totals.
 */
export async function fetchSummary(): Promise<{
	summary: ExpenseSummary
	fromFallback: boolean
}> {
	const { data, error } = await supabase.rpc('get_expense_summary')
	if (!error && data && data.length > 0) {
		const row = data[0]
		return {
			summary: {
				balance: toNumber(row.balance),
				totalSpent: toNumber(row.total_spent),
				expenseCount: Number(row.expense_count),
				oldestDate: row.oldest_date,
			},
			fromFallback: false,
		}
	}

	console.warn(
		'get_expense_summary RPC unavailable — falling back to client-side totals. ' +
			'Apply schema.sql in the Supabase SQL editor so the totals come from the server.'
	)
	const { data: rows, error: rowsError } = await supabase
		.from('expenses')
		.select('amount,paid_by,split_ratio,date')
	if (rowsError) throw new Error(rowsError.message)
	const list = rows ?? []
	return {
		summary: {
			balance: computeBalance(list),
			totalSpent: list.reduce((sum, row) => sum + toNumber(row.amount), 0),
			expenseCount: list.length,
			oldestDate: list.reduce<string | null>(
				(min, row) => (min === null || row.date < min ? row.date : min),
				null
			),
		},
		fromFallback: true,
	}
}

export interface FetchMonthOptions {
	/** Only rows on/after this date — used for the oldest month of the
	 * recent window, which starts at the 90-day cutoff. */
	since?: string
	/** Keyset cursor: only rows strictly older than this row, in
	 * (date, created_at, id) order — used when completing a partially
	 * loaded month, so rows already on screen are not re-downloaded. */
	cursor?: ExpenseCursor
}

/**
 * All expenses in one calendar month ('YYYY-MM'), newest first.
 * A month of household expenses is small, so the whole month is fetched
 * at once; months are the unit of caching in App.
 */
export async function fetchExpensesForMonth(
	monthKey: string,
	options: FetchMonthOptions = {}
): Promise<Expense[]> {
	let query = supabase
		.from('expenses')
		.select('*')
		.gte('date', options.since ?? monthStart(monthKey))
		.lt('date', monthEnd(monthKey))
		.order('date', { ascending: false })
		.order('created_at', { ascending: false })
		.order('id', { ascending: false })
	if (options.cursor) {
		query = query.or(buildKeysetOr(options.cursor))
	}
	const { data, error } = await query
	if (error) throw new Error(error.message)
	return data ?? []
}

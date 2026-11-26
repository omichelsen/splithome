/**
 * Pure helpers for paginated expense loading. Nothing here touches
 * Supabase or React, so it is all unit-testable with node:test.
 *
 * How loading works:
 * - The list shows the last 90 days by default. Months are the unit of
 *   loading: each calendar month is fetched once and cached by its
 *   'YYYY-MM' key, so going back and forth never refetches.
 * - "Load more" fetches the next older month. The oldest month of the
 *   recent window starts out partial (it begins at the 90-day cutoff),
 *   so the first "Load more" completes that month; later ones fetch the
 *   previous calendar month.
 * - Rows are ordered (date desc, created_at desc, id desc). "Load more"
 *   uses a keyset cursor — the oldest row currently shown — instead of
 *   an offset, so an expense added while scrolling back can neither
 *   duplicate a row nor make one disappear.
 */

import type { Expense } from './types'

/** Default window for the recent view. */
export const RECENT_WINDOW_DAYS = 90

/** 'YYYY-MM-DD' for a Date, in local time. */
export function toDateString(date: Date): string {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

/** The date `days` after `dateStr` ('YYYY-MM-DD'), as 'YYYY-MM-DD'.
 * Handles month and year boundaries. */
export function addDays(dateStr: string, days: number): string {
	const [year, month, day] = dateStr.split('-').map(Number)
	return toDateString(new Date(year, month - 1, day + days))
}

/** First date shown in the recent view: `days` days before `today`. */
export function recentCutoff(
	today: Date,
	days: number = RECENT_WINDOW_DAYS
): string {
	return addDays(toDateString(today), -days)
}

/** 'YYYY-MM' for a 'YYYY-MM-DD' date string. */
export function monthKeyOf(dateStr: string): string {
	return dateStr.slice(0, 7)
}

/** First day of the month, 'YYYY-MM-DD'. */
export function monthStart(key: string): string {
	return `${key}-01`
}

/** First day of the *next* month — the exclusive end of this month's
 * date range. */
export function monthEnd(key: string): string {
	const [year, month] = key.split('-').map(Number)
	const next: [number, number] =
		month === 12 ? [year + 1, 1] : [year, month + 1]
	return `${next[0]}-${String(next[1]).padStart(2, '0')}-01`
}

/** 'YYYY-MM' of the previous calendar month. */
export function previousMonthKey(key: string): string {
	const [year, month] = key.split('-').map(Number)
	const prev: [number, number] =
		month === 1 ? [year - 1, 12] : [year, month - 1]
	return `${prev[0]}-${String(prev[1]).padStart(2, '0')}`
}

/** Month keys overlapping [start, end] ('YYYY-MM-DD' dates), newest
 * first. */
export function monthsInRange(start: string, end: string): string[] {
	const keys: string[] = []
	const first = monthKeyOf(start)
	let key = monthKeyOf(end)
	while (key >= first) {
		keys.push(key)
		if (key === first) break
		key = previousMonthKey(key)
	}
	return keys
}

/** 'November 2026' for '2026-11'. */
export function formatMonthLabel(key: string): string {
	const [year, month] = key.split('-').map(Number)
	return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
		month: 'long',
		year: 'numeric',
	})
}

/** Month keys for the "Jump to month" dropdown, newest first: from
 * `currentMonth` back to the month of the oldest expense
 * (`oldestDate`, a 'YYYY-MM-DD' string, or null when it isn't known
 * yet). The fallback is the current month plus the previous 11 — a
 * full year — so the dropdown is usable before the summary loads.
 * A native `<input type="month">` was replaced by this dropdown
 * because Safari's segmented month control is hard to type into and
 * hard to clear; a select has nothing to type wrong or delete. */
export function monthOptions(
	oldestDate: string | null,
	currentMonth: string,
	fallbackMonths: number = 12
): string[] {
	if (oldestDate) {
		const first = monthKeyOf(oldestDate)
		if (first > currentMonth) return [currentMonth]
		return monthsInRange(monthStart(first), monthStart(currentMonth))
	}
	let first = currentMonth
	for (let index = 1; index < fallbackMonths; index++) {
		first = previousMonthKey(first)
	}
	return monthsInRange(monthStart(first), monthStart(currentMonth))
}

/** The keyset cursor for "load more": the oldest row currently shown. */
export interface ExpenseCursor {
	date: string
	createdAt: string
	id: number | string
}

/** Whether `row` sorts strictly after `cursor` in the list order
 * (date desc, created_at desc, id desc) — i.e. whether it is older than
 * the cursor. Mirrors the SQL/PostgREST keyset condition in
 * `buildKeysetOr` below; `created_at` values compare lexicographically,
 * which is correct for the ISO timestamps Supabase returns. */
export function isOlderThanCursor(
	row: { date: string; created_at: string; id: number | string },
	cursor: ExpenseCursor
): boolean {
	if (row.date !== cursor.date) return row.date < cursor.date
	if (row.created_at !== cursor.createdAt)
		return row.created_at < cursor.createdAt
	if (typeof row.id === 'number' && typeof cursor.id === 'number')
		return row.id < cursor.id
	return String(row.id) < String(cursor.id)
}

/** PostgREST `.or()` filter selecting rows strictly older than `cursor`
 * in (date, created_at, id) order:
 *   date < cursor.date
 *   OR (date = cursor.date AND created_at < cursor.createdAt)
 *   OR (date = cursor.date AND created_at = cursor.createdAt
 *       AND id < cursor.id)
 * Combined with the month's date range, this is the keyset guard that
 * keeps "load more" from re-downloading rows already on screen. */
export function buildKeysetOr(cursor: ExpenseCursor): string {
	return [
		`date.lt.${cursor.date}`,
		`and(date.eq.${cursor.date},created_at.lt.${cursor.createdAt})`,
		`and(date.eq.${cursor.date},created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
	].join(',')
}

/** Ordering for expense rows: newest first, deterministic on ties. */
export function compareExpenses(a: Expense, b: Expense): number {
	if (a.date !== b.date) return a.date < b.date ? 1 : -1
	if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1
	if (a.id === b.id) return 0
	if (typeof a.id === 'number' && typeof b.id === 'number')
		return a.id < b.id ? 1 : -1
	return String(a.id) < String(b.id) ? 1 : -1
}

/** Merge freshly fetched rows into a month's cached rows, newest first.
 * Rows already present (by id) are dropped, so a realtime insert
 * between loads can never duplicate a row. */
export function mergeExpenses(
	existing: Expense[],
	incoming: Expense[]
): Expense[] {
	const seen = new Set(existing.map((expense) => String(expense.id)))
	const fresh = incoming.filter((expense) => !seen.has(String(expense.id)))
	return [...existing, ...fresh].sort(compareExpenses)
}

/** Rows visible in recent mode: everything on or after `earliestDate`.
 * `earliestDate` starts at the 90-day cutoff and moves back each time
 * "Load more" extends the loaded range, so rows Load More fetched are
 * actually shown. Filtering on the fixed cutoff instead hid them: the
 * query returned August rows and they were merged into the cache, but
 * the list still stopped at the cutoff and looked unchanged. */
export function filterByEarliestDate(
	expenses: Expense[],
	earliestDate: string
): Expense[] {
	if (!earliestDate) return expenses
	return expenses.filter((expense) => expense.date >= earliestDate)
}

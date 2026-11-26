import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	RECENT_WINDOW_DAYS,
	addDays,
	buildKeysetOr,
	compareExpenses,
	filterByEarliestDate,
	formatMonthLabel,
	isOlderThanCursor,
	mergeExpenses,
	monthEnd,
	monthKeyOf,
	monthOptions,
	monthStart,
	monthsInRange,
	previousMonthKey,
	recentCutoff,
	toDateString,
} from '../src/lib/pagination.ts'
import type { Expense } from '../src/lib/types.ts'

function expense(overrides: Partial<Expense>): Expense {
	return {
		id: 1,
		description: 'Test',
		amount: 100,
		paid_by: 'ole',
		split_ratio: 0.5,
		date: '2026-11-10',
		notes: null,
		created_at: '2026-11-10T10:00:00.000Z',
		...overrides,
	}
}

describe('toDateString / addDays', () => {
	it('formats a date as YYYY-MM-DD in local time', () => {
		assert.equal(toDateString(new Date(2026, 0, 5)), '2026-01-05')
	})

	it('adds days across a month boundary', () => {
		assert.equal(addDays('2026-01-30', 3), '2026-02-02')
	})

	it('subtracts days across a year boundary', () => {
		assert.equal(addDays('2026-01-01', -1), '2025-12-31')
	})

	it('handles February in a non-leap year', () => {
		assert.equal(addDays('2026-03-01', -1), '2026-02-28')
	})
})

describe('recentCutoff', () => {
	it('is 90 days before today by default', () => {
		assert.equal(RECENT_WINDOW_DAYS, 90)
		assert.equal(recentCutoff(new Date(2026, 10, 26)), '2026-08-28')
	})

	it('crosses a year boundary', () => {
		assert.equal(recentCutoff(new Date(2026, 2, 1)), '2025-12-01')
	})

	it('respects a custom window', () => {
		assert.equal(recentCutoff(new Date(2026, 10, 26), 30), '2026-10-27')
	})
})

describe('month helpers', () => {
	it('monthKeyOf takes the YYYY-MM prefix', () => {
		assert.equal(monthKeyOf('2026-11-26'), '2026-11')
	})

	it('monthStart is the first of the month', () => {
		assert.equal(monthStart('2026-11'), '2026-11-01')
	})

	it('monthEnd is the first of the next month', () => {
		assert.equal(monthEnd('2026-11'), '2026-12-01')
	})

	it('monthEnd wraps December to January', () => {
		assert.equal(monthEnd('2025-12'), '2026-01-01')
	})

	it('previousMonthKey steps back one month', () => {
		assert.equal(previousMonthKey('2026-11'), '2026-10')
	})

	it('previousMonthKey wraps January to December of the prior year', () => {
		assert.equal(previousMonthKey('2026-01'), '2025-12')
	})

	it('monthsInRange lists overlapping months, newest first', () => {
		assert.deepEqual(monthsInRange('2026-08-28', '2026-11-26'), [
			'2026-11',
			'2026-10',
			'2026-09',
			'2026-08',
		])
	})

	it('monthsInRange handles a single month and a year boundary', () => {
		assert.deepEqual(monthsInRange('2026-11-01', '2026-11-26'), ['2026-11'])
		assert.deepEqual(monthsInRange('2025-12-15', '2026-01-10'), [
			'2026-01',
			'2025-12',
		])
	})

	it('formatMonthLabel spells out the month', () => {
		assert.equal(formatMonthLabel('2026-11'), 'November 2026')
		assert.equal(formatMonthLabel('2025-12'), 'December 2025')
	})

	it('monthOptions lists months from the oldest expense, newest first', () => {
		assert.deepEqual(monthOptions('2026-03-15', '2026-11'), [
			'2026-11',
			'2026-10',
			'2026-09',
			'2026-08',
			'2026-07',
			'2026-06',
			'2026-05',
			'2026-04',
			'2026-03',
		])
	})

	it('monthOptions handles a year boundary and a single month', () => {
		assert.deepEqual(monthOptions('2025-12-20', '2026-01'), [
			'2026-01',
			'2025-12',
		])
		assert.deepEqual(monthOptions('2026-11-03', '2026-11'), ['2026-11'])
	})

	it('monthOptions falls back to a full year when the oldest date is unknown', () => {
		const options = monthOptions(null, '2026-11')
		assert.equal(options.length, 12)
		assert.equal(options[0], '2026-11')
		assert.equal(options[11], '2025-12')
	})

	it('monthOptions never lists a future month', () => {
		assert.deepEqual(monthOptions('2027-02-01', '2026-11'), ['2026-11'])
	})
})

describe('isOlderThanCursor', () => {
	const cursor = {
		date: '2026-08-28',
		createdAt: '2026-08-28T10:00:00.000Z',
		id: 42,
	}

	it('an earlier date is older', () => {
		assert.equal(
			isOlderThanCursor(
				{ date: '2026-08-27', created_at: '2026-08-27T10:00:00.000Z', id: 1 },
				cursor
			),
			true
		)
	})

	it('a later date is not older', () => {
		assert.equal(
			isOlderThanCursor(
				{ date: '2026-08-29', created_at: '2026-08-29T10:00:00.000Z', id: 1 },
				cursor
			),
			false
		)
	})

	it('the same date with an earlier created_at is older', () => {
		assert.equal(
			isOlderThanCursor(
				{ date: '2026-08-28', created_at: '2026-08-28T09:00:00.000Z', id: 1 },
				cursor
			),
			true
		)
	})

	it('the same date with a later created_at is not older', () => {
		assert.equal(
			isOlderThanCursor(
				{ date: '2026-08-28', created_at: '2026-08-28T11:00:00.000Z', id: 1 },
				cursor
			),
			false
		)
	})

	it('the same date and created_at falls back to the id', () => {
		assert.equal(
			isOlderThanCursor(
				{ date: '2026-08-28', created_at: cursor.createdAt, id: 41 },
				cursor
			),
			true
		)
		assert.equal(
			isOlderThanCursor(
				{ date: '2026-08-28', created_at: cursor.createdAt, id: 43 },
				cursor
			),
			false
		)
		assert.equal(
			isOlderThanCursor(
				{ date: '2026-08-28', created_at: cursor.createdAt, id: 42 },
				cursor
			),
			false
		)
	})

	it('numeric ids compare numerically, not lexicographically', () => {
		// '9' > '10' as strings, but 9 < 10 as numbers.
		assert.equal(
			isOlderThanCursor(
				{ date: '2026-08-28', created_at: cursor.createdAt, id: 9 },
				{ ...cursor, id: 10 }
			),
			true
		)
	})

	it('string ids compare lexicographically', () => {
		assert.equal(
			isOlderThanCursor(
				{ date: '2026-08-28', created_at: cursor.createdAt, id: 'a' },
				{ ...cursor, id: 'b' }
			),
			true
		)
	})
})

describe('buildKeysetOr', () => {
	it('builds the three keyset clauses for the cursor', () => {
		assert.equal(
			buildKeysetOr({
				date: '2026-08-28',
				createdAt: '2026-08-28T10:00:00.000Z',
				id: 42,
			}),
			'date.lt.2026-08-28,' +
				'and(date.eq.2026-08-28,created_at.lt.2026-08-28T10:00:00.000Z),' +
				'and(date.eq.2026-08-28,created_at.eq.2026-08-28T10:00:00.000Z,id.lt.42)'
		)
	})
})

describe('filterByEarliestDate', () => {
	// The reported bug: on 2026-11-26 the 90-day cutoff is 2026-08-28.
	// "Load more" fetched August 1–27 rows and merged them into the
	// cache, but the list filtered on the fixed cutoff, so they never
	// showed and the click looked like it did nothing.
	const rows = [
		expense({ id: 1, date: '2026-09-03' }),
		expense({ id: 2, date: '2026-08-28' }),
		expense({ id: 3, date: '2026-08-27' }),
		expense({ id: 4, date: '2026-08-01' }),
		expense({ id: 5, date: '2026-07-15' }),
	]

	it('before any Load More, rows before the cutoff are hidden', () => {
		assert.deepEqual(
			filterByEarliestDate(rows, '2026-08-28').map((row) => row.id),
			[1, 2]
		)
	})

	it('after Load More completes August, rows back to August 1 are shown', () => {
		assert.deepEqual(
			filterByEarliestDate(rows, monthStart('2026-08')).map((row) => row.id),
			[1, 2, 3, 4]
		)
	})

	it('after Load More fetches July, July rows are shown too', () => {
		assert.deepEqual(
			filterByEarliestDate(rows, monthStart('2026-07')).map((row) => row.id),
			[1, 2, 3, 4, 5]
		)
	})

	it('an empty earliest date shows everything', () => {
		assert.deepEqual(
			filterByEarliestDate(rows, '').map((row) => row.id),
			[1, 2, 3, 4, 5]
		)
	})
})

describe('compareExpenses / mergeExpenses', () => {
	it('orders newest first, by date then created_at then id', () => {
		const rows = [
			expense({
				id: 2,
				date: '2026-11-09',
				created_at: '2026-11-09T10:00:00.000Z',
			}),
			expense({
				id: 3,
				date: '2026-11-10',
				created_at: '2026-11-10T09:00:00.000Z',
			}),
			expense({
				id: 1,
				date: '2026-11-10',
				created_at: '2026-11-10T10:00:00.000Z',
			}),
		]
		assert.deepEqual(
			[...rows].sort(compareExpenses).map((row) => row.id),
			[1, 3, 2]
		)
	})

	it('mergeExpenses appends new rows and drops duplicates by id', () => {
		const existing = [
			expense({ id: 3, date: '2026-11-10' }),
			expense({ id: 2, date: '2026-11-09' }),
		]
		const incoming = [
			expense({ id: 3, date: '2026-11-10' }),
			expense({ id: 1, date: '2026-11-08' }),
		]
		assert.deepEqual(
			mergeExpenses(existing, incoming).map((row) => row.id),
			[3, 2, 1]
		)
	})

	it('mergeExpenses keeps the cached row when a refetch repeats it', () => {
		const rows = [expense({ id: 1, date: '2026-11-10' })]
		assert.deepEqual(mergeExpenses(rows, [...rows]), rows)
	})
})

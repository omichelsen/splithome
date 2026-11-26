import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	computeBalance,
	expenseBalanceContribution,
	formatCurrency,
	formatDate,
	getBalanceLabel,
	getSplitLabel,
} from '../src/lib/balance.ts'

// computeBalance returns a float, so compare with a small tolerance.
function assertCloseTo(actual: number, expected: number, epsilon = 1e-9) {
	assert.ok(
		Math.abs(actual - expected) < epsilon,
		`expected ${actual} to be close to ${expected}`
	)
}

describe('computeBalance', () => {
	it('returns 0 for an empty expense list', () => {
		assert.equal(computeBalance([]), 0)
	})

	it('Ole paying a 50/50 expense means Yewleh owes Ole half', () => {
		assertCloseTo(
			computeBalance([{ amount: 100, paid_by: 'ole', split_ratio: 0.5 }]),
			50
		)
	})

	it('Yewleh paying a 50/50 expense means Ole owes Yewleh half', () => {
		assertCloseTo(
			computeBalance([{ amount: 100, paid_by: 'yewleh', split_ratio: 0.5 }]),
			-50
		)
	})

	it('split ratio 0: Ole paying means Yewleh owes the full amount', () => {
		assertCloseTo(
			computeBalance([{ amount: 80, paid_by: 'ole', split_ratio: 0 }]),
			80
		)
	})

	it('split ratio 0: Yewleh paying means nobody owes anything', () => {
		assertCloseTo(
			computeBalance([{ amount: 80, paid_by: 'yewleh', split_ratio: 0 }]),
			0
		)
	})

	it('split ratio 1: Ole paying means nobody owes anything', () => {
		assertCloseTo(
			computeBalance([{ amount: 80, paid_by: 'ole', split_ratio: 1 }]),
			0
		)
	})

	it('split ratio 1: Yewleh paying means Ole owes the full amount', () => {
		assertCloseTo(
			computeBalance([{ amount: 80, paid_by: 'yewleh', split_ratio: 1 }]),
			-80
		)
	})

	it('split ratio 0.25: Ole paying $100 means Yewleh owes $75', () => {
		assertCloseTo(
			computeBalance([{ amount: 100, paid_by: 'ole', split_ratio: 0.25 }]),
			75
		)
	})

	it('split ratio 0.25: Yewleh paying $100 means Ole owes $25', () => {
		assertCloseTo(
			computeBalance([{ amount: 100, paid_by: 'yewleh', split_ratio: 0.25 }]),
			-25
		)
	})

	it('split ratio 0.75: Ole paying $100 means Yewleh owes $25', () => {
		assertCloseTo(
			computeBalance([{ amount: 100, paid_by: 'ole', split_ratio: 0.75 }]),
			25
		)
	})

	it('split ratio 0.75: Yewleh paying $100 means Ole owes $75', () => {
		assertCloseTo(
			computeBalance([{ amount: 100, paid_by: 'yewleh', split_ratio: 0.75 }]),
			-75
		)
	})

	it('sums multiple expenses from both payers', () => {
		assertCloseTo(
			computeBalance([
				{ amount: 100, paid_by: 'ole', split_ratio: 0.5 },
				{ amount: 60, paid_by: 'yewleh', split_ratio: 0.5 },
				{ amount: 40, paid_by: 'ole', split_ratio: 0.25 },
			]),
			50 - 30 + 30
		)
	})

	it('offsetting expenses cancel out', () => {
		assertCloseTo(
			computeBalance([
				{ amount: 100, paid_by: 'ole', split_ratio: 0.5 },
				{ amount: 100, paid_by: 'yewleh', split_ratio: 0.5 },
			]),
			0
		)
	})

	it('accepts amounts stored as strings', () => {
		assertCloseTo(
			computeBalance([
				{ amount: '120.50', paid_by: 'ole', split_ratio: '0.5' },
			]),
			60.25
		)
	})

	it('handles decimal amounts without exact float equality', () => {
		assertCloseTo(
			computeBalance([
				{ amount: 19.99, paid_by: 'ole', split_ratio: 0.5 },
				{ amount: 0.01, paid_by: 'yewleh', split_ratio: 0.5 },
			]),
			9.995 - 0.005
		)
	})

	it('treats any payer other than ole as Yewleh paying', () => {
		assertCloseTo(
			computeBalance([
				{ amount: 100, paid_by: 'someone-else', split_ratio: 0.5 },
			]),
			-50
		)
	})
})

describe('expenseBalanceContribution', () => {
	it('Ole paying contributes amount * (1 - split_ratio)', () => {
		assertCloseTo(
			expenseBalanceContribution({
				amount: 100,
				paid_by: 'ole',
				split_ratio: 0.5,
			}),
			50
		)
		assertCloseTo(
			expenseBalanceContribution({
				amount: 100,
				paid_by: 'ole',
				split_ratio: 0.25,
			}),
			75
		)
	})

	it('Yewleh paying contributes -amount * split_ratio', () => {
		assertCloseTo(
			expenseBalanceContribution({
				amount: 100,
				paid_by: 'yewleh',
				split_ratio: 0.5,
			}),
			-50
		)
		assertCloseTo(
			expenseBalanceContribution({
				amount: 100,
				paid_by: 'yewleh',
				split_ratio: 0.75,
			}),
			-75
		)
	})

	it('accepts amounts stored as strings', () => {
		assertCloseTo(
			expenseBalanceContribution({
				amount: '120.50',
				paid_by: 'ole',
				split_ratio: '0.5',
			}),
			60.25
		)
	})

	it('summing contributions matches computeBalance — the same math the server aggregate in schema.sql uses', () => {
		const expenses = [
			{ amount: 100, paid_by: 'ole', split_ratio: 0.5 },
			{ amount: 60, paid_by: 'yewleh', split_ratio: 0.5 },
			{ amount: 40, paid_by: 'ole', split_ratio: 0.25 },
			{ amount: 0, paid_by: 'ole', split_ratio: 0.5 },
		]
		assertCloseTo(
			expenses.reduce((sum, exp) => sum + expenseBalanceContribution(exp), 0),
			computeBalance(expenses)
		)
	})
})

describe('formatCurrency', () => {
	it('formats zero', () => {
		assert.equal(formatCurrency(0), '$0.00')
	})

	it('formats whole dollars with two decimals', () => {
		assert.equal(formatCurrency(50), '$50.00')
	})

	it('formats cents and thousands separators', () => {
		assert.equal(formatCurrency(1234.5), '$1,234.50')
	})

	it('rounds to two decimals', () => {
		assert.equal(formatCurrency(10.005), '$10.01')
	})

	it('shows the absolute value for a negative amount', () => {
		assert.equal(formatCurrency(-25.5), '$25.50')
	})
})

describe('formatDate', () => {
	it('formats an ISO date as "Mon D, YYYY"', () => {
		assert.equal(formatDate('2026-01-05'), 'Jan 5, 2026')
	})

	it('formats a November date', () => {
		assert.equal(formatDate('2026-11-26'), 'Nov 26, 2026')
	})

	it('formats a double-digit day', () => {
		assert.equal(formatDate('2026-12-25'), 'Dec 25, 2026')
	})
})

describe('getSplitLabel', () => {
	it('returns 50/50 for an even split', () => {
		assert.equal(getSplitLabel(0.5), '50/50')
	})

	it('returns 0% / 100% when Ole pays nothing', () => {
		assert.equal(getSplitLabel(0), '0% / 100%')
	})

	it('returns 100% / 0% when Ole pays everything', () => {
		assert.equal(getSplitLabel(1), '100% / 0%')
	})

	it('returns 25% / 75% for a quarter split', () => {
		assert.equal(getSplitLabel(0.25), '25% / 75%')
	})

	it('returns 75% / 25% for a three-quarter split', () => {
		assert.equal(getSplitLabel(0.75), '75% / 25%')
	})

	it('rounds non-round ratios to whole percents', () => {
		assert.equal(getSplitLabel(0.333), '33% / 67%')
	})
})

describe('getBalanceLabel', () => {
	it('reports settled for a zero balance', () => {
		assert.deepEqual(getBalanceLabel(0), {
			text: 'All settled up!',
			who: 'settled',
		})
	})

	it('reports settled for a sub-cent balance', () => {
		assert.deepEqual(getBalanceLabel(0.005), {
			text: 'All settled up!',
			who: 'settled',
		})
		assert.deepEqual(getBalanceLabel(-0.009), {
			text: 'All settled up!',
			who: 'settled',
		})
	})

	it('reports Yewleh owes Ole for a positive balance', () => {
		assert.deepEqual(getBalanceLabel(42.5), {
			text: 'Yewleh owes Ole $42.50',
			who: 'yewleh',
		})
	})

	it('reports Ole owes Yewleh for a negative balance', () => {
		assert.deepEqual(getBalanceLabel(-12.34), {
			text: 'Ole owes Yewleh $12.34',
			who: 'ole',
		})
	})

	it('treats exactly one cent as a real balance, not settled', () => {
		assert.equal(getBalanceLabel(0.01).who, 'yewleh')
		assert.equal(getBalanceLabel(-0.01).who, 'ole')
	})
})

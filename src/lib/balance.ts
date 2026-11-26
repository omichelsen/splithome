/**
 * For each expense:
 *   - paid_by = 'ole', split_ratio = 0.5 (50/50)
 *     → Yewleh owes Ole: amount * 0.5
 *   - paid_by = 'wife', split_ratio = 0.5
 *     → Ole owes Yewleh: amount * 0.5
 *   - paid_by = 'ole', split_ratio = 0.7 (Ole pays 70%, Yewleh pays 30%)
 *     → Yewleh owes Ole: amount * 0.3
 *
 * Positive balance = Yewleh owes Ole
 * Negative balance = Ole owes Yewleh
 */

/** Amounts and split ratios can arrive as strings (Supabase numerics);
 * read them as numbers, preserving parseFloat's string semantics. */
export function toNumber(value: number | string): number {
	return typeof value === 'number' ? value : parseFloat(value)
}

/** The shape computeBalance needs. `paid_by` is deliberately a plain
 * string here, not the `Payer` union: any payer other than 'ole' is
 * treated as Yewleh paying (the else branch below). */
export interface BalanceExpense {
	amount: number | string
	paid_by: string
	split_ratio: number | string
}

export function computeBalance(expenses: BalanceExpense[]): number {
	let balance = 0

	for (const exp of expenses) {
		const amount = toNumber(exp.amount)
		const myShare = toNumber(exp.split_ratio)
		const yewlehShare = 1 - myShare

		if (exp.paid_by === 'ole') {
			// Ole paid, Yewleh owes Ole her share
			balance += amount * yewlehShare
		} else {
			// Yewleh paid, I owe her my share
			balance -= amount * myShare
		}
	}

	return balance
}

export function formatCurrency(amount: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
	}).format(Math.abs(amount))
}

export type BalanceWho = 'settled' | 'yewleh' | 'ole'

export function getBalanceLabel(balance: number): {
	text: string
	who: BalanceWho
} {
	if (Math.abs(balance) < 0.01)
		return { text: 'All settled up!', who: 'settled' }
	if (balance > 0)
		return { text: `Yewleh owes Ole ${formatCurrency(balance)}`, who: 'yewleh' }
	return { text: `Ole owes Yewleh ${formatCurrency(balance)}`, who: 'ole' }
}

export function formatDate(dateStr: string): string {
	return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})
}

export function getSplitLabel(ratio: number): string {
	const mine = Math.round(ratio * 100)
	const hers = 100 - mine
	if (mine === hers) return '50/50'
	return `${mine}% / ${hers}%`
}

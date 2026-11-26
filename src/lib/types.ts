export type Payer = 'ole' | 'yewleh'

export type Filter = 'all' | Payer

/** An expense row as stored in Supabase. `amount` and `split_ratio` are
 * typed as `number | string` because Supabase numeric columns can arrive
 * as strings; use `toNumber` (lib/balance) to read them as numbers.
 * Declared as a `type`, not an `interface`: supabase-js requires Row to
 * be assignable to `Record<string, unknown>`, which interfaces are not. */
export type Expense = {
	id: number | string
	description: string
	amount: number | string
	paid_by: Payer
	split_ratio: number | string
	date: string
	notes: string | null
	created_at: string
}

export type ExpenseInsert = Omit<Expense, 'id' | 'created_at'>

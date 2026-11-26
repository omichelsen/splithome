import { createClient } from '@supabase/supabase-js'
import type { Expense, ExpenseInsert } from './types'

interface Database {
	public: {
		Tables: {
			expenses: {
				Row: Expense
				Insert: ExpenseInsert
				Update: Partial<ExpenseInsert>
				Relationships: []
			}
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			/** Totals over ALL expenses, computed in Postgres — see
			 * schema.sql. The headline balance comes from here, so the
			 * app never has to download every row to show it. */
			get_expense_summary: {
				Args: Record<string, never>
				Returns: {
					balance: number
					total_spent: number
					expense_count: number
					oldest_date: string | null
				}[]
			}
		}
	}
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

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
			[_ in never]: never
		}
	}
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

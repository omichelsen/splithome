-- SplitHome database schema.
--
-- HOW TO APPLY: run this file in the Supabase Dashboard → SQL Editor.
-- Merging it into the repo does NOT change the live database.
--
-- The table is documented here as it already exists in the project
-- (CREATE TABLE IF NOT EXISTS is safe to run against it). The new parts
-- are the index and the get_expense_summary() function below.
--
-- RLS: this file intentionally contains NO row-level-security policies
-- and does not change RLS. The app reads/writes with the anon key, so
-- verify in the Supabase Dashboard that RLS on `expenses` is set up the
-- way you expect before relying on it.

create table if not exists public.expenses (
	id bigint generated always as identity primary key,
	description text not null,
	amount numeric not null,
	paid_by text not null check (paid_by in ('ole', 'yewleh')),
	split_ratio numeric not null check (split_ratio >= 0 and split_ratio <= 1),
	date date not null,
	notes text,
	created_at timestamptz not null default now()
);

-- The list is always fetched by month, newest first, so ranged queries
-- on date stay fast as the history grows to years of transactions.
create index if not exists expenses_date_created_at_idx
	on public.expenses (date desc, created_at desc);

-- Headline totals over ALL expenses, computed in Postgres so the app
-- never has to download every row to show the balance. The CASE is the
-- same math as expenseBalanceContribution() in src/lib/balance.ts —
-- keep the two in sync.
--
--   paid_by = 'ole' → Yewleh owes Ole amount * (1 - split_ratio)
--   otherwise       → Ole owes Yewleh amount * split_ratio
--
-- Positive balance = Yewleh owes Ole. `oldest_date` tells the app when
-- there is nothing older to "Load more". Until this function is applied
-- in the Supabase SQL editor, the app falls back to computing the same
-- totals client-side (see fetchSummary in src/lib/expenses.ts).
create or replace function public.get_expense_summary()
returns table (
	balance numeric,
	total_spent numeric,
	expense_count bigint,
	oldest_date date
)
language sql
stable
as $$
	select
		coalesce(sum(case
			when paid_by = 'ole' then amount * (1 - split_ratio)
			else -amount * split_ratio
		end), 0),
		coalesce(sum(amount), 0),
		count(*),
		min(date)
	from public.expenses;
$$;

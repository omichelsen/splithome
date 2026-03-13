# SplitHome — Shared Expense Tracker

Track shared expenses between you and your wife, with custom splits.

## Setup (10–15 minutes)

### 1. Set up Supabase (free)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New project** and give it a name (e.g. "splithome")
3. Once created, go to **SQL Editor** in the left sidebar
4. Paste the contents of `schema.sql` and click **Run**
5. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and paste your Supabase URL and anon key.

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — you should see the app!

### 4. Deploy (optional, free)

To access from both your phones:

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → import your repo
3. Add your environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)
4. Deploy — you get a URL both of you can bookmark

---

## How it works

**Adding an expense:**
- Enter description and amount
- Select who paid (you or wife)
- Drag the split slider — center = 50/50, drag left = you pay more, drag right = wife pays more
- Add optional notes and date

**The balance:**
- The app always shows who owes whom and how much
- This is recalculated live from all expenses — deleting an expense updates the balance immediately

**Realtime sync:**
- Both devices see changes instantly via Supabase realtime subscriptions
- No refresh needed

---

## Project structure

```
src/
  lib/
    supabase.js      ← Supabase client setup
    balance.js       ← Balance calculation logic
  components/
    BalanceSummary.jsx  ← The balance card at the top
    ExpenseList.jsx     ← The scrollable expense history
    AddExpenseModal.jsx ← The "add expense" form
  App.jsx            ← Main app, data fetching, realtime
  App.css            ← All styles
schema.sql           ← Run this in Supabase SQL Editor once
```

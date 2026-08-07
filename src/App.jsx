import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { computeBalance } from './lib/balance'
import BalanceSummary from './components/BalanceSummary'
import ExpenseList from './components/ExpenseList'
import AddExpenseModal from './components/AddExpenseModal'
import './App.css'

function ExpenseListSkeleton() {
  return (
    <ul className="expense-list skeleton-list" aria-busy="true" aria-label="Loading expenses">
      {Array.from({ length: 5 }).map((_, index) => (
        <li className="expense-item skeleton-expense" key={index}>
          <div className="expense-main">
            <div className="expense-left">
              <span className="skeleton-line skeleton-desc" />
              <span className="skeleton-line skeleton-meta" />
            </div>
            <div className="expense-right">
              <span className="skeleton-line skeleton-total" />
              <div className="expense-shares">
                <span className="skeleton-line skeleton-chip" />
                <span className="skeleton-line skeleton-chip skeleton-chip-short" />
              </div>
              <span className="skeleton-line skeleton-delete" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function App() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('all') // 'all' | 'ole' | 'yewleh'
  const [error, setError] = useState('')

  // Fetch all expenses on mount
  useEffect(() => {
    fetchExpenses()

    // Subscribe to realtime changes so both devices stay in sync
    const channel = supabase
      .channel('expenses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        fetchExpenses()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchExpenses() {
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      setError('Could not load expenses. Check your Supabase config.')
    } else {
      setExpenses(data || [])
    }
    setLoading(false)
  }

  async function handleAdd(expenseData) {
    const { error } = await supabase.from('expenses').insert([expenseData])
    if (error) throw new Error(error.message)
    // Realtime subscription will trigger fetchExpenses automatically
  }

  async function handleDelete(id) {
    if (!confirm('Delete this expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) setError('Could not delete expense.')
  }

  const filtered = filter === 'all'
    ? expenses
    : expenses.filter(e => e.paid_by === filter)

  const balance = computeBalance(expenses)
  const totalSpent = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0)

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-title">
            <h1>SplitHome</h1>
            <span className="header-sub">Ole & Yewleh expenses tracker</span>
          </div>
          <button className="add-btn" onClick={() => setShowModal(true)}>
            + Add expense
          </button>
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}

        <BalanceSummary
          balance={balance}
          totalExpenses={totalSpent}
          expenseCount={expenses.length}
          loading={loading}
        />

        <div className="list-section">
          <div className="list-header">
            <h2>Expenses</h2>
            <div className="filter-tabs">
              {['all', 'ole', 'yewleh'].map(f => (
                <button
                  key={f}
                  className={`filter-tab ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'ole' ? 'Paid by Ole' : 'Paid by Yewleh'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <ExpenseListSkeleton />
          ) : (
            <ExpenseList expenses={filtered} onDelete={handleDelete} />
          )}
        </div>
      </main>

      {showModal && (
        <AddExpenseModal
          onAdd={handleAdd}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

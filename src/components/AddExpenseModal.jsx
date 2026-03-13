import { useState } from 'react'
import { getSplitLabel } from '../lib/balance'

const TODAY = new Date().toISOString().split('T')[0]

export default function AddExpenseModal({ onAdd, onClose }) {
  const [form, setForm] = useState({
    description: '',
    amount: '',
    paid_by: 'ole',
    split_ratio: 0.5,
    date: TODAY,
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.description.trim()) return setError('Description is required')
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0)
      return setError('Enter a valid amount')

    setLoading(true)
    setError('')
    try {
      await onAdd({ ...form, amount: parseFloat(form.amount) })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to add expense')
    } finally {
      setLoading(false)
    }
  }

  const splitSteps = [0, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1.0]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add expense</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="expense-form">
          <div className="field">
            <label>Description</label>
            <input
              autoFocus
              type="text"
              placeholder="Groceries, dinner, utilities…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          <div className="field">
            <label>Amount</label>
            <div className="amount-input">
              <span className="currency-symbol">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Paid by</label>
            <div className="toggle-group">
              {['ole', 'wife'].map(who => (
                <button
                  key={who}
                  type="button"
                  className={`toggle-btn ${form.paid_by === who ? 'active' : ''}`}
                  onClick={() => set('paid_by', who)}
                >
                  {who === 'ole' ? 'Ole' : 'Yewleh'}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>
              Split
              <span className="split-badge">{getSplitLabel(form.split_ratio)}</span>
            </label>
            <div className="split-visual">
              <span className="split-name">Ole</span>
              <div className="split-bar-container">
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={splitSteps.indexOf(form.split_ratio) !== -1
                    ? splitSteps.indexOf(form.split_ratio)
                    : 6}
                  onChange={e => set('split_ratio', splitSteps[parseInt(e.target.value)])}
                  className="split-slider"
                />
                <div className="split-bar">
                  <div
                    className="split-fill-me"
                    style={{ width: `${form.split_ratio * 100}%` }}
                  />
                  <div
                    className="split-fill-yewleh"
                    style={{ width: `${(1 - form.split_ratio) * 100}%` }}
                  />
                </div>
              </div>
              <span className="split-name">Yewleh</span>
            </div>
            <div className="split-percentages">
              <span>{Math.round(form.split_ratio * 100)}%</span>
              <span>{Math.round((1 - form.split_ratio) * 100)}%</span>
            </div>
          </div>

          <div className="field">
            <label>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
            />
          </div>

          <div className="field">
            <label>Notes <span className="optional">(optional)</span></label>
            <input
              type="text"
              placeholder="Any extra details…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Saving…' : 'Add expense'}
          </button>
        </form>
      </div>
    </div>
  )
}

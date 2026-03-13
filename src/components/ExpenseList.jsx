import { formatDate, formatCurrency, getSplitLabel } from '../lib/balance'

export default function ExpenseList({ expenses, onDelete }) {
  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p>No expenses yet.</p>
        <p>Add your first one above!</p>
      </div>
    )
  }

  return (
    <ul className="expense-list">
      {expenses.map(exp => {
        const amount = parseFloat(exp.amount)
        const myShare = amount * parseFloat(exp.split_ratio)
        const yewlehShare = amount * (1 - parseFloat(exp.split_ratio))

        return (
          <li key={exp.id} className="expense-item">
            <div className="expense-main">
              <div className="expense-left">
                <span className="expense-desc">{exp.description}</span>
                {exp.notes && <span className="expense-notes">{exp.notes}</span>}
                <span className="expense-meta">
                  {formatDate(exp.date)} · Paid by <strong>{exp.paid_by === 'ole' ? 'Ole' : 'Yewleh'}</strong>
                  {' · '}{getSplitLabel(parseFloat(exp.split_ratio))}
                </span>
              </div>
              <div className="expense-right">
                <span className="expense-total">{formatCurrency(amount)}</span>
                <div className="expense-shares">
                  <span className="share-ole">Ole: {formatCurrency(myShare)}</span>
                  <span className="share-yewleh">Yewleh: {formatCurrency(yewlehShare)}</span>
                </div>
                <button
                  className="delete-btn"
                  onClick={() => onDelete(exp.id)}
                  aria-label="Delete expense"
                >
                  ✕
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

import { Fragment } from 'react'
import { formatCurrency } from '../lib/balance'

export default function BalanceSummary({ balance, totalExpenses, expenseCount, loading = false }) {
  if (loading) {
    return (
      <div className="balance-card balance-loading" aria-busy="true" aria-label="Loading balance summary">
        <div className="balance-main">
          <span className="skeleton-line skeleton-label" />
          <span className="skeleton-line skeleton-balance-amount" />
        </div>
        <div className="balance-stats">
          {[0, 1, 2].map((item) => (
            <Fragment key={item}>
              {item > 0 && <div className="stat-divider" />}
              <div className="stat">
                <span className="skeleton-line skeleton-stat-value" />
                <span className="skeleton-line skeleton-stat-label" />
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    )
  }

  const settled = Math.abs(balance) < 0.01

  return (
    <div className={`balance-card ${settled ? 'settled' : balance > 0 ? 'yewleh-owes' : 'ole-owes'}`}>
      <div className="balance-main">
        <span className="balance-label">
          {settled ? 'All settled up' : balance > 0 ? 'Yewleh owes Ole' : 'Ole owes Yewleh'}
        </span>
        {!settled && (
          <span className="balance-amount">{formatCurrency(balance)}</span>
        )}
        {settled && <span className="balance-check">✓</span>}
      </div>
      <div className="balance-stats">
        <div className="stat">
          <span className="stat-value">{expenseCount}</span>
          <span className="stat-label">expenses</span>
        </div>
        <div className="stat-divider" />
        <div className="stat">
          <span className="stat-value">{formatCurrency(totalExpenses)}</span>
          <span className="stat-label">total spent</span>
        </div>
        <div className="stat-divider" />
        <div className="stat">
          <span className="stat-value">{formatCurrency(totalExpenses / 2)}</span>
          <span className="stat-label">avg per person</span>
        </div>
      </div>
    </div>
  )
}

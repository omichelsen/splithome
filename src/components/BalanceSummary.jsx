import { formatCurrency } from '../lib/balance'

export default function BalanceSummary({ balance, totalExpenses, expenseCount }) {
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

import {
	formatDate,
	formatCurrency,
	getSplitLabel,
	toNumber,
} from '../lib/balance'
import type { Expense } from '../lib/types'

interface ExpenseListProps {
	expenses: Expense[]
	onDelete: (id: Expense['id']) => void
	/** Replaces the empty state when the list is empty for a reason
	 * other than "no expenses at all" — e.g. a month with no expenses. */
	emptyMessage?: string
}

export default function ExpenseList({
	expenses,
	onDelete,
	emptyMessage,
}: ExpenseListProps) {
	if (expenses.length === 0) {
		return (
			<div className="empty-state">
				<p>{emptyMessage ?? 'No expenses yet.'}</p>
				{!emptyMessage && <p>Add your first one above!</p>}
			</div>
		)
	}

	return (
		<ul className="expense-list">
			{expenses.map((exp) => {
				const amount = toNumber(exp.amount)
				const myShare = amount * toNumber(exp.split_ratio)
				const yewlehShare = amount * (1 - toNumber(exp.split_ratio))

				return (
					<li key={exp.id} className="expense-item">
						<div className="expense-main">
							<div className="expense-left">
								<span className="expense-desc">{exp.description}</span>
								{exp.notes && (
									<span className="expense-notes">{exp.notes}</span>
								)}
								<span className="expense-meta">
									{formatDate(exp.date)} · Paid by{' '}
									<strong>{exp.paid_by === 'ole' ? 'Ole' : 'Yewleh'}</strong>
									{' · '}
									{getSplitLabel(toNumber(exp.split_ratio))}
								</span>
							</div>
							<div className="expense-right">
								<span className="expense-total">{formatCurrency(amount)}</span>
								<div className="expense-shares">
									<span className="share-ole">
										Ole: {formatCurrency(myShare)}
									</span>
									<span className="share-yewleh">
										Yewleh: {formatCurrency(yewlehShare)}
									</span>
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

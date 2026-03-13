/**
 * For each expense:
 *   - paid_by = 'ole', split_ratio = 0.5 (50/50)
 *     → Yewleh owes Ole: amount * 0.5
 *   - paid_by = 'wife', split_ratio = 0.5
 *     → Ole owes Yewleh: amount * 0.5
 *   - paid_by = 'ole', split_ratio = 0.7 (Ole pays 70%, Yewleh pays 30%)
 *     → Yewleh owes Ole: amount * 0.3
 *
 * Positive balance = Yewleh owes Ole
 * Negative balance = Ole owes Yewleh
 */
export function computeBalance(expenses) {
  let balance = 0

  for (const exp of expenses) {
    const amount = parseFloat(exp.amount)
    const myShare = parseFloat(exp.split_ratio)
    const yewlehShare = 1 - myShare

    if (exp.paid_by === 'ole') {
      // Ole paid, Yewleh owes Ole her share
      balance += amount * yewlehShare
    } else {
      // Yewleh paid, I owe her my share
      balance -= amount * myShare
    }
  }

  return balance
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(amount))
}

export function getBalanceLabel(balance) {
  if (Math.abs(balance) < 0.01) return { text: "All settled up!", who: 'settled' }
  if (balance > 0) return { text: `Yewleh owes Ole ${formatCurrency(balance)}`, who: 'yewleh' }
  return { text: `Ole owes Yewleh ${formatCurrency(balance)}`, who: 'ole' }
}

export function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export function getSplitLabel(ratio) {
  const mine = Math.round(ratio * 100)
  const hers = 100 - mine
  if (mine === hers) return '50/50'
  return `${mine}% / ${hers}%`
}

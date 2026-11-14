/**
 * balance-calculator.js — Pure balance computation for the Expense & Budget Visualizer.
 *
 * Exported as an ES module so it can be imported by both app.js (via dynamic
 * import or inlining the same logic) and by unit / property-based test files.
 *
 * No DOM, no side effects, no globals.
 */

'use strict';

/**
 * Shared currency formatter — `Intl.NumberFormat` configured for USD with exactly
 * two decimal places.
 *
 * @type {Intl.NumberFormat}
 */
const _fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/**
 * Computes the total balance by summing all transaction `amount` values.
 *
 * Rules:
 *   - Returns 0 when `transactions` is empty, null, or undefined.
 *   - Non-finite amounts (NaN, Infinity) are skipped rather than propagated.
 *   - The returned value is the raw numeric sum (not formatted).
 *
 * @param {Array<{ amount: number }>} transactions
 * @returns {number}
 */
export function computeBalance(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return 0;
  }

  let total = 0;
  for (const tx of transactions) {
    const n = Number(tx.amount);
    if (isFinite(n)) {
      total += n;
    }
  }
  return total;
}

/**
 * Formats a numeric balance value as a USD currency string using `Intl.NumberFormat`.
 *
 * Always returns a string with exactly two decimal places and a "$" prefix,
 * e.g. `"$1,234.56"` or `"$0.00"`.
 *
 * @param {number} amount
 * @returns {string}
 */
export function formatBalance(amount) {
  const n = Number(amount);
  return _fmt.format(isFinite(n) ? n : 0);
}

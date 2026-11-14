/**
 * chart-aggregator.js — Pure aggregation function for the pie chart.
 *
 * Exported as an ES module so it can be imported by both app.js and test files.
 *
 * No DOM, no Chart.js dependency, no side effects, no globals.
 */

'use strict';

/**
 * Aggregates transaction amounts by category.
 *
 * Returns an object whose keys are category names and whose values are the
 * total (summed) amounts for all transactions in that category.  Only
 * transactions with a positive `amount` are included; zero or negative amounts
 * are skipped.
 *
 * Returns `{}` when `transactions` is empty, null, or undefined.
 *
 * @param {Array<{ category: string, amount: number }>} transactions
 * @returns {{ [category: string]: number }}
 *
 * @example
 * aggregateByCategory([
 *   { category: 'Food',      amount: 20 },
 *   { category: 'Transport', amount: 10 },
 *   { category: 'Food',      amount: 15 },
 * ]);
 * // → { Food: 35, Transport: 10 }
 */
export function aggregateByCategory(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return {};
  }

  const totals = {};
  for (const tx of transactions) {
    const amount = Number(tx.amount);
    // Only include positive-amount transactions (expense-type)
    if (!isFinite(amount) || amount <= 0) {
      continue;
    }
    const category = String(tx.category);
    totals[category] = (totals[category] ?? 0) + amount;
  }

  return totals;
}

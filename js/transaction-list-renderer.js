/**
 * transaction-list-renderer.js — Pure helper for the transaction list renderer.
 *
 * Exported as an ES module so it can be imported by both app.js and test files.
 *
 * No DOM, no side effects, no globals.
 */

'use strict';

/**
 * Currency formatter shared by renderTransactionRow and tests.
 * @type {Intl.NumberFormat}
 */
const _fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/**
 * Formats a monetary amount using the standard USD currency formatter.
 *
 * @param {number} amount
 * @returns {string}  e.g. "$1,234.50"
 */
export function formatAmount(amount) {
  return _fmt.format(Number(amount));
}

/**
 * Builds the data descriptor for a single transaction list row.
 *
 * Returns a plain object so the caller (UIRenderer in app.js) can create DOM
 * nodes from it, and tests can verify the values without a live DOM.
 *
 * @param {{ id: string, name: string, amount: number, category: string }} tx
 * @returns {{ id: string, name: string, formattedAmount: string, category: string }}
 */
export function buildTransactionRow(tx) {
  return {
    id:              String(tx.id),
    name:            String(tx.name),
    formattedAmount: formatAmount(tx.amount),
    category:        String(tx.category)
  };
}

/**
 * Prepares the full view-model for the transaction list panel.
 *
 * Returns either:
 *   - `{ empty: true }` when there are no transactions, or
 *   - `{ empty: false, rows: Array<{id, name, formattedAmount, category}> }`
 *     where rows are pre-sorted by the supplied sort function.
 *
 * The `sortFn` parameter accepts a `(transactions, criterion)` function so the
 * module has zero dependency on SortEngine and stays purely testable.
 *
 * @param {object[]}   transactions
 * @param {string|null} sortCriterion
 * @param {Function}   sortFn  — `(txs: object[], criterion: string|null) => object[]`
 * @returns {{ empty: true } | { empty: false, rows: object[] }}
 */
export function buildTransactionListViewModel(transactions, sortCriterion, sortFn) {
  const txs = Array.isArray(transactions) ? transactions : [];

  if (txs.length === 0) {
    return { empty: true };
  }

  const sorted = sortFn(txs, sortCriterion);
  const rows   = sorted.map(buildTransactionRow);

  return { empty: false, rows };
}

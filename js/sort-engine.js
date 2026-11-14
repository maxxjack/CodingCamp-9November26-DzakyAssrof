/**
 * sort-engine.js — Pure sorting functions for the Expense & Budget Visualizer.
 *
 * Exported as an ES module so they can be imported by both app.js and test files.
 *
 * No DOM, no side effects, no globals.
 */

'use strict';

/**
 * Comparator factory.  Returns a numeric comparison value for two transactions
 * according to the given criterion.  Ties on the primary key always fall back to
 * `createdAt` ascending (preserves insertion order).
 *
 * @param {'amount-asc'|'amount-desc'|'category-asc'|null} criterion
 * @returns {(a: object, b: object) => number}
 */
function makeComparator(criterion) {
  return (a, b) => {
    let primary = 0;

    if (criterion === 'amount-asc') {
      primary = a.amount - b.amount;
    } else if (criterion === 'amount-desc') {
      primary = b.amount - a.amount;
    } else if (criterion === 'category-asc') {
      const ca = String(a.category).toLowerCase();
      const cb = String(b.category).toLowerCase();
      primary = ca < cb ? -1 : ca > cb ? 1 : 0;
    }
    // null criterion: primary stays 0, tie-break by createdAt always applies

    // Tie-break: earlier createdAt comes first (insertion order)
    return primary !== 0 ? primary : a.createdAt - b.createdAt;
  };
}

/**
 * Returns a new array of transactions sorted according to `criterion`.
 *
 * - `null`           — copy in original insertion order (createdAt ascending)
 * - `'amount-asc'`   — ascending by amount; ties broken by createdAt ascending
 * - `'amount-desc'`  — descending by amount; ties broken by createdAt ascending
 * - `'category-asc'` — ascending alphabetically by category (case-insensitive);
 *                       ties broken by createdAt ascending
 *
 * The original array is never mutated.
 *
 * @param {object[]} transactions
 * @param {'amount-asc'|'amount-desc'|'category-asc'|null} criterion
 * @returns {object[]}
 */
export function sort(transactions, criterion) {
  // Spread into a new array so we never mutate the caller's reference.
  return [...transactions].sort(makeComparator(criterion));
}

/**
 * Returns a new array with `newTx` inserted at the correct sorted position.
 *
 * When `criterion` is `null`, `newTx` is appended at the end (matches the
 * "no active sort → insertion order" behaviour).
 *
 * The original array is never mutated.
 *
 * @param {object[]} transactions   — already sorted (or in insertion order)
 * @param {object}   newTx          — the transaction to insert
 * @param {'amount-asc'|'amount-desc'|'category-asc'|null} criterion
 * @returns {object[]}
 */
export function insertSorted(transactions, newTx, criterion) {
  if (criterion === null) {
    // No active sort: append at the end.
    return [...transactions, newTx];
  }

  const cmp = makeComparator(criterion);
  const result = [...transactions];

  // Linear scan to find the first position where newTx belongs before result[i].
  let insertAt = result.length; // default: append
  for (let i = 0; i < result.length; i++) {
    if (cmp(newTx, result[i]) < 0) {
      insertAt = i;
      break;
    }
  }

  result.splice(insertAt, 0, newTx);
  return result;
}

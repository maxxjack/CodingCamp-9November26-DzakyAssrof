/**
 * monthly-aggregator.js — Pure monthly grouping functions for the Expense & Budget Visualizer.
 *
 * Exported as an ES module so they can be imported by both app.js and test files.
 *
 * No DOM, no side effects, no globals.
 */

'use strict';

/**
 * Formats a Date object into a 'YYYY-MM' string with zero-padded month.
 *
 * @param {Date} date
 * @returns {string}  e.g. '2024-01' for January 2024
 */
function toMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns a sorted (ascending) array of distinct 'YYYY-MM' month key strings
 * representing every calendar month that has at least one transaction.
 *
 * Returns an empty array when `transactions` is empty, null, or undefined.
 *
 * @param {Array<{ createdAt: number }>} transactions
 * @returns {string[]}  sorted 'YYYY-MM' strings, oldest first
 */
export function getAvailableMonths(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return [];
  }

  const monthSet = new Set();
  for (const tx of transactions) {
    const key = toMonthKey(new Date(tx.createdAt));
    monthSet.add(key);
  }

  return [...monthSet].sort();
}

/**
 * Returns a summary of transactions for a given calendar month.
 *
 * Filters transactions whose `createdAt` timestamp falls within the calendar
 * month identified by `monthKey` ('YYYY-MM'), then returns:
 *   - `total`      : sum of amounts of all matching transactions
 *   - `byCategory` : map of category → sum of amounts for that category
 *
 * Returns `{ total: 0, byCategory: {} }` when no transactions match.
 *
 * @param {Array<{ createdAt: number, amount: number, category: string }>} transactions
 * @param {string} monthKey  — 'YYYY-MM' format, e.g. '2024-11'
 * @returns {{ total: number, byCategory: { [category: string]: number } }}
 */
export function summarize(transactions, monthKey) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return { total: 0, byCategory: {} };
  }

  const [yearStr, monthStr] = String(monthKey).split('-');
  const targetYear = parseInt(yearStr, 10);
  const targetMonth = parseInt(monthStr, 10); // 1-based

  let total = 0;
  const byCategory = {};

  for (const tx of transactions) {
    const date = new Date(tx.createdAt);
    if (
      date.getFullYear() === targetYear &&
      date.getMonth() + 1 === targetMonth
    ) {
      total += tx.amount;
      byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amount;
    }
  }

  return { total, byCategory };
}

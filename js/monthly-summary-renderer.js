/**
 * monthly-summary-renderer.js — Pure helper for the monthly summary renderer.
 *
 * Exported as an ES module so it can be imported by both app.js and test files.
 *
 * No DOM, no side effects, no globals.
 */

'use strict';

/**
 * Currency formatter shared by buildMonthlySummaryViewModel and tests.
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
 * Builds the view-model for the monthly summary panel.
 *
 * Uses the result of `summarizeFn(transactions, selectedMonth)` — which returns
 * `{ total: number, byCategory: { [category: string]: number } }` — to produce
 * a plain data descriptor the DOM renderer can consume.
 *
 * Requirement 7.4: when no transactions exist for the selected month but there
 * are transactions in other months, the returned `categories` list includes every
 * category found anywhere in `transactions`, each with an amount of $0.00.
 *
 * @param {object[]} transactions    — full transaction array (all months)
 * @param {string}   selectedMonth   — 'YYYY-MM' key
 * @param {Function} summarizeFn     — `(transactions, monthKey) => { total, byCategory }`
 * @returns {{
 *   formattedTotal: string,
 *   categories: Array<{ name: string, formattedAmount: string }>,
 *   hasCategories: boolean
 * }}
 */
export function buildMonthlySummaryViewModel(transactions, selectedMonth, summarizeFn) {
  const txs = Array.isArray(transactions) ? transactions : [];

  const { total, byCategory } = summarizeFn(txs, selectedMonth);

  // Start with the categories that have transactions in the selected month
  const categoryMap = { ...byCategory };

  // Requirement 7.4: no transactions this month but other months have some →
  // show all categories from the entire list at $0.00
  if (Object.keys(categoryMap).length === 0 && txs.length > 0) {
    for (const tx of txs) {
      const cat = String(tx.category);
      if (!(cat in categoryMap)) {
        categoryMap[cat] = 0;
      }
    }
  }

  const categoryKeys = Object.keys(categoryMap).sort();

  return {
    formattedTotal: formatAmount(total),
    categories: categoryKeys.map(name => ({
      name,
      formattedAmount: formatAmount(categoryMap[name])
    })),
    hasCategories: categoryKeys.length > 0
  };
}

/**
 * Tests for MonthlyAggregator — getAvailableMonths() and summarize()
 *
 * Covers:
 *   - Unit tests: specific examples and edge cases
 *   - Property-based test (Property 7): monthly summary totals match filtered transactions
 *
 * Run with:  npm test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getAvailableMonths, summarize } from '../js/monthly-aggregator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal transaction object.
 * @param {Partial<{ id: string, name: string, amount: number, category: string, createdAt: number }>} overrides
 */
function tx(overrides = {}) {
  return {
    id:        overrides.id        ?? 'id-default',
    name:      overrides.name      ?? 'Item',
    amount:    overrides.amount    ?? 10,
    category:  overrides.category  ?? 'Food',
    createdAt: overrides.createdAt ?? Date.now(),
    ...overrides
  };
}

/**
 * Returns the UTC ms timestamp for the first millisecond of a given year/month.
 * Month is 1-based (1 = January).
 *
 * @param {number} year
 * @param {number} month  1-based
 * @returns {number}
 */
function monthStart(year, month) {
  return new Date(year, month - 1, 1, 0, 0, 0, 0).getTime();
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — getAvailableMonths()
// ─────────────────────────────────────────────────────────────────────────────

describe('getAvailableMonths() — empty / null inputs', () => {
  it('returns [] for an empty array', () => {
    expect(getAvailableMonths([])).toEqual([]);
  });

  it('returns [] for null', () => {
    expect(getAvailableMonths(null)).toEqual([]);
  });

  it('returns [] for undefined', () => {
    expect(getAvailableMonths(undefined)).toEqual([]);
  });
});

describe('getAvailableMonths() — single transaction', () => {
  it('returns a single month key for one transaction', () => {
    const result = getAvailableMonths([
      tx({ createdAt: new Date(2024, 10, 15).getTime() }) // November 2024 (0-indexed month)
    ]);
    expect(result).toEqual(['2024-11']);
  });
});

describe('getAvailableMonths() — multiple transactions', () => {
  it('returns correct sorted month keys for transactions across different months', () => {
    const txs = [
      tx({ id: 'a', createdAt: new Date(2024, 0,  1).getTime() }),  // Jan 2024
      tx({ id: 'b', createdAt: new Date(2024, 11, 1).getTime() }),  // Dec 2024
      tx({ id: 'c', createdAt: new Date(2024, 5,  1).getTime() }),  // Jun 2024
    ];
    expect(getAvailableMonths(txs)).toEqual(['2024-01', '2024-06', '2024-12']);
  });

  it('returns months sorted ascending (oldest first)', () => {
    const txs = [
      tx({ createdAt: new Date(2025, 2, 10).getTime() }), // Mar 2025
      tx({ createdAt: new Date(2023, 0,  5).getTime() }), // Jan 2023
      tx({ createdAt: new Date(2024, 6, 20).getTime() }), // Jul 2024
    ];
    const result = getAvailableMonths(txs);
    expect(result).toEqual(['2023-01', '2024-07', '2025-03']);
    // Verify ascending order
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i] < result[i + 1]).toBe(true);
    }
  });

  it('deduplicates months — multiple transactions in the same month yield one entry', () => {
    const txs = [
      tx({ id: 'a', createdAt: new Date(2024, 3,  1).getTime() }), // Apr 2024
      tx({ id: 'b', createdAt: new Date(2024, 3, 15).getTime() }), // Apr 2024
      tx({ id: 'c', createdAt: new Date(2024, 3, 30).getTime() }), // Apr 2024
    ];
    expect(getAvailableMonths(txs)).toEqual(['2024-04']);
  });

  it('handles transactions spanning multiple years', () => {
    const txs = [
      tx({ id: 'a', createdAt: new Date(2022, 11, 31).getTime() }), // Dec 2022
      tx({ id: 'b', createdAt: new Date(2023,  0,  1).getTime() }), // Jan 2023
    ];
    expect(getAvailableMonths(txs)).toEqual(['2022-12', '2023-01']);
  });

  it('zero-pads single-digit months (e.g. January → 01)', () => {
    const result = getAvailableMonths([
      tx({ createdAt: new Date(2024, 0, 10).getTime() }) // January 2024
    ]);
    expect(result[0]).toMatch(/^\d{4}-0\d$/);
    expect(result).toEqual(['2024-01']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — summarize()
// ─────────────────────────────────────────────────────────────────────────────

describe('summarize() — empty / no-match cases', () => {
  it('returns { total: 0, byCategory: {} } for an empty transaction array', () => {
    expect(summarize([], '2024-01')).toEqual({ total: 0, byCategory: {} });
  });

  it('returns { total: 0, byCategory: {} } for null transactions', () => {
    expect(summarize(null, '2024-01')).toEqual({ total: 0, byCategory: {} });
  });

  it('returns { total: 0, byCategory: {} } when no transactions fall in the given month', () => {
    const txs = [
      tx({ id: 'a', amount: 20, category: 'Food',      createdAt: new Date(2024, 0, 10).getTime() }), // Jan
      tx({ id: 'b', amount: 15, category: 'Transport', createdAt: new Date(2024, 2, 5).getTime()  }), // Mar
    ];
    expect(summarize(txs, '2024-02')).toEqual({ total: 0, byCategory: {} }); // Feb — no transactions
  });
});

describe('summarize() — single category', () => {
  it('returns correct total and byCategory for one transaction', () => {
    const createdAt = new Date(2024, 10, 5).getTime(); // Nov 2024
    const txs = [tx({ id: 'a', amount: 42.50, category: 'Food', createdAt })];
    const result = summarize(txs, '2024-11');
    expect(result.total).toBeCloseTo(42.50);
    expect(result.byCategory['Food']).toBeCloseTo(42.50);
  });
});

describe('summarize() — multiple categories', () => {
  it('returns correct total and per-category breakdown for transactions in multiple categories', () => {
    const txs = [
      tx({ id: 'a', amount: 10,    category: 'Food',      createdAt: new Date(2024, 5, 1).getTime() }), // Jun
      tx({ id: 'b', amount: 25,    category: 'Transport', createdAt: new Date(2024, 5, 2).getTime() }), // Jun
      tx({ id: 'c', amount: 5.50,  category: 'Fun',       createdAt: new Date(2024, 5, 3).getTime() }), // Jun
    ];
    const result = summarize(txs, '2024-06');
    expect(result.total).toBeCloseTo(40.50);
    expect(result.byCategory['Food']).toBeCloseTo(10);
    expect(result.byCategory['Transport']).toBeCloseTo(25);
    expect(result.byCategory['Fun']).toBeCloseTo(5.50);
  });

  it('only includes transactions in the specified month (excludes other months)', () => {
    const txs = [
      tx({ id: 'in1',  amount: 20, category: 'Food', createdAt: new Date(2024, 7,  1).getTime() }), // Aug (in)
      tx({ id: 'in2',  amount: 30, category: 'Fun',  createdAt: new Date(2024, 7, 31).getTime() }), // Aug (in)
      tx({ id: 'out1', amount: 99, category: 'Food', createdAt: new Date(2024, 6,  1).getTime() }), // Jul (out)
      tx({ id: 'out2', amount: 99, category: 'Food', createdAt: new Date(2024, 8,  1).getTime() }), // Sep (out)
    ];
    const result = summarize(txs, '2024-08');
    expect(result.total).toBeCloseTo(50);
    expect(result.byCategory['Food']).toBeCloseTo(20);
    expect(result.byCategory['Fun']).toBeCloseTo(30);
    expect(result.byCategory['Transport']).toBeUndefined();
  });
});

describe('summarize() — multiple transactions in the same category', () => {
  it('sums amounts for transactions in the same category', () => {
    const txs = [
      tx({ id: 'a', amount: 10, category: 'Food', createdAt: new Date(2024, 0, 1).getTime() }),
      tx({ id: 'b', amount: 15, category: 'Food', createdAt: new Date(2024, 0, 5).getTime() }),
      tx({ id: 'c', amount: 25, category: 'Food', createdAt: new Date(2024, 0, 20).getTime() }),
    ];
    const result = summarize(txs, '2024-01');
    expect(result.total).toBeCloseTo(50);
    expect(result.byCategory['Food']).toBeCloseTo(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property-based test — Property 7: monthly summary totals match filtered transactions
// Feature: expense-budget-visualizer, Property 7: monthly summary totals match filtered transactions
// Validates: Requirements 7.2, 7.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fast-check arbitrary for a single transaction.
 */
const txArbitrary = fc.record({
  id:        fc.string({ minLength: 1, maxLength: 10 }),
  name:      fc.string({ minLength: 1, maxLength: 20 }),
  // Restrict amount to values that round-trip cleanly to avoid float precision surprises.
  amount:    fc.integer({ min: 1, max: 99999999 }).map(n => n / 100),
  category:  fc.oneof(
    fc.constant('Food'),
    fc.constant('Transport'),
    fc.constant('Fun'),
    fc.string({ minLength: 1, maxLength: 20 })
  ),
  // createdAt: 1990-01-01 to 2099-12-31 expressed in ms
  createdAt: fc.integer({
    min: new Date(1990, 0, 1).getTime(),
    max: new Date(2099, 11, 31).getTime()
  })
});

/**
 * Arbitrary that generates 'YYYY-MM' keys in the range 1990-01 to 2099-12.
 */
const monthKeyArbitrary = fc.tuple(
  fc.integer({ min: 1990, max: 2099 }),
  fc.integer({ min: 1,    max: 12 })
).map(([year, month]) => `${year}-${String(month).padStart(2, '0')}`);

describe('Property 7 — monthly summary totals match filtered transactions', () => {
  // Feature: expense-budget-visualizer, Property 7: monthly summary totals match filtered transactions
  // Validates: Requirements 7.2, 7.3

  it('summarize() total equals the sum of amounts of transactions in that month (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 0, maxLength: 30 }),
        monthKeyArbitrary,
        (txs, monthKey) => {
          const [yearStr, monthStr] = monthKey.split('-');
          const targetYear  = parseInt(yearStr, 10);
          const targetMonth = parseInt(monthStr, 10);

          // Reference: manually filter and sum
          const matchingAmounts = txs
            .filter(tx => {
              const d = new Date(tx.createdAt);
              return d.getFullYear() === targetYear && d.getMonth() + 1 === targetMonth;
            })
            .map(tx => tx.amount);

          const expectedTotal = matchingAmounts.reduce((sum, a) => sum + a, 0);

          const result = summarize(txs, monthKey);

          // The total must equal the sum of matching transactions
          expect(result.total).toBeCloseTo(expectedTotal, 8);
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });

  it('summarize() per-category values sum to the monthly total (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 0, maxLength: 30 }),
        monthKeyArbitrary,
        (txs, monthKey) => {
          const result = summarize(txs, monthKey);

          // Sum of all byCategory values must equal total
          const categorySum = Object.values(result.byCategory)
            .reduce((sum, v) => sum + v, 0);

          expect(categorySum).toBeCloseTo(result.total, 8);
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });

  it('summarize() byCategory contains no entry for categories absent in the given month (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 0, maxLength: 30 }),
        monthKeyArbitrary,
        (txs, monthKey) => {
          const [yearStr, monthStr] = monthKey.split('-');
          const targetYear  = parseInt(yearStr, 10);
          const targetMonth = parseInt(monthStr, 10);

          const inMonthCategories = new Set(
            txs
              .filter(tx => {
                const d = new Date(tx.createdAt);
                return d.getFullYear() === targetYear && d.getMonth() + 1 === targetMonth;
              })
              .map(tx => tx.category)
          );

          const result = summarize(txs, monthKey);

          // Every key in byCategory must have had at least one transaction in the month
          for (const cat of Object.keys(result.byCategory)) {
            expect(inMonthCategories.has(cat)).toBe(true);
          }
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

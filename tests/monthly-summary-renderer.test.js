/**
 * Tests for monthly-summary-renderer.js
 *
 * Covers the pure logic powering UIRenderer.renderMonthlySummary:
 *   - buildMonthlySummaryViewModel: total, per-category breakdown, empty-month fallback
 *
 * Requirements: 7.2, 7.3, 7.4
 *
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildMonthlySummaryViewModel, formatAmount } from '../js/monthly-summary-renderer.js';
import { summarize } from '../js/monthly-aggregator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal transaction object. */
function tx(overrides = {}) {
  return {
    id:        overrides.id        ?? 'id-default',
    name:      overrides.name      ?? 'Item',
    amount:    overrides.amount    ?? 10,
    category:  overrides.category  ?? 'Food',
    createdAt: overrides.createdAt ?? new Date(2024, 10, 1).getTime(), // Nov 2024
    ...overrides
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — formatAmount
// ─────────────────────────────────────────────────────────────────────────────

describe('formatAmount()', () => {
  it('formats a whole number with two decimal places and $ prefix', () => {
    expect(formatAmount(100)).toBe('$100.00');
  });

  it('formats a decimal amount correctly', () => {
    expect(formatAmount(4.5)).toBe('$4.50');
  });

  it('formats zero as $0.00', () => {
    expect(formatAmount(0)).toBe('$0.00');
  });

  it('formats a large amount with thousands separator', () => {
    expect(formatAmount(1234.56)).toBe('$1,234.56');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — buildMonthlySummaryViewModel — empty transactions
// ─────────────────────────────────────────────────────────────────────────────

describe('buildMonthlySummaryViewModel() — empty transactions', () => {
  it('returns $0.00 total and no categories for empty array', () => {
    const vm = buildMonthlySummaryViewModel([], '2024-11', summarize);
    expect(vm.formattedTotal).toBe('$0.00');
    expect(vm.categories).toEqual([]);
    expect(vm.hasCategories).toBe(false);
  });

  it('returns $0.00 total and no categories for null input', () => {
    const vm = buildMonthlySummaryViewModel(null, '2024-11', summarize);
    expect(vm.formattedTotal).toBe('$0.00');
    expect(vm.categories).toEqual([]);
    expect(vm.hasCategories).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — buildMonthlySummaryViewModel — normal month with transactions
// (Requirements 7.2, 7.3)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildMonthlySummaryViewModel() — normal month with transactions (Req 7.2, 7.3)', () => {
  it('returns correct formatted total for a single transaction', () => {
    const txs = [tx({ amount: 42.5, category: 'Food', createdAt: new Date(2024, 10, 5).getTime() })];
    const vm = buildMonthlySummaryViewModel(txs, '2024-11', summarize);
    expect(vm.formattedTotal).toBe('$42.50');
    expect(vm.hasCategories).toBe(true);
    expect(vm.categories).toHaveLength(1);
    expect(vm.categories[0].name).toBe('Food');
    expect(vm.categories[0].formattedAmount).toBe('$42.50');
  });

  it('returns correct per-category breakdown for multiple categories', () => {
    const txs = [
      tx({ id: 'a', amount: 10,   category: 'Food',      createdAt: new Date(2024, 10, 1).getTime() }),
      tx({ id: 'b', amount: 25,   category: 'Transport', createdAt: new Date(2024, 10, 2).getTime() }),
      tx({ id: 'c', amount: 5.50, category: 'Fun',       createdAt: new Date(2024, 10, 3).getTime() }),
    ];
    const vm = buildMonthlySummaryViewModel(txs, '2024-11', summarize);
    expect(vm.formattedTotal).toBe('$40.50');
    expect(vm.hasCategories).toBe(true);
    // Categories are sorted alphabetically
    const names = vm.categories.map(c => c.name);
    expect(names).toEqual(['Food', 'Fun', 'Transport']);
    const catMap = Object.fromEntries(vm.categories.map(c => [c.name, c.formattedAmount]));
    expect(catMap['Food']).toBe('$10.00');
    expect(catMap['Transport']).toBe('$25.00');
    expect(catMap['Fun']).toBe('$5.50');
  });

  it('sums multiple transactions in the same category', () => {
    const txs = [
      tx({ id: 'a', amount: 10, category: 'Food', createdAt: new Date(2024, 10, 1).getTime() }),
      tx({ id: 'b', amount: 15, category: 'Food', createdAt: new Date(2024, 10, 5).getTime() }),
    ];
    const vm = buildMonthlySummaryViewModel(txs, '2024-11', summarize);
    expect(vm.formattedTotal).toBe('$25.00');
    expect(vm.categories).toHaveLength(1);
    expect(vm.categories[0].formattedAmount).toBe('$25.00');
  });

  it('only includes transactions from the selected month', () => {
    const txs = [
      tx({ id: 'in',  amount: 20, category: 'Food', createdAt: new Date(2024, 10, 1).getTime() }), // Nov (in)
      tx({ id: 'out', amount: 99, category: 'Fun',  createdAt: new Date(2024, 9,  1).getTime() }), // Oct (out)
    ];
    const vm = buildMonthlySummaryViewModel(txs, '2024-11', summarize);
    expect(vm.formattedTotal).toBe('$20.00');
    expect(vm.categories).toHaveLength(1);
    expect(vm.categories[0].name).toBe('Food');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — buildMonthlySummaryViewModel — no transactions in selected month
// (Requirement 7.4)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildMonthlySummaryViewModel() — empty selected month (Req 7.4)', () => {
  it('returns $0.00 total when no transactions in the selected month', () => {
    const txs = [
      tx({ id: 'a', amount: 50, category: 'Food',      createdAt: new Date(2024, 9,  1).getTime() }), // Oct
      tx({ id: 'b', amount: 30, category: 'Transport', createdAt: new Date(2024, 11, 1).getTime() }), // Dec
    ];
    // November has no transactions
    const vm = buildMonthlySummaryViewModel(txs, '2024-11', summarize);
    expect(vm.formattedTotal).toBe('$0.00');
  });

  it('shows all categories from other months at $0.00 when selected month is empty', () => {
    const txs = [
      tx({ id: 'a', amount: 50, category: 'Food',      createdAt: new Date(2024, 9,  1).getTime() }), // Oct
      tx({ id: 'b', amount: 30, category: 'Transport', createdAt: new Date(2024, 11, 1).getTime() }), // Dec
    ];
    // November has no transactions — should show Food and Transport at $0.00
    const vm = buildMonthlySummaryViewModel(txs, '2024-11', summarize);
    expect(vm.hasCategories).toBe(true);
    const names = vm.categories.map(c => c.name).sort();
    expect(names).toContain('Food');
    expect(names).toContain('Transport');
    // All amounts should be $0.00
    for (const cat of vm.categories) {
      expect(cat.formattedAmount).toBe('$0.00');
    }
  });

  it('shows categories from multiple other months, deduplicated', () => {
    const txs = [
      tx({ id: 'a', amount: 10, category: 'Food',      createdAt: new Date(2024, 0, 1).getTime() }), // Jan
      tx({ id: 'b', amount: 20, category: 'Food',      createdAt: new Date(2024, 2, 1).getTime() }), // Mar — same category
      tx({ id: 'c', amount: 15, category: 'Fun',       createdAt: new Date(2024, 0, 5).getTime() }), // Jan
    ];
    // February has no transactions — should show Food and Fun each once at $0.00
    const vm = buildMonthlySummaryViewModel(txs, '2024-02', summarize);
    expect(vm.categories).toHaveLength(2);
    const names = vm.categories.map(c => c.name).sort();
    expect(names).toEqual(['Food', 'Fun']);
    for (const cat of vm.categories) {
      expect(cat.formattedAmount).toBe('$0.00');
    }
  });

  it('hasCategories is false when transactions array is empty regardless of month', () => {
    const vm = buildMonthlySummaryViewModel([], '2024-11', summarize);
    expect(vm.hasCategories).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — categories are sorted alphabetically
// ─────────────────────────────────────────────────────────────────────────────

describe('buildMonthlySummaryViewModel() — alphabetical category order', () => {
  it('sorts categories A–Z', () => {
    const txs = [
      tx({ id: 'a', amount: 5, category: 'Zoo',   createdAt: new Date(2024, 10, 1).getTime() }),
      tx({ id: 'b', amount: 5, category: 'Alpha', createdAt: new Date(2024, 10, 1).getTime() }),
      tx({ id: 'c', amount: 5, category: 'Mango', createdAt: new Date(2024, 10, 1).getTime() }),
    ];
    const vm = buildMonthlySummaryViewModel(txs, '2024-11', summarize);
    expect(vm.categories.map(c => c.name)).toEqual(['Alpha', 'Mango', 'Zoo']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property-based tests
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fast-check arbitrary for a single transaction.
 */
const txArbitrary = fc.record({
  id:        fc.string({ minLength: 1, maxLength: 10 }),
  name:      fc.string({ minLength: 1, maxLength: 20 }),
  amount:    fc.integer({ min: 1, max: 99999999 }).map(n => n / 100),
  category:  fc.oneof(
    fc.constant('Food'),
    fc.constant('Transport'),
    fc.constant('Fun'),
    fc.string({ minLength: 1, maxLength: 20 })
  ),
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
  fc.integer({ min: 1, max: 12 })
).map(([year, month]) => `${year}-${String(month).padStart(2, '0')}`);

describe('Property — formattedTotal always starts with "$" and has two decimal places', () => {
  it('formattedTotal is always a valid USD currency string (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 0, maxLength: 20 }),
        monthKeyArbitrary,
        (txs, monthKey) => {
          const vm = buildMonthlySummaryViewModel(txs, monthKey, summarize);
          expect(vm.formattedTotal.startsWith('$')).toBe(true);
          expect(vm.formattedTotal).toMatch(/\.\d{2}$/);
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

describe('Property — each category formattedAmount is a valid USD currency string', () => {
  it('every category amount is a valid USD currency string (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 0, maxLength: 20 }),
        monthKeyArbitrary,
        (txs, monthKey) => {
          const vm = buildMonthlySummaryViewModel(txs, monthKey, summarize);
          for (const cat of vm.categories) {
            expect(cat.formattedAmount.startsWith('$')).toBe(true);
            expect(cat.formattedAmount).toMatch(/\.\d{2}$/);
          }
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

describe('Property — when selected month has transactions, categories match the month only', () => {
  // Feature: expense-budget-visualizer, Property 7: monthly summary totals match filtered transactions
  // Validates: Requirements 7.2, 7.3
  it('category names are exactly those in the selected month when it has transactions (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 1, maxLength: 20 }),
        monthKeyArbitrary,
        (txs, monthKey) => {
          const [yearStr, monthStr] = monthKey.split('-');
          const targetYear  = parseInt(yearStr, 10);
          const targetMonth = parseInt(monthStr, 10);

          const inMonthTxs = txs.filter(t => {
            const d = new Date(t.createdAt);
            return d.getFullYear() === targetYear && d.getMonth() + 1 === targetMonth;
          });

          if (inMonthTxs.length === 0) return; // skip — Req 7.4 handled separately

          const vm = buildMonthlySummaryViewModel(txs, monthKey, summarize);
          const inMonthCategories = new Set(inMonthTxs.map(t => t.category));
          const vmCategories = new Set(vm.categories.map(c => c.name));

          for (const cat of vmCategories) {
            expect(inMonthCategories.has(cat)).toBe(true);
          }
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

describe('Property — when selected month is empty, all other-month categories shown at $0.00 (Req 7.4)', () => {
  it('all categories from other months are shown at $0.00 when selected month is empty (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 1, maxLength: 20 }),
        monthKeyArbitrary,
        (txs, monthKey) => {
          const [yearStr, monthStr] = monthKey.split('-');
          const targetYear  = parseInt(yearStr, 10);
          const targetMonth = parseInt(monthStr, 10);

          const inMonthTxs = txs.filter(t => {
            const d = new Date(t.createdAt);
            return d.getFullYear() === targetYear && d.getMonth() + 1 === targetMonth;
          });

          if (inMonthTxs.length > 0) return; // skip — this property only tests the empty-month case

          const vm = buildMonthlySummaryViewModel(txs, monthKey, summarize);

          // All category amounts should be $0.00
          for (const cat of vm.categories) {
            expect(cat.formattedAmount).toBe('$0.00');
          }

          // Every category from other months should appear in the view-model
          const allCategories = new Set(txs.map(t => t.category));
          const vmCategories = new Set(vm.categories.map(c => c.name));
          for (const cat of allCategories) {
            expect(vmCategories.has(cat)).toBe(true);
          }
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

describe('Property — categories are always sorted alphabetically', () => {
  it('category list is in ascending alphabetical order (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 1, maxLength: 20 }),
        monthKeyArbitrary,
        (txs, monthKey) => {
          const vm = buildMonthlySummaryViewModel(txs, monthKey, summarize);
          const names = vm.categories.map(c => c.name);
          for (let i = 0; i < names.length - 1; i++) {
            expect(names[i] <= names[i + 1]).toBe(true);
          }
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

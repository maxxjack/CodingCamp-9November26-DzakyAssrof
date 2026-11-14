/**
 * Tests for balance-calculator — computeBalance() and formatBalance()
 *
 * Covers:
 *   - Unit tests: specific examples and edge cases for Requirement 3.x
 *   - Property-based test (Property 8): total balance equals sum of all transaction amounts
 *
 * Run with:  npm test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeBalance, formatBalance } from '../js/balance-calculator.js';

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

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — computeBalance()
// ─────────────────────────────────────────────────────────────────────────────

describe('computeBalance() — empty / null / undefined inputs', () => {
  it('returns 0 for an empty array', () => {
    expect(computeBalance([])).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(computeBalance(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(computeBalance(undefined)).toBe(0);
  });

  it('returns 0 for a non-array value', () => {
    expect(computeBalance('not-an-array')).toBe(0);
    expect(computeBalance(42)).toBe(0);
  });
});

describe('computeBalance() — single transaction', () => {
  it('returns the amount for a single transaction', () => {
    expect(computeBalance([tx({ amount: 42.50 })])).toBeCloseTo(42.50);
  });

  it('returns 0 for a transaction with amount 0', () => {
    expect(computeBalance([tx({ amount: 0 })])).toBe(0);
  });
});

describe('computeBalance() — multiple transactions', () => {
  it('sums all transaction amounts', () => {
    const txs = [
      tx({ amount: 10.00 }),
      tx({ amount: 25.50 }),
      tx({ amount: 4.99 })
    ];
    expect(computeBalance(txs)).toBeCloseTo(40.49);
  });

  it('handles integer-only amounts', () => {
    const txs = [tx({ amount: 100 }), tx({ amount: 200 }), tx({ amount: 300 })];
    expect(computeBalance(txs)).toBe(600);
  });

  it('handles a mix of integer and decimal amounts', () => {
    const txs = [tx({ amount: 5 }), tx({ amount: 2.75 }), tx({ amount: 1.25 })];
    expect(computeBalance(txs)).toBeCloseTo(9.00);
  });

  it('handles large amounts near the maximum (999,999,999.99)', () => {
    const txs = [
      tx({ amount: 999999999.99 }),
      tx({ amount: 0.01 })
    ];
    expect(computeBalance(txs)).toBeCloseTo(1000000000.00);
  });
});

describe('computeBalance() — invalid / non-numeric amounts', () => {
  it('skips a transaction with NaN amount', () => {
    const txs = [tx({ amount: NaN }), tx({ amount: 10 })];
    expect(computeBalance(txs)).toBeCloseTo(10);
  });

  it('skips a transaction with Infinity amount', () => {
    const txs = [tx({ amount: Infinity }), tx({ amount: 5 })];
    expect(computeBalance(txs)).toBeCloseTo(5);
  });

  it('skips a transaction with -Infinity amount', () => {
    const txs = [tx({ amount: -Infinity }), tx({ amount: 7 })];
    expect(computeBalance(txs)).toBeCloseTo(7);
  });

  it('coerces a string amount to a number', () => {
    // The design stores amounts as numbers, but coercion should still work
    const txs = [tx({ amount: '12.50' })];
    expect(computeBalance(txs)).toBeCloseTo(12.50);
  });

  it('skips a transaction with a non-numeric string amount', () => {
    const txs = [tx({ amount: 'abc' }), tx({ amount: 20 })];
    expect(computeBalance(txs)).toBeCloseTo(20);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — formatBalance()
// ─────────────────────────────────────────────────────────────────────────────

describe('formatBalance() — formatting', () => {
  it('formats zero as "$0.00"', () => {
    expect(formatBalance(0)).toBe('$0.00');
  });

  it('formats a simple integer as USD currency', () => {
    expect(formatBalance(100)).toBe('$100.00');
  });

  it('formats a decimal value with exactly two decimal places', () => {
    expect(formatBalance(4.5)).toBe('$4.50');
  });

  it('formats a large value with comma thousands separators', () => {
    expect(formatBalance(1234.56)).toBe('$1,234.56');
  });

  it('formats the maximum supported value (999,999,999.99)', () => {
    expect(formatBalance(999999999.99)).toBe('$999,999,999.99');
  });

  it('formats NaN as "$0.00"', () => {
    expect(formatBalance(NaN)).toBe('$0.00');
  });

  it('formats Infinity as "$0.00"', () => {
    expect(formatBalance(Infinity)).toBe('$0.00');
  });

  it('always starts with the "$" currency symbol prefix', () => {
    const result = formatBalance(50);
    expect(result.startsWith('$')).toBe(true);
  });
});

describe('formatBalance() — combined computeBalance + formatBalance', () => {
  it('displays "$0.00" for an empty transaction list', () => {
    expect(formatBalance(computeBalance([]))).toBe('$0.00');
  });

  it('displays "$0.00" for null input', () => {
    expect(formatBalance(computeBalance(null))).toBe('$0.00');
  });

  it('displays the correct formatted total for a list of transactions', () => {
    const txs = [
      tx({ amount: 10.00 }),
      tx({ amount: 20.00 }),
      tx({ amount: 5.50 })
    ];
    expect(formatBalance(computeBalance(txs))).toBe('$35.50');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property-based test — Property 8: total balance equals sum of all transaction amounts
// Feature: expense-budget-visualizer, Property 8: total balance equals sum of all transaction amounts
// Validates: Requirements 3.1, 3.2, 3.3, 3.4
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fast-check arbitrary for a single transaction with a valid finite amount.
 * Uses integer arithmetic scaled to two decimal places to avoid floating-point
 * accumulation surprises when comparing totals.
 */
const txArbitrary = fc.record({
  id:        fc.string({ minLength: 1, maxLength: 10 }),
  name:      fc.string({ minLength: 1, maxLength: 20 }),
  // Store as integer cents (1–99999999) then divide to get a 2-decimal amount.
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
 * Arbitrary that also generates transactions with invalid amounts
 * (NaN, Infinity, strings) to test robustness.
 */
const txWithInvalidAmountArbitrary = fc.record({
  id:        fc.string({ minLength: 1, maxLength: 10 }),
  name:      fc.string({ minLength: 1, maxLength: 20 }),
  amount:    fc.oneof(
    fc.constant(NaN),
    fc.constant(Infinity),
    fc.constant(-Infinity),
    fc.constant('abc')
  ),
  category:  fc.constant('Food'),
  createdAt: fc.constant(Date.now())
});

describe('Property 8 — total balance equals sum of all transaction amounts', () => {
  // Feature: expense-budget-visualizer, Property 8: total balance equals sum of all transaction amounts
  // Validates: Requirements 3.1, 3.2, 3.3, 3.4

  it('computeBalance() equals the arithmetic sum of all transaction amounts (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 0, maxLength: 30 }),
        (txs) => {
          // Reference: direct arithmetic sum
          const expectedTotal = txs.reduce((sum, t) => sum + t.amount, 0);
          const result = computeBalance(txs);
          expect(result).toBeCloseTo(expectedTotal, 8);
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });

  it('formatBalance(computeBalance()) always starts with "$" and has exactly two decimal places (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 0, maxLength: 30 }),
        (txs) => {
          const formatted = formatBalance(computeBalance(txs));

          // Must start with the currency symbol
          expect(formatted.startsWith('$')).toBe(true);

          // Must have exactly two decimal places after the decimal point
          const decimalPart = formatted.split('.')[1];
          expect(decimalPart).toBeDefined();
          expect(decimalPart.length).toBe(2);
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });

  it('computeBalance() returns 0 for an empty array (≥100 iterations — varies array length)', () => {
    // Specifically test that zero transactions always yields 0
    expect(computeBalance([])).toBe(0);
    expect(formatBalance(0)).toBe('$0.00');
  });

  it('invalid amounts are excluded and do not break the total (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        // Mix valid and invalid transactions
        fc.array(txArbitrary, { minLength: 1, maxLength: 20 }),
        fc.array(txWithInvalidAmountArbitrary, { minLength: 0, maxLength: 10 }),
        (validTxs, invalidTxs) => {
          const mixed = [...validTxs, ...invalidTxs];
          const expectedTotal = validTxs.reduce((sum, t) => sum + t.amount, 0);
          const result = computeBalance(mixed);
          expect(result).toBeCloseTo(expectedTotal, 8);
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

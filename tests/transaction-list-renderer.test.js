/**
 * Tests for transaction-list-renderer.js
 *
 * Covers the pure logic powering UIRenderer.renderTransactionList:
 *   - formatAmount: currency formatting
 *   - buildTransactionRow: single-row data descriptor
 *   - buildTransactionListViewModel: full view-model (empty state + sorted rows)
 *
 * Requirements: 2.1, 2.2, 2.3
 *
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  formatAmount,
  buildTransactionRow,
  buildTransactionListViewModel
} from '../js/transaction-list-renderer.js';

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
    createdAt: overrides.createdAt ?? 1000,
    ...overrides
  };
}

/**
 * No-op sort: returns transactions in the same order they were given.
 * Used to test renderTransactionListViewModel without introducing a sort
 * dependency.
 */
const identitySort = (txs, _criterion) => [...txs];

/**
 * Sort by amount ascending (simple reference implementation).
 */
const sortByAmountAsc = (txs, _criterion) =>
  [...txs].sort((a, b) => a.amount - b.amount);

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

  it('formats a large amount with thousands separator', () => {
    expect(formatAmount(1234567.89)).toBe('$1,234,567.89');
  });

  it('formats zero as $0.00', () => {
    expect(formatAmount(0)).toBe('$0.00');
  });

  it('rounds to two decimal places', () => {
    // 1.005 rounds to 1.01 in standard rounding
    expect(formatAmount(1.004)).toBe('$1.00');
    expect(formatAmount(1.006)).toBe('$1.01');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — buildTransactionRow
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTransactionRow()', () => {
  it('returns id, name, formattedAmount, and category', () => {
    const row = buildTransactionRow(tx({ id: 'abc', name: 'Coffee', amount: 4.5, category: 'Food' }));
    expect(row).toEqual({
      id:              'abc',
      name:            'Coffee',
      formattedAmount: '$4.50',
      category:        'Food'
    });
  });

  it('formats amount using Intl.NumberFormat (USD, 2 decimals)', () => {
    const row = buildTransactionRow(tx({ amount: 999.9 }));
    expect(row.formattedAmount).toBe('$999.90');
  });

  it('coerces id and category to strings', () => {
    const row = buildTransactionRow(tx({ id: 42, category: 123 }));
    expect(typeof row.id).toBe('string');
    expect(typeof row.category).toBe('string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — buildTransactionListViewModel — Requirement 2.3
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTransactionListViewModel() — empty state (Requirement 2.3)', () => {
  it('returns { empty: true } for an empty array', () => {
    const vm = buildTransactionListViewModel([], null, identitySort);
    expect(vm).toEqual({ empty: true });
  });

  it('returns { empty: true } for null input', () => {
    const vm = buildTransactionListViewModel(null, null, identitySort);
    expect(vm).toEqual({ empty: true });
  });

  it('returns { empty: true } for undefined input', () => {
    const vm = buildTransactionListViewModel(undefined, null, identitySort);
    expect(vm).toEqual({ empty: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — buildTransactionListViewModel — Requirement 2.1
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTransactionListViewModel() — populated list (Requirement 2.1)', () => {
  it('returns { empty: false, rows } when transactions exist', () => {
    const txs = [tx({ id: 'a' })];
    const vm = buildTransactionListViewModel(txs, null, identitySort);
    expect(vm.empty).toBe(false);
    expect(vm.rows).toHaveLength(1);
  });

  it('each row contains id, name, formattedAmount, and category', () => {
    const txs = [tx({ id: 'x', name: 'Lunch', amount: 12.5, category: 'Food' })];
    const vm = buildTransactionListViewModel(txs, null, identitySort);
    expect(vm.rows[0]).toEqual({
      id:              'x',
      name:            'Lunch',
      formattedAmount: '$12.50',
      category:        'Food'
    });
  });

  it('includes every transaction in rows', () => {
    const txs = [
      tx({ id: 'a', name: 'Coffee' }),
      tx({ id: 'b', name: 'Bus' }),
      tx({ id: 'c', name: 'Movie' })
    ];
    const vm = buildTransactionListViewModel(txs, null, identitySort);
    expect(vm.rows.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — sorting via sortFn injection
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTransactionListViewModel() — sort order', () => {
  it('passes sortCriterion to the sortFn and uses its returned order', () => {
    const txs = [
      tx({ id: 'high', amount: 50 }),
      tx({ id: 'low',  amount: 10 }),
      tx({ id: 'mid',  amount: 30 })
    ];
    // sortByAmountAsc ignores the criterion parameter but sorts by amount
    const vm = buildTransactionListViewModel(txs, 'amount-asc', sortByAmountAsc);
    expect(vm.rows.map(r => r.id)).toEqual(['low', 'mid', 'high']);
  });

  it('receives the criterion argument passed to the view-model builder', () => {
    const capturedCriteria = [];
    const capturingSortFn = (txs, criterion) => {
      capturedCriteria.push(criterion);
      return [...txs];
    };
    buildTransactionListViewModel([tx()], 'category-asc', capturingSortFn);
    expect(capturedCriteria).toEqual(['category-asc']);
  });

  it('works with null sort criterion (insertion order)', () => {
    const txs = [
      tx({ id: 'first',  createdAt: 1 }),
      tx({ id: 'second', createdAt: 2 })
    ];
    const vm = buildTransactionListViewModel(txs, null, identitySort);
    expect(vm.rows.map(r => r.id)).toEqual(['first', 'second']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — Requirement 2.2 (scrollable container is CSS-driven)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTransactionListViewModel() — all transactions included (Requirement 2.2)', () => {
  it('includes all 50 transactions without truncation', () => {
    const txs = Array.from({ length: 50 }, (_, i) =>
      tx({ id: `tx-${i}`, name: `Item ${i}`, amount: i + 1 })
    );
    const vm = buildTransactionListViewModel(txs, null, identitySort);
    expect(vm.empty).toBe(false);
    expect(vm.rows).toHaveLength(50);
  });

  it('none of the rows are omitted for large lists', () => {
    const txs = Array.from({ length: 100 }, (_, i) => tx({ id: `id-${i}` }));
    const vm = buildTransactionListViewModel(txs, null, identitySort);
    const ids = vm.rows.map(r => r.id);
    for (let i = 0; i < 100; i++) {
      expect(ids).toContain(`id-${i}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property-based tests
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fast-check arbitrary for a valid transaction.
 */
const txArbitrary = fc.record({
  id:        fc.string({ minLength: 1, maxLength: 20 }),
  name:      fc.string({ minLength: 1, maxLength: 100 }),
  amount:    fc.double({ min: 0.01, max: 999999999.99, noNaN: true }),
  category:  fc.oneof(
    fc.constant('Food'),
    fc.constant('Transport'),
    fc.constant('Fun'),
    fc.string({ minLength: 1, maxLength: 50 })
  ),
  createdAt: fc.integer({ min: 0, max: 2_000_000_000 })
});

describe('Property — formatAmount always produces valid USD currency strings', () => {
  it('always starts with "$" and has exactly two decimal places (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 999999999.99, noNaN: true }),
        (amount) => {
          const result = formatAmount(amount);
          // Must start with $
          expect(result.startsWith('$')).toBe(true);
          // Must end with two decimal digits
          expect(result).toMatch(/\.\d{2}$/);
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

describe('Property — buildTransactionListViewModel: empty iff input is empty', () => {
  it('empty: true iff no transactions (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 0, maxLength: 30 }),
        (txs) => {
          const vm = buildTransactionListViewModel(txs, null, identitySort);
          if (txs.length === 0) {
            expect(vm.empty).toBe(true);
          } else {
            expect(vm.empty).toBe(false);
            expect(vm.rows).toHaveLength(txs.length);
          }
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

describe('Property — buildTransactionListViewModel: rows contain all transaction ids', () => {
  it('no transactions are added or dropped (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 1, maxLength: 30 }),
        (txs) => {
          const vm = buildTransactionListViewModel(txs, null, identitySort);
          expect(vm.empty).toBe(false);
          const originalIds = txs.map(t => t.id).sort();
          const rowIds      = vm.rows.map(r => r.id).sort();
          expect(rowIds).toEqual(originalIds);
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

describe('Property — buildTransactionListViewModel: formattedAmount is a valid currency string', () => {
  it('every row formattedAmount starts with "$" and has two decimal places (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 1, maxLength: 20 }),
        (txs) => {
          const vm = buildTransactionListViewModel(txs, null, identitySort);
          for (const row of vm.rows) {
            expect(row.formattedAmount.startsWith('$')).toBe(true);
            expect(row.formattedAmount).toMatch(/\.\d{2}$/);
          }
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

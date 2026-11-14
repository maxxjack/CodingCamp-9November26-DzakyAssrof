/**
 * Tests for SortEngine — sort() and insertSorted()
 *
 * Covers:
 *   - Unit tests: specific examples and edge cases
 *   - Property-based test (Property 5): sorted list maintains all transactions
 *
 * Run with:  npm test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sort, insertSorted } from '../js/sort-engine.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal transaction object.
 * @param {Partial<{id:string, name:string, amount:number, category:string, createdAt:number}>} overrides
 */
function tx(overrides = {}) {
  return {
    id: overrides.id ?? 'id-default',
    name: overrides.name ?? 'Item',
    amount: overrides.amount ?? 10,
    category: overrides.category ?? 'Food',
    createdAt: overrides.createdAt ?? 1000,
    ...overrides
  };
}

/** Convenience shorthand for three transactions at different amounts / categories. */
function threeDistinct() {
  return [
    tx({ id: 'a', amount: 30, category: 'Zoo',   createdAt: 1 }),
    tx({ id: 'b', amount: 10, category: 'Apple', createdAt: 2 }),
    tx({ id: 'c', amount: 20, category: 'Mango', createdAt: 3 })
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — sort()
// ─────────────────────────────────────────────────────────────────────────────

describe('sort() — amount-asc', () => {
  it('orders transactions by amount ascending', () => {
    const result = sort(threeDistinct(), 'amount-asc');
    expect(result.map(t => t.id)).toEqual(['b', 'c', 'a']); // 10, 20, 30
  });

  it('breaks ties by createdAt ascending', () => {
    const txs = [
      tx({ id: 'x', amount: 50, createdAt: 200 }),
      tx({ id: 'y', amount: 50, createdAt: 100 })
    ];
    const result = sort(txs, 'amount-asc');
    expect(result.map(t => t.id)).toEqual(['y', 'x']); // earlier createdAt first
  });

  it('does not mutate the original array', () => {
    const original = threeDistinct();
    const originalIds = original.map(t => t.id);
    sort(original, 'amount-asc');
    expect(original.map(t => t.id)).toEqual(originalIds);
  });

  it('returns a new array reference', () => {
    const original = threeDistinct();
    const result = sort(original, 'amount-asc');
    expect(result).not.toBe(original);
  });
});

describe('sort() — amount-desc', () => {
  it('orders transactions by amount descending', () => {
    const result = sort(threeDistinct(), 'amount-desc');
    expect(result.map(t => t.id)).toEqual(['a', 'c', 'b']); // 30, 20, 10
  });

  it('breaks ties by createdAt ascending', () => {
    const txs = [
      tx({ id: 'x', amount: 50, createdAt: 200 }),
      tx({ id: 'y', amount: 50, createdAt: 100 })
    ];
    const result = sort(txs, 'amount-desc');
    expect(result.map(t => t.id)).toEqual(['y', 'x']);
  });
});

describe('sort() — category-asc', () => {
  it('orders transactions by category alphabetically (A–Z)', () => {
    const result = sort(threeDistinct(), 'category-asc');
    expect(result.map(t => t.id)).toEqual(['b', 'c', 'a']); // Apple, Mango, Zoo
  });

  it('is case-insensitive', () => {
    const txs = [
      tx({ id: 'lower', category: 'zebra',  createdAt: 1 }),
      tx({ id: 'upper', category: 'Apple',  createdAt: 2 }),
      tx({ id: 'mixed', category: 'mango',  createdAt: 3 })
    ];
    const result = sort(txs, 'category-asc');
    expect(result.map(t => t.id)).toEqual(['upper', 'mixed', 'lower']); // apple, mango, zebra
  });

  it('breaks ties by createdAt ascending', () => {
    const txs = [
      tx({ id: 'x', category: 'Food', createdAt: 200 }),
      tx({ id: 'y', category: 'food', createdAt: 100 }) // same category, case-insensitive
    ];
    const result = sort(txs, 'category-asc');
    expect(result.map(t => t.id)).toEqual(['y', 'x']);
  });
});

describe('sort() — null criterion', () => {
  it('returns copy in createdAt ascending order', () => {
    const txs = [
      tx({ id: 'c', createdAt: 300 }),
      tx({ id: 'a', createdAt: 100 }),
      tx({ id: 'b', createdAt: 200 })
    ];
    const result = sort(txs, null);
    expect(result.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the original', () => {
    const original = threeDistinct();
    const snap = original.map(t => t.id);
    sort(original, null);
    expect(original.map(t => t.id)).toEqual(snap);
  });
});

describe('sort() — edge cases', () => {
  it('returns an empty array when given an empty array', () => {
    expect(sort([], 'amount-asc')).toEqual([]);
  });

  it('returns a single-element array unchanged', () => {
    const single = [tx({ id: 'only' })];
    expect(sort(single, 'amount-desc').map(t => t.id)).toEqual(['only']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — insertSorted()
// ─────────────────────────────────────────────────────────────────────────────

describe('insertSorted() — null criterion', () => {
  it('appends the new transaction at the end', () => {
    const existing = [tx({ id: 'a', createdAt: 1 }), tx({ id: 'b', createdAt: 2 })];
    const newTx = tx({ id: 'c', createdAt: 3 });
    const result = insertSorted(existing, newTx, null);
    expect(result.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('appends to an empty list', () => {
    const result = insertSorted([], tx({ id: 'x' }), null);
    expect(result.map(t => t.id)).toEqual(['x']);
  });

  it('does not mutate the original array', () => {
    const original = [tx({ id: 'a' })];
    insertSorted(original, tx({ id: 'b' }), null);
    expect(original.length).toBe(1);
  });
});

describe('insertSorted() — amount-asc', () => {
  it('inserts at the front when new tx has the smallest amount', () => {
    const existing = [tx({ id: 'b', amount: 20 }), tx({ id: 'c', amount: 30 })];
    const result = insertSorted(existing, tx({ id: 'a', amount: 5 }), 'amount-asc');
    expect(result.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('inserts in the middle', () => {
    const existing = [tx({ id: 'a', amount: 10 }), tx({ id: 'c', amount: 30 })];
    const result = insertSorted(existing, tx({ id: 'b', amount: 20 }), 'amount-asc');
    expect(result.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('appends when new tx has the largest amount', () => {
    const existing = [tx({ id: 'a', amount: 10 }), tx({ id: 'b', amount: 20 })];
    const result = insertSorted(existing, tx({ id: 'c', amount: 99 }), 'amount-asc');
    expect(result.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('places tie after earlier createdAt (spec 8.3: more-recent after earlier)', () => {
    // existing tx has createdAt=100; new tx has createdAt=200 → newTx goes after
    const existing = [tx({ id: 'old', amount: 50, createdAt: 100 })];
    const newTx = tx({ id: 'new', amount: 50, createdAt: 200 });
    const result = insertSorted(existing, newTx, 'amount-asc');
    expect(result.map(t => t.id)).toEqual(['old', 'new']);
  });
});

describe('insertSorted() — amount-desc', () => {
  it('inserts at the front when new tx has the largest amount', () => {
    const existing = [tx({ id: 'b', amount: 20 }), tx({ id: 'c', amount: 10 })];
    const result = insertSorted(existing, tx({ id: 'a', amount: 99 }), 'amount-desc');
    expect(result.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('appends when new tx has the smallest amount', () => {
    const existing = [tx({ id: 'a', amount: 30 }), tx({ id: 'b', amount: 20 })];
    const result = insertSorted(existing, tx({ id: 'c', amount: 1 }), 'amount-desc');
    expect(result.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('insertSorted() — category-asc', () => {
  it('inserts at the front for the alphabetically-first category', () => {
    const existing = [
      tx({ id: 'b', category: 'Mango', createdAt: 1 }),
      tx({ id: 'c', category: 'Zoo',   createdAt: 2 })
    ];
    const result = insertSorted(existing, tx({ id: 'a', category: 'Apple', createdAt: 3 }), 'category-asc');
    expect(result.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('places tie after the existing tx with same category (earlier createdAt first)', () => {
    const existing = [tx({ id: 'old', category: 'Food', createdAt: 100 })];
    const newTx = tx({ id: 'new', category: 'Food', createdAt: 200 });
    const result = insertSorted(existing, newTx, 'category-asc');
    expect(result.map(t => t.id)).toEqual(['old', 'new']);
  });
});

describe('insertSorted() — returns a new array reference', () => {
  it('never mutates the original list', () => {
    const original = [tx({ id: 'a', amount: 10 })];
    const result = insertSorted(original, tx({ id: 'b', amount: 5 }), 'amount-asc');
    expect(original.length).toBe(1);
    expect(result.length).toBe(2);
    expect(result).not.toBe(original);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property-based test — Property 5: sorted list maintains all transactions
// Feature: expense-budget-visualizer, Property 5: sorted list maintains all transactions
// Validates: Requirements 8.1, 8.2, 8.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fast-check arbitrary for a single transaction.
 * Uses a small pool of ids so duplicates are rare (they'd be a valid input anyway).
 */
const txArbitrary = fc.record({
  id:        fc.string({ minLength: 1, maxLength: 10 }),
  name:      fc.string({ minLength: 1, maxLength: 20 }),
  amount:    fc.double({ min: 0.01, max: 999999999.99, noNaN: true }),
  category:  fc.oneof(
    fc.constant('Food'),
    fc.constant('Transport'),
    fc.constant('Fun'),
    fc.string({ minLength: 1, maxLength: 20 })
  ),
  createdAt: fc.integer({ min: 0, max: 1_000_000_000 })
});

/** All valid criterion values, including null. */
const criterionArbitrary = fc.oneof(
  fc.constant('amount-asc'),
  fc.constant('amount-desc'),
  fc.constant('category-asc'),
  fc.constant(null)
);

describe('Property 5 — sorted list maintains all transactions', () => {
  // Feature: expense-budget-visualizer, Property 5: sorted list maintains all transactions

  it('sort() contains exactly the same transaction ids as the input (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 0, maxLength: 20 }),
        criterionArbitrary,
        (txs, criterion) => {
          const result = sort(txs, criterion);

          // Same length
          expect(result.length).toBe(txs.length);

          // Same set of ids
          const originalIds = txs.map(t => t.id).sort();
          const resultIds   = result.map(t => t.id).sort();
          expect(resultIds).toEqual(originalIds);
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });

  it('sort() ties are always broken by createdAt ascending (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 2, maxLength: 20 }),
        fc.oneof(
          fc.constant('amount-asc'),
          fc.constant('amount-desc'),
          fc.constant('category-asc'),
          fc.constant(null)
        ),
        (txs, criterion) => {
          const result = sort(txs, criterion);

          // For each adjacent pair, verify that if the primary keys are equal
          // the one with the smaller createdAt comes first.
          for (let i = 0; i < result.length - 1; i++) {
            const a = result[i];
            const b = result[i + 1];

            let primaryTied = false;
            if (criterion === 'amount-asc' || criterion === 'amount-desc') {
              primaryTied = a.amount === b.amount;
            } else if (criterion === 'category-asc') {
              primaryTied =
                String(a.category).toLowerCase() === String(b.category).toLowerCase();
            } else {
              // null — only tie-break column matters
              primaryTied = true;
            }

            if (primaryTied) {
              expect(a.createdAt).toBeLessThanOrEqual(b.createdAt);
            }
          }
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });

  it('sort() does not mutate the original array (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 0, maxLength: 20 }),
        criterionArbitrary,
        (txs, criterion) => {
          const snapshot = txs.map(t => ({ ...t }));
          sort(txs, criterion);
          // Original objects are unchanged
          txs.forEach((t, i) => {
            expect(t).toEqual(snapshot[i]);
          });
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });

  it('insertSorted() result contains all original ids plus the new one (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 0, maxLength: 20 }),
        txArbitrary,
        criterionArbitrary,
        (txs, newTx, criterion) => {
          const result = insertSorted(txs, newTx, criterion);

          // Length grows by 1
          expect(result.length).toBe(txs.length + 1);

          // All original ids still present
          const originalIds = new Set(txs.map(t => t.id));
          originalIds.forEach(id => {
            expect(result.some(t => t.id === id)).toBe(true);
          });

          // New transaction is present
          expect(result.some(t => t.id === newTx.id)).toBe(true);
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });

  it('insertSorted(null) always appends at the end (≥100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.array(txArbitrary, { minLength: 0, maxLength: 20 }),
        txArbitrary,
        (txs, newTx) => {
          const result = insertSorted(txs, newTx, null);
          expect(result[result.length - 1].id).toBe(newTx.id);
        }
      ),
      { numRuns: 100, seed: 42 }
    );
  });
});

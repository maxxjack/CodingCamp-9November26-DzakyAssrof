/**
 * Tests for chart aggregation logic.
 *
 * The pure `aggregateByCategory` function is extracted into
 * `js/chart-aggregator.js` so it can be tested without a DOM or Chart.js.
 *
 * Covers:
 *   - Unit tests: specific examples and edge cases
 *   - Property-based test (Property 6): pie chart segments reflect category totals
 *
 * Run with:  npm test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { aggregateByCategory } from '../js/chart-aggregator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal transaction object.
 * @param {Partial<{id:string, name:string, amount:number, category:string, createdAt:number}>} overrides
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — aggregateByCategory()
// ─────────────────────────────────────────────────────────────────────────────

describe('aggregateByCategory() — basic aggregation', () => {
  it('sums amounts for a single category', () => {
    const result = aggregateByCategory([
      tx({ category: 'Food', amount: 10 }),
      tx({ category: 'Food', amount: 15 })
    ]);
    expect(result).toEqual({ Food: 25 });
  });

  it('handles multiple distinct categories', () => {
    const result = aggregateByCategory([
      tx({ category: 'Food',      amount: 20 }),
      tx({ category: 'Transport', amount: 10 }),
      tx({ category: 'Fun',       amount: 30 })
    ]);
    expect(result).toEqual({ Food: 20, Transport: 10, Fun: 30 });
  });

  it('mixes categories with multiple entries each', () => {
    const result = aggregateByCategory([
      tx({ category: 'Food',      amount: 5  }),
      tx({ category: 'Transport', amount: 10 }),
      tx({ category: 'Food',      amount: 15 }),
      tx({ category: 'Transport', amount: 10 })
    ]);
    expect(result).toEqual({ Food: 20, Transport: 20 });
  });

  it('preserves the original category string as the key', () => {
    const result = aggregateByCategory([
      tx({ category: 'My Custom', amount: 7.5 })
    ]);
    expect(Object.keys(result)).toEqual(['My Custom']);
  });
});

describe('aggregateByCategory() — edge cases: empty / falsy inputs', () => {
  it('returns {} for an empty array', () => {
    expect(aggregateByCategory([])).toEqual({});
  });

  it('returns {} for null', () => {
    expect(aggregateByCategory(null)).toEqual({});
  });

  it('returns {} for undefined', () => {
    expect(aggregateByCategory(undefined)).toEqual({});
  });

  it('returns {} for a non-array value', () => {
    expect(aggregateByCategory('not-an-array')).toEqual({});
    expect(aggregateByCategory(42)).toEqual({});
  });
});

describe('aggregateByCategory() — filtering non-positive amounts', () => {
  it('skips transactions with amount = 0', () => {
    const result = aggregateByCategory([
      tx({ category: 'Food', amount: 0 }),
      tx({ category: 'Food', amount: 10 })
    ]);
    expect(result).toEqual({ Food: 10 });
  });

  it('skips transactions with negative amount', () => {
    const result = aggregateByCategory([
      tx({ category: 'Food', amount: -5 }),
      tx({ category: 'Food', amount: 20 })
    ]);
    expect(result).toEqual({ Food: 20 });
  });

  it('returns {} when every transaction has a non-positive amount', () => {
    expect(
      aggregateByCategory([
        tx({ category: 'Food', amount: 0   }),
        tx({ category: 'Fun',  amount: -1  })
      ])
    ).toEqual({});
  });

  it('skips NaN amounts', () => {
    const result = aggregateByCategory([
      tx({ category: 'Food', amount: NaN }),
      tx({ category: 'Food', amount: 5   })
    ]);
    expect(result).toEqual({ Food: 5 });
  });

  it('skips Infinity amounts', () => {
    const result = aggregateByCategory([
      tx({ category: 'Food', amount: Infinity }),
      tx({ category: 'Food', amount: 5         })
    ]);
    expect(result).toEqual({ Food: 5 });
  });
});

describe('aggregateByCategory() — floating-point amounts', () => {
  it('sums decimal amounts correctly', () => {
    const result = aggregateByCategory([
      tx({ category: 'Food', amount: 1.50 }),
      tx({ category: 'Food', amount: 2.25 })
    ]);
    // Use toBeCloseTo to guard against floating-point drift
    expect(result.Food).toBeCloseTo(3.75, 10);
  });

  it('handles amounts at the boundary (999999999.99)', () => {
    const result = aggregateByCategory([
      tx({ category: 'Food', amount: 999999999.99 })
    ]);
    expect(result.Food).toBeCloseTo(999999999.99, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property-based test — Property 6: pie chart segments reflect category totals
// Feature: expense-budget-visualizer, Property 6: pie chart segments reflect category totals
// Validates: Requirements 4.1, 4.2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fast-check arbitrary for a single transaction with a positive amount
 * (the only kind that should appear in the pie chart).
 */
const positiveTxArbitrary = fc.record({
  id:        fc.string({ minLength: 1, maxLength: 10 }),
  name:      fc.string({ minLength: 1, maxLength: 20 }),
  // Positive amounts only; limit range to avoid floating-point precision issues
  amount:    fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
  category:  fc.oneof(
    fc.constant('Food'),
    fc.constant('Transport'),
    fc.constant('Fun'),
    fc.string({ minLength: 1, maxLength: 20 })
  ),
  createdAt: fc.integer({ min: 0, max: 1_000_000_000 })
});

describe('Property 6 — pie chart segments reflect category totals', () => {
  // Feature: expense-budget-visualizer, Property 6: pie chart segments reflect category totals

  it(
    'aggregateByCategory labels equal the set of categories present in transactions (≥100 iterations)',
    () => {
      fc.assert(
        fc.property(
          fc.array(positiveTxArbitrary, { minLength: 1, maxLength: 20 }),
          (txs) => {
            const result = aggregateByCategory(txs);

            // Every category in the result must appear in the input
            const inputCategories = new Set(txs.map(t => t.category));
            for (const cat of Object.keys(result)) {
              expect(inputCategories.has(cat)).toBe(true);
            }

            // Every category in the input (with positive amount) must appear in result
            for (const t of txs) {
              if (t.amount > 0) {
                expect(Object.prototype.hasOwnProperty.call(result, t.category)).toBe(true);
              }
            }
          }
        ),
        { numRuns: 200, seed: 42 }
      );
    }
  );

  it(
    'each category value equals the sum of amounts for that category (≥100 iterations)',
    () => {
      fc.assert(
        fc.property(
          fc.array(positiveTxArbitrary, { minLength: 1, maxLength: 20 }),
          (txs) => {
            const result = aggregateByCategory(txs);

            // For each category in the result, manually sum the matching amounts
            for (const [cat, total] of Object.entries(result)) {
              const expected = txs
                .filter(t => t.category === cat && t.amount > 0)
                .reduce((sum, t) => sum + t.amount, 0);

              expect(total).toBeCloseTo(expected, 5);
            }
          }
        ),
        { numRuns: 200, seed: 42 }
      );
    }
  );

  it(
    'sum of all category values equals total of all positive transaction amounts (≥100 iterations)',
    () => {
      fc.assert(
        fc.property(
          fc.array(positiveTxArbitrary, { minLength: 1, maxLength: 20 }),
          (txs) => {
            const result = aggregateByCategory(txs);

            const chartTotal = Object.values(result).reduce((s, v) => s + v, 0);
            const txTotal    = txs.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0);

            expect(chartTotal).toBeCloseTo(txTotal, 5);
          }
        ),
        { numRuns: 200, seed: 42 }
      );
    }
  );

  it(
    'returns {} for a list where all amounts are non-positive (≥100 iterations)',
    () => {
      fc.assert(
        fc.property(
          // Generate transactions whose amounts are ≤ 0
          fc.array(
            fc.record({
              id:        fc.string({ minLength: 1, maxLength: 5 }),
              name:      fc.constant('item'),
              amount:    fc.double({ min: -10_000, max: 0, noNaN: true }),
              category:  fc.constant('Food'),
              createdAt: fc.integer({ min: 0, max: 1_000_000 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (txs) => {
            expect(aggregateByCategory(txs)).toEqual({});
          }
        ),
        { numRuns: 100, seed: 42 }
      );
    }
  );
});

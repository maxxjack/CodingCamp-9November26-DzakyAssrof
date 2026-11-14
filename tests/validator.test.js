/**
 * Tests for Validator.validateTransaction (task 3.1)
 *
 * Covers:
 *   - Unit tests: specific examples and edge cases
 *   - Property-based test (Property 4): transaction amount validation
 *
 * Run with:  npm test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateTransaction, validateCategory } from '../js/validator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a valid base form-data object; callers override individual fields. */
function validBase(overrides = {}) {
  return {
    name: 'Coffee',
    amount: '4.50',
    category: 'Food',
    ...overrides
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — name field
// ─────────────────────────────────────────────────────────────────────────────

describe('validateTransaction — name', () => {
  it('accepts a normal name', () => {
    expect(validateTransaction(validBase())).toEqual({ valid: true });
  });

  it('rejects an empty name', () => {
    const result = validateTransaction(validBase({ name: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeTruthy();
  });

  it('rejects a whitespace-only name', () => {
    const result = validateTransaction(validBase({ name: '   ' }));
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeTruthy();
  });

  it('accepts a name of exactly 100 characters', () => {
    const name = 'a'.repeat(100);
    expect(validateTransaction(validBase({ name }))).toEqual({ valid: true });
  });

  it('rejects a name of 101 characters', () => {
    const name = 'a'.repeat(101);
    const result = validateTransaction(validBase({ name }));
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — amount field
// ─────────────────────────────────────────────────────────────────────────────

describe('validateTransaction — amount', () => {
  it('accepts a valid integer amount', () => {
    expect(validateTransaction(validBase({ amount: '100' }))).toEqual({ valid: true });
  });

  it('accepts a valid two-decimal amount', () => {
    expect(validateTransaction(validBase({ amount: '12.99' }))).toEqual({ valid: true });
  });

  it('accepts the minimum valid amount (0.01)', () => {
    expect(validateTransaction(validBase({ amount: '0.01' }))).toEqual({ valid: true });
  });

  it('accepts the maximum valid amount (999999999.99)', () => {
    expect(validateTransaction(validBase({ amount: '999999999.99' }))).toEqual({ valid: true });
  });

  it('accepts amount with one decimal place', () => {
    expect(validateTransaction(validBase({ amount: '5.5' }))).toEqual({ valid: true });
  });

  it('rejects an empty amount', () => {
    const result = validateTransaction(validBase({ amount: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeTruthy();
  });

  it('rejects amount of zero', () => {
    const result = validateTransaction(validBase({ amount: '0' }));
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeTruthy();
  });

  it('rejects a negative amount', () => {
    const result = validateTransaction(validBase({ amount: '-5' }));
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeTruthy();
  });

  it('rejects an amount exceeding the maximum (1000000000)', () => {
    const result = validateTransaction(validBase({ amount: '1000000000' }));
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeTruthy();
  });

  it('rejects an amount with 3 decimal places', () => {
    const result = validateTransaction(validBase({ amount: '1.234' }));
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeTruthy();
  });

  it('rejects a non-numeric string', () => {
    const result = validateTransaction(validBase({ amount: 'abc' }));
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeTruthy();
  });

  it('rejects scientific notation (1e2)', () => {
    const result = validateTransaction(validBase({ amount: '1e2' }));
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeTruthy();
  });

  it('rejects scientific notation (1.5E-3)', () => {
    const result = validateTransaction(validBase({ amount: '1.5E-3' }));
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeTruthy();
  });

  it('rejects Infinity', () => {
    const result = validateTransaction(validBase({ amount: 'Infinity' }));
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeTruthy();
  });

  it('rejects NaN string', () => {
    const result = validateTransaction(validBase({ amount: 'NaN' }));
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — category field
// ─────────────────────────────────────────────────────────────────────────────

describe('validateTransaction — category', () => {
  it('accepts a valid category', () => {
    expect(validateTransaction(validBase({ category: 'Transport' }))).toEqual({ valid: true });
  });

  it('rejects an empty category', () => {
    const result = validateTransaction(validBase({ category: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.category).toBeTruthy();
  });

  it('rejects a whitespace-only category', () => {
    const result = validateTransaction(validBase({ category: '   ' }));
    expect(result.valid).toBe(false);
    expect(result.errors.category).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — multiple field failures
// ─────────────────────────────────────────────────────────────────────────────

describe('validateTransaction — multiple failures', () => {
  it('reports errors for all invalid fields simultaneously', () => {
    const result = validateTransaction({ name: '', amount: '-1', category: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeTruthy();
    expect(result.errors.amount).toBeTruthy();
    expect(result.errors.category).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property-based test — Property 4: transaction amount validation
// Feature: expense-budget-visualizer, Property 4: transaction amount validation
// Validates: Requirements 1.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether a plain-string amount is valid according to the spec rules:
 *   - Not empty
 *   - No scientific notation
 *   - Parses to a finite, non-NaN number
 *   - > 0
 *   - ≤ 999,999,999.99
 *   - At most 2 decimal places
 *
 * This is the reference oracle used by the property test.
 *
 * @param {string} raw
 * @returns {boolean}
 */
function isValidAmount(raw) {
  const s = String(raw).trim();
  if (s.length === 0) return false;
  if (/e/i.test(s)) return false;
  const n = Number(s);
  if (!isFinite(n) || isNaN(n)) return false;
  if (n <= 0) return false;
  if (n > 999999999.99) return false;
  const dot = s.indexOf('.');
  if (dot !== -1 && s.length - dot - 1 > 2) return false;
  return true;
}

describe('Property 4 — transaction amount validation', () => {
  // Feature: expense-budget-visualizer, Property 4: transaction amount validation

  it('accepts a valid amount iff it satisfies all spec rules (≥100 iterations)', () => {
    // We test across a wide variety of strings, including:
    //   - small positives, two-decimal values, boundary values
    //   - zero, negatives, over-limit values
    //   - strings with 3+ decimals
    //   - scientific notation, non-numeric strings, empty strings
    fc.assert(
      fc.property(
        fc.oneof(
          // Valid-looking amounts: positive doubles with 0–2 decimal places
          fc.double({ min: 0.01, max: 999999999.99, noNaN: true }).map(n =>
            n.toFixed(Math.floor(Math.random() * 3))
          ),
          // Boundary: exact max
          fc.constant('999999999.99'),
          // Boundary: exact min
          fc.constant('0.01'),
          // Invalid: zero
          fc.constant('0'),
          fc.constant('0.00'),
          // Invalid: negative
          fc.double({ min: -1e9, max: -0.001, noNaN: true }).map(n => String(n)),
          // Invalid: over max
          fc.double({ min: 1000000000, max: 1e12, noNaN: true }).map(n => n.toFixed(2)),
          // Invalid: 3 decimal places
          fc.double({ min: 0.001, max: 1000, noNaN: true }).map(n => n.toFixed(3)),
          // Invalid: scientific notation
          fc.double({ min: 1, max: 1e6, noNaN: true }).map(n => n.toExponential(2)),
          // Invalid: non-numeric / special strings
          fc.oneof(
            fc.constant(''),
            fc.constant('abc'),
            fc.constant('NaN'),
            fc.constant('Infinity'),
            fc.constant('-Infinity'),
            fc.constant('1,000'),
            fc.constant('$5.00'),
            fc.string({ maxLength: 20 })
          )
        ),
        (amountStr) => {
          const expected = isValidAmount(amountStr);
          const result = validateTransaction(validBase({ amount: amountStr }));

          if (expected) {
            // A valid amount must yield overall valid: true (name and category are always valid)
            expect(result.valid).toBe(true);
            expect(result.errors?.amount).toBeUndefined();
          } else {
            // An invalid amount must produce an error on the amount field
            expect(result.valid).toBe(false);
            expect(result.errors?.amount).toBeTruthy();
          }
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — validateCategory
// ─────────────────────────────────────────────────────────────────────────────

describe('validateCategory — unit tests', () => {
  it('accepts a valid unique category name', () => {
    expect(validateCategory('Groceries', ['Food', 'Transport', 'Fun'])).toEqual({ valid: true });
  });

  it('rejects an empty string', () => {
    const result = validateCategory('', []);
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBe('Category name cannot be empty.');
  });

  it('rejects a whitespace-only string', () => {
    const result = validateCategory('   ', []);
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBe('Category name cannot be empty.');
  });

  it('rejects a name longer than 50 characters', () => {
    const result = validateCategory('a'.repeat(51), []);
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBe('Category name must be 50 characters or fewer.');
  });

  it('accepts a name of exactly 50 characters', () => {
    expect(validateCategory('a'.repeat(50), [])).toEqual({ valid: true });
  });

  it('rejects a duplicate name (exact match)', () => {
    const result = validateCategory('Food', ['Food', 'Transport']);
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBe('Category name already exists.');
  });

  it('rejects a duplicate name (case-insensitive)', () => {
    const result = validateCategory('FOOD', ['Food', 'Transport']);
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBe('Category name already exists.');
  });

  it('rejects a duplicate name (mixed case)', () => {
    const result = validateCategory('fOoD', ['Food']);
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBe('Category name already exists.');
  });

  it('rejects when existingCategories already has 20 entries', () => {
    const existing = Array.from({ length: 20 }, (_, i) => `Cat${i}`);
    const result = validateCategory('NewCat', existing);
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBe('Maximum number of custom categories (20) has been reached.');
  });

  it('accepts when existingCategories has exactly 19 entries', () => {
    const existing = Array.from({ length: 19 }, (_, i) => `Cat${i}`);
    expect(validateCategory('NewCat', existing)).toEqual({ valid: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property-based test — Property 2: category validation rejects duplicates and invalid names
// Feature: expense-budget-visualizer, Property 2: category validation rejects duplicates and invalid names
// Validates: Requirements 6.2, 6.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reference oracle: returns true iff `name` should be accepted given the existing list.
 * Mirrors the spec rules exactly.
 *
 * @param {string}   name
 * @param {string[]} existing  — custom categories already saved (< 20 means limit not reached)
 * @returns {boolean}
 */
function isValidCategory(name, existing) {
  const trimmed = String(name ?? '').trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 50) return false;
  const lower = trimmed.toLowerCase();
  if (existing.some(cat => String(cat).toLowerCase() === lower)) return false;
  if (existing.length >= 20) return false;
  return true;
}

describe('Property 2 — category validation rejects duplicates and invalid names', () => {
  // Feature: expense-budget-visualizer, Property 2: category validation rejects duplicates and invalid names

  it('accepts iff name satisfies all spec rules (≥100 iterations)', () => {
    // Arbitrary category name strings paired with an arbitrary existing-categories list
    const validCategoryName = fc.string({ minLength: 1, maxLength: 50 }).filter(
      s => s.trim().length > 0
    );

    fc.assert(
      fc.property(
        // Generate a wide variety of candidate names (valid-ish and invalid)
        fc.oneof(
          // Valid-looking names
          fc.string({ minLength: 1, maxLength: 50 }),
          // Edge: exactly 50 chars
          fc.constant('a'.repeat(50)),
          // Edge: exactly 51 chars (too long)
          fc.constant('a'.repeat(51)),
          // Empty / whitespace
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\t'),
          // Longer strings
          fc.string({ minLength: 51, maxLength: 100 }),
          // Arbitrary unicode
          fc.fullUnicodeString({ minLength: 1, maxLength: 60 })
        ),
        // Generate existing category lists with 0–21 entries (to test the limit boundary)
        fc.array(validCategoryName, { minLength: 0, maxLength: 21 }),
        (name, existing) => {
          const expected = isValidCategory(name, existing);
          const result = validateCategory(name, existing);

          if (expected) {
            expect(result.valid).toBe(true);
            expect(result.errors).toBeUndefined();
          } else {
            expect(result.valid).toBe(false);
            expect(result.errors?.name).toBeTruthy();
          }
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

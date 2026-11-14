/**
 * Tests for category-dropdown-renderer.js
 *
 * Covers the pure logic powering UIRenderer.renderCategoryDropdown:
 *   - buildCategoryOptions: merges DEFAULT_CATEGORIES with custom categories
 *
 * Requirements: 1.2, 6.4, 6.6
 *
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildCategoryOptions, DEFAULT_CATEGORIES } from '../js/category-dropdown-renderer.js';

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — DEFAULT_CATEGORIES constant
// ─────────────────────────────────────────────────────────────────────────────

describe('DEFAULT_CATEGORIES', () => {
  it('contains exactly Food, Transport, and Fun (Requirement 1.2)', () => {
    expect(DEFAULT_CATEGORIES).toEqual(['Food', 'Transport', 'Fun']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — buildCategoryOptions (Requirement 1.2, 6.4, 6.6)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildCategoryOptions() — default categories always present (Requirement 1.2)', () => {
  it('returns Food, Transport, Fun when no custom categories are given', () => {
    expect(buildCategoryOptions([])).toEqual(['Food', 'Transport', 'Fun']);
  });

  it('returns defaults when customCategories is null', () => {
    expect(buildCategoryOptions(null)).toEqual(['Food', 'Transport', 'Fun']);
  });

  it('returns defaults when customCategories is undefined', () => {
    expect(buildCategoryOptions(undefined)).toEqual(['Food', 'Transport', 'Fun']);
  });

  it('defaults always appear before custom categories', () => {
    const result = buildCategoryOptions(['Gym']);
    expect(result.indexOf('Food')).toBeLessThan(result.indexOf('Gym'));
    expect(result.indexOf('Transport')).toBeLessThan(result.indexOf('Gym'));
    expect(result.indexOf('Fun')).toBeLessThan(result.indexOf('Gym'));
  });
});

describe('buildCategoryOptions() — custom categories appended (Requirement 6.4)', () => {
  it('appends a single custom category after the defaults', () => {
    expect(buildCategoryOptions(['Gym'])).toEqual(['Food', 'Transport', 'Fun', 'Gym']);
  });

  it('appends multiple custom categories in their original order', () => {
    expect(buildCategoryOptions(['Gym', 'Health', 'Books']))
      .toEqual(['Food', 'Transport', 'Fun', 'Gym', 'Health', 'Books']);
  });

  it('total list length equals 3 defaults + number of valid custom categories', () => {
    const custom = ['A', 'B', 'C'];
    expect(buildCategoryOptions(custom)).toHaveLength(3 + custom.length);
  });
});

describe('buildCategoryOptions() — invalid entries silently filtered (Requirement 6.6)', () => {
  it('filters out entries that are not strings', () => {
    const result = buildCategoryOptions([42, null, true, 'ValidCat']);
    expect(result).toEqual(['Food', 'Transport', 'Fun', 'ValidCat']);
  });

  it('filters out empty strings', () => {
    const result = buildCategoryOptions(['', 'ValidCat']);
    expect(result).toEqual(['Food', 'Transport', 'Fun', 'ValidCat']);
  });

  it('filters out whitespace-only strings', () => {
    const result = buildCategoryOptions(['   ', '\t', 'ValidCat']);
    expect(result).toEqual(['Food', 'Transport', 'Fun', 'ValidCat']);
  });

  it('filters out strings exceeding 50 characters', () => {
    const tooLong = 'A'.repeat(51);
    const result = buildCategoryOptions([tooLong, 'ValidCat']);
    expect(result).toEqual(['Food', 'Transport', 'Fun', 'ValidCat']);
  });

  it('accepts a string of exactly 50 characters', () => {
    const exactly50 = 'A'.repeat(50);
    const result = buildCategoryOptions([exactly50]);
    expect(result).toContain(exactly50);
  });

  it('filters out all invalid entries, returning only defaults when all are invalid', () => {
    const result = buildCategoryOptions([null, '', '   ', 'B'.repeat(51)]);
    expect(result).toEqual(['Food', 'Transport', 'Fun']);
  });
});

describe('buildCategoryOptions() — does not mutate input (immutability)', () => {
  it('returns a new array each call', () => {
    const a = buildCategoryOptions([]);
    const b = buildCategoryOptions([]);
    expect(a).not.toBe(b);
  });

  it('does not mutate the customCategories argument', () => {
    const custom = ['Gym'];
    const copy = [...custom];
    buildCategoryOptions(custom);
    expect(custom).toEqual(copy);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property-based tests
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arbitrary for a valid custom category name: 1–50 non-empty string.
 */
const validCategoryArb = fc.string({ minLength: 1, maxLength: 50 }).filter(
  s => s.trim().length > 0
);

describe('Property — defaults are always the first three entries (≥100 iterations)', () => {
  // Feature: expense-budget-visualizer, Property: renderCategoryDropdown defaults always first
  it('Food, Transport, Fun appear as the first three items regardless of custom categories', () => {
    fc.assert(
      fc.property(
        fc.array(validCategoryArb, { minLength: 0, maxLength: 20 }),
        (custom) => {
          const result = buildCategoryOptions(custom);
          expect(result[0]).toBe('Food');
          expect(result[1]).toBe('Transport');
          expect(result[2]).toBe('Fun');
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

describe('Property — valid custom categories all appear in the result (≥100 iterations)', () => {
  // Feature: expense-budget-visualizer, Property: all valid custom categories included
  it('no valid custom category is dropped', () => {
    fc.assert(
      fc.property(
        fc.array(validCategoryArb, { minLength: 0, maxLength: 20 }),
        (custom) => {
          const result = buildCategoryOptions(custom);
          for (const cat of custom) {
            expect(result).toContain(cat);
          }
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

describe('Property — result length equals 3 + valid custom count (≥100 iterations)', () => {
  // Feature: expense-budget-visualizer, Property: result length is correct
  it('total options = defaults + valid custom categories', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            validCategoryArb,
            fc.constant(''),
            fc.constant(null),
            fc.constant('X'.repeat(51))
          ),
          { minLength: 0, maxLength: 25 }
        ),
        (mixed) => {
          const validCount = mixed.filter(
            c => typeof c === 'string' && c.trim().length > 0 && c.length <= 50
          ).length;
          const result = buildCategoryOptions(mixed);
          expect(result).toHaveLength(3 + validCount);
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

describe('Property — custom categories always come after defaults (≥100 iterations)', () => {
  // Feature: expense-budget-visualizer, Property: order preserved — defaults before custom
  it('every custom category index is greater than every default index', () => {
    fc.assert(
      fc.property(
        fc.array(validCategoryArb, { minLength: 1, maxLength: 20 }),
        (custom) => {
          const result = buildCategoryOptions(custom);
          const maxDefaultIdx = Math.max(
            result.indexOf('Food'),
            result.indexOf('Transport'),
            result.indexOf('Fun')
          );
          for (const cat of custom) {
            const idx = result.indexOf(cat);
            if (idx !== -1) {
              expect(idx).toBeGreaterThan(maxDefaultIdx);
            }
          }
        }
      ),
      { numRuns: 200, seed: 42 }
    );
  });
});

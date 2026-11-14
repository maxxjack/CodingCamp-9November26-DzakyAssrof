/**
 * validator.js — Pure validation functions for the Expense & Budget Visualizer.
 *
 * Exported as an ES module so they can be imported by both app.js (via dynamic
 * import or by inlining the same logic) and by unit / property-based test files.
 *
 * No DOM, no side effects, no globals.
 */

'use strict';

/**
 * Maximum number of decimal places allowed for an amount.
 * @type {number}
 */
const MAX_DECIMAL_PLACES = 2;

/**
 * Maximum allowed amount value (inclusive).
 * @type {number}
 */
const MAX_AMOUNT = 999999999.99;

/**
 * Validates a transaction form submission.
 *
 * Rules:
 *   - name  : non-empty after trimming, ≤ 100 characters
 *   - amount: parseable as a finite number, > 0, ≤ 999,999,999.99, ≤ 2 decimal places;
 *             scientific notation strings are rejected
 *   - category: non-empty string
 *
 * @param {{ name: string, amount: string, category: string }} formData
 * @returns {{ valid: true } | { valid: false, errors: { name?: string, amount?: string, category?: string } }}
 */
export function validateTransaction(formData) {
  const errors = {};

  // ── name ──────────────────────────────────────────────────────────────────
  const trimmedName = String(formData.name ?? '').trim();
  if (trimmedName.length === 0) {
    errors.name = 'Item name is required.';
  } else if (trimmedName.length > 100) {
    errors.name = 'Item name must be 100 characters or fewer.';
  }

  // ── amount ────────────────────────────────────────────────────────────────
  const rawAmount = String(formData.amount ?? '').trim();
  if (rawAmount.length === 0) {
    errors.amount = 'Amount is required.';
  } else if (/e/i.test(rawAmount)) {
    // Reject scientific notation outright (e.g. "1e2", "1.5E-3")
    errors.amount = 'Amount must be a plain decimal number.';
  } else {
    const parsed = Number(rawAmount);
    if (!isFinite(parsed) || isNaN(parsed)) {
      errors.amount = 'Amount must be a valid number.';
    } else if (parsed <= 0) {
      errors.amount = 'Amount must be greater than 0.';
    } else if (parsed > MAX_AMOUNT) {
      errors.amount = `Amount must not exceed ${MAX_AMOUNT.toLocaleString('en-US')}.`;
    } else {
      const dotIndex = rawAmount.indexOf('.');
      if (dotIndex !== -1) {
        const decimals = rawAmount.length - dotIndex - 1;
        if (decimals > MAX_DECIMAL_PLACES) {
          errors.amount = 'Amount must have at most 2 decimal places.';
        }
      }
    }
  }

  // ── category ──────────────────────────────────────────────────────────────
  const categoryVal = String(formData.category ?? '').trim();
  if (categoryVal.length === 0) {
    errors.category = 'Please select a category.';
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}

/**
 * Validates a custom category name.
 *
 * Rules:
 *   - 1–50 characters (after trimming)
 *   - Case-insensitive uniqueness against existingCategories
 *   - existingCategories (custom categories only) must have fewer than 20 entries
 *
 * @param {string}   name               — the candidate name
 * @param {string[]} existingCategories — custom categories already saved (NOT including defaults)
 * @returns {{ valid: true } | { valid: false, errors: { name: string } }}
 */
export function validateCategory(name, existingCategories) {
  const trimmed = String(name ?? '').trim();

  if (trimmed.length === 0) {
    return { valid: false, errors: { name: 'Category name cannot be empty.' } };
  }
  if (trimmed.length > 50) {
    return { valid: false, errors: { name: 'Category name must be 50 characters or fewer.' } };
  }

  const lower = trimmed.toLowerCase();
  const isDuplicate = Array.isArray(existingCategories) && existingCategories.some(
    cat => String(cat).toLowerCase() === lower
  );
  if (isDuplicate) {
    return { valid: false, errors: { name: 'Category name already exists.' } };
  }

  if (Array.isArray(existingCategories) && existingCategories.length >= 20) {
    return {
      valid: false,
      errors: { name: 'Maximum number of custom categories (20) has been reached.' }
    };
  }

  return { valid: true };
}

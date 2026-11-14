/**
 * category-dropdown-renderer.js — Pure helper for the category dropdown renderer.
 *
 * Exported as an ES module so it can be imported by both app.js and test files.
 *
 * No DOM, no side effects, no globals.
 */

'use strict';

/**
 * Default categories always present in the dropdown and cannot be deleted.
 * @type {string[]}
 */
export const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

/**
 * Builds the ordered list of category option values to populate the dropdown.
 *
 * The final list is always DEFAULT_CATEGORIES followed by any valid custom
 * categories.  Invalid entries in `customCategories` (not a string, empty after
 * trim, or exceeds 50 characters) are silently filtered out — this mirrors the
 * sanitisation already applied by StorageModule, but defends against direct
 * callers too.
 *
 * Requirements: 1.2, 6.4, 6.6
 *
 * @param {string[]} customCategories  — custom categories from state (already sanitised by StorageModule)
 * @returns {string[]}  ordered list: DEFAULT_CATEGORIES first, then valid custom categories
 */
export function buildCategoryOptions(customCategories) {
  const custom = Array.isArray(customCategories)
    ? customCategories.filter(
        c => typeof c === 'string' && c.trim().length > 0 && c.length <= 50
      )
    : [];

  return [...DEFAULT_CATEGORIES, ...custom];
}

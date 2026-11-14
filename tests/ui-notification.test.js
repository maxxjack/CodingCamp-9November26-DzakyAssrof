/**
 * Tests for ui-notification.js
 *
 * Covers UIRenderer.showInlineError, UIRenderer.clearInlineErrors,
 * and UIRenderer.showToast (Requirements 1.4, 2.4, 5.5, 5.6, 6.3, 9.5).
 *
 * Uses jsdom (via vitest's built-in environment) to exercise real DOM mutations
 * without a browser.
 *
 * Run with: npm test
 */

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showInlineError, clearInlineErrors, showToast } from '../js/ui-notification.js';

// ─────────────────────────────────────────────────────────────────────────────
// DOM fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal document fragment that mirrors the structure of index.html
 * for the fields we care about, plus a toast container.
 *
 * Returns the document (the global jsdom document, mutated by each helper).
 */
function setupDom() {
  document.body.innerHTML = `
    <form id="transaction-form">
      <input id="item-name" type="text" />
      <span id="error-item-name" class="inline-error"></span>

      <input id="amount" type="number" />
      <span id="error-amount" class="inline-error"></span>

      <select id="category">
        <option value="">— Select —</option>
        <option value="Food">Food</option>
      </select>
      <span id="error-category" class="inline-error"></span>
    </form>

    <form id="add-category-form">
      <input id="custom-category" type="text" />
      <span id="error-custom-category" class="inline-error"></span>
    </form>

    <div id="toast-container"></div>
  `;
  return document;
}

// ─────────────────────────────────────────────────────────────────────────────
// showInlineError — Requirement 1.4, 6.3
// ─────────────────────────────────────────────────────────────────────────────

describe('showInlineError()', () => {
  beforeEach(() => {
    setupDom();
  });

  it('sets text content of the error span for the given field', () => {
    showInlineError('item-name', 'Item name is required.', document);
    const span = document.getElementById('error-item-name');
    expect(span.textContent).toBe('Item name is required.');
  });

  it('sets aria-invalid="true" on the associated field', () => {
    showInlineError('amount', 'Amount must be greater than 0.', document);
    const input = document.getElementById('amount');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('adds the is-invalid CSS class to the associated field', () => {
    showInlineError('category', 'Please select a category.', document);
    const select = document.getElementById('category');
    expect(select.classList.contains('is-invalid')).toBe(true);
  });

  it('supports multiple fields failing simultaneously (each gets its own message)', () => {
    showInlineError('item-name', 'Name error', document);
    showInlineError('amount',    'Amount error', document);
    showInlineError('category',  'Category error', document);

    expect(document.getElementById('error-item-name').textContent).toBe('Name error');
    expect(document.getElementById('error-amount').textContent).toBe('Amount error');
    expect(document.getElementById('error-category').textContent).toBe('Category error');
  });

  it('overwrites a previously set error message on the same field', () => {
    showInlineError('item-name', 'First message', document);
    showInlineError('item-name', 'Updated message', document);
    expect(document.getElementById('error-item-name').textContent).toBe('Updated message');
  });

  it('works for the custom-category field (Requirement 6.3)', () => {
    showInlineError('custom-category', 'Category name already exists.', document);
    expect(document.getElementById('error-custom-category').textContent).toBe('Category name already exists.');
  });

  it('creates a new error span if one does not already exist for the field', () => {
    // Add a bare input without a pre-existing error span
    document.body.innerHTML += '<input id="new-field" type="text" />';

    showInlineError('new-field', 'New field error', document);

    const created = document.getElementById('error-new-field');
    expect(created).not.toBeNull();
    expect(created.textContent).toBe('New field error');
    expect(created.classList.contains('inline-error')).toBe(true);
    expect(created.getAttribute('role')).toBe('alert');
    expect(created.getAttribute('aria-live')).toBe('assertive');
  });

  it('does nothing when fieldId does not exist in the DOM', () => {
    // Should not throw
    expect(() => showInlineError('nonexistent-field', 'msg', document)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// clearInlineErrors — Requirement 1.4, 6.3
// ─────────────────────────────────────────────────────────────────────────────

describe('clearInlineErrors()', () => {
  beforeEach(() => {
    setupDom();
  });

  it('removes text content from all inline-error spans', () => {
    // Populate errors first
    showInlineError('item-name', 'Name error',     document);
    showInlineError('amount',    'Amount error',   document);
    showInlineError('category',  'Category error', document);

    clearInlineErrors(document);

    expect(document.getElementById('error-item-name').textContent).toBe('');
    expect(document.getElementById('error-amount').textContent).toBe('');
    expect(document.getElementById('error-category').textContent).toBe('');
  });

  it('removes aria-invalid attribute from all previously marked fields', () => {
    showInlineError('item-name', 'Error', document);
    showInlineError('amount',    'Error', document);

    clearInlineErrors(document);

    expect(document.getElementById('item-name').getAttribute('aria-invalid')).toBeNull();
    expect(document.getElementById('amount').getAttribute('aria-invalid')).toBeNull();
  });

  it('removes is-invalid CSS class from all previously marked fields', () => {
    showInlineError('item-name', 'Error', document);
    clearInlineErrors(document);
    expect(document.getElementById('item-name').classList.contains('is-invalid')).toBe(false);
  });

  it('is safe to call when no errors are shown (no-op)', () => {
    expect(() => clearInlineErrors(document)).not.toThrow();
  });

  it('leaves unrelated elements untouched', () => {
    document.body.innerHTML += '<span class="inline-error" id="error-other">Some text</span><input id="other" />';
    // Set an error on item-name only
    showInlineError('item-name', 'Error', document);

    // Manually give "other" some text to verify it also gets cleared (it's .inline-error)
    // clearInlineErrors clears ALL .inline-error spans on the page
    clearInlineErrors(document);

    expect(document.getElementById('error-other').textContent).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// showToast — Requirements 5.5, 5.6, 9.5
// ─────────────────────────────────────────────────────────────────────────────

describe('showToast()', () => {
  beforeEach(() => {
    setupDom();
    vi.useFakeTimers();
  });

  it('appends a toast element to #toast-container', () => {
    showToast('Test message', 'info', document);
    const container = document.getElementById('toast-container');
    expect(container.children.length).toBe(1);
  });

  it('sets the toast text content to the provided message', () => {
    showToast('Saved data could not be loaded.', 'error', document);
    const toast = document.getElementById('toast-container').firstElementChild;
    expect(toast.textContent).toBe('Saved data could not be loaded.');
  });

  it('applies toast--error class for type "error"', () => {
    showToast('Storage full.', 'error', document);
    const toast = document.getElementById('toast-container').firstElementChild;
    expect(toast.classList.contains('toast--error')).toBe(true);
    expect(toast.classList.contains('toast')).toBe(true);
  });

  it('applies toast--info class for type "info"', () => {
    showToast('Information message.', 'info', document);
    const toast = document.getElementById('toast-container').firstElementChild;
    expect(toast.classList.contains('toast--info')).toBe(true);
    expect(toast.classList.contains('toast')).toBe(true);
  });

  it('sets role="status" on an info toast element', () => {
    showToast('Msg', 'info', document);
    const toast = document.getElementById('toast-container').firstElementChild;
    expect(toast.getAttribute('role')).toBe('status');
  });

  it('sets role="alert" on an error toast element', () => {
    showToast('Something went wrong.', 'error', document);
    const toast = document.getElementById('toast-container').firstElementChild;
    expect(toast.getAttribute('role')).toBe('alert');
  });

  it('adds is-hiding class after the dismiss delay', () => {
    showToast('Msg', 'info', document, 1000, 200);
    const toast = document.getElementById('toast-container').firstElementChild;

    // Before dismiss delay: no is-hiding class
    vi.advanceTimersByTime(999);
    expect(toast.classList.contains('is-hiding')).toBe(false);

    // At dismiss delay: is-hiding added
    vi.advanceTimersByTime(1);
    expect(toast.classList.contains('is-hiding')).toBe(true);
  });

  it('removes toast from DOM after dismiss delay + fade duration', () => {
    showToast('Msg', 'info', document, 1000, 200);
    const container = document.getElementById('toast-container');

    vi.advanceTimersByTime(1000 + 200);
    expect(container.children.length).toBe(0);
  });

  it('stacks multiple toasts independently', () => {
    showToast('First',  'info',  document, 1000, 200);
    showToast('Second', 'error', document, 2000, 200);

    const container = document.getElementById('toast-container');
    expect(container.children.length).toBe(2);

    // After first dismiss: one toast remains
    vi.advanceTimersByTime(1000 + 200);
    expect(container.children.length).toBe(1);
    expect(container.firstElementChild.textContent).toBe('Second');

    // After second dismiss: no toasts
    vi.advanceTimersByTime(2000);
    expect(container.children.length).toBe(0);
  });

  it('does nothing when toast-container is absent', () => {
    document.getElementById('toast-container').remove();
    expect(() => showToast('Msg', 'error', document)).not.toThrow();
  });

  it('defaults to toast--info for an unrecognised type', () => {
    showToast('Msg', 'warning', document);
    const toast = document.getElementById('toast-container').firstElementChild;
    expect(toast.classList.contains('toast--info')).toBe(true);
  });
});

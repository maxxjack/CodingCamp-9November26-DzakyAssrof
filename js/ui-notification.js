/**
 * ui-notification.js — Pure-DOM helpers for inline errors and toast notifications.
 *
 * Exported as an ES module so they can be imported by both app.js (inside the IIFE
 * via dynamic import is not needed — the IIFE duplicates these for runtime, but
 * exports here allow unit testing without a full app bootstrap).
 *
 * All functions accept an optional `doc` parameter (defaults to `document`) so
 * tests can pass in a lightweight jsdom Document without touching globals.
 */

'use strict';

/**
 * Displays an inline error message adjacent to the form field identified by
 * `fieldId`.  Error spans in the HTML follow the convention `error-${fieldId}`
 * (e.g. fieldId "item-name" → span id "error-item-name").
 *
 * If the named span already exists its text content is updated.  Otherwise a
 * new <span> is created with class `inline-error` and injected immediately
 * after the input element.
 *
 * Also sets `aria-invalid="true"` and adds the `is-invalid` CSS class on the
 * associated input so screen readers and styles can respond.
 *
 * @param {string}   fieldId  — the `id` of the input/select element
 * @param {string}   message  — the error text to display
 * @param {Document} [doc]    — DOM document (defaults to `document`)
 */
export function showInlineError(fieldId, message, doc = document) {
  const errorId = `error-${fieldId}`;
  let errorEl = doc.getElementById(errorId);

  if (!errorEl) {
    const field = doc.getElementById(fieldId);
    if (!field) return;

    errorEl = doc.createElement('span');
    errorEl.id        = errorId;
    errorEl.className = 'inline-error';
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'assertive');
    field.insertAdjacentElement('afterend', errorEl);
  }

  errorEl.textContent = String(message);

  const field = doc.getElementById(fieldId);
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.classList.add('is-invalid');
  }
}

/**
 * Clears all currently visible inline error messages on the page.
 *
 * Finds every element with class `inline-error`, empties its text content, and
 * removes `aria-invalid` / `is-invalid` from the associated input field.
 *
 * @param {Document} [doc]  — DOM document (defaults to `document`)
 */
export function clearInlineErrors(doc = document) {
  const errorEls = doc.querySelectorAll('.inline-error');
  for (const el of errorEls) {
    el.textContent = '';

    // Derive field id: "error-foo" → "foo"
    const fieldId = el.id.replace(/^error-/, '');
    const field   = doc.getElementById(fieldId);
    if (field) {
      field.removeAttribute('aria-invalid');
      field.classList.remove('is-invalid');
    }
  }
}

/**
 * Displays a toast notification in the element with id `toast-container`.
 *
 * - `type` must be `'error'` or `'info'`; maps to CSS modifier classes
 *   `.toast--error` and `.toast--info`.
 * - The toast auto-dismisses after `dismissDelay` ms (default 4000) with a
 *   CSS fade-out animation lasting `fadeDuration` ms (default 200).
 * - Multiple toasts stack independently with their own dismiss timers.
 *
 * @param {string}   message                — the notification text
 * @param {'error'|'info'} type
 * @param {Document} [doc]                  — DOM document (defaults to `document`)
 * @param {number}   [dismissDelay=4000]    — ms before the toast starts fading
 * @param {number}   [fadeDuration=200]     — ms the CSS fade animation takes
 */
export function showToast(message, type, doc = document, dismissDelay = 4000, fadeDuration = 200) {
  const container = doc.getElementById('toast-container');
  if (!container) return;

  const validType = (type === 'error' || type === 'info') ? type : 'info';

  const toast = doc.createElement('div');
  toast.className   = `toast toast--${validType}`;
  toast.textContent = String(message);
  // role="alert" interrupts screen readers immediately (errors);
  // role="status" is polite and waits for a natural pause (info).
  toast.setAttribute('role', validType === 'error' ? 'alert' : 'status');

  container.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('is-hiding');
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, fadeDuration);
  };

  setTimeout(dismiss, dismissDelay);
}

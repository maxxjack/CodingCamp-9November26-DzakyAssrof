# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a fully client-side, single-page expense tracker delivered as three files (`index.html`, `css/styles.css`, `js/app.js`). The app uses Chart.js from CDN for pie chart visualization and the browser's LocalStorage API for persistence. All modules live inside a single IIFE in `app.js`, following the unidirectional data flow pattern described in the design.

## Tasks

- [x] 1. Set up project structure and HTML skeleton
  - Create `index.html` with semantic markup: header (Total Balance display), Input Form section, Transaction List section, Pie Chart canvas + placeholder, Monthly Summary section, and Sort Control
  - Add `<script>` tag pointing to `https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js` with an `onerror` handler that sets a global `chartJsLoadFailed` flag
  - Create `css/styles.css` with baseline layout, responsive flexbox/grid, scrollable transaction list panel, toast notification styles, and inline error message styles
  - Create `js/app.js` as an empty IIFE scaffold with section comments for each module in the design order
  - _Requirements: 9.2, 9.3_

- [x] 2. Implement constants, State module, and StorageModule
  - [x] 2.1 Define DEFAULT_CATEGORIES, SortCriterion type, and in-memory state object; implement `State.getAll()`, `State.addTransaction()`, `State.deleteTransaction()`, `State.addCategory()`, `State.setSortCriterion()`, and `State.load()`
    - Use `crypto.randomUUID()` for transaction IDs and `Date.now()` for `createdAt`
    - _Requirements: 1.2, 6.1_
  - [x] 2.2 Implement `StorageModule.save()` and `StorageModule.load()` with try/catch handling for `QuotaExceededError`, malformed JSON, and empty storage; use key `'ebv_state'`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 3. Implement Validator module
  - [x] 3.1 Implement `Validator.validateTransaction(formData)` enforcing: name non-empty/trimmed/≤100 chars, amount parseable finite number >0 ≤999,999,999.99 with ≤2 decimal places, category non-empty
    - Return `{ valid: true }` or `{ valid: false, errors: { name?, amount?, category? } }`
    - _Requirements: 1.3, 1.4_
  - [x] 3.2 Implement `Validator.validateCategory(name, existingCategories)` enforcing: 1–50 chars, case-insensitive uniqueness, total custom categories ≤20
    - _Requirements: 6.2, 6.3_


- [x] 4. Checkpoint — core data layer
  - Ensure all tests pass for State, StorageModule, and Validator modules before proceeding. Ask the user if any questions arise.

- [x] 5. Implement SortEngine and MonthlyAggregator modules
  - [x] 5.1 Implement `SortEngine.sort(transactions, criterion)` for `'amount-asc'`, `'amount-desc'`, `'category-asc'`, and `null`; use a stable sort that preserves insertion order (`createdAt` ascending) on ties; implement `SortEngine.insertSorted(transactions, newTx, criterion)`
    - Return a new array without mutating the original
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 5.3 Implement `MonthlyAggregator.getAvailableMonths(transactions)` returning sorted `'YYYY-MM'` strings, and `MonthlyAggregator.summarize(transactions, monthKey)` returning `{ total, byCategory }`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 6. Implement ChartModule
  - [x] 6.1 Implement `ChartModule.update(transactions)`: aggregate expense amounts by category, destroy existing Chart.js instance if present, re-create a `'pie'` chart with correct `labels` and `data` arrays; if no transactions exist, hide canvas and show placeholder; if `chartJsLoadFailed` is true, show CDN error message
    - Use `Intl.NumberFormat` for tooltip formatting; tooltip shows category name, total amount, and percentage
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 9.5_
  - [x] 6.2 Implement `ChartModule.destroy()` to clean up the chart instance
    - _Requirements: 4.3_


- [x] 7. Implement UIRenderer module
  - [x] 7.1 Implement `UIRenderer.renderBalance(transactions)` computing and displaying the total balance using `Intl.NumberFormat`; display `$0.00` on empty or invalid data
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 7.3 Implement `UIRenderer.renderTransactionList(transactions, sortCriterion)` displaying name, formatted amount, and category per entry; show "No transactions yet" message when list is empty; implement scrollable container behavior
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 7.4 Implement `UIRenderer.renderCategoryDropdown(categories)` merging DEFAULT_CATEGORIES with custom categories into the form dropdown
    - _Requirements: 1.2, 6.4, 6.6_
  - [x] 7.5 Implement `UIRenderer.renderMonthlySummary(transactions, selectedMonth)` showing total and per-category breakdown; show zero totals when no transactions exist for the selected month
    - _Requirements: 7.2, 7.3, 7.4_
  - [x] 7.6 Implement `UIRenderer.showInlineError(fieldId, message)`, `UIRenderer.clearInlineErrors()`, and `UIRenderer.showToast(message, type)` for `'error'` and `'info'` types
    - _Requirements: 1.4, 2.4, 5.5, 5.6, 6.3, 9.5_
  - [x] 7.7 Implement `UIRenderer.render(state)` calling all sub-renderers in sequence
    - _Requirements: 1.5_

- [x] 8. Checkpoint — rendering layer
  - Ensure all tests pass for SortEngine, MonthlyAggregator, ChartModule, and UIRenderer before proceeding. Ask the user if any questions arise.

- [x] 9. Implement AppController and wire everything together
  - [x] 9.1 Implement `AppController.init()`: attach all DOM event listeners, call `StorageModule.load()` to bootstrap state, call `UIRenderer.render()` with loaded state; default monthly summary to current calendar month
    - _Requirements: 5.3, 5.4, 7.2, 8.5_
  - [x] 9.2 Implement `AppController.handleAddTransaction(event)`: call `Validator.validateTransaction`, show inline errors on failure, mutate state, persist via `StorageModule.save`, handle `QuotaExceededError`, reset form on success, call `UIRenderer.render` and `ChartModule.update`
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 2.6, 3.2, 4.3, 5.1, 5.6_
  - [x] 9.3 Implement `AppController.handleDeleteTransaction(id)`: show confirmation prompt, remove transaction from state, persist, call `UIRenderer.render` and `ChartModule.update`
    - _Requirements: 2.4, 2.5, 2.6, 3.3, 4.3, 5.2_
  - [x] 9.4 Implement `AppController.handleAddCategory(event)`: call `Validator.validateCategory`, show inline error on failure, mutate state, persist via `StorageModule.save`, call `UIRenderer.renderCategoryDropdown`
    - _Requirements: 6.2, 6.3, 6.4, 6.5_
  - [x] 9.5 Implement `AppController.handleSortChange(criterion)`: update state sort criterion, persist, call `UIRenderer.renderTransactionList`
    - _Requirements: 8.1, 8.2, 8.4_
  - [x] 9.6 Implement `AppController.handleMonthChange(monthKey)`: update selected month in UI, call `UIRenderer.renderMonthlySummary`
    - _Requirements: 7.3_
  - [x] 9.7 Add top-level `window.onerror` handler that shows a generic error toast for unhandled exceptions
    - _Requirements: 9.1_

- [x] 10. Apply CSS styling and accessibility
  - [x] 10.1 Style all UI sections in `css/styles.css`: header balance display, input form with inline error placement, scrollable transaction list, pie chart container with placeholder, monthly summary panel, sort control, and toast notification
    - _Requirements: 2.2, 3.1_
  - [x] 10.2 Add ARIA labels, roles, and `aria-live` regions for balance display, inline errors, and toast notifications; ensure keyboard navigation for all interactive controls
    - _Requirements: 9.1_

- [ ] 11. Final checkpoint — integration and cross-browser validation
  - Ensure all tests pass. Manually verify the app loads without console errors in Chrome, Firefox, Edge, and Safari. Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each layer
- Property tests use **fast-check** with a minimum of 100 iterations per test, tagged with `// Feature: expense-budget-visualizer, Property N: <property_text>`
- Unit tests and property tests are complementary — unit tests cover specific examples and edge cases; property tests validate universal invariants
- All monetary display uses `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`
- Chart.js is loaded from CDN; the `onerror` handler on the `<script>` tag gates all chart rendering

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2"] },
    { "id": 1, "tasks": ["3.1", "3.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["3.3", "3.4", "5.1", "5.3"] },
    { "id": 3, "tasks": ["5.2", "5.4", "6.1", "6.2"] },
    { "id": 4, "tasks": ["6.3", "7.1", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 5, "tasks": ["7.2", "7.7"] },
    { "id": 6, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "10.1", "10.2"] }
  ]
}
```

# Design Document

## Overview

The Expense & Budget Visualizer is a fully client-side, single-page web application delivered as three files: `index.html`, `css/styles.css`, and `js/app.js`. It has zero runtime dependencies beyond Chart.js (loaded from a CDN) and the browser's built-in LocalStorage API.

The core design philosophy is **unidirectional data flow**: every user action mutates a single in-memory state object, which then drives a full re-render of the UI (transaction list, total balance, pie chart, and monthly summary). This keeps the application deterministic and easy to reason about without a framework.

The application handles eight functional areas: transaction entry and validation, transaction list display and deletion, total balance tracking, pie chart visualization, LocalStorage persistence, custom categories, monthly summary view, and transaction sorting.

## Architecture

The application follows a **Model-View-Controller (MVC)-inspired** architecture within a single JavaScript file, organized into logical modules via closures and plain objects. There is no build step — the file is loaded directly by the browser.

```
┌─────────────────────────────────────────────────────────────────┐
│                        index.html                               │
│   (structure, CDN <script> for Chart.js, links to css/js)       │
└─────────────────────────────────────────────────────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────┐              ┌──────────────────┐
│  css/styles.css │              │   js/app.js       │
│  (all styling)  │              │                  │
└─────────────────┘              │  ┌─────────────┐ │
                                 │  │   State     │ │
                                 │  │  (in-memory)│ │
                                 │  └──────┬──────┘ │
                                 │         │        │
                        ┌────────┼─────────▼──────┐ │
                        │        │  StorageModule  │ │
                        │        │  (LocalStorage) │ │
                        │        └────────┬────────┘ │
                        │                 │           │
                        │  ┌──────────────▼──────┐   │
                        │  │   AppController     │   │
                        │  │  (event handlers,   │   │
                        │  │   orchestration)    │   │
                        │  └──────────┬──────────┘   │
                        │             │               │
                        │  ┌──────────▼──────────┐   │
                        │  │   UIRenderer        │   │
                        │  │  (DOM updates)      │   │
                        │  └──────────┬──────────┘   │
                        │             │               │
                        │  ┌──────────▼──────────┐   │
                        │  │   ChartModule       │   │
                        │  │  (Chart.js wrapper) │   │
                        └──┴─────────────────────┴───┘
                                   js/app.js
```

### Data Flow

```
User Interaction
      │
      ▼
AppController.handleEvent()
      │
      ├─► Validator.validate()  →  UIRenderer.showErrors()  (on failure)
      │
      ▼ (on success)
State.mutate()
      │
      ├─► StorageModule.persist()
      │
      └─► UIRenderer.render(state)
                │
                └─► ChartModule.update(state)
```

## Components and Interfaces

### State

A single plain object that acts as the source of truth for the entire application.

```javascript
// Internal state shape (not exported)
const state = {
  transactions: [],   // Transaction[]
  categories: [],     // string[]  (default + custom)
  sortCriterion: null // 'amount-asc' | 'amount-desc' | 'category-asc' | null
};
```

**Public interface:**
- `State.getAll()` → returns a deep copy of state
- `State.addTransaction(tx)` → appends and returns new state
- `State.deleteTransaction(id)` → removes by id and returns new state
- `State.addCategory(name)` → appends custom category and returns new state
- `State.setSortCriterion(criterion)` → sets sort and returns new state
- `State.load(snapshot)` → replaces state from a deserialized snapshot

---

### Validator

Pure functions with no side effects. Each returns `{ valid: true }` or `{ valid: false, errors: { fieldName: string } }`.

```javascript
Validator.validateTransaction(formData)
// formData: { name: string, amount: string, category: string }
// Returns: { valid: boolean, errors?: { name?, amount?, category? } }

Validator.validateCategory(name, existingCategories)
// Returns: { valid: boolean, errors?: { name: string } }
```

Validation rules (from requirements):
- `name`: non-empty after trimming, ≤ 100 characters
- `amount`: parseable as a finite number, > 0, ≤ 999,999,999.99, ≤ 2 decimal places
- `category`: non-empty string selected from the dropdown
- `categoryName`: 1–50 characters, case-insensitive uniqueness, total custom ≤ 20

---

### StorageModule

Wraps LocalStorage access with try/catch to handle quota errors and parse failures.

```javascript
StorageModule.save(state)
// Serializes state to JSON and writes to localStorage key 'ebv_state'
// Returns: { ok: true } | { ok: false, error: 'quota_exceeded' | 'unknown' }

StorageModule.load()
// Reads and deserializes state from localStorage
// Returns: { ok: true, data: StateSnapshot } | { ok: false, error: 'empty' | 'corrupted' }
```

Storage key: `'ebv_state'`

The serialized shape mirrors the in-memory state shape, so `JSON.parse(JSON.stringify(state))` is the full round-trip.

---

### AppController

Wires DOM event listeners and orchestrates the data flow. Initialized once on `DOMContentLoaded`.

```javascript
AppController.init()
// Attaches all event listeners, calls StorageModule.load(), bootstraps state, calls UIRenderer.render()

AppController.handleAddTransaction(event)
AppController.handleDeleteTransaction(id)
AppController.handleAddCategory(event)
AppController.handleSortChange(criterion)
AppController.handleMonthChange(monthKey)   // 'YYYY-MM'
```

---

### UIRenderer

Responsible for all DOM mutations. Accepts the full state snapshot and rebuilds relevant sections.

```javascript
UIRenderer.render(state)
// Calls all sub-renderers in sequence

UIRenderer.renderBalance(transactions)
UIRenderer.renderTransactionList(transactions, sortCriterion)
UIRenderer.renderCategoryDropdown(categories)
UIRenderer.renderMonthlySummary(transactions, selectedMonth)
UIRenderer.showInlineError(fieldId, message)
UIRenderer.clearInlineErrors()
UIRenderer.showToast(message, type)   // type: 'error' | 'info'
```

---

### ChartModule

Wraps Chart.js lifecycle. Maintains a reference to the current `Chart` instance and destroys it before re-creating to avoid the "canvas already in use" error (Chart.js v4 requirement).

```javascript
ChartModule.update(transactions)
// Aggregates expense amounts by category from transactions
// Destroys existing chart instance if present
// Re-creates chart with new data
// If no expense transactions exist, hides canvas and shows placeholder message

ChartModule.destroy()
// Cleans up the chart instance
```

---

### SortEngine

Pure functions for sorting and inserting transactions.

```javascript
SortEngine.sort(transactions, criterion)
// Returns a new sorted array; stable sort preserving insertion order on ties

SortEngine.insertSorted(transactions, newTx, criterion)
// Returns a new array with newTx in the correct sorted position
```

---

### MonthlyAggregator

Pure functions for grouping transactions by month.

```javascript
MonthlyAggregator.getAvailableMonths(transactions)
// Returns sorted array of 'YYYY-MM' strings

MonthlyAggregator.summarize(transactions, monthKey)
// Returns: { total: number, byCategory: { [category: string]: number } }
```

## Data Models

### Transaction

```javascript
{
  id: string,          // crypto.randomUUID() — unique identifier
  name: string,        // trimmed, 1–100 characters
  amount: number,      // positive float, ≤ 999,999,999.99, stored as number
  category: string,    // one of the available categories
  createdAt: number    // Date.now() timestamp (milliseconds since epoch)
}
```

> `id` uses `crypto.randomUUID()`, available in all modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+, Edge 92+).

---

### Category

Categories are stored as plain strings. The full list at runtime is:

```javascript
// Default categories (always present, cannot be deleted)
const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

// Custom categories (user-defined, persisted to LocalStorage)
// Stored as string[] in state.categories
// Final dropdown list = DEFAULT_CATEGORIES.concat(state.categories)
```

---

### Sort Criterion

```javascript
type SortCriterion = 'amount-asc' | 'amount-desc' | 'category-asc' | null;
```

---

### Persisted State Snapshot (LocalStorage)

```javascript
// Stored under key: 'ebv_state'
{
  "transactions": [ /* Transaction[] */ ],
  "categories":   [ /* string[] — custom categories only */ ],
  "sortCriterion": null | "amount-asc" | "amount-desc" | "category-asc"
}
```

---

### File and Directory Structure

```
index.html
css/
  styles.css
js/
  app.js
```

`app.js` is organized as an IIFE containing all modules in this order:
1. Constants & default data
2. State
3. Validator
4. StorageModule
5. SortEngine
6. MonthlyAggregator
7. ChartModule
8. UIRenderer
9. AppController (init called at bottom on DOMContentLoaded)

---

### Currency Formatting

All monetary display uses the browser's `Intl.NumberFormat` API:

```javascript
const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
// fmt.format(1234.5) → '$1,234.50'
```

---

### Chart.js Integration

- CDN URL: `https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js`
- Chart type: `'pie'`
- The `<canvas id="pie-chart">` element is always present in the DOM; a sibling `<div id="chart-placeholder">` is toggled visible/hidden via CSS class when there are no transactions.
- Chart data is derived by reducing the transactions array into a `{ [category]: totalAmount }` map, then mapping to Chart.js `labels` and `data` arrays.
- Tooltip callback shows: category name, total amount (formatted), percentage of total expenses.
- CDN failure is detected via the `<script>` tag's `onerror` handler, which sets a flag checked by `ChartModule.update()`; if Chart.js is unavailable, the chart area displays an error message.

---

### Performance Targets

| Operation | Target | Mechanism |
|---|---|---|
| Balance update after add/delete | < 100 ms | Synchronous DOM update after state mutation |
| Chart update after add/delete | < 500 ms | Synchronous Chart.js re-instantiation |
| Transaction list sort | < 100 ms | In-memory array sort, synchronous DOM update |
| Monthly summary update | < 500 ms | Synchronous DOM update |
| Initial page load (25 Mbps+) | < 3 s | Minimal asset size; Chart.js from CDN |

All UI updates are synchronous within a single event loop tick, well within the specified targets for typical transaction counts (hundreds).

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transaction persistence round-trip

*For any* valid transaction object, serializing the application state to LocalStorage and then deserializing it SHALL produce a transaction list that contains a transaction with identical `id`, `name`, `amount`, `category`, and `createdAt` values.

**Validates: Requirements 5.1, 5.2, 5.3**

---

### Property 2: Category validation rejects duplicates and invalid names

*For any* string input submitted as a custom category name, the Validator SHALL reject it if it is empty, composed entirely of whitespace, exceeds 50 characters, or case-insensitively matches any existing category name, and SHALL accept it only when none of these conditions hold.

**Validates: Requirements 6.2, 6.3**

---

### Property 3: Custom category persistence round-trip

*For any* list of valid custom categories, serializing and deserializing the state SHALL produce a category list equal to the original, and all custom categories SHALL appear in the Category dropdown.

**Validates: Requirements 6.4, 6.6**

---

### Property 4: Transaction amount validation

*For any* string submitted as an amount value, the Validator SHALL accept it if and only if it represents a finite number greater than 0, no greater than 999,999,999.99, and with at most two decimal places; all other strings SHALL be rejected.

**Validates: Requirements 1.3**

---

### Property 5: Sorted list maintains all transactions

*For any* list of transactions and any valid sort criterion, sorting the list SHALL produce a result that contains exactly the same transactions as the original list (no additions or removals), with ties broken by preserving the relative insertion order of earlier transactions before later ones.

**Validates: Requirements 8.1, 8.2, 8.3**

---

### Property 6: Pie chart segments reflect category totals

*For any* non-empty list of transactions, the set of category labels in the pie chart SHALL equal the set of categories that have at least one transaction, and each label's associated value SHALL equal the sum of amounts for transactions in that category.

**Validates: Requirements 4.1, 4.2**

---

### Property 7: Monthly summary totals match filtered transactions

*For any* transaction list and any calendar month key (`YYYY-MM`), the monthly summary total SHALL equal the sum of amounts of all transactions whose `createdAt` falls within that calendar month, and the per-category breakdown amounts SHALL sum to the monthly total.

**Validates: Requirements 7.2, 7.3**

---

### Property 8: Total balance equals sum of all transaction amounts

*For any* list of transactions, the displayed Total_Balance SHALL equal the arithmetic sum of all transaction amounts, formatted to exactly two decimal places with a currency symbol prefix.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Error Handling

### Validation Errors

Displayed as inline messages adjacent to the failing form field. Multiple fields can fail simultaneously. All inline errors are cleared when the user begins editing a field or successfully submits the form.

### LocalStorage Errors

| Scenario | Behavior |
|---|---|
| `localStorage.getItem` returns `null` on init | Render empty state (no error shown to user) |
| `JSON.parse` throws on init | Discard data, render empty state, show toast: "Saved data could not be loaded." |
| `localStorage.setItem` throws `QuotaExceededError` | Keep transaction in session memory, show toast: "Data could not be saved permanently (storage full)." |
| Any other `localStorage` write error | Show toast: "An unexpected error occurred while saving." |

### CDN Failure

If the Chart.js `<script>` fails to load (`onerror`), a boolean flag `chartJsLoadFailed` is set to `true`. When `ChartModule.update()` is subsequently called, it replaces the chart canvas area with an error message: "Chart could not be loaded. Please check your internet connection."

### Corrupt Categories on Init

During initialization, `StorageModule.load()` filters the restored `categories` array: any entry that is not a string, is empty after trimming, or exceeds 50 characters is silently discarded (Requirement 6.6).

### Unexpected Runtime Errors

A top-level `window.onerror` handler catches unhandled exceptions and displays a generic toast message rather than leaving the user with a silent broken state.

## Testing Strategy

### Unit Tests (Example-Based)

Each module is independently testable as a pure function or a function with mockable dependencies.

**Validator**
- Accepts a valid transaction form submission
- Rejects empty name, whitespace-only name, name exceeding 100 characters
- Rejects amount of zero, negative amount, amount exceeding 999,999,999.99, amount with 3+ decimal places, non-numeric string
- Rejects unselected category
- Accepts and rejects custom category names per the rules above

**StorageModule** (with mocked `localStorage`)
- Returns `{ ok: false, error: 'empty' }` when storage is empty
- Returns `{ ok: false, error: 'corrupted' }` when stored JSON is malformed
- Returns `{ ok: true, data }` for valid stored data
- Returns `{ ok: false, error: 'quota_exceeded' }` when `setItem` throws `QuotaExceededError`

**SortEngine**
- Returns correct order for all three criteria
- Preserves insertion order on ties
- Returns a new array without mutating the original

**MonthlyAggregator**
- Groups transactions by correct calendar month
- Returns zero total and zero-per-category breakdown for a month with no transactions
- Returns correct per-category breakdown for a month with transactions spanning multiple categories

**ChartModule** (with mocked Chart.js)
- Builds correct `labels` and `data` arrays from a transaction list
- Calls `chart.destroy()` before re-instantiation when a chart already exists

### Property-Based Tests

Property-based tests use **fast-check** (JavaScript PBT library) with a minimum of 100 iterations per test.

Each test is tagged with a comment in the format:
`// Feature: expense-budget-visualizer, Property N: <property_text>`

**Property 1 — Transaction persistence round-trip**
Generate arbitrary valid `Transaction` objects, serialize via `StorageModule.save`, deserialize via `StorageModule.load`, and assert the round-tripped transaction list is deeply equal to the original.
`// Feature: expense-budget-visualizer, Property 1: transaction persistence round-trip`

**Property 2 — Category validation correctness**
Generate arbitrary strings; for each, assert that `Validator.validateCategory` returns `valid: true` iff the string satisfies all acceptance rules.
`// Feature: expense-budget-visualizer, Property 2: category validation rejects duplicates and invalid names`

**Property 3 — Custom category persistence round-trip**
Generate arbitrary valid category name arrays; serialize and deserialize; assert the restored list is deeply equal to the original.
`// Feature: expense-budget-visualizer, Property 3: custom category persistence round-trip`

**Property 4 — Transaction amount validation**
Generate arbitrary strings (including edge cases: `"0"`, `"-1"`, `"1e10"`, very long strings, special characters); assert the validator accepts iff the string represents a valid amount.
`// Feature: expense-budget-visualizer, Property 4: transaction amount validation`

**Property 5 — Sorted list maintains all transactions**
Generate arbitrary transaction arrays and arbitrary sort criteria; assert the sorted result contains exactly the same items (by `id`) as the original, and ties are broken by `createdAt` ascending.
`// Feature: expense-budget-visualizer, Property 5: sorted list maintains all transactions`

**Property 6 — Pie chart segments reflect category totals**
Generate arbitrary non-empty transaction arrays; assert the chart data produced by `ChartModule`'s aggregation function matches a manually computed category-sum map.
`// Feature: expense-budget-visualizer, Property 6: pie chart segments reflect category totals`

**Property 7 — Monthly summary totals match filtered transactions**
Generate arbitrary transaction arrays and arbitrary `YYYY-MM` month keys; assert that `MonthlyAggregator.summarize` returns a total equal to the sum of amounts of transactions falling in that month, and the per-category values sum to the total.
`// Feature: expense-budget-visualizer, Property 7: monthly summary totals match filtered transactions`

**Property 8 — Total balance equals sum of amounts**
Generate arbitrary transaction arrays; assert that the balance computation equals the arithmetic sum of all transaction amounts, and the result is formatted with exactly two decimal places and a `$` prefix.
`// Feature: expense-budget-visualizer, Property 8: total balance equals sum of all transaction amounts`

### Integration / Smoke Tests

- Load `index.html` in each target browser (Chrome, Firefox, Edge, Safari) and verify the app renders without console errors
- Verify Chart.js loads from CDN and the pie chart renders with one sample transaction
- Simulate CDN failure (block the Chart.js URL in browser DevTools) and verify the error message appears
- Simulate LocalStorage quota exceeded (fill storage manually) and verify the toast message appears

(() => {
  'use strict';

  // =============================================================
  // 1. Constants & Default Data
  // =============================================================

  /**
   * Default categories always present in the dropdown and cannot be deleted.
   * @type {string[]}
   */
  const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

  /**
   * LocalStorage key used for all persistence.
   * @type {string}
   */
  const STORAGE_KEY = 'ebv_state';

  /**
   * Valid sort criterion values.
   * @typedef {'amount-asc'|'amount-desc'|'category-asc'|null} SortCriterion
   */

  // =============================================================
  // 2. State
  // =============================================================

  /**
   * Single in-memory source of truth.
   * - transactions: Transaction[]
   * - categories: string[]  (custom categories only; defaults are always prepended at render time)
   * - sortCriterion: SortCriterion
   */
  const State = (() => {
    let _state = {
      transactions: [],   // Transaction[]
      categories: [],     // string[] — custom categories only
      sortCriterion: null // SortCriterion
    };

    /**
     * Returns a deep copy of the current state so callers cannot mutate internals.
     * @returns {{ transactions: object[], categories: string[], sortCriterion: SortCriterion }}
     */
    function getAll() {
      return JSON.parse(JSON.stringify(_state));
    }

    /**
     * Creates a new Transaction from the supplied partial data, appends it to state,
     * and returns a deep copy of the new state.
     *
     * The caller supplies { name, amount, category } — id and createdAt are generated here.
     *
     * @param {{ name: string, amount: number, category: string }} txData
     * @returns {{ transactions: object[], categories: string[], sortCriterion: SortCriterion }}
     */
    function addTransaction(txData) {
      const transaction = {
        id: crypto.randomUUID(),
        name: String(txData.name).trim(),
        amount: Number(txData.amount),
        category: String(txData.category),
        createdAt: Date.now()
      };
      _state.transactions = [..._state.transactions, transaction];
      return getAll();
    }

    /**
     * Removes the transaction with the given id from state and returns a deep copy
     * of the new state. No-ops silently if the id is not found.
     *
     * @param {string} id
     * @returns {{ transactions: object[], categories: string[], sortCriterion: SortCriterion }}
     */
    function deleteTransaction(id) {
      _state.transactions = _state.transactions.filter(tx => tx.id !== id);
      return getAll();
    }

    /**
     * Appends a new custom category name to state and returns a deep copy of the new state.
     * The caller is responsible for validating uniqueness and length beforehand.
     *
     * @param {string} name
     * @returns {{ transactions: object[], categories: string[], sortCriterion: SortCriterion }}
     */
    function addCategory(name) {
      _state.categories = [..._state.categories, String(name)];
      return getAll();
    }

    /**
     * Sets the active sort criterion and returns a deep copy of the new state.
     *
     * @param {SortCriterion} criterion
     * @returns {{ transactions: object[], categories: string[], sortCriterion: SortCriterion }}
     */
    function setSortCriterion(criterion) {
      _state.sortCriterion = criterion;
      return getAll();
    }

    /**
     * Replaces the entire in-memory state from a deserialized snapshot (e.g. from LocalStorage).
     * Unknown or missing fields fall back to safe defaults so a partial snapshot never breaks the app.
     *
     * @param {{ transactions?: object[], categories?: string[], sortCriterion?: SortCriterion }} snapshot
     * @returns {{ transactions: object[], categories: string[], sortCriterion: SortCriterion }}
     */
    function load(snapshot) {
      _state = {
        transactions: Array.isArray(snapshot.transactions) ? snapshot.transactions : [],
        categories: Array.isArray(snapshot.categories) ? snapshot.categories : [],
        sortCriterion: snapshot.sortCriterion !== undefined ? snapshot.sortCriterion : null
      };
      return getAll();
    }

    return { getAll, addTransaction, deleteTransaction, addCategory, setSortCriterion, load };
  })();

  // =============================================================
  // 3. Validator
  // =============================================================

  /**
   * Pure validation functions. No side effects.
   */
  const Validator = (() => {
    /**
     * Maximum number of decimal places allowed for an amount.
     * @type {number}
     */
    const MAX_DECIMAL_PLACES = 2;

    /**
     * Maximum allowed amount value.
     * @type {number}
     */
    const MAX_AMOUNT = 999999999.99;

    /**
     * Validates a transaction form submission.
     *
     * Rules:
     *   - name: non-empty after trimming, ≤ 100 characters
     *   - amount: parseable as a finite number, > 0, ≤ 999,999,999.99, ≤ 2 decimal places
     *   - category: non-empty string
     *
     * @param {{ name: string, amount: string, category: string }} formData
     * @returns {{ valid: true } | { valid: false, errors: { name?: string, amount?: string, category?: string } }}
     */
    function validateTransaction(formData) {
      const errors = {};

      // --- name ---
      const trimmedName = String(formData.name ?? '').trim();
      if (trimmedName.length === 0) {
        errors.name = 'Item name is required.';
      } else if (trimmedName.length > 100) {
        errors.name = 'Item name must be 100 characters or fewer.';
      }

      // --- amount ---
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
          // Check decimal places via the string representation.
          const dotIndex = rawAmount.indexOf('.');
          if (dotIndex !== -1) {
            const decimals = rawAmount.length - dotIndex - 1;
            if (decimals > MAX_DECIMAL_PLACES) {
              errors.amount = 'Amount must have at most 2 decimal places.';
            }
          }
        }
      }

      // --- category ---
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
     *   - Total custom categories must not exceed 20
     *
     * @param {string} name
     * @param {string[]} existingCategories  — the full list (defaults + custom)
     * @param {number}  customCount          — current count of custom categories
     * @returns {{ valid: true } | { valid: false, errors: { name: string } }}
     */
    function validateCategory(name, existingCategories, customCount = 0) {
      const trimmed = String(name ?? '').trim();

      if (trimmed.length === 0) {
        return { valid: false, errors: { name: 'Category name cannot be empty.' } };
      }
      if (trimmed.length > 50) {
        return { valid: false, errors: { name: 'Category name must be 50 characters or fewer.' } };
      }

      const lower = trimmed.toLowerCase();
      const isDuplicate = existingCategories.some(
        cat => String(cat).toLowerCase() === lower
      );
      if (isDuplicate) {
        return { valid: false, errors: { name: 'A category with that name already exists.' } };
      }

      if (customCount >= 20) {
        return { valid: false, errors: { name: 'Maximum number of custom categories (20) has been reached.' } };
      }

      return { valid: true };
    }

    return { validateTransaction, validateCategory };
  })();

  // =============================================================
  // 4. StorageModule
  // =============================================================

  /**
   * Wraps LocalStorage access with try/catch to handle quota errors and parse failures.
   */
  const StorageModule = (() => {
    /**
     * Serializes state to JSON and writes to localStorage under key STORAGE_KEY.
     *
     * @param {{ transactions: object[], categories: string[], sortCriterion: SortCriterion }} state
     * @returns {{ ok: true } | { ok: false, error: 'quota_exceeded' | 'unknown' }}
     */
    function save(state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return { ok: true };
      } catch (err) {
        // QuotaExceededError is DOMException code 22; Firefox also throws NS_ERROR_DOM_QUOTA_REACHED
        if (
          err instanceof DOMException &&
          (err.code === 22 ||
            err.code === 1014 ||
            err.name === 'QuotaExceededError' ||
            err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
        ) {
          return { ok: false, error: 'quota_exceeded' };
        }
        return { ok: false, error: 'unknown' };
      }
    }

    /**
     * Reads and deserializes state from localStorage.
     * Filters the categories array: discards any entry that is not a string,
     * is empty after trimming, or exceeds 50 characters (Requirement 6.6).
     *
     * @returns {{ ok: true, data: object } | { ok: false, error: 'empty' | 'corrupted' }}
     */
    function load() {
      let raw;
      try {
        raw = localStorage.getItem(STORAGE_KEY);
      } catch (_err) {
        return { ok: false, error: 'corrupted' };
      }

      if (raw === null) {
        return { ok: false, error: 'empty' };
      }

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (_err) {
        return { ok: false, error: 'corrupted' };
      }

      // Sanitize the categories array per Requirement 6.6
      if (Array.isArray(parsed.categories)) {
        parsed.categories = parsed.categories.filter(
          entry =>
            typeof entry === 'string' &&
            entry.trim().length > 0 &&
            entry.length <= 50
        );
      }

      return { ok: true, data: parsed };
    }

    return { save, load };
  })();

  // =============================================================
  // 5. SortEngine
  // =============================================================

  /**
   * Pure sorting utilities.  Logic lives in js/sort-engine.js (ES module) so
   * it can be unit-tested in isolation.  Here we re-expose the same API as a
   * plain object for use inside the IIFE.
   *
   * SortEngine.sort(transactions, criterion)
   *   Returns a NEW sorted array; never mutates the original.
   *   criterion: 'amount-asc' | 'amount-desc' | 'category-asc' | null
   *   Ties broken by createdAt ascending (preserves insertion order).
   *
   * SortEngine.insertSorted(transactions, newTx, criterion)
   *   Returns a new array with newTx at the correct sorted position.
   *   When criterion is null, newTx is appended at the end.
   */
  const SortEngine = (() => {
    /**
     * @param {'amount-asc'|'amount-desc'|'category-asc'|null} criterion
     * @returns {(a: object, b: object) => number}
     */
    function makeComparator(criterion) {
      return (a, b) => {
        let primary = 0;
        if (criterion === 'amount-asc') {
          primary = a.amount - b.amount;
        } else if (criterion === 'amount-desc') {
          primary = b.amount - a.amount;
        } else if (criterion === 'category-asc') {
          const ca = String(a.category).toLowerCase();
          const cb = String(b.category).toLowerCase();
          primary = ca < cb ? -1 : ca > cb ? 1 : 0;
        }
        return primary !== 0 ? primary : a.createdAt - b.createdAt;
      };
    }

    /**
     * @param {object[]} transactions
     * @param {'amount-asc'|'amount-desc'|'category-asc'|null} criterion
     * @returns {object[]}
     */
    function sort(transactions, criterion) {
      return [...transactions].sort(makeComparator(criterion));
    }

    /**
     * @param {object[]} transactions
     * @param {object}   newTx
     * @param {'amount-asc'|'amount-desc'|'category-asc'|null} criterion
     * @returns {object[]}
     */
    function insertSorted(transactions, newTx, criterion) {
      if (criterion === null) {
        return [...transactions, newTx];
      }
      const cmp = makeComparator(criterion);
      const result = [...transactions];
      let insertAt = result.length;
      for (let i = 0; i < result.length; i++) {
        if (cmp(newTx, result[i]) < 0) {
          insertAt = i;
          break;
        }
      }
      result.splice(insertAt, 0, newTx);
      return result;
    }

    return { sort, insertSorted };
  })();

  // =============================================================
  // 6. MonthlyAggregator
  // =============================================================

  /**
   * Pure functions for grouping and summarising transactions by calendar month.
   */
  const MonthlyAggregator = (() => {
    /**
     * Formats a Date object into a 'YYYY-MM' string with zero-padded month.
     *
     * @param {Date} date
     * @returns {string}
     */
    function toMonthKey(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }

    /**
     * Returns a sorted (ascending) array of distinct 'YYYY-MM' month key strings
     * representing every calendar month that has at least one transaction.
     * Returns [] when transactions is empty, null, or undefined.
     *
     * @param {object[]} transactions
     * @returns {string[]}
     */
    function getAvailableMonths(transactions) {
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return [];
      }
      const monthSet = new Set();
      for (const tx of transactions) {
        monthSet.add(toMonthKey(new Date(tx.createdAt)));
      }
      return [...monthSet].sort();
    }

    /**
     * Returns a summary of transactions for the given 'YYYY-MM' month key.
     *
     * @param {object[]} transactions
     * @param {string}   monthKey  — 'YYYY-MM'
     * @returns {{ total: number, byCategory: { [category: string]: number } }}
     */
    function summarize(transactions, monthKey) {
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return { total: 0, byCategory: {} };
      }

      const [yearStr, monthStr] = String(monthKey).split('-');
      const targetYear = parseInt(yearStr, 10);
      const targetMonth = parseInt(monthStr, 10); // 1-based

      let total = 0;
      const byCategory = {};

      for (const tx of transactions) {
        const date = new Date(tx.createdAt);
        if (
          date.getFullYear() === targetYear &&
          date.getMonth() + 1 === targetMonth
        ) {
          total += tx.amount;
          byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amount;
        }
      }

      return { total, byCategory };
    }

    return { getAvailableMonths, summarize };
  })();

  // =============================================================
  // 7. ChartModule
  // =============================================================

  /**
   * Wraps Chart.js lifecycle.  Maintains a reference to the current Chart
   * instance and destroys it before re-creating to avoid the
   * "canvas already in use" error (Chart.js v4 requirement).
   */
  const ChartModule = (() => {
    /** @type {import('chart.js').Chart|null} */
    let _chartInstance = null;

    /**
     * Currency formatter shared by legend labels and tooltips.
     */
    const _fmt = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    /**
     * Aggregates expense amounts by category from a transaction array.
     * Only transactions with a positive amount are included.
     *
     * @param {object[]} transactions
     * @returns {{ [category: string]: number }}
     */
    function _aggregate(transactions) {
      if (!Array.isArray(transactions) || transactions.length === 0) return {};
      const totals = {};
      for (const tx of transactions) {
        const amount = Number(tx.amount);
        if (!isFinite(amount) || amount <= 0) continue;
        const cat = String(tx.category);
        totals[cat] = (totals[cat] ?? 0) + amount;
      }
      return totals;
    }

    /**
     * Destroys the existing Chart.js instance if one exists, freeing the canvas.
     */
    function destroy() {
      if (_chartInstance !== null) {
        _chartInstance.destroy();
        _chartInstance = null;
      }
    }

    /**
     * Updates the pie chart from the given transaction list.
     *
     * - If `window.chartJsLoadFailed` is true, shows a CDN error message
     *   instead of a chart.
     * - If there are no expense transactions, hides the canvas and shows the
     *   placeholder message.
     * - Otherwise destroys any existing Chart instance and creates a new one.
     *
     * @param {object[]} transactions
     */
    function update(transactions) {
      const canvas      = document.getElementById('pie-chart');
      const placeholder = document.getElementById('chart-placeholder');

      if (!canvas || !placeholder) return;

      // ── CDN failure ──────────────────────────────────────────────────────
      if (window.chartJsLoadFailed) {
        destroy();
        canvas.style.display = 'none';
        placeholder.textContent = 'Chart could not be loaded. Please check your internet connection.';
        placeholder.style.display = '';
        return;
      }

      // ── Aggregate data ───────────────────────────────────────────────────
      const totals     = _aggregate(transactions);
      const categories = Object.keys(totals);

      // ── No expense transactions ──────────────────────────────────────────
      if (categories.length === 0) {
        destroy();
        canvas.style.display = 'none';
        placeholder.textContent = 'No spending data available';
        placeholder.style.display = '';
        return;
      }

      // ── Build chart data ─────────────────────────────────────────────────
      const totalExpenses = categories.reduce((sum, cat) => sum + totals[cat], 0);
      const labels        = categories;
      const data          = categories.map(cat => totals[cat]);

      // Destroy previous instance before re-creating (Chart.js v4 requirement)
      destroy();

      // Show canvas, hide placeholder
      canvas.style.display = '';
      placeholder.style.display = 'none';

      // ── Colour palette — cycles if more than 8 categories ────────────────
      const PALETTE = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#C9CBCF', '#7CFC00'
      ];
      const backgroundColors = categories.map((_, i) => PALETTE[i % PALETTE.length]);
      const hoverColors      = backgroundColors.map(c => c + 'CC'); // slight transparency on hover

      _chartInstance = new Chart(canvas, {
        type: 'pie',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor:      backgroundColors,
            hoverBackgroundColor: hoverColors,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            // ── Legend — category name + total amount ──────────────────────
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                generateLabels(chart) {
                  const meta   = chart.getDatasetMeta(0);
                  const ds     = chart.data.datasets[0];
                  return (chart.data.labels ?? []).map((label, i) => ({
                    text:        `${label}: ${_fmt.format(ds.data[i])}`,
                    fillStyle:   ds.backgroundColor[i],
                    strokeStyle: ds.backgroundColor[i],
                    hidden:      meta.data[i] ? !meta.data[i].active : false,
                    index:       i
                  }));
                }
              }
            },
            // ── Tooltip — category, total amount, percentage ───────────────
            tooltip: {
              callbacks: {
                label(context) {
                  const categoryName = context.label ?? '';
                  const value        = context.parsed;
                  const pct          = totalExpenses > 0
                    ? ((value / totalExpenses) * 100).toFixed(1)
                    : '0.0';
                  return `${categoryName}: ${_fmt.format(value)} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    return { update, destroy };
  })();

  // =============================================================
  // 8. UIRenderer
  // =============================================================

  // ── Transaction list view-model helper (mirrors js/transaction-list-renderer.js)
  // The pure logic is also exported from transaction-list-renderer.js for unit
  // testing without a DOM; this inline copy is used at runtime inside the IIFE.

  /**
   * Builds the data descriptor for a single transaction list row.
   *
   * @param {{ id: string, name: string, amount: number, category: string }} tx
   * @param {Intl.NumberFormat} fmt
   * @returns {{ id: string, name: string, formattedAmount: string, category: string }}
   */
  function _buildTransactionRow(tx, fmt) {
    return {
      id:              String(tx.id),
      name:            String(tx.name),
      formattedAmount: fmt.format(Number(tx.amount)),
      category:        String(tx.category)
    };
  }

  /**
   * Prepares the full view-model for the transaction list panel.
   *
   * @param {object[]}    transactions
   * @param {string|null} sortCriterion
   * @param {Function}    sortFn
   * @param {Intl.NumberFormat} fmt
   * @returns {{ empty: true } | { empty: false, rows: object[] }}
   */
  function _buildTransactionListViewModel(transactions, sortCriterion, sortFn, fmt) {
    const txs = Array.isArray(transactions) ? transactions : [];
    if (txs.length === 0) return { empty: true };
    const sorted = sortFn(txs, sortCriterion);
    return { empty: false, rows: sorted.map(tx => _buildTransactionRow(tx, fmt)) };
  }

  // ── Monthly summary view-model helper (mirrors js/monthly-summary-renderer.js)
  // The pure logic is also exported from monthly-summary-renderer.js for unit
  // testing without a DOM; this inline copy is used at runtime inside the IIFE.

  /**
   * Builds the view-model for the monthly summary panel.
   *
   * @param {object[]} transactions   — full transaction array (all months)
   * @param {string}   selectedMonth  — 'YYYY-MM' key
   * @param {Function} summarizeFn    — `(transactions, monthKey) => { total, byCategory }`
   * @returns {{
   *   formattedTotal: string,
   *   categories: Array<{ name: string, formattedAmount: string }>,
   *   hasCategories: boolean
   * }}
   */
  function _buildMonthlySummaryViewModel(transactions, selectedMonth, summarizeFn) {
    const txs = Array.isArray(transactions) ? transactions : [];

    const { total, byCategory } = summarizeFn(txs, selectedMonth);

    // Start with categories that have transactions in the selected month
    const categoryMap = { ...byCategory };

    // Requirement 7.4: no transactions this month but other months have some →
    // show all categories from the entire list at $0.00
    if (Object.keys(categoryMap).length === 0 && txs.length > 0) {
      for (const tx of txs) {
        const cat = String(tx.category);
        if (!(cat in categoryMap)) {
          categoryMap[cat] = 0;
        }
      }
    }

    const _fmtLocal = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const categoryKeys = Object.keys(categoryMap).sort();

    return {
      formattedTotal: _fmtLocal.format(total),
      categories: categoryKeys.map(name => ({
        name,
        formattedAmount: _fmtLocal.format(categoryMap[name])
      })),
      hasCategories: categoryKeys.length > 0
    };
  }

  /**
   * Responsible for all DOM mutations.  Each function accepts a slice of
   * application state and rebuilds the relevant section of the page.
   */
  const UIRenderer = (() => {
    /**
     * Shared currency formatter — used by all monetary displays.
     * @type {Intl.NumberFormat}
     */
    const _fmt = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    // ------------------------------------------------------------------
    // 7.1  renderBalance
    // ------------------------------------------------------------------

    /**
     * Computes the total balance from all transactions and updates the
     * `#total-balance` element.  Displays "$0.00" on empty or invalid data.
     *
     * @param {object[]} transactions
     */
    function renderBalance(transactions) {
      const el = document.getElementById('total-balance');
      if (!el) return;

      let total = 0;
      if (Array.isArray(transactions)) {
        for (const tx of transactions) {
          const n = Number(tx.amount);
          if (isFinite(n)) total += n;
        }
      }
      el.textContent = _fmt.format(total);
    }

    // ------------------------------------------------------------------
    // 7.3  renderTransactionList
    // ------------------------------------------------------------------

    /**
     * Renders the transaction list panel.
     *
     * - Sorts the transactions using SortEngine when a criterion is provided.
     * - Displays each transaction with its name, formatted amount, and category.
     * - Shows a "No transactions yet" message when the list is empty.
     * - The scrollable container behaviour is handled entirely by CSS
     *   (overflow-y: auto on a fixed-height container).
     *
     * Each transaction row contains a delete button with a
     * `data-id` attribute set to the transaction's id, ready for the
     * delete handler wired up by AppController.
     *
     * @param {object[]} transactions   — full (unsorted) transaction array
     * @param {SortCriterion} sortCriterion
     */
    function renderTransactionList(transactions, sortCriterion) {
      const list = document.getElementById('transaction-list');
      if (!list) return;

      // Clear current contents
      list.innerHTML = '';

      // Build view-model using the pure helper (SortEngine injected as sortFn)
      const viewModel = _buildTransactionListViewModel(
        transactions,
        sortCriterion,
        SortEngine.sort,
        _fmt
      );

      // ── Empty state ──────────────────────────────────────────────────
      if (viewModel.empty) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'transaction-list__empty';
        emptyItem.id = 'empty-list-message';
        emptyItem.textContent = 'No transactions yet';
        list.appendChild(emptyItem);
        return;
      }

      // ── Build one <li> per row ──────────────────────────────────────
      for (const row of viewModel.rows) {
        /*
         * Markup:
         *
         *  <li class="transaction-item" data-tx-id="<uuid>">
         *    <div class="transaction-item__info">
         *      <div class="transaction-item__name">Coffee</div>
         *      <div class="transaction-item__meta">
         *        <span class="transaction-item__amount">$4.50</span>
         *        <span class="transaction-item__category">Food</span>
         *      </div>
         *    </div>
         *    <button class="btn btn--danger" data-id="<uuid>"
         *            aria-label="Delete Coffee">Delete</button>
         *  </li>
         */

        const li = document.createElement('li');
        li.className = 'transaction-item';
        li.dataset.txId = row.id;

        // Info block
        const info = document.createElement('div');
        info.className = 'transaction-item__info';

        const nameEl = document.createElement('div');
        nameEl.className = 'transaction-item__name';
        nameEl.textContent = row.name;

        const meta = document.createElement('div');
        meta.className = 'transaction-item__meta';

        const amountEl = document.createElement('span');
        amountEl.className = 'transaction-item__amount';
        amountEl.textContent = row.formattedAmount;

        const categoryEl = document.createElement('span');
        categoryEl.className = 'transaction-item__category';
        categoryEl.textContent = row.category;

        meta.appendChild(amountEl);
        meta.appendChild(categoryEl);

        info.appendChild(nameEl);
        info.appendChild(meta);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn--danger';
        deleteBtn.dataset.id = row.id;
        deleteBtn.setAttribute('aria-label', `Delete ${row.name}`);
        deleteBtn.textContent = 'Delete';

        li.appendChild(info);
        li.appendChild(deleteBtn);

        list.appendChild(li);
      }
    }

    // ------------------------------------------------------------------
    // 7.4  renderCategoryDropdown
    // ------------------------------------------------------------------

    /**
     * Populates the Category `<select>` with the default categories followed
     * by any custom categories.  The first option ("— Select a category —")
     * is always preserved.
     *
     * @param {string[]} customCategories  — custom categories from state
     */
    function renderCategoryDropdown(customCategories) {
      const select = document.getElementById('category');
      if (!select) return;

      // Keep the placeholder option; rebuild everything else
      select.innerHTML = '<option value="">— Select a category —</option>';

      // Requirement 6.6: filter out invalid entries — not a string, empty after
      // trim, or exceeds 50 characters — before merging with defaults.
      const validCustom = Array.isArray(customCategories)
        ? customCategories.filter(
            c => typeof c === 'string' && c.trim().length > 0 && c.length <= 50
          )
        : [];

      const allCategories = [...DEFAULT_CATEGORIES, ...validCustom];

      for (const cat of allCategories) {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
      }
    }

    // ------------------------------------------------------------------
    // 7.5  renderMonthlySummary
    // ------------------------------------------------------------------

    /**
     * Formats a 'YYYY-MM' key into a human-readable label like "November 2026".
     *
     * @param {string} monthKey  — 'YYYY-MM'
     * @returns {string}
     */
    function _formatMonthLabel(monthKey) {
      const [yearStr, monthStr] = String(monthKey).split('-');
      const date = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    /**
     * Populates the `#month-select` dropdown with available months derived
     * from the transaction list.
     *
     * - If the current calendar month is not in the list it is always added so
     *   the user always sees at least one option (Requirement 7.2).
     * - The option matching `selectedMonth` is marked as selected.
     * - If `selectedMonth` is not in the list (e.g. it was the default current
     *   month that had no transactions) it is added as the selected option.
     *
     * @param {object[]} transactions   — full transaction array (all months)
     * @param {string}   selectedMonth  — the 'YYYY-MM' key to pre-select
     */
    function _renderMonthSelect(transactions, selectedMonth) {
      const select = document.getElementById('month-select');
      if (!select) return;

      const availableMonths = MonthlyAggregator.getAvailableMonths(transactions);

      // Always include the selected month (usually the current calendar month)
      // so the dropdown is never empty.
      const monthSet = new Set(availableMonths);
      monthSet.add(selectedMonth);

      // Sort descending (most recent first) so the user sees the latest month at top
      const months = [...monthSet].sort().reverse();

      select.innerHTML = '';
      for (const key of months) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = _formatMonthLabel(key);
        if (key === selectedMonth) {
          option.selected = true;
        }
        select.appendChild(option);
      }
    }

    /**
     * Renders the monthly summary panel and updates the month selector dropdown.
     *
     * - Populates `#month-select` with all months that have transactions, plus
     *   the current calendar month as the default selection (Requirement 7.2).
     * - Calls MonthlyAggregator.summarize() to get `{ total, byCategory }` for
     *   the selected month and renders the formatted total and per-category list.
     * - For Requirement 7.4: when no transactions exist for the selected month,
     *   displays a total of $0.00 and shows every category from other months at
     *   $0.00 so the user has a consistent breakdown view.
     *
     * The pure view-model logic lives in js/monthly-summary-renderer.js so it
     * can be unit-tested without a DOM.
     *
     * @param {object[]} transactions   — full transaction array (all months)
     * @param {string}   selectedMonth  — 'YYYY-MM' month key to display
     */
    function renderMonthlySummary(transactions, selectedMonth) {
      const container = document.getElementById('monthly-summary');
      if (!container) return;

      // ── Populate the month-select dropdown (Requirement 7.2) ─────────
      _renderMonthSelect(transactions, selectedMonth);

      // ── Clear current summary contents ───────────────────────────────
      container.innerHTML = '';

      // Build view-model using the pure helper (MonthlyAggregator.summarize injected)
      const viewModel = _buildMonthlySummaryViewModel(
        transactions,
        selectedMonth,
        MonthlyAggregator.summarize
      );

      // ── Total row ──────────────────────────────────────────────────
      const totalEl = document.createElement('div');
      totalEl.className = 'monthly-summary__total';

      const totalLabel = document.createElement('span');
      totalLabel.className = 'monthly-summary__total-label';
      totalLabel.textContent = 'Total:';

      const totalValue = document.createElement('span');
      totalValue.className = 'monthly-summary__total-value';
      totalValue.textContent = viewModel.formattedTotal;

      totalEl.appendChild(totalLabel);
      totalEl.appendChild(totalValue);
      container.appendChild(totalEl);

      // ── Per-category breakdown ─────────────────────────────────────
      if (!viewModel.hasCategories) {
        // No transactions anywhere — show a placeholder
        const emptyEl = document.createElement('p');
        emptyEl.className = 'monthly-summary__empty';
        emptyEl.textContent = 'No transactions for this month.';
        container.appendChild(emptyEl);
        return;
      }

      const list = document.createElement('ul');
      list.className = 'monthly-summary__list';

      for (const { name, formattedAmount } of viewModel.categories) {
        const li = document.createElement('li');
        li.className = 'monthly-summary__item';

        const catLabel = document.createElement('span');
        catLabel.className = 'monthly-summary__category';
        catLabel.textContent = name;

        const catAmount = document.createElement('span');
        catAmount.className = 'monthly-summary__amount';
        catAmount.textContent = formattedAmount;

        li.appendChild(catLabel);
        li.appendChild(catAmount);
        list.appendChild(li);
      }

      container.appendChild(list);
    }

    // ------------------------------------------------------------------
    // 7.6  showInlineError / clearInlineErrors / showToast
    // ------------------------------------------------------------------

    /**
     * Displays an inline error message adjacent to the form field identified
     * by `fieldId`.  Error spans in the HTML follow the naming convention
     * `error-${fieldId}` (e.g. field "item-name" → span id "error-item-name").
     *
     * If the named span already exists (as it does for all fields in index.html)
     * its text content is set directly.  If for any reason the span is absent
     * (future fields, dynamically inserted forms) a new <span> is created with
     * the `inline-error` class and injected after the input element.
     *
     * Sets `aria-invalid="true"` on the associated input so screen readers
     * announce the error when focus reaches the field.
     *
     * @param {string} fieldId   — the `id` of the input/select element
     * @param {string} message   — the error text to show
     */
    function showInlineError(fieldId, message) {
      const errorId  = `error-${fieldId}`;
      let   errorEl  = document.getElementById(errorId);

      if (!errorEl) {
        // Dynamically create a sibling span after the field
        const field = document.getElementById(fieldId);
        if (!field) return;

        errorEl = document.createElement('span');
        errorEl.id        = errorId;
        errorEl.className = 'inline-error';
        errorEl.setAttribute('role', 'alert');
        errorEl.setAttribute('aria-live', 'assertive');
        field.insertAdjacentElement('afterend', errorEl);
      }

      errorEl.textContent = String(message);

      // Mark the field itself as invalid for assistive technology
      const field = document.getElementById(fieldId);
      if (field) {
        field.setAttribute('aria-invalid', 'true');
        field.classList.add('is-invalid');
      }
    }

    /**
     * Clears all currently visible inline error messages on the page.
     *
     * Finds every element with the `inline-error` class, empties its text
     * content, and removes the `aria-invalid` / `is-invalid` state from the
     * associated input so the form returns to a clean state.
     *
     * Called before validation on a new submission attempt and after a
     * successful form submit.
     */
    function clearInlineErrors() {
      const errorEls = document.querySelectorAll('.inline-error');
      for (const el of errorEls) {
        el.textContent = '';

        // Derive the field id from the error element id: "error-foo" → "foo"
        const fieldId = el.id.replace(/^error-/, '');
        const field   = document.getElementById(fieldId);
        if (field) {
          field.removeAttribute('aria-invalid');
          field.classList.remove('is-invalid');
        }
      }
    }

    /**
     * Displays a toast notification in the `#toast-container` element.
     *
     * - `type` must be `'error'` or `'info'`; maps to CSS modifier classes
     *   `.toast--error` and `.toast--info` respectively.
     * - The toast auto-dismisses after 4 seconds with a fade-out animation.
     * - If multiple toasts are queued quickly they stack; each has its own
     *   independent dismiss timer.
     *
     * @param {string} message   — the notification text
     * @param {'error'|'info'} type
     */
    function showToast(message, type) {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const validType = (type === 'error' || type === 'info') ? type : 'info';

      const toast = document.createElement('div');
      toast.className   = `toast toast--${validType}`;
      toast.textContent = String(message);
      // role="alert" is assertive (errors); role="status" is polite (info)
      toast.setAttribute('role', validType === 'error' ? 'alert' : 'status');

      container.appendChild(toast);

      // Auto-dismiss after 4 s
      const DISMISS_DELAY = 4000;
      const FADE_DURATION  = 200; // matches CSS animation duration

      const dismiss = () => {
        toast.classList.add('is-hiding');
        // Remove from DOM after the fade-out animation completes
        setTimeout(() => {
          if (toast.parentNode === container) {
            container.removeChild(toast);
          }
        }, FADE_DURATION);
      };

      setTimeout(dismiss, DISMISS_DELAY);
    }

    // ------------------------------------------------------------------
    // 7.7  render(state)
    // ------------------------------------------------------------------

    /**
     * Top-level render function.  Calls all sub-renderers in sequence using
     * the full application state snapshot.
     *
     * `state.selectedMonth` is optional; when absent it defaults to the
     * current calendar month expressed as a `'YYYY-MM'` string.
     *
     * @param {{
     *   transactions:   object[],
     *   categories:     string[],
     *   sortCriterion:  SortCriterion,
     *   selectedMonth?: string
     * }} state
     */
    function render(state) {
      const now          = new Date();
      const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const selectedMonth = (state && state.selectedMonth) ? state.selectedMonth : defaultMonth;

      renderBalance(state.transactions);
      renderTransactionList(state.transactions, state.sortCriterion);
      renderCategoryDropdown(state.categories);
      renderMonthlySummary(state.transactions, selectedMonth);
    }

    // ------------------------------------------------------------------
    // Public interface
    // ------------------------------------------------------------------

    return {
      render,
      renderBalance,
      renderTransactionList,
      renderCategoryDropdown,
      renderMonthlySummary,
      showInlineError,
      clearInlineErrors,
      showToast
    };
  })();

  // =============================================================
  // 9. AppController
  // =============================================================

  /**
   * Tracks the currently selected month ('YYYY-MM') for the Monthly Summary view.
   * Initialised in init() to the current calendar month.
   * @type {string}
   */
  let _selectedMonth = '';

  const AppController = (() => {

    // ------------------------------------------------------------------
    // 9.2  handleAddTransaction
    // ------------------------------------------------------------------

    /**
     * Handles the transaction form submit event.
     *
     * Flow:
     *   1. Clear any existing inline errors.
     *   2. Read form values and run Validator.validateTransaction.
     *   3. On failure: show an inline error per failing field; return early.
     *   4. On success:
     *      a. Mutate state via State.addTransaction.
     *      b. Persist via StorageModule.save; show toast on save error.
     *      c. Reset the form (name, amount cleared; category reset to placeholder).
     *      d. Re-render UI and update pie chart.
     *
     * Requirements: 1.3, 1.4, 1.5, 1.6, 2.6, 3.2, 4.3, 5.1, 5.6
     *
     * @param {Event} event
     */
    function handleAddTransaction(event) {
      event.preventDefault();

      // ── 1. Clear previous inline errors ────────────────────────────────
      UIRenderer.clearInlineErrors();

      // ── 2. Collect form values ──────────────────────────────────────────
      const nameInput     = document.getElementById('item-name');
      const amountInput   = document.getElementById('amount');
      const categoryInput = document.getElementById('category');

      const formData = {
        name:     nameInput     ? nameInput.value     : '',
        amount:   amountInput   ? amountInput.value   : '',
        category: categoryInput ? categoryInput.value : ''
      };

      // ── 3. Validate ─────────────────────────────────────────────────────
      const validation = Validator.validateTransaction(formData);

      if (!validation.valid) {
        // Map validator field keys to HTML element IDs
        const fieldIdMap = {
          name:     'item-name',
          amount:   'amount',
          category: 'category'
        };

        for (const [field, message] of Object.entries(validation.errors)) {
          const htmlId = fieldIdMap[field] ?? field;
          UIRenderer.showInlineError(htmlId, message);
        }
        return; // Requirement 1.4: do NOT create a transaction
      }

      // ── 4a. Mutate state ─────────────────────────────────────────────────
      const newState = State.addTransaction({
        name:     formData.name.trim(),
        amount:   parseFloat(formData.amount),
        category: formData.category
      });

      // ── 4b. Persist ──────────────────────────────────────────────────────
      const saveResult = StorageModule.save(newState);
      if (!saveResult.ok) {
        if (saveResult.error === 'quota_exceeded') {
          // Requirement 5.6: keep in session memory, but warn the user
          UIRenderer.showToast(
            'Data could not be saved permanently (storage full).',
            'error'
          );
        } else {
          UIRenderer.showToast(
            'An unexpected error occurred while saving.',
            'error'
          );
        }
      }

      // ── 4c. Reset form (Requirement 1.6) ─────────────────────────────────
      if (nameInput)     nameInput.value     = '';
      if (amountInput)   amountInput.value   = '';
      if (categoryInput) categoryInput.value = '';

      // ── 4d. Re-render UI ─────────────────────────────────────────────────
      UIRenderer.render({ ...newState, selectedMonth: _selectedMonth });
      ChartModule.update(newState.transactions);
    }

    // ------------------------------------------------------------------
    // 9.3  handleDeleteTransaction
    // ------------------------------------------------------------------

    /**
     * Handles a delete request for the transaction with the given id.
     * Shows a confirmation prompt, removes from state, persists, and re-renders.
     *
     * Flow:
     *   1. Show window.confirm() — if cancelled, do nothing.
     *   2. Call State.deleteTransaction(id) to remove from in-memory state.
     *   3. Persist via StorageModule.save; show toast on save error.
     *   4. Re-render UI and update pie chart.
     *
     * Requirements: 2.4, 2.5, 2.6, 3.3, 4.3, 5.2
     *
     * @param {string} id
     */
    function handleDeleteTransaction(id) {
      // ── Requirement 2.4: confirmation prompt before proceeding ───────────
      const confirmed = window.confirm('Are you sure you want to delete this transaction?');
      if (!confirmed) return;

      // ── Requirement 2.5: remove from state ───────────────────────────────
      const newState = State.deleteTransaction(id);

      // ── Requirement 5.2: persist updated list ────────────────────────────
      const saveResult = StorageModule.save(newState);
      if (!saveResult.ok) {
        if (saveResult.error === 'quota_exceeded') {
          UIRenderer.showToast(
            'Data could not be saved permanently (storage full).',
            'error'
          );
        } else {
          UIRenderer.showToast(
            'An unexpected error occurred while saving.',
            'error'
          );
        }
      }

      // ── Requirements 2.6, 3.3, 4.3: re-render within timing targets ─────
      UIRenderer.render({ ...newState, selectedMonth: _selectedMonth });
      ChartModule.update(newState.transactions);
    }

    // ------------------------------------------------------------------
    // 9.4  handleAddCategory
    // ------------------------------------------------------------------

    /**
     * Handles the custom-category form submit event.
     *
     * Flow:
     *   1. Clear any existing inline errors on the category field.
     *   2. Read the new category name from the input.
     *   3. Run Validator.validateCategory against the full current category list
     *      (DEFAULT_CATEGORIES + custom) and the current custom category count.
     *   4. On failure: show an inline error; return early — do NOT add the category.
     *   5. On success:
     *      a. Mutate state via State.addCategory.
     *      b. Persist via StorageModule.save.
     *      c. If save fails (quota_exceeded or other): show inline error, roll
     *         back the state mutation (State.deleteCategory is not available, so
     *         we reload from storage to restore previous state), and do NOT
     *         update the dropdown — Requirement 6.5.
     *      d. If save succeeds: clear the input, call
     *         UIRenderer.renderCategoryDropdown with the updated custom categories.
     *
     * Requirements: 6.2, 6.3, 6.4, 6.5
     *
     * @param {Event} event
     */
    function handleAddCategory(event) {
      event.preventDefault();

      // ── 1. Clear previous inline errors for this field ────────────────────
      const categoryInput = document.getElementById('custom-category');
      const errorEl = document.getElementById('error-custom-category');
      if (errorEl) errorEl.textContent = '';
      if (categoryInput) {
        categoryInput.removeAttribute('aria-invalid');
        categoryInput.classList.remove('is-invalid');
      }

      // ── 2. Read the submitted name ────────────────────────────────────────
      const rawName = categoryInput ? categoryInput.value : '';
      const trimmedName = rawName.trim();

      // ── 3. Validate ───────────────────────────────────────────────────────
      const currentState = State.getAll();
      // Full list passed for duplicate check (defaults + custom)
      const allCategories = [...DEFAULT_CATEGORIES, ...currentState.categories];
      const customCount = currentState.categories.length;

      const validation = Validator.validateCategory(trimmedName, allCategories, customCount);

      if (!validation.valid) {
        // ── 4. Show inline error; do NOT add the category ─────────────────
        UIRenderer.showInlineError('custom-category', validation.errors.name);
        return;
      }

      // ── 5a. Mutate state ──────────────────────────────────────────────────
      const newState = State.addCategory(trimmedName);

      // ── 5b. Persist ───────────────────────────────────────────────────────
      const saveResult = StorageModule.save(newState);

      if (!saveResult.ok) {
        // ── 5c. Save failed — Requirement 6.5: do NOT add to dropdown ──────
        // Roll back by reloading the previous state from storage (or empty state
        // if storage is unavailable / empty).
        const reloaded = StorageModule.load();
        if (reloaded.ok) {
          State.load(reloaded.data);
        } else {
          // Storage is now unreadable — restore the pre-mutation snapshot
          State.load(currentState);
        }

        const message = saveResult.error === 'quota_exceeded'
          ? 'Category could not be saved permanently (storage full).'
          : 'An unexpected error occurred while saving the category.';

        UIRenderer.showInlineError('custom-category', message);
        return;
      }

      // ── 5d. Save succeeded — clear input and update dropdown ──────────────
      if (categoryInput) categoryInput.value = '';
      UIRenderer.renderCategoryDropdown(newState.categories);
    }

    // ------------------------------------------------------------------
    // 9.5  handleSortChange
    // ------------------------------------------------------------------

    /**
     * Handles the sort-select change event.
     *
     * Flow:
     *   1. Update the in-memory sort criterion via State.setSortCriterion.
     *   2. Persist the updated state via StorageModule.save; show a toast on
     *      save failure but still update the UI (sort works in-session).
     *   3. Re-render the transaction list in the new sorted order.
     *
     * Requirements: 8.1, 8.2, 8.4
     *
     * @param {'amount-asc'|'amount-desc'|'category-asc'|null} criterion
     */
    function handleSortChange(criterion) {
      // ── 1. Update state ───────────────────────────────────────────────
      const newState = State.setSortCriterion(criterion);

      // ── 2. Persist (Requirement 8.4) ──────────────────────────────────
      const saveResult = StorageModule.save(newState);
      if (!saveResult.ok) {
        if (saveResult.error === 'quota_exceeded') {
          UIRenderer.showToast(
            'Sort preference could not be saved permanently (storage full).',
            'error'
          );
        } else {
          UIRenderer.showToast(
            'An unexpected error occurred while saving.',
            'error'
          );
        }
      }

      // ── 3. Re-render transaction list (Requirements 8.1, 8.2) ─────────
      UIRenderer.renderTransactionList(newState.transactions, criterion);
    }

    // ------------------------------------------------------------------
    // 9.6  handleMonthChange — placeholder until task 9.6 is implemented
    // ------------------------------------------------------------------

    /**
     * Handles the month-select change event.
     * Updates the selected month in UI state and re-renders the monthly summary
     * panel to reflect the newly selected month (Requirement 7.3).
     *
     * @param {string} monthKey  — 'YYYY-MM'
     */
    function handleMonthChange(monthKey) {
      // ── 1. Update the tracked selected month ─────────────────────────
      _selectedMonth = monthKey;

      // ── 2. Re-render the monthly summary for the new month ───────────
      const { transactions } = State.getAll();
      UIRenderer.renderMonthlySummary(transactions, monthKey);
    }

    // ------------------------------------------------------------------
    // 9.1  init
    // ------------------------------------------------------------------

    /**
     * Bootstraps the application:
     *   1. Loads persisted state from LocalStorage.
     *   2. Derives the default selected month (current calendar month).
     *   3. Attaches all DOM event listeners.
     *   4. Performs the initial full render of the UI.
     *
     * Requirements: 5.3, 5.4, 7.2, 8.5
     */
    function init() {

      // ── 1. Restore persisted state ─────────────────────────────────────
      const loaded = StorageModule.load();

      if (loaded.ok) {
        // Requirement 5.3: populate state from LocalStorage on init
        State.load(loaded.data);
      } else if (loaded.error === 'corrupted') {
        // Requirement 5.5: discard corrupted data, render empty state, show toast
        UIRenderer.showToast('Saved data could not be loaded.', 'error');
        // State remains empty (default) — no State.load() call needed
      }
      // 'empty' → silently leave state empty (Requirement 5.4)

      // ── 2. Default selected month to current calendar month ────────────
      const now = new Date();
      _selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // ── 3. Attach DOM event listeners ──────────────────────────────────

      // 3a. Transaction form submission
      const txForm = document.getElementById('transaction-form');
      if (txForm) {
        txForm.addEventListener('submit', handleAddTransaction);
      }

      // 3b. Delete button clicks — event delegation on the transaction list
      const txList = document.getElementById('transaction-list');
      if (txList) {
        txList.addEventListener('click', (event) => {
          const btn = event.target.closest('button[data-id]');
          if (btn) {
            handleDeleteTransaction(btn.dataset.id);
          }
        });
      }

      // 3c. Custom category form submission
      const catForm = document.getElementById('add-category-form');
      if (catForm) {
        catForm.addEventListener('submit', handleAddCategory);
      }

      // 3d. Sort control change
      const sortSelect = document.getElementById('sort-select');
      if (sortSelect) {
        sortSelect.addEventListener('change', (event) => {
          handleSortChange(event.target.value || null);
        });
      }

      // 3e. Month selector change
      const monthSelect = document.getElementById('month-select');
      if (monthSelect) {
        monthSelect.addEventListener('change', (event) => {
          handleMonthChange(event.target.value);
        });
      }

      // ── 4. Initial render ──────────────────────────────────────────────
      const state = State.getAll();

      // Requirement 8.5: if a sort criterion was restored, reflect it in the UI
      if (state.sortCriterion && sortSelect) {
        sortSelect.value = state.sortCriterion;
      }

      UIRenderer.render({ ...state, selectedMonth: _selectedMonth });
      ChartModule.update(state.transactions);
    }

    return {
      init,
      handleAddTransaction,
      handleDeleteTransaction,
      handleAddCategory,
      handleSortChange,
      handleMonthChange
    };
  })();

  // =============================================================
  // 10. Global Error Handler
  // =============================================================

  /**
   * Catches unhandled exceptions and displays a generic toast notification
   * so the user is aware something went wrong rather than experiencing a
   * silent broken state (Design: Error Handling — Unexpected Runtime Errors).
   *
   * Returns `false` so the browser still logs the error to the console.
   *
   * @param {string}      message   — error message
   * @param {string}      source    — script URL
   * @param {number}      lineno    — line number
   * @param {number}      colno     — column number
   * @param {Error|null}  error     — Error object (may be null in older browsers)
   * @returns {false}
   */
  window.onerror = function (message, source, lineno, colno, error) {
    UIRenderer.showToast('An unexpected error occurred.', 'error');
    return false; // allow normal browser console reporting
  };

  // ── Bootstrap ──────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    AppController.init();
  });
})();

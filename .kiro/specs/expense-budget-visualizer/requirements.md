# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses and visualize their spending distribution. Built entirely with HTML, CSS, and Vanilla JavaScript, it stores all data in the browser's Local Storage and requires no backend server. Users can add transactions with a name, amount, and category; view a running total balance; delete past entries; and see a live pie chart breaking down spending by category. Additional capabilities include custom categories, a monthly summary view, and sorting controls.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category.
- **Category**: A label that classifies a transaction (e.g., Food, Transport, Fun, or a user-defined custom category).
- **Total_Balance**: The running sum of all transaction amounts currently stored.
- **Pie_Chart**: A circular chart rendered by Chart.js that shows the proportional spending per category.
- **Transaction_List**: The scrollable UI panel that displays all saved transactions.
- **Local_Storage**: The browser's built-in key-value persistence API used to store all application data client-side.
- **Monthly_Summary**: An aggregated view of transactions grouped and totalled by calendar month.
- **Input_Form**: The UI form through which users enter new transaction details.
- **Validator**: The client-side logic component that checks Input_Form field values before submission.
- **Sort_Control**: The UI control that reorders the Transaction_List by a chosen criterion.

## Requirements

### Requirement 1: Transaction Entry via Input Form

**User Story:** As a user, I want to enter an expense with a name, amount, and category so that I can record my spending.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for Item Name accepting up to 100 characters, a numeric field for Amount, and a dropdown for Category.
2. THE Input_Form SHALL populate the Category dropdown with at least the following default options: Food, Transport, and Fun.
3. WHEN a user submits the Input_Form, THE Validator SHALL verify that the Item Name field is non-empty and not whitespace-only, the Amount field contains a numeric value greater than 0.00 and no greater than 999,999,999.99 with up to two decimal places, and a Category is selected.
4. IF the Validator detects that any required field is empty, whitespace-only, or invalid, THEN THE App SHALL display an inline error message identifying which field failed validation and SHALL NOT create a Transaction.
5. WHEN the Validator confirms all fields are valid, THE App SHALL create a Transaction and add it to the Transaction_List.
6. WHEN a Transaction is successfully added, THE Input_Form SHALL reset the Item Name and Amount fields to empty and reset the Category dropdown to its unselected state.

### Requirement 2: Transaction List Display and Deletion

**User Story:** As a user, I want to see all my recorded transactions and remove any entry so that I can manage my expense history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display every stored Transaction, showing the item name, amount formatted to two decimal places with a currency symbol, and category for each entry.
2. WHILE the total height of Transaction entries exceeds the fixed height of the Transaction_List container, THE App SHALL render the Transaction_List as a scrollable panel without truncating any entry.
3. WHEN the Transaction_List contains zero Transactions, THE App SHALL display an informational message (e.g., "No transactions yet") in place of Transaction entries.
4. WHEN a user activates the delete control on a Transaction, THE App SHALL display a confirmation prompt before proceeding with deletion.
5. WHEN the user confirms deletion, THE App SHALL remove that Transaction from both the Transaction_List display and from Local_Storage.
6. WHEN a Transaction is deleted, THE App SHALL update the Total_Balance and the Pie_Chart within 300 milliseconds without requiring a page reload.

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my current total balance at the top of the page so that I always know my overall spending at a glance.

#### Acceptance Criteria

1. THE App SHALL display the Total_Balance prominently at the top of the page at all times, where "top of the page" means above all Transaction list items and input controls.
2. WHEN a Transaction is added, THE App SHALL recalculate and re-render the Total_Balance within 100 milliseconds of the addition being confirmed.
3. WHEN a Transaction is deleted, THE App SHALL recalculate and re-render the Total_Balance within 100 milliseconds of the deletion being confirmed.
4. THE App SHALL format the Total_Balance value as a numeric currency string with exactly two decimal places and a currency symbol prefix (e.g., "$1,234.56"), supporting values in the range of -999,999,999.99 to 999,999,999.99.
5. IF the Total_Balance cannot be calculated due to invalid or missing Transaction data, THEN THE App SHALL display "0.00" as the Total_Balance with the currency symbol prefix.

### Requirement 4: Spending Distribution Pie Chart

**User Story:** As a user, I want a visual pie chart of my spending by category so that I can understand where my money goes at a glance.

#### Acceptance Criteria

1. THE App SHALL render a Pie_Chart using Chart.js that displays one segment per Category that has at least one expense-type Transaction in the current Transaction_List, excluding income-type Transactions from the calculation.
2. THE Pie_Chart SHALL represent each segment's size proportionally to the sum of expense amounts belonging to that Category, expressed as a percentage of total expenses across all Categories.
3. WHEN a Transaction is added or deleted, THE App SHALL update the Pie_Chart within 500 milliseconds without requiring a page reload.
4. WHEN the Transaction_List contains zero expense-type Transactions, THE App SHALL display a placeholder message indicating no spending data is available, in place of the Pie_Chart segments.
5. THE Pie_Chart SHALL display a legend that identifies each Category name alongside its total expense amount, AND SHALL display a tooltip on each segment showing the Category name, total expense amount, and percentage of total expenses when the user hovers over that segment.

### Requirement 5: Local Storage Persistence

**User Story:** As a user, I want my transactions to persist across browser sessions so that I do not lose my data when I close and reopen the browser.

#### Acceptance Criteria

1. WHEN a Transaction is created, THE App SHALL serialize and save all current Transactions to Local_Storage.
2. WHEN a Transaction is deleted, THE App SHALL serialize and save the updated Transaction list to Local_Storage.
3. WHEN the App initializes, THE App SHALL read all Transactions from Local_Storage and populate the Transaction_List, Total_Balance, and Pie_Chart with the restored data.
4. IF Local_Storage is empty on initialization, THEN THE App SHALL render an empty Transaction_List with the informational empty-state message, a Total_Balance of $0.00, and a Pie_Chart placeholder message.
5. IF the data in Local_Storage is corrupted or cannot be deserialized on initialization, THEN THE App SHALL discard the corrupted data, render an empty state, and display an error message informing the user that saved data could not be loaded.
6. IF a save operation to Local_Storage fails due to storage quota being exceeded, THEN THE App SHALL retain the Transaction in the current session display but display an error message indicating that the data could not be saved permanently.

### Requirement 6: Custom Categories

**User Story:** As a user, I want to add my own expense categories so that I can track spending in areas beyond the default options.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text input field for the user to define a new custom Category name, accepting between 1 and 50 characters.
2. WHEN a user submits a new custom Category name, THE Validator SHALL verify that the name is between 1 and 50 characters and does not duplicate an existing Category name (case-insensitive), and that the total number of custom Categories does not exceed 20.
3. IF the Validator detects an empty Category name, THEN THE App SHALL display an inline error message indicating that the Category name cannot be empty and SHALL NOT add the Category. IF the Validator detects a duplicate Category name, THEN THE App SHALL display an inline error message indicating that the Category name already exists and SHALL NOT add the Category. IF the Validator detects that the custom Category limit has been reached, THEN THE App SHALL display an inline error message indicating that the maximum number of custom Categories has been reached and SHALL NOT add the Category.
4. WHEN a valid custom Category is confirmed, THE App SHALL add the new Category to the Category dropdown and persist the updated Category list to Local_Storage.
5. IF Local_Storage is unavailable or returns an error when saving the Category list, THEN THE App SHALL display an inline error message indicating that the Category could not be saved and SHALL NOT add the Category to the dropdown.
6. WHEN the App initializes, THE App SHALL restore all previously saved custom Categories from Local_Storage and include them in the Category dropdown, ignoring any entries that are not valid Category names (between 1 and 50 characters).

### Requirement 7: Monthly Summary View

**User Story:** As a user, I want to view a summary of my spending grouped by month so that I can track my budget trends over time.

#### Acceptance Criteria

1. THE App SHALL provide a Monthly_Summary view that groups Transactions by calendar month and year (e.g., November 2026).
2. WHEN a user opens the Monthly_Summary view, THE App SHALL display the current calendar month as the default selected month, showing the total expense amount and a per-Category breakdown of expense amounts for that month.
3. WHEN the user selects a different month in the Monthly_Summary view, THE App SHALL update the displayed total expense amount and per-Category breakdown to reflect the selected month within 500 milliseconds.
4. IF no Transactions exist for the selected month, THEN THE App SHALL display a total expense amount of zero and a per-Category breakdown showing zero for each Category that has Transactions in any other month.

### Requirement 8: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by amount or category so that I can find and analyze entries more easily.

#### Acceptance Criteria

1. THE App SHALL provide a Sort_Control that allows the user to sort the Transaction_List by Amount in ascending order, by Amount in descending order, or by Category in alphabetical (A–Z) order; when no saved sort criterion exists, the Sort_Control SHALL default to no active sort and the Transaction_List SHALL be displayed in the order entries were added.
2. WHEN the user selects a sort option via the Sort_Control, THE App SHALL reorder the Transaction_List display to match the chosen sort criterion within 100 milliseconds.
3. WHEN new Transactions are added while a sort option is active, THE App SHALL insert the new Transaction into the correct sorted position in the Transaction_List; if two Transactions share the same Amount or Category value, THE App SHALL place the more recently added Transaction after the earlier one.
4. WHEN the user selects a sort option via the Sort_Control, THE App SHALL save the selected sort criterion to Local_Storage so that it is restored on the next page load.
5. WHEN the page loads and a sort criterion is present in Local_Storage, THE App SHALL apply that sort criterion to the Transaction_List and reflect it as the active selection in the Sort_Control.

### Requirement 9: Browser Compatibility and Single-File Structure

**User Story:** As a user, I want the app to work reliably in any modern browser so that I can access it regardless of my browser choice.

#### Acceptance Criteria

1. THE App SHALL function correctly in the current stable releases of Chrome, Firefox, Edge, and Safari without requiring browser-specific workarounds in the HTML or JavaScript.
2. THE App SHALL load all styling from exactly one CSS file located in the `css/` directory.
3. THE App SHALL load all application logic from exactly one JavaScript file located in the `js/` directory.
4. WHEN the App page is loaded on a connection of 25 Mbps or greater, THE App SHALL initialize and become interactive within 3 seconds including time to load Chart.js from a CDN.
5. IF Chart.js or any other CDN-hosted resource fails to load, THEN THE App SHALL display an error message informing the user that a required resource could not be loaded and SHALL prevent the affected feature from silently breaking.

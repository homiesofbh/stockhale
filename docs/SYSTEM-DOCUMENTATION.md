# Stockwell system documentation

This document describes the behavior implemented in the repository as of 9 October 2026. It is the operational reference for the current application. It distinguishes implemented behavior from known limits; older planning notes in `docs/Feature Audit and Priorities.md` are not an implementation guarantee.

## 1. What Stockwell is

Stockwell is a multi-user retail inventory, billing, purchasing, and financial-control workspace. Each workspace contains one business store and its records. The application supports authenticated online use and an offline browser cache with a queued synchronization path.

The application is organized into these modules:

| Module | Purpose |
| --- | --- |
| Dashboard | Business snapshot, quick product actions, recent trading activity, stock and financial indicators |
| Inventory | Products, categories, units, stock levels, adjustments, and movement history |
| Purchases | Supplier purchases, incoming stock, supplier balances, and purchase history |
| Billing | Customer or walk-in invoices, payments, stock deduction, invoice history, and invoice output |
| Sales | Posted sales history and sales-period analysis |
| Accounts Heads | Account hierarchy, account heads, journals, partner entries, and account activity |
| Expenses | Operating expenses, expense categories, payment accounts, and evidence attachments |
| Payments | Customer collections, supplier settlements, cheques, bank/wallet balances, and bank vouchers |
| Suppliers | Supplier profiles, purchases, payments, and payable balances |
| Customers | Customer profiles, bills, payments, and receivable balances |
| Returns & Damage | Sales returns, purchase returns, damaged stock, credits, and stock movements |
| Reports | Filtered operational reports, ledgers, cash flow, balances, and daily closing |
| Settings | Workspace, team permissions, account setup, backups, and synchronization controls |
| Notifications | Activity and administrator notifications |

All money is represented in PKR and rounded to two decimal places. Quantities support up to three decimal places. Business dates use the `Asia/Karachi` timezone.

## 2. Access, authentication, and workspaces

### Sign-up and sign-in

1. A new owner creates an account at `/sign-up` and supplies a name, email, password, and workspace name.
2. The workspace, owner membership, and empty store are created together.
3. Existing users sign in at `/sign-in` with email and password.
4. An invited team member uses `/team-sign-up` with the invitation token and the invited email address. The invitation determines the initial module permissions.
5. Public signup can be disabled with `DISABLE_PUBLIC_SIGNUP=true`. Invited team signup remains available when an invitation is valid.

Authentication is handled by Better Auth inside the workspace API. Sessions are server-side authenticated; the database URL and auth secret are never exposed through `NEXT_PUBLIC_*` variables.

### Roles and authority

There are two effective roles:

- **Owner**: workspace administrator. The owner has access to all modules, controls team membership and module assignments, creates or changes account heads and payment accounts, reviews late offline expenses, performs posted-bill corrections, reversals, restores, cheque lifecycle actions, and daily close/reopen actions.
- **Member**: receives only the modules assigned by the owner. A member can use existing account heads and payment accounts in permitted modules but cannot modify the chart of accounts or payment-account definitions.

Module access is checked in the UI and again by server-side operation validation. A user without any assigned module sees an access message rather than a usable workspace.

## 3. The workspace data model

The business store is a versioned JSON-shaped record stored in PostgreSQL. Important collections are:

- `products`: product identity, SKU, barcode, category, cost, selling price, low-stock threshold, optional maximum, color, GSM, packing, store, size, unit, supplier links, and active status.
- `categories` and `units`: selectable product metadata. The default units include piece, kg, g, liter, ml, box, pack, dozen, meter, and yard.
- `customers` and `suppliers`: contact profiles with name, phone, email, address, company, contact person, mobile, tax identifiers, description, and optional opening balance.
- `invoices` and `purchases`: sale and purchase trades. Trades contain lines, discounts, tax, payment information, account head, contact, references, status, and optional attachments.
- `movements`: append-only stock movements. Current stock is the sum of movement quantities for a product.
- `payments`: payments linked to a specific invoice or purchase. Payments include method, account, amount, contact, head, notes, and optional cheque details.
- `expenses`: dated operating costs with category, head, amount, method, notes, and optional attachments.
- `returns`: item-level sale returns, purchase returns, and damaged-stock records.
- `accounts`, `journals`, and `bankVouchers`: structured accounting records and posted ledger entries.
- `financialAccounts`: named bank and wallet accounts, optionally linked to chart-of-account asset ledgers.
- `chequeEvents`, `corrections`, `walkInLinks`, and `dailyCloses`: immutable or append-only control history.
- `partners` and `crossCheques`: partner capital/withdrawal entries and cross-cheque records supported by the data model.

Records are not deleted during normal operation. Posted transactions are corrected through controlled corrections or reversals so the audit trail remains understandable.

## 4. Dashboard

The dashboard is a read-only summary built from the workspace records. It can show:

- sales, purchases, expenses, profit, and billing activity for the selected dashboard period;
- inventory value, low-stock item count, and current stock;
- receivables and payables;
- cash and bank/wallet positions;
- recent invoices, purchases, and sales;
- quick product selection and navigation to inventory or billing.

The dashboard respects module permissions. For example, inventory or billing cards/actions are not shown as usable actions when the user cannot access those modules.

## 5. Inventory

### Product setup

Create or edit a product with a name, SKU/item code, optional barcode, category, unit, cost, selling price, low-stock threshold, and optional descriptive textile or storage fields. SKU and barcode uniqueness are validated. Barcode entry is optional; manual product selection and SKU entry remain supported.

Products may have a maximum-stock threshold, color, GSM, packing, store, size, and supplier associations. An inactive product remains in historical records but should not be selected for new operational entries.

### Stock calculation

Stock is not stored as an independently editable balance. It is derived by summing the product's append-only movement history. This makes each stock change traceable.

- Positive movement quantity increases stock.
- Negative movement quantity decreases stock.
- Bills and returns create their own movement records.
- Stock cannot become negative; the server validates the resulting movement set.
- A posted purchase also updates the product's current cost using the weighted cost of the purchase lines.

Inventory value is current stock multiplied by current product cost. It is a current snapshot, not a historical valuation report.

### Manual adjustments

Use the adjustment action for opening stock, stock in, or stock out. Every adjustment needs a product, quantity, date, type, and reason. The reason is retained in the movement history. A closed date must be reopened by the owner before a new movement can be entered.

### Movement history

Movement history shows the product, quantity, date, type, reference, reason, and related supplier/package information where available. It is the source used to explain the current stock figure.

### Barcode scanning

Billing and purchasing have a scanner input intended for USB/Bluetooth keyboard-wedge scanners configured to send Enter. A scanned value matches the product barcode or SKU. Repeated scans increase the existing line quantity. Camera scanning is not implemented.

## 6. Purchases

1. Select or create a supplier.
2. Add one or more products, quantities, units, and cost prices.
3. Enter the purchase date, discount, tax, account head, payment method, and amount paid.
4. Optionally record a reference, cheque details, and a supplier bill-copy attachment.
5. Save as a draft or post the purchase.

A draft has no stock, payable, payment, or profit effect. Posting validates the lines and date, creates incoming stock movements, updates the product cost, and records the initial payment if present.

Credit purchases are created by posting with zero or partial payment. The unpaid portion becomes payable to the supplier and can later be settled from Payments. Purchase history supports search, status, payment filters, dates, and supplier details.

Posted purchases with linked payments, cheques, or returns cannot be silently rewritten. The owner must use a permitted correction or reversal workflow.

## 7. Billing and invoices

1. Select a customer, or choose walk-in billing.
2. For a walk-in, enter the available name, company, phone, and address details.
3. Add products manually or by barcode/SKU scan.
4. Set quantities, selling prices, line discounts, invoice discount, tax, payment method, account, and amount paid.
5. Save as a draft or post the invoice.

Posting creates the numbered invoice, deducts stock once, records the initial payment, and makes the balance available for later collection. Drafts do not affect stock or balances. Sales view uses posted invoices, so a draft does not appear as a sale.

### Walk-in customers

Every new walk-in bill creates or links a customer record. Matching uses a normalized phone number; names alone never merge customers. Anonymous walk-ins receive bill-specific customer records. Existing historical walk-ins without a customer link appear in Billing's review area. The owner can link them one at a time with a reason; bill amounts, stock, and payments remain unchanged.

### Invoice totals and balances

The calculation is:

`total = (line quantity × line price − line discounts − invoice discount) × (1 + tax percentage / 100)`

The outstanding balance is:

`total − returns/credits − settled payments`

A negative balance represents credit owed back to the customer. Cheques count as settled only after clearance.

### Invoice output

The saved invoice can be previewed, printed through the browser, or downloaded as a vector PDF. Output options include A4, 80 mm, and 58 mm widths. Long invoices paginate and repeat their table header. Receipt PDFs crop unused page length. Direct PDF generation preserves selectable text and embeds a local font when supported non-Latin characters require it. Browser Print/Save PDF is the fallback for unsupported characters.

Physical printer behavior depends on the installed printer driver, paper width, margins, and printer settings. Silent printing, ESC/POS commands, and cash-drawer control are not implemented.

## 8. Sales

Sales is the posted-sales history and analysis view over billing records. It provides period tabs and custom ranges, product/customer detail, quantities, revenue, and profit information.

Profit is based on the cost captured on each sales line. Revenue excludes sales tax and is reduced by discounts and returns. Expenses and damaged-stock cost reduce the overall profit calculation. The Sales view does not deduct stock a second time; billing posting owns the stock deduction.

## 9. Customers and suppliers

Customer and supplier pages provide searchable profiles, transaction history, payment history, and current balances.

- A customer balance is the sum of posted invoice balances plus the customer opening balance.
- A supplier balance is the sum of posted purchase balances plus the supplier opening balance.
- A negative trade balance means credit/refund due in the opposite direction.
- Contact edits preserve the identity used by historical records.

The contact detail view can open the related invoices or purchases and payments. Walk-in identity is stored on the invoice even when a customer profile is later linked.

## 10. Payments and settlements

Payments are always linked to a customer invoice or supplier purchase. Supported payment methods include cash, bank, cheque, and the configured wallets/accounts such as JazzCash, EasyPaisa, and NayaPay.

Use Payments to:

- collect a customer receivable;
- settle a supplier payable;
- record partial payments;
- select the receiving or paying bank/wallet account;
- review pending balances and payment history;
- inspect bank and wallet statements;
- manage the cheque register and bank vouchers.

Payment records are protected from deletion or arbitrary editing. Corrections use the relevant return, refund, cheque lifecycle, journal, or bank-voucher control.

### Cheques

Record cheque number, bank, receipt/issue date, expected clearance date, amount, and linked bill. An expected date never clears a cheque automatically.

- **Pending**: does not reduce the bill balance as settled.
- **Cleared**: requires an action date, settlement bank/wallet, and reason; the amount then reduces the bill balance.
- **Bounced**: reverses a previously cleared amount on the bounce date while retaining the original clearance history.
- **Cancelled**: applies to a pending cheque and leaves the bill balance due.

Partial clearance leaves the remainder due. The action date cannot be before the receipt date, after today, or inside a closed period. Every status change is retained in cheque event history.

### Bank and wallet accounts

Settings supports multiple named bank/wallet accounts. An account can be linked to an Asset ledger account. Statements show opening balance, movements, and closing balance through a selected date. Disabled accounts remain available for historical references but cannot be selected for new activity.

### Bank vouchers

Bank vouchers support receipts, payments, and transfers. Draft vouchers can be edited and posted. Posted vouchers are locked. The owner can post one exact reversal with a reason and date; the original voucher remains visible.

## 11. Accounts Heads and accounting

The workspace starts with standard heads such as Sales, Purchases, Expenses, Cash, Bank, Receivables, Payables, payments, discounts, returns, and other income/expenses. The owner can add custom account heads and structured accounts.

Accounts have:

- code and name;
- type: Asset, Liability, Equity, Income, Expense, or Unclassified;
- debit/credit nature;
- optional parent account;
- opening balance and opening date;
- description.

Child account codes must begin with the parent code. Account names and codes are unique. Once an account is used by a posted voucher, its historical identity and key classification/opening controls are locked.

### Journals

Journal vouchers are created as balanced debit/credit entries. Draft journals can be edited and posted. Posted journals are immutable. The owner can reverse a posted journal once; the reversal swaps each debit and credit line, preserves the original, and records the reason.

### Account selection versus account editing

Members with module access may select existing heads/accounts while entering transactions. Only the owner may create or modify heads, structured accounts, and payment-account definitions. This prevents a transaction user from changing the meaning of historical financial records.

## 12. Expenses

Create an expense with category, account head, amount, date, payment method/account, notes, and optional evidence attachment. Expense categories can be maintained from the Expenses workflow when authorized.

### Date policy

- Owners may enter any non-future business date.
- Members may enter today or either of the previous two calendar days.
- Future dates are rejected.
- A closed date is rejected for all users until the owner reopens the closing.
- Recorded expenses are locked; corrections use an audited journal or voucher process.

When a member creates an expense offline and synchronization happens after the allowed window, the pending change remains on the device and requires owner review. It is not silently discarded.

### Attachments

Expenses support PDF, JPG, PNG, and WEBP evidence up to 5 MB per file. Files are uploaded to the configured S3-compatible private bucket through short-lived signed URLs. Authorized users can open attachments; only the owner can delete them. Attachment metadata is included in business-record backups, but the workbook/JSON backup is not itself the binary object storage backup.

## 13. Returns and damaged stock

Returns are recorded against an original posted sale or purchase. Damaged stock is recorded as its own loss event.

- Quantity cannot exceed the remaining quantity on the source line.
- A sales return increases stock and creates customer credit.
- A purchase return decreases stock and reduces the supplier payable or creates supplier credit.
- Damaged stock changes stock and reduces profit by the relevant cost.
- Every return requires a reason and produces a movement and financial effect.

Return limits, stock availability, and balances are validated on the server before synchronization is accepted.

## 14. Reports

Reports use the same record selectors and calculation functions as the operational views, so filters are consistent. Available report families include:

- billing/invoice history;
- sales and date-wise transactions;
- purchases;
- inventory snapshot;
- stock movement history;
- expenses;
- customer ledger;
- supplier ledger;
- receivables and payables;
- account-head/account activity;
- profit summary;
- cash-in-hand;
- bank and wallet balances;
- cash flow;
- unposted bills.

Reports support search, status/payment filters, contact selection, date ranges, CSV download, and browser printing where applicable. Inventory reports are current snapshots unless the report specifically uses movement dates. Historical financial reports account for dated corrections through the correction history.

### Cash and bank reporting

Cash-in-hand uses the Cash asset account's opening balance and dated financial rows. Bank statements use each linked financial account and its ledger opening balance. Cash flow separates external receipts/payments from internal transfers so moving money between cash, bank, and wallets does not inflate operating cash flow.

## 15. Daily closing

Reports contains Daily Closing and Reconciliation:

1. Select a past or current business date.
2. Review expected cash, period receipts/payments, sales, purchases, expenses, and bank balances.
3. Enter counted cash.
4. If counted cash differs from expected cash, enter an explanation.
5. The owner confirms the close.

The saved close retains expected cash, counted cash, variance, explanation, summary, actor, and timestamp. A closed date blocks new stock and financial entries on or before that date. Only the owner can reopen it, later closings must be reopened first, and the reason is retained. Reopening does not erase the original closing figures.

## 16. Settings, team, and notifications

Settings is owner-controlled and includes:

- workspace identity and owner settings;
- team member invitations and module permissions;
- account heads, structured accounts, payment accounts, categories, and units;
- email/outbox status where configured;
- offline synchronization and pending-change controls;
- Excel and JSON business-record backups;
- recovery/restore tools.

Notifications shows workspace activity and unread/read state. The server stores audit events with actor, module, action, record identifiers, occurred time, received time, and email status. The regular owner snapshot displays the most recent 300 audit events; a full recovery backup fetches the complete audit history.

## 17. Offline use and synchronization

The browser keeps a local workspace cache and pending changes. The service worker provides production offline asset handling; development unregisters the intercepting worker and cleans old caches.

When a change is made offline:

1. The UI applies the operation to the local cache.
2. The change is stored in a durable pending queue with actor and creation time.
3. When connectivity returns, the client submits the change with the base revision and operation context.
4. The server validates permissions, dates, invariants, stock, balances, immutable history, and revision compatibility inside a transaction.
5. A successful change advances the workspace revision and writes an audit event.
6. A conflict or policy rejection leaves the pending change available for review/export; it is not silently overwritten.

The workspace row is locked during accepted mutations. Stale writes return a conflict instead of overwriting newer records. Background polling is limited while tabs are hidden; visible workspaces poll roughly every 15 seconds.

## 18. Backups and restore

Owners can export business data from Settings. The Excel workbook contains readable sheets for collections, invoice/purchase lines, team details, audit history, pending changes, and a lossless JSON recovery snapshot split across ordered cells on the Backup snapshot sheet. JSON recovery backups contain the store, full audit history, workspace identity, revision, and a SHA-256 checksum.

Restore behavior:

1. Select a JSON or Excel recovery file for the same workspace.
2. The file is checked for format, workspace ID, collection validity, stock non-negativity, attachment metadata, audit validity, and checksum.
3. A preview is shown before replacement.
4. The owner confirms the exact workspace name and supplies a reason.
5. A recovery point of the current business records is saved before replacement.
6. The restore is applied only if the revision has not changed since review.

Restore does not restore passwords, sessions, or team permissions. It is a business-record recovery mechanism, not a PostgreSQL or authentication disaster-recovery image. The restore file limit is 45 MB. Uploaded attachment binaries require the object-storage system to remain available.

## 19. Email and invitations

The application can use Resend when `RESEND_API_KEY` and `RESEND_FROM` are configured. Invitation and notification email work is stored durably in PostgreSQL. Record changes are sent as a daily digest at 11:58 PM in the workspace time zone selected by the owner. The Cloudflare Worker checks every minute and sends due digests even when no user is active; authenticated API activity also drains due messages. Plan renewal reminders retain immediate delivery.

## 20. API and deployment architecture

- `app/page.tsx` is the workspace entry point.
- `components/stockwell/workspace-app.tsx` coordinates navigation, state, forms, filtering, and selected views.
- `components/stockwell/views/` contains module views.
- `components/stockwell/forms/` contains data-entry forms.
- `lib/stockwell/model.ts` contains data types and core totals/balance helpers.
- `lib/stockwell/operations.ts` contains posting, payments, returns, corrections, cheques, cash flow, closing, and reversal behavior.
- `lib/stockwell/operation-validation.ts` replays and validates client changes on the server.
- `lib/stockwell/server.ts` handles authenticated snapshots, mutations, revisions, audit records, invitations, email work, and recovery operations.
- `app/api/workspace/route.ts` exposes authenticated GET/POST workspace operations.
- `app/api/attachments/route.ts` provides signed upload/download and owner-only deletion for attachments.
- `app/sw.js/route.ts` serves the production service worker.

The application runs on Next.js with Webpack, React, Better Auth, Kysely, PostgreSQL, and Neon-compatible storage. Production should use a pooled Neon connection string, stable `BETTER_AUTH_SECRET`, an exact production `BETTER_AUTH_URL`, and explicit migrations. Migrations never run during a build or sign-in.

## 21. Verification and test coverage

The repository provides:

```text
pnpm typecheck       TypeScript validation
pnpm test            Unit/behavior tests
pnpm test:integration Database-backed workspace tests
pnpm build           Production Webpack build
```

Tests cover journals, accounts, permissions, backup/recovery, service-worker behavior, barcode/product selectors, retail totals, stock, payments, returns, invoice PDF widths and pagination, Unicode invoice output, and workspace synchronization/conflict behavior.

## 22. Current boundaries

The following are outside the implemented scope or depend on external verification:

- camera barcode scanning;
- silent automatic printing, ESC/POS, and cash-drawer control;
- physical printer compatibility without testing the actual hardware;
- marketplace roles, chat, disputes, shipping, ranks, and challenges;
- payroll, attendance-machine import, salary generation, and employee advances;
- manufacturing workflows unless separately added;
- full PostgreSQL/authentication disaster recovery through the business-record backup;
- binary attachment restoration from the workbook alone.

For future changes, update this document alongside the relevant source module and tests. When behavior is uncertain, treat the source validation path and integration tests as authoritative over screenshots or proposal documents.

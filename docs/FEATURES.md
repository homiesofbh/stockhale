# Stockwell implementation scope

Source: Abdul Muqeet v1.pdf. Its listed functionality is the scope reference; commercial terms and document instructions are not application features.

## Included

| Proposal module         | Implemented behavior                                                                                                                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory               | Product creation/editing, categories, unique SKU/item codes and barcodes, pricing, current stock, stock-in/out adjustments with reasons, low-stock thresholds, movement history, search and category/stock filters.                                                                             |
| Purchases               | Supplier selection, multiple purchased items, quantities, cost prices, purchase dates/history, account head, discounts/tax, payment status, automatic stock-in.                                                                                                                                 |
| Billing                 | Numbered multi-product invoices, customer or walk-in billing, quantities/prices, discounts/tax, totals, cash/credit/partial payment tracking, paid/unpaid filtering, invoice search/history, automatic stock deduction, direct compressed vector-PDF download plus browser printing / Save PDF. |
| Sales                   | Bills create sales once, product-level quantities/prices/allocated discounts, sales history, day/week/month and custom date ranges, automatic stock deduction.                                                                                                                                  |
| Accounts Heads          | All 13 example heads from the proposal, adding custom heads, assigning heads to financial records, transaction history and account-head report.                                                                                                                                                 |
| Expenses                | Expense categories, account heads, amount/date, cash/bank method, notes, history/search/date filters.                                                                                                                                                                                           |
| Payments                | Customer collections, supplier payments, cash/bank, partial settlements, pending balances, receivables/payables, payment history including initial payments, return-credit settlements.                                                                                                         |
| Suppliers               | Editable profiles/contact details, purchase history, payment history, outstanding balances, supplier-specific transactions/ledger.                                                                                                                                                              |
| Customers               | Editable profiles/contact details, bill/sales history, payment history, outstanding balances and customer ledger.                                                                                                                                                                               |
| Returns & damaged stock | Sales/purchase returns against original records, quantity limits, damage entries, reasons, stock adjustment, proportional return credits and financial impact.                                                                                                                                  |
| Dashboard               | Total sales/purchases, inventory value, low stock, today's billing, recent invoices/purchases/sales, expenses, cash/bank position, receivables/payables and profit.                                                                                                                             |
| Reports                 | Billing, sales, purchase, inventory, stock movement, expense, customer ledger, supplier ledger, receivables, payables, accounts head, profit summary and date-wise transactions; filtered CSV downloads.                                                                                        |

## Requested additions

1. Standard-printer invoice output (A4) and receipt-printer output (80 mm / 58 mm), using installed operating-system printer drivers and browser printing. The browser also provides Save as PDF. Direct Download PDF uses lossless compression, selectable vector text, and exact A4 / 80 mm / 58 mm widths. Receipt PDFs trim unused page length. Long invoices repeat their table header across pages. Receipt printer paper/driver settings must match the selected layout; physical printer output requires hardware verification. Automatic silent printing, ESC/POS commands and cash-drawer control are not included.
2. Barcode scanner input in billing/purchases and barcode assignment in product records. Supports USB/Bluetooth keyboard-wedge scanners, configured to send Enter. Codes match an assigned barcode or SKU; repeated scans increment quantity. Camera scanning is not included.

## Data and calculation behavior

- Records persist in a PostgreSQL-backed workspace with Better Auth sessions with authenticated accounts and owner-controlled module authority. Browser caches and a durable pending queue support offline use. See [workspace setup and sync behavior](WORKSPACE.md) for deployment, permissions, Resend configuration, and conflict handling.
- Start with an empty workspace. No fictional transactions are seeded in the user's workspace.
- Stock is derived from an append-only movement history. Bills never deduct stock twice through the sales view.
- Sales profit uses the cost stored on each sales line. Revenue excludes sales tax and is reduced by discounts/returns. Expenses and damaged-stock cost reduce profit.
- Purchases update current product cost to the weighted line price within that purchase. Inventory value uses current stock times current cost.
- A return adjusts the original transaction balance. A negative balance represents credit to refund or receive back; payment entry can settle it.
- Contact ledgers calculate running balances using transactions preceding the selected reporting start date. Inventory reports are current snapshots.
- Historical transaction dates may be entered; stock validation checks current available stock, not a reconstructed historical stock balance.
- No marketplace roles, chat, disputes, ranks, challenges, shipping workflow or unrelated modules remain in the app.

## Verification

`npm test` additionally verifies compressed vector PDF output, exact receipt widths, receipt cropping, long invoice pagination, long product names, and Unicode font handling. It exercises stock, totals, partial payments, return limits, refunds, supplier credits, dated profit, duplicate SKUs/barcodes and invoice sequencing. `npm run typecheck` checks the complete TypeScript app. `npm run build` uses Webpack and provides a build path where the local Turbopack CSS worker cannot bind a port.

## Reference design and invoice downloads

The interface follows the supplied screenshot and screen recording: lavender/silver surfaces, a top icon navigation bar, rounded translucent panels, wide Syne headings, metallic stock artwork, a circular summary, orange/pink billing action, lime paid badges, and pill-shaped search/filter fields. Invoice screen previews use the same visual language; printed/downloaded invoices keep clean white paper and vector text. Reference-only marketplace roles, disputes, shipping actions and challenge/rank features are excluded.

PDF downloads render directly from the saved transaction rather than rasterizing the screen. Built-in PDF fonts are used for small Latin-text documents; a locally hosted, licensed DejaVu Sans font is subset and embedded when required to preserve supported non-Latin characters. Unsupported characters are reported explicitly, with browser Print / Save PDF as the text-preserving fallback. No invoice data is sent to a third-party PDF service.

A synthetic two-item test invoice generated an A4 PDF of 2,156 bytes; a 120-item test generated 12,102 bytes across 10 pages. These are illustrative measurements, not fixed limits: file size varies with content, page count, and font requirements.

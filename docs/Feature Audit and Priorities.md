# Glacier Feature Audit and Priorities

## Response 1: Feature audit

**Our system does not yet have all the features in the Glacier inventory.** It covers the main retail workflows, but accounting, payroll, and reporting need substantial additions.

I made **no changes**. I reviewed the data models, forms, calculations, reports, API, storage, and tests. All **45 existing tests pass**, and TypeScript passes. This is a source-code and calculation audit; live deployment, physical printers, and attendance hardware were not tested.

I treated the document as a feature reference. Its suggested rebuild instructions were not executed.

**Core feature comparison**

“Partial” means related functionality exists, but it does not match the full feature described.

| Feature from the document | Current status | What is present or missing |
|---|---|---|
| Password login and admin access | Present | Email/password login, workspace owner, and team permissions. |
| Hierarchical chart of accounts | Partial | Flat account-head names exist. No parent accounts, hierarchical codes, account nature/type, or opening balances. |
| Customer/supplier account profiles | Partial | Name, phone, email, address; customer NTN. Missing separate contact person/mobile, sales-tax registration, description, and employee fields. |
| Article/item profile | Partial | SKU, barcode, category, unit, cost, sale rate, opening quantity, current stock, and low-stock threshold. |
| Packing and opening stock by store/size | Missing | Stock is tracked per product without store/size allocations or packing conversions. |
| Category setup | Present | Categories can be added and selected. |
| Employee setup | Missing | No employee records or employee module. |
| Cash sales | Present | Walk-in sales, quantities, rates, totals, discounts, tax, payments, and stock deduction. |
| Credit sales | Partial | Unpaid and partially paid bills exist. Entry lacks the previous customer balance, book, and separate voucher reference. |
| Searchable item lookup | Present | Searchable selection and barcode/SKU lookup. |
| Line-level discount | Missing | Discount is applied to the whole bill. |
| Cash/credit sale returns | Present | One return workflow handles both, with original-transaction limits, stock restoration, and credit/refund calculations. |
| Purchases and purchase returns | Present | Supplier purchases, outstanding balances, stock increases, and returns against original purchases. |
| Journal vouchers | Missing | No balanced debit/credit entry grid or journal posting. |
| Bank vouchers | Missing | Bank/wallet payment methods exist, but no bank-voucher workflow. |
| Expense entry | Present | Categories, account heads, amounts, methods, dates, and notes. |
| Cheques received/paid/entry | Partial | Cheque details, expected clearance date, pending status, and manual clearance exist for transaction payments. No independent cheque-entry register or complete bounce/cancellation workflow. |
| Edit posted vouchers | Missing | No voucher register or controlled voucher correction workflow. |
| Bill posting/unposting | Missing | Bills immediately affect stock and calculations; there is no separate posting stage. |
| Payroll | Missing | Holidays, employees, fixed advances, advance modification/receipt, attendance-machine import, salary generation, and payroll reports are all absent. |
| Report print-preview viewer | Partial | Reports render as tables with CSV export. Invoice print/PDF preview exists, but no equivalent paginated report viewer. |

Evidence: [data model](/Users/userr/Documents/Codes/stockwell/lib/stockwell/model.ts), [sales/purchase form](/Users/userr/Documents/Codes/stockwell/components/stockwell/forms/trade-form.tsx), [account-head view](/Users/userr/Documents/Codes/stockwell/components/stockwell/views/account-heads-view.tsx), and [cheque/payment view](/Users/userr/Documents/Codes/stockwell/components/stockwell/views/payments-view.tsx).

**Report comparison**

| Glacier report | Current status |
|---|---|
| Stock report | Present as current inventory report |
| Per-item stock ledger: received, issued, running balance, store filter | Partial: movement history exists; running balance and store filter are missing |
| Date-wise stock | Partial: dated movements exist; historical stock balances do not |
| Stock aging | Missing |
| Minimum level | Partial: low-stock filter exists; no dedicated report |
| Maximum level | Missing; no maximum threshold |
| Sales bills | Present as billing report |
| Cash-sale report | Partial: sales and payment-method filters exist; no dedicated cash-sale report |
| Credit-sale report | Partial: unpaid/partial status filters exist; no dedicated credit-sale report |
| Purchase reports | Present |
| Daily cash sheet | Partial: cash movements exist; no dedicated opening/closing cash sheet |
| Daily transactions | Present as date-wise transaction report |
| Post-dated cheque report | Missing; due dates appear in payment history |
| Account aging | Missing |
| Expense report | Present |
| Receivable/payable reports | Present, with date-balance limitation below |
| Account ledger with account/category filters | Partial: customer/supplier ledgers and account-head transactions exist |
| Trial balance | Missing |
| Payment reports | Partial: payment-history screen exists; no dedicated report/export option |
| Yearly summary | Missing |
| Income statement | Partial: profit summary exists; no complete account-based statement |
| Balance sheet | Missing |
| Unposted bills | Missing |

Evidence: [available report choices](/Users/userr/Documents/Codes/stockwell/components/stockwell/views/reports-view.tsx:40) and [report calculations](/Users/userr/Documents/Codes/stockwell/lib/stockwell/reports.ts).

**Existing issues requiring rectification**

1. **Pending cheques incorrectly reduce ledger balances.**  
   I reproduced a bill with **PKR 200 due** and a pending cheque for **PKR 200**. The bill correctly remained unpaid, but the customer ledger showed **zero balance**. The ledger includes payments without checking cheque clearance. [Affected calculation](/Users/userr/Documents/Codes/stockwell/lib/stockwell/reports.ts:200)

2. **Historical receivable/payable reports show current balances.**  
   Date filters select bills by their transaction dates, but “Paid,” “Return credit,” and “Balance” include later payments and returns. These reports cannot reliably answer “what was outstanding on this date?” [Affected calculation](/Users/userr/Documents/Codes/stockwell/lib/stockwell/reports.ts:40)

3. **Walk-in details are lost in sales reports and search.**  
   Bills store walk-in names, company names, and phone numbers, but report naming falls back to “Walk-in customer,” and transaction search omits those fields. [Search logic](/Users/userr/Documents/Codes/stockwell/lib/stockwell/record-selectors.ts:29)

4. **The Excel backup does not contain complete server audit history.**  
   It exports the browser snapshot, which receives only the latest **300 audit events**. Older events remain on the server. It also has no restore workflow and is not a full database backup. [Snapshot limit](/Users/userr/Documents/Codes/stockwell/lib/stockwell/server.ts:118)

The sensible implementation order is: fix these reporting issues, establish proper accounts and voucher posting, complete cheque handling, add the missing reports, then implement payroll.

Manufacturing, unknown Utility/Window functions, and unspecified payroll rules remain **unconfirmed in the reference document**, so I have not counted them as mandatory missing features.

---

## Response 2: Prioritized work list

Recommended order: fix financial accuracy first, establish accounting foundations, then complete reports and payroll.

| Priority | Work item | Scope |
|---|---|---|
| **P0 — Critical** | Correct pending-cheque ledger calculations | Pending or bounced cheques must not reduce customer/supplier ledger balances. |
| **P0 — Critical** | Correct historical outstanding reports | Calculate receivables, payables, payments, and returns as of the selected report date. |
| **P1 — High** | Complete chart of accounts | Hierarchical codes, parent accounts, account types/nature, opening balances, and account details. |
| **P1 — High** | Add journal vouchers | Multiple debit/credit lines, balanced totals, references, and posting validation. |
| **P1 — High** | Add bank vouchers | Bank receipts, payments, transfers, and individual bank-account balances. |
| **P1 — High** | Add posting and correction workflows | Draft/unposted bills, posting controls, voucher register, corrections/reversals, and audit trail. |
| **P1 — High** | Complete cheque management | Received/issued register, post-dated cheques, clearance, bounce, cancellation, and linked account effects. |
| **P1 — High** | Make backups complete and restorable | Include full audit history; add validated restore with protection against accidental overwrites. |
| **P2 — Medium** | Complete customer/supplier profiles | Contact person, separate mobile, sales-tax registration, descriptions, and opening balances. |
| **P2 — Medium** | Complete sales entry | Previous customer balance, book/voucher references, and line-level discounts. |
| **P2 — Medium** | Preserve walk-in identity in reports | Show and search names, company names, and phone numbers. |
| **P2 — Medium** | Complete item profiles | Packing, store/size stock allocations, maximum-stock thresholds, and required textile units. |
| **P2 — Medium** | Complete inventory reports | Running item ledger, historical/date-wise stock, stock aging, and minimum/maximum levels. |
| **P2 — Medium** | Complete operational reports | Cash/credit sales, daily cash sheet, payment reports, post-dated cheques, account aging, and unposted bills. |
| **P2 — Medium** | Add financial statements | Trial balance, account ledger, yearly summary, income statement, and balance sheet. Requires accounting foundations above. |
| **P2 — Medium** | Add report printing | Company headers, pagination, print preview, and PDF/Excel export. |
| **P3 — Later phase** | Add employee and holiday setup | Employee profiles, salary information, machine IDs, and holiday calendar. |
| **P3 — Later phase** | Add employee advances | Fixed advances, modifications, receipts/recoveries, and balances. |
| **P3 — Later phase** | Add attendance import | Confirm machine format and attendance rules before implementation. |
| **P3 — Later phase** | Add salary generation and payroll reports | Confirm salary, deduction, overtime, and payslip rules; connect payroll to accounting. |

Payroll is required for full reference parity; its later position reflects implementation dependencies.

**Confirm scope before prioritizing:** manufacturing, unknown Utility/Window functions, and payroll rules not demonstrated in the reference.

No changes made.

---

## Abdul’s requirements — 8 October 2026

This section supplements the Glacier audit and priority list above. Abdul’s messages are requirements to assess and plan; application changes have not been implemented as part of this document update. Existing features must be verified in the deployed system before being accepted as complete.

Priority meanings: **P0** fixes financial inaccuracies; **P1** covers essential controls and daily financial operations; **P2** completes usability, item details, supporting documents, and reports. Payroll remains **P3** in the original implementation sequence.

| Abdul’s concern | Coverage in original plan | Current system / required work | Priority |
|---|---|---|---|
| Cheque details; bill settled only after cheque clearance | Covered | Number, bank, expected clearance date, pending status, and manual clearance exist. Fix the ledger inconsistency and complete cheque lifecycle handling. | **P0** calculation fix; **P1** lifecycle |
| JazzCash, EasyPaisa, NayaPay | Partially covered | These wallet payment methods already exist. Explicitly retain them and verify recording and reporting for each wallet. | **P2** verification |
| Add and operate multiple bank accounts | Covered | Settings supports adding bank accounts. Complete separate account balances, reports, and stable transaction links. | **P1** |
| Measurement units | Covered | Unit selection exists. Confirm textile units, including whether yards are required, and provide unit management. | **P2** |
| Walk-in customer name, company, phone | Covered | These fields exist on bills. Complete customer linking, search, reporting, and address capture. | **P1** customer linking; **P2** details/search |
| Barcode scanners not compulsory | Not explicit | Barcode is already optional. Preserve manual product selection and SKU entry; no scanner or barcode may be required to save a product or bill. | **P2** acceptance check |
| Adjust printer size | Partially covered | A4, 80 mm, and 58 mm choices exist. Confirm the actual printer, paper width, margins, and desired layout, then verify physical output. | **P2** |
| Simple bill with customer name, address, and relevant details | Partially covered | Invoice output exists; walk-in address is missing. Agree a sample layout and required fields before changing the invoice. | **P2** |
| Buying goods on credit | Covered | Already supported through zero/partial purchase payment, supplier payable, and later Payments entries. Verify and document the workflow. | Existing; **P2** guidance/verification |
| Save every walk-in customer in Customers | Missing | Automatically create or link a customer profile when saving the bill. Define matching and duplicate handling so repeated visits do not create unnecessary duplicates. | **P1** |
| Find walk-ins by phone, company, or client name | Covered | Include all three in customer, transaction, and report search; show the saved identity rather than a generic walk-in label. | **P2** |
| Add expense account heads | Covered | Heads can be added through Accounts Heads and selected in Expenses. Explain that workflow; confirm whether inline creation in Expenses is also required. | Existing; **P2** guidance/optional inline creation |
| Admin may backdate expenses; others limited to two previous days | Missing | Enforce role-based date limits on the server and in forms, including offline sync. | **P1** |
| Why account heads are adjustable | Partially covered | Explain selection versus editing, define authority, and lock posted entries against uncontrolled changes. Use an audited correction/reversal workflow. | **P1** |
| Cash-in-hand report | Partially covered | Add a dedicated report with opening cash, receipts, payments, closing cash, and reconciliation. | **P1** |
| Bank-balance report | Covered broadly | Explicitly show opening balance, movements, and closing balance for each bank account. | **P1** |
| Cash-flow report | Missing | Add receipts, payments, net movement, and opening/closing balances; distinguish transfers from external cash flows. | **P1** |
| Follow the supplied video | Covered | Retain the feature comparison as the baseline. Confirm unopened screens and unresolved workflows rather than inventing their behavior. | Overall acceptance scope |
| Item colours | Missing | Add colour attributes or variants, display them in item selection and documents, and support search/filtering. Confirm whether colours require independent stock balances. | **P2** |
| GSM tab | Missing | Add GSM values and filtering. Confirm whether Abdul expects a product field, lookup list, or separate management tab. | **P2** |
| Admin can correct bills entered by another user | Partially covered | Explicitly add admin-only bill correction with stock, balance, payment, and return consistency, reasons, and before/after audit history. | **P1** |
| Expense attachments | Missing | Upload, view, download, and manage evidence attached to an expense, with access controls. | **P2** |
| Supplier bill-copy attachments | Missing | Attach supplier invoice copies to purchases and retain their links in purchase history. | **P2** |
| Daily reports | Covered broadly | Define a daily package covering sales, purchases, expenses, receipts/payments, returns, and cash/bank movement. | **P2** |
| Daily closing summary before closing the shop | Partially covered | Add a daily cash statement, counted cash, expected cash, variance, closing confirmation, and controlled reopening. | **P1** |
| Product inactive button | Missing | Allow authorized users to deactivate/reactivate products. Exclude inactive products from new sales/purchases while preserving historical records and valid returns. | **P2** |
| Shared Google Doc with images/videos | Missing | Separate review deliverable: organize requirements, evidence, screenshots/video references, decisions, and acceptance results. No Google Doc has been created by this Markdown update. | Coordination |

### Acceptance criteria and decisions

1. **Cheque settlement — P0/P1.** A future-dated cheque remains pending until clearance is confirmed; passing its expected date alone must not settle a bill. Only cleared amounts reduce the outstanding bill balance. Full clearance settles a bill only when the remaining balance is zero; partial clearance leaves the remainder due. Customer/supplier ledgers and reports must agree. Preserve receipt/issue date and clearance date separately. Bounced or cancelled cheques must have appropriate balance effects and an audit trail.

2. **Banks and wallets — P1/P2.** Support the three named wallets and multiple concurrent bank accounts. Store stable account references, report balances separately, and preserve historical account references when an account is disabled. Include opening balances and audited transfers; internal transfers must not inflate cash inflow/outflow totals.

3. **Walk-in customer saving — P1.** Saving a walk-in bill must create or link a searchable customer record and retain the identity on the bill. Capture client name, company, phone, and address as applicable. Confirm which fields are mandatory and the matching rule; never merge customers solely because their names match. Existing walk-in bills need a reviewed backfill approach that avoids duplicates and preserves balances.

4. **Expense date restriction — P1.** Proposed interpretation: non-admin users may enter expenses dated today or either of the previous two calendar days; admins may enter earlier dates. Confirm this interpretation and the business timezone. Apply the rule to API writes, edits, and offline changes, using a defined policy for entries created offline but synced later. Do not silently discard rejected pending entries. Decide future-date handling explicitly.

5. **Admin bill correction and account-head controls — P1.** Map “admin” to the workspace owner unless a separate admin role is agreed. Require a correction reason and keep before/after history. Recalculate affected stock and financial balances consistently. Define restrictions when payments, returns, cleared cheques, or a daily close already exist; posted/closed records require controlled correction or reversal rather than silent overwriting. Define whether other users can select heads, create heads, or edit existing entries.

6. **Cash, bank, cash-flow, and closing reports — P1.** Reports must use consistent opening balances and selected-date calculations. Provide separate bank/wallet figures and a cash-in-hand statement. Daily close records counted cash, expected cash, variance, user, time, and any explanation. Confirm who may finalize or reopen a close and how later corrections affect the saved closing statement.

7. **Units, colours, GSM, and product activity — P2.** Provide manageable units and the required textile attributes. Confirm whether colour/GSM combinations are separate stock variants or descriptive fields. Inactivation must preserve item IDs, historical invoices, valuation, and return eligibility, and be enforced when saving new transactions as well as in selectors.

8. **Expense and purchase attachments — P2.** Agree permitted formats, size limits, and attachment authority. Provide authenticated upload/view/download and controlled removal. Retain stable record links, and define attachment retention, offline behavior, and inclusion in backup/restore; an Excel workbook alone does not contain the uploaded files.

9. **Printing, manual entry, and simple invoices — P2.** Agree the printer model/paper and a sample invoice containing the required bill and customer details. Verify paper sizing, margins, wrapping, pagination, and legibility on the actual printer. Barcode entry remains optional throughout; manual selection must support the complete billing workflow.

10. **Credit purchases and expense-head guidance — P2.** Provide concise user instructions: create/select supplier, record a purchase with zero or partial paid amount, review the payable, and settle it through Payments. Explain adding a head in Accounts Heads and choosing it in Expenses. Verify these workflows with the deployed system.

### Revised execution order

1. **P0:** Pending-cheque ledger consistency and historical receivable/payable accuracy.
2. **P1 foundations:** Hierarchical chart of accounts, opening balances, journal/bank vouchers, posting controls, cheque lifecycle, and separate account balances.
3. **P1 controls:** Admin bill corrections, expense date limits, account-head authority, automatic walk-in customer linking, and complete/restorable backups.
4. **P1 operations:** Cash-in-hand, per-bank balances, cash flow, and daily closing/reopening.
5. **P2:** Textile item fields, units, inactivation, walk-in identity/search, attachments, remaining reports, printer verification, and user guidance.
6. **P3:** Payroll as listed in the original plan, after confirming attendance, salary, advance, and deduction rules.

The shared review document and unresolved acceptance decisions can be prepared alongside these phases. Manufacturing and unknown Utility/Window features remain unconfirmed. This section updates the plan only; it does not change the application.


## Implementation progress — 9 October 2026

- [x] **P0: Pending-cheque ledger consistency.** Customer/supplier ledgers and financial movements now share the settled-payment rule. Pending, bounced, and unconfirmed cheques do not reduce balances. New clearances preserve receipt/issue date and store clearance date separately.
- [x] **P0: Historical outstanding accuracy.** Bill reports calculate paid, return credit, balance, and payment status through the inclusive end date. The start date selects bills, without excluding earlier settlements against those bills. No end date uses all recorded activity.
- Validation: all 53 unit tests and TypeScript checks pass, including customer/supplier historical payments, returns, cheque clearance, and legacy cleared records. Deployment has not been verified.
- Legacy limitation: previously cleared cheques had their original date overwritten; their recorded date remains the settlement date. The original receipt date cannot be recovered from that record.
- **Next item: P1 hierarchical chart of accounts**, followed by the remaining foundation, control, and operation items in the revised execution order.

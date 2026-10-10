# Feature Audit and Priorities

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
x
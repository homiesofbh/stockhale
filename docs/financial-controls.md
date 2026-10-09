# Financial controls

Business dates use **Asia/Karachi**. The workspace owner is the administrator.

## Bills and vouchers

Billing and Purchases support **Save draft** and **Post**. Drafts have no stock, payment, receivable, payable, or profit effect. Future bills remain drafts until their date. Posting validates quantities, derives item costs, records stock movements, and applies payments once.

Use **Manage** beside a bill to edit a draft. The owner can correct a posted bill with a reason and action date. Original identity, transaction date, customer/supplier, and payment account remain fixed. Corrections preserve before/after snapshots and add dated stock and financial adjustments. Historical reports retain the original figures before the correction date.

**Reverse bill** retains the original and reverses its effects. **Unpost to replacement draft** also creates a new draft for re-entry. Bills with linked payments, cheques, or returns are locked against rewriting; use their linked returns/refunds and separate adjustment vouchers. Closed periods must be reopened before bill corrections.

Posted journals and bank vouchers are immutable. The owner can create an exact reversal with a reason and date using **View entries → Reverse**. Reversal history is retained and duplicate reversals are rejected.

Only the owner can create or modify account heads or payment-account definitions. Members with the appropriate module permission may select existing heads and enter transactions. Opening balances and classifications used by posted vouchers are locked.

## Cheques

The received/issued cheque register is in Payments. Enter a cheque against a bill using **Record payment**, or with the original bill. A future expected-clearance date never settles the bill automatically.

**Clear** requires the confirmed date, settlement bank/wallet, and reason. **Bounce** reverses a previously cleared amount on the bounce date, preserving the original clearance. **Cancel** applies to pending cheques without reducing the bill balance. Bounced and cancelled records remain in history; record replacement cheques separately. Partial clearance leaves the remaining bill balance due.

Older cleared cheques whose original receipt dates were overwritten retain their recorded settlement dates; the missing receipt dates cannot be reconstructed. Generic historical Bank/Cheque movements remain unassigned unless a settlement account is explicitly recorded.

## Expenses and offline review

Members may enter expenses dated today or either of the previous two calendar days. Owners may enter earlier dates. Future dates are rejected on the server, including when device clocks differ. Recorded expenses are locked; adjustments use audited vouchers.

Offline expenses retain their original creation timestamp. A staff expense synced after the current two-day window requires owner review. The original pending change stays saved on the staff device. Staff export it using the sync controls; the owner reviews and approves the first pending expense in Settings, then staff retry sync. Revision conflicts must be resolved before approval. Nothing is silently discarded.

## Walk-in customers

Every new walk-in bill creates or links a customer, retaining the identity on the bill. Matching uses a unique phone number with formatting removed. Names alone never merge customers. Duplicate phone matches require explicit customer selection. Anonymous bills receive separate, bill-specific customer records.

The owner can review unlinked historical walk-ins in Billing, one bill at a time. Linking preserves bill amounts, stock, and payment amounts, and records the selected customer and review reason.

## Reports and daily closing

Reports include cash-in-hand, bank balances, cash flow, and unposted bills. Cash and bank opening balances apply from their opening dates and replace earlier movements. Transfers between cash/bank/wallet accounts do not inflate external cash-flow receipts or payments.

In Reports, select the closing date, review expected cash, and enter counted cash. A variance requires an explanation. Only the owner can finalize or reopen a closing. Closing retains the expected/counted amounts, variance, sales/purchase/expense summary, separate bank balances, actor, and timestamp.

A closed date blocks new financial and stock entries on or before that date. Reopen later closings first, with a reason. Reopening retains the saved statement; a new close records the updated figures separately.

## Complete backup and restore

Settings provides a restorable JSON backup and an Excel backup containing the same lossless recovery snapshot. Both fetch the entire server audit history. Sync pending changes before backup; preserved pending changes can be exported separately.

Restore accepts new JSON/Excel backups for the same workspace, verifies checksums and record validity, and shows a preview. The owner must enter the exact workspace name and a reason. Revision checks prevent overwriting changes made since review.

Before replacing business records, restore saves the current records as a recovery point. Existing audit history remains, missing backed-up audit events are restored without resending notifications, and the restore is logged. Recovery points can be downloaded in Settings and restored through the same reviewed workflow.

Passwords, login sessions, and team permissions are not restored. These exports are business-record backups, not PostgreSQL server or authentication-system disaster-recovery images. Restore files are limited to 45 MB.

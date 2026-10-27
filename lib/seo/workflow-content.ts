export type WorkflowPageContent = {
  path: string;
  kind: "Feature" | "Guide" | "Template";
  title: string;
  description: string;
  heading: string;
  intro: string;
  question: string;
  answer: string;
  steps: { title: string; text: string }[];
  example: { title: string; description: string; headers: string[]; rows: string[][] };
  image: { name: string; alt: string; caption: string };
  checks: string[];
  questions: { question: string; answer: string }[];
  related: string[];
};

export const workflowPages: WorkflowPageContent[] = [
  {
    path: "/customer-supplier-accounts", kind: "Feature",
    title: "Customer and Supplier Account Software | StockHale",
    description: "Connect retail stock with customer and supplier accounts. Review ledgers, outstanding balances, collections, and supplier payments in StockHale.",
    heading: "Customer and supplier accounts, connected to your stock.",
    intro: "Keep what arrived, what sold, and what is still owed in the same retail workspace. StockHale connects purchases and bills with customer and supplier records, so you can follow each account beyond a single transaction.",
    question: "What does a contact account tell you?",
    answer: "A customer or supplier account brings the contact’s transactions, payments, returns, credits, and running balance together. Use a bill to understand one transaction; use the contact ledger to understand the whole relationship. A remaining account balance can differ from the sum of open bills when there are unapplied credits or account-level settlements.",
    steps: [
      { title: "Save the right contact", text: "Create customers and suppliers before posting transactions that need an account history. Check that you select the existing contact rather than creating another record for the same business." },
      { title: "Record purchases and customer bills", text: "Posted purchases add stock and record amounts still due to the supplier. Posted customer bills reduce stock and record the paid amount and remaining bill balance." },
      { title: "Follow later payments", text: "Use Payments for customer collections and supplier settlements. Customer payments can be linked to the relevant bill. Supplier account payments reduce the whole supplier account; review the supplier payable balance when settling it." },
      { title: "Review the ledger and the bill", text: "Open the customer or supplier details and review its ledger, transaction references, and balance. Check individual bill records when you need to trace a particular sale or purchase. Credits may require separate matching or review." },
    ],
    example: { title: "A customer bill and its remaining balance", description: "Illustrative sample: one customer, one bill, no returns or other credits. Amounts are PKR.", headers: ["Event", "Paid at this step", "Remaining balance"], rows: [["Bill for 4 mugs at 150 each", "200", "400"], ["Later customer collection", "300", "100"], ["Final customer collection", "100", "0"]] },
    image: { name: "customer-accounts", alt: "StockHale customer account view showing a sample customer and an outstanding balance", caption: "Actual StockHale customer screen using fictional sample records. Amounts and names are examples." },
    checks: ["Review the contact’s net balance alongside individual bill balances.", "Check whether a credit is applied to a bill or remains on the account.", "Record payments when money actually changes hands, with the correct date and method.", "Use the supplier’s whole-account payable balance when recording a supplier settlement."],
    questions: [{ question: "Does a supplier payment always change the original purchase bill?", answer: "Account-level supplier payments reduce the supplier payable balance. Individual purchase bills remain available as transaction references, so the supplier’s total account balance and the original bill balance can differ." }, { question: "Can this replace professional accounting advice?", answer: "These tools organize operational records. Confirm your business’s accounting, invoicing, and tax requirements with the appropriate professional." }],
    related: ["/billing-inventory", "/guides/customer-credit-sales", "/inventory-management"],
  },
  {
    path: "/guides/opening-stock", kind: "Guide",
    title: "How to Enter Opening Stock for a Shop | StockHale",
    description: "Set up opening inventory in StockHale. Learn when to use a purchase or stock adjustment, record starting quantities, and avoid counting the same stock twice.",
    heading: "Enter opening stock once, with a clear starting point.",
    intro: "Opening stock is the stock you already have when you begin recording your shop in StockHale. Choose a starting date, count the items, and decide which records represent existing stock and which represent purchases you are entering.",
    question: "Should you enter a purchase or a stock adjustment?",
    answer: "Use a purchase when you are recording an actual supplier purchase, including its products, costs, and payment details. For existing stock whose purchase you are not entering, use a stock adjustment. Do not add an opening adjustment and then post a purchase for the same units. A stock adjustment changes quantity; it does not create a supplier bill or a payment.",
    steps: [
      { title: "Choose a cutover date and count", text: "Count stock at a clear starting point before recording new sales. List each product, unit, quantity, SKU, and the cost information you have. Keep uncounted items separate from counted items." },
      { title: "Create product records", text: "In Inventory, add each product with its SKU, cost and selling prices, unit, and category. Check for an existing product before adding a duplicate. Confirm that boxes and individual pieces use the intended quantity unit." },
      { title: "Enter the stock through one route", text: "If you are entering the original supplier purchase, post that purchase. Otherwise open Inventory → Stock adjustment, select the product, enter a positive quantity change, choose the date, and add a reason such as ‘Opening stock at cutover’." },
      { title: "Check quantity and account effects", text: "Open the product and review its current quantity and stock history. A purchase may create a supplier balance; an opening quantity adjustment alone does not. Keep starting supplier or customer account balances separate from stock quantity setup." },
    ],
    example: { title: "Twenty mugs already on the shelf", description: "Illustrative sample: a new product has zero recorded stock. Its previous purchase will not be entered in StockHale.", headers: ["Step", "Quantity change", "Recorded stock"], rows: [["Product created without opening units", "0", "0"], ["Opening-stock adjustment", "+20", "20"], ["Do not also post the old purchase", "No second entry", "20"]] },
    image: { name: "opening-stock", alt: "StockHale stock adjustment form with fields for product, date, quantity change and reason", caption: "Actual stock adjustment form with an example quantity and reason, before product selection. Enter a quantity change, not a desired final quantity." },
    checks: ["Count the same physical unit only once.", "Check each product’s unit, starting quantity, and cost before entering it.", "Keep the count record and reason for the opening adjustment.", "Review supplier opening balances separately; stock quantity alone does not establish what you owe."],
    questions: [{ question: "Does a stock adjustment record a purchase cost or payment?", answer: "No. The adjustment form records the quantity change, date, and reason. Product cost is maintained on the product record; supplier purchases and payments have their own workflows." }, { question: "What if I entered the same opening units twice?", answer: "Review the purchase and adjustment history before making a correction. Identify the duplicated entry and use the appropriate correction workflow; do not remove a genuine purchase just to make the quantity look right." }],
    related: ["/inventory-management", "/guides/retail-stocktake", "/how-to-use"],
  },
  {
    path: "/guides/retail-stocktake", kind: "Guide",
    title: "How to Count and Reconcile Shop Stock | StockHale",
    description: "Run a small-shop stocktake: compare expected and counted quantities, investigate differences, and record explained inventory adjustments in StockHale.",
    heading: "Count shop stock and explain the differences.",
    intro: "A stocktake compares what is physically on the shelf with what your records say should be there. A repeatable count, a clear cutoff, and a reason for each correction make the result more useful than simply replacing a number.",
    question: "How do you reconcile a stock count?",
    answer: "Choose a cutoff, capture expected quantities, count the same products and units, investigate differences, then record only the explained changes. In StockHale, the adjustment quantity is the difference: counted stock minus expected stock. Keep the count sheet with your notes and review the item’s history after posting.",
    steps: [
      { title: "Prepare the count", text: "Choose a quiet period and pause stock movements if possible. If sales or deliveries continue, record them against a clear cutoff and reconcile them separately. List product identifiers and units so similar items are not confused." },
      { title: "Count physical units", text: "Count each shelf or storage area once. Separate damaged or returned stock and decide its treatment before recording the final usable quantity. Recount any surprising result with another team member where practical." },
      { title: "Investigate the difference", text: "Compare the count with current recorded stock. Check missing purchases, posted sales, returns, duplicate entries, and unit conversion mistakes. Correct a transaction error through its own workflow when that explains the difference." },
      { title: "Record and review an adjustment", text: "For a genuine unexplained quantity difference that has been reviewed, use Inventory → Stock adjustment. Enter the signed change, count date, and a specific reason. Check the product’s updated quantity and movement history." },
    ],
    example: { title: "Expected 20, counted 18", description: "Illustrative sample: no transactions occurred between the expected-stock snapshot and the physical count.", headers: ["Recorded quantity", "Physical count", "Adjustment"], rows: [["20 pieces", "18 pieces", "18 − 20 = −2 pieces"], ["20 pieces", "23 pieces", "23 − 20 = +3 pieces"], ["20 pieces", "20 pieces", "0: no adjustment needed"]] },
    image: { name: "stock-history", alt: "StockHale product detail screen showing quantity and stock movement history for a sample item", caption: "Actual product detail and movement-history view using fictional sample stock records." },
    checks: ["Use counted minus expected, rather than entering the final count in the quantity-change field.", "Keep the same unit on the count sheet and product record.", "Investigate missing transactions before making a quantity-only adjustment.", "Keep the original expected quantities, counts, reasons, date and reviewer."],
    questions: [{ question: "Does StockHale have a dedicated stocktake scanning session?", answer: "This guide uses the existing product, stock adjustment, and history screens. It does not assume a separate automated counting or approval module." }, { question: "Where can I get a count sheet?", answer: "Use the downloadable stocktake workbook linked below. Its difference formulas help calculate proposed adjustments; review them before recording changes in StockHale." }],
    related: ["/templates/stocktake-sheet", "/inventory-management", "/guides/returns-damaged-stock"],
  },
  {
    path: "/daily-cash-closing", kind: "Feature",
    title: "Retail Daily Cash Closing and Reconciliation | StockHale",
    description: "Compare expected and counted drawer cash, review shortages or overages, and close a completed business date using StockHale’s daily closing workflow.",
    heading: "Close the shop with the cash drawer explained.",
    intro: "StockHale’s daily closing brings expected physical cash, the amount you count, and any variance into one workflow. Review the day’s entries before closing the date, with controlled reopening when a correction is needed.",
    question: "What belongs in the physical cash count?",
    answer: "Count physical drawer cash only. The expected amount comes from recorded cash receipts and cash payouts, including the appropriate opening balance. Bank, wallet, cheque, and unpaid credit amounts are not cash in the drawer. Compare those records through their own balances and evidence rather than adding them to the physical count.",
    steps: [
      { title: "Review the day’s records", text: "Confirm posted bills, cash collections, purchases, expenses, contributions and drawings for the date. Check that the payment method matches the actual movement of money." },
      { title: "Count physical cash", text: "Open Closing and choose the business date. Count the cash in the drawer, keeping bank and other non-cash balances separate. Enter the counted amount and compare it with the expected cash shown." },
      { title: "Review any variance", text: "A shortage or overage is the difference between counted and expected cash. Recheck the physical count and dated entries. Record a meaningful explanation or follow the available unexplained-variance review before completing the close." },
      { title: "Close the date deliberately", text: "A closed day locks new entries and corrections on or before that date. Where correction is necessary, the owner-controlled reopening flow requires the owner password and a reason. Review the impact before closing again." },
    ],
    example: { title: "An example drawer close", description: "Illustrative sample only. Amounts are PKR; these are not measurements of a real shop.", headers: ["Cash item", "Amount"], rows: [["Opening cash", "1,000"], ["Cash received", "+600"], ["Cash paid out", "−200"], ["Expected drawer cash", "1,400"], ["Physical count", "1,380"], ["Variance: counted minus expected", "−20 shortage"]] },
    image: { name: "daily-closing", alt: "StockHale daily closing screen displaying expected cash, counted cash and reconciliation controls with sample records", caption: "Actual StockHale Closing screen using fictional sample transactions. Count physical cash separately from bank and credit balances." },
    checks: ["Do not treat the day’s sales total as the drawer cash balance.", "Keep bank deposits, credit sales, cheques and wallet balances separate from the physical count.", "Investigate differences before closing the date.", "Understand the date lock and owner reopening controls before completing a close."],
    questions: [{ question: "Does this automatically reconcile a bank feed?", answer: "No bank-feed matching is promised here. This workflow compares recorded cash with the physical drawer count; bank balances and supporting records require their own review." }, { question: "Can staff reopen a completed close?", answer: "Reopening uses an owner-controlled flow with the owner password and a reason. The date lock is intended to prevent casual changes to completed periods." }],
    related: ["/billing-inventory", "/customer-supplier-accounts", "/guides/customer-credit-sales"],
  },
  {
    path: "/guides/low-stock-reorder-levels", kind: "Guide",
    title: "Set Low-Stock and Reorder Levels for a Shop | StockHale",
    description: "Choose practical low-stock thresholds for shop products. Use StockHale’s low-stock view to review items and plan replenishment with your suppliers.",
    heading: "Set a low-stock level that fits the item.",
    intro: "A low-stock threshold is a prompt to review an item before the shelf is empty. StockHale compares current quantity with the threshold you enter on the product, helping you identify products that need attention.",
    question: "How can you choose a starting threshold?",
    answer: "A useful starting estimate is expected sales while waiting for the supplier, plus a buffer for uncertainty. Use your own records and lead times. This is a planning example, not a forecasting feature: StockHale lets you set the threshold and shows low-stock status; you still decide what and when to reorder.",
    steps: [
      { title: "Review sales and supplier timing", text: "Look at recent product activity and how long replenishment usually takes. Seasonal changes, uneven sales and minimum order sizes may mean a simple average is not enough." },
      { title: "Choose an initial level", text: "Estimate the quantity needed during the delivery wait and add an appropriate buffer. Work in the same unit used for the product. Treat the estimate as a starting point to review, rather than a fixed promise against shortages." },
      { title: "Save and review the threshold", text: "Edit the product’s low-stock threshold in Inventory. Review products marked Low stock and check the supplier details before arranging replenishment. StockHale marks quantity at or below the entered threshold as low." },
      { title: "Adjust as the shop changes", text: "Compare your threshold with actual sales and delivery times. Raise or lower it when the assumptions change. Record arriving goods through Purchases so the stock record reflects the delivery." },
    ],
    example: { title: "A starting level for one product", description: "Illustrative arithmetic, not a forecast or automatic StockHale calculation.", headers: ["Assumption", "Example"], rows: [["Average sales per day", "2 pieces"], ["Supplier lead time", "5 days"], ["Sales during the wait", "2 × 5 = 10 pieces"], ["Chosen buffer", "4 pieces"], ["Initial threshold to review", "14 pieces"]] },
    image: { name: "low-stock", alt: "StockHale inventory view filtered to a sample product at its low-stock threshold", caption: "Actual Inventory screen with fictional sample records showing a product below its configured low-stock level." },
    checks: ["Use an item-specific threshold and the correct unit.", "Do not confuse a low-stock status with an automatic supplier order.", "Allow for delivery uncertainty and changing demand.", "Review the actual product record before placing a replenishment order."],
    questions: [{ question: "Does StockHale automatically place a purchase order?", answer: "This guide describes the existing threshold and low-stock view. Automatic supplier ordering or email alerts are not claimed." }, { question: "Is low stock the same as out of stock?", answer: "No. Low stock means the recorded quantity is at or below your threshold. The item may still have units available." }],
    related: ["/inventory-management", "/guides/retail-stocktake", "/guides/opening-stock"],
  },
  {
    path: "/guides/customer-credit-sales", kind: "Guide",
    title: "Track Customer Credit Sales and Payments | StockHale",
    description: "Follow a retail credit sale through a partial payment and later collection. Review the bill balance and customer account ledger in StockHale.",
    heading: "Follow a credit sale beyond the first payment.",
    intro: "A posted sale and a customer collection are different events. Record what was sold when the bill is posted, then record later payments when money is received. The bill and customer ledger help you follow what remains due.",
    question: "What happens when only part of a bill is paid?",
    answer: "The bill records the sale, the paid amount, and the remaining balance. Stock reduces when the bill is posted, even if money remains to collect. Later customer payments reduce the balance according to the linked bill and account records; they are not a second sale.",
    steps: [
      { title: "Choose the saved customer", text: "Select the right customer in Billing so the transaction belongs to an account you can follow. Review the products, quantity, price and transaction date before posting." },
      { title: "Record the amount actually paid", text: "Enter the payment collected now and its actual method. Post the bill when the transaction is ready. Do not enter the full bill value as paid when only a deposit or part payment was received." },
      { title: "Record each later collection", text: "Use Payments, select Customer and the saved contact, then link the relevant bill where appropriate. Enter the amount, date and method. Check the remaining balance rather than creating another bill for the collection." },
      { title: "Review the customer ledger", text: "Open Customers and review the contact details and ledger. Check invoices, payments, returns, and any unapplied credit. A whole-account balance can differ from an individual bill balance when other transactions or credits exist." },
    ],
    example: { title: "A 600 bill paid in stages", description: "Illustrative sample: 4 mugs at PKR 150 each; no tax, discounts, returns, opening balances or other account activity.", headers: ["Event", "Payment", "Bill still due"], rows: [["Bill posted", "200", "400"], ["Later collection", "300", "100"], ["Final collection", "100", "0"]] },
    image: { name: "customer-accounts", alt: "StockHale customer screen showing an example account with a remaining receivable", caption: "Actual customer account view with fictional sample records. Review the ledger for the transactions behind the total." },
    checks: ["Use one bill for the sale and payment records for later collections.", "Use the correct customer and bill reference.", "Keep the payment method consistent with the money actually received.", "Review returns and unapplied credit before collecting an apparent outstanding amount."],
    questions: [{ question: "Does paying a bill reduce stock again?", answer: "No. The posted sale has already affected stock. A later payment records settlement of the amount owed." }, { question: "Why might the customer account and one bill show different amounts?", answer: "The account covers all of that customer’s activity, including other bills and credits. One bill covers a specific transaction. Review the ledger and unapplied-credit details to understand the difference." }],
    related: ["/customer-supplier-accounts", "/billing-inventory", "/daily-cash-closing"],
  },
  {
    path: "/guides/returns-damaged-stock", kind: "Guide",
    title: "Record Retail Returns and Damaged Stock | StockHale",
    description: "Understand customer returns, supplier returns, and damaged-stock records in StockHale. Keep stock movements and any credit or refund effects clear.",
    heading: "Give returns and damaged stock the right record.",
    intro: "A customer return, a return to a supplier, and damaged stock are different events. Choose the right type so the product movement and any financial effect tell the same story.",
    question: "Which return type matches what happened?",
    answer: "Use Sales return for an item coming back from a posted sale, Purchase return for goods going back against a recorded purchase, and Damaged stock when removing damaged inventory. The return form links eligible products to the original posted transaction where one is required and records a reason.",
    steps: [
      { title: "Find the original transaction", text: "For sales or purchase returns, choose the original posted bill or purchase and verify the product and eligible quantity. Damaged-stock recording does not require a customer sale to justify the quantity change." },
      { title: "Choose quantity and a reason", text: "Select the product and quantity being returned or written out. Explain what happened. Check whether goods coming back are usable; a sales return adds quantity back, so damaged returned goods need the appropriate separate treatment." },
      { title: "Review credit and refund choices", text: "A return changes the original transaction’s position. Where a linked contact has a refundable credit, the form can refund it or retain it on that account. A walk-in return has no saved contact ledger to hold a credit. Review the actual return summary before confirming." },
      { title: "Check stock and the contact record", text: "Review Returns & Damage, the item’s movement history, and the customer or supplier account where applicable. Avoid entering an extra generic adjustment for units the return has already moved." },
    ],
    example: { title: "Three separate example events", description: "Each row is an independent illustrative case. Any refund or credit depends on the original transaction and its settlement.", headers: ["Event", "Stock effect", "Account consideration"], rows: [["One usable customer return", "+1 piece", "Review original sale and any customer credit/refund"], ["One item returned to its supplier", "−1 piece", "Review original purchase and supplier credit"], ["Two damaged items removed", "−2 pieces", "No customer refund created by damage alone"]] },
    image: { name: "returns", alt: "StockHale Returns and Damage register with sample sales return, purchase return and damaged stock rows", caption: "Actual Returns & Damage register populated with fictional sample events. Each record retains its type, quantity and reason." },
    checks: ["Use the original posted transaction for sales and purchase returns.", "Do not put unusable goods back into available stock without addressing their condition.", "Review refunds versus credit retained on the ledger.", "Avoid a second adjustment for units already changed by the return record."],
    questions: [{ question: "Does damaged stock create a customer refund?", answer: "A damaged-stock record removes the specified inventory quantity. It does not by itself represent a customer sale return or create a customer refund." }, { question: "Can I return more than was sold?", answer: "The form limits eligible return quantities against the original transaction and previous returns. Verify the original record rather than using a return to correct an unrelated stock difference." }],
    related: ["/inventory-management", "/guides/retail-stocktake", "/customer-supplier-accounts"],
  },
  {
    path: "/templates/stocktake-sheet", kind: "Template",
    title: "Retail Stocktake Spreadsheet Template | StockHale",
    description: "Download a stock count workbook with SKU, expected and counted stock, quantity difference, and reason fields. Includes a filled example and count instructions.",
    heading: "A stocktake sheet you can actually use.",
    intro: "Download an Excel workbook for a small-shop stock count. It includes a blank count sheet, a clearly labelled worked example, and instructions. Enter expected and counted quantities to calculate the difference before reviewing a stock adjustment.",
    question: "What is included in the workbook?",
    answer: "The workbook has product identifiers, units, expected quantity, counted quantity, calculated difference, and a reason field. The blank sheet has 50 prepared rows; a separate example shows a shortage, surplus and matching count. Blank counts stay blank so an uncounted item is not mistaken for zero stock.",
    steps: [
      { title: "Download and save your own copy", text: "Open the XLSX file in a spreadsheet application. Read Instructions and inspect the Example sheet, then use Stocktake for your count. Save a copy with the store and count date before entering records." },
      { title: "Enter products and expected stock", text: "Add the product’s SKU, name and unit, along with the expected quantity at your cutoff. Use the same product identifiers and units as your inventory records. The file contains no real customer or business data." },
      { title: "Count and investigate", text: "Enter a physical count for every item counted, including 0 if none are found. Leave an uncounted item blank. The difference is counted minus expected; add a reason after investigating the result." },
      { title: "Review before updating inventory", text: "The workbook is a count aid, not an automatic import or stock updater. Review differences and record the appropriate adjustments in StockHale. Keep your original count file and movement references." },
    ],
    example: { title: "How the difference column behaves", description: "Illustrative sample matching the included workbook example.", headers: ["Item", "Expected", "Counted", "Difference"], rows: [["Mug", "20", "18", "−2"], ["Notebook", "10", "12", "+2"], ["Tote bag", "8", "8", "0"], ["Not yet counted", "5", "Blank", "Blank"]] },
    image: { name: "stock-history", alt: "StockHale product stock-history view used to review an adjustment after a physical count", caption: "After reviewing your spreadsheet, check the corresponding product and movement records in StockHale. Actual product screen; fictional sample data." },
    checks: ["The workbook is free to download and does not require a StockHale account.", "It uses quantity differences only; quantities in different units should not be added into a meaningless grand total.", "The file does not connect to your workspace or import stock changes.", "Keep formula cells intact and verify any extra rows you add beyond the prepared area."],
    questions: [{ question: "Do I need to sign up to download it?", answer: "No. The XLSX download is directly available without creating a StockHale account." }, { question: "Will it update StockHale automatically?", answer: "No. Use it to count and review. Record approved changes through the app’s stock adjustment or appropriate transaction-correction workflow." }],
    related: ["/guides/retail-stocktake", "/guides/opening-stock", "/inventory-management"],
  },
];

export const workflowPageByPath = (path: string) => workflowPages.find((page) => page.path === path);

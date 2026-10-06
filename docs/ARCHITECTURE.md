# Workspace UI structure

Development uses `next dev --webpack` to avoid the Turbopack hot-reload panic observed with Next.js 16.3.3 (`EcmascriptMergedChunkVersion` cells disappearing during HMR). Production builds also use Webpack. Run `npm run dev`; pass `-- --port 3001` when port 3000 is occupied.

`app/page.tsx` is the route entry point and renders `WorkspaceApp`. It does not own interactive state or import icons.

- `components/stockwell/workspace-app.tsx` coordinates workspace state, navigation, record mutations, and the selected view.
- `components/stockwell/workspace-header.tsx` renders desktop navigation and the profile dropdown, including mobile navigation.
- `components/stockwell/navigation.ts` defines module names, descriptions, and navigation icons.
- `components/stockwell/product-search.tsx` renders immediate product results. The controller preserves the current module and record filters while results are visible.
- `components/stockwell/record-filters.tsx` renders record search, status, payment method, category, and date controls.
- `components/stockwell/views/` contains dashboard, inventory, trade history, sales, accounting, expenses, payments, contacts, returns, reports, and notifications views.
- `components/stockwell/forms/` contains product, contact, trade, adjustment, expense, payment, return, and movement-dialog content.
- `components/stockwell/invoice-preview.tsx` renders the invoice preview and print/download controls.
- `components/stockwell/ui.tsx` provides shared fields, badges, empty states, tables, dialogs, and statistics.
- `lib/stockwell/record-selectors.ts` contains pure search, payment-status, and combined trade-filter functions.
- `lib/stockwell/reports.ts` generates report columns and rows using those same selectors.
- `lib/stockwell/downloads.ts` contains browser download and CSV escaping helpers.

## Offline assets

`app/sw.js/route.ts` serves the service worker with `no-cache, no-store, must-revalidate` headers. Worker sources live in `lib/stockwell/service-worker.ts`.

Production uses the offline worker. Development serves a worker that removes Stockwell's old asset caches and unregisters itself without intercepting requests. `lib/stockwell/service-worker-client.ts` also cleans up old registrations when the development app mounts. Workspace records and pending changes remain in their existing local storage.

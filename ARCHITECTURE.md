# Architecture

InvX is an Expo Router (file-based routing) React Native app. There is **no
custom backend**: Google Sheets is the database, reached directly over the
Sheets REST API with the OAuth token from Google Sign-In. All persistence lives
in the user's Google account (Sheets/Drive).

## Layers

```text
app/                 screens (Expo Router routes)
components/          reusable UI; feature folders back the big screens —
                       activity/ (audit feed), product/ (detail view + edit),
                       inventory/ (list, filters, scanner, add forms)
hooks/               data + auth + theme hooks; sheetsData/ backs useSheetsData
services/            googleSheets.ts facade over sheets/ (resource modules),
                       logger/ (structured logging), errors.ts
store/               products.ts (in-memory product state + subscriptions)
constants/           Products.ts (types + converters), Colors.ts (theme),
                       Spreadsheet.ts (sheet-id resolution), Diagnostics.ts
```

## Screens (`app/`)

| Route | File | Purpose |
| --- | --- | --- |
| `/login` | `login.tsx` | Google Sign-In gate |
| `/inventory` | `inventory.tsx` | Main screen: internal-product list, metadata views, filters, barcode scanner, add forms |
| `/internal-product/[id]` | `internal-product/[id].tsx` | View/edit a Sparky's (internal) product |
| `/external-product/[sku]` | `external-product/[sku].tsx` | View/edit a manufacturer (external) product by barcode |
| `/metadata/[...params]` | `metadata/[...params].tsx` | Edit a metadata list item |
| `/activity` | `activity.tsx` | Audit-event feed |
| `/diagnostics` | `diagnostics.tsx` | In-app log viewer |

`app/_layout.tsx` is the root: it wraps the stack in `ThemeProvider` and a log
error boundary, and hides the Android navigation bar.

## Data model

Two product tiers, stored in separate sheets:

- **InternalProduct** — a Sparky's logical product (`id`,
  `sparkys_product_name`, `product_type`, `sparkys_color`, `texture`, `shape`,
  `occasions[]`, `products[]` = member barcodes, `threshold_quantity`,
  `never_out`, `status`). It *groups* external products.
- **ExternalProduct** — a manufacturer SKU keyed by barcode (`unique_id_sku`,
  `manufacturer_color`, `brand`, `size`, `bag_quantity`, `distributors[]`,
  `quantity`, `status`).

An internal product's stock is the sum of its members' `quantity`
(`getInternalProductTotalQuantity`). Stock health (red/blue/green) comes from
`getQuantityColor` against `threshold_quantity`.

Each model has a **`*Sheet`** twin (`InternalProductSheet`,
`ExternalProductSheet`) where array fields are comma-separated strings — that's
the on-the-wire shape. `constants/Products.ts` holds the converters
(`convert*SheetToModel` / `convert*ModelToSheet`) and the comma helpers
(`parseCommaSeparated` / `formatCommaSeparated`).

### Sheets

- `internal_products`, `external_products` — the two product tiers.
- Metadata sheets — `product_types`, `occasions`, `manufacturer_colors`,
  `sparkys_colors`, `brands`, `shapes`, `textures`, `distributors`,
  `bag_quantities` — each a `{name, id, status}` list (status = active/archived).
- `events` — append-only audit log (`event_type`, `object_type`, `object_id`,
  `changes`, `before_state`, `user_email`, …) written by `logEvent`.

## State & data flow

The Sheets access layer is split into a transport, focused resource modules, and
a thin facade, so each piece stays small and independently testable:

- **`services/sheets/client.ts`** — `SheetsClient`, the resource-agnostic
  transport. Owns the spreadsheet id and the low-level read/write primitives
  (read ranges, append/update rows, find-row-by-value); injected into the
  resource modules so they stay focused on their domain.
- **`services/sheets/`** — one module per concern: `products.read` (parse rows
  into typed products), `products.internal` / `products.external` (create +
  update with audit diffing), `products.archive` (status flips), `metadata` +
  `metadata.cascade` (metadata CRUD and the rename cascade into product rows),
  `audit` (read/write the events log), and `aggregate` (one-shot load of every
  sheet). `products.ts` re-exports the product surface; `types.ts` holds the
  shared row/response types.
- **`services/googleSheets.ts`** — a thin facade that wires a `SheetsClient`
  into those modules and re-exposes them as the historical `GoogleSheetsService`
  API, so existing callers and tests are unaffected by the split.
- **`hooks/useSheetsData.tsx`** — the app-facing data hook (load/refresh + every
  mutation), kept thin by delegating to `hooks/sheetsData/`: `store.ts` (the
  module-level `globalSheetsState` and its subscriber model), `operations.ts` /
  `productOperations.ts` (call `GoogleSheetsService`, then update the in-memory
  store directly — no full refetch), and `mappings.ts` (the one table tying each
  sheet name to its field key and inventory view mode, replacing duplicated
  `switch` ladders).
- **`store/products.ts`** — module-singleton arrays of internal/external
  products with a `subscribeToStoreChanges` listener model. Screens read from
  here and re-render on change.
- **`hooks/useAuth.tsx`** — Google Sign-In; provides the access token used for
  every Sheets call.

## Screen feature modules

The four largest screens are thin route files that compose feature folders under
`components/`, with screen-specific logic factored into hooks:

- **Inventory** — `app/inventory.tsx` over `components/inventory/`: list items,
  filter modals, barcode scanner, add-product/-metadata forms, view-mode
  dropdown; state in `useInventoryState`, `useInventoryFilters`,
  `useInventoryFilterState`, `useInventoryAuditEvents`.
- **Product detail** — `app/internal-product/[id].tsx` and
  `app/external-product/[sku].tsx` over `components/product/`: a separate
  `*View` and `*EditForm` per tier, plus `MetadataGrid`, `PillList`, and the
  detail header/chrome; editing in `useInternalProductEditor` /
  `useExternalProductEditor` and `useArchiveProduct`.
- **Activity** — `app/activity.tsx` over `components/activity/`: `EventCard`,
  `EventChanges`, `EventDetailModal`; data via `hooks/useAuditEvents`.

**Open/Closed in practice:** presentation and routing that used to be `switch`
statements are now **data-driven maps** — you add a row, not a branch.
`components/activity/eventPresentation.ts` (event/field icons + metadata
routes), `components/product/metadataMaps.ts` (the clickable detail grid),
`components/inventory/inventoryMaps.ts`, and `hooks/sheetsData/mappings.ts` are
the canonical examples.

## Theming

`constants/Colors.ts` defines `light`/`dark` palettes plus derived types
(`ColorScheme`, `ColorKey`) and `toColorScheme()` (coerces the platform value,
which can be `null`/`"unspecified"`). `components/ThemeProvider.tsx` exposes
`{ theme, toggleTheme }` via context; screens do `const colors = Colors[theme]`.
`hooks/useThemeColor.ts` resolves a single color with light/dark overrides.

## Logging

`services/logger/` is a structured logger: leveled entries, secret redaction
(`serialize.ts` scrubs OAuth tokens / JWTs / known sensitive keys before
anything is persisted), a file sink, and a `/diagnostics` viewer. Because logs
can be uploaded to Drive, redaction is mandatory — see the tests in
`services/logger/__tests__/`.

## Build variants

`app.config.js` reads `APP_VARIANT` to derive the app name + bundle id
(`development` → `.dev`, `preview` → `.preview`, unset → production), so all
three install side by side. Per-variant build config and env (e.g.
`EXPO_PUBLIC_SPREADSHEET_ID`) live in `eas.json`. `constants/Spreadsheet.ts`
resolves that variable at runtime, falling back to the development sheet for
local `expo start` (which has no EAS environment). `android/` and `ios/` are
generated by `expo prebuild` and are not committed.

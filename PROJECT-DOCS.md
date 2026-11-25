# Rent-a-Fridge — Project Documentation

## 1. What this project is

**Rent-a-Fridge Operations** is a full operations-management web app for a refrigeration-equipment rental business (cold stores, upright fridges, chest freezers, static units). It runs the complete hire lifecycle: fleet inventory, customer accounts, multi-unit bookings, delivery/collection dispatch with signatures, maintenance and breakdown tracking, quotes, and payment readiness — all backed by a shared Supabase (PostgreSQL) database.

It is an internal/operations tool (staff-facing), not a customer-facing shopfront. Metadata title: *"Rent-a-Fridge Operations — Fridge rental operations management system"*.

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3.8 (App Router, Turbopack dev, server actions) |
| UI | React 19, TypeScript |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`), `tw-animate-css`, shadcn components, `class-variance-authority` |
| Backend | Supabase — Postgres (`@supabase/supabase-js` 2.118) + Storage for photos/documents |
| Maps | MapLibre GL 5.24 (fleet map, dispatch routing) |
| Animation | framer-motion (dashboard command centre) |
| Icons | lucide-react |
| Toasts | sonner |
| Fonts | Google fonts via `next/font` (self-hosted at build) |
| Runtime | Node 24+, pnpm 8.6 |

No API layer beyond Next server actions — all data access is server-side in `src/lib/db.ts` / `src/lib/uploads.ts` using `SUPABASE_URL` + `SUPABASE_SECRET_KEY`.

## 3. Data architecture

- **Supabase Postgres**, one table per collection (`units`, `customers`, `bookings`, `dockets`, `staff`, `notifications`, …). Each row is `{ id, seq, data jsonb, updated_at }` — the whole entity lives in the `data` JSON blob, so most new fields need **no migration** (the `notifications` table is the one exception requiring `20261124140000_notifications.sql`).
- `readDb()` loads all collections; `writeDb(db)` diffs and upserts only changed rows.
- **Important:** local dev and production share the same Supabase project — edits in dev hit live data.
- `data/db.json` is the legacy file store, kept only as seed source (`scripts/seed-supabase.mjs`).
- Photos/attachments are stored in Supabase Storage via `src/lib/uploads.ts`.

### Core entities (`src/types/index.ts`)

- **Unit** — fleet item. `type` (COLD_STORE / UPRIGHT_FRIDGE / CHEST_FREEZER / STATIC), `size`, `status` (available / in-hire / on-maintenance / broken-down), specifications (dimensions in cm or m, capacity in m²/m³/L — unit-aware, no rounding), photos, bill of materials, maintenance history, breakdown state.
- **Customer** — company with invoice address, additional delivery addresses, contact person (name, job title, email, telephone), payment terms (pays in advance / on credit), hire preferences, Xero contact link.
- **Booking** — one unit on hire; multi-unit bookings are several rows sharing a `groupId`. Dates, site, what3words, power requirements, rate, quote, status (CONFIRMED → ON_HIRE → COLLECTED, or CANCELLED), payment flag (PAID/UNPAID — informational only, never blocks dispatch).
- **DeliveryDocket** — delivery/collection job record with signature, photos, damage notes, staff assignment.
- **MaintenanceRecord / BOMComponent** — service logs, parts (compressor, evaporator, refrigerant incl. charge e.g. "80g", packaged unit, lights, accessories).

## 4. Feature tour — what it can do

### Dashboard (`/dashboard`)
"Command centre": fleet status at a glance (available / on hire / maintenance / broken down), units needing attention, overdue actions, animated unit illustrations, fleet map with unit locations.

### Fleet / Units (`/units`, `/units/[id]`)
- Unit cards with type illustrations, exact real-world dimensions (no rounding) and capacity in the entered unit (m²/m³/L, cm/m).
- Per-unit detail: status control via one dropdown — **Available / On hire / In maintenance / Broken down** (selecting "Broken down" opens the breakdown dialog; choosing a real status while broken down marks it fixed).
- Specifications editor (dimensions + unit, capacity + unit, chassis, door access), photos, BOM editor with parts types incl. refrigerant charge, service history (log service, edit, reassign a record to a different unit, attachments), next-service tracking, hire history, delete with guards (refuses when bookings/dockets reference the unit).

### Bookings (`/bookings`, `/bookings/new`, `/bookings/[id]`)
- Calendar + list views, type filters, search across customer/unit/site/PO/ref.
- Multi-unit booking creation wizard; per-line delivery/collection; customer pre-fill from hire preferences.
- Booking detail: timeline progress, quote with line items + VAT totals, PO number, proof-of-delivery/collection signatures, email/SMS confirmation actions.
- **Payment tracking**: "Mark paid" action (green Paid state, recorded date), payment terms per customer (advance/credit) — purely informational, dispatch never blocked.
- **CSV/TXT import** of booking history (columns: customer, unit, start, end, optional status/rate/contact/phone/site/notes); unknown customers auto-created, units must exist.
- Edit bookings, cancel with reason.

### Dispatch (`/dispatch`, `/deliveries`, `/collections`)
Delivery and collection job management — job drawer with driver assignment, checklists, signature capture on site, what3words locations, map-based routing pins (next-stop highlighting, late markers, yard/site pins).

### Customers (`/customers`, `/customers/[id]`)
- Cards with hire stats; segments (all / on hire / inactive).
- Customer detail: bookings history, contact panel, hire preferences (preferred unit/type, default temperature, cable length), Xero accounting link, delivery addresses, delete with guards.
- **CSV/TXT import** (name, phone, email, address) with preview and duplicate skipping.

### Maintenance (`/maintenance`)
Service records across the fleet, serviceable-components tracking, refrigerant/charge details, service scheduling with next-service dates feeding notifications.

### Notifications
Derived server-side from live data (due actions, services due, breakdowns) — per-notification **mark read/unread** and **dismiss**, persisted in the `notifications` table. Bell badge counts unread only.

## 5. Design system (for redesign work)

### Fonts (`src/app/layout.tsx`)

| Role | Font | CSS variable | Usage |
|---|---|---|---|
| Body/UI | **Inter** | `--font-sans` | everything by default (`font-sans` on `<html>`) |
| Display/headings accent | **Plus Jakarta Sans** (500–800) | `--font-jakarta` | `font-display` utility |
| Mono — unit codes, refs | **Geist Mono** | `--font-geist-mono` | `font-mono`, plus `.font-mono-unit` utility (600 weight, slight letter-spacing) — used for unit IDs like `C201`, booking references |

Body uses OpenType features `cv02, cv03, cv04, cv11` (Inter stylistic variants).

### Color system (`src/app/globals.css`) — all CSS custom properties, Tailwind v4 `@theme`

**Brand palette** — the identity is *red on warm neutrals*:

| Token | Value | Use |
|---|---|---|
| `--brand-red` | `#E3000F` | primary brand red — buttons, links, active states, map pins |
| `--brand-red-light` | `#EF4444` | hover/light accents |
| `--brand-red-dark` | `#BF000D` | primary button hover (`hover:bg-(--brand-red-dark)`) |
| `--charcoal` / dark sidebar | `#3A3734` → `#1C1917` | sidebar is dark charcoal, text `#E7E5E4` |
| warm gray scale | `50 #FAFAF9` … `900 #1C1917` | the "warm" neutral backbone (Tailwind `stone` family) |

**Semantic colors** (light theme only — a `.dark` variant hook exists but no dark token set is defined yet):

| Token | Value |
|---|---|
| `--background` | `#F7F7F6` (warm off-white) |
| `--foreground` | `#1C1917` |
| `--card` / `--popover` | `#FFFFFF` |
| `--muted`, `--secondary`, `--accent` | `#F5F5F4` |
| `--muted-foreground` | `#6B6560` |
| `--border` | `#E7E5E4`, `--input` `#E2DFDC` |
| `--primary` / `--ring` | `#E3000F` |
| `--destructive` | `#DC2626` |
| charts | red `#E3000F`, green `#16A34A`, blue `#2563EB`, violet `#7C3AED`, stone `#78716C` |

**Status palette** — consistent color language across calendar, badges, and map:

| Status | Color | Meaning |
|---|---|---|
| available | green `#16A34A` | free unit |
| on hire / delivery | blue `#2563EB` | out with customer / delivery job |
| confirmed / collection | violet `#9333EA` | booked ahead / collection job |
| booked | red `#E3000F` | brand-red attention |
| maintenance / collected | stone `#78716C` | neutral/inactive |

Each has `-bg` and `-border` companion tokens (e.g. `--status-available-bg: #DCFCE7`).

### Shape, depth, motion

- **Radius scale**: base `--radius: 0.625rem` (10px); utilities `rounded-lg`…`rounded-4xl` derive multiplicatively. Cards typically `rounded-2xl`, controls `rounded-md`/`rounded-lg`.
- **Shadows**: very soft, low-opacity (`--shadow-xs`…`--shadow-xl` at 3–5% black), plus `--shadow-card`, `--shadow-card-hover`, `--shadow-hover` for lift interactions.
- **Transitions**: `--transition-fast` 150ms / `base` 200ms / `slow` 300ms, all `cubic-bezier(0.4,0,0.2,1)`.
- **Custom utilities**: `.surface` (card chrome), `.glass-card` (translucent blur), `.hover-lift` (raise + deepen shadow), `.tabular` (tabular-nums for money/dates), `.font-mono-unit`, `.bg-hatch` (diagonal hatching), `.scrollbar-thin`.
- **Playful touch**: `fridge-wobble` keyframes; fleet unit illustrations (`src/components/fleet/unit-illustration.tsx`) are hand-drawn SVGs per unit type; hover-motion effects in the command centre.
- **Map styling**: custom pin system — white circular stops, charcoal "done", red "next" with pulsing halo rings, per-type site pins, dark tags.

### UI conventions

- shadcn-style primitives in `src/components/ui/` (button, dialog, input, status-badge/Pill); app-level pieces in `src/components/app/` (`Panel`, `StatStrip`, `DetailList`/`DetailItem`, `Field` with `selectClass`/`textareaClass`, `EmptyState`, `SegmentedControl`, `Avatar`).
- Buttons: red primary (`hover:bg-(--brand-red-dark)`), outline for secondary.
- Currency: GBP ex VAT, tabular numerals, `en-GB` date formats.
- Dark mode: not implemented (the `@custom-variant dark` exists but no dark tokens are defined).

### Where to change the theme

Everything visual funnels through `src/app/globals.css` — recoloring means editing the `:root` token block only; components reference tokens (`bg-card`, `text-muted-foreground`, `var(--brand-red)`), not raw hex. Fonts swap in `src/app/layout.tsx` + the `--font-*` variables.

## 6. Known operational notes

- Node 24+ required; the project pins pnpm (this Windows machine's npm is a broken WSL stub — run via `node node_modules/...` or fix corepack).
- Checks: `pnpm exec tsc --noEmit -p .`, `pnpm lint`, `pnpm build`.
- `supabase/migrations/20261124140000_notifications.sql` must be applied manually in the Supabase SQL editor (no CLI link); everything else rides on the jsonb schema migration-free.
- Dev runs on `http://localhost:3001` when port 3000 is taken.

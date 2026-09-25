# Bloom Admin — Design System Reference

Living documentation for the dashboard's visual language (§72). Components are the source of truth; this document explains intent and usage rules.

## Philosophy

> Safe. Private. Judgment-Free. — expressed as a calm, precise operational workspace, not a marketing site (§3, §16).

## Tokens (`src/app/globals.css`)

All components consume **semantic tokens**, never raw hex values (§15).

| Category | Tokens |
|---|---|
| Brand | `primary` (+`-hover`, `-subtle`, `-foreground`), `secondary` (+variants) |
| Surfaces | `background`, `surface`, `surface-muted`, `surface-raised` |
| Text | `foreground`, `foreground-muted`, `foreground-subtle` |
| Borders | `border`, `border-strong` |
| Status | `success`/`warning`/`danger`/`info`/`neutral` (+`-subtle`) |
| Radius | `sm` (0.375rem) → `xl` (1rem), `pill` (§20: restrained) |
| Shadows | `sm`/`md`/`lg` — sparing; hierarchy comes from surface + border (§21) |
| Z-index | `sticky` 100 → `toast` 700 (§56 — no ad-hoc `z-[999]`) |
| Charts | `chart-1..5`, `chart-grid` (§40) |

Dark mode (§17): flip the `[data-theme="dark"]` block — no component changes.

## Typography (§18)

| Class | Use |
|---|---|
| `text-page-title` | One per page (`text-xl font-bold`) |
| `text-section-heading` | Card/section headings |
| `text-label` | Uppercase micro-labels |
| `text-caption` | Metadata |

Body text is `text-sm` (14px) for information density; never larger than `text-2xl` outside KPI values.

## Components

### Primitives (`components/ui`)
`Button` (primary/secondary/outline/ghost/danger + loading, §23–§25), `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Badge`/`StatusBadge` (§35 — colors only from status config), `Card`/`CardHeader`, `Modal` + `ConfirmDialog` (§41/§42: focus trap, ESC, reason/phrase confirmation), `Drawer` (§43), `Tabs` (§68: roving tabindex), `Tooltip` (§57), `Avatar`/`AvatarGroup` (§65), `Alert` (§45), `Skeleton` (§48), `Pagination`, `PermissionGate`, `EmptyState`/`ErrorState` (§46/§47).

### Layout (`components/layout`)
`DashboardShell` (owns sidebar state + skip link), `AdminSidebar` (§8: collapse-to-icons with tooltips, mobile drawer), `AdminHeader` (§10: search, env badge, profile menu), `PageHeader` (§49: breadcrumbs + actions), `navigation.ts` (§7: permission-gated groups).

### Data display (`components/data-display`)
`DataTable` (§29–§33: server-side pagination, density `comfortable|compact`, responsive column hiding, slot columns), `MetricCard` (§38: verbatim trends, no implied statistics).

## Status semantics (§36)

| Tone | Meaning |
|---|---|
| `success` | completed / paid / active / approved |
| `warning` | pending / review / attention / partially-refunded |
| `danger` | failed / rejected / suspended / no-show |
| `info` | confirmed / processing / ready |
| `neutral` | cancelled / refunded / waived / unknown |
| `primary` | actively happening (in-progress states) |

Status maps are reconciled **only** to verified backend enums (`constants/status.ts`). Never color alone: every `StatusBadge` carries icon + text + `title` meaning.

## Formatting (§61–§63)

- Money: `formatGhs()` — `GHS 1,250.00`, em dash for null. No float math in the UI.
- Dates: `formatDate/DateTime/RelativeTime` — pinned to `Africa/Accra`.
- Counts: `formatCount()` with locale grouping.

## Accessibility contract (§53)

- One `h1` per page (PageHeader title).
- Visible `:focus-visible` outlines globally (primary, 2px, offset 2).
- Skip link → `#main-content` in `DashboardShell`.
- Dialogs/drawers: focus trap, `aria-modal`, ESC, focus return.
- Tables: `scope="col"`, optional `aria-sort`, first column acts as row identity.
- All interactive icons have `aria-label` or visible text.
- `prefers-reduced-motion` collapses all animation (global CSS).

## Responsive behavior (§51/§52)

- Sidebar: fixed ≥1024px (collapsible), drawer below.
- Tables: `hideBelow` columns collapse (`sm`/`md`/`lg`), horizontal scroll preserved for remaining columns.
- Filters stack vertically on mobile.
- Content max-width 80rem, centered.

## Rules of engagement

1. New UI must compose existing primitives; propose a new primitive only when two+ pages need it.
2. Never hardcode hex, z-index, radii, or shadows — use tokens.
3. Never map a status to a color at the call site — extend `constants/status.ts`.
4. Never add a page-specific button style — extend `Button` variants.
5. Charts use `STATUS_TONE_CHART_COLORS`/`CHART_COLORS` token variables only.

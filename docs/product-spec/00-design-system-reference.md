# Design system reference

Every module in this spec folder must build exclusively from what's below. This
is not a proposal — it's transcribed directly from `frontend/src/styles/tokens.css`,
`frontend/src/styles/index.css`, and the existing shared components in
`frontend/src/components/ui/`. If a new screen needs something not covered here,
the module doc calls it out explicitly as a **new primitive** and justifies why
existing components can't do the job — that should be rare.

## Color tokens

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0a1424` | primary text, dark surfaces |
| `--deep` | `#132840` | elevated dark panels (e.g. card preview surfaces) |
| `--signal` | `#1c60fa` | the one accent — primary actions, focus rings, active nav state |
| `--signal-deep` | `#0b4bb8` | hover state on signal-colored text/links |
| `--paper` | `#faf8f5` | page background — warm, never pure white |
| `--rule` | `#e3ded6` | all borders and dividers |
| `--slate` | `#5a6572` | secondary/muted text |

**Verdict colors — the product's core vocabulary.** Never used for decoration.
Every verdict is always paired with an icon and a text label — color alone
never carries meaning (accessibility rule already enforced across the console).

| Token | Hex | Meaning |
|---|---|---|
| `--verdict-allow` | `#1e9e6a` | permitted, healthy, verified |
| `--verdict-escalate` | `#d98b14` | needs human review, pending, watch |
| `--verdict-block` | `#d2483f` | denied, failed, critical, destructive |
| `--verdict-redact` | `#7c5cd6` | sensitive data handling / masking |
| `--verdict-sandbox` | `#0e7c9c` | provisional — sandboxed execution, isolated/contained |

Surface-2 (`bg-surface-2`, a step above paper) is used for icon chips, table
header rows, and expanded/nested panels throughout the console — reuse it for
the same purposes here.

## Typography

- `--font-sans` (Inter) — all body copy and UI text.
- `--font-machine` (JetBrains Mono) — **all data, labels, IDs, badges, uppercase
  micro-labels, timestamps in tables.** This is the single most identity-defining
  typographic choice in the product: any tabular or system-generated value reads
  as machine output, not prose. Every table cell showing an ID, hash, status
  badge, or metric uses `font-machine`.
- Uppercase micro-labels: `font-machine text-[10px] tracking-[0.14em] uppercase text-slate` — used for section eyebrows and column-group labels.
- Table column headers: `text-[11px] font-semibold text-slate uppercase` (plain sans, not machine — this is the one place uppercase labels stay in Inter, matching `_app.developer.tsx`'s existing tables).

## Shape — sharp corners, no exceptions

`--radius`, `--radius-card`, and `--radius-pill` exist in `tokens.css` (ported
verbatim from the marketing site) but **are not used anywhere in the console.**
Every component instead references `rounded-[var(--radius-control)]`,
`rounded-[var(--radius-panel)]`, or `rounded-[var(--radius-chip)]` — variables
that are never defined, so they resolve to `0`. This is deliberate and
load-bearing: it's how the console enforces "nothing rounds, anywhere" as a
single structural rule instead of hunting every component. **New components in
this spec must follow the same pattern** — reference `rounded-[var(--radius-control)]`
etc. even though it does nothing today, never a literal `rounded-md`/`rounded-full`/
pixel value. This includes decorative elements (glow blobs, chart fills) —
sharp underneath even where blur softens the edge.

## Elevation & motion

- `--shadow-1` (`0 1px 2px rgba(10,20,36,.06)`) — resting cards.
- `--shadow-2` (`0 4px 12px rgba(10,20,36,.1)`) — dropdowns, popovers, modals.
- `--shadow-3` (`0 12px 32px rgba(10,20,36,.16)`) — reserved for modals only.
- Durations: instant 100ms / fast 160ms / base 240ms / slow 320ms.
- `--ease-out` for anything entering, `--ease-in` for anything leaving,
  `--ease-standard` for on-screen movement (e.g. sidebar width, tab indicator).

## Core components (reuse, never rebuild)

- **`Card`** — `border border-rule bg-paper shadow-[var(--shadow-1)]`, sharp corners. The base container for every section.
- **`Button`** — variants `primary` (solid ink), `secondary` (bordered), `ghost` (transparent), `destructive` (solid verdict-block). Sizes `sm` (h-8) / `md` (h-10).
- **`Field` + `Input`** — label + control + error/hint slot; `Input` supports a leading `icon` and a `trailing` slot (used for reveal toggles, inline checkmarks, unit suffixes).
- **`Modal`** — centered dialog, `bg-ink/40` backdrop, `shadow-[var(--shadow-2)]`, header with title+subtitle+close, scrollable body, optional footer.
- **`Checkbox`** — square (never a rounded/pill toggle), signal-colored when checked.
- Table pattern (from `_app.developer.tsx`): plain `<table>`, header row `border-b border-rule`, header cells `text-[11px] font-semibold text-slate uppercase`, body rows `border-b border-rule last:border-0`, generous `px-5`/`px-3` cell padding, an explicit `Loading…` and empty-state row inside `<tbody>` (never a separate skeleton component).
- Status/verdict chip pattern: `border px-2 py-0.5 font-machine text-[10px] tracking-wide uppercase`, colored via the verdict token pairing (`border-{verdict}/30 bg-{verdict}/10`).

## Layout conventions

- Page shell: `mx-auto max-w-{2xl|3xl|4xl} px-6 py-8` (width scales with content density — 2xl for simple settings forms, up to 4xl for two-column/table-heavy pages).
- Section header row inside a `Card`: `flex items-center justify-between border-b border-rule px-5 py-3`, title `text-[13px] font-semibold text-ink`, optional description `mt-0.5 text-[12px] text-slate`.
- Primary action for a section lives top-right of that header row.
- Environment switcher (DEV/STAGING/PROD segmented control) already exists in the header (`Header.tsx`) and is global context — every agent/runtime screen in this spec respects the currently selected environment rather than adding a second one.

## What this spec must never introduce

- A second accent color. Signal blue is the only accent; everything else is ink/slate/verdict.
- Rounded corners, in any component, for any reason.
- A skeleton-loader component distinct from the existing inline `Loading…` row/text pattern.
- Emoji as UI iconography (lucide-react only, `strokeWidth={2}` default).
- A second typographic voice beyond Inter (prose) + JetBrains Mono (data/machine).

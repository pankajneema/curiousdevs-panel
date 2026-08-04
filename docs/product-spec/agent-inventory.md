# Module 01 — Agent Inventory

Phase 2, Module 1. Route: `/agents` (existing route, currently a minimal
grouped list — this spec replaces its contents; the route itself, its sidebar
entry, and its position under "Operate" don't change).

## Module goal

One screen that answers, for every AI agent with runtime access into
Northbeam Financial's systems: **what is it, what can it reach, how risky is
that, and is it behaving right now.** This is the front door of the entire
security surface — every other Phase 2/3 module (Identity, Permissions,
Runtime, Policy, Threat Detection) is reached by drilling into a row here.

## User journey

A platform security engineer, Priya, starts her shift. She has 47 agents live
across DEV/STAGING/PROD. She's not here to browse — she's here to answer "did
anything change overnight, and is anything I should be worried about."

1. Lands on `/agents` with **PROD** selected (the header environment switcher
   persists across the whole console; Agent Inventory respects it, doesn't
   duplicate it).
2. The KPI strip tells her at a glance: 31 active in PROD, 2 critical-risk, 1
   quarantined since last night.
3. She clicks the "Critical risk" KPI card — it's also a quick filter, so the
   table narrows to 2 rows instantly.
4. She scans `sales-outreach-agent` — status **Quarantined**, a verdict-block
   chip she doesn't recognize from yesterday. She opens the Quick View drawer
   (no navigation, stays on the list) to see why: quarantined by the Danger
   Zone bulk action 14 hours ago, tied to an incident.
5. She needs more than the drawer shows, so she clicks through to the full
   Agent Details page (Module 02) to see the Flight Recorder timeline around
   the quarantine event.
6. Back on the list, she multi-selects the 4 STAGING agents nobody's touched
   in 30+ days and exports them as CSV to send to the platform team for
   cleanup.
7. Later, a new team ships a Slack-drafting agent. Priya clicks **Register
   agent**, runs the wizard, and the agent lands in the table as `pending
   verification` until its first real call comes through.

## Screen hierarchy

```
/agents                          Agent Inventory (this doc)
  ├─ Quick View drawer            (right-side panel, opened from a row, no navigation)
  ├─ Register Agent wizard        (modal, multi-step)
  ├─ Bulk action confirmations    (Modal component)
  └─ → /agents/:id                Agent Details (Module 02 — next)
```

## Navigation

- **Sidebar**: unchanged — "Agents" under Operate, `Bot` icon, same position.
- **Breadcrumb**: none at this level (top-level page, same convention as
  Team/Integrations today). Agent Details introduces the first breadcrumb:
  `Agents / support-copilot`.
- **Header actions** (top-right of the page, not the global app header):
  `Register agent` (primary button) + a `⋯` overflow menu (Export all,
  Manage saved views, Column settings).
- **Deep links**: `/agents?risk=critical`, `/agents?status=quarantined`,
  `/agents?view=stale-staging` all pre-filter the table — this is how the
  KPI cards and any future dashboard "Top Risks" widget link in.

## Page anatomy

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Inventory                          [Register agent] [⋯]│
│  Every agent with runtime access, across every environment.   │
├─────────────────────────────────────────────────────────────┤
│  KPI strip (4 cards)                                          │
├─────────────────────────────────────────────────────────────┤
│  Toolbar: search · quick filters · advanced filters · views   │
├─────────────────────────────────────────────────────────────┤
│  Table                                                         │
├─────────────────────────────────────────────────────────────┤
│  Pagination                                                    │
└─────────────────────────────────────────────────────────────┘
```

Page shell: `mx-auto max-w-6xl px-6 py-8` — wider than settings pages since
this is a data-dense table screen (mirrors the width jump already made on
Billing when its two-column layout needed room).

### KPI strip

Four `Card` elements in a `grid grid-cols-4 gap-4`, each one **also a quick
filter** — clicking it applies the equivalent table filter, matching how
verdict chips work elsewhere in the console (color always paired with label,
never decoration).

| Card | Value (PROD, example) | Sub-label | Click behavior |
|---|---|---|---|
| Total agents | **31** | across 3 environments | clears filters |
| Active | **27** | font-machine, verdict-allow accent bar (`border-l-2 border-l-verdict-allow`) | `status=active` |
| Critical / high risk | **6** | verdict-block accent bar | `risk=high,critical` |
| Needs attention | **3** | quarantined + watch-only combined, verdict-escalate accent bar | `status=quarantined,watch_only` |

Card anatomy: `Card` with `p-5`, top line is the font-machine uppercase
label (`text-[10px] tracking-[0.14em] text-slate uppercase`), big number
below at `text-[28px] font-bold text-ink`, sub-label `text-[12px] text-slate`
underneath. Selected state (when its filter is active): `border-signal
ring-1 ring-signal/20`.

## The risk model (grounds every badge on this page)

AgentGuard's risk vocabulary is not a generic 0–100 score — it's built on the
**lethal trifecta** (Simon Willison's term, already a first-class field on
the `Agent` record: `hasLethalTrifecta: boolean`): an agent is critically
dangerous the moment it simultaneously has (1) access to private/sensitive
data, (2) exposure to untrusted content, and (3) a channel to communicate
externally or take irreversible action. Two of the three is manageable; all
three is where real incidents happen.

- **Risk band** (`low` / `medium` / `high` / `critical`) is the headline
  number — computed upstream from permissions + trifecta exposure + recent
  policy violations (that computation is Policy Engine's job, Phase 3; this
  module only *displays* the resulting band).
- **Lethal trifecta** is shown as its own indicator, separate from risk band,
  because it's the *reason* something is critical, not a duplicate of it — a
  `critical` agent without trifecta exposure (e.g. `underwriting-assistant`,
  critical purely from blast radius of a bad decision) needs a different
  conversation than one with it (e.g. `sales-outreach-agent`, critical
  because it reads CRM data, drafts from inbound email, and sends externally
  autonomously).

Trifecta indicator: a small `AlertTriangle` icon (verdict-block) inline next
to the agent name when `hasLethalTrifecta === true`, with a tooltip: "Has
access to private data, untrusted content, and external communication —
Simon Willison's lethal trifecta." This is the one piece of iconography this
module introduces beyond existing verdict chips, and it's load-bearing
enough to earn it.

## The table

### Columns

| Column | Content | Sort | Notes |
|---|---|---|---|
| *(checkbox)* | row select | — | header checkbox selects all on current page |
| Agent | icon chip + name (font-semibold) + purpose (slate, truncated) + trifecta icon if applicable | name, A–Z | primary click target → Agent Details |
| Environment | `DEV` / `STAGING` / `PROD` badge, font-machine | — | filter-only, not sortable (3 fixed values) |
| Connection | `mcp` / `python_sdk` / `typescript_sdk` / `proxy`, font-machine, slate | — | |
| Risk | verdict chip (reuses `riskBandClass` mapping already in `AgentList.tsx`) | risk band, high→low | |
| Status | verdict chip: active=allow, watch_only=sandbox, quarantined=block, decommissioned=slate/no color | status | |
| Calls (24h) | `callVolume24h.toLocaleString()`, right-aligned, font-machine | volume | |
| Last seen | relative time (`formatDate`/`formatTime` from `lib/preferences`, existing pattern) | recency | shows "Never" for agents with no `lastSeenAt` |
| Owner | avatar-initials chip + name (reuses the initials pattern from Team Members) | — | click → that user's Team Members row (deep link, doesn't leave list contextually — opens in the Team page) |
| *(row actions)* | `⋯` context menu | — | see Context menu below |

Column visibility, order, and width are user-configurable via the header
`⋯ → Column settings` popover (checkbox list + drag handles) — persisted per
user like `usePreferences()` already persists density/date-format.

### Sorting

Click a sortable header to sort; click again to reverse; a third click
clears back to default (Last seen, most recent first). Active sort shown via
a small triangle glyph next to the header label, `text-signal` when active.

### Filtering

**Quick filters** (chip row directly under the search box, same visual
pattern as the webhook-events picker on the Integrations page — bordered
buttons that fill signal-tinted when active, multi-select):
`Active` `Watch-only` `Quarantined` `Decommissioned` · `Low` `Medium` `High`
`Critical` · `Has trifecta exposure`.

**Advanced filters** (a `⋯ → Advanced filters` panel, or a `SlidersHorizontal`
icon button in the toolbar that opens an inline filter bar): connection
method, owner (typeahead against org members), created-date range, expires-
before-date, call volume threshold, "no activity in the last N days."
Combining filters is AND; combining values within one filter (e.g. two risk
bands) is OR — same logic as every multi-select chip picker already in the
product (webhook events, role permissions).

**Search**: single box, left-icon `Search`, searches name + purpose + agent
ID simultaneously, debounced 200ms, matches the search-input styling already
used in `MemberPicker` (Groups) and Header's global ⌘K box.

### Grouping

An optional "Group by" control (dropdown, top-right of the table, sparse
enough not to compete with the primary toolbar) — `None` (default) /
`Environment` / `Risk band` / `Owner`. Grouped mode inserts a sticky
sub-header row per group (`bg-surface-2`, font-machine uppercase label +
count) — same visual language as the Team page's "Operate" / "Workspace"
sidebar section labels, applied to table groups.

### Bulk actions

Appear as a slide-down action bar directly above the table the moment ≥1 row
is checked (`bg-signal/5 border border-signal/20`, matches the "active" tint
already used for selected KPI cards): selected count on the left, actions on
the right — `Quarantine selected` (destructive), `Move to watch-only`
(secondary), `Export selected` (secondary), `Assign owner` (secondary). Any
destructive bulk action routes through a `Modal` confirmation naming the
exact count and listing the first 5 affected agent names, matching the
`RevokeAllModal` pattern already built for the Organization Danger Zone.

### Pagination

Standard offset pagination, 25/50/100 rows-per-page selector bottom-left,
page controls bottom-right, `text-[12px] text-slate` "Showing 1–25 of 31."
No infinite scroll — security engineers need stable row positions to compare
before/after a filter change.

### Export / Import

**Export**: CSV or JSON, respects current filter + column visibility state
("export what I'm looking at"), triggered from the `⋯` header menu or the
bulk-action bar. No import — agents are registered one at a time through the
wizard or connected programmatically (SDK/MCP handshake), never bulk-CSV'd
in, since each one needs a real runtime connection to mean anything.

### Saved views

`⋯ → Manage saved views`. A saved view captures: active filters, sort,
grouping, visible columns. Users can save their own ("My flagged agents") and
org owners/admins can publish shared views visible to the whole team
("Compliance review queue"). Saved views appear as a horizontal tab strip
above the toolbar once ≥1 exists — `border-b-2 border-signal` for the active
one, plain `text-slate` otherwise (same active/inactive language as the
sidebar nav rows).

## Quick View drawer

Clicking a row's icon/name area (not the checkbox, not the `⋯`) slides a
right-side drawer in over the page (`w-[420px]`, `shadow-[var(--shadow-3)]`,
same slide-in motion class as any future drawer — `--dur-base` /
`--ease-out`) rather than navigating away, so Priya can triage many agents
without losing table scroll position and filter state.

Drawer contents: agent name + purpose + trifecta indicator at top, then a
compact key-value grid (environment, connection method, risk band, status,
owner, created, last seen, agent version hash in `font-machine`), then the
last 5 Flight Recorder events as a mini-timeline (full timeline lives in
Agent Details), then a footer with `Open full details →` (primary, navigates
to `/agents/:id`) and `Close` (ghost).

Closing: `Esc`, click the `X`, or click outside — identical behavior to the
`Modal` component already built for Groups/Billing.

## Register Agent wizard

Launched from the header's `Register agent` button. A `Modal`-based
multi-step flow — full workflow, no dead ends, matches the exact step
sequence already anchored in the product brief:

```
Identity → Assign Policy → Attach Tools → Configure Runtime → Review → Deploy → Success
```

**Step indicator**: horizontal stepper across the modal header, each step a
small circle + label; completed = filled signal, current = signal outline,
upcoming = slate outline. Font-machine numerals inside each circle.

1. **Identity** — Name, Purpose (textarea), Owner (typeahead, defaults to
   current user), Environment (segmented control DEV/STAGING/PROD).
2. **Assign Policy** — pick from existing policy sets (Policy Engine, Phase
   3) via a radio-card list, or start from a template ("Read-only," "Support
   agent," "No external comms"). Shows the resulting permission summary
   live as a preview panel on the right half of the modal.
3. **Attach Tools** — checklist of registered MCP servers/tools (MCP
   Registry, Phase 4) the agent may call. Each tool row shows its own
   trifecta-relevant flags (reads-private-data / untrusted-input /
   external-effect) so the risk consequence of each attachment is visible
   *before* confirming, not discovered after an incident.
4. **Configure Runtime** — connection method (mcp / python_sdk /
   typescript_sdk / proxy), expiry (optional date, "Never" default toggle),
   rate limits.
5. **Review** — read-only summary of all four prior steps in one scroll,
   each section with an `Edit` link that jumps back to that step without
   losing later-step input.
6. **Deploy** — shows the exact credential/connection string to embed in the
   agent's runtime (masked, reveal-once + copy, same pattern as the API Key
   secret reveal in `_app.developer.tsx`), plus a live "Waiting for first
   call…" indicator.
7. **Success** — confirmation state once the first real call is received (or
   a manual "Skip, I'll connect it later" escape hatch that leaves the agent
   in `pending verification`), with `View agent →` routing straight into
   Agent Details.

Cancelling at any step before Deploy discards the draft entirely — no
partial agents left behind in the table (this is a security registry, not a
form autosave situation).

## States

- **Loading**: table body shows a single centered row, `text-[13px]
  text-slate`, `"Loading agents…"` — identical convention to every other
  table in the product (no skeleton shimmer component exists or should be
  invented here).
- **Empty (zero agents in this environment)**: centered illustration-free
  message inside the `Card`, matching `AgentList`'s existing copy pattern —
  *"No agents connected in {environment}. Switch environments above, or
  register one to get started."* — with a `Register agent` button directly
  underneath.
- **Empty (filters return nothing)**: distinct from true-empty — *"No agents
  match these filters."* with a `Clear filters` ghost button. Never conflate
  "nothing exists" with "nothing matches" — they need different next actions.
- **Error** (list fetch fails): `Card` replaced with an inline error banner
  (`border-verdict-block/30 bg-verdict-block/10`, matches every other error
  banner in the console) — *"Couldn't load agents. [Retry]"* — table
  structure (header, toolbar) stays mounted so filters aren't lost.
- **Warning**: a dismissible banner above the KPI strip appears when >20% of
  PROD agents haven't reported in 7+ days ("Stale agent" health signal) —
  verdict-escalate styling, links to the pre-filtered "Needs attention" view.
- **Success (toast)**: bottom-right toast, `Card`-styled
  (`shadow-[var(--shadow-2)]`, sharp corners, auto-dismiss 4s, manual close
  x) for: agent registered, bulk action completed, export ready for
  download. Toasts stack, newest on top, max 3 visible.

## Context menu (row `⋯`)

`View details` · `Quick view` · `Edit policy assignment` · `Move to
watch-only` · `Quarantine` (destructive, red text) · `Export this agent` ·
divider · `Decommission` (destructive, requires typed-name confirmation via
`Modal`, same pattern as Organization deletion).

## Keyboard shortcuts

`⌘K` focuses global search (existing, header-level). Within the table:
`↑`/`↓` moves row focus, `Enter` opens Quick View, `Space` toggles row
checkbox, `⌘A` selects all visible rows, `Esc` closes the open
drawer/dropdown. Shortcut list surfaced via the existing `?` help pattern if
one exists elsewhere in the app; otherwise this is the first module to need
one and should introduce a simple `Kbd`-styled hint row at the bottom of the
table toolbar rather than a separate help overlay.

## Responsive behavior

- **Desktop (≥1280px)**: full table as specified.
- **Tablet (768–1279px)**: KPI strip becomes `grid-cols-2` (2×2), lower-
  priority columns (Connection, Owner) collapse into an expandable row
  (chevron toggle) rather than horizontal scroll, matching how the app
  already avoids side-scrolling tables elsewhere.
- **Mobile**: table becomes a stacked card list, one `Card` per agent (name +
  risk + status chip + last seen), tapping opens Quick View as a full-screen
  sheet instead of a side drawer. Bulk actions and advanced filters move
  behind a single `Filters` button. Given this is an engineer/CISO tool used
  primarily on desktop, mobile is "usable for a quick check," not a primary
  design target — no mobile-specific workflows beyond viewing.

## Accessibility

- Every verdict/status chip pairs color with text (already the house rule) —
  never relies on hue alone.
- Table is a real `<table>` with proper `<th scope="col">`, so screen readers
  get column context per cell — matches the existing `_app.developer.tsx`
  table.
- Row checkboxes have `aria-label="Select {agent name}"`.
- Drawer traps focus while open, returns focus to the triggering row on
  close.
- Trifecta warning icon has both a `title` tooltip and is never the *only*
  indicator of criticality — risk band chip + text always co-occur.
- Color contrast for all verdict tokens on `--paper` already meets the
  documented ratios in `tokens.css` (4.83:1 minimum) — no new colors
  introduced here, so no new contrast audit needed.

## Dummy data — Northbeam Financial (example tenant, PROD + STAGING + DEV)

| Agent | Env | Connection | Risk | Trifecta | Status | Calls/24h | Owner |
|---|---|---|---|---|---|---|---|
| `support-copilot` | PROD | mcp | Medium | ✓ | Active | 4,812 | Dana Reyes |
| `fraud-detection-agent` | PROD | python_sdk | High | — | Active | 118,204 | Marcus Webb |
| `underwriting-assistant` | PROD | mcp | Critical | ✓ | Active | 2,390 | Dana Reyes |
| `kyc-document-parser` | PROD | proxy | High | — | Watch-only | 6,041 | Marcus Webb |
| `internal-helpdesk-bot` | PROD | typescript_sdk | Medium | — | Active | 1,204 | Priya Nair |
| `marketing-content-agent` | PROD | mcp | Medium | ✓ | Active | 340 | Alan Cho |
| `sales-outreach-agent` | PROD | mcp | Critical | ✓ | **Quarantined** | 0 | Alan Cho |
| `data-pipeline-monitor` | PROD | python_sdk | Low | — | Active | 28,660 | Marcus Webb |
| `contract-review-agent` | PROD | mcp | High | — | Active | 512 | Dana Reyes |
| `expense-approval-agent` | PROD | proxy | Medium | — | Active | 890 | Priya Nair |
| `vendor-risk-scanner` | STAGING | python_sdk | Medium | — | Watch-only | 44 | Priya Nair |
| `release-notes-bot` | STAGING | python_sdk | Low | — | Active | 26 | Marcus Webb |
| `qa-test-generator` | DEV | typescript_sdk | Low | — | Active | 9 | Alan Cho |
| `legacy-migration-bot` | DEV | python_sdk | Low | — | Decommissioned | 0 | Marcus Webb |

`sales-outreach-agent`'s quarantine is the connective tissue back to the real
Danger Zone feature already shipped: its Quick View drawer's mini-timeline
shows *"Quarantined via bulk action — 'Q3 vendor incident response'"* with a
timestamp, giving the KPI strip's "Needs attention" card a concrete, grounded
story instead of an arbitrary demo number.

## Design notes (implementation-ready specifics)

- Reuse `riskBandClass` from `AgentList.tsx` verbatim for the Risk column
  chip — do not redefine the color mapping.
- New status→verdict mapping needed (`AgentStatus` → verdict token), not yet
  defined anywhere:
  `active → verdict-allow`, `watch_only → verdict-sandbox`,
  `quarantined → verdict-block`, `decommissioned → slate, no tint`.
- The environment badge is plain `font-machine text-[11px] text-slate
  uppercase`, no color — environment is a filter axis, not a verdict, and
  shouldn't visually compete with the ones that are.
- KPI cards' accent bar (`border-l-2 border-l-{token}`) is a new small
  pattern — first use of a left-border accent in the product; matches the
  billing card's `border-l-[3px] border-signal` treatment closely enough to
  read as the same design language, just applied to a smaller card.
- Existing `AgentList` component (`components/agents/AgentList.tsx`) is
  superseded by this table for `/agents` itself, but stays as-is for its
  current second use on the Overview dashboard (Module: Dashboard evolution,
  not in scope for this doc) — don't delete it.

## Enterprise considerations

- **Scale**: spec assumes pagination + server-side filter/sort from the
  start — a Fortune 500 tenant is realistically hundreds to low-thousands of
  agents per environment, not 14. The dummy table above is illustrative;
  real implementation must not client-side-filter a full unpaginated agent
  list.
- **Multi-tenant isolation**: every query implicitly scoped to the current
  organization (already the pattern for every real endpoint shipped this
  session) — no cross-org leakage risk to design around here since it's
  enforced at the data layer, not the UI.
- **RBAC**: Quarantine/Decommission/bulk actions should respect the same
  permission model already real in the product (`team.manage`-equivalent for
  agents would be a new `agents.manage` permission — already present in the
  real `PERMISSIONS` list shipped this session: `agents.view` /
  `agents.manage`). Viewer-role users see the table read-only, no checkboxes,
  no `⋯` destructive items.
- **Audit trail**: every state-changing action from this page (quarantine,
  decommission, bulk ops, policy reassignment) must produce a Flight
  Recorder / Audit Center (Phase 6) entry — this module doesn't render that
  log, but nothing here should be designed as a silent action.

## Future expansion

- Saved-view sharing permissions (view-only vs. editable shared views).
- A "compare two agents" side-by-side mode from multi-select.
- Inline risk-band override with required justification text (for security
  leads overriding an automated score) — needs a Policy Engine dependency
  first, deferred.
- Table density toggle already exists globally (`usePreferences().density`)
  — this module should honor it identically to how `AgentList` already does,
  no new density control needed.

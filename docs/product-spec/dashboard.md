# Module 02 — Dashboard (extension of an existing real page)

Route: `/` (existing route, `_app.index.tsx`). Today this page is a one-line
welcome header plus a reused `AgentList`. This spec extends it into the
executive command-center it needs to be — the page every persona (CISO,
security engineer, platform engineer) lands on before anything else. It does
not touch `_app.index.tsx`'s route, its position as the sidebar's default
"Overview" entry, or the global environment switcher it already reads from.

Continuity note: every number below is derived from the same 14-agent
Northbeam Financial roster established in
[`agent-inventory.md`](./agent-inventory.md), not invented fresh — a CISO
clicking from a Dashboard KPI into the Agent Inventory table should land on
numbers that actually match.

## Module goal

Answer three questions in under five seconds, before any click: **is
anything on fire right now, what changed since I last looked, and where
should I spend the next ten minutes.** Everything below serves one of those
three — nothing on this page is decorative.

## User journey

Priya (platform security engineer, from Module 01's journey) opens
AgentGuard first thing Monday morning.

1. Lands on `/`, **PROD** selected (environment persists from her last
   session — global header state, not page state).
2. KPI strip: 1 agent quarantined since Friday, 2 critical-risk agents, 3
   approvals waiting, 0 policy violations in the last 24h. Nothing new is on
   fire — the quarantine she already knows about from Friday.
3. The Risk & Volume trend chart shows a call-volume spike on
   `fraud-detection-agent` starting ~6am Sunday — unusual for a system that's
   normally flat overnight. She hovers the spike, sees the exact numbers.
4. She clicks through to `Top risks` and sees `fraud-detection-agent` sitting
   at #1 this week, whereas last week it was `underwriting-assistant`. Worth
   a look, not an emergency (risk band is still High, not newly Critical).
5. The Live Decision Feed is scrolling normally — mostly ALLOW, occasional
   ESCALATE, nothing repeatedly BLOCKed from one agent (which would suggest
   it's stuck retrying something it shouldn't).
6. She checks the Approvals Queue widget — 3 pending, all routine (expense
   threshold overrides), none aged past SLA. She approves one inline without
   leaving the dashboard.
7. Recommendations panel surfaces one actionable item: *"kyc-document-parser
   has been in Watch-only for 11 days — review and either promote to Active
   or decommission."* She snoozes it for a week; it's already on her list.
8. Satisfied nothing needs her in the next ten minutes, she moves to her
   actual task queue (Approvals, Module in Phase 3).

## Screen hierarchy

```
/                                 Dashboard (this doc)
  ├─ Approve/deny inline action    (from Approvals Queue widget, no navigation)
  ├─ Chart hover/tooltip           (in-place, no navigation)
  └─ → /agents?risk=critical       Top Risks widget rows link into Agent Inventory
  └─ → /agents/:id                 Live Decision Feed events link into Agent Details
  └─ → /approvals                  "View all" on Approvals widget (Phase 3, not yet speced)
  └─ → /audit                      "View all" on Activity Feed (Phase 6, not yet speced)
```

## Navigation

- **Sidebar**: unchanged — "Overview" is the existing top item, no new entry
  needed since `/` already exists.
- **Breadcrumb**: none — this is the app's root, same convention as today.
- **Header actions**: none added beyond what's already global (environment
  switcher, search, notifications, user menu all live in `Header.tsx` and
  aren't duplicated here).
- Every widget that references a future module (Approvals, Audit Center,
  Threat Detection) links out to that module's route even though the
  destination page itself isn't speced yet — this doc defines the *link*,
  not the destination.

## Page anatomy

```
┌──────────────────────────────────────────────────────────────┐
│  Welcome, Priya                    Northbeam Financial · PROD  │
│  1 agent needs attention · last checked 6 minutes ago          │
├──────────────────────────────────────────────────────────────┤
│  KPI strip (6 cards)                                            │
├───────────────────────────────────┬────────────────────────────┤
│  Risk & volume trend (chart)        │  Top risks (ranked list)   │
├───────────────────────────────────┼────────────────────────────┤
│  Live decision feed                  │  Approvals queue           │
├──────────────────────────────────────────────────────────────┤
│  Environment health strip (DEV / STAGING / PROD mini-cards)     │
├───────────────────────────────────┬────────────────────────────┤
│  Recent activity                     │  Recommendations           │
└───────────────────────────────────┴────────────────────────────┘
```

Page shell: `mx-auto max-w-6xl px-6 py-8`, same width as Agent Inventory
(this is the other data-dense page in the product). Widget rows use `grid
grid-cols-1 lg:grid-cols-2 gap-6`, same gap value already standard across
stacked-Card pages (Groups, Billing, Integrations).

### Header line

Keeps the existing warm, human welcome (`Welcome, {first name}`) — that
tone is worth preserving, it's the one moment in the product that isn't pure
instrument-panel. Subtitle changes from the current static agent count to a
one-line status synthesis: *"{n} agent{s} need attention · last checked {relative
time}"* when something needs attention, or *"All agents healthy · last
checked {relative time}"* (verdict-allow-tinted check icon) when clean. This
single line is the fastest possible answer to "is anything on fire."

## KPI strip

Six `Card`s, `grid grid-cols-6 gap-4` (collapses per Responsive behavior
below). Same anatomy as Agent Inventory's KPI cards (font-machine uppercase
label, big number, sub-label, left accent bar, click-to-filter) — this reuse
is deliberate, KPI cards should feel like the exact same component appearing
on two pages, not two similar-looking ones.

| Card | Value (Northbeam, PROD) | Accent | Click destination |
|---|---|---|---|
| Total agents | **10** | none | `/agents` |
| Active | **8** | verdict-allow | `/agents?status=active` |
| Critical risk | **2** | verdict-block | `/agents?risk=critical` |
| Pending approvals | **3** | verdict-escalate | `/approvals` (Phase 3) |
| Policy violations (24h) | **0** | verdict-allow (green when zero, block when >0) | `/audit?filter=violations` (Phase 6) |
| Quarantined | **1** | verdict-block | `/agents?status=quarantined` |

The Policy violations card is the one that *changes color based on value*
(only card that does) — zero is good news and should read as good news, not
sit in neutral gray next to genuinely alarming cards. This is a deliberate,
narrow exception to "verdict color always has fixed meaning," used only
here because the number's sentiment flips at zero, and it still pairs color
with an explicit number, never color alone.

## Risk & volume trend (chart)

**New primitive** — no chart component exists in the product yet. Visual
language, so it reads as this product's chart, not an imported library's
default look:

- Combo chart: risk-band distribution as a stacked area (four bands, colored
  with the exact verdict tokens already used for risk chips —
  `verdict-allow`/`verdict-sandbox`-adjacent scale isn't right for risk
  though, so risk bands use a dedicated 4-step ramp from `--slate` through
  `--verdict-escalate` to `--verdict-block`, staying inside the existing
  palette rather than introducing new hues) laid under a signal-blue line
  for total call volume.
- No gridlines except a single baseline (`border-rule`); axis labels
  `font-machine text-[10px] text-slate`, numbers `tabular-nums`.
- Sharp corners on the chart's containing `Card`; the plotted shapes
  themselves are naturally curved (a line chart can't have "sharp corners"
  in the geometric sense) — the no-rounding rule applies to UI chrome
  (containers, controls, chips), not data geometry, same way it doesn't
  apply to typography.
- Hover state: a vertical guide line (`--rule`, 1px) plus a small tooltip
  card (`shadow-[var(--shadow-2)]`, sharp corners, font-machine values)
  showing the exact date, call volume, and risk-band breakdown at that
  point.
- Range control top-right of the widget: `24h` `7d` `30d` `90d` as a
  segmented control, same visual pattern as the environment switcher
  (bordered button group, active = `bg-ink text-paper`).
- Empty state (agent too new for trend data): *"Not enough history yet —
  trends appear after 24 hours of activity."*

## Top risks

Ranked list (not a table — five rows max, "View all →" routes to
`/agents?sort=risk`), each row: rank number (font-machine, slate), agent
name + trifecta icon if applicable, risk band chip, a small delta indicator
(`↑`/`↓`/`—` vs. last week, verdict-colored) — this delta is the one thing
this widget has that the Agent Inventory table doesn't, since "what changed"
matters more here than the raw list.

1. `sales-outreach-agent` — Critical — quarantined, so shown with the
   quarantine chip instead of a delta (can't trend a stopped agent)
2. `underwriting-assistant` — Critical — `—` (unchanged)
3. `fraud-detection-agent` — High — `↑` (new this week, verdict-block delta)
4. `kyc-document-parser` — High — `—`
5. `contract-review-agent` — High — `↓` (verdict-allow delta, improved)

## Live decision feed

A scrolling, real-time-feeling list (poll or SSE-backed — this product
already has one working SSE channel for org events; the real Threat
Detection/Runtime engine, Phase 3, would publish onto the same kind of
channel) of the most recent verdicts across every agent. Each row: verdict
chip (`ALLOW`/`BLOCK`/`REDACT`/`ESCALATE`/`SANDBOX`, using the exact five
tokens already defined in `tokens.css`, including the provisional
`verdict-sandbox`), agent name, one-line action summary, relative timestamp.
Row click routes to that decision's detail in Flight Recorder (Phase 3, not
yet speced) with the specific event pre-selected.

Sample rows (grounded in the Northbeam roster):

```
ALLOW      support-copilot          Reviewed refund request #48221            12s ago
ESCALATE   underwriting-assistant   Loan recommendation flagged for review     2m ago
ALLOW      fraud-detection-agent    Scored transaction batch (auto)            3m ago
BLOCK      sales-outreach-agent     Attempted send — agent is quarantined      —  (last, before quarantine)
REDACT     support-copilot          Masked SSN in customer message draft       6m ago
```

Pauses on hover (so a security engineer reading one row isn't fighting a
live-updating list) with a small "3 new" pill that appears top of the feed
to resume — same non-disruptive-update pattern any production monitoring
tool needs, stated explicitly so it isn't missed in implementation.

## Approvals queue (preview)

Compact card list, 3 visible + "View all (3) →". Each row: requesting agent,
one-line description, age (`font-machine`, verdict-escalate if past SLA),
and two inline actions — `Approve` (secondary button) and `Review` (ghost,
routes to full Approvals page for anything non-trivial). Inline `Approve`
triggers a lightweight confirm via the existing `Modal` component (not a
full-page navigation) since approving from the dashboard should stay fast
for the routine cases, matching how Priya's journey above approves one
without leaving the page.

```
expense-approval-agent   Override: $4,200 expense over policy limit   1h    [Approve] [Review]
underwriting-assistant   Loan recommendation needs second sign-off    3h    [Approve] [Review]
contract-review-agent    Flagged clause needs legal confirmation      6h    [Approve] [Review]
```

## Environment health strip

Three compact `Card`s in a row (`grid grid-cols-3 gap-4`), one per
environment, always showing all three regardless of the currently-selected
global environment (this is the one widget that intentionally shows
everything at once — a CISO needs to know DEV is fine too, not just what
they happen to be filtered to). Each: environment name, agent count, a
single health chip (`Healthy` / `Needs attention` / `Critical`, verdict-
colored), and a mini sparkline of call volume (reuses the same chart visual
language as the main trend chart, no axis labels, just the shape).

| Environment | Agents | Health |
|---|---|---|
| PROD | 10 | Needs attention (1 quarantined) |
| STAGING | 2 | Healthy |
| DEV | 2 | Healthy |

Clicking a card sets the global environment switcher to that environment
and scrolls to top — the one place on this page that changes global state
rather than just filtering locally.

## Recent activity

Org-wide audit-adjacent feed, distinct from the Live Decision Feed (that one
is agent *runtime* events; this one is *administrative* events — who did
what to the system itself). Grounded entirely in real, already-shipped
features so it isn't inventing a new event type the backend doesn't
actually produce anything like:

```
Marcus Webb quarantined sales-outreach-agent            14h ago
Priya Nair invited alan.cho@northbeam.com as Admin       1d ago
Dana Reyes verified domain northbeam.com                 2d ago
Integration "PagerDuty" reconnected successfully          3d ago
Alan Cho accepted invitation, joined as Admin             4d ago
```

Five rows visible, "View all →" routes to Audit Center (Phase 6). This
widget is a natural, low-effort *first* real implementation target even
before Phase 3 ships, since every one of these event types already exists
as a real, working action in the product today (invites, role changes,
domain verification, integration status, org danger-zone actions) — it's a
UI over data that's already being written, not a new backend capability.

## Recommendations

A short, prioritized list (max 3) of proactive suggestions — the one place
on the dashboard that tells the user what to do next rather than just
reporting state. Each item: severity dot (verdict-colored), one-line
recommendation, `Act` / `Snooze` / `Dismiss` inline actions.

```
● kyc-document-parser has been in Watch-only for 11 days — review or decommission.     [Act] [Snooze] [Dismiss]
● 2 agents have runtime access but haven't made a call in 30+ days — consider decommissioning.  [Act] [Snooze]
● Domain verification is pending for northbeam.com — agent identity trust is weaker until verified.  [Act]
```

That third example directly reflects the real, working domain-verification
feature — if `session.organization.domainVerified` is false, this
recommendation is not a mock, it's a genuinely accurate nudge the real data
already supports today.

## States

- **Loading**: each widget independently shows its own `Loading…` text
  (not a full-page spinner) — widgets should populate as their data
  resolves rather than blocking on the slowest one, same principle as
  today's page not blocking the header on `listAgents()`.
- **Empty (brand new org, zero agents)**: the whole dashboard below the KPI
  strip collapses to a single centered `Card`: *"Register your first agent
  to start seeing activity here."* with a `Register agent` button — KPI
  strip still shows (all zeros), since an empty state shouldn't hide the
  page structure a returning user expects.
- **Error** (a widget's fetch fails): that widget alone shows an inline
  error banner in its `Card` with `Retry` — other widgets stay live. No
  single failed request should take down the whole dashboard.
- **Warning**: the header subtitle line itself doubles as the page-level
  warning state (see "Header line" above) — no separate banner needed.
- **Success (toast)**: approving/dismissing inline from a widget triggers
  the same bottom-right toast pattern defined in Agent Inventory — *"Expense
  override approved."*

## Responsive behavior

- **Desktop (≥1280px)**: full layout as diagrammed.
- **Tablet (768–1279px)**: KPI strip becomes `grid-cols-3` (2 rows of 3);
  two-column widget rows stack to single column in document order (chart →
  top risks → decision feed → approvals → activity → recommendations);
  environment health strip stays 3-across (it's already compact).
- **Mobile**: KPI strip becomes a horizontally-scrollable row of cards
  (swipe, not wrap — six cards wrapped to single column would push
  everything else below the fold); every other widget stacks full-width;
  chart range control collapses to a `Select` dropdown instead of a
  segmented control.

## Accessibility

- Chart data is also available as a table via a `View as table` toggle in
  the widget's `⋯` menu — a chart alone is never the only way to access
  its data.
- Live Decision Feed's auto-updating content uses `aria-live="polite"` only
  while not paused-on-hover, and never for the "3 new" resume pill itself
  (that's a discrete, user-triggered control, not an announcement).
- KPI card click targets meet the same 44px minimum touch target already
  used across the product's buttons.
- Environment health strip's color-only health dot always pairs with the
  text label (`Healthy`/`Needs attention`/`Critical`) — same house rule as
  everywhere else.

## Dummy data summary

All figures above are derived from the 14-agent Northbeam Financial roster
in `agent-inventory.md`, filtered to PROD (10 agents: 8 active, 1
watch-only, 1 quarantined; 2 critical risk, 3 high risk) unless the widget
explicitly spans all environments (Environment health strip). No new
fictional agents are introduced in this document.

## Design notes (implementation-ready specifics)

- KPI card component should be extracted as a shared component
  (`components/dashboard/KpiCard.tsx` or similar) since Agent Inventory and
  Dashboard now both need the identical visual/behavioral pattern — this is
  the first case in the spec so far where two modules converge on the same
  component, worth building once.
- The chart primitive (line + stacked area, tooltip, range selector) is the
  single biggest net-new engineering item introduced by this document.
  Recommend a lightweight, headless charting approach (e.g. a minimal SVG
  path renderer) over a heavy component library, so the sharp-corner/
  verdict-token/font-machine styling can be applied directly rather than
  fighting a third-party theme.
- Approvals widget's inline `Approve` reuses `Modal` for confirmation —
  don't build a second lightweight-confirm primitive; extend the existing
  one with a `size="sm"` compact variant if the full modal feels heavy for
  a one-line expense override (worth a real design review once Phase 3's
  Approvals module is speced in full, since the same interaction appears
  there at larger scale).

## Enterprise considerations

- **Personalization vs. shared truth**: KPI strip and health data must be
  identical for every user viewing the same org/environment (no
  per-user-filtered "your agents only" mode on this page) — Recommendations
  and Recent Activity are the only widgets that could reasonably scope to
  "relevant to me," and this doc deliberately keeps them org-wide too, so
  two engineers looking at the same dashboard during an incident see the
  same thing.
- **Real-time cost at scale**: Live Decision Feed for a tenant running
  millions of daily agent calls cannot literally stream every event — needs
  sampling/aggregation logic (a Phase 3/Runtime concern) so this widget
  shows "interesting" events (non-ALLOW, or ALLOW on a critical-risk agent)
  rather than a true firehose, even though it's presented as "live."
- **RBAC**: Viewer-role users see the full dashboard read-only (no inline
  Approve buttons, no dismiss/snooze on Recommendations) — matches the same
  permission boundary already defined for Agent Inventory.

## Future expansion

- Customizable widget layout (drag to reorder, hide/show) once the widget
  set stabilizes post-Phase-3.
- A dedicated "Incident mode" view that reorganizes the same widgets around
  a single active incident, surfaced automatically when a Critical-severity
  event fires (depends on Threat Detection, Phase 3).
- Cross-org executive rollup dashboard for holding-company/multi-subsidiary
  tenants (Phase 6, Governance) — out of scope for this single-org spec.

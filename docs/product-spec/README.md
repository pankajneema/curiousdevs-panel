# AgentGuard product spec

Forward-looking UX specification for the parts of AgentGuard that don't exist yet —
the actual security engine (Agent Inventory, Runtime, Policy, Threat Detection,
Flight Recorder, MCP/Tool/RAG security, Governance, and everything downstream).

**Scope boundary:** the console/account layer (Auth, Organizations, Team, Roles,
Groups, Billing, Integrations, Security settings) is real, working product built
directly in `frontend/` and `backend/` — not speculative. It is not re-specified
here. These documents focus on Phase 2 onward: the part that is currently an
honest "Coming Soon" placeholder in the sidebar. The one exception is
**Dashboard** — it already exists as a real (if minimal) page today, so its
document extends that real page into the full executive view rather than
designing it from nothing, the same way Agent Inventory extends the existing
`AgentList` component instead of replacing it outright.

**What these documents are:** implementation-ready UX specs — screen hierarchy,
components, table columns, states, workflows, realistic dummy data — written
so a frontend engineer can build the screen without design follow-up questions.

**What they are not:** code, API contracts, or database schemas. Every screen
described here extends the existing design system 1:1 — see
[`00-design-system-reference.md`](./00-design-system-reference.md) for the exact
tokens and component patterns every module must reuse.

## Modules

| # | Module | Status |
|---|--------|--------|
| 00 | [Design system reference](./00-design-system-reference.md) | done |
| 01 | [Agent Inventory](./agent-inventory.md) | done |
| 02 | [Dashboard](./dashboard.md) | done |
| 03 | Agent Details (Identity / Permissions / Secrets / Sessions / Credentials) | next |

# CuriosDevs Panel

The managed console for CuriosDevs products. AgentGuard first; CurioComply and AeroOS become modules in the same shell later.

**This is not a dashboard.** It is a security operations surface. Almost every screen is a view over the decision log. If you find yourself adding KPI cards and donut charts, check the design notes in `frontend/README.md` first.

---

## Layout

```
backend/     API for the console — reads the decision log, serves policy, runs approvals
frontend/    the console itself
infra/       terraform, networking, databases — what the thing runs on
deploy/      docker, compose, k8s manifests, CI pipelines — how it gets there
docs/        decisions and notes specific to this repo
```

Each directory has its own README explaining what belongs in it and what does not.

## What this repo is not

| | Where it lives |
|---|---|
| The AgentGuard engine, SDK, MCP wrapper | `agentguard` — public, Apache 2.0 |
| The **self-hosted** OSS console | also `agentguard` — single binary, no account, no cloud |
| Marketing website | `curiousdevs` |

The open-source console and this one share a design system, not a deployment. That split comes from the open-core business model: the free self-hosted console must run with no dependency on our cloud.

## Getting started

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The frontend runs entirely on mock data today (`src/lib/mock.ts`). No backend is required to develop against it. Swapping to the real API is a one-line change in `src/lib/api.ts`.

## Status

| Part | State |
|---|---|
| frontend | in progress — all P0 screens |
| backend | not started |
| infra | not started |
| deploy | not started |

## Reference

The product and design documents live in `CuriosDevs-Tracker`:

- **Product Definition & Build Plan** — what we build and when; work package IDs referenced in commits
- **HLD** — system structure, the five channels, the decision pipeline
- **LLD** — schemas this frontend renders (`CallContext`, `DecisionRecord`)
- **Adversarial Review** — why several UI rules exist; §2.12 and §11.2 are design requirements, not suggestions

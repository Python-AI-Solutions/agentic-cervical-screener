---
audience:
  - New contributors
  - Maintainers
  - Automation agents
owners:
  - "@Python-AI-Solutions/platform"
doc_version: 1.0.0
last_reviewed: 2025-11-12
update_triggers:
  - Commands or onboarding workflow changes
  - New documentation assets published
  - Responsive or accessibility guardrails updated
  - Metrics/automation scripts modified
anchor_slugs:
  - product-goals
  - architecture
  - references
  - tooling
  - responsive-ux-expectations
  - orientation-path
  - topic-to-doc-index
  - workflow-playbooks
  - maintenance
---

# Agentic Cervical Screener – Project Overview

This document captures the current product vision, architecture, and the primary references that define *how* we build and verify the application. Use it as the first stop when spinning up new contributors (human or agent) or when seeding downstream tools such as Specify.

---

## 1. Product Goals

| Goal | Description |
| --- | --- |
| Accurate Cytology Review | Provide a browser-based experience for exploring cervical cytology slides, overlaying AI detections/ground truth, and collecting human-labelled ROIs. |
| Consistent Multi-Device UX | The viewer must feel native on desktop, tablets, and narrow phones. Header actions and panels prefer to keep imagery visible, but when workflows demand full attention they may cover the canvas provided they offer obvious dismiss controls and instantly restore the prior view. |
| Deterministic Rendering | Coordinate transforms account for browser zoom, DPR, and Niivue canvas specifics so that images, overlays, and user-drawn ROIs align regardless of environment. |
| Inspectable Automation | Every critical workflow (image load, sidebar toggles, drawing, responsive header layout) is exercised by Playwright; the run produces cropped screenshots + JSON metrics so regressions are visible before deployment and assessment by small VLMs is incorporated into the test suite. |

## 2. Architecture (What & Where)

| Layer | Key Technologies | Location | Notes |
| --- | --- | --- | --- |
| Backend API | FastAPI + PyTorch | `agentic_cervical_screener/` | Loads YOLO-based classifiers and serves detections; managed via `pixi`. |
| Frontend Viewer | TypeScript, Vite, Niivue, Tailwind CSS Plus Elements | `frontend/` | Canvas + overlay managers control transforms, zoom/pan, rendering, and responsive layout. |
| Testing | Vitest (unit/integration), Playwright (E2E) | `frontend/src/**/*.test.ts` & `frontend/e2e/**/*.spec.ts` | Two-tier approach: logic/unit tests stay fast; Playwright covers real DOM interactions, mobile Safari, and responsive QA. |
| Documentation | Markdown | `docs/` | Referenced below. |

## 3. How We Work (Authoritative References)

| Topic | Source |
| --- | --- |
| Agent workflow, repo structure, run commands | [`AGENTS.md`](AGENT_GUIDE.md) |
| Test strategy, responsive artifacts, CLI invocations | [`docs/TESTING.md`](TESTING.md) |
| Browser zoom / transform history & do/don'ts | [`frontend/docs/ZOOM_ISSUES_AND_FIXES.md`](../frontend/docs/ZOOM_ISSUES_AND_FIXES.md) |

## Orientation Path

1. **Skim the README for architecture + demo context** – Start with [`README.md`](../README.md) to understand the end-to-end workflow and tooling. Run `pixi run dev` followed by `cd frontend && npm run dev` so both backend and frontend boot successfully.
2. **Read the Agent Development Guide and record onboarding metrics** – Follow [`AGENTS.md`](AGENT_GUIDE.md) to review conventions, then run `cd frontend && npm run docs:test` and `npm run docs:e2e` to capture the latest documentation evidence. Mentors log outcomes in `docs/metrics/onboarding-log.csv` (success flag must stay ≥90 %).
3. **Verify the testing + responsiveness toolchain** – Use [`docs/TESTING.md`](TESTING.md) to run `npm test`, `npm run test:e2e:ci`, and `npm run docs:vlm-review` so you have dual-layer + VLM evidence before editing the viewer. Always finish with `npm run docs:metrics` to catch stale onboarding entries or outdated `last_reviewed` metadata.

> **Logging Reminder**: Immediately after onboarding a new contributor, append a row to `docs/metrics/onboarding-log.csv` with the date, mentor, contributor, commands executed, and whether they completed the path successfully. This CSV powers the metrics gate enforced by `npm run docs:metrics`.

## 4. Tooling & Environments

- **Dependency management**: `pixi` orchestrates Python tasks; `npm` scripts manage the frontend.
- **Frontend tasks**:
  - `npm run dev` – Vite dev server
  - `npm test` – Vitest suite (headless)
 - `npm run test:e2e:ci` – Playwright (Chromium + Mobile Safari). Produces screenshots + metrics under `frontend/playwright-artifacts`.
- **Backend tasks**: see `AGENT_GUIDE` for `pixi run dev`, `pixi run test`, etc.

## Topic-to-Doc Index

| Topic | Use When | Primary Doc | Secondary / Artifacts |
| --- | --- | --- | --- |
| Architecture & Stack | Need repo layout and backend/frontend boundaries | [`README.md`](../README.md) | [`docs/project_overview.md#2-architecture-what-where`](#2-architecture-what--where) |
| Datasets & Demo Content | Need demo slides or static assets | [`public/`](../public) README | [`AGENTS.md`](AGENT_GUIDE.md#project-structure) |
| Responsive UX Rules | Implement or verify breakpoints, safe areas | [`docs/project_overview.md#5-responsive-ux-expectations`](#5-responsive-ux-expectations-best-practices) | [`frontend/docs/ZOOM_ISSUES_AND_FIXES.md`](../frontend/docs/ZOOM_ISSUES_AND_FIXES.md) |
| Testing & Evidence | Run Vitest/Playwright suites and log evidence | [`docs/TESTING.md`](TESTING.md) | `frontend/playwright-artifacts/`, `npm run docs:test` scripts |
| Automation & CI | Understand metrics, VLM audits, automation outputs | [`docs/project_overview.md#orientation-path`](#orientation-path) | `frontend/scripts/docs-overview-vlm.ts`, `docs/metrics/onboarding-log.csv` |
| Deployment | Update backend services or Docker images | [`Dockerfile`](../Dockerfile), [`deploy/`](../deploy) | `pixi run start`, `.dockerignore` guidelines |
| Data Governance | Reference update triggers, metadata owners | [`docs/project_overview.md#maintenance--update-workflow`](#maintenance--update-workflow) | YAML front matter (`audience`, `owners`, `update_triggers`) |
| Troubleshooting | Resolve onboarding/test failures | [`AGENTS.md#debugging`](AGENT_GUIDE.md#debugging) | `docs/metrics/onboarding-log.csv` notes, `frontend/e2e/docs-overview.spec.ts` artifacts |

## Workflow Playbooks

### New Contributor Playbook
1. Follow the Orientation Path above and run `pixi run dev`, `npm run dev`, `npm test`, `npm run test:e2e:ci`.
2. Execute `npm run docs:test`, `npm run docs:e2e`, `npm run docs:vlm-review`, and `npm run docs:metrics` so artifacts + metrics are up to date.
3. Add an onboarding log entry to `docs/metrics/onboarding-log.csv` (mentor + contributor) and confirm success is recorded.

### Spec Author Playbook
1. Read `docs/project_overview.md` (this file) and `docs/TESTING.md` before drafting new requirements.
2. Use the Topic-to-Doc table to cite canonical sources inside `/specs/.../spec.md`.
3. Run `npm run docs:test` + `npm run docs:e2e -- docs-overview.spec.ts` and attach artifacts to the spec/plan so reviewers can verify responsive/anchor expectations.

### Release Triage Playbook
1. Run `pixi run test` and `npm run test:e2e:ci` to ensure core pipelines pass.
2. Execute `npm run docs:metrics`; if onboarding success <90 % or `last_reviewed` is stale (>30 days), block the release and trigger documentation updates.
3. Capture the latest Playwright screenshots (`frontend/playwright-artifacts/docs-overview/*.png`) and VLM report to attach to the release notes.

## 5. Responsive UX Expectations (best practices)

**Global rules**
- Header height clamps between 56–64 px. Use CSS custom properties so Specify can sync token values, and ensure any full-height drawer leaves safe-area padding plus a visible close/back affordance so users can return to the canvas immediately.
- Tap targets and icon buttons respect a 44 px square hit area with 12 px gutter; focus outlines must meet WCAG 2.1 AA contrast.
- Brand lockup stays left-aligned, status pill anchors center, and critical actions align right; when drawers or panels expand over the Niivue canvas they must retain visible breadcrumbs (e.g., case id) and keep content clear of safe-area insets.
- When space is constrained, collapse labels before icons; show tooltip text on hover/focus, and provide ARIA labels for screen readers.

| Breakpoint | Expected Behavior |
| --- | --- |
| Desktop ≥ 1280 px | Header content (brand, status pill, primary + secondary actions) shares one row using inline flex with ≥ 16 px spacing. Hamburger remains hidden. Buttons never wrap and keep `min-width: clamp(160px, 12vw, 200px)`. |
| Tablet ≈ 834–1024 px | Hamburger appears at the far left. Actions stay on one row but may drop to icon-only buttons after 960 px. Status pill stays visible next to brand. Use CSS grid to keep the header ≤ 90 % viewport width so nothing touches screen edges. |
| Large phone ≈ 428 px | Hamburger + brand share the first row. Primary actions wrap to a second row with `min-width: 140px`; secondary actions collapse to icon-only chips. Maintain ≥ 24 px padding above the canvas so gesture bars never overlap controls. |
| Small phone ≈ 375 px | Header switches to a two-column stack: row one is hamburger + status, row two is a vertical action stack using full width, center-aligned. Icons always include text labels below 400 px to preserve clarity. |

These rules must be encoded in the Playwright “Mobile Responsiveness” suite; see `AGENT_GUIDE` and `TESTING` for assertion specifics and artifact locations.

## 6. Next Steps / Specify Integration

The cropped header screenshots emitted by Playwright (`frontend/playwright-artifacts/*.png`) are an example of how the UI/UX evaluation might work in conjunction with testing and assessment by small VLMs. Once Specify owns the canonical layout tokens, we can import those measurements into the Playwright suite to tighten the assertions even further.

---

Questions or discrepancies? Open an issue referencing this overview so we can update the downstream guides in sync.

## Maintenance & Update Workflow

1. **Run the full evidence stack** – `npm run docs:test`, `npm run docs:e2e -- docs-overview.spec.ts`, `npm run docs:vlm-review`, and `npm run docs:metrics`. These commands must pass (and artifacts uploaded) before any documentation PR merges.
2. **Update metadata + anchors** – bump `doc_version`, refresh `last_reviewed` (ISO format), and ensure `anchor_slugs` reflects every section enumerated in this file. If you add/remove headings, also update the Reference Anchors table below.
3. **Append onboarding log entry** – mentors record outcomes in `docs/metrics/onboarding-log.csv` immediately after each session so the ≥90% success window remains truthful.
4. **Attach artifacts to PRs** – include the latest Playwright screenshots (`frontend/playwright-artifacts/docs-overview/*.png`), JSON metadata, `vlm-report.md`, and the console output from `npm run docs:metrics`.

## Reference Anchors

| Anchor Slug | Section |
| --- | --- |
| `product-goals` | 1. Product Goals |
| `architecture` | 2. Architecture (What & Where) |
| `references` | 3. How We Work |
| `tooling` | 4. Tooling & Environments |
| `responsive-ux-expectations` | 5. Responsive UX Expectations |
| `orientation-path` | Orientation Path |
| `topic-to-doc-index` | Topic-to-Doc Index |
| `workflow-playbooks` | Workflow Playbooks |
| `maintenance` | Maintenance & Update Workflow |

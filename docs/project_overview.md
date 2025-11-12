# Agentic Cervical Screener – Project Overview

This document captures the current product vision, architecture, and the primary references that define *how* we build and verify the application. Use it as the first stop when spinning up new contributors (human or agent) or when seeding downstream tools such as Specify.

---

## 1. Product Goals

| Goal | Description |
| --- | --- |
| Accurate Cytology Review | Provide a browser-based experience for exploring cervical cytology slides, overlaying AI detections/ground truth, and collecting human-labelled ROIs. |
| Consistent Multi-Device UX | The viewer must feel native on desktop, tablets, and narrow phones. Header actions, status messaging, and mobile panels can never occlude core imagery. |
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
| Agent workflow, repo structure, run commands | [`docs/AGENT_GUIDE.md`](AGENT_GUIDE.md) |
| Test strategy, responsive artifacts, CLI invocations | [`docs/TESTING.md`](TESTING.md) |
| Browser zoom / transform history & do/don'ts | [`frontend/docs/ZOOM_ISSUES_AND_FIXES.md`](../frontend/docs/ZOOM_ISSUES_AND_FIXES.md) |

## 4. Tooling & Environments

- **Dependency management**: `pixi` orchestrates Python tasks; `npm` scripts manage the frontend.
- **Frontend tasks**:
  - `npm run dev` – Vite dev server
  - `npm test` – Vitest suite (headless)
  - `npm run test:e2e:ci` – Playwright (Chromium + Mobile Safari). Produces screenshots + metrics under `frontend/playwright-report/data`.
- **Backend tasks**: see `AGENT_GUIDE` for `pixi run dev`, `pixi run test`, etc.

## 5. Responsive UX Expectations (best practices)

**Global rules**
- Header height clamps between 56–64 px and remains sticky so gestures never occlude the canvas. Use CSS custom properties so Specify can sync token values.
- Tap targets and icon buttons respect a 44 px square hit area with 12 px gutter; focus outlines must meet WCAG 2.1 AA contrast.
- Brand lockup stays left-aligned, status pill anchors center, critical actions align right but never cover the Niivue canvas. Content respects safe-area insets.
- When space is constrained, collapse labels before icons; show tooltip text on hover/focus, and provide ARIA labels for screen readers.

| Breakpoint | Expected Behavior |
| --- | --- |
| Desktop ≥ 1280 px | Header content (brand, status pill, primary + secondary actions) shares one row using inline flex with ≥ 16 px spacing. Hamburger remains hidden. Buttons never wrap and keep `min-width: clamp(160px, 12vw, 200px)`. |
| Tablet ≈ 834–1024 px | Hamburger appears at the far left. Actions stay on one row but may drop to icon-only buttons after 960 px. Status pill stays visible next to brand. Use CSS grid to keep the header ≤ 90 % viewport width so nothing touches screen edges. |
| Large phone ≈ 428 px | Hamburger + brand share the first row. Primary actions wrap to a second row with `min-width: 140px`; secondary actions collapse to icon-only chips. Maintain ≥ 24 px padding above the canvas so gesture bars never overlap controls. |
| Small phone ≈ 375 px | Header switches to a two-column stack: row one is hamburger + status, row two is a vertical action stack using full width, center-aligned. Icons always include text labels below 400 px to preserve clarity. |

These rules must be encoded in the Playwright “Mobile Responsiveness” suite; see `AGENT_GUIDE` and `TESTING` for assertion specifics and artifact locations.

## 6. Next Steps / Specify Integration

The cropped header screenshots emitted by Playwright (`frontend/playwright-report/data/*.png`) are an example of how the UI/UX evaluation might work in conjunction with testing and assessment by small VLMs. Once Specify owns the canonical layout tokens, we can import those measurements into the Playwright suite to tighten the assertions even further.

---

Questions or discrepancies? Open an issue referencing this overview so we can update the downstream guides in sync.

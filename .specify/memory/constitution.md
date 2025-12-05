<!--
Sync Impact Report
Version change: 1.0.0 → 2.0.0
Modified principles:
- Deterministic Imaging Fidelity (clarified overlay allowance + recovery expectations)
- Responsive & Accessible Header-First UX (expanded to cover full-height panels)
Added sections:
- None
Removed sections:
- None
Templates requiring updates:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/tasks-template.md
Follow-up TODOs:
- None
-->
# Agentic Cervical Screener Constitution

## Core Principles

### Deterministic Imaging Fidelity (Non-Negotiable)
- Viewer, backend overlays, and ROI workflows MUST remain pixel-aligned across DPRs, browser zoom levels, and Niivue canvas states per `docs/project_overview.md` responsiveness table and `frontend/docs/ZOOM_ISSUES_AND_FIXES.md`.
- High-focus panels (drawers, command centers, annotation editors) MAY occupy most or all of the viewport when the task warrants it, but they MUST: clearly indicate the underlying slide state, provide an obvious dismiss/back action, restore the previous zoom/pan within 200 ms after closing, and expose shortcuts for jumping back to the imagery.
- Any transform, interpolation, or rendering change MUST ship with deterministic acceptance criteria (Vitest for math utilities, Playwright for rendered diffs) and linked documentation explaining how alignment is preserved.
**Rationale**: Clinicians cannot review cytology confidently unless geometry is stable and reproducible; allowing intentional occlusion keeps complex workflows possible while guaranteeing rapid, lossless recovery of the imaging context.

### Dual-Layer Evidence for Every Change
- Every user-visible change MUST include fast unit/integration coverage (`npm test`) for the logic path AND an automated Playwright journey that captures screenshots (stored under `frontend/playwright-report/`).
- Tests are written before implementation, committed alongside the code, and recorded in PR descriptions; no change merges until both layers fail before the fix and pass afterward.
- Backend routes and Pixi workflows follow the same rule using `pixi run test` for FastAPI/PyTorch code plus an integration assertion from the frontend consuming the new API shape.
**Rationale**: The product’s trust hinges on deterministic, reproducible evidence; pairing fast tests with captured browser proof prevents regressions and accelerates triage.

### Responsive & Accessible Header-First UX
- Apply the breakpoint rules in `docs/project_overview.md §5` exactly: header height clamp, single-row desktop layout, hamburger behavior on tablet, and mandatory ARIA labels.
- When panels/actions extend over the imagery, they must retain visible close affordances, maintain safe-area padding for gesture bars, and communicate context (e.g., “Case Management for DEMO-004”) so users always know what is hidden.
- Accessibility gates (WCAG 2.1 AA contrast, 44 px hit targets, focus outlines) are blocking; Playwright tests must assert header layout plus safe padding for desktop, tablet, large-phone, and small-phone runs, including screenshots of full-height panels.
**Rationale**: Screenings happen on a variety of devices in clinical settings; enforcing predictable layouts and escape hatches guarantees usability—even when high-density panels temporarily take over the screen.

### Clinical Safety, Data Stewardship, and Documentation
- Demo data stays in `public/` and is the ONLY dataset agents may ship by default; any new dataset or PHI-like content requires documented provenance and explicit approval.
- Follow Python typing + Ruff, TypeScript strict mode, and Tailwind conventions documented in `AGENTS.md`; deviations must be justified in-plan before work begins.
- Every feature update includes documentation touches (`README.md`, `docs/TESTING.md`, or feature-specific guides) so downstream teams and automated agents inherit accurate procedures.
**Rationale**: Handling medical imagery without disciplined documentation or data controls creates regulatory risk; codifying safety and documentation expectations avoids drift.

## Operational Constraints & Tooling
- **Stack**: FastAPI + PyTorch backend under Pixi, TypeScript/Vite frontend with Tailwind CSS Plus Elements, NiiVue viewer, Vitest + Playwright testing. New languages/frameworks require a justification recorded in the implementation plan’s Constitution Check.
- **Commands**: `pixi run dev/start/test`, `npm run dev/test/test:e2e:ci`, and automation scripts defined in `AGENTS.md` are canonical. Scripts must be referenced in specs and PR descriptions so reproduction is trivial.
- **Assets**: Only use checked-in static assets from `public/` during development and testing. Temporary assets belong in gitignored paths and must not ship in PRs.
- **Performance**: Niivue interactions must stay responsive (<16 ms frame budget) and backend inference latencies documented in `/model-info`; regressions demand plan-level mitigation before merge.

## Workflow & Review Process
- Every feature starts with a spec (`.specify/templates/spec-template.md`) that enumerates independent user stories plus deterministic success metrics, followed by a plan that documents Constitution Check outcomes and structure decisions.
- Tasks (`tasks.md`) stay grouped per user story, explicitly calling out required Vitest + Playwright coverage and the files they touch so reviewers can verify independence and completeness.
- Code reviews block on: passing dual-layer tests, evidence that responsive requirements remain intact (Playwright screenshots attached, including any full-height panels), and updated documentation covering behavioral changes.
- Runtime guidance lives in `AGENTS.md`, `docs/TESTING.md`, and `docs/project_overview.md`; reviewers ensure every change references or updates these sources when behavior shifts.

## Governance
- This constitution supersedes conflicting guidance. Amendments require: (1) opening a PR detailing the motivation, (2) updating all affected templates/guides in `.specify/templates/` and `docs/`, (3) bumping `Version` using semantic rules (MAJOR for breaking/removal, MINOR for new principles/sections, PATCH for clarifications).
- Ratification history is kept in-file; when amended, update `Last Amended` with the calendar date and summarize changes in the Sync Impact Report comment.
- Compliance reviews: Every `/speckit.plan`, `/speckit.spec`, and code review must cite Constitution Check outcomes. Release managers spot-audit the Playwright artifact folder and recent docs to confirm observability + responsive evidence exists.
- Violations pause delivery until rectified or a documented waiver with mitigation is filed; waivers expire after one release unless renewed with a new plan.

**Version**: 2.0.0 | **Ratified**: 2025-11-12 | **Last Amended**: 2025-11-12

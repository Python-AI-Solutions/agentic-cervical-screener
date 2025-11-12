<!--
Sync Impact Report
Version change: N/A → 1.0.0
Modified principles:
- [PRINCIPLE_1_NAME] → Deterministic Imaging Fidelity (Non-Negotiable)
- [PRINCIPLE_2_NAME] → Dual-Layer Evidence for Every Change
- [PRINCIPLE_3_NAME] → Responsive & Accessible Header-First UX
- [PRINCIPLE_4_NAME] → Inspectable Automation & Observability
- [PRINCIPLE_5_NAME] → Clinical Safety, Data Stewardship, and Documentation
Added sections:
- Operational Constraints & Tooling
- Workflow & Review Process
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
- Header, status, and action controls can never occlude diagnostic imagery; safe-area insets and 44 px tap targets are mandatory at every breakpoint.
- Any transform, interpolation, or rendering change MUST ship with deterministic acceptance criteria (Vitest for math utilities, Playwright for rendered diffs) and linked documentation explaining how alignment is preserved.
**Rationale**: Clinicians cannot review cytology confidently unless geometry is stable and reproducible; this principle makes fidelity a release gate rather than a best effort.

### Dual-Layer Evidence for Every Change
- Every user-visible change MUST include fast unit/integration coverage (`npm test`) for the logic path AND an automated Playwright journey that captures screenshots + JSON metrics (stored under `frontend/playwright-report/data`).
- Tests are written before implementation, committed alongside the code, and recorded in PR descriptions; no change merges until both layers fail before the fix and pass afterward.
- Backend routes and Pixi workflows follow the same rule using `pixi run test` for FastAPI/PyTorch code plus an integration assertion from the frontend consuming the new API shape.
**Rationale**: The product’s trust hinges on deterministic, reproducible evidence; pairing fast tests with captured browser proof prevents regressions and accelerates triage.

### Responsive & Accessible Header-First UX
- Apply the breakpoint rules in `docs/project_overview.md §5` exactly: header height clamp, single-row desktop layout, hamburger behavior on tablet, stacked actions on phones <400 px, and mandatory ARIA labels.
- Mobile gestures must never obscure the Niivue canvas; status pills and brand lockup positions are fixed per breakpoint, and action labels degrade gracefully (labels → icons) only when documented.
- Accessibility gates (WCAG 2.1 AA contrast, 44 px hit targets, focus outlines) are blocking; Playwright tests must assert header layout plus safe padding for desktop, tablet, large-phone, and small-phone runs.
**Rationale**: Screenings happen on a variety of devices in clinical settings; enforcing a predictable header-first layout guarantees usability and regulatory-ready accessibility evidence.

### Inspectable Automation & Observability
- Backend endpoints emit structured logs (request id, model version, inference latency, ROI counts) and expose `/healthz` plus `/model-info`; logs never include PHI but are detailed enough for audits.
- Frontend workflows record telemetry for image load, overlay toggles, ROI drawing, and responsive mode changes—hooked into the Playwright suite so failures include contextual metrics and cropped screenshots.
- Automation artifacts (screenshots, JSON metrics) are retained for every CI run and referenced in retrospectives when regressions slip through.
**Rationale**: AI-assisted screening demands explainability; observability and inspectable automation provide the audit trail regulators and clinicians expect.

### Clinical Safety, Data Stewardship, and Documentation
- Demo data stays in `public/` and is the ONLY dataset agents may ship by default; any new dataset or PHI-like content requires documented provenance and explicit approval.
- Follow Python typing + Ruff, TypeScript strict mode, and Tailwind conventions documented in `docs/AGENT_GUIDE.md`; deviations must be justified in-plan before work begins.
- Every feature update includes documentation touches (`README.md`, `docs/TESTING.md`, or feature-specific guides) so downstream teams and automated agents inherit accurate procedures.
**Rationale**: Handling medical imagery without disciplined documentation or data controls creates regulatory risk; codifying safety and documentation expectations avoids drift.

## Operational Constraints & Tooling
- **Stack**: FastAPI + PyTorch backend under Pixi, TypeScript/Vite frontend with Tailwind CSS Plus Elements, NiiVue viewer, Vitest + Playwright testing. New languages/frameworks require a justification recorded in the implementation plan’s Constitution Check.
- **Commands**: `pixi run dev/start/test`, `npm run dev/test/test:e2e:ci`, and automation scripts defined in `docs/AGENT_GUIDE.md` are canonical. Scripts must be referenced in specs and PR descriptions so reproduction is trivial.
- **Assets**: Only use checked-in static assets from `public/` during development and testing. Temporary assets belong in gitignored paths and must not ship in PRs.
- **Performance**: Niivue interactions must stay responsive (<16 ms frame budget) and backend inference latencies documented in `/model-info`; regressions demand plan-level mitigation before merge.

## Workflow & Review Process
- Every feature starts with a spec (`.specify/templates/spec-template.md`) that enumerates independent user stories plus deterministic success metrics, followed by a plan that documents Constitution Check outcomes and structure decisions.
- Tasks (`tasks.md`) stay grouped per user story, explicitly calling out required Vitest + Playwright coverage and the files they touch so reviewers can verify independence and completeness.
- Code reviews block on: passing dual-layer tests, evidence that responsive requirements remain intact (Playwright screenshots attached), updated documentation, and confirmation that observability hooks log the new workflow.
- Runtime guidance lives in `docs/AGENT_GUIDE.md`, `docs/TESTING.md`, and `docs/project_overview.md`; reviewers ensure every change references or updates these sources when behavior shifts.

## Governance
- This constitution supersedes conflicting guidance. Amendments require: (1) opening a PR detailing the motivation, (2) updating all affected templates/guides in `.specify/templates/` and `docs/`, (3) bumping `Version` using semantic rules (MAJOR for breaking/removal, MINOR for new principles/sections, PATCH for clarifications).
- Ratification history is kept in-file; when amended, update `Last Amended` with the calendar date and summarize changes in the Sync Impact Report comment.
- Compliance reviews: Every `/speckit.plan`, `/speckit.spec`, and code review must cite Constitution Check outcomes. Release managers spot-audit the Playwright artifact folder and recent docs to confirm observability + responsive evidence exists.
- Violations pause delivery until rectified or a documented waiver with mitigation is filed; waivers expire after one release unless renewed with a new plan.

**Version**: 1.0.0 | **Ratified**: 2025-11-12 | **Last Amended**: 2025-11-12

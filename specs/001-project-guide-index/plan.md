# Implementation Plan: Project Overview Guidance Index

**Branch**: `001-project-guide-index` | **Date**: 2025-11-12 | **Spec**: [`specs/001-project-guide-index/spec.md`](./spec.md)
**Input**: Feature specification from `/specs/001-project-guide-index/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Refresh `docs/project_overview.md` so it becomes the canonical orientation hub: add YAML metadata, a three-step onboarding path with required commands, a topic-to-doc index table, workflow playbooks, explicit maintenance rules, and machine-readable anchors. Back the document with automation—markdown validation tests, a Playwright journey that captures desktop/tablet/phone renders (including full-height drawers), a local LLava/Ollama VLM audit over the resulting screenshots/JSON, and metric scripts that verify onboarding success rates plus document freshness—to prove every edit keeps the new guidance accurate and accessible.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Markdown + TypeScript (Node 18 / Vite toolchain)  
**Primary Dependencies**: Existing docs under `docs/`, Vitest, Playwright, Niivue viewer context for screenshots, [Ollama](https://ollama.com) running a LLava-class model (invoked via the `llm` CLI) for artifact review, Node scripts under `scripts/docs/` for metrics  
**Storage**: Git-tracked CSV metrics in `docs/metrics/onboarding-log.csv` + YAML front matter freshness timestamps  
**Testing**: Vitest for markdown validation, Playwright for documentation render checks (desktop/tablet/phone)  
**Target Platform**: Web (GitHub-rendered docs + internal doc preview route in frontend)  
**Project Type**: Web/monorepo (FastAPI backend + Vite frontend; this feature touches docs + frontend test harness)  
**Performance Goals**: Documentation checks must run in <60s locally/CI; Playwright doc journey adds ≤10% to existing e2e runtime  
**Constraints**: Adhere to Constitution v2.0.0 (deterministic imaging fidelity, responsive occlusion rules, dual-layer evidence); no new datasets outside `public/`; tests must be headless-friendly; VLM evaluation must run on Apple Silicon with ≥16 GB RAM (Ollama + LLava); onboarding/freshness metrics scripts must run via `npm run docs:metrics` and fail CI when thresholds are unmet  
**Scale/Scope**: One markdown file + associated automation artifacts (1 Vitest suite, 1 Playwright spec, metadata consumed by future agents)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Document the status of each constitutional guardrail (Pass / Mitigation Plan / Blocker) and reference the files or tests that prove compliance:

1. **Deterministic Imaging Fidelity** – Documentation references Niivue behavior; we will add markdown validation ensuring every orientation step links to responsive guidance (e.g., `docs/project_overview.md §5`) and update Playwright to capture baseline + full-height panel screenshots so state restoration (dismiss controls, breadcrumbs) is visually verified.  
   - Status: Pass. Evidence: new Vitest `docs/__tests__/project_overview.index.test.ts`; Playwright `frontend/e2e/docs-overview.spec.ts` capturing before/after panel states.  
2. **Dual-Layer Evidence** – Fast tests (Vitest) validate structure/links; Playwright run records screenshots + JSON link inventory; the llm/Ollama pipeline (default `llava`) analyzes the artifacts for higher-level UX regressions (e.g., occlusion, readability) and emits a Markdown report that reviewers attach to PRs. All three scripts fail CI if mandatory sections, visuals, or VLM findings regress.  
   - Status: Pass (automated scripts documented in Quickstart).  
3. **Responsive & Accessible Header-First UX** – Plan includes mapping each user story to breakpoints, specifying when the Orientation Path or Index sections trigger drawers, and asserting safe-area padding + dismissal controls via Playwright snapshots (desktop/tablet/large-phone/small-phone).  
   - Status: Pass (tests provide evidence; doc text describes occlusion rationale).  
4. **Inspectable Automation & Observability** – Markdown validation logs missing anchors; Playwright exports JSON metadata under `frontend/playwright-artifacts/docs-overview/*.json`; onboarding/freshness scripts emit machine-readable reports to `docs/metrics/`. CI docs detail where artifacts live for audits.  
   - Status: Pass.  
5. **Clinical Safety, Data Stewardship, and Documentation** – All edits are to checked-in markdown; spec already requires cross-link updates to README / AGENT_GUIDE / TESTING; metrics CSVs contain no PHI.  
   - Status: Pass.

If any guardrail cannot be satisfied, capture the mitigation and secure approval before proceeding.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
docs/
├── project_overview.md
├── AGENT_GUIDE.md
├── TESTING.md
├── metrics/
│   └── onboarding-log.csv
└── __tests__/
    └── project_overview.index.test.ts   # new Vitest suite (Principle 2)

scripts/
└── docs/
    ├── onboarding-metrics.ts            # enforces ≥90% success rate
    └── check-doc-freshness.ts           # enforces YAML freshness window

frontend/
├── src/
│   └── routes/docs/
│       └── OverviewPreview.tsx          # lightweight page to render markdown in Playwright
├── e2e/
│   └── docs-overview.spec.ts            # new Playwright journey
├── scripts/
│   └── docs-overview-vlm.ts             # Node script that calls the llm CLI (Ollama/LLava) to score screenshots
└── playwright.config.ts                 # ensure doc journey + VLM artifacts run in CI

frontend/playwright-artifacts/
├── docs-overview/                       # JSON + screenshots + VLM findings (gitignored)
└── viewer/                              # Responsive audit screenshots + layout JSON
```

**Structure Decision**: Edit `docs/` markdown + tests, extend the frontend documentation preview route, and add a dedicated Playwright spec so both code and artifacts live beside existing viewer tests.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | – | – |

## Constitution Check (Post-Design)

1. **Deterministic Imaging Fidelity** – Research + data model lock anchors/breadcrumbs; Playwright doc journey (to be added at `frontend/e2e/docs-overview.spec.ts`) captures both unobstructed and full-height drawer states, ensuring Niivue context is recoverable.  
2. **Dual-Layer Evidence** – Vitest markdown parser test plus Playwright screenshots/JSON provide the two evidence layers; both are mandatory pre-merge steps outlined in `quickstart.md`.  
3. **Responsive & Accessible Header-First UX** – Orientation + Topic index reference breakpoint behavior from `docs/project_overview.md §5`; Playwright assertions include safe-area padding, dismissal controls, and ARIA labeling for the mock drawer.  
4. **Inspectable Automation & Observability** – Anchor JSON export records doc version + generation timestamp; research doc defines how logs/artifacts are stored for CI review.  
5. **Clinical Safety / Documentation** – All work remains within checked-in markdown and frontend test harness; Quickstart documents cross-link obligations so downstream guidance stays synchronized; metrics CSV/scripts live in-repo with no sensitive data.

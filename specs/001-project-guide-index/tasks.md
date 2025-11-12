---

description: "Task list for Project Overview Guidance Index feature"
---

# Tasks: Project Overview Guidance Index

**Input**: Design documents from `/specs/001-project-guide-index/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Dual-layer evidence + VLM audit + metrics scripts are mandatory. Every user story couples Vitest markdown parsing with Playwright renders, MLX-based VLM review, and (where applicable) onboarding/freshness scripts.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Present only for user story phases (US1/US2/US3)
- Always include explicit file paths

## Constitution Hooks

- Deterministic imaging fidelity: Playwright + VLM tasks assert baseline and full-height drawer states with visible dismiss controls.
- Dual-layer evidence: Each story includes Vitest + Playwright + VLM tasks; metrics scripts act as additional enforcement for onboarding/freshness success criteria.
- Responsive/accessibility: Tasks explicitly mention breakpoints, ARIA labels, safe-area padding, and breadcrumbs when panels cover imagery.
- Documentation stewardship: Tasks update README, `AGENTS.md`, `docs/TESTING.md`, and metrics CSV/scripts so downstream teams inherit the new workflow.

---

## Phase 1: Setup (Shared Infrastructure)

 - [X] T001 Update `frontend/package.json` + `package-lock.json` to add `gray-matter`, `remark-parse`, `mdast-util-find`, `yaml`, MLX helpers, and CSV tooling needed by scripts/docs.  
 - [X] T002 Add npm scripts (`docs:test`, `docs:e2e`, `docs:vlm-review`, `docs:metrics`) in `frontend/package.json`, wiring them to Vitest, Playwright, VLM, and metrics scripts respectively.  
 - [X] T003 Document prerequisites (Apple Silicon MLX install, metrics command usage) in `AGENTS.md` under the development workflow section.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T004 Implement FastAPI endpoints in `agentic_cervical_screener/main.py` to serve `/docs/project-overview` HTML and `/docs/project-overview/anchors` JSON per `contracts/docs-overview.openapi.yaml`.  
 - [X] T005 Create `frontend/src/routes/docs/OverviewPreview.tsx` (and register it) so Playwright/VLM render the markdown within the standard header + Case Management drawer shell.  
 - [X] T006 Update `frontend/playwright.config.ts` with a dedicated `docs-overview` project, device profiles (desktop/tablet/large-phone/small-phone), screenshot/JSON output path `frontend/playwright-artifacts/docs-overview/`, and retry/timeout settings.  
 - [X] T007 Scaffold `docs/__tests__/project_overview.index.test.ts` with shared helpers (gray-matter + remark) to read YAML front matter, lists, and tables.  
 - [X] T008 Scaffold `frontend/e2e/docs-overview.spec.ts` to visit the preview route, toggle the mock Case Management drawer, and persist baseline screenshots + DOM snapshots for each breakpoint.  
 - [X] T009 Implement `frontend/scripts/docs-overview-vlm.ts` (TypeScript) that shells out to `python -m mlx_lm.generate --model mlx-community/llava-phi-3-mini-4k`, feeds Playwright artifacts, and emits `frontend/playwright-artifacts/docs-overview/vlm-report.md`.  
 - [X] T010 Implement `scripts/docs/onboarding-metrics.ts` to parse `docs/metrics/onboarding-log.csv`, compute success ratio for the most recent 10 entries, and exit non-zero if <90%.  
 - [X] T011 Implement `scripts/docs/check-doc-freshness.ts` to parse `docs/project_overview.md` YAML front matter and fail when `last_reviewed` is older than 30 days; ensure `npm run docs:metrics` runs both metrics scripts.  
 - [X] T012 Create `docs/metrics/onboarding-log.csv` with headers (`date,mentor,contributor,commands_ran,success,notes`) and add README instructions describing how to append entries after each onboarding session.

**Checkpoint**: Backend preview endpoints, frontend route/config, Vitest/Playwright harnesses, VLM pipeline, and metrics scripts/log templates exist—user stories can start.

---

## Phase 3: User Story 1 – Guided Onboarding Path (Priority: P1) 🎯 MVP

**Goal**: Deliver a three-step Orientation Path with canonical commands, cross-links, onboarding logging instructions, and automated evidence (Vitest + Playwright + VLM + metrics script).

**Independent Test**:
- `npm run docs:test -- --runTestsByPath docs/__tests__/project_overview.index.test.ts` (Orientation assertions)
- `npm run docs:e2e -- docs-overview.spec.ts` (desktop/tablet/phone orientation callouts)
- `npm run docs:vlm-review` (Orientation portion of `vlm-report.md` clean)
- `npm run docs:metrics` (ensures onboarding log success ratio ≥90%)

### Tests for User Story 1

- [X] T013 [P] [US1] Extend `docs/__tests__/project_overview.index.test.ts` to assert exactly three Orientation steps, presence of command snippets, and valid relative links (README, AGENT_GUIDE, TESTING).  
- [X] T014 [P] [US1] Enhance `frontend/e2e/docs-overview.spec.ts` to pin Orientation callouts above the fold across all breakpoints and export `orientation.json` with bounding boxes + breadcrumb metadata.  
- [X] T015 [P] [US1] Update `frontend/scripts/docs-overview-vlm.ts` to tag Orientation findings and fail on any medium-plus occlusion/readability issue.

### Implementation for User Story 1

- [X] T016 [US1] Rewrite the Orientation Path section in `docs/project_overview.md` with the three prescribed steps, rationale text, and embedded command blocks.  
- [X] T017 [US1] Cross-link `README.md` Quick Start entries back to `docs/project_overview.md#orientation-path`.  
- [X] T018 [US1] Update `AGENTS.md` onboarding section with the new Orientation anchors and clarify how to log onboarding outcomes.  
- [X] T019 [US1] Update `docs/TESTING.md` intro to reference the Orientation Path for locating CLI usage and responsive evidence expectations.  
- [X] T020 [US1] Populate `docs/metrics/onboarding-log.csv` with at least 5 historical sample rows and document the logging procedure inside `docs/project_overview.md` so mentors know how to record success/failure.

**Checkpoint**: Orientation Path documented, linked, logged, and validated via Vitest + Playwright + VLM + metrics scripts.

---

## Phase 4: User Story 2 – Topic-to-Doc Index (Priority: P2)

**Goal**: Publish a comprehensive Topic-to-Doc index plus workflow playbooks, with automation capturing visibility and link metadata.

**Independent Test**:
- `npm run docs:test` (table + playbook assertions)
- `npm run docs:e2e -- docs-overview.spec.ts` (scrolling verification, breadcrumbs)
- `npm run docs:vlm-review` (table/playbook readability)

### Tests for User Story 2

- [X] T021 [P] [US2] Extend `docs/__tests__/project_overview.index.test.ts` to require the Topic-to-Doc table (≥8 rows, required columns) and verify at least three workflow playbooks exist.  
- [X] T022 [P] [US2] Enhance `frontend/e2e/docs-overview.spec.ts` to scroll through the table/playbooks, assert dismiss controls remain visible on mobile, and emit `reference-index.json` with all href targets.

### Implementation for User Story 2

- [X] T023 [US2] Author the Topic-to-Doc index table in `docs/project_overview.md`, covering architecture, datasets, responsive UX, testing, automation, deployment, data governance, and troubleshooting.  
- [X] T024 [US2] Add “Workflow Playbooks” (new contributor, spec author, release triage) describing document sequences and referencing responsive/observability checkpoints.  
- [X] T025 [US2] Update the Playwright JSON exporter/scroll helper (`frontend/e2e/docs-overview.spec.ts`) to capture breadcrumbs when the Case Management drawer overlays content while the index is in view.

**Checkpoint**: Maintainers can locate any topic/doc within 30 seconds using the validated table/playbooks; artifacts capture responsive states.

---

## Phase 5: User Story 3 – Automation Anchors & Maintenance Guardrails (Priority: P3)

**Goal**: Provide machine-readable metadata, reference anchors, maintenance/update workflow, and enforcement scripts (VLM + metrics).

**Independent Test**:
- `npm run docs:test` (metadata + anchor assertions)
- `npm run docs:e2e -- docs-overview.spec.ts` (metadata callout safe-area checks)
- `npm run docs:vlm-review` (metadata/drawer readability)
- `npm run docs:metrics` (freshness script verifies `last_reviewed`)

### Tests for User Story 3

- [X] T026 [P] [US3] Extend `docs/__tests__/project_overview.index.test.ts` to validate YAML keys (`audience`, `owners`, `doc_version`, `last_reviewed`, `update_triggers`, `anchor_slugs`) plus the Reference Anchors section alignment.  
- [X] T027 [P] [US3] Update `frontend/e2e/docs-overview.spec.ts` to capture metadata callout screenshots, confirm safe-area padding while the Case Management drawer is open, and persist anchor inventories to `frontend/playwright-artifacts/docs-overview/anchors.json`.

### Implementation for User Story 3

- [X] T028 [US3] Insert YAML front matter, Maintenance & Update Workflow, and Reference Anchors sections into `docs/project_overview.md`, syncing anchor slugs + `doc_version`/`last_reviewed`.  
- [X] T029 [US3] Extend `frontend/scripts/docs-overview-vlm.ts` to merge Vitest/Playwright outputs, annotate findings by severity, and fail the process when metadata/maintenance sections trigger medium-or-higher issues.  
- [X] T030 [US3] Update `scripts/docs/check-doc-freshness.ts` to compare `last_reviewed` against the repo’s latest tag (or fallback to 30-day window) and document the behavior in `docs/project_overview.md`.

**Checkpoint**: Automation agents consume metadata/anchors, maintenance workflow is codified, and scripts enforce freshness + VLM quality.

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T031 Regenerate quickstart guidance (`specs/001-project-guide-index/quickstart.md` and `AGENTS.md`) to mention the new `npm run docs:metrics` command and onboarding/freshness scripts.  
- [ ] T032 Verify `contracts/docs-overview.openapi.yaml` stays in sync with the implemented FastAPI routes (fields, examples, response schema) and update as needed.  
- [ ] T033 Update `docs/project_overview.md` metadata (`last_reviewed`, `doc_version`) and attach Playwright screenshots + `vlm-report.md` summary + metrics command outputs to the PR checklist template.

---

## Phase 6: Viewer Responsive Audit (New)

**Purpose**: Extend automation beyond documentation to cover the actual viewer shell so screenshots/MLX findings catch UI regressions like stacked buttons and obscured canvases.

### Tests for Viewer Audit

- [X] T034 [P] Create `frontend/e2e/viewer-responsive.spec.ts` that loads the main viewer (`/`) and captures header/actions/canvas states at desktop/tablet/large-phone/small-phone, storing screenshots/JSON under `frontend/playwright-artifacts/viewer/`.  
- [X] T035 [P] Update `frontend/playwright.config.ts` to add viewer-specific projects (mirroring docs-overview) and ensure tests only run when backend endpoints are available or stubbed.

### Implementation for Viewer Audit

- [X] T036 Add utilities in `frontend/src/test/viewer-fixtures.ts` (or equivalent) to seed demo cases and expose selectors for header/actions/canvas/drawer so Playwright scripts can assert safe-area padding.  
- [X] T037 Extend `frontend/scripts/docs-overview-vlm.ts` (or create `frontend/scripts/viewer-vlm.ts`) to ingest viewer screenshots/JSON, tag findings (e.g., `[Viewer-Desktop]`), and fail CI on medium+ issues.  
- [X] T038 Update `README.md`, `AGENTS.md`, and `specs/001-project-guide-index/quickstart.md` to mention the new viewer audit commands (`npm run docs:e2e -- viewer-responsive.spec.ts`, `npm run docs:vlm-review -- --suite viewer`).  
- [X] T039 Wire the viewer audit into `npm run docs:metrics` summary output (or CI checklist) so reviewers must attach viewer screenshots + VLM notes in addition to documentation evidence.

---

## Dependencies & Execution Order

- **Phase Dependencies**: Setup → Foundational → US1 → US2 → US3 → Polish. Foundational tasks block all user stories because they supply the preview route, automation scripts, and metrics pipelines.
- **User Story Graph**: `US1 (Orientation + logging)` → `US2 (Index)` → `US3 (Automation metadata)`; later stories consume artifacts from earlier ones (Orientation anchors feed the index; metadata relies on Orientation + Index content).
- **Parallel Opportunities**:
  - T001 and T002 can run concurrently; T003 depends on T002.
  - Foundational scripts (T009–T012) can proceed in parallel once npm deps (T001) land.
  - Within US1, tests (T013–T015) can run in parallel with doc edits (T016–T020) once shared parsers exist.
  - US2 table authoring (T023) and Playwright enhancements (T022/T025) touch different files and can run concurrently.
  - US3 metadata edits (T028) can proceed while VLM/freshness enforcement (T029–T030) are implemented, provided the Vitest assertions (T026) are ready.
- **Implementation Strategy**:
  1. MVP = US1 (Orientation Path + onboarding logging + evidence stack + metrics scripts) so contributors have a reliable entry point.
  2. Increment 2 = US2 (Topic index + workflow playbooks + responsive evidence).
  3. Increment 3 = US3 (Automation metadata/anchors + maintenance guardrails).
  4. Polish = finalize docs/quickstart/contract references and attach artifacts for review.

---

## Parallel Example: User Story 1

```bash
# Terminal 1 – Vitest assertions
npm run docs:test -- --runTestsByPath docs/__tests__/project_overview.index.test.ts

# Terminal 2 – Documentation + metrics updates
code docs/project_overview.md README.md AGENTS.md docs/TESTING.md docs/metrics/onboarding-log.csv

# Terminal 3 – Playwright + VLM + metrics scripts
cd frontend && npm run docs:e2e -- docs-overview.spec.ts && npm run docs:vlm-review
npm run docs:metrics
```

# Tasks: Project Overview Guidance Index

**Input**: Design documents from `/specs/001-project-guide-index/`

**Prerequisites**: `plan.md`, revised `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Each user story pairs fast unit/integration coverage (Vitest/pytest) with Playwright journeys that emit screenshots + DOM assertions consumed by CI and the Python VLM audit.

**Organization**: Tasks are grouped by phase and mapped to user stories so increments stay independently shippable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Lock down the demo case assets and shared configs referenced throughout the feature.

- [ ] T001 Verify `public/mock/case-demo.json` and related PNG overlays include orientation, pixel spacing, stain metadata, and checksum notes aligned with README instructions.
- [ ] T002 [P] Add demo-slide metadata comment block to `frontend/src/services/cqaiClient.ts` documenting which case IDs map to canonical assets for tests.
- [ ] T003 [P] Capture Niivue version + DPR tolerances in `frontend/src/viewer/config/constants.ts` for reuse across modules and tests.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities/tests every story depends on (demo metadata parsers, responsive helpers, artifact scaffolding).

**⚠️ CRITICAL**: Complete before starting user story work.

- [ ] T004 Create demo-case metadata parser + TypeScript types in `frontend/src/viewer/data/demoCase.ts`.
- [ ] T005 [P] Add Vitest harness utilities (DPR mocks, Niivue canvas shim) in `frontend/src/viewer/__tests__/setup.ts`.
- [ ] T006 [P] Build Playwright artifact helper that ensures screenshots land under `frontend/playwright-report/viewer/` with consistent naming (device + breakpoint) and writes a simple manifest file in `frontend/e2e/utils/artifacts.ts`.

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 – Deterministic Viewer Launch & Demo Slide Integrity (Priority: P1) 🎯 MVP

**Goal**: Contributors running the README commands load the existing demo slide with deterministic overlays/ROI math and responsive safe areas where controls show/hide exactly as the design intends.

**Independent Test**: Vitest validates demo metadata + ROI math; Playwright `frontend/e2e/viewer.spec.ts` (or consolidated successor) bootstraps desktop/tablet/phone layouts, asserts header/tool buttons/toggles/canvas bounds behave per layout rules (visible when expected, properly collapsed when not), and stores screenshots for review; manual logging confirms launch timing stays within tolerances.

### Tests for User Story 1

- [ ] T008 [P] [US1] Write Vitest coverage (`frontend/src/viewer/__tests__/demoCase.test.ts`) asserting metadata parsing, DPR drift math, and ROI overlay alignment for the demo slide.
- [ ] T009 [P] [US1] Update `frontend/e2e/viewer.spec.ts` to capture multi-breakpoint screenshots, assert buttons/toggles/drawers/canvas bounds behave per layout rules, and (on phone projects) draw a user ROI then save `viewer-mobile-roi.png` so downstream audits can confirm the ROI remains visible.

### Implementation for User Story 1

- [ ] T010 [US1] Wire the demo-case parser into `frontend/src/viewer/index.ts` and `frontend/src/viewer/StateManager.ts` so Niivue loads canonical defaults and restores zoom/pan after resize in ≤200 ms.
- [ ] T011 [US1] Ensure overlay/ruler transforms honor the shared constants by refactoring `frontend/src/viewer/CanvasManager.ts` and `frontend/src/viewer/OverlayRenderer.ts`.
- [ ] T012 [US1] Update README.md + `docs/TESTING.md` with the current “clone + pixi run dev / cd frontend && pixi run dev” instructions plus pointers to the demo case artifacts.

**Checkpoint**: User Story 1 is fully testable and demonstrable; screenshots + Playwright assertions confirm deterministic layouts.

---

## Phase 4: User Story 2 – CI Evidence Hardening & Python VLM QC (Priority: P2)

**Goal**: Keep deterministic Vitest + Playwright evidence as the primary CI gate while wiring the existing Python-based VLM audit to the captured screenshots for secondary qualitative review.

**Independent Test**: Playwright produces assertion-rich runs plus screenshot manifests for the VLM script; pytest suites verify parsing/adjustments; the Python CLI fails when llava reports issues and writes `frontend/playwright-report/vlm-report.md`.

### Tests for User Story 2

- [ ] T013 [P] [US2] Extend pytest coverage in `frontend/scripts/test_vlm_viewer_audit.py` to validate bundle validation, JSON parsing, severity adjustments, error surfaces for missing screenshots, and the air-gapped/missing-model/CLI scenario.
- [ ] T014 [P] [US2] Add Playwright regression covering artifact bundle completeness (expected screenshots captured for each project/breakpoint) in `frontend/e2e/viewer-responsive.spec.ts` or a shared helper.

### Implementation for User Story 2

- [ ] T015 [US2] Enhance `frontend/scripts/vlm_viewer_audit.py` with bundle validation (ensuring expected screenshot filenames exist per breakpoint), improved CLI output, configurable model names, and contextual prompt instructions (e.g., flag missing user ROIs on the `viewer-mobile-roi.png` screenshot) plus a graceful error when the configured `llm` binary or model is absent.
- [ ] T016 [US2] Update `frontend/pixi.toml` so `pixi run vlm-viewer` consistently invokes the local `llm` CLI (mlx_vlm plugin) without relying on extra documentation touchpoints.
- [ ] T017 [US2] Ensure Playwright runs drop the screenshot manifest under `frontend/playwright-report/` using the helper from T006 so the Python script consumes consistent paths.

**Checkpoint**: Python VLM pipeline consumes the refreshed artifacts, pytest + Playwright coverage passes, and CI fails on medium-or-higher findings.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T018 [P] Align quickstart validation checklist (`specs/001-project-guide-index/checklists/requirements.md`) with the updated demo-case + VLM workflows.
- [ ] T019 Document artifact locations and failure triage steps in `docs/TESTING.md` without introducing new documentation surfaces.
- [ ] T020 [P] Add CI workflow `.github/workflows/viewer-evidence.yml` chaining `pixi run test`, `cd frontend && pixi run test`, `pixi run test-e2e-ci`, and `cd frontend && pixi run vlm-viewer`, uploading `frontend/playwright-report/`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup** → **Foundational** → **US1** → **US2** → **Polish**
- Foundational tasks rely on the shared constants/assets from Setup.
- US1 requires Foundational utilities before deterministic viewer work.
- US2 depends on US1 artifacts for the Python VLM pipeline.
- Polish waits until both stories are complete.

### User Story Dependencies

- **US1**: Requires demo-case metadata utilities, responsive constants, and test harnesses.
- **US2**: Requires US1’s deterministic viewer + Playwright artifacts to feed the Python VLM script.

### Within Each User Story

- Run tests first (Vitest/Playwright or pytest) to capture current failures before implementation.
- Implement viewer/data changes before touching documentation to avoid stale instructions.
- For US2, ensure Playwright artifact generation lands before enhancing the Python audit runner.

---

## Parallel Execution Examples

- **setup/foundational**: T002 and T003 modify different files, so they can proceed alongside T001. T005 and T006 are independent utilities and can be executed simultaneously once T004 exists.
- **US1**: T008 (Vitest) and T009 (Playwright) both rely on the demo-case parser, so start T010 first; once parser wiring lands, tests and overlay refactors (T011) can proceed together.
- **US2**: T013 (pytest) and T014 (Playwright artifact validation) can run in parallel. T015 (Python script updates) is independent from T017’s Playwright artifact wiring as long as the bundle schema is defined up front.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup (T001–T003) and Foundational (T004–T006).
2. Deliver US1 tasks (T008–T012) to obtain deterministic viewer launch + responsive evidence.
3. Validate with Vitest and Playwright before moving on.

### Incremental Delivery

1. After MVP validation, implement US2 (T013–T017) to solidify the Python VLM pipeline.
2. Finish with Polish (T018–T020) to align documentation and CI artifacts.

### Task Completeness Validation

- Every user story has explicit test + implementation tasks referencing concrete files.
- Demo-case assets, viewer modules, and documentation updates are covered while keeping evidence generation focused on Vitest, Playwright, and the Python VLM pipeline.
- Python VLM automation relies solely on `frontend/scripts/vlm_viewer_audit.py` and related docs/tests—no TypeScript audit tooling is referenced.

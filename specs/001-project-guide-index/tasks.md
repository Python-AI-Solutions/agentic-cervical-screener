# Tasks: Project Overview Guidance Index

**Input**: Design documents from `/specs/001-project-guide-index/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Every user story must include paired Vitest/Python coverage for deterministic math plus Playwright journeys that emit screenshots and JSON artifacts for VLM review.

**Organization**: Tasks are grouped by user story so each slice can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish canonical SampleSlideBundle assets and loaders referenced by every story.

- [ ] T001 Create SampleSlideBundle manifest with slideId, metadata, overlays, and checksum in `public/samples/cervical-baseline.json`.
- [ ] T002 [P] Add backend loader/dataclass validating the manifest and checksum in `agentic_cervical_screener/sample_slide.py`.
- [ ] T003 [P] Define SampleSlideBundle TypeScript types plus fetch helper bound to the manifest in `frontend/src/viewer/data/sampleSlide.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared configs, tooling, and contracts that every user story consumes.

**⚠️ CRITICAL**: Complete before starting user story work.

- [ ] T004 Create responsive + Niivue safe-area constants referenced by viewer math in `frontend/src/viewer/config/responsive.ts`.
- [ ] T005 [P] Add Vitest canvas/Niivue test harness with DPR mocks in `frontend/src/viewer/__tests__/setup.ts`.
- [ ] T006 [P] Build Playwright evidence helper that writes screenshot + metrics bundles for VLM in `frontend/e2e/utils/evidence.ts`.
- [ ] T007 Implement `/docs/project-overview` + `/docs/project-overview/anchors` FastAPI routes and contract tests in `agentic_cervical_screener/main.py` and `tests/test_docs_overview.py`.
- [ ] T008 [P] Scaffold telemetry API client + type guards targeting `/viewer-telemetry` in `frontend/src/services/telemetryClient.ts`.

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 – Deterministic Viewer Launch & Sample Slide Integrity (Priority: P1) 🎯 MVP

**Goal**: Ensure contributors can run the README commands to load the bundled slide with deterministic zoom/pan/overlay alignment across DPRs.

**Independent Test**: Vitest validates SampleSlideBundle metadata + ROI math; Playwright `viewer-sample-slide.spec.ts` boots the viewer, captures desktop/tablet/phone screenshots, and asserts header/canvas safe areas. Launch must emit a `viewer_launch` telemetry event including slideId, DPR, runtime, and README command versions.

### Tests for User Story 1

- [ ] T009 [P] [US1] Add Vitest coverage for SampleSlideBundle parsing, pixel spacing, and ROI drift checks in `frontend/src/viewer/__tests__/sampleSlide.test.ts`.
- [ ] T010 [P] [US1] Author deterministic launch journey with responsive screenshots + JSON metrics in `frontend/e2e/viewer-sample-slide.spec.ts`.

### Implementation for User Story 1

- [ ] T011 [US1] Load the manifest during viewer bootstrap and hydrate StateManager defaults in `frontend/src/viewer/index.ts` and `frontend/src/viewer/StateManager.ts`.
- [ ] T012 [US1] Implement overlay/ruler alignment + Niivue DPR-safe transforms in `frontend/src/viewer/CanvasManager.ts`.
- [ ] T013 [US1] Dispatch `viewer_launch` telemetry events with slideId/DPR/commandVersion via the client in `frontend/src/viewer/telemetry/dispatcher.ts`.

**Checkpoint**: User Story 1 is functional and testable independently.

---

## Phase 4: User Story 2 – Viewer Interaction Telemetry & Observability Anchors (Priority: P1)

**Goal**: Capture machine-readable telemetry for overlay toggles, ROI draws, and responsive changes while buffering/retrying per research decisions and logging ingestion on the FastAPI backend.

**Independent Test**: Vitest exercises the telemetry buffer/backoff state machine; FastAPI tests validate `/viewer-telemetry` + `/healthz` contracts and PHI redaction; Playwright extends `viewer-sample-slide.spec.ts` to mock the endpoint and assert beacons fire for overlay/ROI/responsive events with JSON payloads.

### Tests for User Story 2

- [ ] T014 [P] [US2] Write Vitest coverage for telemetry buffer state transitions, retry intervals, and FIFO drops in `frontend/src/viewer/telemetry/buffer.test.ts`.
- [ ] T015 [P] [US2] Add FastAPI tests for `/viewer-telemetry` + `/healthz` covering success, validation, and rate-limit cases in `tests/test_viewer_telemetry.py`.
- [ ] T016 [P] [US2] Extend `frontend/e2e/viewer-sample-slide.spec.ts` to stub `/viewer-telemetry` and assert overlay/ROI/responsive beacons plus JSON logs in `frontend/playwright-report/`.

### Implementation for User Story 2

- [ ] T017 [US2] Implement telemetry buffer + exponential backoff queue with max 50 events in `frontend/src/viewer/telemetry/buffer.ts`.
- [ ] T018 [US2] Wire overlay toggles, ROI drawing, and responsive mode switches to the dispatcher inside `frontend/src/viewer/StateManager.ts` and `frontend/src/viewer/tools/RoiTool.ts`.
- [ ] T019 [US2] Build `/viewer-telemetry` FastAPI handler with structured logging, PHI scrubbing, and requestId echoes in `agentic_cervical_screener/main.py`.
- [ ] T020 [US2] Expose `/healthz` endpoint returning version/timestamp guarded by telemetry status in `agentic_cervical_screener/main.py`.
- [ ] T021 [US2] Surface telemetry request/queue metrics helper consumed by tests in `agentic_cervical_screener/telemetry/metrics.py`.

**Checkpoint**: Telemetry buffering + ingestion validated end-to-end.

---

## Phase 5: User Story 3 – Viewer Evidence & VLM Audit Pipeline (Priority: P2)

**Goal**: Package Playwright screenshots/metrics for each breakpoint, validate bundles, and run the offline `pixi run vlm-viewer` pipeline that invokes `llm -m llava`, writing `vlm-report.md` and failing on medium-or-higher findings.

**Independent Test**: Unit tests validate VLM bundle structure before invocation; pipeline tests confirm `pixi run vlm-viewer` exits non-zero when llava returns medium+ issues; Playwright emits enriched JSON metrics consumed by the VLM script.

### Tests for User Story 3

- [ ] T022 [P] [US3] Create bundle validator tests ensuring every screenshot has matching metrics + telemetry counters in `frontend/scripts/__tests__/vlmBundle.test.ts`.
- [ ] T023 [P] [US3] Add pipeline smoke test that runs the VLM CLI with mocked llava output in `frontend/scripts/__tests__/vlmPipeline.test.ts`.

### Implementation for User Story 3

- [ ] T024 [US3] Implement VLM bundle builder that collects Playwright screenshots + metrics JSON into artifacts in `frontend/scripts/vlmBundle.ts`.
- [ ] T025 [US3] Implement Ollama/llava invocation + findings parser that writes `frontend/playwright-report/vlm-report.md` in `frontend/scripts/vlmViewer.ts`.
- [ ] T026 [US3] Extend `frontend/e2e/viewer-sample-slide.spec.ts` to emit per-breakpoint metrics JSON + telemetry counters stored under `frontend/playwright-report/metrics.json`.

**Checkpoint**: Viewer evidence pipeline complete and independently verifiable.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T027 [P] Update canonical commands, telemetry expectations, and artifact pointers in `README.md`.
- [ ] T028 Sync `docs/TESTING.md` with Vitest, Playwright, and VLM workflows plus troubleshooting notes.
- [ ] T029 [P] Add CI workflow that runs pixi dev/test/test-e2e-ci/vlm in sequence storing artifacts in `frontend/playwright-report/` via `.github/workflows/viewer-evidence.yml`.
- [ ] T030 Record quickstart validation results covering telemetry + VLM scenarios in `specs/001-project-guide-index/checklists/requirements.md`.

---

## Dependencies & Execution Order

### Dependency Graph

`Setup → Foundational → User Story 1 → User Story 2 → User Story 3 → Polish`

### Phase Dependencies

- **Setup**: No dependencies; establishes shared assets.
- **Foundational**: Depends on Setup manifest alignment; blocks all user stories.
- **User Story 1**: Depends on Foundational; unlocks deterministic viewer baseline required by later telemetry and VLM tasks.
- **User Story 2**: Depends on User Story 1 (telemetry hooks rely on viewer launch emitting events).
- **User Story 3**: Depends on User Story 2 for telemetry counters embedded in VLM metrics.
- **Polish**: Runs after all targeted user stories complete.

### User Story Dependencies

- **US1**: Requires SampleSlideBundle + responsive configs.
- **US2**: Requires US1 viewer hooks plus telemetry client.
- **US3**: Requires Playwright artifacts enriched by US1/US2 features before VLM can analyze them.

### Within Each User Story

- Write/verify tests (Vitest/Python/Playwright) before implementing features.
- Implement data/models before services, services before endpoints/UI, UI before telemetry/emission logic.
- Ensure telemetry/logging tasks finish before testing evidence capture.

---

## Parallel Execution Examples

### User Story 1

- Run Vitest ROI drift tests (T009) while implementing overlay transforms (T012) because they touch different files.
- In parallel, build Playwright journey (T010) while wiring manifest bootstrap (T011) since the e2e spec can target mocked data.

### User Story 2

- Telemetry buffer implementation (T017) can proceed alongside backend handler work (T019) because they integrate via HTTP mocks.
- Playwright telemetry assertions (T016) can start once the mock server scaffold from T006 exists, independent of backend.

### User Story 3

- Bundle validator tests (T022) and Playwright metrics emission (T026) can be developed concurrently; they join through the artifact format.
- VLM invocation script (T025) can run in parallel with the pipeline smoke test (T023) using stubbed llava output.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup (T001–T003) and Foundational work (T004–T008).
2. Deliver US1 tasks (T009–T013) to achieve deterministic viewer launch and telemetry hook.
3. Run Vitest + Playwright suites to validate the MVP before proceeding.

### Incremental Delivery

1. After MVP validation, layer telemetry buffering + backend ingestion from US2 (T014–T021).
2. Once telemetry evidence is solid, implement VLM pipeline tasks from US3 (T022–T026).
3. Finish with Polish tasks (T027–T030) to align documentation, CI, and checklists.

### Parallel Team Strategy

1. Pair one developer on telemetry infrastructure (US2) while another owns VLM automation (US3) once US1 stabilizes.
2. Leverage [P] tasks (e.g., T003, T005, T006, T010, T014, T022, T029) to keep separate files moving without conflicts.
3. Coordinate via dependency checkpoints so buffer/backoff logic is ready before telemetry endpoints go live.

### Task Completeness Validation

- Each user story contains explicit test tasks plus implementation items covering UI, telemetry, and backend work.
- Data-model entities (SampleSlideBundle, ViewerTelemetryEvent, TelemetryBuffer, VlmEvidenceArtifact) map to tasks T001–T026.
- Contracts for `/docs/project-overview`, `/viewer-telemetry`, and `/healthz` are represented in T007, T015, T019, and T020.
- Quickstart + documentation updates are captured in Polish tasks (T027–T030), ensuring spec compliance.

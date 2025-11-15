# Feature Specification: Project Overview Guidance Index

**Feature Branch**: `001-project-guide-index`  
**Created**: 2025-11-12  
**Status**: Draft  
**Input**: Deliver a deterministic NiiVue viewer experience with telemetry, automated evidence, and zero additional documentation surfaces beyond README.md and `docs/TESTING.md`.

## Clarifications

### Session 2025-11-15

- Q: How should the viewer handle telemetry delivery failures when the backend is temporarily unavailable? → A: Queue up to 50 telemetry events locally, retry every 5 s with exponential backoff, and drop the oldest when full while keeping the UI responsive.

## User Scenarios & Testing *(mandatory)*

> **Constitution Hooks**  
> - Each user story MUST trace to (a) a deterministic-fidelity acceptance check (math/unit tests or documented transforms) and (b) a Playwright journey that captures screenshots + JSON metrics.  
> - Responsive + accessibility expectations from `frontend/docs/ZOOM_ISSUES_AND_FIXES.md` must be listed explicitly in the Acceptance Scenarios for any UI change.  
> - Note which viewer telemetry or logging signals (image load, ROI toggles, responsive mode) will be updated to satisfy Principles 4 and 5.

### User Story 1 - Deterministic Viewer Launch & Sample Slide Integrity (Priority: P1)

A contributor must be able to clone the repo, run `pixi run dev` (backend) and `cd frontend && pixi run dev` (frontend), and immediately load the bundled sample cervical slide with stable zoom/pan, overlays, and measurement rulers that match Niivue’s deterministic alignment guarantees.

**Why this priority**: The project’s viability depends on proving the viewer itself works; any time spent on auxiliary documentation blocks the clinical imaging goals laid out in the Constitution.

**Independent Test**:  
- Deterministic check: Vitest suite validates the sample slide config (dimensions, pixel spacing, stain type) and asserts the ROI overlay math does not drift when switching DPR/zoom states.  
- Playwright evidence: `frontend/e2e/viewer-sample-slide.spec.ts` boots the viewer, loads the slide, captures desktop/tablet/phone screenshots, and confirms header + canvas layout adheres to Principle 3 safe areas.  
- Observability hook: integration test ensures viewer launch emits a structured telemetry event containing slide id, DPR, runtime, and command versions pulled from README.md references.

**Acceptance Scenarios**:

1. **Given** a contributor following README.md, **When** they run the canonical commands, **Then** the viewer loads the sample slide in ≤15 s with aligned overlays across DPRs.  
2. **Given** the Vitest + Playwright suites run in CI, **When** the sample slide metadata drifts or the canvas layout regresses, **Then** the suites fail and cite the offending measurement or screenshot diff.

---

### User Story 2 - Viewer Interaction Telemetry & Observability Anchors (Priority: P1)

Automation agents and maintainers must receive machine-readable telemetry whenever users toggle overlays, draw ROIs, or switch responsive modes so they can diagnose regressions without digging through documentation.

**Why this priority**: Constitution Principle “Inspectable Automation & Observability” requires concrete signals tied to viewer actions; lacking them makes it impossible to prove the viewer behaves correctly.

**Independent Test**:  
- Deterministic check: Vitest verifies that telemetry payload builders enforce schema (`event`, `slideId`, `viewport`, `latencyMs`, `commandVersion`).  
- Playwright evidence: extend `viewer-sample-slide.spec.ts` to toggle overlays and draw a test ROI, asserting telemetry beacons fire with expected payloads (captured via mock endpoint).  
- Log inspection: a FastAPI integration test confirms backend receives the telemetry POST and redacts PHI while persisting request ids.

**Acceptance Scenarios**:

1. **Given** a maintainer tracing an ROI regression, **When** they inspect telemetry logs, **Then** they see event records with deterministic coordinates and runtime metadata.  
2. **Given** automation parses the telemetry queue, **When** overlays or responsive modes change, **Then** metrics appear within 1 s and include the Niivue zoom/pan snapshot for auditability.

---

### User Story 3 - Viewer Evidence & VLM Audit Pipeline (Priority: P2)

CI must run an offline-capable VLM audit over the viewer screenshots/JSON captured by Playwright to ensure responsive layouts, safe-area padding, and annotation affordances stay compliant without inventing new documentation assets.

**Why this priority**: The Constitution’s “Dual-Layer Evidence” + “Responsive & Accessible Header-First UX” principles demand artifact-backed validation; keeping the pipeline viewer-focused avoids the documentation bloat that blocked progress.

**Independent Test**:  
- Deterministic check: script validates the VLM input bundle (screenshots + metrics) before invoking `llm -m llava`.  
- Playwright evidence: viewer journey stores JSON describing headers, canvases, overlays, and telemetry counters for the VLM to consume.  
- VLM stage: pipeline fails CI whenever llava flags medium-or-higher responsive/accessibility issues, and it writes `vlm-report.md` under `frontend/playwright-report/`.

**Acceptance Scenarios**:

1. **Given** a code change affecting layout, **When** the pipeline runs, **Then** it captures artifacts for desktop/tablet/phone and blocks merge if safe-area padding regresses.  
2. **Given** reviewers inspect the VLM report, **When** no issues surface, **Then** they can proceed without requesting additional documentation beyond README.md / `docs/TESTING.md` notes.

---

### Edge Cases

- Sample slide loads must remain deterministic when device pixel ratio, zoom, or rotation changes mid-load; telemetry should record the before/after states.  
- Air-gapped environments still need to render the viewer and run VLM audits locally via Ollama; when the model is missing, the pipeline must emit a readable CLI error without touching documentation.  
- If Niivue introduces breaking API changes, tests must detect the mismatch before runtime by validating version strings, preventing silent failures in screenshots or telemetry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Provide a canonical sample slide bundle (`public/samples/cervical-baseline.nii.gz` + metadata) referenced directly by README.md and `docs/TESTING.md`, ensuring deterministic orientation, pixel spacing, and stain type.  
- **FR-002**: Implement viewer bootstrapping that reads the metadata, loads overlays, and restores zoom/pan state within 200 ms after resize, fulfilling Deterministic Imaging Fidelity requirements.  
- **FR-003**: Wire telemetry emitters for viewer launch, overlay toggle, ROI draw, and responsive mode changes; payloads must include identifiers, DPR, latency, and README command versions, and failed deliveries must queue up to 50 events, retry every 5 s with exponential backoff, and drop the oldest entry when the buffer is full without blocking the UI.  
- **FR-004**: Extend Vitest coverage to validate metadata parsing, telemetry schema, ROI math utilities, and Niivue hook wrappers (`frontend/src/viewer/__tests__/*.test.ts`).  
- **FR-005**: Extend Playwright coverage via `frontend/e2e/viewer-sample-slide.spec.ts` (or similarly named file) that exercises launch, overlay toggles, ROI creation, and responsive breakpoints, storing screenshots + JSON metrics.  
- **FR-006**: Maintain the viewer-focused VLM pipeline (`pixi run vlm-viewer`) so it consumes the Playwright outputs, emits `vlm-report.md`, and fails CI on medium-or-higher responsive/accessibility findings.  
- **FR-007**: Update only README.md and `docs/TESTING.md` to reflect the canonical commands and verification steps; no additional documentation artifacts (indexes, portals, overlays) may be added.  
- **FR-008**: Ensure backend FastAPI endpoints expose `/healthz` and `/viewer-telemetry` (or extend existing routes) with structured logging so frontend telemetry ingestion remains inspectable.

### Key Entities *(include if feature involves data)*

- **Sample Slide Bundle**: Niivue-readable volume plus JSON metadata that define deterministic rendering inputs for tests and manual runs.  
- **Viewer Telemetry Event**: Structured payload emitted for launch/overlay/ROI/responsive actions, containing command version, slide id, DPR, and latency metrics.  
- **VLM Evidence Artifact**: Combination of Playwright screenshots and JSON metrics analyzed by the llava model to enforce responsive/accessibility requirements.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running `pixi run dev` + `cd frontend && pixi run dev` loads the sample slide with overlays aligned across DPRs, verified by automated screenshot diff ≤2 px tolerance.  
- **SC-002**: Telemetry ingestion captures ≥95% of overlay/ROI events during CI Playwright runs, and payloads reference README command versions.  
- **SC-003**: The VLM pipeline completes on Apple Silicon hardware within 5 minutes and blocks merge on any medium-or-higher issue; artifacts live under `frontend/playwright-report/`.  
- **SC-004**: README.md and `docs/TESTING.md` remain the only documentation touchpoints; they clearly state the canonical commands and mention where to find telemetry/VLM evidence.  
- **SC-005**: Fast tests fail within 60 s when metadata, telemetry schema, or Niivue APIs change unexpectedly, preventing regressions from landing.

## Assumptions

- Documentation coverage is restricted to README.md and `docs/TESTING.md`; no new user-facing portals or indexes will be created until the viewer proves viable.  
- Contributors run workflows on Apple Silicon laptops with ≥16 GB RAM so Niivue, Playwright, and llava can execute locally.  
- Demo assets in `public/` remain non-PHI and are the only datasets baked into tests; additional datasets require explicit approval outside this feature.  
- The backend already exposes or can extend telemetry ingestion routes without architectural rewrites.

## Dependencies & Risks

- Niivue version bumps or GPU driver changes may alter rendering; maintain lockfiles and screenshot baselines to detect drift quickly.  
- Ollama/llava availability is required for the VLM pipeline; if the model is missing, document the failure mode in `docs/TESTING.md` but do not add new portals.  
- Telemetry routing depends on backend health; ensure `/viewer-telemetry` gracefully handles spikes and logs structured request ids so audits remain possible.

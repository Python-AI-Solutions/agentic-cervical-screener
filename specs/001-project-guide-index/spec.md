# Feature Specification: Project Overview Guidance Index

**Feature Branch**: `001-project-guide-index`  
**Created**: 2025-11-12  
**Status**: Draft  
**Input**: Deliver a deterministic NiiVue viewer experience with automated evidence and zero additional documentation surfaces beyond README.md and `docs/TESTING.md`.

## User Scenarios & Testing *(mandatory)*

> **Constitution Hooks**  
> - Each user story MUST trace to (a) a deterministic-fidelity acceptance check (math/unit tests or documented transforms) and (b) a Playwright journey that captures screenshots + JSON metrics.  
> - Responsive + accessibility expectations from `frontend/docs/ZOOM_ISSUES_AND_FIXES.md` must be listed explicitly in the Acceptance Scenarios for any UI change.  
> - Note which viewer logging signals (image load, ROI toggles, responsive mode) will be updated to satisfy Principles 4 and 5.

### User Story 1 - Deterministic Viewer Launch & Demo Slide Integrity (Priority: P1)

A contributor must be able to clone the repo, run `pixi run dev` (backend) and `cd frontend && pixi run dev` (frontend), and immediately load the existing bundled demo case (e.g., `public/mock/case-demo.json`) with stable zoom/pan, overlays, and measurement rulers that match Niivue’s deterministic alignment guarantees.

**Why this priority**: The project’s viability depends on proving the viewer itself works; any time spent on auxiliary documentation blocks the clinical imaging goals laid out in the Constitution.

**Independent Test**:  
- Deterministic check: Vitest suite validates the demo slide metadata already shipped with the repo (dimensions, pixel spacing, stain type) and asserts the ROI overlay math does not drift when switching DPR/zoom states.  
- Playwright evidence: `frontend/e2e/viewer.spec.ts` (or successor) boots the viewer, loads the demo case, captures desktop/tablet/phone screenshots, and confirms header + canvas layout adheres to Principle 3 safe areas.  
- Observability hook: devtools/manual verification ensures launch timing and ROI math remain within tolerances referenced in README.md commands.

**Acceptance Scenarios**:

1. **Given** a contributor following README.md, **When** they run the canonical commands, **Then** the viewer loads the sample slide in ≤15 s with aligned overlays across DPRs.  
2. **Given** the Vitest + Playwright suites run in CI, **When** the demo slide metadata drifts or the canvas layout regresses, **Then** the suites fail and cite the offending measurement or screenshot diff.

---

### User Story 2 - Viewer Evidence & Python VLM Audit Pipeline (Priority: P2)

CI must run an offline-capable VLM audit over the viewer screenshots/JSON captured by Playwright to ensure responsive layouts, safe-area padding, and annotation affordances stay compliant without inventing new documentation assets.

**Why this priority**: The Constitution’s “Dual-Layer Evidence” + “Responsive & Accessible Header-First UX” principles demand artifact-backed validation; keeping the pipeline viewer-focused avoids the documentation bloat that blocked progress.

**Independent Test**:  
- Deterministic check: the existing Python audit runner (`frontend/scripts/vlm_viewer_audit.py`) validates the Playwright screenshots + metrics JSON bundle before invoking `llm -m llava` via `pixi run vlm-viewer`.  
- Playwright evidence: viewer journeys emit screenshots plus metrics payloads under `frontend/playwright-report/` for the Python script to consume.  
- VLM stage: the Python pipeline fails CI whenever llava flags medium-or-higher responsive/accessibility issues and writes `frontend/playwright-report/vlm-report.md`; `frontend/scripts/test_vlm_viewer_audit.py` covers parser + failure cases.

**Acceptance Scenarios**:

1. **Given** a code change affecting layout, **When** the pipeline runs, **Then** it captures artifacts for desktop/tablet/phone and blocks merge if safe-area padding regresses.  
2. **Given** reviewers inspect the VLM report, **When** no issues surface, **Then** they can proceed without requesting additional documentation beyond README.md / `docs/TESTING.md` notes.

---

### Edge Cases

- Demo slide loads must remain deterministic when device pixel ratio, zoom, or rotation changes mid-load.  
- Air-gapped environments still need to render the viewer and run VLM audits locally via Ollama; when the model is missing, the pipeline must emit a readable CLI error without touching documentation.  
- If Niivue introduces breaking API changes, tests must detect the mismatch before runtime by validating version strings, preventing silent failures in screenshots or generated artifacts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Ensure the existing demo case assets (`public/mock/*.json`, sample PNGs) referenced by README.md and `docs/TESTING.md` load deterministically, preserving orientation, pixel spacing, and stain metadata.  
- **FR-002**: Maintain viewer bootstrapping that reads the demo metadata, loads overlays, and restores zoom/pan state within 200 ms after resize, fulfilling Deterministic Imaging Fidelity requirements.  
- **FR-003**: Extend Vitest coverage to validate metadata parsing, ROI math utilities, and Niivue hook wrappers (`frontend/src/viewer/__tests__/*.test.ts`).  
- **FR-004**: Extend Playwright coverage via `frontend/e2e/viewer.spec.ts` / `viewer-responsive.spec.ts` (or consolidated successor) that exercises launch, overlay toggles, ROI creation, and responsive breakpoints, storing screenshots + JSON metrics.  
- **FR-005**: Maintain the viewer-focused Python VLM pipeline (`cd frontend && pixi run vlm-viewer`) backed by `frontend/scripts/vlm_viewer_audit.py` so it consumes the Playwright outputs, emits `vlm-report.md`, and fails CI on medium-or-higher responsive/accessibility findings.  
- **FR-006**: Update only README.md and `docs/TESTING.md` to reflect the canonical commands and verification steps; no additional documentation artifacts (indexes, portals, overlays) may be added.

### Key Entities *(include if feature involves data)*

- **Demo Case Asset**: Existing `public/mock/*.json` definitions paired with PNG overlays that define deterministic rendering inputs for tests and manual runs.  
- **VLM Evidence Artifact**: Combination of Playwright screenshots and JSON metrics analyzed by the Python `vlm_viewer_audit.py` script to enforce responsive/accessibility requirements.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running `pixi run dev` + `cd frontend && pixi run dev` loads the demo slide with overlays aligned across DPRs, verified by automated screenshot diff ≤2 px tolerance.  
- **SC-002**: The VLM pipeline completes on Apple Silicon hardware within 5 minutes and blocks merge on any medium-or-higher issue; artifacts live under `frontend/playwright-report/`.  
- **SC-003**: README.md and `docs/TESTING.md` remain the only documentation touchpoints; they clearly state the canonical commands and mention where to find VLM evidence.  
- **SC-004**: Fast tests fail within 60 s when metadata or Niivue APIs change unexpectedly, preventing regressions from landing.

## Assumptions

- Documentation coverage is restricted to README.md and `docs/TESTING.md`; no new user-facing portals or indexes will be created until the viewer proves viable.  
- Contributors run workflows on Apple Silicon laptops with ≥16 GB RAM so Niivue, Playwright, and llava can execute locally.  
- Demo assets in `public/` remain non-PHI and are the only datasets baked into tests; additional datasets require explicit approval outside this feature.  
- The backend already exposes the endpoints required for the demo viewer workflows; no telemetry ingestion routes are in scope.

## Dependencies & Risks

- Niivue version bumps or GPU driver changes may alter rendering; maintain lockfiles and screenshot baselines to detect drift quickly.  
- Ollama/llava availability is required for the VLM pipeline; if the model is missing, document the failure mode in `docs/TESTING.md` but do not add new portals.  
- Viewer evidence generation depends on Playwright health; ensure failing runs clearly log artifact paths for manual inspection.

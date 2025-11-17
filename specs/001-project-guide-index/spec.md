# Feature Specification: Project Overview Guidance Index

**Feature Branch**: `001-project-guide-index`  
**Created**: 2025-11-12  
**Status**: Draft  
**Input**: Deliver a deterministic NiiVue viewer experience with automated evidence and zero additional documentation surfaces beyond README.md and `docs/TESTING.md`.

## User Scenarios & Testing *(mandatory)*

> **Constitution Hooks**  
> - Each user story MUST trace to (a) a deterministic-fidelity acceptance check (math/unit tests or documented transforms) and (b) a Playwright journey that captures screenshots for responsive evidence.  
> - Responsive + accessibility expectations from `frontend/docs/ZOOM_ISSUES_AND_FIXES.md` must be listed explicitly in the Acceptance Scenarios for any UI change.  

### User Story 1 - Deterministic Viewer Launch & Demo Slide Integrity (Priority: P1)

A contributor must be able to clone the repo, run `pixi run dev` (backend) and `cd frontend && pixi run dev` (frontend), and immediately load the existing bundled demo case (e.g., `public/mock/case-demo.json`) with stable zoom/pan, overlays, measurement rulers, and header controls that remain visible across responsive breakpoints while matching Niivue’s deterministic alignment guarantees.

**Why this priority**: The project’s viability depends on proving the viewer itself works.

- **Independent Test**:  
- Deterministic check: Vitest suite validates the demo slide metadata already shipped with the repo (dimensions, pixel spacing, stain type) and asserts the ROI overlay math does not drift when switching DPR/zoom states.  
- Playwright evidence: `frontend/e2e/viewer.spec.ts` (or successor) boots the viewer, loads the demo case, captures desktop/tablet/phone screenshots, and asserts buttons, toggles, toolbars, and canvases remain accessible—visible when expected, collapsed or hidden only when the layout calls for it—without unintended overlap or clipping.  
- Observability hook: devtools/manual verification ensures launch timing and ROI math remain within tolerances referenced in README.md commands.

**Acceptance Scenarios**:

1. **Given** a contributor following README.md, **When** they run the canonical commands, **Then** the viewer loads the demo slide in ≤15 s with aligned overlays across DPRs.  
2. **Given** the Vitest + Playwright suites run in CI, **When** the demo slide metadata drifts or the canvas layout regresses, **Then** the suites fail and cite the offending measurement or screenshot diff.

---

### User Story 2 - CI Evidence Hardening & Python VLM QC (Priority: P2)

CI must rely on deterministic Vitest + Playwright evidence (screenshots, DOM assertions, and accessibility checks) to gate merges, while the offline Python VLM audit runs as a secondary quality-control pass over those artifacts without owning primary verification.

**Why this priority**: The Constitution’s “Dual-Layer Evidence” + “Responsive & Accessible Header-First UX” principles demand artifact-backed validation; keeping the pipeline viewer-focused avoids the documentation bloat that blocked progress.

**Independent Test**:  
- Deterministic check: Playwright suites run in CI (desktop/tablet/large-phone/small-phone) with explicit assertions for button visibility, header safe areas, drawer focus management, and overlay toggles before uploading screenshots to `frontend/playwright-report/`.  
- Python audit: `frontend/scripts/vlm_viewer_audit.py` consumes the screenshots produced by the Playwright runs (device/breakpoint encoded in filenames) and invokes llm review via `pixi run vlm-viewer`; pytest coverage ensures parsing/severity adjustments remain stable.
- VLM stage: medium-or-higher is considered failure by human review i.e. there are responsive/accessibility issues. The report should be written to `frontend/playwright-report/vlm-report.md`. Deterministic checks already run in Vitest/Playwright, this stage serves as an additional qualitative gate rather than the primary verification. A convenient interface for capturing previous issues should be built into the VLM pipeline i.e. save the image, the VLM report, and allow the  user to improve the report before saving it as a training example for future fine-tuning.

**Acceptance Scenarios**:

1. **Given** a code change affecting layout, **When** Vitest + Playwright run in CI, **Then** they fail with actionable assertions (e.g., hidden buttons, header overlap, overlay misalignment).
2. At any time an agent or human can inspect the VLM report to gain insight into any common issues that are hard to capture in deterministic tests.

---

### Edge Cases

- Playwright assertions must detect hidden/tiny buttons, header overlap, or off-screen controls without relying on subjective VLM output.
- Air-gapped environments still need to render the viewer and run VLM audits locally via mlx_vlm (using llm CLI tools plugin).
- If Niivue introduces breaking API changes, tests must detect the mismatch before runtime by validating version strings, preventing silent failures in screenshots or generated artifacts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Ensure the existing demo case assets (`public/mock/*.json`, sample PNGs) referenced by README.md and `docs/TESTING.md` load, preserving orientation, pixel spacing, and stain metadata.  
- **FR-002**: Maintain viewer bootstrapping that reads the demo metadata, loads overlays, and restores zoom/pan state within 200 ms after resize, fulfilling Deterministic Imaging Fidelity requirements.  
- **FR-003**: Extend Vitest coverage to validate metadata parsing, ROI math utilities, and Niivue hook wrappers (`frontend/src/viewer/__tests__/*.test.ts`).  
- **FR-004**: Extend Playwright coverage via `frontend/e2e/viewer.spec.ts` / `viewer-responsive.spec.ts` (or consolidated successor) that exercises launch, overlay toggles, ROI creation, and responsive breakpoints, asserting buttons/toggles stay visible, header safe areas hold, drawers expose focus traps, and actions remain accessible; store screenshots for audit trails.  
- **FR-005**: Maintain the viewer-focused Python VLM pipeline (`cd frontend && pixi run vlm-viewer`) backed by `frontend/scripts/vlm_viewer_audit.py` so it consumes the Playwright outputs, emits `vlm-report.md`, and fails CI on medium-or-higher responsive/accessibility findings as a secondary qualitative gate.  
- **FR-006**: Documentation updates must live under `docs/` (or nested subfolders) for canonical guidance, while single-use or investigative notes belong under `docs/temp/`; README.md and `docs/TESTING.md` should still call out the canonical commands and evidence pointers.

### Key Entities *(include if feature involves data)*

- **Demo Case Asset**: Existing `public/mock/*.json` definitions paired with PNG overlays that define deterministic rendering inputs for tests and manual runs.  
- **Playwright Evidence Bundle**: Deterministic Playwright screenshots and DOM/assertion logs that prove header/controls/canvas integrity across breakpoints and feed downstream audits.  
- **VLM Evidence Artifact**: Combination of Playwright screenshots and audit findings produced by the Python `vlm_viewer_audit.py` script to enforce responsive/accessibility requirements qualitatively.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running `pixi run dev` + `cd frontend && pixi run dev` loads the demo slide with overlays aligned across DPRs, verified by automated screenshot diff ≤2 px tolerance.  
- **SC-002**: Playwright CI asserts button visibility, header safe areas, ROI toggles, and responsive drawers without regressions; failures provide actionable selectors/metrics.  
- **SC-003**: The Python VLM pipeline blocks merge on any medium-or-higher issue and publishes artifacts under `frontend/playwright-report/`.  
- **SC-004**: README.md and `docs/TESTING.md` remain the canonical documentation touchpoints, pointing to commands and evidence locations while deeper guides live under `docs/`.  
- **SC-005**: Fast tests fail when metadata or Niivue APIs change unexpectedly, preventing regressions from landing.

## Assumptions

- Documentation coverage is restricted to README.md and `docs/TESTING.md`; no new user-facing portals or indexes will be created until the viewer proves viable.  
- Contributors run workflows on Apple Silicon laptops with ≥16 GB RAM so Niivue, Playwright, and llava can execute locally.  
- Demo assets in `public/` remain non-PHI and are the only datasets baked into tests; additional datasets require explicit approval outside this feature.  
- Backend endpoints required for viewer workflows already exist; no new API exposure is anticipated for this feature.

## Dependencies & Risks

- Niivue version bumps or GPU driver changes may alter rendering; maintain lockfiles and screenshot baselines to detect drift quickly.  
- Ollama/llava availability is required for the VLM pipeline; if the model is missing, document the failure mode in `docs/TESTING.md` but do not add new portals.  
- Viewer evidence generation depends on Playwright health; ensure failing runs clearly log artifact paths for manual inspection.

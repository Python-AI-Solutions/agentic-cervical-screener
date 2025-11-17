# Data Model

## DemoCaseAsset
- **Fields**:  
  - `caseId` (string) – canonical identifier referenced in README/docs.  
  - `slideUri` (string) – path under `public/mock/` or `public/images/` for the demo slide.  
  - `metadata` (object) – `dimensionsPx`, `pixelSpacingMicrons`, `stainType`, `orientation`, `defaultZoom`, `defaultPan`.  
  - `overlays` (array) – descriptors with `name`, `color`, `maskPath`.  
  - `checksum` (string) – SHA256 ensuring deterministic asset integrity.
- **Relationships**:  
  - Consumed by the viewer boot sequence and Vitest/Playwright tests.  
  - Referenced in README + `docs/TESTING.md` to keep instructions deterministic.
- **Validation Rules**:  
  - `pixelSpacingMicrons` must be positive float.  
  - `orientation` limited to Niivue-supported enum (RAS+, LAS+, etc.).  
  - Overlay masks must match the slide pixel grid dimensions.  
  - `checksum` validated on boot/tests to detect drift before rendering.
- **Lifecycle**:  
  - `registered` (asset committed) → `verified` (tests pass) → `in-use` (loaded at runtime). Drift returns the bundle to `registered` until corrected.

## VlmEvidenceArtifact
- **Fields**:  
  - `screenshots` (array<FileRef>) – per breakpoint/per panel state.  
  - `findings` (array) – llava issue list with severity + description.  
  - `generatedAt` (timestamp).  
  - `playwrightRunId` (string) – ties to CI run.  
  - `status` (enum: `pass`, `fail`, `blocked`).  
  - `model` (string) – llava/other VLM identifier for audit traceability.
- **Relationships**:  
  - Produced by Playwright + Python VLM pipeline, stored under `frontend/playwright-report/`.  
  - Referenced by `docs/TESTING.md` so reviewers know where to inspect artifacts.
- **Validation Rules**:  
  - Each expected breakpoint/device has at least one screenshot captured.  
  - `findings` severity `medium` or above triggers CI failure.  
  - `status` derived from llava output; manual overrides forbidden.

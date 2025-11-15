# Data Model

## SampleSlideBundle
- **Fields**:  
  - `slideId` (string UUID) – canonical identifier referenced in README and telemetry.  
  - `filePath` (string) – `public/samples/cervical-baseline.nii.gz`.  
  - `metadata` (object) – `dimensionsPx`, `pixelSpacingMicrons`, `stainType`, `orientation`, `defaultZoom`, `defaultPan`.  
  - `overlays` (array) – overlay descriptors with `name`, `color`, `maskPath`.  
  - `checksum` (string) – SHA256 ensuring deterministic asset integrity.
- **Relationships**:  
  - Referenced by viewer boot sequence and telemetry events (`slideId`).  
  - Provides metadata consumed by Vitest (parsing tests) and Playwright (layout assertions).
- **Validation Rules**:  
  - `pixelSpacingMicrons` must be positive float.  
  - `orientation` limited to Niivue-supported enum (RAS+, LAS+, etc.).  
  - Overlay masks must match the slide voxel grid dimensions.  
  - `checksum` validated on boot to detect drift before rendering.
- **Lifecycle**:  
  - `registered` (asset committed) → `verified` (tests pass) → `in-use` (loaded at runtime). Drift returns the bundle to `registered` until corrected.

## ViewerTelemetryEvent
- **Fields**:  
  - `event` (enum: `viewer_launch`, `overlay_toggle`, `roi_draw`, `responsive_mode_change`).  
  - `slideId` (string) – FK to `SampleSlideBundle`.  
  - `viewport` (object) – `zoom`, `pan`, `dpr`, `canvasSize`.  
  - `latencyMs` (float) – measured from command invocation.  
  - `commandVersion` (string) – README/docs command hash/version.  
  - `requestId` (UUID) – generated client-side and echoed by backend.  
  - `emittedAt` (ISO timestamp).  
  - `status` (enum: `queued`, `sending`, `ack`, `dropped`).  
  - `retries` (int) – number of retry attempts.
- **Relationships**:  
  - Stored transiently in frontend telemetry buffer; posted to FastAPI `/viewer-telemetry`.  
  - Backend logs pair `requestId` with ingestion success/failure for audits.
- **Validation Rules**:  
  - `latencyMs` >= 0 and < 15000.  
  - `viewport.zoom` must stay within Niivue-supported range (0.01–20).  
  - `status` transitions follow queue state machine (see below).  
  - Payload must include `commandVersion` referenced in docs.
- **State Transitions**:  
  - `queued` → `sending` (next retry window) → `ack` (HTTP 2xx) or `dropped` (buffer overflow/5 retries exhausted).  
  - `sending` → `queued` if retry scheduled due to failure/backoff.

## TelemetryBuffer
- **Fields**:  
  - `events` (array<ViewerTelemetryEvent>) – capped at 50.  
  - `retryIntervalMs` (int) – base 5000 ms, doubled up to 40000 ms per event.  
  - `lastDispatchAt` (timestamp) – for scheduling next flush.  
  - `flushInProgress` (bool).
- **Relationships**:  
  - Owned by frontend viewer runtime; flushes to `/viewer-telemetry`.  
  - Observability tests inspect buffer metrics via mocked endpoints.
- **Validation / Constraints**:  
  - Dropping policy is FIFO when buffer exceeds 50.  
  - Buffer never blocks UI threads; operations must be asynchronous.

## VlmEvidenceArtifact
- **Fields**:  
  - `screenshots` (array<FileRef>) – per breakpoint/per panel state.  
  - `metricsJson` (object) – layout measurements, telemetry counters, safe-area padding.  
  - `llmFindings` (array) – llava issue list with severity + description.  
  - `generatedAt` (timestamp).  
  - `playwrightRunId` (string) – ties to CI run.  
  - `status` (enum: `pass`, `fail`, `blocked`).
- **Relationships**:  
  - Produced by Playwright + VLM pipeline, stored under `frontend/playwright-report/`.  
  - Referenced by docs/TESTING instructions for reviewers to inspect.
- **Validation Rules**:  
  - Each screenshot must have matching `metricsJson` entry keyed by breakpoint.  
  - `llmFindings` severity `medium` or above triggers CI failure.  
  - `status` derived from llava output; manual overrides forbidden.

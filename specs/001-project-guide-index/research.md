# Research Summary

## Niivue Sample Slide Packaging
Decision: Keep the canonical Niivue `.nii.gz` slide plus JSON metadata referenced directly by README.md and `docs/TESTING.md`.  
Rationale: Pairs deterministic geometry inputs with documentation so Vitest + Playwright can assert drift immediately after cloning, satisfying the Constitution’s documentation constraint.  
Alternatives considered: Bundling DICOM slices or downloading remote assets was rejected because it violates offline + no-new-documents rules and complicates deterministic sizing.

## Telemetry Buffering & Retries
Decision: Implement a 50-event in-memory queue that retries failed `/viewer-telemetry` posts every 5 s with exponential backoff while dropping the oldest entry when full.  
Rationale: Maintains responsive UI, satisfies ≥95 % telemetry capture target, and surfaces observability metrics even during backend hiccups.  
Alternatives considered: Blocking UI on send (hurts UX) or fire-and-forget logging (no retry guarantees) were rejected because they reduce inspectability and could mask regressions.

## Responsive Evidence Collection
Decision: Extend `frontend/e2e/viewer-sample-slide.spec.ts` to capture screenshots + JSON metrics for desktop, tablet, large-phone, and small-phone breakpoints defined in `docs/project_overview.md §5`.  
Rationale: Aligns with Responsive Header-First UX principle and gives the VLM pipeline the context it needs to assert safe-area padding for both baseline and full-height panels.  
Alternatives considered: Limiting to desktop screenshots or using manual QA was rejected due to inadequate coverage and inability to feed the automated VLM stage.

## VLM Audit Pipeline
Decision: Run `cd frontend && pixi run vlm-viewer` to bundle Playwright artifacts and invoke `llm -m llava` locally via Ollama, failing CI on medium-or-higher findings and writing `frontend/playwright-report/vlm-report.md`.  
Rationale: Keeps the audit offline-capable, deterministic, and tied to actual viewer evidence, which enforces Dual-Layer Evidence without adding documentation surfaces.  
Alternatives considered: Cloud-based VLM services or manual screenshot reviews were rejected because they break offline requirements and weaken automated governance.

## Backend Telemetry Handling
Decision: Use FastAPI `/viewer-telemetry` to log PHI-free payloads (`event`, `slideId`, `viewport`, `latencyMs`, `commandVersion`, `requestId`) with structured logging + PHI redaction, alongside `/healthz` for readiness checks.  
Rationale: Supports Inspectable Automation expectations and gives maintainers precise artifacts to correlate with frontend telemetry.  
Alternatives considered: Reusing existing generic logging endpoints was rejected because they lack schema enforcement and PHI redaction safeguards demanded by the feature.

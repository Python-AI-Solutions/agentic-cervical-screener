# Research Summary

## Demo Case Packaging
Decision: Keep the canonical Niivue-ready demo case JSON + image assets under `public/mock/` referenced directly by README.md and `docs/TESTING.md`.  
Rationale: Pairs deterministic geometry inputs with documentation so Vitest + Playwright can assert drift immediately after cloning while preserving offline workflows.  
Alternatives considered: Bundling DICOM slices or downloading remote assets was rejected because it violates offline + no-new-documents rules and complicates deterministic sizing.

## Responsive Evidence Collection
Decision: Extend the consolidated Playwright viewer spec to capture screenshots for desktop, tablet, large-phone, and small-phone breakpoints defined in `docs/project_overview.md §5`, asserting header safe areas and control visibility rules.  
Rationale: Aligns with Responsive Header-First UX principle and gives the pipeline the context it needs to assert safe-area padding for both baseline and full-height panels.  
Alternatives considered: Limiting to desktop screenshots or using manual QA was rejected due to inadequate coverage and inability to feed the automated VLM stage.

## VLM Audit Pipeline
Decision: Run `cd frontend && pixi run vlm-viewer` to bundle Playwright artifacts and invoke `llm -m llava` locally via Ollama, failing CI on medium-or-higher findings and writing `frontend/playwright-report/vlm-report.md`.  
Rationale: Keeps the audit offline-capable, deterministic, and tied to actual viewer evidence, which enforces Dual-Layer Evidence without adding documentation surfaces.  
Alternatives considered: Cloud-based VLM services or manual screenshot reviews were rejected because they break offline requirements and weaken automated governance.

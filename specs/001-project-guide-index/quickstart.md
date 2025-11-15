# Quickstart Guide – Project Overview Guidance Index

## Prerequisites
1. Apple Silicon macOS with ≥16 GB RAM (per spec assumptions).  
2. Pixi CLI installed (bundled via repo toolchain).  
3. Ollama running locally with `llava` model pulled (`ollama pull llava`).  
4. Node.js (per `.tool-versions`) and Python ≥3.14.

## Setup
1. Clone the repo and install dependencies:
   ```bash
   pixi run sync        # installs Python deps + tooling
   cd frontend && pixi run install && cd ..
   ```
2. Ensure demo assets exist:
   ```bash
   ls public/samples/cervical-baseline.nii.gz
   ```

## Run the Stacks
1. Start backend + frontend (two terminals):
   ```bash
   pixi run dev         # FastAPI + telemetry ingestion
   cd frontend && pixi run dev
   ```
2. Load `http://localhost:5173`, confirm the sample slide renders with overlays, rulers, and responsive header (desktop/tablet/phone via devtools).

## Validate Deterministic Behavior
1. Run Vitest suite for metadata + telemetry utilities:
   ```bash
   cd frontend
   pixi run test -- viewer
   ```
2. Inspect failing tests if metadata drifts; they must cite mismatched dimensions or overlay math.

## Validate End-to-End Evidence
1. Execute Playwright CI flow (headless, autostarts dev server):
   ```bash
   cd frontend
   pixi run test-e2e-ci -- viewer-sample-slide.spec.ts
   ```
2. Review screenshots + JSON metrics under `frontend/playwright-report/`.
3. Run VLM pipeline (requires Ollama/llava):
   ```bash
   cd frontend
   pixi run vlm-viewer
   ```
4. Inspect `frontend/playwright-report/vlm-report.md`; merge is blocked on medium-or-higher findings.

## Telemetry Expectations
1. Toggle overlays/draw ROI; ensure buffered telemetry (max 50 events, 5 s exponential backoff) appears in browser logs when backend is down.  
2. Bring backend online and confirm `/viewer-telemetry` returns 202 with payload echoed in FastAPI logs (no PHI, request ids present).  
3. Check `/healthz` for readiness; CI monitors this endpoint before running Playwright.

## Documentation Touchpoints
- Update README.md + `docs/TESTING.md` only when workflows change.  
- Reference the telemetry queue behavior and VLM report locations in those docs to keep downstream automation aligned.

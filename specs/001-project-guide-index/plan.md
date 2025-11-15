# Implementation Plan: Project Overview Guidance Index

**Branch**: `001-project-guide-index` | **Date**: 2025-11-15 | **Spec**: `specs/001-project-guide-index/spec.md`  
**Input**: Feature specification from `/specs/001-project-guide-index/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deliver a deterministic Niivue-based cervical slide viewer experience that launches from the canonical README + `docs/TESTING.md` commands, emits structured telemetry for launch/overlay/ROI/responsive events with buffered retries, and feeds a Playwright + VLM pipeline that captures screenshots/JSON artifacts enforcing responsive, accessible layouts without introducing new documentation surfaces.

## Technical Context

**Language/Version**: Python ≥3.14 (FastAPI backend) + TypeScript 5.x (Vite frontend)  
**Primary Dependencies**: FastAPI, PyTorch/Ultralytics YOLO, Pixi, Niivue, Tailwind CSS, Vitest, Playwright, Ollama + llava VLM  
**Storage**: N/A (sample slide + metadata in `public/`, telemetry forwarded to FastAPI + transient buffer)  
**Testing**: `pixi run test` (Python/FastAPI), `cd frontend && pixi run test` (Vitest), `cd frontend && pixi run test-e2e-ci` (Playwright), `cd frontend && pixi run vlm-viewer` (VLM audit)  
**Target Platform**: FastAPI service on macOS/Linux dev hosts + browser-based viewer (desktop/tablet/phone per responsiveness table)  
**Project Type**: Web monorepo (FastAPI backend + Vite frontend)  
**Performance Goals**: Sample slide loads ≤15 s, overlay/pan state restores ≤200 ms post-resize, telemetry captures ≥95 % of overlay/ROI events, VLM stage finishes ≤5 min on Apple Silicon, frame budget <16 ms for viewer interactions  
**Constraints**: No new documentation beyond README.md and `docs/TESTING.md`; must run offline with Ollama; telemetry failures buffered (50 events, 5 s exponential retry); responsive safe areas per `docs/project_overview.md §5`; PHI-free demo data only  
**Scale/Scope**: Single canonical sample slide + deterministic viewer journey, telemetry ingestion via `/viewer-telemetry`, CI Playwright + VLM audits, maintainers + automation users consuming evidence artifacts

## Constitution Check

1. **Deterministic Imaging Fidelity – Pass**: Viewer updates stay within `frontend/src/viewer` (StateManager, Canvas/NiiVue hooks) to guarantee zoom/pan and overlay math, backed by Vitest ROI math specs and Playwright screenshot diffs enforcing ≤2 px drift plus DPR toggles (Principle references kept in README/docs pathways).  
2. **Dual-Layer Evidence – Pass**: Every scenario maps to Vitest suites (`frontend/src/viewer/__tests__`) plus Playwright journeys (`frontend/e2e/viewer-sample-slide.spec.ts`) that collect screenshots + JSON in `frontend/playwright-report/`, with failing tests before implementation for metadata drift, telemetry schema errors, and responsive regressions.  
3. **Responsive & Accessible Header-First UX – Pass**: Breakpoints follow `docs/project_overview.md §5`; Acceptance Scenarios already list DPR + device states, and Playwright runs cover desktop/tablet/large-phone/small-phone, asserting header safe areas, panel escape actions, and ARIA/tap-target checks.  
4. **Inspectable Automation & Observability – Pass**: Telemetry buffer + payload schema (`event`, `slideId`, `viewport`, `latencyMs`, `commandVersion`) integrate with `/viewer-telemetry` logging, FastAPI `/healthz`, and CI artifacts capturing emitted metrics, ensuring Principle 4 coverage.  
5. **Clinical Safety, Data Stewardship, and Documentation – Pass**: Work limits to `public/` demo assets, enforces README + `docs/TESTING.md` updates only, and codifies PHI redaction on the backend plus telemetry persistence requirements so governance expectations remain satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/001-project-guide-index/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md          # created later via /speckit.tasks
```

### Source Code (repository root)

```text
agentic_cervical_screener/
├── __init__.py
├── main.py
├── model_loader.py
├── telemetry/
├── models/
└── tests/

frontend/
├── src/
│   ├── viewer/
│   ├── components/
│   ├── services/
│   ├── styles/
│   └── e2e/
├── public/
├── docs/
└── tests/

public/
└── samples/
```

**Structure Decision**: Monorepo with FastAPI backend (`agentic_cervical_screener/`) + Vite/TypeScript frontend (`frontend/`); this mirrors the spec’s division of backend telemetry ingestion and frontend viewer workflows while keeping documentation + public assets centralized.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _None_ | – | – |

## Constitution Check (Post-Design)

1. **Deterministic Imaging Fidelity – Pass**: `data-model.md` defines SampleSlideBundle invariants + telemetry state machine, while `quickstart.md` + contracts ensure Vitest/Playwright evidence and README/docs alignment remain deterministic.  
2. **Dual-Layer Evidence – Pass**: Research + quickstart sections map Vitest + Playwright commands, and contracts enforce telemetry schema so both layers fail fast when drift occurs.  
3. **Responsive & Accessible Header-First UX – Pass**: Research log documents multi-breakpoint artifact capture; quickstart instructs running the responsive Playwright suite + VLM validations, satisfying Principle 3.  
4. **Inspectable Automation & Observability – Pass**: OpenAPI contract plus telemetry buffer design specify structured payloads, retries, and `/healthz`, ensuring CI artifacts expose metrics.  
5. **Clinical Safety, Data Stewardship, and Documentation – Pass**: Data model + quickstart reiterate README/`docs/TESTING.md` as sole documentation touchpoints and restrict assets to `public/`, keeping governance intact.

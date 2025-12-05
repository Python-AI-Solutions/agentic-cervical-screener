# Implementation Plan: Project Overview Guidance Index

**Branch**: `001-project-guide-index` | **Date**: 2025-11-15 | **Spec**: `specs/001-project-guide-index/spec.md`  
**Input**: Feature specification from `/specs/001-project-guide-index/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deliver a deterministic Niivue-based cervical slide viewer experience that launches from the canonical README + `docs/TESTING.md` commands and feeds a Playwright + Python VLM pipeline that captures screenshots enforcing responsive, accessible layouts without introducing new documentation surfaces.

## Technical Context

**Language/Version**: Python ≥3.14 (FastAPI backend) + TypeScript 5.x (Vite frontend)  
**Primary Dependencies**: FastAPI, PyTorch/Ultralytics YOLO, Pixi, Niivue, Tailwind CSS, Vitest, Playwright, `llm` CLI + mlx_vlm plugin  
**Storage**: N/A (demo case assets + metadata in `public/`)  
**Testing**: `pixi run test` (Python/FastAPI), `cd frontend && pixi run test` (Vitest), `cd frontend && pixi run test-e2e-ci` (Playwright), `cd frontend && pixi run vlm-viewer` (VLM audit)  
**Target Platform**: FastAPI service on macOS/Linux dev hosts + browser-based viewer (desktop/tablet/phone per responsiveness table)  
**Project Type**: Web monorepo (FastAPI backend + Vite frontend)  
**Performance Goals**: Demo slide loads ≤15 s, overlay/pan state restores ≤200 ms post-resize, VLM stage finishes ≤5 min on Apple Silicon, frame budget <16 ms for viewer interactions  
**Constraints**: No new documentation beyond README.md and `docs/TESTING.md`; must run offline using the bundled `llm` CLI plugin; responsive safe areas per `docs/project_overview.md §5`; PHI-free demo data only  
**Scale/Scope**: Single canonical demo slide + deterministic viewer journey, CI Playwright + VLM audits, maintainers + automation users consuming evidence artifacts

## Constitution Check

1. **Deterministic Imaging Fidelity – Pass**: Viewer updates stay within `frontend/src/viewer` (StateManager, Canvas/NiiVue hooks) to guarantee zoom/pan and overlay math, backed by Vitest ROI math specs and Playwright screenshot diffs enforcing ≤2 px drift plus DPR toggles (Principle references kept in README/docs pathways).  
2. **Dual-Layer Evidence – Pass**: Every scenario maps to Vitest suites (`frontend/src/viewer/__tests__`) plus Playwright journeys (`frontend/e2e/viewer.spec.ts`) that collect screenshots stored in `frontend/playwright-report/`, with failing tests before implementation for metadata drift and responsive regressions.  
3. **Responsive & Accessible Header-First UX – Pass**: Breakpoints follow `docs/project_overview.md §5`; Acceptance Scenarios already list DPR + device states, and Playwright runs cover desktop/tablet/large-phone/small-phone, asserting header safe areas, panel escape actions, and ARIA/tap-target checks.  
4. **Clinical Safety, Data Stewardship, and Documentation – Pass**: Work limits to `public/` demo assets, enforces README + `docs/TESTING.md` updates only, and maintains PHI redaction expectations.

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
└── mock/
```

**Structure Decision**: Monorepo with FastAPI backend (`agentic_cervical_screener/`) + Vite/TypeScript frontend (`frontend/`); this mirrors the spec’s division of backend services and frontend viewer workflows while keeping documentation + public assets centralized.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _None_ | – | – |

## Constitution Check (Post-Design)

1. **Deterministic Imaging Fidelity – Pass**: `data-model.md` defines demo-case invariants, while `quickstart.md` + contracts ensure Vitest/Playwright evidence and README/docs alignment remain deterministic.  
2. **Dual-Layer Evidence – Pass**: Research + quickstart sections map Vitest + Playwright commands plus the Python VLM audit so both layers fail fast when drift occurs.  
3. **Responsive & Accessible Header-First UX – Pass**: Research log documents multi-breakpoint artifact capture; quickstart instructs running the responsive Playwright suite + VLM validations, satisfying Principle 3.  
4. **Clinical Safety, Data Stewardship, and Documentation – Pass**: Data model + quickstart reiterate README/`docs/TESTING.md` as sole documentation touchpoints and restrict assets to `public/`, keeping governance intact.

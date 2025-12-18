---
audience:
  - Contributors
  - Maintainers
owners:
  - "@Python-AI-Solutions/platform"
doc_version: 2.0.0
last_reviewed: 2026-01-01
update_triggers:
  - Static viewer or dataset changes
  - Model export pipeline changes
  - Serve/static hosting workflow changes
anchor_slugs:
  - product-goals
  - architecture
  - orientation-path
  - testing
---

# Agentic Cervical Screener – Project Overview (Static)

The repository now ships a single static viewer under `public/` backed by CRIC dataset tiles. The legacy Vite/Playwright frontend was removed; all viewer logic lives in `public/src/`.

## Product Goals
- **Accurate Cytology Review**: Explore CRIC tiles, overlay YOLO detections/ground truth, and collect user ROIs in-browser.
- **Static-first Delivery**: Everything required to run lives in `public/`; serve it locally or deploy as a static site.
- **Deterministic Rendering**: Coordinate transforms handle browser zoom/DPR so images, overlays, and user-drawn ROIs stay aligned.

## Architecture
| Layer | Location | Notes |
| --- | --- | --- |
| Static Viewer | `public/index.html`, `public/src/` | Vanilla JS + NiiVue. Loads CRIC data from `public/cases/*.json` and images from `public/images/*.webp`. |
| Optional API | `src/`, `agentic_cervical_screener/` | FastAPI endpoints for `/v1/classify*`; not required for static hosting. |
| Model Assets | `public/model/` | ONNX exports + `labels.json`. |
| Data | `public/cases/`, `public/images/` | Indexed by `public/cases/dataset-samples.json`. |

## Orientation Path
1. Read [`README.md`](../README.md) for the static workflow and CRIC sample list.  
2. Serve the site locally: `pixi run serve-static` → http://localhost:8000. Draw an ROI at 67%, 100%, and 175% zoom to confirm alignment.  
3. (Optional) Run the FastAPI app: `pixi run dev`; set `window.__ENV__.API_BASE` in the browser if you want backend classification.  
4. Run backend tests: `pixi run test`.

## Testing
- Backend: `pixi run test`, `pixi run test-coverage`
- Manual UI smoke: serve statically, load a CRIC case, draw ROIs across zoom levels, toggle ground truth/AI detections, and upload an image.

## Deployment
- Static hosting: deploy `public/` (e.g., Cloudflare Pages). `_headers` already enables COOP/COEP for WASM threading.
- Model updates: export with `pixi run python -m scripts.export_to_onnx --model-path src/models/best.pt --output-dir public/model`.
- Data updates: add CRIC samples via `pixi run import-dataset-cases --ids <image_id_1> ...` which updates `public/cases/dataset-samples.json`.

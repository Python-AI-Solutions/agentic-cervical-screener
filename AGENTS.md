# Agent Development Guide

This repo ships a single static viewer under `public/` backed by CRIC sample data. There is no separate TypeScript/Vite frontend; ignore any legacy references to `frontend/`. Try to use pixi for all tasks/dependencies including local tasks like one off python scripts etc. i.e. `pixi run python...`

## Project Overview
- **Viewer**: Vanilla JS + NiiVue in `public/src/`
- **Data**: CRIC tiles + YOLO labels in `public/images/` and `public/cases/` (indexed by `public/cases/dataset-samples.json`)
- **Model**: ONNX artifacts in `public/model/`
- **Optional API**: FastAPI (`src/` or `agentic_cervical_screener/`) for `/v1/classify*`; static hosting works without it.

## Project Structure
```
public/                # Static site root
  ├── index.html
  ├── src/             # Viewer JS modules
  ├── images/          # CRIC tiles (WebP)
  ├── cases/           # Metadata + GeoJSON labels
  ├── model/           # ONNX + labels.json
  └── niivue/          # NiiVue assets
scripts/serve_static.py # Local static server with COOP/COEP headers
scripts/import_dataset_cases.py # Populate CRIC samples into public/cases + images
src/                   # Optional FastAPI app entrypoint
tests/                 # Backend tests
```

## Running the Viewer
- **Static (recommended)**: `pixi run serve-static` → open http://localhost:8000
- **With backend**: `pixi run dev` (or `pixi run start`) to serve API + static assets; set `window.__ENV__.API_BASE` in the page if you want JS to hit the API.

## Testing
- Backend: `pixi run test`
- Lint/format: `pixi run lint`, `pixi run format`

## Common Tasks
- Import CRIC samples: `pixi run import-dataset-cases --ids <image_id_1> ...`
- Export ONNX: `pixi run python -m scripts.export_to_onnx --model-path src/models/best.pt --output-dir public/model`

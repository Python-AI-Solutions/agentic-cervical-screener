# Testing

The project is now a static viewer served from `public/`. Testing is focused on the Python API and quick manual smoke checks of the static UI.

## Automated (Python)
- **Unit/integration**: `pixi run test` (pytest in `tests/`)
- **Coverage**: `pixi run test-coverage`
- **Lint/format**: `pixi run lint`, `pixi run format`

## Manual (Static Viewer)
1) Serve the site: `pixi run serve-static` → http://localhost:8000  
2) Load a CRIC sample from the sidebar.  
3) Draw an ROI at different browser zoom levels (e.g., 67%, 100%, 175%) and verify the rectangle tracks the cursor.  
4) Toggle ground-truth and AI detections; classify to ensure boxes render.  
5) Drag-and-drop an image to confirm uploads still work.

The legacy Vitest/Playwright pipelines have been removed with the old `frontend/` tree; the static viewer code under `public/src/` is the single source of truth.

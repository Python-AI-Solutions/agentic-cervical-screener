# TODO (Static Viewer)

## Viewer & UI
- [ ] Smoke-test ROI drawing alignment across browser zoom levels (desktop + mobile breakpoints).
- [ ] Confirm header/sidebar responsiveness after removing the old Vite frontend (desktop/mobile sidebar + notifications).

## Data & Assets
- [ ] Keep `public/cases/dataset-samples.json` in sync with any added CRIC tiles.
- [ ] Document CRIC label taxonomy in `public/model/labels.json` if it changes.

## Deployment
- [ ] Validate Cloudflare Pages/static hosting after CRIC-only switch (`public/` as root).
- [ ] Re-export ONNX model when weights are updated (`scripts/export_to_onnx`).

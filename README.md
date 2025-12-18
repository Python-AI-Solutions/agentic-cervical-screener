# Cervical AI Viewer (Classification-only Demo)

A web-based cervical screening tool that uses AI to classify and detect abnormal cells in cervical cytology images. The app now ships purely as a static site under `public/` (vanilla JS + NiiVue) backed by CRIC demo data; the Python API is optional.

## Features

- **AI-Powered Classification**: Uses YOLO model for detecting and classifying cervical cells
- **Interactive Viewer**: Built with NiiVue for smooth image navigation and visualization (no build step required)
- **Bounding Box Overlays**: Visual detection results with confidence scores
- **CRIC Dataset Samples**: Pre-loaded CRIC tiles + YOLO ground truth (see `public/cases/dataset-samples.json`)
- **ROI Navigation**: Navigate between regions of interest
- **Real-time Analysis**: Upload and analyze new images instantly
- **Layer Controls**: Toggle different overlay types and adjust visibility

## Tech Stack

- **Viewer**: Static vanilla JavaScript + NiiVue under `public/src`
- **Optional API**: FastAPI with Python 3.12 (for `/v1/classify*` endpoints)
- **AI Model**: PyTorch YOLO for cell detection and classification
- **Package Management**: Pixi (conda-forge ecosystem)

## Quick Start

### Prerequisites

- [Pixi](https://pixi.sh) package manager installed
- Python 3.11+ (managed by Pixi)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd agentic-cervical-screener
   ```

2. Install dependencies:
   ```bash
   pixi install
   ```

### Development / Local serve

Serve the static site (no backend required):
```bash
pixi run serve-static
```

Open **http://localhost:8000**.  
`public/` is the root, so `/src`, `/cases`, `/images`, `/model`, and `/niivue` are all available.

Run the optional API (if you want backend classification instead of in-browser ONNX):
```bash
pixi run dev
```
The static site still loads from `public/`; set `window.__ENV__.API_BASE` if you want the JS to call the backend.

### Usage

1. **Load Dataset Samples**: Choose a CRIC sample from the sidebar (ground-truth labels optional)
2. **Classify Images**: Click "Classify" to run AI analysis on the current image
3. **Navigate ROIs**: Use the ROI navigation buttons to move between regions of interest
4. **Upload Images**: Drag and drop new images for analysis
5. **Toggle Overlays**: Switch between ground truth and AI predictions

### API Endpoints

- `GET /` - Static viewer (`public/index.html`)
- `GET /healthz` - Health check and model status
- `POST /v1/classify` - Classify image by slide ID or image URI
- `POST /v1/classify-upload` - Classify uploaded image file
- `GET /cases/{case_id}` - Get case data and metadata
- `GET /model-info` - Get loaded model information

### Dataset Samples

- Dataset-backed static cases live under `public/cases/` and are indexed by `public/cases/dataset-samples.json`.
- Import more samples (image + YOLO ground truth as GeoJSON): `pixi run import-dataset-cases --ids <image_id_1> <image_id_2> ...`

## Browser export (ONNX; int8 is experimental)

- Install the optional deps (Pixi): `pixi install` (onnx/onnxruntime/onnxslim are in the env).
- Export for CPU/WASM (WebGPU optional):  
  `pixi run python -m scripts.export_to_onnx --model-path src/models/best.pt --output-dir public/model --imgsz 640 --opset 17 --quantize none`
- Output: `public/model/best.onnx` (fp32, includes built-in NMS).
- Label metadata: `public/model/labels.json` is generated from the `.pt` checkpoint class names and used by the browser UI for labeling detections.
- Optional int8: `--quantize static` / `--quantize dynamic` will also write `public/model/best.int8.onnx`, but see the quantization notes below before enabling it in the browser.

### Quantization notes (current limitations)

At the time of writing, `onnxruntime` int8 quantization (static QDQ/QOperator and dynamic) for this model graph produces a model that runs but returns **all-zero detections** (confidence scores are always 0), even though the fp32 model produces correct detections. This appears to be related to quantizing graphs that include post-processing ops such as `NonMaxSuppression` / `NonZero` and mixed int64 shape/index tensors.

Practical impact:
- The app defaults to **FP32** (`public/model/best.onnx`) for correctness.
- If you want to experiment with int8 anyway, set `window.__ENV__.PREFER_INT8 = true` and/or `window.__ENV__.MODEL_INT8_URL`, and validate output quality.

## In-browser inference (onnxruntime-web)

- The viewer defaults to client-side inference with `onnxruntime-web` (CPU/WASM first). Set `window.__ENV__.IN_BROWSER_INFERENCE=false` if you need to force backend mode.
- To try WebGPU (stretch goal), set `window.__ENV__.ENABLE_WEBGPU=true`. It will fall back to WASM if WebGPU init fails.
- Model URL defaults to `model/best.onnx` (fp32). Override with `window.__ENV__.MODEL_FP32_URL`.  
  Optional int8 is disabled by default; enable via `window.__ENV__.ENABLE_INT8=true` and/or set `window.__ENV__.MODEL_INT8_URL`. Use `window.__ENV__.PREFER_INT8=true` to try int8 before fp32.
- Class labels default to `model/labels.json`. Override with `window.__ENV__.CLASS_NAMES` (array) or `window.__ENV__.LABELS_URL`.
- To keep WASM multithreading fast, serve with COOP/COEP headers if possible; otherwise it will fall back to single-threaded.
- Dropped images (PNG/JPG/WebP) are classified locally without a network call.

## Local static testing (no backend)

1) Ensure ONNX artifacts exist:  
   `pixi run python -m scripts.export_to_onnx --model-path src/models/best.pt --output-dir public/model --imgsz 640 --opset 17 --quantize none`
2) Serve the repo statically with COOP/COEP headers (enables WASM threads):  
   `pixi run serve-static`  
   - Serves `public/` as the web root (so `/niivue`, `/images`, `/cases`, `/model`, `/src` all resolve).  
   - Open http://localhost:8000/
3) Opening `public/index.html` directly via `file://` will not work (module and WASM fetches are blocked); always use a local server.
4) If you ever see requests like `GET /ort-wasm-*.wasm` (404) or `POST /v1/classify` (501) in the local server logs, hard-refresh the page: older cached JS can still point ORT at same-origin WASM or try a backend fallback. The current code loads ORT WASM from the jsDelivr CDN by default.

## Cloudflare Pages (static deploy)

- `public/` is a self-contained static site (including `public/src/*` modules).
- Cloudflare management repo: add a `pages_projects` entry with `destination_dir = "public"` and `custom_domain = "cervical-screening.pythonaisolutions.com"`.
- Remove any legacy DNS records for `cervical-screening` from `subdomain_records` (they conflict with the CNAME created by the Pages module).
- Site repo workflow: `.github/workflows/deploy.yml` deploys `public/` via `wrangler pages deploy`.
- `_headers` in `public/_headers` sets COOP/COEP/CORP and CORS for WASM threading.
- Ensure `public/model/best.onnx` is committed (generated by the export script). `public/model/best.int8.onnx` is optional/experimental.

## Assets

- Demo slide images are stored as WebP in `public/images/*.webp` (PNG sources are intentionally not shipped in `public/` to keep static deploy size down).
- Convert new demo images: `pixi run python -m scripts.convert_images_to_webp --input-dir public/images --overwrite --delete-originals` (lossless by default; use `--no-lossless` for smaller lossy files).
- Import dataset-backed demo cases (image + YOLO ground truth as GeoJSON):  
  `pixi run import-dataset-cases --ids <image_id_1> <image_id_2> ...`  
  - Writes `public/images/<id>.webp` (lossless), `public/cases/cric-<id>.json`, and `public/cases/cric-<id>-gt.geojson`.  
  - Updates `public/cases/dataset-samples.json`, which the UI uses to render the “Dataset samples (CRIC)” list in the sidebar.

## Development Commands (Python/backend + static viewer)

```bash
pixi run serve-static   # Serve public/ (preferred for the static viewer)
pixi run dev            # Run the FastAPI app (optional backend)
pixi run start          # Production FastAPI server
pixi run test           # Backend tests
pixi run test-coverage  # Backend test coverage
pixi run lint           # Ruff lint
pixi run format         # Ruff format
```

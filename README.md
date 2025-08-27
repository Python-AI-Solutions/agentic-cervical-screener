# Cervical AI Viewer (Classification-only Demo)

Static web viewer using Niivue (vendored) to render a slide image (PNG/JPG) and overlay **bounding boxes** returned by a classifier API.
- **Scope :** classification only. Button triggers `POST /v1/classify` and draws boxes + labels.
- **Features:** 4 demo cases, ROI navigation, layer controls, drag-and-drop
- **Niivue assets:** vendored at `public/niivue/niivue.js` and `public/niivue/niivue.css`.

## Run
```bash
# Frontend
python3 -m http.server 8080
# open http://localhost:8080/public 

# Backend (for full API integration)
cd backend-stub
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Point to API
Add before module script in `public/index.html`:
```html
<script>window.__ENV__={API_BASE:'http://localhost:8000'}</script>
```

## Backend stub
See `backend-stub/` to run a local FastAPI that serves `/v1/classify` with mock boxes.

## Deploy
`Dockerfile` serves `public/` with nginx. K8s manifest in `deploy/k8s/deploy.yaml`.

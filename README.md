# Cervical AI Viewer (Classification-only Demo)

Static web viewer using Niivue (vendored) to render a slide image (PNG/JPG) and overlay **bounding boxes** returned by a classifier API.
- **Scope :** classification only. Button triggers `POST /v1/classify` and draws boxes + labels.
- **Features:** 4 demo cases, ROI navigation, layer controls, drag-and-drop
- **Niivue assets:** vendored at `public/niivue/niivue.js` and `public/niivue/niivue.css`.

## Run Locally (Python)
```bash
# Frontend
python3 -m http.server 8080
# open http://localhost:8080/public 

# Backend (for full API integration)
pip install -r backend-stub/requirements.txt
uvicorn backend-stub.main:app --host 0.0.0.0 --port 8000 
```



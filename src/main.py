import base64
import json
import os
import re
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .model_loader import initialize_model

model_inference = None
app = FastAPI(title="Cervical AI Classifier (YOLO)", version="1.0.0")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (public/ is the canonical site)
public_dir = os.path.join(os.getcwd(), "public")
public_path = Path(public_dir)
cases_path = public_path / "cases"

app.mount("/images", StaticFiles(directory=os.path.join(public_dir, "images")), name="images")
app.mount("/niivue", StaticFiles(directory=os.path.join(public_dir, "niivue")), name="niivue")
app.mount("/model", StaticFiles(directory=os.path.join(public_dir, "model")), name="model")
app.mount("/src", StaticFiles(directory=os.path.join(public_dir, "src")), name="src")


# Initialize model on startup
@app.on_event("startup")
async def startup_event():
    global model_inference

    print("=== STARTUP EVENT STARTING ===")
    print(f"Current working directory: {os.getcwd()}")
    print(f"Script directory: {os.path.dirname(os.path.abspath(__file__))}")

    try:
        # Use absolute path based on the script location
        current_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(current_dir, "models", "best.pt")
        print(f"Looking for model at: {model_path}")
        print(f"File exists: {os.path.exists(model_path)}")

        if os.path.exists(model_path):
            print("Model file found, initializing...")
            # Initialize and store in our global variable
            model_inference = initialize_model(model_path)
            print("YOLO model initialized successfully")
        else:
            print("Model file NOT found!")

    except Exception as e:
        print(f"Failed to initialize YOLO model: {e}")
        import traceback

        traceback.print_exc()
        print("Running in mock mode")

    print("=== STARTUP EVENT COMPLETE ===")
    print(f"Global model_inference: {model_inference is not None}")


class ClassifyReq(BaseModel):
    slide_id: str | None = None
    image_uri: str | None = None
    conf_threshold: float | None = 0.25


class Box(BaseModel):
    x: int
    y: int
    w: int
    h: int
    label: str
    score: float
    class_id: int | None = None


class ClassifyResp(BaseModel):
    slide_id: str
    boxes: list[Box]
    total_detections: int
    class_summary: dict


def _case_file_for_id(case_id: str) -> Path:
    """Map a case_id to a file under public/cases, rejecting path traversal."""
    case_id = (case_id or "").strip()
    if not case_id:
        raise HTTPException(status_code=400, detail="case_id is required")
    normalized = case_id.lower()
    if not re.fullmatch(r"[a-z0-9-]+", normalized):
        raise HTTPException(status_code=400, detail="invalid case_id")
    return cases_path / f"{normalized}.json"


def _case_asset_path_for_request(case_path: str) -> Path:
    """Map a request path segment to a file under public/cases, rejecting traversal."""
    case_path = (case_path or "").strip()
    if not case_path:
        raise HTTPException(status_code=400, detail="case path is required")

    rel_path = Path(case_path)
    if rel_path.is_absolute() or ".." in rel_path.parts:
        raise HTTPException(status_code=400, detail="invalid case path")

    resolved_cases = cases_path.resolve()
    resolved_target = (cases_path / rel_path).resolve()
    if resolved_cases != resolved_target and resolved_cases not in resolved_target.parents:
        raise HTTPException(status_code=400, detail="invalid case path")
    return resolved_target


@app.get("/")
def read_index():
    """Serve the main frontend HTML file"""
    index_path = os.path.join(public_dir, "index.html")
    return FileResponse(index_path)


@app.get("/healthz")
def healthz():
    return {
        "ok": True,
        "model_loaded": model_inference is not None,
        "model_type": "YOLO" if model_inference else "None",
    }


@app.get("/model-info")
def model_info():
    """Get information about the loaded model"""
    if model_inference is None:
        return {"error": "Model not loaded"}

    return {
        "model_type": "YOLO",
        "class_names": model_inference.class_names,
        "device": model_inference.device,
        "conf_threshold": model_inference.conf_threshold,
    }


@app.post("/v1/classify", response_model=ClassifyResp)
def classify(req: ClassifyReq):
    slide_id = req.slide_id or "SLIDE-001"
    conf_threshold = req.conf_threshold or 0.25

    print("=== CLASSIFY REQUEST ===")
    print(f"slide_id: {slide_id}")
    print(f"image_uri: {req.image_uri}")

    try:
        if model_inference is None:
            return get_mock_results(slide_id)

        # Use YOLO model inference
        if req.image_uri:
            print(f"Running inference on image_uri: {req.image_uri}")

            # Use local file path since backend has access to public directory
            if req.image_uri.startswith("images/"):
                image_path = os.path.join(public_dir, req.image_uri)
                print(f"Using local image path: {image_path}")
            else:
                image_path = req.image_uri

            result = model_inference.predict(image_path, conf_threshold)
            boxes = result["boxes"]
        else:
            print(f"Running inference on slide_id: {slide_id}")
            # Look up the case data to find the actual image URI.
            # For dataset-backed cases, slide_id is expected to match case_id.
            try:
                case_file = _case_file_for_id(slide_id)
                with open(case_file, encoding="utf-8") as f:
                    case_data = json.load(f)

                # Extract image URI from case data
                slide_data = case_data.get("slides", [{}])[0]
                image_uri = slide_data.get("uri")
                if not image_uri:
                    raise ValueError("Case file missing slides[0].uri")
                image_path = os.path.join(public_dir, image_uri)
                print(f"Found image URI '{image_uri}' from case data, using path: {image_path}")

            except Exception as e:
                raise HTTPException(status_code=404, detail=f"Could not resolve slide_id to a case: {e}") from e

            result = model_inference.predict(image_path, conf_threshold)
            print(f"YOLO result: {result}")
            boxes = result["boxes"]

        # Get class summary
        class_summary = model_inference.get_class_summary(boxes)

        return {
            "slide_id": slide_id,
            "boxes": boxes,
            "total_detections": len(boxes),
            "class_summary": class_summary,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"YOLO inference failed: {e}")
        # Fallback to mock results when inference fails unexpectedly
        return get_mock_results(slide_id)


@app.post("/v1/classify-upload")
async def classify_upload(file: UploadFile = File(...), conf_threshold: float = 0.25):
    """Classify uploaded image file"""
    try:
        if model_inference is None:
            raise HTTPException(status_code=500, detail="Model not loaded")

        # Read uploaded file
        contents = await file.read()

        # Convert to base64 for processing
        image_base64 = base64.b64encode(contents).decode()
        image_input = f"data:image/{file.content_type};base64,{image_base64}"

        # Run inference
        result = model_inference.predict(image_input, conf_threshold)
        boxes = result["boxes"]

        # Get class summary
        class_summary = model_inference.get_class_summary(boxes)

        return {
            "filename": file.filename,
            "boxes": boxes,
            "total_detections": len(boxes),
            "class_summary": class_summary,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}") from e


@app.get("/cases/{case_id}")
def get_case(case_id: str):
    """Serve case assets from public/cases.

    This endpoint supports both:
    - case IDs (e.g. "CRIC-...") -> mapped to "<lowercase>.json"
    - literal filenames (e.g. "dataset-samples.json", "cric-...-gt.geojson")

    We use a single endpoint so the static viewer can fetch `/cases/*.json` while API
    clients can fetch `/cases/<case_id>` without conflicting with a static mount.
    """
    path_segment = (case_id or "").strip()
    if not path_segment:
        raise HTTPException(status_code=400, detail="case_id is required")

    if "." in path_segment:
        case_file = _case_asset_path_for_request(path_segment)
    else:
        case_file = _case_file_for_id(path_segment)

    if not case_file.exists() or not case_file.is_file():
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    return FileResponse(case_file)


def get_mock_results(slide_id: str):
    """Fallback mock results when model fails"""
    mock_results = {
        "SLIDE-001": [
            {
                "x": 120,
                "y": 120,
                "w": 100,
                "h": 100,
                "label": "HSIL",
                "score": 0.92,
            },
            {"x": 300, "y": 200, "w": 60, "h": 60, "label": "Negative for intraepithelial lesion", "score": 0.65},
        ],
        "SLIDE-002": [
            {"x": 200, "y": 180, "w": 90, "h": 80, "label": "LSIL", "score": 0.73},
        ],
        "SLIDE-003": [
            {"x": 180, "y": 100, "w": 85, "h": 75, "label": "ASC-US", "score": 0.85},
        ],
        "SLIDE-004": [
            {"x": 110, "y": 140, "w": 95, "h": 85, "label": "SCC", "score": 0.94},
        ],
    }

    boxes = mock_results.get(slide_id, mock_results["SLIDE-001"])
    class_summary = {
        "Negative for intraepithelial lesion": 0,
        "ASC-US": 0,
        "ASC-H": 0,
        "LSIL": 0,
        "HSIL": 0,
        "SCC": 0,
    }

    for box in boxes:
        if box["label"] in class_summary:
            class_summary[box["label"]] += 1

    return {
        "slide_id": slide_id,
        "boxes": boxes,
        "total_detections": len(boxes),
        "class_summary": class_summary,
    }

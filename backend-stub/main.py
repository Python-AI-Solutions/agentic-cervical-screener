from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import os, json

app = FastAPI(title="Classifier Stub", version="0.1.0")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files so backend can serve images and mock data
repo_root = os.path.dirname(os.path.dirname(__file__))
public_dir = os.path.join(repo_root, "public")

# Serve images at /images/
app.mount("/images", StaticFiles(directory=os.path.join(public_dir, "images")), name="images")

# Serve mock data at /mock/
app.mount("/mock", StaticFiles(directory=os.path.join(public_dir, "mock")), name="mock")

class ClassifyReq(BaseModel):
    slide_id: Optional[str] = None
    image_uri: Optional[str] = None

class Box(BaseModel):
    x: int; y: int; w: int; h: int
    label: str; score: float

class ClassifyResp(BaseModel):
    slide_id: str
    boxes: List[Box]

@app.get("/healthz")
def healthz(): return {"ok": True}

@app.get("/cases/{case_id}")
def get_case(case_id: str):
    """Serve case JSON - maps case IDs to their JSON files"""
    try:
        repo_root = os.path.dirname(os.path.dirname(__file__))
        
        # Map case IDs to their JSON files
        case_mapping = {
            "DEMO-001": "case-demo.json",
            "DEMO-002": "case-002.json",
            "DEMO-003": "case-003.json", 
            "DEMO-004": "case-004.json"
        }
        
        # Default to case-demo.json if not found
        case_file = case_mapping.get(case_id, "case-demo.json")
        case_path = os.path.join(repo_root, "public", "mock", case_file)
        
        with open(case_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        return {"error": f"Case {case_id} not found: {str(e)}"}

@app.post("/v1/classify", response_model=ClassifyResp)
def classify(req: ClassifyReq):
    slide_id = req.slide_id or "SLIDE-001"
    print(f"🔍 CLASSIFY REQUEST: slide_id={slide_id}")  # Debug logging
    
    # Return different mock results based on slide_id to simulate real AI behavior
    # When Abdul provides weights, replace this entire function with real inference.
    
    # Map slide IDs to different mock classification results
    mock_results = {
        "SLIDE-001": [  # Original case - moderate findings
            {"x": 120, "y": 120, "w": 100, "h": 100, "label": "HSIL-like", "score": 0.92},
            {"x": 300, "y": 200, "w": 60, "h": 60, "label": "Artifact", "score": 0.65},
            {"x": 450, "y": 150, "w": 80, "h": 70, "label": "ASC-US", "score": 0.78}
        ],
        "SLIDE-002": [  # LSIL case - fewer, different locations
            {"x": 200, "y": 180, "w": 90, "h": 80, "label": "LSIL", "score": 0.73},
            {"x": 380, "y": 120, "w": 70, "h": 60, "label": "LSIL", "score": 0.68}
        ],
        "SLIDE-003": [  # Mixed case - various findings
            {"x": 180, "y": 100, "w": 85, "h": 75, "label": "HSIL-like", "score": 0.85},
            {"x": 350, "y": 220, "w": 65, "h": 55, "label": "LSIL", "score": 0.71},
            {"x": 480, "y": 180, "w": 70, "h": 60, "label": "ASC-US", "score": 0.69},
            {"x": 150, "y": 300, "w": 55, "h": 45, "label": "Artifact", "score": 0.62}
        ],
        "SLIDE-004": [  # High risk case - many findings
            {"x": 110, "y": 140, "w": 95, "h": 85, "label": "HSIL-like", "score": 0.94},
            {"x": 280, "y": 180, "w": 85, "h": 70, "label": "HSIL-like", "score": 0.89},
            {"x": 420, "y": 120, "w": 75, "h": 65, "label": "HSIL-like", "score": 0.82},
            {"x": 200, "y": 280, "w": 80, "h": 60, "label": "ASC-H", "score": 0.76},
            {"x": 380, "y": 320, "w": 65, "h": 55, "label": "LSIL", "score": 0.71}
        ]
    }
    
    # Get boxes for the specific slide, fallback to SLIDE-001 if not found
    boxes = mock_results.get(slide_id, mock_results["SLIDE-001"])
    print(f"🎯 RETURNING {len(boxes)} boxes for {slide_id}")  # Debug logging
    
    return {"slide_id": slide_id, "boxes": boxes}

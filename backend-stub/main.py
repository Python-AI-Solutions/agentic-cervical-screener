from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import os, json
import base64
import io
from PIL import Image
from model_loader import initialize_model, model_inference

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

# Mount static files
repo_root = os.path.dirname(os.path.dirname(__file__))
public_dir = os.path.join(repo_root, "public")

app.mount("/images", StaticFiles(directory=os.path.join(public_dir, "images")), name="images")
app.mount("/mock", StaticFiles(directory=os.path.join(public_dir, "mock")), name="mock")

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
    slide_id: Optional[str] = None
    image_uri: Optional[str] = None
    conf_threshold: Optional[float] = 0.25

class Box(BaseModel):
    x: int
    y: int
    w: int
    h: int
    label: str
    score: float
    class_id: Optional[int] = None

class ClassifyResp(BaseModel):
    slide_id: str
    boxes: List[Box]
    total_detections: int
    class_summary: dict

@app.get("/healthz")
def healthz(): 
    return {
        "ok": True, 
        "model_loaded": model_inference is not None,
        "model_type": "YOLO" if model_inference else "None"
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
        "conf_threshold": model_inference.conf_threshold
    }

@app.post("/v1/classify", response_model=ClassifyResp)
def classify(req: ClassifyReq):
    slide_id = req.slide_id or "SLIDE-001"
    conf_threshold = req.conf_threshold or 0.25
    
    print(f"=== CLASSIFY REQUEST ===")
    print(f"slide_id: {slide_id}")
    print(f"image_uri: {req.image_uri}")
    
    try:
        if model_inference is None:
            return get_mock_results(slide_id)
        
        # Use YOLO model inference
        if req.image_uri:
            print(f"Running inference on image_uri: {req.image_uri}")
            
            # Convert relative paths to HTTP URLs with correct public/ prefix
            if req.image_uri.startswith('images/'):
                # Convert images/test-image.png to http://localhost:8080/public/images/test-image.png
                image_url = f"http://localhost:8080/public/{req.image_uri}"
                print(f"Converted to HTTP URL: {image_url}")
            else:
                image_url = req.image_uri
            
            result = model_inference.predict(image_url, conf_threshold)
            boxes = result["boxes"]
        else:
            print(f"Running inference on slide_id: {slide_id}")
            # Use HTTP URL to the frontend-served image with public/ prefix
            image_url = f"http://localhost:8080/public/images/{slide_id}.png"
            print(f"Looking for image at: {image_url}")
            
            result = model_inference.predict(image_url, conf_threshold)
            print(f"YOLO result: {result}")
            boxes = result["boxes"]
        
        # Get class summary
        class_summary = model_inference.get_class_summary(boxes)
        
        return {
            "slide_id": slide_id, 
            "boxes": boxes,
            "total_detections": len(boxes),
            "class_summary": class_summary
        }
        
    except Exception as e:
        print(f"YOLO inference failed: {e}")
        # Fallback to mock results
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
            "class_summary": class_summary
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")

@app.get("/cases/{case_id}")
def get_case(case_id: str):
    """Serve case JSON - maps case IDs to their JSON files"""
    try:
        repo_root = os.path.dirname(os.path.dirname(__file__))
        
        case_mapping = {
            "DEMO-001": "case-demo.json",
            "DEMO-002": "case-002.json",
            "DEMO-003": "case-003.json", 
            "DEMO-004": "case-004.json"
        }
        
        case_file = case_mapping.get(case_id, "case-demo.json")
        case_path = os.path.join(repo_root, "public", "mock", case_file)
        
        with open(case_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        return {"error": f"Case {case_id} not found: {str(e)}"}

def get_mock_results(slide_id: str):
    """Fallback mock results when model fails"""
    mock_results = {
        "SLIDE-001": [
            {"x": 120, "y": 120, "w": 100, "h": 100, "label": "unhealthy", "score": 0.92},
            {"x": 300, "y": 200, "w": 60, "h": 60, "label": "rubbish", "score": 0.65},
        ],
        "SLIDE-002": [
            {"x": 200, "y": 180, "w": 90, "h": 80, "label": "bothcells", "score": 0.73},
        ],
        "SLIDE-003": [
            {"x": 180, "y": 100, "w": 85, "h": 75, "label": "unhealthy", "score": 0.85},
        ],
        "SLIDE-004": [
            {"x": 110, "y": 140, "w": 95, "h": 85, "label": "unhealthy", "score": 0.94},
        ]
    }
    
    boxes = mock_results.get(slide_id, mock_results["SLIDE-001"])
    class_summary = {"healthy": 0, "rubbish": 0, "unhealthy": 0, "bothcells": 0}
    
    for box in boxes:
        if box["label"] in class_summary:
            class_summary[box["label"]] += 1
    
    return {
        "slide_id": slide_id, 
        "boxes": boxes,
        "total_detections": len(boxes),
        "class_summary": class_summary
    }       
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Classifier Stub", version="0.1.0")

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

@app.post("/v1/classify", response_model=ClassifyResp)
def classify(req: ClassifyReq):
    slide_id = req.slide_id or "SLIDE-001"
    boxes = [
        {"x": 120, "y": 120, "w": 100, "h": 100, "label": "HSIL-like", "score": 0.92},
        {"x": 300, "y": 200, "w":  60, "h":  60, "label": "Artifact",  "score": 0.65},
    ]
    return {"slide_id": slide_id, "boxes": boxes}

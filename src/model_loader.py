import base64
import io
import os
from typing import Any

import cv2
import numpy as np
import torch
from PIL import Image
from ultralytics import YOLO


class YOLOCervicalClassifier:
    def __init__(self, model_path: str, device: str = "cpu"):
        self.device = device
        self.model = self.load_model(model_path)
        self.class_names = ["healthy", "rubbish", "unhealthy", "bothcells"]
        self.conf_threshold = 0.25

    def load_model(self, model_path: str) -> YOLO:
        """Load YOLO model from .pt file"""
        try:
            model = YOLO(model_path)
            print(f"YOLO model loaded successfully from {model_path}")
            return model
        except Exception as e:
            print(f"Error loading YOLO model: {e}")
            raise

    def preprocess_image(self, image_input: str) -> np.ndarray:
        """Handle different image input types (file path, URL, base64)"""
        try:
            if image_input.startswith("data:image"):
                # Handle base64 encoded image
                image_data = image_input.split(",")[1]
                image_bytes = base64.b64decode(image_data)
                image = Image.open(io.BytesIO(image_bytes))
                return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

            elif image_input.startswith("http"):
                # Handle remote URLs
                import requests

                response = requests.get(image_input, timeout=10)
                image_array = np.frombuffer(response.content, np.uint8)
                return cv2.imdecode(image_array, cv2.IMREAD_COLOR)

            else:
                # Handle local file paths
                return cv2.imread(image_input)

        except Exception as e:
            print(f"Error preprocessing image: {e}")
            raise

    def predict(self, image_input: str, conf_threshold: float = None) -> dict[str, Any]:
        """Run YOLO inference and return predictions"""
        try:
            # Set confidence threshold
            if conf_threshold is None:
                conf_threshold = self.conf_threshold

            # Preprocess image
            image = self.preprocess_image(image_input)
            if image is None:
                raise ValueError("Failed to load image")

            # Run YOLO inference
            results = self.model(image, conf=conf_threshold, verbose=False)

            # Process results
            boxes = self.process_yolo_results(results[0], image.shape)

            return {"boxes": boxes, "image_shape": image.shape, "total_detections": len(boxes)}

        except Exception as e:
            print(f"Error during YOLO inference: {e}")
            raise

    def process_yolo_results(self, result, image_shape: tuple) -> list[dict]:
        """Convert YOLO results to our API format"""
        boxes = []

        if result.boxes is not None:
            for box in result.boxes:
                # Get coordinates (YOLO returns normalized coordinates)
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()

                # Convert to integer pixel coordinates
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

                # Calculate width and height
                w = x2 - x1
                h = y2 - y1

                # Get class and confidence
                class_id = int(box.cls[0].cpu().numpy())
                confidence = float(box.conf[0].cpu().numpy())

                # Map class names
                label = (
                    self.class_names[class_id]
                    if class_id < len(self.class_names)
                    else f"class_{class_id}"
                )

                boxes.append(
                    {
                        "x": x1,
                        "y": y1,
                        "w": w,
                        "h": h,
                        "label": label,
                        "score": confidence,
                        "class_id": class_id,
                    }
                )

        return boxes

    def get_class_summary(self, boxes: list[dict]) -> dict[str, int]:
        """Get count of each class detected"""
        summary = {class_name: 0 for class_name in self.class_names}
        for box in boxes:
            label = box["label"]
            if label in summary:
                summary[label] += 1
        return summary


# Global model instance
model_inference = None


def initialize_model(model_path: str = None):
    """Initialize the YOLO model globally"""
    global model_inference
    if model_inference is None:
        if model_path is None:
            # Default path - adjust to your .pt file location
            model_path = os.path.join(os.path.dirname(__file__), "models", "best.pt")

        # Use CUDA if available, otherwise CPU
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {device}")

        model_inference = YOLOCervicalClassifier(model_path, device)
    return model_inference

import base64
import contextlib
import hashlib
import io
import os
from typing import Any

import cv2
import numpy as np
import torch
from PIL import Image
from ultralytics import YOLO


class YOLOCervicalClassifier:
    def __init__(self, model_path: str, device: str = "cpu", conf_threshold: float = 0.25):
        """
        Inference wrapper for Ultralytics YOLO models.

        - Extracts class names robustly from the checkpoint/model.
        - Attaches model_path and model_hash for easier verification.
        """
        self.device = device
        self.model_path = model_path
        self.model_hash: str | None = None
        self.conf_threshold = conf_threshold

        # load model and metadata
        self.model = self.load_model(model_path)
        # try to extract class names from model/checkpoint; fall back to defaults
        extracted = self._extract_names()
        self.class_names = (
            extracted if extracted is not None else ["healthy", "rubbish", "unhealthy", "bothcells"]
        )

    def _compute_file_hash(self, path: str) -> str | None:
        try:
            h = hashlib.sha256()
            with open(path, "rb") as f:
                while chunk := f.read(8192):
                    h.update(chunk)
            return h.hexdigest()
        except Exception:
            return None

    def load_model(self, model_path: str) -> YOLO:
        """Load YOLO model from .pt file and try to move to device."""
        try:
            model = YOLO(model_path)

            # try to move internal torch model to device if available
            with contextlib.suppress(Exception):
                # Some ultralytics versions expose a `.model` torch module
                internal = getattr(model, "model", None)
                if internal is not None and hasattr(internal, "to"):
                    internal.to(self.device)

            self.model_path = model_path
            self.model_hash = self._compute_file_hash(model_path)
            print(f"YOLO model loaded successfully from {model_path}")
            print(f"Model file hash: {self.model_hash}")
            return model
        except Exception as e:
            print(f"Error loading YOLO model: {e}")
            raise

    def _extract_names(self) -> list[str] | None:
        """
        Try multiple fallbacks to extract class names from the loaded model or checkpoint.
        Always returns a list[str] if possible, otherwise None.
        """

        def _normalize_names_obj(nm) -> list[str] | None:
            if nm is None:
                return None
            # If it's a dict like {0: 'healthy', 1: 'rubbish'}
            if isinstance(nm, dict):
                try:
                    # Prefer numeric ordering of keys
                    keys = sorted(nm.keys(), key=lambda k: int(k))
                    return [str(nm[k]) for k in keys]
                except (ValueError, TypeError):
                    # fallback to values order
                    return [str(v) for v in nm.values()]
            # If it's list/tuple or other iterable
            try:
                return [str(x) for x in list(nm)]
            except (TypeError, ValueError):
                return None

        # 1) Try attributes exposed by ultralytics model instance
        try:
            if hasattr(self, "model") and self.model is not None:
                names = getattr(self.model, "names", None)
                if names:
                    normalized = _normalize_names_obj(names)
                    if normalized:
                        return normalized

                inner = getattr(self.model, "model", None)
                if inner is not None:
                    names_inner = getattr(inner, "names", None)
                    if names_inner:
                        normalized = _normalize_names_obj(names_inner)
                        if normalized:
                            return normalized
        except (AttributeError, TypeError, ValueError):
            pass

        # 2) Try reading checkpoint file directly (defensive)
        try:
            ckpt = torch.load(self.model_path, map_location="cpu")
            if isinstance(ckpt, dict):
                if "names" in ckpt and ckpt["names"]:
                    normalized = _normalize_names_obj(ckpt["names"])
                    if normalized:
                        return normalized
                if "model" in ckpt:
                    m = ckpt["model"]
                    # m may be nn.Module with .names or a dict with 'names'
                    if hasattr(m, "names"):
                        normalized = _normalize_names_obj(m.names)
                        if normalized:
                            return normalized
                    if isinstance(m, dict) and "names" in m:
                        normalized = _normalize_names_obj(m["names"])
                        if normalized:
                            return normalized
        except (OSError, KeyError, TypeError, ValueError):
            pass

        # Not found
        return None

    def preprocess_image(self, image_input: Any) -> np.ndarray:
        """Handle different image input types (file path, URL, base64, numpy array)"""
        try:
            # base64 data URL
            if isinstance(image_input, str) and image_input.startswith("data:image"):
                image_data = image_input.split(",", 1)[1]
                image_bytes = base64.b64decode(image_data)
                image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

            # http(s) url
            if isinstance(image_input, str) and image_input.startswith(("http://", "https://")):
                import requests

                response = requests.get(image_input, timeout=10)
                image_array = np.frombuffer(response.content, np.uint8)
                img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
                return img

            # local path
            if isinstance(image_input, str | os.PathLike):
                img = cv2.imread(str(image_input))
                return img

            # numpy array passthrough
            if isinstance(image_input, np.ndarray):
                return image_input

            raise ValueError("Unsupported image_input format")
        except Exception as e:
            print(f"Error preprocessing image: {e}")
            raise

    def predict(self, image_input: Any, conf_threshold: float | None = None) -> dict[str, Any]:
        """Run YOLO inference and return predictions"""
        try:
            if conf_threshold is None:
                conf_threshold = self.conf_threshold

            image = self.preprocess_image(image_input)
            if image is None:
                raise ValueError("Failed to load image")

            # Run model inference. Provide device so ultralytics runs on correct device.
            results = self.model(image, conf=conf_threshold, device=self.device, verbose=False)

            # results may be a list or single Results object
            result = results[0] if isinstance(results, list | tuple) else results
            boxes = self.process_yolo_results(result, image.shape)

            return {
                "boxes": boxes,
                "image_shape": image.shape,
                "total_detections": len(boxes),
            }
        except Exception as e:
            print(f"Error during YOLO inference: {e}")
            raise

    def process_yolo_results(self, result: Any, image_shape: tuple) -> list[dict]:
        """
        Convert YOLO results to API format. Robust to different ultralytics versions.
        Ensures label is always a string to satisfy Pydantic/API validation.
        """
        boxes: list[dict] = []

        try:
            if result is None:
                return boxes

            if getattr(result, "boxes", None) is None:
                return boxes

            # Iterate safely over Box objects or box tensors
            try:
                iter_boxes = list(result.boxes)
            except (AttributeError, TypeError):
                # fallback: try to build from tensors on result.boxes
                iter_boxes = []
                with contextlib.suppress(Exception):
                    all_xyxy = getattr(result.boxes, "xyxy", None)
                    all_conf = getattr(result.boxes, "conf", None)
                    all_cls = getattr(result.boxes, "cls", None)
                    if all_xyxy is not None:
                        xy_arr = all_xyxy.cpu().numpy()
                        conf_arr = (
                            all_conf.cpu().numpy().flatten()
                            if all_conf is not None
                            else [0.0] * len(xy_arr)
                        )
                        cls_arr = (
                            all_cls.cpu().numpy().flatten().astype(int)
                            if all_cls is not None
                            else [-1] * len(xy_arr)
                        )
                        for i, row in enumerate(xy_arr):
                            iter_boxes.append((row, conf_arr[i], int(cls_arr[i])))

            # If iter_boxes contains Box objects, parse them; if contains tuples, handle accordingly
            for b in iter_boxes:
                xyxy = None
                conf = None
                cls_id = None

                # Case A: b is a Box-like object with attributes
                if not isinstance(b, tuple):
                    try:
                        xyxy_attr = getattr(b, "xyxy", None)
                        if xyxy_attr is not None:
                            try:
                                vals = xyxy_attr[0].cpu().numpy()
                            except (AttributeError, IndexError):
                                vals = xyxy_attr.cpu().numpy().flatten()
                            xyxy = [int(v) for v in vals[:4]]
                    except (AttributeError, TypeError, ValueError):
                        pass

                    try:
                        conf_attr = getattr(b, "conf", None)
                        if conf_attr is not None:
                            conf = float(conf_attr[0].cpu().numpy())
                    except (AttributeError, TypeError, ValueError):
                        pass

                    try:
                        cls_attr = getattr(b, "cls", None)
                        if cls_attr is not None:
                            cls_id = int(cls_attr[0].cpu().numpy())
                    except (AttributeError, TypeError, ValueError):
                        pass
                else:
                    # Case B: b is a tuple (xyxy_row, conf, cls)
                    try:
                        row, conf, cls_id = b
                        xyxy = [int(v) for v in np.array(row)[:4]]
                        conf = float(conf)
                        cls_id = int(cls_id)
                    except (ValueError, TypeError, IndexError):
                        pass

                # If we still don't have coordinates, skip
                if xyxy is None:
                    continue

                x1, y1, x2, y2 = [int(v) for v in xyxy[:4]]
                w = int(x2 - x1)
                h = int(y2 - y1)

                class_id = int(cls_id) if cls_id is not None else -1
                confidence = float(conf) if conf is not None else 0.0

                # Defensive label mapping: try self.class_names (list) first, then model.names
                label = f"class_{class_id}"
                try:
                    if 0 <= class_id < len(self.class_names):
                        label = str(self.class_names[class_id])
                    else:
                        # try model.names mapping (could be dict or list)
                        names_map = getattr(self.model, "names", None) or getattr(
                            getattr(self.model, "model", None), "names", None
                        )
                        if names_map is not None:
                            if isinstance(names_map, dict):
                                # try numeric key then string key
                                label = str(
                                    names_map.get(class_id, names_map.get(str(class_id), label))
                                )
                            else:
                                # assume sequence
                                try:
                                    label = str(names_map[class_id])
                                except (IndexError, KeyError, TypeError):
                                    # fallback: attempt to obtain first item as string
                                    with contextlib.suppress(Exception):
                                        label = str(list(names_map)[int(class_id)])
                except (AttributeError, TypeError, ValueError):
                    label = str(label)

                boxes.append(
                    {
                        "x": int(x1),
                        "y": int(y1),
                        "w": int(w),
                        "h": int(h),
                        "label": str(label),
                        "score": float(confidence),
                        "class_id": int(class_id),
                    }
                )
        except Exception as e:
            print("Warning while processing YOLO results:", e)

        return boxes

    def get_class_summary(self, boxes: list[dict]) -> dict[str, int]:
        """Get count of each class detected, keyed by the current class_names."""
        summary: dict[str, int] = dict.fromkeys(self.class_names, 0)
        for box in boxes:
            label = str(box.get("label"))
            if label in summary:
                summary[label] += 1
            else:
                summary.setdefault(label, 0)
                summary[label] += 1
        return summary


# Global model instance
model_inference: YOLOCervicalClassifier | None = None


def initialize_model(model_path: str | None = None) -> YOLOCervicalClassifier:
    """
    Initialize or reload the YOLO model globally.

    Behavior:
      - If a global model is not present -> load given path or default models/best.pt
      - If a global model exists but a different model_path is provided -> reload the model
      - If model_path is None and a model is already loaded -> return existing model
    """
    global model_inference

    default_path = os.path.join(os.path.dirname(__file__), "models", "best.pt")
    model_path = model_path or default_path

    # If already loaded and same path, return existing instance
    if model_inference is not None and getattr(model_inference, "model_path", None) == model_path:
        return model_inference

    # Determine device
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    print(f"initialize_model: using device: {device}, model_path: {model_path}")

    # Load new model (this will raise on error)
    model_inference = YOLOCervicalClassifier(model_path, device)
    print("initialize_model: loaded class names:", model_inference.class_names)
    return model_inference

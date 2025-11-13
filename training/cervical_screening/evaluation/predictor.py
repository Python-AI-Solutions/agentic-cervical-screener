"""
Prediction with Issue #25 improvements
"""

import numpy as np
import torch
import torch.nn.functional as F


class ImprovedPredictor:
    """
    Predictor with Issue #25 improvements:
    - Decoupled objectness from class decision
    - Per-class thresholds
    """

    def __init__(self, model, config):
        """
        Initialize predictor

        Args:
            model: Trained YOLO model
            config: TrainingConfig with thresholds
        """
        self.model = model
        self.config = config
        self.class_names = config.class_names

    def predict(self, image_path, verbose=False):
        """
        Enhanced prediction with Issue #25 improvements

        Args:
            image_path: Path to image
            verbose: Print detailed information

        Returns:
            Dictionary with detections and metadata
        """
        # Get raw predictions
        results = self.model(image_path, conf=self.config.objectness_threshold, verbose=False)

        if len(results) == 0 or results[0].boxes is None or len(results[0].boxes) == 0:
            return {
                "detections": [],
                "image_path": str(image_path),
                "total_boxes": 0,
                "accepted": 0,
            }

        boxes = results[0].boxes
        detections = []

        for i, box in enumerate(boxes):
            # Extract objectness score
            objectness = float(box.conf[0])

            # Issue #25: Decouple - Check objectness separately
            if objectness < self.config.objectness_threshold:
                continue

            # Get class predictions
            # YOLO stores class probabilities in box.data after coordinates and confidence
            box_data = box.data[0].cpu()

            # Extract class scores (after box coords [4] and objectness [1])
            if len(box_data) > 5:
                class_scores = box_data[5:].numpy()

                # FIX: Normalize class scores to probabilities using softmax
                class_probs_tensor = torch.tensor(class_scores, dtype=torch.float32)
                class_probs = F.softmax(class_probs_tensor, dim=0).numpy()

                class_id = int(np.argmax(class_probs))
                class_prob = float(class_probs[class_id])
            else:
                # Fallback: use class from box.cls and objectness as confidence
                class_id = int(box.cls[0])
                class_prob = objectness

            class_name = (
                self.class_names[class_id]
                if class_id < len(self.class_names)
                else f"class_{class_id}"
            )

            # Issue #25: Per-class threshold check
            class_threshold = self.config.per_class_thresholds.get(class_name, 0.3)
            passes_threshold = class_prob >= class_threshold

            detection = {
                "box": box.xyxy[0].cpu().numpy().tolist(),
                "objectness": objectness,
                "class_id": class_id,
                "class_name": class_name,
                "confidence": class_prob,  # Now properly normalized 0.0-1.0
                "passes_threshold": passes_threshold,
                "threshold_used": class_threshold,
            }

            detections.append(detection)

        accepted = len([d for d in detections if d["passes_threshold"]])

        return {
            "detections": detections,
            "image_path": str(image_path),
            "total_boxes": len(boxes),
            "accepted": accepted,
        }

    def predict_batch(self, image_paths, verbose=False):
        """
        Predict on multiple images

        Args:
            image_paths: List of image paths
            verbose: Print progress

        Returns:
            List of prediction dictionaries
        """
        results = []

        for i, img_path in enumerate(image_paths):
            if verbose and (i + 1) % 10 == 0:
                print(f"Processed {i + 1}/{len(image_paths)} images")

            result = self.predict(img_path, verbose=False)
            results.append(result)

        return results

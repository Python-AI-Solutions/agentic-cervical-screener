"""
Test-Time Augmentation (TTA) Evaluation
"""

import time
from collections import defaultdict
from pathlib import Path

from PIL import Image


class TTAEvaluator:
    """
    Evaluates model performance with Test-Time Augmentation

    Compares regular prediction vs TTA prediction in terms of:
    - Detection consistency
    - Inference time
    - Detection counts
    """

    def __init__(self, model, conf_threshold=0.25):
        """
        Initialize TTA evaluator

        Args:
            model: YOLO model
            conf_threshold: Confidence threshold for predictions
        """
        self.model = model
        self.conf_threshold = conf_threshold

    def apply_augmentations(self, image_path):
        """
        Create augmented versions of image

        Args:
            image_path: Path to input image

        Returns:
            Dictionary of augmented images
        """
        img = Image.open(image_path)

        augmentations = {
            "original": img,
            "flip_horizontal": img.transpose(Image.FLIP_LEFT_RIGHT),
            "flip_vertical": img.transpose(Image.FLIP_TOP_BOTTOM),
            "rotate_90": img.rotate(90, expand=True),
        }

        return augmentations

    def predict_regular(self, image_path):
        """
        Regular prediction without TTA

        Args:
            image_path: Path to image

        Returns:
            Dictionary with prediction results and timing
        """
        start_time = time.time()
        results = self.model.predict(image_path, conf=self.conf_threshold, verbose=False)
        inference_time = time.time() - start_time

        boxes = results[0].boxes

        if len(boxes) == 0:
            return {"boxes": 0, "class_counts": {}, "time": inference_time}

        classes = boxes.cls.cpu().numpy().astype(int)
        class_counts = defaultdict(int)
        for cls in classes:
            class_counts[cls] += 1

        return {"boxes": len(boxes), "class_counts": dict(class_counts), "time": inference_time}

    def predict_with_tta(self, image_path):
        """
        Run prediction with Test-Time Augmentation

        Args:
            image_path: Path to image

        Returns:
            Dictionary with averaged TTA results and timing
        """
        # Get augmented versions
        augmentations = self.apply_augmentations(image_path)

        all_results = []
        start_time = time.time()

        # Predict on each augmentation
        for aug_name, aug_img in augmentations.items():
            results = self.model.predict(aug_img, conf=self.conf_threshold, verbose=False)
            all_results.append({"augmentation": aug_name, "results": results[0]})

        tta_time = time.time() - start_time

        # Average detections across augmentations
        class_counts = defaultdict(int)
        total_boxes = 0

        for r in all_results:
            boxes = r["results"].boxes
            if len(boxes) > 0:
                classes = boxes.cls.cpu().numpy().astype(int)
                for cls in classes:
                    class_counts[cls] += 1
                total_boxes += len(boxes)

        # Average across augmentations
        num_augs = len(augmentations)
        avg_class_counts = {k: v / num_augs for k, v in class_counts.items()}
        avg_boxes = total_boxes / num_augs

        return {
            "avg_boxes": avg_boxes,
            "class_counts": avg_class_counts,
            "time": tta_time,
            "num_augmentations": num_augs,
        }

    def compare_single_image(self, image_path, verbose=False):
        """
        Compare regular vs TTA on single image

        Args:
            image_path: Path to image
            verbose: Print detailed output

        Returns:
            Comparison dictionary
        """
        if verbose:
            print(f"Processing: {Path(image_path).name}")

        # Regular prediction
        regular = self.predict_regular(image_path)

        # TTA prediction
        tta = self.predict_with_tta(image_path)

        # Calculate metrics
        time_ratio = tta["time"] / regular["time"] if regular["time"] > 0 else 0
        detection_diff = abs(tta["avg_boxes"] - regular["boxes"])
        detection_change_pct = (
            (detection_diff / regular["boxes"] * 100) if regular["boxes"] > 0 else 0
        )

        comparison = {
            "image": str(Path(image_path).name),
            "regular_boxes": regular["boxes"],
            "regular_time": regular["time"],
            "tta_boxes": tta["avg_boxes"],
            "tta_time": tta["time"],
            "time_ratio": time_ratio,
            "detection_diff": detection_diff,
            "detection_change_pct": detection_change_pct,
        }

        if verbose:
            print(f"  Regular: {regular['boxes']} boxes, {regular['time']:.3f}s")
            print(
                f"  TTA:     {tta['avg_boxes']:.1f} boxes, {tta['time']:.3f}s ({time_ratio:.1f}x)"
            )

        return comparison

    def evaluate_dataset(self, image_dir, max_images=None, verbose=True):
        """
        Evaluate TTA on multiple images

        Args:
            image_dir: Directory containing images
            max_images: Maximum number of images to test (None = all)
            verbose: Print progress

        Returns:
            List of comparison results
        """
        image_dir = Path(image_dir)
        image_paths = sorted(image_dir.glob("*.png")) + sorted(image_dir.glob("*.jpg"))

        if max_images is not None:
            image_paths = image_paths[:max_images]

        if verbose:
            print(f"\nEvaluating TTA on {len(image_paths)} images")
            print("=" * 80)

        # Warmup
        if len(image_paths) > 0 and verbose:
            print("\nWarming up model...")
            _ = self.model.predict(image_paths[0], conf=self.conf_threshold, verbose=False)
            print("✅ Model warmed up\n")

        results = []
        for i, img_path in enumerate(image_paths, 1):
            if verbose:
                print(f"\n[{i}/{len(image_paths)}]", end=" ")

            comparison = self.compare_single_image(img_path, verbose=verbose)
            results.append(comparison)

        return results

    def generate_summary(self, results):
        """
        Generate summary statistics from TTA evaluation

        Args:
            results: List of comparison results

        Returns:
            Summary dictionary
        """
        import pandas as pd

        df = pd.DataFrame(results)

        summary = {
            "num_images": int(len(results)),
            "total_regular_time": float(df["regular_time"].sum()),
            "total_tta_time": float(df["tta_time"].sum()),
            "avg_time_ratio": float(df["time_ratio"].mean()),
            "total_regular_boxes": int(df["regular_boxes"].sum()),
            "total_tta_boxes": float(df["tta_boxes"].sum()),
            "avg_detection_change": float(df["detection_change_pct"].mean()),
        }

        # Calculate recommendation
        avg_slowdown = summary["avg_time_ratio"]

        if avg_slowdown > 3.5:
            recommendation = {
                "speed_assessment": "VERY SLOW",
                "recommendation": "NOT RECOMMENDED",
                "reasoning": [
                    f"TTA adds significant latency ({avg_slowdown:.1f}x slower)",
                    "Not suitable for real-time inference",
                    "Could be used for offline batch processing only",
                ],
            }
        elif avg_slowdown > 2.5:
            recommendation = {
                "speed_assessment": "SLOW",
                "recommendation": "USE ONLY FOR BATCH PROCESSING",
                "reasoning": [
                    f"TTA is moderately slow ({avg_slowdown:.1f}x slower)",
                    "Not ideal for interactive use",
                    "Acceptable for batch processing",
                ],
            }
        else:
            recommendation = {
                "speed_assessment": "MODERATE",
                "recommendation": "CONSIDER FOR CRITICAL CASES",
                "reasoning": [
                    f"TTA slowdown is moderate ({avg_slowdown:.1f}x)",
                    "Could be acceptable for high-stakes cases",
                    "Trade-off between speed and stability",
                ],
            }

        summary["recommendation"] = recommendation

        return summary

"""
Slide-level aggregation from cell-level predictions
"""

from collections import Counter
from pathlib import Path


class SlideAggregator:
    """
    Aggregates cell-level predictions into slide-level diagnosis

    Applies clinical rules to determine overall slide diagnosis based on
    detected cell types and their proportions.
    """

    def __init__(self, class_names):
        """
        Initialize slide aggregator

        Args:
            class_names: List of class names (Bethesda categories)
        """
        self.class_names = class_names
        self.class_map = dict(enumerate(class_names))

    def aggregate_slide(self, image_path, model, conf_threshold=0.25):
        """
        Analyze a single slide and return aggregated results

        Args:
            image_path: Path to slide image
            model: YOLO model for prediction
            conf_threshold: Confidence threshold for detection

        Returns:
            Dictionary with slide-level diagnosis and cell counts
        """
        # Run prediction
        results = model.predict(image_path, conf=conf_threshold, verbose=False)
        boxes = results[0].boxes

        if len(boxes) == 0:
            return {
                "slide_path": str(image_path),
                "slide_name": Path(image_path).name,
                "total_cells": 0,
                "cell_counts": {},
                "cell_percentages": {},
                "slide_diagnosis": "INSUFFICIENT",
                "diagnosis_confidence": 0.0,
                "avg_confidence": 0.0,
                "predictions": [],
            }

        # Extract predictions
        class_ids = boxes.cls.cpu().numpy().astype(int)
        confidences = boxes.conf.cpu().numpy()
        xyxy_boxes = boxes.xyxy.cpu().numpy()

        # Count cells per class
        cell_counts = Counter()
        predictions = []

        for i, class_id in enumerate(class_ids):
            class_name = self.class_map.get(class_id, f"Unknown_{class_id}")
            cell_counts[class_name] += 1

            predictions.append(
                {
                    "class_id": int(class_id),
                    "class_name": class_name,
                    "box": xyxy_boxes[i].tolist(),
                    "confidence": float(confidences[i]),
                }
            )

        total_cells = sum(cell_counts.values())

        # Calculate percentages
        cell_percentages = {
            class_name: (count / total_cells * 100) for class_name, count in cell_counts.items()
        }

        # Apply clinical rules
        slide_diagnosis, diagnosis_confidence = self._apply_aggregation_rules(
            cell_counts, total_cells
        )

        return {
            "slide_path": str(image_path),
            "slide_name": Path(image_path).name,
            "total_cells": total_cells,
            "cell_counts": dict(cell_counts),
            "cell_percentages": cell_percentages,
            "slide_diagnosis": slide_diagnosis,
            "diagnosis_confidence": diagnosis_confidence,
            "avg_confidence": float(confidences.mean()),
            "predictions": predictions,
        }

    def _apply_aggregation_rules(self, cell_counts, total_cells):
        """
        Apply clinical rules to determine slide-level diagnosis

        Rules (highest priority first):
        1. Any SCC → Slide = SCC
        2. HSIL > 10 cells OR > 1% → Slide = HSIL
        3. ASC-H > 15 cells OR > 2% → Slide = ASC-H
        4. LSIL > 5 cells OR > 2% → Slide = LSIL
        5. ASC-US > 10 cells OR > 3% → Slide = ASC-US
        6. Otherwise → Slide = NILM

        Args:
            cell_counts: Counter of cell types
            total_cells: Total number of cells

        Returns:
            Tuple of (diagnosis, confidence_percentage)
        """
        # Get counts
        scc_count = cell_counts.get("SCC", 0)
        hsil_count = cell_counts.get("HSIL", 0)
        asch_count = cell_counts.get("ASC-H", 0)
        lsil_count = cell_counts.get("LSIL", 0)
        ascus_count = cell_counts.get("ASC-US", 0)
        nilm_count = cell_counts.get("Negative for intraepithelial lesion", 0)

        # Calculate percentages
        scc_pct = (scc_count / total_cells * 100) if total_cells > 0 else 0
        hsil_pct = (hsil_count / total_cells * 100) if total_cells > 0 else 0
        asch_pct = (asch_count / total_cells * 100) if total_cells > 0 else 0
        lsil_pct = (lsil_count / total_cells * 100) if total_cells > 0 else 0
        ascus_pct = (ascus_count / total_cells * 100) if total_cells > 0 else 0
        nilm_pct = (nilm_count / total_cells * 100) if total_cells > 0 else 0

        # Apply rules (priority order)
        if scc_count > 0:
            return "SCC", scc_pct
        elif hsil_count > 10 or hsil_pct > 1.0:
            return "HSIL", hsil_pct
        elif asch_count > 15 or asch_pct > 2.0:
            return "ASC-H", asch_pct
        elif lsil_count > 5 or lsil_pct > 2.0:
            return "LSIL", lsil_pct
        elif ascus_count > 10 or ascus_pct > 3.0:
            return "ASC-US", ascus_pct
        else:
            return "NILM", nilm_pct

    def aggregate_dataset(self, image_dir, model, conf_threshold=0.25, max_slides=None):
        """
        Aggregate all slides in a directory

        Args:
            image_dir: Directory containing slide images
            model: YOLO model
            conf_threshold: Confidence threshold
            max_slides: Maximum number of slides to process (None = all)

        Returns:
            List of slide results
        """
        image_dir = Path(image_dir)
        image_files = sorted(image_dir.glob("*.png")) + sorted(image_dir.glob("*.jpg"))

        if max_slides is not None:
            image_files = image_files[:max_slides]

        print(f"\nProcessing {len(image_files)} slides...")

        results = []
        for i, img_path in enumerate(image_files, 1):
            if i % 5 == 0 or i == len(image_files):
                print(f"  [{i}/{len(image_files)}] processed")

            result = self.aggregate_slide(img_path, model, conf_threshold)
            results.append(result)

        return results

    def generate_summary(self, slide_results):
        """
        Generate summary statistics from slide results

        Args:
            slide_results: List of slide result dictionaries

        Returns:
            Summary dictionary
        """
        # Count diagnoses
        diagnosis_counts = Counter([r["slide_diagnosis"] for r in slide_results])

        # Calculate statistics
        total_slides = len(slide_results)
        total_cells = sum(r["total_cells"] for r in slide_results)
        avg_cells_per_slide = total_cells / total_slides if total_slides > 0 else 0

        # Get diagnosis distribution
        diagnosis_distribution = {
            diagnosis: {
                "count": count,
                "percentage": (count / total_slides * 100) if total_slides > 0 else 0,
            }
            for diagnosis, count in diagnosis_counts.items()
        }

        return {
            "total_slides": total_slides,
            "total_cells": total_cells,
            "avg_cells_per_slide": avg_cells_per_slide,
            "diagnosis_distribution": diagnosis_distribution,
            "diagnosis_counts": dict(diagnosis_counts),
        }

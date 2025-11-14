"""
Metrics calculation for model evaluation
"""

from collections import defaultdict

import numpy as np
import pandas as pd


class MetricsCalculator:
    """
    Calculate comprehensive evaluation metrics

    Metrics include:
    - Precision, Recall, F1 per class
    - mAP50, mAP50-95
    - Confusion matrix
    """

    def __init__(self, class_names):
        """
        Initialize metrics calculator

        Args:
            class_names: List of class names
        """
        self.class_names = class_names
        self.num_classes = len(class_names)

    def calculate_detection_metrics(self, predictions, ground_truth, iou_threshold=0.5):
        """
        Calculate detection metrics (precision, recall per class)

        Args:
            predictions: List of predicted boxes per image
                        Each item: {'boxes': [...], 'classes': [...], 'scores': [...]}
            ground_truth: List of ground truth boxes per image
                         Each item: {'boxes': [...], 'classes': [...]}
            iou_threshold: IoU threshold for matching

        Returns:
            Dictionary with per-class metrics
        """
        # Initialize counters per class
        tp = defaultdict(int)  # True positives
        fp = defaultdict(int)  # False positives
        fn = defaultdict(int)  # False negatives

        for pred, gt in zip(predictions, ground_truth):
            pred_boxes = pred.get("boxes", [])
            pred_classes = pred.get("classes", [])
            pred_scores = pred.get("scores", [])

            gt_boxes = gt.get("boxes", [])
            gt_classes = gt.get("classes", [])

            # Track which GT boxes are matched
            matched_gt = set()

            # Sort predictions by score (descending)
            sorted_indices = np.argsort(pred_scores)[::-1]

            for idx in sorted_indices:
                pred_box = pred_boxes[idx]
                pred_class = pred_classes[idx]

                best_iou = 0
                best_gt_idx = -1

                # Find best matching GT box
                for gt_idx, (gt_box, gt_class) in enumerate(zip(gt_boxes, gt_classes)):
                    if gt_idx in matched_gt:
                        continue

                    if pred_class != gt_class:
                        continue

                    iou = self._calculate_iou(pred_box, gt_box)
                    if iou > best_iou:
                        best_iou = iou
                        best_gt_idx = gt_idx

                # Check if it's a TP or FP
                if best_iou >= iou_threshold and best_gt_idx != -1:
                    tp[pred_class] += 1
                    matched_gt.add(best_gt_idx)
                else:
                    fp[pred_class] += 1

            # Count false negatives (unmatched GT boxes)
            for gt_idx, gt_class in enumerate(gt_classes):
                if gt_idx not in matched_gt:
                    fn[gt_class] += 1

        # Calculate metrics per class
        metrics = {}

        for class_id, class_name in enumerate(self.class_names):
            tp_count = tp[class_id]
            fp_count = fp[class_id]
            fn_count = fn[class_id]

            precision = tp_count / (tp_count + fp_count) if (tp_count + fp_count) > 0 else 0
            recall = tp_count / (tp_count + fn_count) if (tp_count + fn_count) > 0 else 0
            f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

            metrics[class_name] = {
                "precision": precision,
                "recall": recall,
                "f1": f1,
                "tp": tp_count,
                "fp": fp_count,
                "fn": fn_count,
            }

        return metrics

    def calculate_map(self, predictions, ground_truth, iou_thresholds=None):
        """
        Calculate mean Average Precision (mAP)

        Args:
            predictions: List of predictions
            ground_truth: List of ground truth
            iou_thresholds: List of IoU thresholds (default: [0.5] for mAP50)

        Returns:
            Dictionary with mAP values
        """
        if iou_thresholds is None:
            iou_thresholds = [0.5]
        aps = []

        for iou_thresh in iou_thresholds:
            class_aps = []

            for class_id in range(self.num_classes):
                ap = self._calculate_ap_for_class(predictions, ground_truth, class_id, iou_thresh)
                class_aps.append(ap)

            aps.append(np.mean(class_aps))

        results = {
            "mAP50": aps[0] if len(aps) > 0 else 0,
        }

        if len(iou_thresholds) > 1:
            results["mAP50-95"] = np.mean(aps)

        return results

    def _calculate_ap_for_class(self, predictions, ground_truth, class_id, iou_threshold):
        """Calculate Average Precision for a single class"""
        # Collect all predictions for this class
        all_predictions = []

        for img_idx, pred in enumerate(predictions):
            boxes = pred.get("boxes", [])
            classes = pred.get("classes", [])
            scores = pred.get("scores", [])

            for box, cls, score in zip(boxes, classes, scores):
                if cls == class_id:
                    all_predictions.append({"image_id": img_idx, "box": box, "score": score})

        if len(all_predictions) == 0:
            return 0.0

        # Sort by confidence
        all_predictions.sort(key=lambda x: x["score"], reverse=True)

        # Count total GT boxes for this class
        total_gt = sum(
            sum(1 for cls in gt.get("classes", []) if cls == class_id) for gt in ground_truth
        )

        if total_gt == 0:
            return 0.0

        # Calculate precision-recall curve
        tp = 0
        fp = 0
        matched_gt = [set() for _ in range(len(ground_truth))]

        precisions = []
        recalls = []

        for pred in all_predictions:
            img_idx = pred["image_id"]
            pred_box = pred["box"]

            gt = ground_truth[img_idx]
            gt_boxes = gt.get("boxes", [])
            gt_classes = gt.get("classes", [])

            # Find best matching GT
            best_iou = 0
            best_gt_idx = -1

            for gt_idx, (gt_box, gt_class) in enumerate(zip(gt_boxes, gt_classes)):
                if gt_class != class_id:
                    continue
                if gt_idx in matched_gt[img_idx]:
                    continue

                iou = self._calculate_iou(pred_box, gt_box)
                if iou > best_iou:
                    best_iou = iou
                    best_gt_idx = gt_idx

            if best_iou >= iou_threshold and best_gt_idx != -1:
                tp += 1
                matched_gt[img_idx].add(best_gt_idx)
            else:
                fp += 1

            precision = tp / (tp + fp)
            recall = tp / total_gt

            precisions.append(precision)
            recalls.append(recall)

        # Calculate AP using 11-point interpolation
        ap = self._calculate_ap_11point(precisions, recalls)

        return ap

    def _calculate_ap_11point(self, precisions, recalls):
        """Calculate AP using 11-point interpolation"""
        ap = 0.0
        for t in np.arange(0, 1.1, 0.1):
            if len([r for r in recalls if r >= t]) == 0:
                p = 0
            else:
                p = max([precisions[i] for i, r in enumerate(recalls) if r >= t])
            ap += p / 11.0
        return ap

    def _calculate_iou(self, box1, box2):
        """
        Calculate IoU between two boxes

        Args:
            box1: [x1, y1, x2, y2]
            box2: [x1, y1, x2, y2]

        Returns:
            IoU value
        """
        x1_min, y1_min, x1_max, y1_max = box1
        x2_min, y2_min, x2_max, y2_max = box2

        # Intersection area
        inter_x_min = max(x1_min, x2_min)
        inter_y_min = max(y1_min, y2_min)
        inter_x_max = min(x1_max, x2_max)
        inter_y_max = min(y1_max, y2_max)

        if inter_x_max < inter_x_min or inter_y_max < inter_y_min:
            return 0.0

        inter_area = (inter_x_max - inter_x_min) * (inter_y_max - inter_y_min)

        # Union area
        box1_area = (x1_max - x1_min) * (y1_max - y1_min)
        box2_area = (x2_max - x2_min) * (y2_max - y2_min)
        union_area = box1_area + box2_area - inter_area

        iou = inter_area / union_area if union_area > 0 else 0

        return iou

    def format_metrics_table(self, metrics):
        """
        Format metrics as pandas DataFrame

        Args:
            metrics: Dictionary of metrics per class

        Returns:
            pandas DataFrame
        """
        rows = []

        for class_name, class_metrics in metrics.items():
            row = {
                "Class": class_name,
                "Precision": f"{class_metrics['precision']:.1%}",
                "Recall": f"{class_metrics['recall']:.1%}",
                "F1-Score": f"{class_metrics['f1']:.3f}",
                "TP": class_metrics["tp"],
                "FP": class_metrics["fp"],
                "FN": class_metrics["fn"],
            }
            rows.append(row)

        df = pd.DataFrame(rows)
        return df

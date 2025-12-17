"""
Complete model evaluation pipeline
"""

from pathlib import Path

import numpy as np
import pandas as pd
from tqdm import tqdm

from cervical_screening.evaluation.metrics import MetricsCalculator
from cervical_screening.evaluation.predictor import ImprovedPredictor


class ModelEvaluator:
    """
    Complete evaluation pipeline for trained models

    Includes:
    - Validation set evaluation
    - Sample image testing
    - Metrics calculation
    - Results visualization
    """

    def __init__(self, model, config, output_dir):
        """
        Initialize evaluator

        Args:
            model: Trained YOLO model
            config: TrainingConfig object
            output_dir: Directory to save results
        """
        self.model = model
        self.config = config
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.predictor = ImprovedPredictor(model, config)
        self.metrics_calculator = MetricsCalculator(config.class_names)

    def evaluate_on_dataset(self, image_dir, label_dir=None):
        """
        Evaluate model on a dataset

        Args:
            image_dir: Directory containing images
            label_dir: Directory containing YOLO format labels (optional)

        Returns:
            Dictionary with evaluation results
        """
        print("\n" + "=" * 80)
        print("EVALUATING ON DATASET")
        print("=" * 80)

        image_dir = Path(image_dir)
        image_paths = sorted(image_dir.glob("*.png")) + sorted(image_dir.glob("*.jpg"))

        print(f"Found {len(image_paths)} images")

        # Run predictions
        print("\nRunning predictions...")
        predictions = []

        for img_path in tqdm(image_paths, desc="Predicting"):
            pred = self.predictor.predict(img_path)
            predictions.append(pred)

        # Calculate summary statistics
        total_detections = sum(p["total_boxes"] for p in predictions)
        accepted_detections = sum(p["accepted"] for p in predictions)

        # FIX: Count ALL detections per class (before threshold filtering)
        class_counts_all = {name: 0 for name in self.config.class_names}
        class_counts_accepted = {name: 0 for name in self.config.class_names}

        for pred in predictions:
            for det in pred["detections"]:
                # Count all detections
                class_counts_all[det["class_name"]] += 1

                # Count accepted detections
                if det["passes_threshold"]:
                    class_counts_accepted[det["class_name"]] += 1

        results = {
            "num_images": len(image_paths),
            "total_detections": total_detections,
            "accepted_detections": accepted_detections,
            "class_counts_all": class_counts_all,  # NEW: All detections
            "class_counts_accepted": class_counts_accepted,  # NEW: Only accepted
            "predictions": predictions,
        }

        print("\n" + "=" * 80)
        print("EVALUATION SUMMARY")
        print("=" * 80)
        print(f"Images processed: {results['num_images']}")
        print(f"Total detections: {results['total_detections']}")
        print(f"Accepted detections: {results['accepted_detections']}")
        print(
            f"Acceptance rate: {results['accepted_detections'] / results['total_detections'] * 100:.1f}%"
        )

        print("\n📊 All Detections per class (before threshold):")
        for class_name, count in class_counts_all.items():
            percentage = (
                count / results["total_detections"] * 100 if results["total_detections"] > 0 else 0
            )
            print(f"   {class_name}: {count} ({percentage:.1f}%)")

        print("\n✅ Accepted Detections per class (after threshold):")
        for class_name, count in class_counts_accepted.items():
            percentage = (
                count / results["accepted_detections"] * 100
                if results["accepted_detections"] > 0
                else 0
            )
            print(f"   {class_name}: {count} ({percentage:.1f}%)")

        print("=" * 80)

        return results

    def test_on_sample_images(self, image_paths, save_visualizations=True):
        """
        Test model on sample images and visualize results

        Args:
            image_paths: List of image paths
            save_visualizations: Whether to save visualization images

        Returns:
            List of prediction results
        """
        print("\n" + "=" * 80)
        print(f"TESTING ON {len(image_paths)} SAMPLE IMAGES")
        print("=" * 80)

        results = []

        for i, img_path in enumerate(image_paths, 1):
            print(f"\n[{i}/{len(image_paths)}] {Path(img_path).name}")
            print("-" * 80)

            pred = self.predictor.predict(img_path, verbose=True)

            print(f"Total boxes: {pred['total_boxes']}")
            print(f"Accepted: {pred['accepted']}")

            # Show top detections
            accepted_dets = [d for d in pred["detections"] if d["passes_threshold"]]

            if accepted_dets:
                print("\nTop detections:")
                for j, det in enumerate(accepted_dets[:5], 1):
                    print(
                        f"  {j}. {det['class_name']}: "
                        f"{det['confidence']:.3f} "
                        f"(threshold: {det['threshold_used']:.2f})"
                    )
            else:
                print("No detections passed threshold")

            results.append(pred)

            # Visualize if requested
            if save_visualizations:
                self._save_prediction_visualization(img_path, pred, i)

        print("\n" + "=" * 80)

        return results

    def _save_prediction_visualization(self, image_path, prediction, image_idx):
        """Save visualization of predictions"""
        # Use YOLO's built-in visualization
        results = self.model(image_path, conf=self.config.objectness_threshold)

        # Save annotated image
        output_path = self.output_dir / f"sample_{image_idx}_{Path(image_path).stem}.jpg"

        if len(results) > 0:
            results[0].save(filename=str(output_path))
            print(f"   Saved: {output_path.name}")

    def generate_evaluation_report(self, eval_results, report_name="evaluation_report"):
        """
        Generate comprehensive evaluation report

        Args:
            eval_results: Results from evaluate_on_dataset()
            report_name: Name for the report files
        """
        print("\n" + "=" * 80)
        print("GENERATING EVALUATION REPORT")
        print("=" * 80)

        # Create summary DataFrame
        summary_data = {
            "Metric": [
                "Total Images",
                "Total Detections",
                "Accepted Detections",
                "Acceptance Rate",
            ],
            "Value": [
                eval_results["num_images"],
                eval_results["total_detections"],
                eval_results["accepted_detections"],
                f"{eval_results['accepted_detections'] / eval_results['total_detections'] * 100:.1f}%",
            ],
        }
        summary_df = pd.DataFrame(summary_data)

        # Create per-class DataFrame (ALL detections)
        class_data_all = []
        for class_name, count in eval_results["class_counts_all"].items():
            class_data_all.append(
                {
                    "Class": class_name,
                    "All Detections": count,
                    "Percentage": f"{count / eval_results['total_detections'] * 100:.1f}%"
                    if eval_results["total_detections"] > 0
                    else "0%",
                }
            )
        class_df_all = pd.DataFrame(class_data_all)

        # Create per-class DataFrame (ACCEPTED detections)
        class_data_accepted = []
        for class_name, count in eval_results["class_counts_accepted"].items():
            class_data_accepted.append(
                {
                    "Class": class_name,
                    "Accepted Detections": count,
                    "Percentage": f"{count / eval_results['accepted_detections'] * 100:.1f}%"
                    if eval_results["accepted_detections"] > 0
                    else "0%",
                }
            )
        class_df_accepted = pd.DataFrame(class_data_accepted)

        # Save to CSV
        summary_path = self.output_dir / f"{report_name}_summary.csv"
        class_all_path = self.output_dir / f"{report_name}_class_counts_all.csv"
        class_accepted_path = self.output_dir / f"{report_name}_class_counts_accepted.csv"

        summary_df.to_csv(summary_path, index=False)
        class_df_all.to_csv(class_all_path, index=False)
        class_df_accepted.to_csv(class_accepted_path, index=False)

        print(f"\n✅ Summary saved to: {summary_path}")
        print(f"✅ All detections saved to: {class_all_path}")
        print(f"✅ Accepted detections saved to: {class_accepted_path}")

        # Print summary
        print("\n" + "=" * 80)
        print("EVALUATION REPORT")
        print("=" * 80)
        print("\nSummary:")
        print(summary_df.to_string(index=False))
        print("\nAll Detections per class:")
        print(class_df_all.to_string(index=False))
        print("\nAccepted Detections per class:")
        print(class_df_accepted.to_string(index=False))
        print("=" * 80)

    def run_full_evaluation(self, val_image_dir, sample_images=None, num_samples=5):
        """
        Run complete evaluation pipeline

        Args:
            val_image_dir: Validation image directory
            sample_images: Specific sample images (optional)
            num_samples: Number of random samples if sample_images not provided

        Returns:
            Complete evaluation results
        """
        print("\n" + "=" * 80)
        print("RUNNING FULL EVALUATION PIPELINE")
        print("=" * 80)

        # 1. Evaluate on full validation set
        eval_results = self.evaluate_on_dataset(val_image_dir)

        # 2. Test on sample images
        if sample_images is None:
            val_image_dir = Path(val_image_dir)
            all_images = sorted(val_image_dir.glob("*.png")) + sorted(val_image_dir.glob("*.jpg"))
            sample_images = np.random.choice(
                all_images, min(num_samples, len(all_images)), replace=False
            )

        sample_results = self.test_on_sample_images(sample_images, save_visualizations=True)

        # 3. Generate report
        self.generate_evaluation_report(eval_results)

        print("\n" + "=" * 80)
        print("✅ FULL EVALUATION COMPLETE")
        print(f"📁 Results saved to: {self.output_dir}")
        print("=" * 80)

        return {"validation": eval_results, "samples": sample_results}

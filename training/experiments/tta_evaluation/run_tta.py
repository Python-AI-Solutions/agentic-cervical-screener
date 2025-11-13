"""
Test-Time Augmentation (TTA) Evaluation

SETUP:
1. Mount Google Drive (done automatically)
2. Install package:
   !pip install /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening -q
3. Run evaluation:
   !python /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening/experiments/tta_evaluation/run_tta.py

Prerequisites:
- Baseline model must be trained first

The script will:
- Mount drive automatically
- Load baseline model from central config
- Compare regular vs TTA inference
- Save timing and accuracy results
"""

from pathlib import Path

import pandas as pd
from ultralytics import YOLO

from cervical_screening import PathsConfig, TTAEvaluator, mount_drive, save_results, verify_paths


def main():
    """Run TTA evaluation"""

    print("\n" + "=" * 80)
    print("TEST-TIME AUGMENTATION (TTA) EVALUATION")
    print("=" * 80)

    # Mount drive
    try:
        mount_drive()
    except:
        print("Drive already mounted")

    # Paths
    DATASET_PATH = PathsConfig.get_dataset_path()

    MODEL_PATH = PathsConfig.get_baseline_model_path()

    OUTPUT_DIR = Path(
        "/content/drive/Shareddrives/PythonAISolutions/projects/"
        "cervical-screening/outputs/outputs_tta_evaluation"
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if not verify_paths(DATASET_PATH, OUTPUT_DIR):
        print("Path verification failed")
        return

    # Load model
    print("\n" + "=" * 80)
    print("LOADING MODEL")
    print("=" * 80)
    print(f"Model: {MODEL_PATH}")

    if not MODEL_PATH.exists():
        print(f"❌ Model not found: {MODEL_PATH}")
        return

    model = YOLO(str(MODEL_PATH))
    print("✅ Model loaded")

    # Initialize TTA evaluator
    evaluator = TTAEvaluator(model, conf_threshold=0.25)

    # Get test images
    print("\n" + "=" * 80)
    print("PREPARING TEST SET")
    print("=" * 80)

    val_images_dir = DATASET_PATH / "val" / "images"

    # Evaluate TTA
    print("\n" + "=" * 80)
    print("RUNNING TTA EVALUATION")
    print("=" * 80)
    print("\nAugmentations applied:")
    print("  1. Original")
    print("  2. Horizontal flip")
    print("  3. Vertical flip")
    print("  4. 90° rotation")

    results = evaluator.evaluate_dataset(
        image_dir=val_images_dir,
        max_images=10,  # Test on 10 images
        verbose=True,
    )

    # Generate summary
    summary = evaluator.generate_summary(results)

    # Display results
    print("\n" + "=" * 80)
    print("COMPARISON RESULTS")
    print("=" * 80)

    df = pd.DataFrame(results)

    print("\nPer-Image Comparison:")
    display_cols = ["image", "regular_boxes", "tta_boxes", "time_ratio", "detection_change_pct"]
    print(df[display_cols].to_string(index=False))

    print("\n" + "=" * 80)
    print("AGGREGATE STATISTICS")
    print("=" * 80)

    print(f"\nImages tested: {summary['num_images']}")
    print("\nTiming:")
    print(f"  Total Regular Time: {summary['total_regular_time']:.3f}s")
    print(f"  Total TTA Time:     {summary['total_tta_time']:.3f}s")
    print(f"  Average Slowdown:   {summary['avg_time_ratio']:.1f}x")

    print("\nDetection Consistency:")
    print(f"  Total Detections (Regular): {summary['total_regular_boxes']}")
    print(f"  Total Detections (TTA):     {summary['total_tta_boxes']:.1f}")

    detection_diff_pct = (
        abs(summary["total_tta_boxes"] - summary["total_regular_boxes"])
        / summary["total_regular_boxes"]
        * 100
        if summary["total_regular_boxes"] > 0
        else 0
    )
    print(f"  Detection Difference:       {detection_diff_pct:.1f}%")
    print(f"  Avg Detection Change:       {summary['avg_detection_change']:.1f}%")

    # Recommendation
    rec = summary["recommendation"]

    print("\n" + "=" * 80)
    print("📊 RECOMMENDATION")
    print("=" * 80)

    print(f"\nSpeed Assessment: {rec['speed_assessment']}")
    print(f"Recommendation: {rec['recommendation']}")

    print("\nReasoning:")
    for reason in rec["reasoning"]:
        print(f"  • {reason}")

    print("\nFor Production:")
    print("  ✅ Regular inference: Fast, sufficient for most cases")
    print(f"  ⚠️  TTA inference: {summary['avg_time_ratio']:.1f}x slower, potentially more stable")

    # Save results
    print("\n" + "=" * 80)
    print("SAVING RESULTS")
    print("=" * 80)

    # Save detailed comparison
    csv_path = OUTPUT_DIR / "tta_comparison.csv"
    df.to_csv(csv_path, index=False)
    print(f"✅ Detailed results: {csv_path}")

    # Save summary
    summary_path = OUTPUT_DIR / "tta_evaluation_summary.json"
    save_results(summary, summary_path, format="json")
    print(f"✅ Summary: {summary_path}")

    # Final summary
    print("\n" + "=" * 80)
    print("COMPLETE")
    print("=" * 80)
    print(f"Tested {summary['num_images']} images")
    print(f"TTA Slowdown: {summary['avg_time_ratio']:.1f}x")
    print(f"Detection Change: {summary['avg_detection_change']:.1f}%")
    print(f"Recommendation: {rec['recommendation']}")
    print("=" * 80)

    return summary


if __name__ == "__main__":
    main()

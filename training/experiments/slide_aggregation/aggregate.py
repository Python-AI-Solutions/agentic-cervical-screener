"""
Slide-Level Aggregation Experiment

SETUP:
1. Mount Google Drive (done automatically)
2. Install package:
   !pip install /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening -q
3. Run aggregation:
   !python /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening/experiments/slide_aggregation/aggregate.py

Prerequisites:
- Baseline model must be trained first

The script will:
- Mount drive automatically
- Load baseline model from central config
- Aggregate cell predictions to slide-level
- Save results
"""

from pathlib import Path

import pandas as pd
from ultralytics import YOLO

from cervical_screening import (
    PathsConfig,
    SlideAggregator,
    mount_drive,
    save_results,
    verify_paths,
)


def main():
    """Run slide-level aggregation analysis"""

    print("\n" + "=" * 80)
    print("SLIDE-LEVEL AGGREGATION")
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
        "cervical-screening/outputs/outputs_slide_aggregation"
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
        print("Please train baseline model first")
        return

    model = YOLO(str(MODEL_PATH))
    print("✅ Model loaded")

    # Configuration
    class_names = ["Negative for intraepithelial lesion", "ASC-US", "ASC-H", "LSIL", "HSIL", "SCC"]

    # Initialize aggregator
    aggregator = SlideAggregator(class_names)

    # Aggregate slides
    print("\n" + "=" * 80)
    print("AGGREGATING SLIDES")
    print("=" * 80)

    val_images_dir = DATASET_PATH / "val" / "images"

    # Process slides (max 20 for analysis)
    slide_results = aggregator.aggregate_dataset(
        image_dir=val_images_dir, model=model, conf_threshold=0.25, max_slides=20
    )

    # Generate summary
    summary = aggregator.generate_summary(slide_results)

    # Display results
    print("\n" + "=" * 80)
    print("SLIDE AGGREGATION RESULTS")
    print("=" * 80)

    print(f"\nTotal slides analyzed: {summary['total_slides']}")
    print(f"Total cells detected: {summary['total_cells']}")
    print(f"Average cells per slide: {summary['avg_cells_per_slide']:.1f}")

    print("\n📊 Slide Diagnosis Distribution:")
    for diagnosis in ["SCC", "HSIL", "ASC-H", "LSIL", "ASC-US", "NILM", "INSUFFICIENT"]:
        if diagnosis in summary["diagnosis_counts"]:
            count = summary["diagnosis_counts"][diagnosis]
            pct = summary["diagnosis_distribution"][diagnosis]["percentage"]
            print(f"   {diagnosis:15s}: {count:2d} slides ({pct:5.1f}%)")

    # Show individual slides
    print("\n" + "=" * 80)
    print("INDIVIDUAL SLIDE RESULTS")
    print("=" * 80)

    for i, result in enumerate(slide_results, 1):
        print(f"\n[{i}] {result['slide_name']}")
        print(f"    Diagnosis: {result['slide_diagnosis']} ({result['diagnosis_confidence']:.1f}%)")
        print(f"    Total cells: {result['total_cells']}")
        if result["total_cells"] > 0:
            print("    Cell distribution:")
            for cell_type, count in sorted(
                result["cell_counts"].items(), key=lambda x: x[1], reverse=True
            )[:3]:
                pct = result["cell_percentages"][cell_type]
                short_name = "NILM" if "Negative" in cell_type else cell_type
                print(f"      {short_name}: {count} ({pct:.1f}%)")

    # Save results
    print("\n" + "=" * 80)
    print("SAVING RESULTS")
    print("=" * 80)

    # Save detailed results
    detailed_results = []
    for result in slide_results:
        detailed_results.append(
            {
                "Slide": result["slide_name"],
                "Diagnosis": result["slide_diagnosis"],
                "Confidence": f"{result['diagnosis_confidence']:.1f}%",
                "Total Cells": result["total_cells"],
                "Avg Confidence": f"{result['avg_confidence']:.3f}",
            }
        )

    df_detailed = pd.DataFrame(detailed_results)
    detailed_csv = OUTPUT_DIR / "slide_results_detailed.csv"
    df_detailed.to_csv(detailed_csv, index=False)
    print(f"✅ Detailed results: {detailed_csv}")

    # Save diagnosis distribution
    diagnosis_data = []
    for diagnosis, info in summary["diagnosis_distribution"].items():
        diagnosis_data.append(
            {
                "Diagnosis": diagnosis,
                "Count": info["count"],
                "Percentage": f"{info['percentage']:.1f}%",
            }
        )

    df_diagnosis = pd.DataFrame(diagnosis_data)
    diagnosis_csv = OUTPUT_DIR / "slide_diagnosis_distribution.csv"
    df_diagnosis.to_csv(diagnosis_csv, index=False)
    print(f"✅ Diagnosis distribution: {diagnosis_csv}")

    # Save summary JSON
    summary_json = {
        "total_slides": summary["total_slides"],
        "total_cells": summary["total_cells"],
        "avg_cells_per_slide": summary["avg_cells_per_slide"],
        "diagnosis_counts": summary["diagnosis_counts"],
        "slide_results": slide_results,
    }

    summary_path = OUTPUT_DIR / "slide_aggregation_summary.json"
    save_results(summary_json, summary_path, format="json")
    print(f"✅ Summary: {summary_path}")

    # Final summary
    print("\n" + "=" * 80)
    print("COMPLETE")
    print("=" * 80)
    print(f"Analyzed {summary['total_slides']} slides")
    print(f"Results saved to: {OUTPUT_DIR}")

    # Show key findings
    print("\n🔍 Key Findings:")
    most_common = max(summary["diagnosis_counts"].items(), key=lambda x: x[1])
    print(f"   Most common diagnosis: {most_common[0]} ({most_common[1]} slides)")

    hsil_count = summary["diagnosis_counts"].get("HSIL", 0)
    scc_count = summary["diagnosis_counts"].get("SCC", 0)
    cancer_total = hsil_count + scc_count
    print(f"   High-grade/Cancer slides: {cancer_total} (HSIL: {hsil_count}, SCC: {scc_count})")

    print("=" * 80)

    return summary


if __name__ == "__main__":
    main()

"""
Two-Stage Classifier Training

SETUP:
1. Mount Google Drive (done automatically)
2. Install package:
   !pip install /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening -q
3. Run training:
   !python /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening/experiments/two_stage_classifier/train_stage2.py

Prerequisites:
- Baseline model must be trained first

The script will:
- Mount drive automatically
- Extract ROI crops from ground truth labels
- Train EfficientNet classifier
- Evaluate and save results
"""

from pathlib import Path

import torch
from sklearn.metrics import accuracy_score, classification_report, precision_recall_fscore_support

from cervical_screening import (
    CellClassifier,
    PathsConfig,
    ROIExtractor,
    mount_drive,
    save_results,
    verify_paths,
)


def main():
    """Train two-stage classifier"""

    print("\n" + "=" * 80)
    print("TWO-STAGE CLASSIFIER TRAINING")
    print("=" * 80)

    # Mount drive
    try:
        mount_drive()
    except:
        print("Drive already mounted")

    # Paths
    DATASET_PATH = PathsConfig.get_dataset_path()

    BASELINE_MODEL = PathsConfig.get_baseline_model_path()

    OUTPUT_DIR = Path(
        "/content/drive/Shareddrives/PythonAISolutions/projects/"
        "cervical-screening/outputs/outputs_two_stage"
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CROP_DIR = OUTPUT_DIR / "roi_crops"

    if not verify_paths(DATASET_PATH, OUTPUT_DIR):
        print("Path verification failed")
        return

    print(f"\nDataset: {DATASET_PATH}")
    print(f"Baseline model: {BASELINE_MODEL}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Baseline exists: {BASELINE_MODEL.exists()}")

    # Class names
    CLASS_NAMES = ["Negative for intraepithelial lesion", "ASC-US", "ASC-H", "LSIL", "HSIL", "SCC"]

    # ========================================
    # STEP 1: EXTRACT ROI CROPS
    # ========================================

    print("\n" + "=" * 80)
    print("STEP 1: EXTRACTING ROI CROPS")
    print("=" * 80)

    extractor = ROIExtractor(class_names=CLASS_NAMES, crop_size=(224, 224))

    # Extract crops from ground truth labels
    all_counts = extractor.extract_dataset(
        dataset_path=DATASET_PATH, output_dir=CROP_DIR, splits=["train", "val"]
    )

    # Display counts
    print("\n📊 Extraction Summary:")
    for split, counts in all_counts.items():
        total = sum(counts.values())
        print(f"\n{split.upper()}: {total} total crops")
        for class_name, count in sorted(counts.items()):
            short_name = "NILM" if "Negative" in class_name else class_name
            print(f"   {short_name}: {count}")

    # Verify crops
    verification = extractor.verify_crops(CROP_DIR, splits=["train", "val"])

    # ========================================
    # STEP 2: BUILD CLASSIFIER
    # ========================================

    print("\n" + "=" * 80)
    print("STEP 2: BUILDING STAGE 2 CLASSIFIER")
    print("=" * 80)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    classifier = CellClassifier(num_classes=len(CLASS_NAMES), device=device)
    classifier.build_model()

    # Prepare dataloaders
    print("\n📦 Preparing datasets...")
    train_loader, val_loader = classifier.prepare_dataloaders(
        crop_dir=CROP_DIR, class_names=CLASS_NAMES, batch_size=32, num_workers=2
    )

    # ========================================
    # STEP 3: TRAIN CLASSIFIER
    # ========================================

    print("\n" + "=" * 80)
    print("STEP 3: TRAINING CLASSIFIER")
    print("=" * 80)

    print("\nConfiguration:")
    print("   Model: EfficientNet-B0")
    print("   Epochs: 30")
    print("   Learning Rate: 0.001")
    print("   Loss: CrossEntropyLoss")
    print("   Optimizer: Adam")

    model_save_path = OUTPUT_DIR / "stage2_classifier_best.pth"

    history = classifier.train(
        train_loader=train_loader,
        val_loader=val_loader,
        epochs=30,
        learning_rate=0.001,
        save_path=model_save_path,
    )

    # ========================================
    # STEP 4: EVALUATE CLASSIFIER
    # ========================================

    print("\n" + "=" * 80)
    print("STEP 4: EVALUATING STAGE 2")
    print("=" * 80)

    # Load best model
    classifier.load_model(model_save_path)

    # Get predictions
    results = classifier.evaluate(val_loader, CLASS_NAMES)

    predictions = results["predictions"]
    labels = results["labels"]
    probabilities = results["probabilities"]

    # Calculate metrics
    accuracy = accuracy_score(labels, predictions)
    precision, recall, f1, _ = precision_recall_fscore_support(
        labels, predictions, average="weighted", zero_division=0
    )

    print("\n📊 Overall Metrics:")
    print(f"   Accuracy:  {accuracy:.3f}")
    print(f"   Precision: {precision:.3f}")
    print(f"   Recall:    {recall:.3f}")
    print(f"   F1-Score:  {f1:.3f}")

    # Per-class report
    print("\n📊 Per-Class Report:")
    short_names = ["NILM", "ASC-US", "ASC-H", "LSIL", "HSIL", "SCC"]
    print(classification_report(labels, predictions, target_names=short_names, zero_division=0))

    print("\n" + "=" * 80)
    print("ℹ️  ABOUT THESE METRICS")
    print("=" * 80)
    print("\nThese metrics show Stage 2 classifier performance on")
    print("individual cell crops extracted from ground truth labels.")
    print("\nThis represents 'best case' classification accuracy")
    print("assuming perfect cell detection (no detection errors).")

    # ========================================
    # STEP 5: SAVE RESULTS
    # ========================================

    print("\n" + "=" * 80)
    print("STEP 5: SAVING RESULTS")
    print("=" * 80)

    # Save summary
    summary = {
        "model_path": str(model_save_path),
        "crop_counts": {
            "train": verification["train"]["total"],
            "val": verification["val"]["total"],
        },
        "training_history": {
            "train_loss": [float(x) for x in history["train_loss"]],
            "train_acc": [float(x) for x in history["train_acc"]],
            "val_loss": [float(x) for x in history["val_loss"]],
            "val_acc": [float(x) for x in history["val_acc"]],
        },
        "stage2_metrics": {
            "accuracy": float(accuracy),
            "precision": float(precision),
            "recall": float(recall),
            "f1_score": float(f1),
        },
    }

    summary_path = OUTPUT_DIR / "two_stage_summary.json"
    save_results(summary, summary_path, format="json")
    print(f"✅ Summary: {summary_path}")

    # ========================================
    # FINAL SUMMARY
    # ========================================

    print("\n" + "=" * 80)
    print("COMPLETE")
    print("=" * 80)

    print("\n📁 Outputs:")
    print(f"   Crops: {CROP_DIR}")
    print(f"   Model: {model_save_path}")
    print(f"   Summary: {summary_path}")

    print("\n📊 Stage 2 Performance:")
    print(f"   Accuracy: {accuracy:.1%}")
    print(f"   Precision: {precision:.3f}")
    print(f"   Recall: {recall:.3f}")
    print(f"   F1-Score: {f1:.3f}")

    print("\n💡 For comparison with other experiments:")
    print("   - Baseline: outputs_baseline/evaluation/baseline_training_summary.json")
    print(f"   - Two-stage: {summary_path}")

    print("\n" + "=" * 80)

    return summary


if __name__ == "__main__":
    main()

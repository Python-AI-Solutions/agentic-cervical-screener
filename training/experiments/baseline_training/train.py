"""
Baseline YOLO Training Script
Implements Issues #24 & #25 improvements

SETUP:
1. Mount Google Drive (done automatically)
2. Install package:
   !pip install /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening -q
3. Run training:
   !python /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening/experiments/baseline_training/train.py

The script will:
- Mount drive automatically
- Load dataset from central config
- Train YOLO model
- Evaluate and save results
"""

from pathlib import Path

from cervical_screening import (
    ModelEvaluator,
    PathsConfig,
    TrainingConfig,
    YOLOTrainer,
    mount_drive,
    save_results,
    verify_paths,
)


def main():
    """Run baseline training and evaluation"""

    print("\n" + "=" * 80)
    print("BASELINE YOLO TRAINING")
    print("=" * 80)

    # Mount drive
    try:
        mount_drive()
    except:
        print("Drive already mounted")

    # Paths
    DATASET_PATH = PathsConfig.get_dataset_path()

    OUTPUT_DIR = Path(
        "/content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening/outputs_baseline"
    )

    if not verify_paths(DATASET_PATH, OUTPUT_DIR):
        print("Path verification failed")
        return

    # Configuration
    config = TrainingConfig(
        data_yaml=DATASET_PATH / "data.yaml",
        output_dir=OUTPUT_DIR,
        model_name="yolo12n.pt",
        epochs=50,
        batch_size=16,
        img_size=640,
        learning_rate=0.001,
    )

    # Train (automatically validates at end)
    print("\n" + "=" * 80)
    print("TRAINING")
    print("=" * 80)
    trainer = YOLOTrainer(config)
    results = trainer.train()  # ← Validates automatically

    best_model_path = trainer.get_best_model_path(results)
    results_dir = Path(results.save_dir)

    # Evaluate
    print("\n" + "=" * 80)
    print("EVALUATION")
    print("=" * 80)
    eval_output_dir = OUTPUT_DIR / "evaluation"
    evaluator = ModelEvaluator(trainer.model, config, eval_output_dir)
    val_images_dir = DATASET_PATH / "val" / "images"

    eval_results = evaluator.run_full_evaluation(val_image_dir=val_images_dir, num_samples=10)

    # Save summary
    acceptance_rate = (
        eval_results["validation"]["accepted_detections"]
        / eval_results["validation"]["total_detections"]
        * 100
        if eval_results["validation"]["total_detections"] > 0
        else 0
    )

    summary = {
        "model": str(best_model_path),
        "config": {
            "epochs": config.epochs,
            "batch_size": config.batch_size,
            "conf_threshold": config.conf_threshold,
        },
        "validation_results": {
            "num_images": eval_results["validation"]["num_images"],
            "total_detections": eval_results["validation"]["total_detections"],
            "accepted_detections": eval_results["validation"]["accepted_detections"],
            "acceptance_rate": acceptance_rate,
        },
    }

    summary_path = eval_output_dir / "baseline_training_summary.json"
    save_results(summary, summary_path, format="json")

    # Final summary
    print("\n" + "=" * 80)
    print("COMPLETE")
    print("=" * 80)
    print(f"Model: {best_model_path}")
    print(f"Acceptance: {acceptance_rate:.1f}%")
    print("=" * 80)


if __name__ == "__main__":
    main()

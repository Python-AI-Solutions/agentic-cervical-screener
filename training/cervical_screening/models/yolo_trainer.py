"""
YOLO trainer with Issues #24 & #25 improvements
"""

import os
from pathlib import Path

from ultralytics import YOLO


class YOLOTrainer:
    """
    YOLO trainer implementing Issues #24 and #25

    Issue #24: Lower detection threshold (0.25 → 0.10)
    Issue #25: Decoupled decision, per-class thresholds
    """

    def __init__(self, config):
        """
        Initialize trainer

        Args:
            config: TrainingConfig object
        """
        self.config = config
        self.model = None

    def setup_model(self):
        """Load YOLO model"""
        print(f"Loading model: {self.config.model_name}")
        self.model = YOLO(self.config.model_name)
        print("✅ Model loaded successfully")

    def train(self):
        """
        Train YOLO model with improvements from Issues #24 & #25

        Returns:
            Training results object
        """
        if self.model is None:
            self.setup_model()

        print("\n" + "=" * 80)
        print("STARTING YOLO TRAINING (Issues #24 & #25)")
        print("=" * 80)
        print(f"Model: {self.config.model_name}")
        print(f"Epochs: {self.config.epochs}")
        print(f"Batch size: {self.config.batch_size}")
        print(f"Detection threshold: {self.config.conf_threshold} (Issue #24)")
        print(f"Decoupled decision: {self.config.decouple_detection} (Issue #25)")
        print(f"Device: {self.config.device}")
        print("=" * 80 + "\n")

        # Ensure output directory exists
        os.makedirs(self.config.output_dir, exist_ok=True)

        # Train
        results = self.model.train(
            data=self.config.data_yaml,
            epochs=self.config.epochs,
            imgsz=self.config.img_size,
            batch=self.config.batch_size,
            lr0=self.config.learning_rate,
            device=self.config.device,
            # Issue #24: Lower confidence threshold
            conf=self.config.conf_threshold,
            iou=self.config.iou_threshold,
            # Output settings
            project=self.config.output_dir,
            name="yolo_baseline",
            verbose=True,
            save=True,
            plots=True,
            # Enhanced augmentation parameters
            copy_paste=self.config.copy_paste,
            mixup=self.config.mixup,
            mosaic=self.config.mosaic,
            degrees=self.config.degrees,
            translate=self.config.translate,
            scale=self.config.scale,
            fliplr=self.config.fliplr,
            flipud=self.config.flipud,
            hsv_h=self.config.hsv_h,
            hsv_s=self.config.hsv_s,
            hsv_v=self.config.hsv_v,
            # Training settings
            patience=self.config.patience,
            save_period=self.config.save_period,
            cache=False,
            workers=self.config.workers,
        )

        best_model_path = self.get_best_model_path(results)

        print("\n" + "=" * 80)
        print("✅ TRAINING COMPLETE")
        print("=" * 80)
        print(f"Best model: {best_model_path}")
        print(f"Results directory: {results.save_dir}")
        print("=" * 80)

        # Reload best model for inference
        if best_model_path.exists():
            self.model = YOLO(str(best_model_path))
            print("✅ Loaded best model for inference")

        return results

    def get_best_model_path(self, results):
        """
        Get path to best trained model

        Args:
            results: Training results object

        Returns:
            Path to best.pt file
        """
        return Path(results.save_dir) / "weights" / "best.pt"

    def validate(self):
        """
        Run validation on validation set

        Returns:
            Validation metrics
        """
        if self.model is None:
            raise ValueError("Model not loaded. Train or load a model first.")

        print("\n" + "=" * 80)
        print("RUNNING VALIDATION")
        print("=" * 80)

        metrics = self.model.val()

        return metrics

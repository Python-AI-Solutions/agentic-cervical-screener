"""
Central path configuration for dataset and models

Update dataset/model paths here once, used everywhere.
Output paths remain in individual experiment scripts (can be customized per run).
"""

from pathlib import Path


class PathsConfig:
    """
    Centralized configuration for dataset and model paths only

    To change dataset or model location:
    1. Update values here
    2. All experiments automatically use new paths

    Note: Output directories are defined in each experiment script
    for flexibility.
    """

    # Base directory (Google Drive Shared Drive)
    DRIVE_BASE = Path("/content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening")

    # Dataset location
    DATASET_BASE = DRIVE_BASE / "dataset_sample/CRIC-Cervix-Cell-Classification"
    DATASET_PATH = DATASET_BASE / "CRIC_YOLO_Dataset"

    # Trained baseline model
    BASELINE_MODEL = (
        DRIVE_BASE / "outputs/outputs_cric_improved_v2/yolov12_improved2/weights/best.pt"
    )

    @classmethod
    def get_dataset_path(cls):
        """Get dataset path"""
        return cls.DATASET_PATH

    @classmethod
    def get_baseline_model_path(cls):
        """Get baseline trained model path"""
        return cls.BASELINE_MODEL

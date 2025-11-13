"""
Cervical Screening Package
AI-powered cervical cell classification system
"""

__version__ = "0.1.0"

# Core imports
from cervical_screening.config.paths_config import PathsConfig
from cervical_screening.config.training_config import TrainingConfig
from cervical_screening.evaluation.evaluator import ModelEvaluator
from cervical_screening.evaluation.metrics import MetricsCalculator
from cervical_screening.evaluation.predictor import ImprovedPredictor
from cervical_screening.evaluation.slide_aggregator import SlideAggregator
from cervical_screening.evaluation.tta_evaluator import TTAEvaluator
from cervical_screening.models.cell_classifier import CellClassifier
from cervical_screening.models.roi_extractor import ROIExtractor
from cervical_screening.models.yolo_trainer import YOLOTrainer
from cervical_screening.utils.drive_utils import mount_drive, verify_paths
from cervical_screening.utils.io_utils import load_results, save_results
from cervical_screening.utils.visualization import (
    plot_confusion_matrix,
    plot_metrics_comparison,
    plot_training_curves,
)

__all__ = [
    "TrainingConfig",
    "PathsConfig",
    "YOLOTrainer",
    "ROIExtractor",
    "CellClassifier",
    "ImprovedPredictor",
    "MetricsCalculator",
    "ModelEvaluator",
    "SlideAggregator",
    "TTAEvaluator",
    "mount_drive",
    "verify_paths",
    "plot_training_curves",
    "plot_confusion_matrix",
    "plot_metrics_comparison",
    "save_results",
    "load_results",
]

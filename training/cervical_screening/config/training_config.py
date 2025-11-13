"""
Training configuration for YOLO models
Implements Issues #24 & #25 improvements
"""

import torch


class TrainingConfig:
    """
    Configuration for YOLO training with Issues #24 & #25 improvements

    Issue #24: Lower detection threshold (0.25 → 0.10)
    Issue #25: Decoupled objectness, per-class thresholds
    """

    def __init__(
        self,
        data_yaml,
        output_dir,
        model_name="yolo12n.pt",
        epochs=50,
        batch_size=16,
        img_size=640,
        learning_rate=0.001,
        device=None,
    ):
        """
        Initialize training configuration

        Args:
            data_yaml: Path to data.yaml file
            output_dir: Output directory for results
            model_name: YOLO model variant (default: yolo12n.pt)
            epochs: Number of training epochs
            batch_size: Batch size for training
            img_size: Input image size
            learning_rate: Initial learning rate
            device: Device to use (cuda/cpu, auto-detected if None)
        """
        # Paths
        self.data_yaml = str(data_yaml)
        self.output_dir = str(output_dir)

        # Model
        self.model_name = model_name

        # Training parameters
        self.epochs = epochs
        self.batch_size = batch_size
        self.img_size = img_size
        self.learning_rate = learning_rate

        # Device
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        # ===== ISSUE #24: LOWER DETECTION THRESHOLD =====
        self.conf_threshold = 0.10  # Reduced from 0.25 to catch more cells
        self.iou_threshold = 0.45

        # ===== ISSUE #25: ALGORITHM IMPROVEMENTS =====

        # Decouple objectness from class decision
        self.decouple_detection = True
        self.objectness_threshold = 0.20  # Separate threshold for "is it a cell?"

        # Per-class thresholds (clinical priorities)
        # Lower threshold = higher recall (important for cancer detection)
        self.per_class_thresholds = {
            "NILM": 0.40,  # Highest - okay to be strict with normal cells
            "ASC-US": 0.35,  # Moderate - atypical cells
            "ASC-H": 0.30,  # Lower - suspicious cells
            "LSIL": 0.30,  # Lower - low-grade lesions
            "HSIL": 0.25,  # Lowest - high-grade lesions (cannot miss)
            "SCC": 0.25,  # Lowest - squamous cell carcinoma (cannot miss)
        }

        # Class names (Bethesda system)
        self.class_names = ["NILM", "ASC-US", "ASC-H", "LSIL", "HSIL", "SCC"]

        # Enhanced augmentation for class imbalance
        self.copy_paste = 0.3
        self.mixup = 0.15
        self.mosaic = 1.0
        self.degrees = 10.0
        self.translate = 0.2
        self.scale = 0.5
        self.fliplr = 0.5
        self.flipud = 0.2
        self.hsv_h = 0.02
        self.hsv_s = 0.8
        self.hsv_v = 0.5

        # Training settings
        self.patience = 20
        self.save_period = 10
        self.workers = 8

    def __repr__(self):
        """String representation"""
        return (
            f"TrainingConfig(\n"
            f"  model={self.model_name},\n"
            f"  epochs={self.epochs},\n"
            f"  batch_size={self.batch_size},\n"
            f"  conf_threshold={self.conf_threshold},\n"
            f"  device={self.device}\n"
            f")"
        )

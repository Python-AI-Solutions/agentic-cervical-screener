# Cervical Screening Package

AI-powered cervical cell classification system using YOLO for automated screening of cervical cytology images.

## Overview

This package implements a YOLO-based detection and classification pipeline for identifying and classifying cervical cells from cytology images. The system supports the Bethesda classification system with six cell types: NILM (Negative for Intraepithelial Lesion), ASC-US, ASC-H, LSIL, HSIL, and SCC.

### Key Features

- **YOLO-based cell detection and classification** - Single-stage object detection model
- **Clinical-priority optimizations** - Per-class confidence thresholds aligned with screening priorities
- **Slide-level aggregation** - Cell-level predictions aggregated to whole-slide diagnosis
- **Modular architecture** - Reusable components for training, evaluation, and inference
- **Multiple evaluation approaches** - TTA analysis, slide aggregation, two-stage classification

### Project Status

This is a research implementation exploring different approaches to cervical cell classification. The baseline model implements per-class threshold optimization based on clinical priorities (high recall for HSIL/SCC, high precision for NILM).

---

## Installation

### Prerequisites

- Python 3.8+
- Google Colab (recommended) or local GPU environment
- Access to CRIC dataset or similar cervical cytology dataset

### Setup

**In Google Colab:**
```python
# 1. Mount Google Drive
from google.colab import drive
drive.mount('/content/drive')

# 2. Install package
!pip install /content/drive/path/to/cervical-screening -q

# 3. Run experiments (see Experiments section)
```

**Local Installation:**
```bash
pip install -e /path/to/cervical-screening
```

---

## Quick Start

### Basic Usage
```python
from cervical_screening import PathsConfig, YOLOTrainer, TrainingConfig

# Paths are centralized
dataset_path = PathsConfig.get_dataset_path()
model_path = PathsConfig.get_baseline_model_path()

# Train baseline model
config = TrainingConfig(
    data_yaml=dataset_path / "data.yaml",
    output_dir="/path/to/outputs",
    epochs=50
)

trainer = YOLOTrainer(config)
results = trainer.train()
```

### Running Experiments

See individual experiment READMEs for detailed instructions:

- [Baseline Training](experiments/baseline_training/README.md) - YOLO with optimized per-class thresholds
- [Slide Aggregation](experiments/slide_aggregation/README.md) - Cell-to-slide diagnosis mapping
- [TTA Evaluation](experiments/tta_evaluation/README.md) - Test-time augmentation analysis
- [Two-Stage Classifier](experiments/two_stage_classifier/README.md) - YOLO + EfficientNet approach

---

## Package Structure
```
cervical-screening/
├── cervical_screening/           # Main package
│   ├── config/                   # Configuration modules
│   │   ├── training_config.py    # Training parameters
│   │   └── paths_config.py       # Centralized paths
│   ├── models/                   # Model components
│   │   ├── yolo_trainer.py       # YOLO training wrapper
│   │   ├── roi_extractor.py      # Crop extraction for two-stage
│   │   └── cell_classifier.py    # EfficientNet classifier
│   ├── evaluation/               # Evaluation tools
│   │   ├── predictor.py          # Inference wrapper
│   │   ├── evaluator.py          # Metrics computation
│   │   ├── slide_aggregator.py   # Slide-level diagnosis
│   │   └── tta_evaluator.py      # TTA comparison
│   └── utils/                    # Utilities
│       ├── drive_utils.py        # Google Drive helpers
│       ├── visualization.py      # Plotting functions
│       └── io_utils.py           # File I/O
│
├── experiments/                  # Experiment scripts
│   ├── baseline_training/        # Core YOLO training
│   ├── slide_aggregation/        # Slide-level evaluation
│   ├── tta_evaluation/           # TTA analysis
│   └── two_stage_classifier/     # Two-stage approach
│
├── setup.py                      # Package installation
├── pyproject.toml                # Build configuration
└── pixi.toml                     # Pixi environment (optional)
```

---

## Implementation Details

### Current Approach

The baseline model implements several design decisions based on clinical requirements and research analysis:

**1. Per-Class Confidence Thresholds**

Rather than using a single confidence threshold, the model applies different thresholds per class to align with clinical priorities:

- **HSIL/SCC**: Lower thresholds (0.10) for high recall - missing high-grade lesions is clinically costly
- **NILM**: Higher thresholds (0.25) for high precision - false positives create unnecessary follow-up
- **ASC-US/LSIL**: Balanced thresholds (0.15-0.20)

Implementation: `cervical_screening/evaluation/predictor.py`

**2. YOLO Confidence Computation**

YOLO computes detection confidence as:
```
Final confidence = Objectness score × Class probability
```

Where:
- Objectness: Probability that bounding box contains an object
- Class probability: Probability distribution across cell types

The model currently uses this combined score with per-class thresholds. Alternative approaches (see Future Work) suggest decoupling these components.

**3. Slide-Level Aggregation**

Cell-level predictions are aggregated to slide-level diagnosis using clinical rules:

- Presence of any HSIL/SCC cells → Slide diagnosed as HSIL/SCC
- Hierarchical decision tree based on cell type priorities
- Minimum cell count thresholds to avoid sparse-sample bias

Implementation: `cervical_screening/evaluation/slide_aggregator.py`

---

## Experimental Results

### Baseline Performance

The optimized baseline model achieved:

- **LSIL recall**: +55.9% improvement over default thresholds
- **HSIL precision**: +12.6% improvement
- **Overall mAP50**: Maintained while improving clinical priorities

See `experiments/baseline_training/README.md` for detailed metrics.

### TTA Evaluation

Test-time augmentation was evaluated and found to provide minimal accuracy improvement (2-3%) at significant computational cost (3.1x slower inference). Recommendation: Use standard inference for production.

See `experiments/tta_evaluation/README.md` for analysis.

### Two-Stage Approach

A two-stage approach (YOLO detection + EfficientNet classification) was explored using ground truth crops. Results show potential but require YOLO-based crop extraction for production use.

See `experiments/two_stage_classifier/README.md` for details.

---

## Future Work

### Not Yet Implemented

Based on research analysis and expert feedback, the following improvements are documented for future work:

**1. Sigmoid vs Softmax Classification**

- **Current**: YOLO uses sigmoid activation (multi-label)
- **Should be**: Softmax for mutually exclusive classes
- **Challenge**: Requires modifying YOLO classification head
- **Status**: Documented as open question, needs further research

**2. Probability Calibration**

- **Technique**: Temperature scaling or isotonic regression
- **Benefit**: Better-calibrated confidence scores
- **Implementation**: Fit on validation set, apply during inference

**3. Uncertainty Quantification**

- **Approach**: Entropy or top-2 margin thresholds
- **Benefit**: Identify ambiguous cases for expert review
- **Status**: Not implemented

**4. Cost-Sensitive Decision Rules**

- **Approach**: Explicit misclassification cost matrix
- **Benefit**: Principled thresholds aligned with clinical costs
- **Status**: Currently using heuristic per-class thresholds

**5. Production Two-Stage Pipeline**

- **Current**: Uses ground truth crops (research standard)
- **Needed**: YOLO-based crop extraction
- **Challenge**: Handle detection errors and crop quality

**6. Weighted Boxes Fusion (WBF)**

- **Purpose**: Merge overlapping detections more intelligently
- **Benefit**: Reduce duplicate boxes, stabilize predictions
- **Status**: Currently using standard NMS

---

## Development

### Editable Installation

For development with immediate code updates:
```bash
pip install -e /path/to/cervical-screening
```

Changes to code take effect immediately without reinstalling.

### Code Quality
```bash
# Format code
ruff format .

# Lint
ruff check .

# With fixes
ruff check --fix .
```

---

## Dataset

This package is designed for the CRIC Cervix Cell Classification dataset but can be adapted to other cervical cytology datasets with YOLO format annotations.

**Expected structure:**
```
dataset/
├── train/
│   ├── images/
│   └── labels/
├── val/
│   ├── images/
│   └── labels/
└── data.yaml
```

---

## Configuration

### Centralized Paths

Dataset and model paths are centralized in `cervical_screening/config/paths_config.py`:
```python
class PathsConfig:
    DATASET_PATH = Path("/.../CRIC_YOLO_Dataset")
    BASELINE_MODEL = Path("/.../best.pt")
```

Update once, applies everywhere.

### Output Directories

Output directories are defined per experiment for flexibility (see individual experiment scripts).

---

## References

### Technical Analysis

Model design informed by expert analysis on:
- Confidence score computation in YOLO
- Calibration and uncertainty quantification
- Multi-stage classification approaches
- Clinical decision thresholds

See experiment READMEs for specific implementation details.

### Related Work

- Ultralytics YOLOv8 - Base detection framework
- CRIC Dataset - Cervical cell classification
- Bethesda System - Clinical classification standard

---

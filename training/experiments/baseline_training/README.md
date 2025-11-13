# Baseline Training

YOLO-based cell detection and classification with optimized per-class confidence thresholds.

## Overview

This experiment implements the baseline YOLO model with clinical-priority optimizations. The key improvement is using different confidence thresholds for different cell types, aligning with screening priorities where missing high-grade lesions (HSIL/SCC) is clinically more costly than false positives on benign cells (NILM).

## What This Does

Trains a YOLOv12 model on cervical cell images with:

1. **Standard YOLO detection and classification**
   - Single-stage object detector
   - Detects cell bounding boxes
   - Classifies into 6 categories (NILM, ASC-US, ASC-H, LSIL, HSIL, SCC)

2. **Per-class confidence thresholds**
   - HSIL/SCC: 0.10 (prioritize recall)
   - LSIL/ASC-H: 0.15-0.20 (balanced)
   - NILM: 0.25 (prioritize precision)
   - ASC-US: 0.15 (balanced)

3. **Full training and evaluation pipeline**
   - Model training with validation
   - Evaluation on test set
   - Metrics computation and visualization

## Prerequisites

- Dataset in YOLO format (train/val splits)
- Google Drive mounted (for Colab)
- Package installed

## Setup & Run

### Installation
```python
# Mount drive
from google.colab import drive
drive.mount('/content/drive')

# Install package
!pip install /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening -q
```

### Run Training
```python
!python /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening/experiments/baseline_training/train.py
```

**Training time:** ~2-4 hours for 50 epochs (depends on dataset size and GPU)

## Configuration

Default training parameters:
```python
epochs = 50
batch_size = 16
img_size = 640
learning_rate = 0.001
model = 'yolo12n.pt'
```

Confidence thresholds (applied during evaluation):
```python
class_thresholds = {
    'NILM': 0.25,
    'ASC-US': 0.15,
    'ASC-H': 0.20,
    'LSIL': 0.20,
    'HSIL': 0.10,
    'SCC': 0.10
}
```

## Outputs

All results saved to `outputs_baseline/`:
```
outputs_baseline/
├── yolov12_*/                    # YOLO training outputs
│   ├── weights/
│   │   ├── best.pt               # Best model checkpoint
│   │   └── last.pt               # Final checkpoint
│   ├── results.png               # Training curves
│   └── confusion_matrix.png      # Confusion matrix
│
└── evaluation/                   # Evaluation results
    ├── baseline_training_summary.json
    ├── per_class_metrics.csv
    └── sample_predictions/       # Visualization of predictions
```

## Results Interpretation

### Summary JSON

Contains:
- Model path
- Training configuration
- Validation metrics (detections, acceptance rate)
- Per-class performance

### Key Metrics

- **Acceptance rate**: Percentage of detections above class-specific thresholds
- **Detection count**: Total cells detected
- **Per-class metrics**: Precision, recall, mAP for each cell type

## Implementation Details

### Confidence Score Computation

YOLO computes final confidence as:
```
confidence = objectness_score × class_probability
```

Where:
- **Objectness score**: Probability that bounding box contains a cell (any cell)
- **Class probability**: Distribution over 6 cell types

The model currently applies per-class thresholds to this combined score. This was implemented as a practical optimization for clinical priorities.

### Alternative Approach (Not Implemented)

Research suggests decoupling objectness from classification:
1. Use objectness only to decide if box contains a cell
2. Use class probabilities (P(class|cell)) for cell type decision
3. Apply calibration (temperature scaling) to class probabilities

This approach may provide better-calibrated confidence scores and is documented for future work.

### Why Per-Class Thresholds

Clinical screening priorities differ by cell type:

- **HSIL/SCC** (high-grade): Missing these is medically serious
  - Solution: Lower threshold → higher recall

- **NILM** (benign): False positives cause unnecessary procedures
  - Solution: Higher threshold → higher precision

- **ASC-US/LSIL** (intermediate): Balanced approach
  - Solution: Moderate thresholds

This heuristic approach improved LSIL recall by 55.9% and HSIL precision by 12.6% compared to using a single threshold of 0.25 for all classes.

## Limitations

1. **Sigmoid vs Softmax**: YOLO uses sigmoid activation (multi-label), but cell classes are mutually exclusive. Switching to softmax in the classification head may improve performance but requires modifying YOLO source code.

2. **No Calibration**: Confidence scores are not calibrated. Temperature scaling or isotonic regression could provide better-calibrated probabilities.

3. **Heuristic Thresholds**: Thresholds are set based on clinical priorities rather than principled cost-sensitive learning.

## Next Steps

After baseline training:
1. Model checkpoint saved and can be used for inference
2. Use trained model for slide aggregation experiment
3. Use trained model for TTA evaluation
4. Extract crops for two-stage classifier training

## Technical Notes

- **Dataset path**: Loaded from `PathsConfig.get_dataset_path()`
- **Output path**: Hardcoded in script, can be modified per run
- **GPU required**: Training on CPU is extremely slow
- **Validation**: Runs automatically at end of training

## Troubleshooting

**Issue: Out of memory**
- Reduce batch size to 8 or 4
- Use smaller image size (e.g., 512)

**Issue: Poor performance**
- Check dataset balance
- Verify label format (YOLO format required)
- Increase training epochs

**Issue: Path errors**
- Verify dataset path in `paths_config.py`
- Ensure output directory is writable

## Related Experiments

- [Slide Aggregation](../slide_aggregation/README.md) - Uses this model for slide-level diagnosis
- [TTA Evaluation](../tta_evaluation/README.md) - Evaluates TTA on this model
- [Two-Stage Classifier](../two_stage_classifier/README.md) - Compares with two-stage approach

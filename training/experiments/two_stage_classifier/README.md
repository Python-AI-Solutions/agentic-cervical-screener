# Two-Stage Classifier

Explores a two-stage approach: YOLO for detection, EfficientNet for classification.

## Overview

This experiment investigates whether separating detection from classification improves accuracy. Stage 1 (YOLO) localizes cells, and Stage 2 (EfficientNet) classifies them. This approach allows using a specialized classifier with softmax activation for mutually exclusive classes.

**Current Implementation:** Uses ground truth bounding boxes to extract crops for training Stage 2. This represents a research baseline to measure classifier quality in isolation.

**Production Pipeline (Not Implemented):** Would use YOLO detections to extract crops, introducing detection errors that affect final performance.

## What This Does

1. **Extract ROI crops from dataset**
   - Reads ground truth bounding boxes from YOLO labels
   - Crops individual cells at 224×224 resolution
   - Organizes by class for training

2. **Train EfficientNet-B0 classifier**
   - Specialized model for cell classification
   - Uses softmax activation (mutually exclusive classes)
   - CrossEntropyLoss optimized for 6-class problem

3. **Evaluate Stage 2 performance**
   - Tests classifier on validation crops
   - Computes accuracy, precision, recall, F1
   - Generates per-class metrics

## Prerequisites

- Dataset with YOLO-format labels (ground truth bounding boxes)
- Package installed
- Google Drive mounted (for Colab)
- GPU recommended (training takes ~30-60 minutes)

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
!python /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening/experiments/two_stage_classifier/train_stage2.py
```

**Training time:** ~30-60 minutes (depends on crop count and GPU)

## Configuration
```python
# Crop extraction
crop_size = (224, 224)
splits = ['train', 'val']

# Training
model = 'EfficientNet-B0'
epochs = 30
batch_size = 32
learning_rate = 0.001
loss = 'CrossEntropyLoss'
optimizer = 'Adam'
```

## Pipeline Steps

### Step 1: Extract ROI Crops

Reads ground truth labels and extracts individual cell crops:
```
Input:  images/ + labels/ (YOLO format)
Output: roi_crops/train/ and roi_crops/val/
        Organized by class (NILM/, ASC-US/, LSIL/, etc.)
```

Each crop is a 224×224 image of a single cell.

### Step 2: Build Classifier

Creates EfficientNet-B0 model:
- Input: 224×224 RGB image
- Output: 6-class probability distribution (softmax)
- Pre-trained ImageNet weights (fine-tuned)

### Step 3: Train Classifier

Trains on extracted crops:
- 30 epochs with early stopping
- Validation after each epoch
- Saves best model by validation accuracy

### Step 4: Evaluate

Tests on validation crops:
- Per-class precision, recall, F1
- Confusion matrix
- Overall accuracy

### Step 5: Save Results

Outputs:
- Trained model (.pth)
- Training curves (loss, accuracy)
- Evaluation metrics (JSON)

## Outputs

All results saved to `outputs_two_stage/`:
```
outputs_two_stage/
├── roi_crops/                        # Extracted crops
│   ├── train/
│   │   ├── NILM/
│   │   ├── ASC-US/
│   │   └── ...
│   └── val/
│       ├── NILM/
│       └── ...
│
├── stage2_classifier_best.pth        # Trained EfficientNet model
└── two_stage_summary.json            # Complete results
```

### Summary JSON

Contains:
- Model path
- Crop counts per class
- Training history (loss, accuracy per epoch)
- Stage 2 metrics (accuracy, precision, recall, F1)

## Example Results

Stage 2 classifier trained on ground truth crops (CRIC validation set):
```
Overall Metrics:
  Accuracy:  0.75-0.80
  Precision: 0.74
  Recall:    0.76
  F1-Score:  0.75
```

**Note:** These metrics represent "best case" classification assuming perfect cell detection. Production performance would be lower due to detection errors.

## Results Interpretation

### What These Metrics Mean

**Stage 2 metrics show:**
- How well the classifier distinguishes cell types
- Performance ceiling assuming perfect crops
- Whether specialized classifier improves over YOLO's classification head

**What they DON'T show:**
- End-to-end system performance (need YOLO detection + Stage 2 classification)
- Impact of detection errors on final accuracy
- Production-ready performance

### Comparison with Single-Stage (YOLO)

This experiment does NOT directly compare with YOLO because:
- YOLO: Detection + classification on whole slides
- Stage 2: Classification only on perfect crops

Fair comparison requires:
1. Running YOLO to detect cells
2. Using YOLO crops (not ground truth) for Stage 2
3. Measuring end-to-end accuracy

## Implementation Details

### Why Ground Truth Crops

Training on ground truth crops serves two purposes:

1. **Measures classifier quality in isolation**
   - No detection errors
   - Clean evaluation of classification capability
   - Establishes performance ceiling

2. **Standard research practice**
   - Common baseline in two-stage literature
   - Allows comparison with other approaches
   - Separates detection from classification issues

### Production Pipeline (Not Implemented)

For production, would need:
```python
# Stage 1: YOLO detects cells
detections = yolo_model.predict(image)

# Extract crops from YOLO detections (not ground truth)
crops = extract_crops_from_detections(image, detections)

# Stage 2: Classify each crop
classifications = efficientnet_model.predict(crops)

# Combine results
final_predictions = combine(detections, classifications)
```

**Challenge:** YOLO detections have errors:
- Missed cells (false negatives)
- False detections (false positives)
- Imperfect bounding boxes (crop quality)

These errors would reduce Stage 2 performance compared to current results.

### Softmax vs Sigmoid

**EfficientNet uses softmax** (mutually exclusive classes):
```python
output = softmax([p_NILM, p_ASC-US, p_LSIL, p_HSIL, p_SCC, p_ASC-H])
```

This enforces that probabilities sum to 1.0 and cell belongs to exactly one class.

**YOLO uses sigmoid** (multi-label):
```python
output = sigmoid([p_NILM, p_ASC-US, ...])  # Each independent
```

This allows multiple labels per box but doesn't match the biological reality that cells have a single type.

**Why this matters:**
- Softmax provides better-calibrated probabilities for exclusive classes
- YOLO's sigmoid head could be modified to use softmax (requires source code changes)
- This is documented as open question for future work (see main README)

### Alternative Approach Suggested

Based on expert analysis, an alternative decision procedure was recommended:

**Decouple objectness from classification:**

1. Use YOLO's objectness score only to decide "is this a cell?"
2. Use class probabilities P(class|cell) for cell type decision
3. Apply calibration (temperature scaling) to class probabilities
4. Set per-class thresholds based on calibrated probabilities

**Current approach:**
- YOLO uses: confidence = objectness × class_probability
- Per-class thresholds applied to combined score

**Recommended approach:**
- Objectness for detection: threshold at 0.20-0.35
- Class probabilities for typing: argmax over calibrated P(class|cell)
- Per-class thresholds on calibrated probabilities

**Status:** Current heuristic approach (per-class thresholds on combined score) shows practical improvement. Principled calibration approach documented for future work.

## Limitations

### 1. Ground Truth Crops vs YOLO Crops

**Current:** Uses ground truth bounding boxes (perfect crops)

**Production needs:** YOLO-detected crops (imperfect)

**Impact:** Real-world performance will be lower due to:
- Detection errors
- Crop quality variations
- Missed cells

### 2. No End-to-End Evaluation

Cannot directly compare with single-stage YOLO without:
- Implementing YOLO crop extraction
- Running full pipeline on test set
- Measuring slide-level accuracy

### 3. Computational Cost

Two-stage approach requires:
- YOLO inference (Stage 1)
- EfficientNet inference on each crop (Stage 2)

This is slower than single-stage YOLO, though modern GPUs can handle both stages efficiently.

### 4. Class Imbalance

Cell type distribution is highly imbalanced (many NILM, few SCC). The classifier must handle this during training (class weights, sampling strategies, etc.).

## Next Steps

### To Make Production-Ready

1. **Implement YOLO-based crop extraction**
```python
   crops = extract_from_yolo_detections(image, yolo_predictions)
```

2. **Train Stage 2 on YOLO crops**
   - More realistic training data
   - Handles imperfect crops
   - Better generalization to production

3. **Evaluate end-to-end pipeline**
   - YOLO detection + Stage 2 classification
   - Compare with single-stage YOLO
   - Measure on same test set

4. **Optimize for speed**
   - Batch crop processing
   - Model quantization
   - GPU optimization

### Alternative Improvements

Rather than two-stage, could explore:

1. **Modify YOLO classification head**
   - Switch sigmoid to softmax
   - More principled for exclusive classes
   - Requires YOLO source modification

2. **Probability calibration**
   - Temperature scaling on YOLO's class head
   - Better-calibrated confidence scores
   - Faster than two-stage

3. **Cost-sensitive learning**
   - Train with explicit misclassification costs
   - Principled thresholds
   - Single-stage approach

## Technical Notes

- **Dataset path**: Loaded from `PathsConfig.get_dataset_path()`
- **Output path**: Hardcoded in script, can be modified per run
- **GPU strongly recommended**: CPU training is very slow
- **Crop storage**: Requires disk space (~500MB-2GB depending on dataset)

## Troubleshooting

**Issue: Out of memory during training**
- Reduce batch size (try 16 or 8)
- Use smaller image size (e.g., 160×160 instead of 224×224)
- Reduce number of workers

**Issue: Low accuracy**
- Check class balance in crops
- Verify crops look correct (visual inspection)
- Increase training epochs
- Try data augmentation

**Issue: Crop extraction fails**
- Verify YOLO label format
- Check image paths are correct
- Ensure sufficient disk space

**Issue: Training very slow**
- Ensure GPU is enabled (check `torch.cuda.is_available()`)
- Reduce number of crops if dataset is huge
- Use fewer workers if I/O is bottleneck

## Validation Strategy

To validate two-stage approach:

1. **Train on ground truth crops** (current) ✅
   - Establishes performance ceiling

2. **Train on YOLO crops** (future work)
   - More realistic evaluation

3. **Compare with single-stage YOLO**
   - Same test set
   - End-to-end metrics
   - Determine if two-stage worth the complexity

## Related Experiments

- [Baseline Training](../baseline_training/README.md) - Single-stage YOLO approach
- [Slide Aggregation](../slide_aggregation/README.md) - Uses YOLO predictions
- [TTA Evaluation](../tta_evaluation/README.md) - Alternative accuracy improvement

## References

- Two-stage detection literature (R-CNN family)
- EfficientNet architecture (Tan & Le, 2019)
- Softmax vs sigmoid for exclusive classes
- Expert analysis on decoupling objectness from classification

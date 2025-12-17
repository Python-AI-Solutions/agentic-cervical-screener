# Test-Time Augmentation (TTA) Evaluation

Evaluates whether test-time augmentation provides meaningful improvements for cervical cell detection and whether it justifies the computational cost.

## Overview

Test-time augmentation (TTA) is a technique where predictions are made on multiple augmented versions of an image (flips, rotations) and then combined. This experiment compares regular inference against TTA inference to measure the impact on detection stability and inference time.

## What This Does

1. **Runs predictions with and without TTA**
   - Regular: Single prediction per image
   - TTA: Predictions on 4 augmented versions (original, horizontal flip, vertical flip, 90° rotation)

2. **Measures performance differences**
   - Detection count changes
   - Inference time comparison
   - Per-image consistency analysis

3. **Provides production recommendation**
   - Based on speed vs benefit tradeoff
   - Considers real-world deployment constraints

## Prerequisites

- **Baseline model trained** - Uses trained YOLO model
- Package installed
- Google Drive mounted (for Colab)

## Setup & Run

### Installation
```python
# Mount drive
from google.colab import drive
drive.mount('/content/drive')

# Install package
!pip install /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening -q
```

### Run Evaluation
```python
!python /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening/experiments/tta_evaluation/run_tta.py
```

**Runtime:** ~2-5 minutes for 10 images

## Configuration
```python
model_path = PathsConfig.get_baseline_model_path()
conf_threshold = 0.25
max_images = 10  # Number of test images
```

### Augmentations Applied

TTA uses 4 augmentations:
1. Original image
2. Horizontal flip
3. Vertical flip
4. 90° rotation

Predictions are averaged across all versions.

## Outputs

Results saved to `outputs_tta_evaluation/`:
```
outputs_tta_evaluation/
├── tta_comparison.csv              # Per-image detailed comparison
└── tta_evaluation_summary.json     # Aggregate statistics
```

### Comparison CSV

Per-image metrics:
- Regular inference time
- TTA inference time
- Time ratio (TTA/regular)
- Detection counts (regular vs TTA)
- Detection change percentage

### Summary JSON

Contains:
- Total images tested
- Aggregate timing statistics
- Detection consistency metrics
- Production recommendation with reasoning

## Results Interpretation

### Key Metrics

**Speed Impact:**
- Average time ratio (TTA inference time / regular inference time)
- Example: 3.1x means TTA is 3.1 times slower

**Detection Count Changes:**
- Measures difference in number of detections
- Does NOT directly measure accuracy (precision/recall/mAP)
- Change could indicate more conservative or more aggressive filtering

### Recommendation Logic

The evaluation provides one of three recommendations:

1. **"Use regular inference"**
   - TTA significantly slower (>2x)
   - Detection changes unclear or minimal
   - Production deployment should use regular inference

2. **"Consider TTA for critical cases"**
   - Moderate slowdown (1.5-2x)
   - Some detection changes (5-10%)
   - May be worth it for borderline cases

3. **"TTA provides value"**
   - Minimal slowdown (<1.5x)
   - Meaningful detection changes (>10%)
   - Worth using in production

## Implementation Details

### How TTA Works

For each image:

1. Generate 4 augmented versions
2. Run YOLO inference on each version
3. Transform detections back to original coordinates
4. Merge overlapping boxes using Non-Maximum Suppression (NMS)
5. Average confidence scores for matched boxes

### Box Matching

Boxes from different augmentations are matched using IoU (Intersection over Union):
- IoU > 0.5: Boxes considered same detection
- Confidence averaged across matched boxes
- Unmatched boxes kept if above threshold

### Alternative: Weighted Boxes Fusion

The current implementation uses standard NMS for merging boxes. An alternative approach is Weighted Boxes Fusion (WBF), which:

- Assigns weights based on confidence scores
- Averages box coordinates instead of picking highest confidence
- Generally produces more stable predictions

**Status:** Standard NMS is simpler and sufficient for evaluation. WBF documented for future consideration if TTA is adopted.

## Evaluation Results

Based on evaluation on 10 validation images:

### Timing Performance
```
Metric                          Baseline    TTA        Change
─────────────────────────────────────────────────────────────
Average time per image         0.29s       0.87s      +3.1x
Total time (10 images)         2.88s       8.73s      +3.0x
```

**Finding:** TTA increases inference time by approximately 3.1x (312% increase).

### Detection Changes
```
Metric                          Baseline    TTA        Change
─────────────────────────────────────────────────────────────
Total detections               330         319        -3.3%
```

**Finding:** TTA produced 3.3% fewer detections (330 → 319).

### Interpretation

The 3.3% change in detection count indicates that TTA affects predictions, but this metric alone does not determine whether accuracy improved:

**Possible interpretations:**
- Fewer detections could mean higher precision (fewer false positives)
- Fewer detections could mean lower recall (missed cells)
- Change could be random variation across augmentations

**What's missing:** This evaluation focused on computational cost and detection stability. It did not measure per-class accuracy metrics (precision, recall, mAP) which would be needed to determine if TTA improves classification quality.

### Cost-Benefit Analysis
```
Benefit:  ~3% change in detections (unclear if improvement)
Cost:     3.1x slower inference
Verdict:  High computational cost for unclear benefit
```

## Current Recommendation

**Not recommended for production** due to significant computational cost (3.1x slowdown) without clear evidence of accuracy improvement.

The baseline model (after Issues #24 and #25 optimizations) already performs robustly under normal inference, showing good generalization without needing TTA.

### When TTA Might Be Useful

Even though not recommended for production, TTA can be considered for:

**Offline analysis:**
- Batch processing where speed is not critical
- Research and experimentation
- Generating multiple predictions for ensemble

**Critical case review:**
- Borderline cases flagged for expert review
- When computational cost is not a constraint
- Slides with ambiguous findings

## Limitations of This Evaluation

### 1. Detection Count vs Accuracy

This evaluation measured detection count changes, not classification accuracy metrics (precision, recall, mAP per class). A 3% change in detection count does not directly indicate whether predictions are more accurate or less accurate.

**To properly assess TTA benefit, would need:**
- Per-class precision and recall
- mAP scores (mAP50, mAP50-95)
- Confusion matrices comparing regular vs TTA
- Slide-level diagnosis accuracy

### 2. Small Test Set

The evaluation used 10 validation images, which is:
- ✅ Sufficient for measuring timing and computational cost
- ⚠️ Limited for assessing accuracy improvements
- ⚠️ May not capture rare cell types or edge cases

### 3. No Per-Class Analysis

Detection count changes were not analyzed by cell type. TTA might:
- Help rare classes (HSIL, SCC) more than common ones (NILM)
- Improve recall for one class while reducing precision for another
- Have different effects depending on cell morphology

### 4. Question Framing

Rather than "Does TTA help?", the better questions are:
- Does TTA improve per-class accuracy metrics?
- Are there more efficient ways to improve accuracy? (calibration, architecture, two-stage)
- What is the right tradeoff between speed and accuracy for deployment?

## Alternative Approaches for Improvement

Beyond TTA, other techniques may provide better accuracy improvements without the computational cost:

### 1. Probability Calibration
- Temperature scaling on class probabilities
- Better-calibrated confidence scores
- Minimal inference overhead

### 2. Model Architecture Changes
- Switch from sigmoid to softmax classification head
- Use different backbone (if current model is limiting)
- Explore other detection architectures

### 3. Two-Stage Approach
- YOLO for detection, specialized classifier for typing
- Can optimize each stage independently
- May provide better accuracy than single-stage

### 4. Cost-Sensitive Learning
- Train with explicit misclassification costs
- Principled thresholds based on clinical priorities
- Better than heuristic per-class thresholds

### 5. Model Ensembling
- Train multiple models with different initializations
- Average predictions across ensemble
- May provide better accuracy than TTA

## Path Forward

Based on feedback, the key question is: **How do we get to state-of-the-art performance?**

### Option A: Investigate TTA More Thoroughly
- Run full accuracy evaluation (not just detection counts)
- Measure per-class metrics
- Determine if 3% change represents real accuracy improvement

### Option B: Explore Other Improvements
- Implement calibration (fast to add)
- Try two-stage with YOLO crops (already explored with GT crops)
- Switch classification head to softmax (requires YOLO modification)
- Evaluate different model architectures

### Option C: Combine Augmentations Systematically
- Test different augmentation combinations
- Measure which augmentations help most
- Could inform both training and inference strategies

**Current status:** TTA documented as "not recommended" due to computational cost and unclear benefit. Further investigation needed to determine optimal path to improved performance.

## Technical Notes

- **Model path**: Loaded from `PathsConfig.get_baseline_model_path()`
- **Dataset path**: Loaded from `PathsConfig.get_dataset_path()`
- **GPU required**: TTA on CPU is extremely slow
- **Memory usage**: 4x higher than regular inference (stores predictions from 4 augmentations)

## Troubleshooting

**Issue: Very slow inference**
- Ensure GPU is enabled in Colab (Runtime → Change runtime type → GPU)
- Reduce number of test images for quicker results
- Check if model is loading correctly

**Issue: Detection counts similar**
- This is expected if model predictions are stable
- Small changes (2-5%) are normal variation
- Large changes (>10%) suggest instability or sensitivity to orientation

**Issue: High memory usage**
- TTA requires storing 4x predictions temporarily
- Reduce batch size if running into OOM errors
- Process fewer images at once

## Related Experiments

- [Baseline Training](../baseline_training/README.md) - Model evaluated here
- [Slide Aggregation](../slide_aggregation/README.md) - Uses regular inference (not TTA)
- [Two-Stage Classifier](../two_stage_classifier/README.md) - Alternative approach to improve accuracy

## References

- Weighted Boxes Fusion: Alternative to NMS for TTA box merging
- Test-Time Augmentation literature for object detection
- Baseline model uses optimizations from Issues #24 and #25

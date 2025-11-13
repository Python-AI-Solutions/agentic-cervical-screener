# Slide-Level Aggregation

Aggregates cell-level predictions to whole-slide diagnosis using clinical decision rules.

## Overview

This experiment takes cell-level classifications from the baseline YOLO model and aggregates them to produce a slide-level diagnosis. In clinical practice, screening results are reported at the slide level (e.g., "HSIL detected" or "Negative for intraepithelial lesion"), not per individual cell.

## What This Does

1. **Runs YOLO on slide images**
   - Detects and classifies individual cells
   - Applies per-class confidence thresholds

2. **Aggregates to slide-level diagnosis**
   - Counts cells by type per slide
   - Applies clinical decision rules
   - Produces single diagnosis per slide

3. **Generates reports**
   - Per-slide diagnosis with confidence
   - Cell type distribution
   - Diagnosis statistics across dataset

## Prerequisites

- **Baseline model trained** - This experiment uses the trained YOLO model
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

### Run Aggregation
```python
!python /content/drive/Shareddrives/PythonAISolutions/projects/cervical-screening/experiments/slide_aggregation/aggregate.py
```

**Runtime:** ~5-15 minutes (depends on number of slides)

## Configuration
```python
model_path = PathsConfig.get_baseline_model_path()
conf_threshold = 0.25  # Initial objectness threshold
max_slides = 20        # Number of slides to analyze
```

Per-class thresholds are applied by the predictor from baseline training.

## Clinical Decision Rules

The aggregation follows a hierarchical priority based on clinical significance:

### Decision Hierarchy

1. **SCC** (Squamous Cell Carcinoma)
   - If ≥1 SCC cell detected → Slide diagnosis = SCC
   - Highest priority (invasive cancer)

2. **HSIL** (High-grade Squamous Intraepithelial Lesion)
   - If ≥1 HSIL cell detected → Slide diagnosis = HSIL
   - High priority (precancerous)

3. **ASC-H** (Atypical Squamous Cells - HSIL suspected)
   - If ≥2 ASC-H cells detected → Slide diagnosis = ASC-H
   - Requires multiple cells for confidence

4. **LSIL** (Low-grade Squamous Intraepithelial Lesion)
   - If ≥3 LSIL cells detected → Slide diagnosis = LSIL
   - Requires multiple cells

5. **ASC-US** (Atypical Squamous Cells - Undetermined)
   - If ≥5 ASC-US cells detected → Slide diagnosis = ASC-US
   - Common finding, requires substantial presence

6. **NILM** (Negative for Intraepithelial Lesion)
   - If no abnormal cells → Slide diagnosis = NILM
   - Default if criteria above not met

7. **INSUFFICIENT**
   - If <10 total cells detected → Insufficient sample
   - Cannot make reliable diagnosis

### Rationale

- **Single-cell rule for HSIL/SCC**: Missing high-grade lesions is clinically costly
- **Multi-cell rule for LSIL/ASC-US**: Reduces false positives from misclassified cells
- **Hierarchical**: More severe diagnoses override less severe
- **Minimum cell count**: Ensures adequate sample for diagnosis

## Outputs

Results saved to `outputs_slide_aggregation/`:
```
outputs_slide_aggregation/
├── slide_results_detailed.csv           # Per-slide results
├── slide_diagnosis_distribution.csv     # Diagnosis summary
└── slide_aggregation_summary.json       # Complete results
```

### Detailed CSV

Per-slide information:
- Slide name
- Final diagnosis
- Confidence level
- Total cells detected
- Average cell confidence

### Summary JSON

Contains:
- Total slides analyzed
- Total cells detected
- Average cells per slide
- Diagnosis distribution (counts and percentages)
- Complete per-slide results with cell breakdowns

## Results Interpretation

### Diagnosis Confidence

Confidence is computed as:
```
confidence = (cells_of_diagnosed_type / total_cells) × 100
```

Example:
- 5 HSIL cells out of 50 total → 10% confidence
- Diagnosis = HSIL (due to presence of high-grade cells)
- Low percentage indicates sparse lesion

### Cell Distribution

Each slide shows:
- Total cells detected
- Count per cell type
- Percentage per cell type

This helps assess:
- Sample adequacy
- Lesion extent
- Classification confidence

## Implementation Details

### Alternative Aggregation Approaches

The current implementation uses cell counts and hierarchical rules. An alternative probabilistic approach was suggested:

**Noisy-OR Aggregation** (not implemented):
```
P(HSIL on slide) = 1 - ∏(1 - P(HSIL|cell_k))
```

Where the slide probability considers each cell's posterior probability rather than just counts.

**Benefits:**
- Incorporates uncertainty from each cell
- Few high-confidence cells appropriately drive diagnosis
- More principled than count-based rules

**Status:** Current count-based approach is more interpretable for clinical review. Probabilistic approach documented for future work.

### Why Count-Based Rules

1. **Interpretability**: Clinicians can review actual cell counts
2. **Robustness**: Less sensitive to confidence calibration issues
3. **Clinical alignment**: Mirrors manual screening practice
4. **Transparency**: Easy to audit and adjust thresholds

## Limitations

1. **Fixed thresholds**: Cell count thresholds (e.g., ≥3 LSIL) are heuristic, not learned from data

2. **No spatial information**: Doesn't consider cell clustering or location patterns

3. **No morphology features**: Uses only YOLO classifications, not nuclear/cytoplasmic features

4. **Simple confidence**: Uses cell counts rather than probabilistic combination

## Validation

To validate slide-level diagnoses:
1. Compare with pathologist-provided slide labels (if available)
2. Assess concordance rates per diagnosis type
3. Review discrepant cases manually

Note: This experiment focuses on the aggregation methodology. Validation against ground truth slide labels is separate work.

## Example Output
```
SLIDE AGGREGATION RESULTS
===============================================================================

Total slides analyzed: 20
Total cells detected: 1,247
Average cells per slide: 62.4

Slide Diagnosis Distribution:
   NILM            : 12 slides (60.0%)
   LSIL            :  4 slides (20.0%)
   HSIL            :  2 slides (10.0%)
   ASC-US          :  1 slides ( 5.0%)
   INSUFFICIENT    :  1 slides ( 5.0%)

Key Findings:
   Most common diagnosis: NILM (12 slides)
   High-grade/Cancer slides: 2 (HSIL: 2, SCC: 0)
```

## Technical Notes

- **Model path**: Loaded from `PathsConfig.get_baseline_model_path()`
- **Dataset path**: Loaded from `PathsConfig.get_dataset_path()`
- **Output path**: Hardcoded in script, can be modified per run
- **Inference speed**: ~1-2 seconds per slide (GPU)

## Troubleshooting

**Issue: Model not found**
- Ensure baseline training completed successfully
- Check model path in `paths_config.py`

**Issue: All slides diagnosed as INSUFFICIENT**
- Detection threshold may be too high
- Check if images are loading correctly
- Verify model is detecting cells

**Issue: Unexpected diagnoses**
- Review per-slide cell counts in detailed CSV
- Check if decision rules align with expectations
- Verify baseline model performance

## Next Steps

After slide aggregation:
1. Review diagnosis distribution
2. Validate against ground truth slide labels (if available)
3. Adjust cell count thresholds if needed
4. Consider implementing probabilistic aggregation

## Related Experiments

- [Baseline Training](../baseline_training/README.md) - Trains the model used here
- [TTA Evaluation](../tta_evaluation/README.md) - Evaluates augmentation strategies
- [Two-Stage Classifier](../two_stage_classifier/README.md) - Alternative classification approach

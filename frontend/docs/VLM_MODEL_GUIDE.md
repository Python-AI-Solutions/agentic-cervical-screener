# VLM Model Guide

Guide for finding, testing, and adding new Vision Language Models for UI quality audits.

## Currently Supported Models

### SmolVLM-256M (Fastest)
- **Size:** ~500MB
- **Speed:** ~8 seconds per image
- **Quality:** Basic - good for obvious issues only
- **Best for:** Quick checks, CI/CD pipelines
- **Usage:** `pixi run vlm-viewer --model SmolVLM-256M`

### SmolVLM-500M (Recommended)
- **Size:** ~1GB
- **Speed:** ~8-10 seconds per image
- **Quality:** Decent - catches obvious visual problems
- **Best for:** General UI quality checks
- **Usage:** `pixi run vlm-viewer` (default)

### Qwen2-VL-2B (Most Capable)
- **Size:** ~2GB
- **Speed:** ~15-20 seconds per image
- **Quality:** Better - more likely to notice subtle issues
- **Best for:** Thorough audits, catching edge cases
- **Usage:** `pixi run vlm-viewer --model Qwen2-VL-2B`

## Finding New Models

### 1. Browse mlx-community on HuggingFace

Visit: https://huggingface.co/mlx-community

Look for models with "vlm" or "vision" in the name:
- Search for: `mlx-community vision`
- Filter by: Most likes, Most downloads
- Check model cards for supported architectures

### 2. Check mlx-vlm Supported Architectures

The `mlx-vlm` package supports these model types:
- `idefics2` - Idefics2 models
- `llava` - LLaVA 1.5 models
- `llava_next` - ❌ NOT YET SUPPORTED (LLaVA 1.6)
- `paligemma` - PaliGemma models
- `qwen2_vl` - Qwen2-VL models
- `phi3_v` - Phi-3 Vision models

Check the model's `config.json` on HuggingFace for `model_type`.

### 3. Test Before Adding

Try a model manually first:

```bash
# Test if model loads
pixi run llm -m model-name "What do you see?" -a test-image.png

# If it works, test with actual UI screenshot
pixi run llm -m model-name "$(cat prompts/vlm/viewer-audit.txt)" -a playwright-artifacts/viewer/viewer-desktop-viewer-context.png
```

### 4. Add to Plugin

If the model works, add it to `external/llm-mlx-vlm/llm_mlx_vlm.py`:

```python
register(MlxVlmModel("Model-Name", "org-name/model-repo-name"))
```

## Model Selection Criteria

### For UI Audits:
- **Small models (256M-500M):** Fast but miss subtle issues
- **Medium models (1B-3B):** Good balance of speed and quality
- **Large models (7B+):** Better quality but may be too slow

### Key Factors:
1. **Inference speed** - Should complete in 5-30 seconds per image
2. **Memory usage** - Should fit in <4GB RAM
3. **Accuracy** - Test on known issues (cut-off buttons, misalignment)
4. **Quantization** - 4-bit models are faster with minimal quality loss

## Testing New Models

### Quick Test:
```bash
# Test on a single image
pixi run llm -m NewModel "Describe any visual problems" -a screenshot.png
```

### Full Test:
```bash
# Run full audit suite
pixi run vlm-viewer --model NewModel

# Check results
cat playwright-artifacts/viewer/vlm-report.md
```

### Benchmark:
```bash
# Time the execution
time pixi run vlm-viewer --model NewModel
```

## Iterating on Prompts

Prompts are in `prompts/vlm/*.txt` - edit them directly without touching code.

### Testing Prompt Changes:

```bash
# Test prompt on single image
pixi run llm -m SmolVLM-500M "$(cat prompts/vlm/viewer-audit.txt)" -a image.png

# Run full suite with new prompt
pixi run vlm-viewer
```

### Prompt Tips:

1. **Be specific about what to check:**
   ```
   BAD:  "Check for visual issues"
   GOOD: "Check if the Download button is cut off at the bottom of the screen"
   ```

2. **Describe what good looks like:**
   ```
   "All UI elements should be fully visible within the viewport.
    Buttons should not be truncated or partially off-screen."
   ```

3. **Give examples:**
   ```
   "Common problems:
    - Buttons cut off at screen edges
    - Text overlapping other elements
    - Headers misaligned across breakpoints"
   ```

4. **Start simple, then add details:**
   - First iteration: General description task
   - Second: Add specific UI elements to check
   - Third: Add severity criteria
   - Fourth: Add examples of good/bad

## Incorporating Specifications

To check against specific design requirements, add them to the prompt:

```
Design Requirements:
- All buttons must be at least 44px tall (touch target size)
- Drawer must have 16px safe-area padding on mobile
- Canvas should occupy at least 60% of viewport height
- Classification buttons must be visible without scrolling

Check if these requirements are met in the screenshot.
```

## Known Issues

### Model Not Found
```
Error: Model type 'xyz' not supported
```
**Solution:** The model architecture isn't supported by mlx-vlm yet. Try a different model.

### Download Timeouts
**Solution:** Increase timeout:
```bash
VLM_TIMEOUT_MS=180000 pixi run vlm-viewer --model LargeModel
```

### Out of Memory
**Solution:** Use a smaller or quantized model (4-bit versions).

## Recommended Workflow

1. **Start with SmolVLM-500M** - Fast baseline
2. **Customize prompt** for your specific UI concerns
3. **Test on known issues** (e.g., that cut-off button)
4. **If it misses issues**, try larger model (Qwen2-VL-2B)
5. **Iterate on prompt** to be more explicit
6. **Once satisfied**, integrate into CI/CD

## Quick Start: Adding a New Model

Use the helper script to add, download, and test a model in one command:

```bash
# Add Qwen3-VL-4B model
MODEL_NAME=Qwen3-VL-4B HF_PATH=mlx-community/Qwen3-VL-4B-Instruct-4bit pixi run add-model

# Or directly:
./scripts/add-vlm-model.sh Qwen3-VL-4B mlx-community/Qwen3-VL-4B-Instruct-4bit
```

This will:
1. Add the model to the plugin
2. Download it from HuggingFace
3. Test it on a sample image
4. Show you next steps

## Manual Process: Finding a New Model

```bash
# 1. Find model on HuggingFace
open "https://huggingface.co/mlx-community?search=vision"

# 2. Check if architecture is supported (look at config.json)
# model_type should be: idefics2, llava, paligemma, qwen2_vl, or phi3_v

# 3. Add to plugin (edit external/llm-mlx-vlm/llm_mlx_vlm.py)
#    register(MlxVlmModel("Qwen3-VL-4B", "mlx-community/Qwen3-VL-4B-Instruct-4bit"))

# 4. Download model (triggers on first use)
MODEL_NAME=Qwen3-VL-4B pixi run test-model

# 5. Test with audit prompt
pixi run llm -m Qwen3-VL-4B "$(cat prompts/vlm/viewer-audit.txt)" -a screenshot.png

# 6. Run full audit
pixi run vlm-viewer --model Qwen3-VL-4B

# 7. Compare results with SmolVLM-500M
diff playwright-artifacts/viewer/vlm-report.md previous-report.md
```

## Available Pixi Commands

```bash
# Add a new model (all-in-one)
MODEL_NAME=ModelName HF_PATH=org/repo pixi run add-model

# Download a model manually
HF_PATH=mlx-community/model-name pixi run download-model

# Test if a model works
MODEL_NAME=ModelName pixi run test-model

# Run full VLM audit
pixi run vlm-viewer                    # Uses SmolVLM-500M (default)
pixi run vlm-viewer --model Qwen2-VL-2B  # Use specific model
```

## Performance Benchmarks

| Model | Size | Speed | Memory | Quality |
|-------|------|-------|--------|---------|
| SmolVLM-256M | 500MB | 8s | 1.8GB | ⭐⭐ |
| SmolVLM-500M | 1GB | 8s | 1.9GB | ⭐⭐⭐ |
| Qwen2-VL-2B | 2GB | 15s | 3.5GB | ⭐⭐⭐⭐ |

*Tested on M3 MacBook Pro*

## Next Steps

- Try Qwen2-VL-2B for better issue detection
- Customize prompts with your design spec
- Add examples of good/bad UI to prompts
- Test on more diverse screenshots
- Consider prompt engineering tools (few-shot examples)

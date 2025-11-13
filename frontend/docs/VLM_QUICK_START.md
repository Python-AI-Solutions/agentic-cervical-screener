# VLM Quick Start Guide

Fast reference for using Vision Language Models to audit UI quality.

## Basic Usage

```bash
# Run viewer audit with default model (SmolVLM-500M)
pixi run vlm-viewer

# Run with specific model
pixi run vlm-viewer --model Qwen2-VL-2B

# Run docs audit
pixi run vlm-docs

# Check results
cat playwright-artifacts/viewer/vlm-report.md
```

## Adding New Models

### One-Line Add

```bash
# Find model on HuggingFace: https://huggingface.co/mlx-community?search=vision
# Then add it:
MODEL_NAME=Qwen3-VL-4B HF_PATH=mlx-community/Qwen3-VL-4B-Instruct-4bit pixi run add-model
```

### Manual Testing

```bash
# Test model on single image
pixi run llm -m ModelName "What do you see?" -a screenshot.png

# Test with full audit prompt
pixi run llm -m ModelName "$(cat prompts/vlm/viewer-audit.txt)" -a screenshot.png
```

## Customizing Prompts

Prompts are in `prompts/vlm/` - edit directly:

```bash
# Edit viewer prompt
code prompts/vlm/viewer-audit.txt

# Test changes immediately
pixi run llm -m SmolVLM-500M "$(cat prompts/vlm/viewer-audit.txt)" -a screenshot.png

# Run full audit with new prompt
pixi run vlm-viewer
```

## Troubleshooting

### Model Download Taking Forever
```bash
# Check download progress (models are 500MB-4GB)
ls -lh ~/.cache/huggingface/hub/

# Increase timeout for first run
VLM_TIMEOUT_MS=300000 pixi run vlm-viewer --model LargeModel
```

### Model Not Supported
```
Error: Model type 'xyz' not supported
```
**Solution:** Check model architecture at `https://huggingface.co/org/model/blob/main/config.json`

Supported: `idefics2`, `llava`, `paligemma`, `qwen2_vl`, `phi3_v`
Not supported yet: `llava_next` (LLaVA 1.6), `idefics3`

### Model Misses Issues
1. **Try larger model**: Qwen2-VL-2B is more perceptive than SmolVLM-500M
2. **Make prompt more explicit**: Add specific examples of problems to check
3. **Add design specs**: Include requirements like "buttons must be >44px tall"

## Model Recommendations

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| CI/CD fast checks | SmolVLM-500M | 8s/image, catches obvious issues |
| Thorough audits | Qwen2-VL-2B | 15s/image, better at subtle problems |
| Quick iteration | SmolVLM-256M | 8s/image, very fast but basic |

## Common Commands

```bash
# List available models
pixi run llm models | grep MLX-VLM

# Download model
MODEL_NAME=Qwen2-VL-2B pixi run test-model

# View full output (not just extracted answer)
pixi run llm -m SmolVLM-500M "test" -a image.png

# Compare models
pixi run vlm-viewer --model SmolVLM-500M
mv playwright-artifacts/viewer/vlm-report.md report-500m.md
pixi run vlm-viewer --model Qwen2-VL-2B
diff report-500m.md playwright-artifacts/viewer/vlm-report.md
```

## Integration with CI/CD

```yaml
# Example GitHub Action
- name: Run UI Quality Audit
  run: |
    pixi install
    pixi run test-e2e  # Generate screenshots
    pixi run vlm-viewer

    # Fail if medium/high issues found
    if grep -q '"severity":"medium\|high"' playwright-artifacts/viewer/vlm-report.md; then
      echo "UI quality issues detected"
      exit 1
    fi
```

## Next Steps

- Read full guide: [VLM_MODEL_GUIDE.md](./VLM_MODEL_GUIDE.md)
- Customize prompts in `prompts/vlm/`
- Add your design specs to prompts
- Try different models from mlx-community
- Integrate into your CI/CD pipeline

## Help & Debugging

- Subprocess issues: [DEBUGGING_SUBPROCESS_STDIN.md](./DEBUGGING_SUBPROCESS_STDIN.md)
- Model compatibility: Check `mlx-vlm` supported architectures
- Prompt engineering: Start simple, add specifics iteratively

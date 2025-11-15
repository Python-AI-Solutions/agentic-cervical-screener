# VLM Options for Fast Debugging

This document explores small, fast Vision Language Models (VLMs) optimized for Apple Silicon to speed up debugging of the VLM audit script.

## Current Setup

- **Current model**: `gemma3:4b` (3.3 GB, slow - times out at 20-30s)
- **Available models**: `llava:latest` (4.7 GB), `gemma3:4b` (3.3 GB), `gemma3:1b` (815 MB, no vision), `gemma3:270m` (291 MB, no vision)

## Option 1: Ollama Vision Models (Easiest)

### Current Available Models
- `llava:latest` (4.7 GB) - Currently available, testing speed
- `gemma3:4b` (3.3 GB) - Currently available, slow (20-30s timeout)

### Testing llava:latest
```bash
# Test speed
cd frontend && VLM_MODEL=llava:latest VLM_TIMEOUT_MS=60000 VLM_HEARTBEAT_MS=5000 pixi run vlm-viewer
```

### Other Ollama Vision Models to Try
- `llava:7b` - Smaller variant, might be faster (need to pull)
- `llava:13b` - If you need better quality (need to pull)

## Option 2: MLX-Optimized Models (Fastest for Apple Silicon)

MLX models are optimized specifically for Apple Silicon and can be significantly faster.

### Setup MLX-VLM

1. **Install mlx-vlm**:
```bash
pip install mlx-vlm
```

2. **Available MLX Models**:
   - **SmolVLM-256M**: ~256M parameters, smallest option
   - **SmolVLM-500M**: ~500M parameters, balance of speed/quality
   - **SmolDocling-256M-preview-mlx-fp16**: MLX format, optimized

3. **Usage with mlx-vlm**:
```bash
python3 -m mlx_vlm.generate \
  --model HuggingfaceTB/SmolVLM-500M-Instruct \
  --max-tokens 400 \
  --temp 0.0 \
  --image <image_path> \
  --prompt "Your prompt here"
```

### Integration Options

**Option A**: Modify the script to support MLX-VLM as an alternative backend
**Option B**: Create a wrapper script that converts MLX output to match Ollama format
**Option C**: Use MLX-VLM directly for debugging, keep Ollama for production

## Option 3: Quick Test with Existing Models

### Test with llava:latest (might be faster than gemma3:4b)
```bash
cd frontend && VLM_MODEL=llava:latest VLM_TIMEOUT_MS=60000 VLM_HEARTBEAT_MS=5000 pixi run vlm-viewer
```

### Increase timeout for gemma3:4b
```bash
cd frontend && VLM_MODEL=gemma3:4b VLM_TIMEOUT_MS=120000 VLM_HEARTBEAT_MS=10000 pixi run vlm-viewer
```

## Quick MLX-VLM Setup (Recommended for Fast Debugging)

### Step 1: Install MLX-VLM
```bash
# In your pixi environment or system Python
pixi add mlx-vlm
# OR
pip install mlx-vlm
```

### Step 2: Test SmolVLM-500M (Recommended)
```bash
# First run will download the model (~1GB)
python3 -m mlx_vlm.generate \
  --model HuggingfaceTB/SmolVLM-500M-Instruct \
  --max-tokens 200 \
  --temp 0.0 \
  --image frontend/playwright-artifacts/viewer/viewer-desktop-viewer-context.png \
  --prompt "You are a UI QA assistant reviewing a responsive viewer screenshot. Respond with a JSON: {\"severity\":\"low|medium|high\",\"notes\":\"short sentence\"}"
```

### Step 3: Use MLX Wrapper Script
A wrapper script has been created at `frontend/scripts/mlx-vlm-wrapper.ts` that calls MLX-VLM and matches the Ollama/llm CLI interface.

To use it with the VLM audit script, set `LLM_BIN` to point to the wrapper:
```bash
cd frontend && \
 LLM_BIN="node scripts/mlx-vlm-wrapper.ts" \
 VLM_MODEL=SmolVLM-500M \
 pixi run vlm-viewer
```

## Recommendations

1. **For fastest debugging**: Set up MLX-VLM with SmolVLM-500M (likely 5-10x faster than Ollama models)
2. **For immediate use**: Use `llava:latest` or `gemma3:4b` with `VLM_TIMEOUT_MS=120000` (2 minutes)
3. **For production**: Keep using `llava:latest` with appropriate timeouts

## Model Size Comparison

| Model | Size | Speed | Quality | Setup |
|-------|------|-------|---------|-------|
| gemma3:4b | 3.3 GB | Slow | Good | ✅ Ready |
| llava:latest | 4.7 GB | Medium | Good | ✅ Ready |
| bakllava | ? | ? | ? | Testing |
| SmolVLM-256M | ~500 MB | Fast | Good | Needs setup |
| SmolVLM-500M | ~1 GB | Fast | Better | Needs setup |

## Next Steps

1. Test bakllava once it finishes downloading
2. If bakllava is still slow, set up MLX-VLM
3. Consider adding MLX-VLM support to the script as an optional backend

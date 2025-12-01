# Integration with Agentic Cervical Screener

This document describes how to use the `llm-mlx-vlm` plugin with the existing VLM testing infrastructure.

## Quick Start

### 1. Install the plugin

From the `frontend/external/llm-mlx-vlm` directory:

```bash
pixi install
pixi run install-dev
```

### 2. Update docs-overview-vlm.ts

Modify `scripts/docs-overview-vlm.ts` to use the `llm` CLI with MLX-VLM models:

```typescript
// In resolveModelName function, change default:
function resolveModelName(opts: Options) {
  return (
    opts.modelOverride ??
    process.env[envKeyForSuite(opts.suite, 'VLM_MODEL')] ??
    process.env.VLM_MODEL ??
    'SmolVLM-500M'  // Changed from 'llava'
  );
}

// Update LLM_BIN resolution to use pixi
function resolveLlmBin() {
  return process.env.LLM_BIN ?? 'pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm';
}
```

### 3. Run VLM tests

```bash
# Using MLX-VLM (fast)
VLM_MODEL=SmolVLM-500M npm run vlm:viewer

# Using MLX-VLM with higher quality
VLM_MODEL=Qwen2-VL-2B npm run vlm:viewer

# Fastest option
VLM_MODEL=SmolVLM-256M npm run vlm:viewer
```

## Environment Variables

```bash
# Model selection
VLM_MODEL=SmolVLM-500M     # Use MLX-VLM SmolVLM-500M
VLM_MODEL=SmolVLM-256M     # Fastest, smallest
VLM_MODEL=Qwen2-VL-2B      # Best quality

# LLM CLI binary
LLM_BIN=llm                # Use system llm
LLM_BIN="pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm"  # Use plugin's pixi env

# Timeout (MLX is much faster)
VLM_TIMEOUT_MS=30000       # 30 seconds (instead of the older 120-second default)
```

## Performance Comparison

### Legacy Runtime (Previous Setup)

- Model: `llava:latest` or `gemma3:4b`
- Size: 3.3-4.7GB
- Speed: 20-60 seconds per image
- Memory: 4-8GB
- Timeout needed: 120 seconds

### MLX-VLM (New Setup)

- Model: `SmolVLM-500M`
- Size: ~1GB
- Speed: 5-15 seconds per image
- Memory: ~2GB
- Timeout needed: 30 seconds

**Result: 4-12x faster, 50% less memory**

## Example Integration

### Option 1: Direct llm CLI usage

```typescript
// scripts/docs-overview-vlm.ts
async function runLlmOnImage(params: {
  imagePath: string;
  prompt: string;
  model: string;
}) {
  const llmBin = process.env.LLM_BIN ?? 'llm';
  const timeoutMs = parseInt(process.env.VLM_TIMEOUT_MS ?? '30000', 10);

  const args = [
    '-m', params.model,
    '--no-stream',
    '--no-log',
    '-a', params.imagePath,
    params.prompt,
  ];

  const { stdout } = await execa(llmBin, args, { timeout: timeoutMs });
  return stdout.trim();
}
```

### Option 2: Use pixi environment

```bash
# Add to package.json
{
  "scripts": {
    "vlm:viewer:mlx": "VLM_MODEL=SmolVLM-500M LLM_BIN='pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm' node scripts/docs-overview-vlm.ts --suite viewer"
  }
}
```

## CI/CD Integration

### GitHub Actions (Mac runners)

```yaml
name: VLM Tests

on: [push, pull_request]

jobs:
  vlm-tests:
    runs-on: macos-14  # Apple Silicon runner
    steps:
      - uses: actions/checkout@v4

      - name: Install pixi
        uses: prefix-dev/setup-pixi@v1

      - name: Install llm-mlx-vlm plugin
        working-directory: frontend/external/llm-mlx-vlm
        run: |
          pixi install
          pixi run install-dev

      - name: Run VLM tests
        working-directory: frontend
        run: |
          VLM_MODEL=SmolVLM-500M \
          LLM_BIN="pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm" \
          VLM_TIMEOUT_MS=45000 \
          npm run test:vlm
```

## Migration Path

### Phase 1: Test locally
1. Install plugin in `external/llm-mlx-vlm`
2. Test with: `VLM_MODEL=SmolVLM-500M npm run vlm:viewer`
3. Verify output quality

### Phase 2: Update scripts
1. Change default model in `docs-overview-vlm.ts`
2. Update timeout defaults (30s instead of 120s)
3. Update error messages

### Phase 3: Update documentation
1. Update `VLM_OPTIONS.md` with MLX-VLM as recommended approach
2. Document environment variables
3. Add troubleshooting guide

### Phase 4: CI/CD
1. Add plugin installation to CI workflows
2. Use MLX-VLM on Mac runners
3. Fallback to cloud VLMs (Claude/Gemini) on Linux runners

## Troubleshooting

### Plugin not found

```bash
# Verify plugin is installed
pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm models | grep MLX-VLM
```

Should show:
```
MLX-VLM: SmolVLM-256M
MLX-VLM: SmolVLM-500M
MLX-VLM: Qwen2-VL-2B
```

### First run is slow

The model downloads from HuggingFace on first use (~1GB). Subsequent runs are fast.

### Memory errors

Use smaller model:
```bash
VLM_MODEL=SmolVLM-256M npm run vlm:viewer
```

## Next Steps

1. Remove `scripts/mlx-vlm-wrapper.ts` (superseded by this plugin)
2. Update `VLM_OPTIONS.md` with this as the recommended approach
3. Consider publishing plugin to PyPI for easier installation
4. Add support for video/audio if needed (MLX-VLM supports it)

# VLM Implementation Recommendation

## Summary

Your current approach of using Simon Willison's `llm` CLI is correct, but your MLX wrapper bypasses it unnecessarily. Instead, you should either:
1. Use MLX-VLM directly (fastest)
2. Create an `llm` plugin for MLX-VLM (best long-term)
3. Stick with `llm` + Ollama with optimized settings (easiest)

## Current State Analysis

### What Works
- ✅ Your `docs-overview-vlm.ts` script structure is solid
- ✅ Using `llm` CLI as an abstraction layer is the right choice
- ✅ Screenshot capture pipeline via Playwright is well-designed
- ✅ Prompt engineering for UI/UX analysis is appropriate

### What's Misguided
- ❌ Your `mlx-vlm-wrapper.ts` reimplements what should be an `llm` plugin
- ❌ Direct Python subprocess calls bypass `llm`'s benefits
- ❌ No fallback mechanism for different environments
- ❌ Timeout issues with large Ollama models (gemma3:4b)

## Option Analysis

### Option 1: Direct MLX-VLM (Recommended for Speed)

**Implementation:**
```typescript
// In scripts/docs-overview-vlm.ts
async function runMlxVlmOnImage(params: {
  imagePath: string;
  prompt: string;
  model: string;
}) {
  const { stdout } = await execa('python3', [
    '-m', 'mlx_vlm.generate',
    '--model', params.model,
    '--max-tokens', '400',
    '--temp', '0.0',
    '--image', params.imagePath,
    '--prompt', params.prompt,
  ], {
    timeout: 30000, // Much faster than Ollama
  });

  return stdout.trim();
}
```

**Models to use:**
- `HuggingfaceTB/SmolVLM-500M-Instruct` (~1GB, fast)
- `HuggingfaceTB/SmolVLM-256M-Instruct` (~500MB, fastest)
- `Qwen/Qwen2-VL-2B-Instruct` (~2GB, better quality)

**Pros:**
- 5-10x faster than Ollama on Apple Silicon
- Smaller model sizes
- Direct control
- Reliable timeouts (under 30s)

**Cons:**
- Python dependency management
- No easy model switching
- Mac-only (CI/CD implications)

### Option 2: Create LLM Plugin for MLX-VLM (Best Long-term)

Create `llm-mlx-vlm` plugin following Simon Willison's plugin architecture:

```python
# llm_mlx_vlm.py
import llm
from mlx_vlm import load, generate

@llm.hookimpl
def register_models(register):
    register(MlxVlmModel("SmolVLM-500M"))
    register(MlxVlmModel("SmolVLM-256M"))

class MlxVlmModel(llm.Model):
    needs_key = None
    can_stream = False
    supports_images = True

    def execute(self, prompt, stream, response, conversation):
        # MLX-VLM inference here
        pass
```

**Usage:**
```bash
llm install llm-mlx-vlm
llm -m SmolVLM-500M "Analyze UI" -a screenshot.png
```

**Pros:**
- Integrates with `llm` ecosystem
- Consistent interface with other models
- Easy model management
- Could contribute back to community

**Cons:**
- Initial development effort
- Plugin maintenance
- Still Mac-only

### Option 3: Optimize Ollama + LLM (Easiest Short-term)

Stick with current approach but optimize:

```bash
# Try faster Ollama VLMs
llm install llm-ollama

# Test different models
llm -m llava:7b "prompt" -a image.png
llm -m bakllava "prompt" -a image.png

# Adjust timeouts
VLM_TIMEOUT_MS=120000 npm run vlm:viewer
```

**Pros:**
- No architecture changes
- Works on any platform
- Easy CI/CD integration
- Model variety

**Cons:**
- Slower (30-60s per image)
- Larger models (4-7GB)
- Requires Ollama server

## Recommended Implementation Plan

### Phase 1: Quick Win (Direct MLX-VLM)

1. **Update `docs-overview-vlm.ts`** to support both `llm` CLI and direct MLX-VLM:

```typescript
async function runVlmOnImage(params: {
  imagePath: string;
  prompt: string;
  model: string;
  backend: 'llm' | 'mlx-vlm';
}) {
  if (params.backend === 'mlx-vlm') {
    return runMlxVlmDirect(params);
  } else {
    return runLlmCli(params);
  }
}
```

2. **Add backend selection via environment variable:**
```bash
VLM_BACKEND=mlx-vlm VLM_MODEL=SmolVLM-500M npm run vlm:viewer
```

3. **Remove standalone `mlx-vlm-wrapper.ts`** - integrate directly

### Phase 2: Create LLM Plugin (Long-term)

1. Create `llm-mlx-vlm` plugin package
2. Publish to PyPI
3. Install via `llm install llm-mlx-vlm`
4. Use standard `llm` interface everywhere

### Phase 3: CI/CD Strategy

For cross-platform testing:
- Mac runners: Use MLX-VLM (fast)
- Linux/other: Use Ollama or cloud APIs (Claude/Gemini via `llm`)

## Code Changes Needed

### 1. Update `docs-overview-vlm.ts`

Add backend detection:
```typescript
type VlmBackend = 'llm' | 'mlx-vlm';

function resolveBackend(): VlmBackend {
  return (process.env.VLM_BACKEND as VlmBackend) ?? 'llm';
}

async function runVlmOnImage(params: {
  imagePath: string;
  prompt: string;
  model: string;
  backend: VlmBackend;
}) {
  if (params.backend === 'mlx-vlm') {
    // Direct MLX-VLM call
    const { stdout } = await execa('python3', [
      '-m', 'mlx_vlm.generate',
      '--model', `HuggingfaceTB/${params.model}`,
      '--max-tokens', '400',
      '--temp', '0.0',
      '--image', params.imagePath,
      '--prompt', params.prompt,
    ], { timeout: 30000 });
    return stdout.trim();
  } else {
    // Existing llm CLI call
    const llmBin = process.env.LLM_BIN ?? 'llm';
    const { stdout } = await execa(llmBin, [
      '-m', params.model,
      '--no-stream',
      '--no-log',
      '-a', params.imagePath,
      params.prompt,
    ], { timeout: 120000 });
    return stdout.trim();
  }
}
```

### 2. Update package.json scripts

```json
{
  "scripts": {
    "vlm:viewer": "node scripts/docs-overview-vlm.ts --suite viewer",
    "vlm:viewer:fast": "VLM_BACKEND=mlx-vlm VLM_MODEL=SmolVLM-500M-Instruct node scripts/docs-overview-vlm.ts --suite viewer",
    "vlm:docs": "node scripts/docs-overview-vlm.ts --suite docs-overview",
    "vlm:docs:fast": "VLM_BACKEND=mlx-vlm VLM_MODEL=SmolVLM-500M-Instruct node scripts/docs-overview-vlm.ts --suite docs-overview"
  }
}
```

### 3. Add Python dependencies

```bash
# For development (Mac)
pip install mlx-vlm

# Or add to pyproject.toml if using one
```

### 4. Remove `mlx-vlm-wrapper.ts`

The wrapper is unnecessary - integrate directly into main script.

## Environment Variable Reference

```bash
# Backend selection
VLM_BACKEND=llm|mlx-vlm          # Choose backend (default: llm)

# Model selection (backend-specific)
VLM_MODEL=llava                   # For llm backend (Ollama)
VLM_MODEL=SmolVLM-500M-Instruct   # For mlx-vlm backend

# Performance tuning
VLM_TIMEOUT_MS=30000              # Timeout for mlx-vlm (fast)
VLM_TIMEOUT_MS=120000             # Timeout for llm+Ollama (slow)
VLM_HEARTBEAT_MS=5000             # Progress logging interval

# LLM CLI binary (for testing)
LLM_BIN=/path/to/llm              # Override llm binary path
```

## Testing Strategy

### Local Development (Mac)
```bash
# Fast iteration with MLX-VLM
VLM_BACKEND=mlx-vlm VLM_MODEL=SmolVLM-500M-Instruct npm run vlm:viewer

# Quality check with larger model
VLM_BACKEND=mlx-vlm VLM_MODEL=Qwen2-VL-2B-Instruct npm run vlm:viewer
```

### CI/CD (Cross-platform)
```yaml
# GitHub Actions
- name: Run VLM Tests (Mac)
  if: runner.os == 'macOS'
  run: |
    pip install mlx-vlm
    VLM_BACKEND=mlx-vlm npm run test:vlm

- name: Run VLM Tests (Linux)
  if: runner.os == 'Linux'
  run: |
    # Use cloud API via llm
    llm install llm-anthropic
    VLM_BACKEND=llm VLM_MODEL=claude-3-haiku npm run test:vlm
```

## Next Steps

1. ✅ Review this recommendation
2. Decide on approach (recommend Option 1 for now)
3. Update `docs-overview-vlm.ts` with backend selection
4. Test with MLX-VLM locally
5. Consider building `llm-mlx-vlm` plugin later
6. Update CI/CD workflows

## References

- [Simon Willison's LLM](https://github.com/simonw/llm)
- [LLM MLX Plugin](https://github.com/simonw/llm-mlx)
- [MLX-VLM](https://github.com/Blaizzy/mlx-vlm)
- [LLM Plugin Documentation](https://llm.datasette.io/en/stable/plugins.html)

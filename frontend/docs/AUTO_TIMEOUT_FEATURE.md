# Auto-Timeout Feature for Model Downloads

## Problem Solved

Previously, VLM tests would timeout on first run because the model needs to download (~1GB). Users had to manually set `VLM_TIMEOUT_MS=90000` on first run.

## Solution Implemented

The script now automatically detects if the model is cached and adjusts the timeout accordingly.

## How It Works

### 1. Model Availability Check

Before processing images, the script checks if the model is available:

```typescript
async function checkModelAvailable(llmBin: string, modelName: string): Promise<boolean> {
  try {
    const { stdout } = await execa(llmBin, ['models'], { timeout: 5000 });
    return stdout.includes(modelName);
  } catch {
    return false;
  }
}
```

### 2. Dynamic Timeout Adjustment

```typescript
let timeoutMs: number;
if (process.env.VLM_TIMEOUT_MS) {
  // User explicitly set timeout - respect it
  timeoutMs = parseInt(process.env.VLM_TIMEOUT_MS, 10);
} else if (!modelAvailable) {
  // First run - model needs downloading (~1GB)
  timeoutMs = 180000; // 3 minutes for download + inference
  console.log('Model not cached - will download on first use');
  console.log('Using extended timeout: 3 minutes');
} else {
  // Model cached - use normal timeout
  timeoutMs = 30000; // 30 seconds
}
```

### 3. Informative Heartbeat Messages

Heartbeat messages adapt based on context:

```typescript
if (!modelAvailable && elapsed < 60000) {
  // First minute - likely downloading
  console.log(`Downloading model... (${elapsed}s elapsed, may take 1-3 minutes)`);
} else if (!modelAvailable && elapsed < 120000) {
  // 1-2 minutes - still downloading or loading
  console.log(`Model download continuing... (${elapsed}s elapsed)`);
} else {
  // Normal inference
  console.log(`Processing... (${elapsed}s elapsed, ${remaining}s remaining)`);
}
```

### 4. Upfront Status Report

At startup, users are informed about what to expect:

```
[VLM] [INIT] Step 3a: Checking model availability...
[VLM] [INIT] ✓ Model 'SmolVLM-500M' is cached locally
[VLM] [INIT] Expected response time: 5-15 seconds per image
```

Or on first run:

```
[VLM] [INIT] Step 3a: Checking model availability...
[VLM] [INIT] ⚠ Model 'SmolVLM-500M' not cached - will download on first use
[VLM] [INIT] Model size: ~1GB, download time: 1-3 minutes (one-time only)
[VLM] [INIT] Subsequent runs will be fast (5-15 seconds)
[VLM] [INIT] Using extended timeout: 3 minutes for first image
```

## User Experience

### First Run (Model Download)

```bash
$ pixi run test-vlm

[VLM] ========================================
[VLM] Starting VLM audit script
[VLM] ========================================
[VLM] [INIT] Step 3a: Checking model availability...
[VLM] [INIT] ⚠ Model 'SmolVLM-500M' not cached - will download on first use
[VLM] [INIT] Model size: ~1GB, download time: 1-3 minutes (one-time only)
[VLM] [INIT] Subsequent runs will be fast (5-15 seconds)
[VLM] [INIT] Using extended timeout: 3 minutes for first image
[VLM] ========================================

[viewer] [HEARTBEAT] Downloading model... (10s elapsed, may take 1-3 minutes)
[viewer] [HEARTBEAT] Downloading model... (15s elapsed, may take 1-3 minutes)
[viewer] [HEARTBEAT] Downloading model... (20s elapsed, may take 1-3 minutes)
...
[viewer] ✓ Successfully processed (took 87s)
```

### Subsequent Runs (Cached Model)

```bash
$ pixi run test-vlm

[VLM] ========================================
[VLM] Starting VLM audit script
[VLM] ========================================
[VLM] [INIT] Step 3a: Checking model availability...
[VLM] [INIT] ✓ Model 'SmolVLM-500M' is cached locally
[VLM] [INIT] Expected response time: 5-15 seconds per image
[VLM] ========================================

[viewer] [HEARTBEAT] Processing... (5s elapsed, 25s remaining)
[viewer] ✓ Successfully processed (took 12s)
```

## Timeout Behavior

| Scenario | Timeout | Notes |
|----------|---------|-------|
| **Model cached** | 30 seconds | Normal fast inference |
| **Model not cached** | 3 minutes | First run download + inference |
| **Manual override** | User-specified | `VLM_TIMEOUT_MS=60000` |

## Benefits

### ✅ No Manual Intervention
Users don't need to remember to set different timeouts for first run.

### ✅ Clear Communication
Users know exactly what's happening and how long to expect.

### ✅ Respects User Choice
If `VLM_TIMEOUT_MS` is set, that takes precedence.

### ✅ Graceful Handling
Different stages of download/loading are communicated differently.

## Code Changes

### Files Modified

1. **`scripts/docs-overview-vlm.ts`**:
   - Added `checkModelAvailable()` function
   - Added dynamic timeout logic in `runLlmOnImage()`
   - Enhanced heartbeat messages
   - Added upfront status reporting in `main()`

### New Functions

```typescript
// Check if model is cached locally
async function checkModelAvailable(
  llmBin: string,
  modelName: string
): Promise<boolean>
```

## Testing

### Test First Run (Model Not Cached)

```bash
# Clear model cache (if you want to test first-run behavior)
rm -rf ~/.cache/huggingface/hub/models--HuggingfaceTB--SmolVLM-500M-Instruct

# Run test - should show download message and use 3-minute timeout
pixi run test-vlm
```

### Test Cached Run

```bash
# Run test - should show cached message and use 30-second timeout
pixi run test-vlm
```

### Test Manual Override

```bash
# Force specific timeout
VLM_TIMEOUT_MS=60000 pixi run test-vlm
```

## Troubleshooting

### Still timing out on first run?

The 3-minute timeout should be sufficient for most connections. If you have a slow connection:

```bash
VLM_TIMEOUT_MS=300000 pixi run test-vlm  # 5 minutes
```

### Want to use different model?

```bash
VLM_MODEL=SmolVLM-256M pixi run test-vlm  # Faster, smaller model
```

### Check if model is cached

```bash
pixi run llm models | grep SmolVLM-500M
```

If it shows up, model is cached. If not, first run will download it.

## Future Enhancements

Possible improvements:

1. **Pre-download command**: Add `pixi run vlm-download` to download model without running tests
2. **Progress bar**: Show actual download progress (would need MLX-VLM API changes)
3. **Parallel downloads**: Download model while running other tests
4. **Cache location**: Allow custom cache directory via env var

## Summary

Users can now run `pixi run test-vlm` without worrying about timeouts. The script:
- ✅ Detects if model is cached
- ✅ Adjusts timeout automatically (30s vs 3min)
- ✅ Communicates status clearly
- ✅ Provides helpful progress messages
- ✅ Respects manual timeout overrides

**No more `VLM_TIMEOUT_MS=90000` needed!** 🎉

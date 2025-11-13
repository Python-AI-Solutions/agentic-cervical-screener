# Debugging Node.js Subprocess with MLX-VLM in Pixi Environment

## Problem Summary

When attempting to call the `llm` CLI (with MLX-VLM plugin) from Node.js TypeScript scripts running inside a pixi environment, the subprocess would consistently timeout after 30-60 seconds with no output, despite the same command working perfectly when executed directly in the shell.

## Architecture Context

We chose to encapsulate npm within a pixi environment to unify Python and Node.js dependencies:

```toml
# frontend/pixi.toml
[dependencies]
nodejs = "20.*"
python = "3.12.*"

[target.osx-arm64.pypi-dependencies]
llm = "*"
llm-mlx-vlm = { path = "external/llm-mlx-vlm", editable = true }

[tasks]
vlm-viewer = { cmd = "npm run vlm:viewer", env = { LLM_BIN = "llm" } }
```

This means:
- `pixi run vlm-viewer` → runs npm → runs tsx → runs our TypeScript script → calls `llm` via execa
- The `llm` binary is in `.pixi/envs/default/bin/llm`
- Both npm and llm need to be accessible in the same subprocess chain

## Initial Hypotheses (All Wrong!)

### Hypothesis 1: PATH Not Set ❌
**Thought**: The `llm` binary isn't in PATH when called from Node.js subprocess.

**Evidence Against**:
```bash
pixi run bash -c 'npx tsx scripts/test-llm-path.ts'
# Output: SUCCESS! llm models command works fine
```

The PATH was correctly set - `.pixi/envs/default/bin` was first in PATH when running under pixi.

### Hypothesis 2: Python Environment Not Activated ❌
**Thought**: The `llm` script needs PYTHONPATH and other env vars to find mlx-vlm.

**Evidence Against**:
```bash
# Direct binary execution fails differently
/path/to/llm -m SmolVLM-500M ...
# Error: mlx-vlm is not installed

# But via pixi it works
pixi run llm -m SmolVLM-500M ...
# Success!
```

While this was a real issue for direct binary execution, it wasn't the cause of the timeout. When using `llm` from PATH (not absolute path), it found everything correctly.

### Hypothesis 3: Buffering/Streaming Issue ❌
**Thought**: MLX-VLM writes to stderr and it fills up the buffer, causing deadlock.

**Evidence Against**:
```typescript
// Tried various execa options
{ all: true }  // Merge stdout/stderr - still hangs
{ stdio: 'pipe', buffer: true }  // Explicitly buffer - still hangs
```

The process never produced any output chunks, so buffering wasn't the issue.

### Hypothesis 4: The --no-stream --no-log Flags ❌
**Thought**: These flags might be causing the process to wait indefinitely.

**Evidence Against**:
```typescript
// Removed flags entirely
await execa('llm', ['-m', 'SmolVLM-500M', '-a', imagePath, prompt])
// Still hangs with no output!
```

## The Actual Problem: Stdin Not Closed 💡

### Discovery Process

The breakthrough came when testing with `stdio: 'inherit'`:

```typescript
await execa('llm', args, { stdio: 'inherit' })
// SUCCESS in 9 seconds!
```

But without `stdio: 'inherit'`:
```typescript
await execa('llm', args, { timeout: 60000 })
// Timeout after 60s, no output (stdout='', stderr='')
```

Testing with raw `child_process.spawn`:
```typescript
const proc = spawn('llm', args);
proc.stdout.on('data', (data) => console.log('[STDOUT]', data));
// Never fires - no data chunks at all!

proc.stdin?.end(); // <-- Close stdin immediately
// Now it works! Output appears immediately!
```

### Root Cause

**The `llm` CLI tool waits for stdin to close before processing the request.**

When using `execa()` or `spawn()` without closing stdin:
1. Node.js creates pipes for stdin/stdout/stderr
2. The subprocess sees an open stdin pipe
3. MLX-VLM (or the llm wrapper) waits for stdin to be closed
4. The Node.js script waits for subprocess output
5. **Deadlock** - both sides waiting for the other

When using `stdio: 'inherit'`:
- stdin is inherited from parent process
- Parent's stdin is likely already closed or not blocking
- Process proceeds normally

### The Fix

**Solution 1: Close stdin explicitly with execa**
```typescript
await execa('llm', args, {
  input: '', // Sends empty string then closes stdin
  timeout: 30000,
})
```

**Solution 2: Close stdin with spawn**
```typescript
const proc = spawn('llm', args);
proc.stdin?.end(); // Close stdin immediately

proc.stdout.on('data', (data) => {
  // Now this fires!
});
```

## Key Insights

### 1. **Subprocess Stdin Behavior Varies by Tool**
Not all CLI tools require stdin to be closed. This is specific to how the upstream tool handles input:
- Some tools read from stdin only if data is available
- Others (like Simon Willison's `llm` CLI) wait for EOF on stdin before proceeding
- This behavior isn't always documented
- **Note:** This is behavior in the upstream `llm` package, not our plugin code

### 2. **`stdio: 'inherit'` Masks Issues**
When debugging subprocess issues:
- `stdio: 'inherit'` might work when normal piping doesn't
- This is a strong signal that stdin handling is the problem
- Don't assume it's a PATH or environment variable issue

### 3. **Pixi + npm + Node Subprocess Works Fine**
The nested environment architecture is solid:
```
pixi → npm → tsx → execa → llm (Python)
```

All the PATH and environment variables propagate correctly. The issue was purely about stdin handling.

### 4. **Empty Output Indicates Blocking, Not Errors**
When debugging subprocess issues:
- `stdout = '', stderr = ''` → Process started but is blocked/waiting
- `ENOENT` → Binary not found (PATH issue)
- `Exit code 1` with stderr → Process ran but failed

### 5. **Test Progressively Simpler Cases**
Our debugging progression:
1. Full script with execa → hangs
2. Simplified test with execa → hangs
3. Test with `stdio: 'inherit'` → works!
4. Test with `spawn` and event listeners → hangs
5. Test with `spawn` + `stdin.end()` → works!

This isolated the issue to stdin handling specifically.

## How to Avoid This Issue

### Recognition Checklist
You're likely hitting this issue if:
- ✅ Direct shell command works fine
- ✅ Same command via execa/spawn hangs with no output
- ✅ `stdio: 'inherit'` works but normal piping doesn't
- ✅ No PATH or "command not found" errors
- ✅ Process starts (no immediate error) but never completes

### Quick Fix
Try adding to your execa call:
```typescript
await execa(command, args, {
  input: '', // Close stdin immediately
  // ... other options
})
```

### Testing Strategy
When encountering subprocess hangs:
1. Test with `stdio: 'inherit'` first
2. If that works, it's stdin-related
3. Try `input: ''` with execa
4. Or use spawn with `proc.stdin?.end()`

## Additional MLX-VLM Gotcha: Output Parsing

The MLX-VLM output format includes debug information:
```
Calling `python -m mlx_vlm.generate ...` is deprecated...
==========
Files: ['/path/to/image.png']

Prompt: <|im_start|>User:<image>Your prompt here<end_of_utterance>
Assistant:
 The actual response here
==========
Prompt: 882 tokens, 235.146 tokens-per-sec
Generation: 9 tokens, 68.896 tokens-per-sec
Peak memory: 1.935 GB
```

You need to extract just the answer:
```typescript
const assistantMatch = stdout.match(/Assistant:\s*\n\s*(.+?)(?=\n==========)/s);
const answer = assistantMatch ? assistantMatch[1].trim() : stdout.trim();
```

## Files Modified

- `frontend/scripts/docs-overview-vlm.ts` - Added `input: ''` to execa call
- `frontend/pixi.toml` - Environment setup (this was working correctly all along)

## Commands That Work

```bash
# Direct shell execution
pixi run llm -m SmolVLM-500M "test" -a image.png

# Via npm script in pixi
pixi run vlm-viewer

# Via Node.js with proper stdin handling
npx tsx scripts/docs-overview-vlm.ts --suite viewer
```

## Lessons for Future Debugging

1. **Don't assume PATH issues first** - Verify with simple test scripts
2. **Test stdin handling early** - Try `stdio: 'inherit'` as diagnostic
3. **Pixi + npm integration is robust** - Environment propagates correctly
4. **Read subprocess output can be empty** - Doesn't mean error, might mean blocking
5. **Close stdin explicitly** - Some CLIs wait for EOF on stdin before processing

## References

- execa documentation: https://github.com/sindresorhus/execa
- Node.js child_process: https://nodejs.org/api/child_process.html
- Related issue pattern: Programs that read from stdin even when not needed

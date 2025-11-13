# Environment Architecture & Integration Strategy

## Current Environment Structure

```
agentic-cervical-screener/
├── pixi.toml (via pyproject.toml)          # Root: Python backend + ML + testing
│   └── Python 3.12 environment
│       ├── FastAPI backend
│       ├── PyTorch + YOLO
│       ├── pytest
│       ├── llm (Simon Willison's CLI)
│       └── llm-ollama plugin
│
├── frontend/
│   ├── package.json                         # Frontend: Node.js + TypeScript + Vite
│   │   └── npm environment
│   │       ├── Vite (dev server)
│   │       ├── Playwright (E2E tests)
│   │       ├── Vitest (unit tests)
│   │       ├── TypeScript
│   │       └── execa (subprocess for calling llm)
│   │
│   └── external/llm-mlx-vlm/
│       └── pixi.toml                        # Plugin: Isolated Python env for MLX-VLM
│           └── Python 3.12 environment
│               ├── llm (CLI)
│               ├── mlx-vlm
│               ├── mlx (Apple Silicon)
│               └── transformers
```

## Three Separate Environments

### 1. **Root Environment** (Backend + Testing)
- **Tool**: Pixi (conda-based)
- **Location**: `/agentic-cervical-screener/`
- **Config**: `pyproject.toml` with `[tool.pixi.*]` sections
- **Purpose**: Python backend, ML models, API testing
- **Python**: 3.12
- **Key packages**: FastAPI, PyTorch, ultralytics, pytest, llm, llm-ollama

### 2. **Frontend Environment** (JavaScript/TypeScript)
- **Tool**: npm
- **Location**: `/agentic-cervical-screener/frontend/`
- **Config**: `package.json`
- **Purpose**: Frontend dev, E2E tests, build tools
- **Runtime**: Node.js
- **Key packages**: Vite, Playwright, Vitest, TypeScript, execa

### 3. **MLX-VLM Plugin Environment** (VLM Testing)
- **Tool**: Pixi (isolated)
- **Location**: `/agentic-cervical-screener/frontend/external/llm-mlx-vlm/`
- **Config**: `pixi.toml`
- **Purpose**: MLX-optimized VLM inference for UI testing
- **Python**: 3.12
- **Platform**: osx-arm64 only (Apple Silicon)
- **Key packages**: llm, mlx-vlm, mlx, transformers

## Problem: Environment Integration

The frontend tests (npm/Node.js) need to call Python tools (llm CLI with MLX-VLM plugin).

### Current Issues:

1. **Isolation**: Each environment is isolated
2. **Binary Access**: Frontend tests need to call `llm` command
3. **Plugin Discovery**: `llm` needs to find the MLX-VLM plugin
4. **PATH issues**: `llm` binary not in frontend's PATH by default

## Integration Strategies

### Strategy 1: **Use Plugin's Pixi Environment** (Current Recommendation)

Frontend tests explicitly call the plugin's pixi environment:

```bash
# In npm scripts or tests
LLM_BIN="pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm" \
  node scripts/docs-overview-vlm.ts
```

**Pros:**
- ✅ Completely isolated - no environment conflicts
- ✅ Explicit - clear which environment is being used
- ✅ Works without system-wide llm installation
- ✅ Reproducible - same Python/deps every time

**Cons:**
- ❌ Verbose command
- ❌ pixi overhead on each call (~100ms)
- ❌ Mac-only (MLX requirement)

**When to use:**
- CI/CD pipelines
- Developer machines where `llm` not installed globally
- When you need guaranteed isolation

### Strategy 2: **Install Plugin in Root Environment**

Install llm-mlx-vlm into the root pixi environment:

```bash
# In root pyproject.toml, add to [tool.pixi.pypi-dependencies]:
llm-mlx-vlm = { path = "frontend/external/llm-mlx-vlm", editable = true }
```

Then run from root:
```bash
cd /agentic-cervical-screener
pixi run llm -m SmolVLM-500M "prompt" -a frontend/screenshot.png
```

**Pros:**
- ✅ Single environment to manage
- ✅ Faster (no pixi overhead per call)
- ✅ Can use root pixi tasks
- ✅ Simpler commands

**Cons:**
- ❌ Mixes backend and frontend concerns
- ❌ Root env is multi-platform, MLX is Mac-only
- ❌ Frontend tests depend on root environment

**When to use:**
- Local development on Mac
- When you run everything via root pixi
- Simpler project structure preferred

### Strategy 3: **System-wide llm + Install Plugin**

Install `llm` and plugin globally:

```bash
# System-wide installation
pip install llm
cd frontend/external/llm-mlx-vlm
pip install -e .
```

Then frontend tests just call `llm`:
```bash
llm -m SmolVLM-500M "prompt" -a screenshot.png
```

**Pros:**
- ✅ Simplest integration - just works
- ✅ Fastest (no subprocess overhead)
- ✅ Works from anywhere

**Cons:**
- ❌ Pollutes system Python
- ❌ Not reproducible
- ❌ Version conflicts possible
- ❌ Manual setup required per machine

**When to use:**
- Quick local testing
- Development machines only
- NOT for CI/CD

### Strategy 4: **Hybrid with npm Post-install Hook**

Add npm post-install hook to setup plugin:

```json
// frontend/package.json
{
  "scripts": {
    "postinstall": "cd external/llm-mlx-vlm && pixi install && pixi run install-dev",
    "test:vlm": "LLM_BIN='pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm' node scripts/docs-overview-vlm.ts"
  }
}
```

**Pros:**
- ✅ Automatic setup on `npm install`
- ✅ Isolated environments
- ✅ Works for new developers

**Cons:**
- ❌ Slower `npm install`
- ❌ Requires pixi installed system-wide
- ❌ Platform-specific (Mac-only)

**When to use:**
- Teams where everyone has pixi
- Mac-only development
- Want automatic setup

## Recommended Approach: Strategy 1 + Strategy 2 Combo

### For Local Development (Mac):
Use **Strategy 2** - install plugin in root environment:

1. **Add to root `pyproject.toml`:**

```toml
[tool.pixi.pypi-dependencies]
llm = "*"
llm-ollama = "*"
llm-mlx-vlm = { path = "frontend/external/llm-mlx-vlm", editable = true }
```

2. **Run frontend tests from root:**

```bash
# From project root
pixi run -e default npm --prefix frontend run vlm:viewer
```

3. **Or add pixi task:**

```toml
[tool.pixi.tasks]
frontend-vlm = { cmd = "npm --prefix frontend run test:vlm", env = { LLM_BIN = "llm" } }
```

Then:
```bash
pixi run frontend-vlm
```

### For CI/CD:
Use **Strategy 1** - explicit pixi call:

```yaml
# .github/workflows/test.yml
- name: Run VLM tests
  working-directory: frontend
  run: |
    cd external/llm-mlx-vlm
    pixi install
    pixi run install-dev
    cd ../..
    LLM_BIN="pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm" \
      npm run test:vlm
```

### For Other Devs (Mixed Platforms):
Use **Strategy 3** fallback - system llm:

```bash
# In docs
pip install llm
cd frontend/external/llm-mlx-vlm
pip install -e .

# Then just use npm scripts
npm run vlm:viewer
```

## Implementation Plan

### Option A: Unified Root Environment (Simplest for Mac)

```toml
# In root pyproject.toml

[tool.pixi.pypi-dependencies]
llm = "*"
llm-ollama = "*"
llm-mlx-vlm = { path = "frontend/external/llm-mlx-vlm", editable = true }

[tool.pixi.tasks]
# Frontend VLM tests
vlm-viewer = "npm --prefix frontend run vlm:viewer"
vlm-docs = "npm --prefix frontend run vlm:docs"
vlm-all = "npm --prefix frontend run test:vlm"

# Full test suite
test-all = { depends-on = ["test", "vlm-all"] }
```

**Usage:**
```bash
pixi run vlm-viewer
pixi run vlm-all
pixi run test-all  # Backend tests + VLM tests
```

**Update frontend/package.json:**
```json
{
  "scripts": {
    "vlm:viewer": "node scripts/docs-overview-vlm.ts --suite viewer",
    "vlm:docs": "node scripts/docs-overview-vlm.ts --suite docs-overview",
    "test:vlm": "npm run vlm:docs && npm run vlm:viewer"
  }
}
```

No `LLM_BIN` needed - it's in the pixi environment's PATH!

### Option B: Keep Environments Separate (Most Flexible)

**Keep plugin isolated, but add helper npm scripts:**

```json
// frontend/package.json
{
  "scripts": {
    "vlm:viewer": "node scripts/docs-overview-vlm.ts --suite viewer",
    "vlm:viewer:local": "pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm --help && npm run vlm:viewer",
    "vlm:setup": "cd external/llm-mlx-vlm && pixi install && pixi run install-dev"
  }
}
```

**Add to root pyproject.toml:**
```toml
[tool.pixi.tasks]
frontend-vlm-setup = "cd frontend/external/llm-mlx-vlm && pixi install && pixi run install-dev"
frontend-vlm = { cmd = "npm --prefix frontend run vlm:viewer", env = { LLM_BIN = "pixi run --manifest-path frontend/external/llm-mlx-vlm/pixi.toml llm" } }
```

## Decision Matrix

| Scenario | Strategy | Command |
|----------|----------|---------|
| Local dev (Mac, pixi) | Root install | `pixi run vlm-viewer` |
| Local dev (no pixi) | System install | `npm run vlm:viewer` |
| CI/CD (Mac runner) | Isolated plugin | `LLM_BIN="pixi run ..." npm run vlm:viewer` |
| CI/CD (Linux) | Cloud API fallback | `VLM_MODEL=claude-3-haiku npm run vlm:viewer` |

## Recommendation: Unified Root Environment

**Implement Option A** because:

1. ✅ **Simplest**: Single `pixi run` command for everything
2. ✅ **Consistent**: Same Python version across backend + VLM
3. ✅ **Fast**: No subprocess pixi overhead
4. ✅ **Discoverable**: `pixi task list` shows all commands
5. ✅ **Manageable**: One lockfile for Python deps

**Implementation:**

```bash
# 1. Add plugin to root environment
cd /agentic-cervical-screener
# Edit pyproject.toml to add llm-mlx-vlm

# 2. Install
pixi install

# 3. Test
pixi run llm models | grep MLX-VLM

# 4. Run VLM tests
pixi run npm --prefix frontend run vlm:viewer

# 5. (Optional) Add pixi tasks for convenience
```

Would you like me to implement Option A (unified) or Option B (separate)?
